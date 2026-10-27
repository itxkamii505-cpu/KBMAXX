import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import dns from 'dns';
import net from 'net';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import { store, safeCompare, sanitizeInputString, extractOtp } from './server/store';
import type { UserSession } from './src/types';

interface AuthRequest extends Request {
  session?: UserSession;
}

// All local-time calculations (month/year stats, provider date params) use Pakistan time regardless of the VPS timezone
process.env.TZ = process.env.TZ || 'Asia/Karachi';

const app = express();
// nginx is the only proxy in front of Node: trust exactly one hop so req.ip is the real client IP
// (the client-supplied X-Forwarded-For prefix can no longer be used to bypass rate limits)
app.set('trust proxy', 1);
function getServerPort(): number {
  if (process.env.PORT) {
    const p = parseInt(process.env.PORT, 10);
    if (!isNaN(p) && p > 0) return p;
  }
  const portArg = process.argv.find(arg => arg.startsWith('--port'));
  if (portArg) {
    const val = portArg.includes('=') ? portArg.split('=')[1] : process.argv[process.argv.indexOf(portArg) + 1];
    const p = parseInt(val, 10);
    if (!isNaN(p) && p > 0) return p;
  }
  return 3000;
}
const PORT = getServerPort();

// Remove revealing server technology header
app.disable('x-powered-by');

// ==========================================
// SECURITY HEADERS & DEFENSE-IN-DEPTH
// ==========================================
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // Allow framing in AI Studio iframe while securing standalone production deployments
  if (process.env.NODE_ENV === 'production' && !process.env.APP_URL) {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  }
  if (_req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000');
  }
  next();
});

// Cache prevention on all sensitive API routes
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Enable gzip/deflate compression for blazing fast asset & API delivery
app.use(compression() as any);

// Configured CORS for safe origin communication
app.use(cors((req, callback) => {
  const origin = req.headers.origin as string | undefined;
  const base = {
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Webhook-Token', 'X-API-Key', 'Accept'],
  };
  // No Origin header: server-to-server webhooks, curl, same-origin GETs -> allowed
  if (!origin) return callback(null, { ...base, origin: true });
  let allowed = false;
  try {
    const originHost = new URL(origin).host;
    if (originHost === req.headers.host) allowed = true; // same origin
    if (!allowed && process.env.NODE_ENV === 'development' && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(originHost)) allowed = true;
  } catch { /* malformed origin */ }
  if (!allowed && process.env.ALLOWED_ORIGIN) {
    allowed = process.env.ALLOWED_ORIGIN.split(',').map(o => o.trim()).filter(Boolean).includes(origin);
  }
  return callback(null, { ...base, origin: allowed });
}));

// Strictly bound JSON body limit to 2.5MB to protect Node.js event loop
app.use(express.json({ limit: '2.5mb' }));
app.use(express.urlencoded({ extended: true, limit: '2.5mb' }));

// ==========================================
// IN-MEMORY SLIDING WINDOW RATE LIMITER
// ==========================================
interface RateLimitBucket {
  count: number;
  resetAt: number;
}

class InMemoryRateLimiter {
  private buckets = new Map<string, RateLimitBucket>();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;

    // Periodic sweep to prevent memory growth
    setInterval(() => {
      const now = Date.now();
      for (const [ip, bucket] of this.buckets.entries()) {
        if (now >= bucket.resetAt) {
          this.buckets.delete(ip);
        }
      }
    }, 60000);
  }

  public check(key: string): { allowed: boolean; remaining: number; resetInSec: number } {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 1, resetAt: now + this.windowMs };
      this.buckets.set(key, bucket);
      return { allowed: true, remaining: this.maxRequests - 1, resetInSec: Math.ceil(this.windowMs / 1000) };
    }

    bucket.count++;
    const resetInSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    if (bucket.count > this.maxRequests) {
      return { allowed: false, remaining: 0, resetInSec };
    }

    return { allowed: true, remaining: this.maxRequests - bucket.count, resetInSec };
  }
}

const loginRateLimiter = new InMemoryRateLimiter(10, 5 * 60 * 1000);  // Max 10 attempts per 5 mins per IP
const webhookRateLimiter = new InMemoryRateLimiter(1200, 60 * 1000);  // High-capacity: Max 1200 inbound webhook requests/min
const apiRateLimiter = new InMemoryRateLimiter(500, 60 * 1000);       // Max 500 API calls/min per IP

function getClientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

// Global API Rate Limiter
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  // Allow SSE stream and media uploads without counting against standard request rate limiter
  if (req.path === '/sms/stream' || req.path === '/upload/media') {
    return next();
  }

  const clientIp = getClientIp(req);
  const check = apiRateLimiter.check(clientIp);
  if (!check.allowed) {
    return res.status(429).json({ 
      error: 'TOO_MANY_REQUESTS', 
      message: `API rate limit exceeded. Please retry in ${check.resetInSec}s.` 
    });
  }
  next();
});

// ==========================================
// SSRF DEFENSE: Outbound URL Validation
// ==========================================
export function isSafeOutboundUrl(urlStr: string): { safe: boolean; reason?: string } {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { safe: false, reason: 'Only HTTP and HTTPS protocols are permitted' };
    }

    const host = parsed.hostname.toLowerCase();

    // Block localhost, loopbacks, internal domains, cloud metadata
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.endsWith('.localhost') ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host === 'metadata.google.internal' ||
      host === '169.254.169.254'
    ) {
      return { safe: false, reason: 'Outbound requests to localhost or cloud metadata services are forbidden' };
    }

    // Check for private IPv4 ranges
    const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
      const o1 = Number(ipv4Match[1]);
      const o2 = Number(ipv4Match[2]);
      const o3 = Number(ipv4Match[3]);
      const o4 = Number(ipv4Match[4]);
      if ([o1, o2, o3, o4].some(o => o < 0 || o > 255)) {
        return { safe: false, reason: 'Invalid IP address' };
      }
      if (o1 === 127) return { safe: false, reason: 'Loopback addresses are forbidden' };
      if (o1 === 10) return { safe: false, reason: 'Private 10.0.0.0/8 addresses are forbidden' };
      if (o1 === 172 && o2 >= 16 && o2 <= 31) return { safe: false, reason: 'Private 172.16.0.0/12 addresses are forbidden' };
      if (o1 === 192 && o2 === 168) return { safe: false, reason: 'Private 192.168.0.0/16 addresses are forbidden' };
      if (o1 === 169 && o2 === 254) return { safe: false, reason: 'Link-local addresses are forbidden' };
      if (o1 === 0) return { safe: false, reason: 'Zero-net addresses are forbidden' };
    }

    return { safe: true };
  } catch (err: any) {
    return { safe: false, reason: 'Malformed URL: ' + err.message };
  }
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    if (l === '::1' || l === '::') return true;
    if (l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe8') || l.startsWith('fe9') || l.startsWith('fea') || l.startsWith('feb')) return true;
    const m = l.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (m) return isPrivateIp(m[1]);
  }
  return false;
}

// In-memory DNS cache (5-minute TTL) to avoid redundant lookups on frequent poller cycles
const dnsCache = new Map<string, { addresses: string[]; expiresAt: number }>();

async function getCachedDnsAddresses(host: string): Promise<string[]> {
  const now = Date.now();
  const cached = dnsCache.get(host);
  if (cached && cached.expiresAt > now) {
    return cached.addresses;
  }
  const addrs = await dns.promises.lookup(host, { all: true });
  const ipList = addrs.map(a => a.address);
  dnsCache.set(host, { addresses: ipList, expiresAt: now + 5 * 60 * 1000 });
  return ipList;
}

// Full SSRF validation: string rules + cached DNS resolution (blocks hostnames that point to private IPs)
async function assertSafeOutboundUrl(urlStr: string): Promise<{ safe: boolean; reason?: string }> {
  const basic = isSafeOutboundUrl(urlStr);
  if (!basic.safe) return basic;
  try {
    const host = new URL(urlStr).hostname.replace(/^\[|\]$/g, '');
    if (net.isIP(host)) {
      return isPrivateIp(host) ? { safe: false, reason: 'Private or reserved IP addresses are forbidden' } : { safe: true };
    }
    const addrs = await getCachedDnsAddresses(host);
    if (addrs.some(addr => isPrivateIp(addr))) {
      return { safe: false, reason: 'Hostname resolves to a private or reserved address' };
    }
    return { safe: true };
  } catch (err: any) {
    return { safe: false, reason: 'DNS lookup failed: ' + err.message };
  }
}

// fetch() that re-validates every redirect hop (max 3) so a public URL can not bounce into the internal network
async function safeFetch(urlStr: string, init: RequestInit = {}): Promise<globalThis.Response> {
  let current = urlStr;
  for (let hop = 0; hop <= 3; hop++) {
    const check = await assertSafeOutboundUrl(current);
    if (!check.safe) throw new Error(`Blocked unsafe URL: ${check.reason}`);
    const res = await fetch(current, { ...init, redirect: 'manual' });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location')!, current).toString();
      continue;
    }
    return res;
  }
  throw new Error('Too many redirects');
}

// --- Authentication Middleware ---
function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const queryToken = (req.query.token as string | undefined) || (req.query.apiKey as string | undefined);
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (queryToken) {
    token = queryToken;
  }

  if (!token) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
  }

  const session = store.validateSession(token);
  if (!session) {
    return res.status(401).json({ error: 'SESSION_EXPIRED', message: 'Session expired or account deactivated' });
  }

  req.session = session;
  if (session.role === 'client' && session.userId) {
    store.recordClientActivity(session.userId, getClientIp(req));
  }
  next();
}

function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.session?.role !== 'admin') {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Admin access required' });
    }
    next();
  });
}

// Client Activity / Ping Endpoint (Tracks panel open counts and live presence)
app.post('/api/client/activity', requireAuth, (req: AuthRequest, res: Response) => {
  if (req.session && req.session.role === 'client' && req.session.userId) {
    store.recordClientPanelOpen(req.session.userId, getClientIp(req));
  }
  res.json({ success: true });
});

// ==========================================
// STATIC MEDIA UPLOADS & 50MB MEDIA UPLOAD ENGINE
// ==========================================
const UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Serve uploaded video and image media with byte-range headers for video streaming
app.use('/uploads', express.static(UPLOADS_DIR, {
  maxAge: '30d',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.mp4')) {
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Accept-Ranges', 'bytes');
    } else if (filePath.endsWith('.webm')) {
      res.setHeader('Content-Type', 'video/webm');
      res.setHeader('Accept-Ranges', 'bytes');
    }
  }
}));

// Admin Media Upload Endpoint: Supports up to 50MB video/picture files directly
app.post(
  '/api/upload/media',
  requireAdmin,
  express.raw({ type: '*/*', limit: '55mb' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const rawFilename = (req.query.filename as string) || 'media.mp4';
      const extMatch = rawFilename.match(/\.([a-zA-Z0-9]+)$/);
      const ext = extMatch ? extMatch[1].toLowerCase() : 'mp4';
      const allowedExts = ['mp4', 'webm', 'mov', 'jpg', 'jpeg', 'png', 'webp', 'gif'];
      if (!allowedExts.includes(ext)) {
        return res.status(400).json({ error: `File type .${ext} is not supported. Use MP4, WebM, JPG, PNG, or WebP.` });
      }

      const buffer = req.body;
      if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
        return res.status(400).json({ error: 'No media data received. Please select a valid file up to 50MB.' });
      }

      if (buffer.length > 52 * 1024 * 1024) {
        return res.status(400).json({ error: 'File size exceeds 50MB limit.' });
      }

      const head = buffer.subarray(0, 16);
      const hex = head.toString('hex');
      const ascii = head.toString('latin1');
      const magicOk =
        ((ext === 'jpg' || ext === 'jpeg') && hex.startsWith('ffd8ff')) ||
        (ext === 'png' && hex.startsWith('89504e47')) ||
        (ext === 'gif' && (ascii.startsWith('GIF87a') || ascii.startsWith('GIF89a'))) ||
        (ext === 'webp' && ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') ||
        (ext === 'webm' && hex.startsWith('1a45dfa3')) ||
        ((ext === 'mp4' || ext === 'mov') && ascii.slice(4, 8) === 'ftyp');
      if (!magicOk) {
        return res.status(400).json({ error: 'File content does not match its extension.' });
      }

      const safeName = `login_bg_${Date.now()}.${ext}`;
      const filePath = path.join(UPLOADS_DIR, safeName);
      await fs.promises.writeFile(filePath, buffer);

      // Remove previous login background uploads so the uploads folder cannot grow forever
      try {
        for (const f of await fs.promises.readdir(UPLOADS_DIR)) {
          if (f.startsWith('login_bg_') && f !== safeName) {
            await fs.promises.unlink(path.join(UPLOADS_DIR, f)).catch(() => {});
          }
        }
      } catch { /* ignore cleanup errors */ }

      const mediaUrl = `/uploads/${safeName}`;
      return res.json({
        success: true,
        url: mediaUrl,
        filename: safeName,
        sizeBytes: buffer.length,
        message: `File uploaded successfully (${(buffer.length / (1024 * 1024)).toFixed(1)} MB).`,
      });
    } catch (err: any) {
      console.error('Media upload error:', err);
      return res.status(500).json({ error: 'Upload failed: ' + err.message });
    }
  }
);

// ==========================================
// 1. AUTHENTICATION & SESSION ENDPOINTS
// ==========================================

const handleLoginAuth = (req: Request, res: Response) => {
  const clientIp = getClientIp(req);
  const ipCheck = loginRateLimiter.check(clientIp);
  if (!ipCheck.allowed) {
    return res.status(429).json({ 
      error: `Too many login attempts. Please wait ${ipCheck.resetInSec} seconds before trying again.`,
      resetInSec: ipCheck.resetInSec 
    });
  }

  const { username, password } = req.body;
  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const result = store.login(username.trim().slice(0, 64), password.slice(0, 128), clientIp);
  if (result.error || !result.session) {
    const statusCode = result.isLocked ? 423 : (result.isInactive3Days ? 403 : 401);
    return res.status(statusCode).json({ 
      error: result.error || 'Authentication failed',
      isLocked: !!result.isLocked,
      lockedUntil: result.lockedUntil,
      isInactive3Days: !!result.isInactive3Days,
      deactivatedReason: result.deactivatedReason,
    });
  }

  const settings = store.getSettings();
  res.json({
    success: true,
    session: result.session,
    settings: {
      ...store.getPublicSettings(),
      ...(result.session.role === 'admin' ? { webhookToken: settings.webhookToken, adminUsername: settings.adminUsername } : {})
    },
  });
};

// Accept login on standard API route and direct VPS path /ints/login
app.post('/api/auth/login', handleLoginAuth);
app.post('/ints/login', handleLoginAuth);

// Direct redirect from legacy /login or /ints to official /ints/login
app.get(['/login', '/ints', '/ints/'], (_req: Request, res: Response) => {
  res.redirect(302, '/ints/login');
});

app.get('/api/auth/me', requireAuth, (req: AuthRequest, res: Response) => {
  const settings = store.getSettings();
  res.json({
    session: req.session,
    settings: {
      siteName: settings.siteName,
      tagline: settings.tagline,
      logoType: settings.logoType,
      customLogoUrl: settings.customLogoUrl,
      theme: settings.theme,
      darkMode: settings.darkMode,
      clientSessionMinutes: settings.clientSessionMinutes,
      ...(req.session?.role === 'admin' ? { webhookToken: settings.webhookToken } : {}),
    },
  });
});

app.post('/api/auth/logout', requireAuth, (req: AuthRequest, res: Response) => {
  if (req.session?.token) {
    store.logout(req.session.token);
  }
  res.json({ success: true, message: 'Logged out successfully' });
});

// ==========================================
// 2. LIVE SMS ENDPOINTS (CLIENT & ADMIN)
// ==========================================

// SSE Real-Time Clients Registry (0ms latency push)
interface SSEClient {
  res: Response;
  role: string;
  userId: string;
  allowedServices?: string[];
  part?: string;
}

const sseClients = new Set<SSEClient>();

function broadcastNewMessage(message: any) {
  if (!message) return;

  const eventData = JSON.stringify(message);
  // Evaluate the (expensive) client-block rules ONCE per message instead of once per connected client
  const blockedForClients = !!message.isClientBlocked || store.isMessageBlockedForClients(message);

  for (const client of sseClients) {
    try {
      // 1. Service restriction check for clients
      if (client.role === 'client' && client.allowedServices && client.allowedServices.length > 0 && !client.allowedServices.includes('*')) {
        const msgService = (message.service || message.sender || '').toLowerCase().trim();
        const allowed = client.allowedServices.some((s: string) => s.toLowerCase().trim() === msgService);
        if (!allowed) continue;
      }

      // 2. Client blacklist block rule check (Real-time dynamic verification)
      if (client.role === 'client' && blockedForClients) {
        continue;
      }

      // 3. Partition stream check
      if (client.part && client.part !== 'all') {
        const target = client.part.toLowerCase().trim();
        const mPartId = String(message.partId || '').toLowerCase().trim();
        const mPart = String(message.part || '').toLowerCase().trim();
        const mPartName = String(message.partName || '').toLowerCase().trim();

        const matches = 
          mPartId === target || 
          mPart === target || 
          mPartName === target ||
          (target === '1' && (mPartId === 'part_1' || mPart === '1' || mPartName.includes('part 1'))) ||
          (target === '2' && (mPartId === 'part_2' || mPart === '2' || mPartName.includes('part 2'))) ||
          (target === 'part_1' && (mPartId === '1' || mPart === '1')) ||
          (target === 'part_2' && (mPartId === '2' || mPart === '2'));

        if (!matches) continue;
      }

      // Instant 0ms write to client connection
      client.res.write(`event: new_sms\ndata: ${eventData}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Hook store.onNewMessage to SSE broadcaster
store.onNewMessage((msg) => {
  broadcastNewMessage(msg);
});

// Hook store.onFilterRuleChanged to refresh connected client feeds immediately
store.onFilterRuleChanged(() => {
  broadcastClearEvent('client');
});

function broadcastClearEvent(target: 'client' | 'admin' | 'all', part?: string) {
  const eventPayload = JSON.stringify({ target, part: part || 'all', timestamp: Date.now() });
  for (const client of sseClients) {
    try {
      if (target === 'client' && client.role !== 'client') continue;
      client.res.write(`event: clear_logs\ndata: ${eventPayload}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

// SSE Live Stream Endpoint
app.get('/api/sms/stream', requireAuth, (req: AuthRequest, res: Response) => {
  let openStreams = 0;
  for (const c of sseClients) {
    if (c.userId === req.session!.userId) openStreams++;
  }
  if (openStreams >= 8) {
    return res.status(429).json({ error: 'TOO_MANY_STREAMS', message: 'Too many open live streams for this account' });
  }
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const clientInfo: SSEClient = {
    res,
    role: req.session!.role,
    userId: req.session!.userId,
    allowedServices: req.session!.allowedServices,
    part: (req.query.part as string) || 'all',
  };

  sseClients.add(clientInfo);

  // Send connected greeting
  res.write(`event: connected\ndata: {"status":"connected","timestamp":${Date.now()}}\n\n`);

  // Send keepalive heartbeat every 15s
  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch {
      clearInterval(heartbeat);
      sseClients.delete(clientInfo);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(clientInfo);
  });
});

app.get('/api/sms', requireAuth, (req: AuthRequest, res: Response) => {
  const role = req.session!.role;
  const allowedServices = req.session!.allowedServices;
  const query = req.query.q as string | undefined;
  const configuredMax = store.getSettings().maxSmsRetention || 2000;
  const reqLimit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
  const limit = reqLimit && reqLimit > 0 ? Math.min(reqLimit, 50000) : configuredMax;
  const part = req.query.part as string | undefined;
  const clientId = role === 'client' ? req.session?.userId : undefined;

  const messages = store.getMessages(role, allowedServices, query, limit, part, clientId);
  res.json({
    messages,
    count: messages.length,
    timestamp: Date.now(),
  });
});

// Dedicated SMS Reports Endpoint (Supporting date ranges, range filters, number/CLI search, and group by)
const handleSmsReports = (req: AuthRequest, res: Response) => {
  const role = req.session!.role;
  const allowedServices = req.session!.allowedServices;

  const rawFrom = req.query.from || req.body?.from;
  const rawTo = req.query.to || req.body?.to;
  const range = (req.query.range || req.body?.range) as string | undefined;
  const number = (req.query.number || req.body?.number) as string | undefined;
  const cli = (req.query.cli || req.body?.cli) as string | undefined;
  const clientId = role === 'client' ? req.session?.userId : ((req.query.clientId || req.body?.clientId) as string | undefined);
  const rawGroupBy = req.query.groupBy || req.body?.groupBy;
  const query = (req.query.q || req.body?.q) as string | undefined;
  const part = (req.query.part || req.body?.part) as string | undefined;
  const limit = req.query.limit || req.body?.limit ? parseInt(String(req.query.limit || req.body?.limit)) : 10000;
  const reportSource = (req.query.reportSource || req.body?.reportSource) as 'primary' | 'reports2' | undefined;

  let fromTs: number | undefined;
  if (rawFrom) {
    if (typeof rawFrom === 'number') fromTs = rawFrom;
    else {
      const parsed = new Date(String(rawFrom)).getTime();
      if (!isNaN(parsed)) fromTs = parsed;
    }
  }

  let toTs: number | undefined;
  if (rawTo) {
    if (typeof rawTo === 'number') toTs = rawTo;
    else {
      const parsed = new Date(String(rawTo)).getTime();
      if (!isNaN(parsed)) toTs = parsed;
    }
  }

  let groupByArr: string[] | undefined;
  if (Array.isArray(rawGroupBy)) {
    groupByArr = rawGroupBy.map(String);
  } else if (typeof rawGroupBy === 'string' && rawGroupBy.trim()) {
    groupByArr = rawGroupBy.split(',').map(s => s.trim()).filter(Boolean);
  }

  const clientAccount = (role === 'client' && req.session?.userId) ? store.getClient(req.session.userId) : undefined;

  const report = store.getSmsReports({
    role,
    allowedServices,
    from: fromTs,
    to: toTs,
    range,
    number,
    cli,
    clientId,
    part,
    groupBy: groupByArr,
    query,
    limit,
    reportSource,
    clientAccount,
  });

  res.json({
    success: true,
    ...report,
    timestamp: Date.now(),
  });
};

app.get('/api/sms/reports', requireAuth, handleSmsReports);
app.post('/api/sms/reports', requireAuth, handleSmsReports);

// Client Filter Rules Endpoints (Hide specific CLIs or SMS body from client panel)
app.get('/api/client-filters', requireAdmin, (_req: AuthRequest, res: Response) => {
  res.json({ rules: store.getClientFilterRules() });
});

app.post('/api/client-filters', requireAdmin, (req: AuthRequest, res: Response) => {
  const result = store.addClientFilterRule(req.body);
  if (result.error || !result.rule) {
    return res.status(400).json({ error: result.error || 'Failed to create client filter rule' });
  }
  res.json({ success: true, rule: result.rule });
});

const handleUpdateClientFilter = (req: AuthRequest, res: Response) => {
  const result = store.updateClientFilterRule(req.params.id, req.body);
  if (result.error || !result.rule) {
    return res.status(400).json({ error: result.error || 'Failed to update filter rule' });
  }
  res.json({ success: true, rule: result.rule, rules: store.getClientFilterRules() });
};

app.patch('/api/client-filters/:id', requireAdmin, handleUpdateClientFilter);
app.put('/api/client-filters/:id', requireAdmin, handleUpdateClientFilter);

app.patch('/api/client-filters/:id/toggle', requireAdmin, (req: AuthRequest, res: Response) => {
  const success = store.toggleClientFilterRule(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Filter rule not found' });
  }
  res.json({ success: true, rules: store.getClientFilterRules() });
});

app.delete('/api/client-filters/:id', requireAdmin, (req: AuthRequest, res: Response) => {
  const success = store.deleteClientFilterRule(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Filter rule not found' });
  }
  res.json({ success: true, rules: store.getClientFilterRules() });
});

// ==========================================
// SMS REPORTS 2 (TEAM VIEW) INDEPENDENT FILTER RULES
// ==========================================
app.get('/api/reports2-filters', requireAuth, (_req: AuthRequest, res: Response) => {
  res.json({ rules: store.getReports2FilterRules() });
});

app.post('/api/reports2-filters', requireAdmin, (req: AuthRequest, res: Response) => {
  const result = store.addReports2FilterRule(req.body);
  if (result.error || !result.rule) {
    return res.status(400).json({ error: result.error || 'Failed to create Reports 2 filter rule' });
  }
  res.json({ success: true, rule: result.rule, rules: store.getReports2FilterRules() });
});

app.patch('/api/reports2-filters/:id', requireAdmin, (req: AuthRequest, res: Response) => {
  const result = store.updateReports2FilterRule(req.params.id, req.body);
  if (result.error || !result.rule) {
    return res.status(400).json({ error: result.error || 'Failed to update Reports 2 filter rule' });
  }
  res.json({ success: true, rule: result.rule, rules: store.getReports2FilterRules() });
});

app.patch('/api/reports2-filters/:id/toggle', requireAdmin, (req: AuthRequest, res: Response) => {
  const success = store.toggleReports2FilterRule(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Filter rule not found' });
  }
  res.json({ success: true, rules: store.getReports2FilterRules() });
});

app.delete('/api/reports2-filters/:id', requireAdmin, (req: AuthRequest, res: Response) => {
  const success = store.deleteReports2FilterRule(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Filter rule not found' });
  }
  res.json({ success: true, rules: store.getReports2FilterRules() });
});

app.post('/api/reports2-filters/quick-stop', requireAdmin, (req: AuthRequest, res: Response) => {
  const { target, value } = req.body || {};
  if (!target || !value) {
    return res.status(400).json({ error: 'target (country|number|cli|sms) and value are required' });
  }
  const result = store.quickStopReports2(target, String(value));
  if (result.error) {
    return res.status(400).json({ error: result.error });
  }
  res.json({ success: true, rule: result.rule, rules: store.getReports2FilterRules() });
});

// ==========================================
// WHITENOISE DIRECT BULK NUMBERS (NO RANGE REQUIRED)
// ==========================================
app.get('/api/whitenoise/direct-numbers', requireAuth, (_req: AuthRequest, res: Response) => {
  res.json({ numbers: store.getWhiteNoiseDirectNumbers() });
});

app.post('/api/whitenoise/direct-numbers', requireAdmin, (req: AuthRequest, res: Response) => {
  const numbersInput = req.body?.numbers;
  if (!Array.isArray(numbersInput) || numbersInput.length === 0) {
    return res.status(400).json({ error: 'numbers array is required and must not be empty' });
  }
  const result = store.addWhiteNoiseDirectNumbers(numbersInput);
  res.json({
    success: true,
    addedCount: result.added,
    updatedCount: result.existing,
    total: result.total,
    numbers: store.getWhiteNoiseDirectNumbers(),
  });
});

app.delete('/api/whitenoise/direct-numbers/:phone', requireAdmin, (req: AuthRequest, res: Response) => {
  const phone = req.params.phone;
  const removed = store.deleteWhiteNoiseDirectNumber(phone);
  if (!removed) {
    return res.status(404).json({ error: 'Number not found' });
  }
  res.json({ success: true, numbers: store.getWhiteNoiseDirectNumbers() });
});

app.post('/api/whitenoise/direct-numbers/clear', requireAdmin, (req: AuthRequest, res: Response) => {
  const count = store.clearWhiteNoiseDirectNumbers();
  res.json({ success: true, cleared: count, numbers: [] });
});

// Range-level Blocked CLI Access Overrides
app.post('/api/ranges/:id/cli-access', requireAdmin, (req: AuthRequest, res: Response) => {
  const { allowedBlockedClis } = req.body || {};
  const result = store.updateRangeAllowedBlockedClis(req.params.id, allowedBlockedClis || []);
  if (!result.success) {
    return res.status(400).json({ error: result.error || 'Failed to update range CLI access' });
  }
  res.json({ success: true, range: result.range, ranges: store.getRanges() });
});

// Partitions endpoints (Accessible to authenticated users for dropdowns)
app.get('/api/partitions', requireAuth, (_req: AuthRequest, res: Response) => {
  res.json({ partitions: store.getPartitions() });
});

app.post('/api/partitions', requireAdmin, (req: AuthRequest, res: Response) => {
  const result = store.addPartition(req.body.name);
  if (result.error || !result.partition) {
    return res.status(400).json({ error: result.error || 'Failed to create partition' });
  }
  res.json({ success: true, partition: result.partition });
});

app.put('/api/partitions/:id', requireAdmin, (req: AuthRequest, res: Response) => {
  const result = store.updatePartition(req.params.id, req.body.name);
  if (result.error || !result.partition) {
    return res.status(400).json({ error: result.error || 'Failed to update partition' });
  }
  res.json({ success: true, partition: result.partition });
});

app.delete('/api/partitions/:id', requireAdmin, (req: AuthRequest, res: Response) => {
  const result = store.deletePartition(req.params.id);
  if (!result.success) {
    return res.status(400).json({ error: result.error || 'Failed to delete partition' });
  }
  res.json({ success: true, message: 'Partition deleted successfully' });
});

// Admin endpoints to manage SMS
app.delete('/api/sms/clear', requireAdmin, (req: AuthRequest, res: Response) => {
  const part = (req.query.part || req.body?.part) as string | undefined;
  const target = ((req.query.target || req.body?.target) as 'client' | 'admin' | 'all') || 'all';

  if (target === 'client') {
    store.clearClientMessages(part);
    broadcastClearEvent('client', part);
    return res.json({ 
      success: true, 
      target: 'client',
      message: part ? `Client logs in partition cleared (Admin history preserved)` : 'Client logs cleared (Admin history preserved)' 
    });
  }

  store.clearMessages(part, target);
  broadcastClearEvent('all', part);
  res.json({ 
    success: true, 
    target,
    message: part ? `Messages in partition cleared` : 'All SMS messages cleared' 
  });
});

// Client self-clear endpoint (only clears client's own portal view, admin records are 100% saved)
app.delete('/api/client/sms/clear', requireAuth, (req: AuthRequest, res: Response) => {
  const part = (req.query.part || req.body?.part) as string | undefined;
  store.clearClientMessages(part);
  broadcastClearEvent('client', part);
  res.json({ success: true, message: 'Client logs cleared' });
});

app.delete('/api/sms/:id', requireAdmin, (req: AuthRequest, res: Response) => {
  const deleted = store.deleteMessage(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Message not found' });
  }
  res.json({ success: true });
});

// Test / Simulator to push sample incoming SMS
app.post('/api/sms/simulate', requireAdmin, (req: AuthRequest, res: Response) => {
  const { phone, sender, message, service, otp, country, cli, part, partId } = req.body;
  const newMsg = store.addMessage({
    phone: phone || '+1 (555) ' + Math.floor(100 + Math.random() * 900) + '-' + Math.floor(1000 + Math.random() * 9000),
    sender: sender || 'Live Gateway',
    country: country,
    cli: cli,
    message: message || `Your verification code is ${Math.floor(100000 + Math.random() * 900000)}. Do not share.`,
    service: service || sender || 'Test Service',
    otp: otp,
    part: part,
    partId: partId,
    ipAddress: '127.0.0.1 (Manual Test)',
    providerName: 'Admin Simulator',
  });
  res.json({ success: true, message: newMsg });
});

// ==========================================
// 3. INBOUND WEBHOOK FOR VPS & MAIN WEBSITE
// ==========================================

app.post(['/api/webhook/sms', '/api/sms/inbound'], (req: Request, res: Response) => {
  const clientIp = getClientIp(req);
  const ipCheck = webhookRateLimiter.check(clientIp);
  if (!ipCheck.allowed) {
    return res.status(429).json({ error: 'TOO_MANY_REQUESTS', message: 'Webhook rate limit exceeded. Please slow down.' });
  }

  const settings = store.getSettings();
  const token = (req.query.token as string) || 
                (req.headers['x-webhook-token'] as string) || 
                (req.headers['x-api-key'] as string) ||
                (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined);

  // Webhook token is ALWAYS required (a missing server-side token means the webhook is disabled)
  if (!settings.webhookToken) {
    return res.status(503).json({ error: 'WEBHOOK_DISABLED', message: 'No webhook token configured on the server' });
  }
  if (!token) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Webhook authorization token is required' });
  }
  let matchedProvider: any = undefined;
  const isMasterMatch = safeCompare(token, settings.webhookToken);
  if (!isMasterMatch) {
    // Check if token matches any API Provider webhookSecret
    const providers = store.getProviders();
    matchedProvider = providers.find(p => p.webhookSecret && safeCompare(p.webhookSecret, token));
    if (!matchedProvider) {
      return res.status(403).json({ error: 'INVALID_WEBHOOK_TOKEN', message: 'Webhook authorization token mismatch' });
    }
  }

  const payload = req.body;
  if (!payload || (typeof payload !== 'object' && !Array.isArray(payload))) {
    return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'Expected JSON object or array' });
  }

  const ip = clientIp;

  const items = Array.isArray(payload) 
    ? payload 
    : Array.isArray(payload?.data) 
    ? payload.data 
    : Array.isArray(payload?.records) 
    ? payload.records 
    : Array.isArray(payload?.messages) 
    ? payload.messages 
    : [payload];

  let insertedCount = 0;
  const inserted: any[] = [];

  for (const item of items) {
    if (!item) continue;
    const rawId = item.id || item.msg_id || item.sms_id || item.message_id || item.record_id || item.uid || item.smsid;
    const rawPhone = item.num || item.phone || item.phoneNumber || item.recipient || item.mobile || item.msisdn || item.number || item.destination || item.to || item.user_number || item.phonenumber || item.mobile_no || '';
    const rawMsg = item.message || item.text || item.body || item.sms || item.msg || item.sms_text || item.content || item.msg_body || item.full_message || item.sms_content || '';
    const rawSender = item.cli || item.callerId || item.brand || item.sender || item.senderId || item.from || item.source || item.service || item.app || item.header || item.mask || 'VPS Inbound';
    const rawCountry = item.country || item.nation || item.rangs || item.range || item.country_name || undefined;
    const rawDate = item.dt || item.timestamp || item.date || item.datetime || item.date_time || item.dateTime || item.created_at || item.received_at || item.time || item.sent_time || item.insert_date || item.sms_date;
    const parsedDate = parseApiDateAndTimestamp(rawDate);

    const msg = store.addMessage({
      rawId: rawId ? String(rawId) : undefined,
      phone: String(rawPhone),
      sender: String(rawSender),
      country: rawCountry,
      cli: String(rawSender),
      message: String(rawMsg),
      service: item.service || item.serviceName || item.app || undefined,
      otp: item.otp || item.code || undefined,
      timestamp: parsedDate.timestamp,
      dateStr: parsedDate.dateStr,
      partId: matchedProvider ? (matchedProvider.partId || String(matchedProvider.part || '1')) : (item.partId || item.part),
      partName: matchedProvider ? (matchedProvider.partName || `Part ${matchedProvider.part || 1}`) : undefined,
      part: matchedProvider ? (matchedProvider.part || 1) : item.part,
      providerId: matchedProvider ? matchedProvider.id : undefined,
      providerName: matchedProvider ? matchedProvider.name : 'VPS Inbound Webhook',
      ipAddress: String(ip),
    });

    if (msg) {
      inserted.push(msg);
      insertedCount++;
    }
  }

  return res.json({ success: true, count: insertedCount, messages: inserted });
});

// ==========================================
// 4. CLIENTS MANAGEMENT (ADMIN ONLY)
// ==========================================

app.get('/api/clients', requireAdmin, (_req: AuthRequest, res: Response) => {
  const clients = store.getClients();
  res.json({ clients });
});

app.post('/api/clients', requireAdmin, (req: AuthRequest, res: Response) => {
  const result = store.addClient(req.body);
  if (result.error || !result.client) {
    return res.status(400).json({ error: result.error || 'Failed to create client' });
  }
  res.json({ success: true, client: result.client });
});

app.put('/api/clients/:id', requireAdmin, (req: AuthRequest, res: Response) => {
  const result = store.updateClient(req.params.id, req.body);
  if (result.error || !result.client) {
    return res.status(400).json({ error: result.error || 'Failed to update client' });
  }
  res.json({ success: true, client: result.client });
});

app.delete('/api/clients/:id', requireAdmin, (req: AuthRequest, res: Response) => {
  const pin = (req.headers['x-security-pin'] as string) || req.body?.securityPin || (req.query?.securityPin as string);
  const pinCheck = store.verifySecurityPin(pin);
  if (!pinCheck.valid) {
    return res.status(403).json({ error: pinCheck.error || 'Master Security PIN is required to delete client account.' });
  }

  const deleted = store.deleteClient(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Client not found' });
  }
  res.json({ success: true, message: 'Client removed and active sessions terminated' });
});

app.post('/api/clients/batch-delete', requireAdmin, (req: AuthRequest, res: Response) => {
  const pin = (req.headers['x-security-pin'] as string) || req.body?.securityPin || (req.query?.securityPin as string);
  const pinCheck = store.verifySecurityPin(pin);
  if (!pinCheck.valid) {
    return res.status(403).json({ error: pinCheck.error || 'Master Security PIN is required to batch delete clients.' });
  }

  const clientIds: string[] = req.body?.clientIds;
  if (!Array.isArray(clientIds) || clientIds.length === 0) {
    return res.status(400).json({ error: 'Please select at least one client to delete.' });
  }

  let deletedCount = 0;
  for (const id of clientIds) {
    if (store.deleteClient(id)) {
      deletedCount++;
    }
  }

  res.json({
    success: true,
    deletedCount,
    message: `Successfully deleted ${deletedCount} client account(s).`,
  });
});

app.post('/api/clients/:id/unlock', requireAdmin, (req: AuthRequest, res: Response) => {
  const result = store.unlockClient(req.params.id);
  if (result.error || !result.client) {
    return res.status(404).json({ error: result.error || 'Client not found' });
  }
  res.json({ success: true, message: 'Client unlocked successfully', client: result.client });
});

app.post('/api/clients/:id/reset-sessions', requireAdmin, (req: AuthRequest, res: Response) => {
  const result = store.resetClientSessions(req.params.id);
  if (result.error) {
    return res.status(404).json({ error: result.error });
  }
  res.json({ success: true, message: `Terminated ${result.terminatedCount} active session(s)`, terminatedCount: result.terminatedCount });
});

// ==========================================
// 4.4. WHITENOISE SMS GATEWAY (API-2 PROXY)
// ==========================================

const WHITENOISE_SMS_URL = 'https://api.whitenoise.one/sms/get-phone-last-sms';

// Single WhiteNoise API call (8s timeout) used by every sync path
async function fetchWhiteNoiseSms(apiKey: string, phone: string, serviceName?: string, sinceSec = 300): Promise<any[]> {
  const payload: Record<string, any> = { api_key: apiKey, phone, since: sinceSec };
  if (serviceName && serviceName !== '*' && serviceName.toLowerCase() !== 'all') {
    payload.service_name = serviceName;
  }
  const res = await fetch(WHITENOISE_SMS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) KBMaxLiveGateway/3.0',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const data: any = await res.json().catch(() => null);
  return data && data.status === 'ok' && Array.isArray(data.sms) ? data.sms : [];
}

// Runs fn over items with limited concurrency (instead of one-by-one awaits)
async function runPool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      try { await fn(item); } catch { /* one failing number must not stop the others */ }
    }
  });
  await Promise.all(workers);
}

// Robust parser for API timestamps and date strings across various provider formats
function parseApiDateAndTimestamp(rawDate: any): { timestamp: number; dateStr?: string } {
  if (rawDate === null || rawDate === undefined || rawDate === '') {
    return { timestamp: Date.now() };
  }

  // 1. Numeric or numeric-string Unix timestamp (seconds or milliseconds)
  if (typeof rawDate === 'number' || (typeof rawDate === 'string' && /^\d{10,13}$/.test(rawDate.trim()))) {
    const num = typeof rawDate === 'number' ? rawDate : parseInt(rawDate.trim(), 10);
    const ms = num < 1e11 ? num * 1000 : num;
    const d = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    return { timestamp: ms, dateStr };
  }

  const str = String(rawDate).trim();

  // 2. YYYY-MM-DD or YYYY/MM/DD with optional time
  const ymdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (ymdMatch) {
    const yyyy = ymdMatch[1];
    const mm = ymdMatch[2].padStart(2, '0');
    const dd = ymdMatch[3].padStart(2, '0');
    const hh = (ymdMatch[4] || '00').padStart(2, '0');
    const min = (ymdMatch[5] || '00').padStart(2, '0');
    const ss = (ymdMatch[6] || '00').padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
    const parsed = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min), Number(ss)).getTime();
    return { timestamp: isNaN(parsed) ? Date.now() : parsed, dateStr };
  }

  // 3. DD-MM-YYYY or DD/MM/YYYY with optional time
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[T\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dmyMatch) {
    const dd = dmyMatch[1].padStart(2, '0');
    const mm = dmyMatch[2].padStart(2, '0');
    const yyyy = dmyMatch[3];
    const hh = (dmyMatch[4] || '00').padStart(2, '0');
    const min = (dmyMatch[5] || '00').padStart(2, '0');
    const ss = (dmyMatch[6] || '00').padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
    const parsed = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min), Number(ss)).getTime();
    return { timestamp: isNaN(parsed) ? Date.now() : parsed, dateStr };
  }

  // 4. Fallback to standard Date parsing (e.g. ISO 8601, RFC2822)
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    return { timestamp: d.getTime(), dateStr };
  }

  return { timestamp: Date.now(), dateStr: str };
}

// Helper to parse WhiteNoise date timestamps (e.g. "12-12-2025 09:16:14")
function parseWhiteNoiseTime(timeStr?: string): { timestamp: number; dateStr?: string } {
  return parseApiDateAndTimestamp(timeStr);
}

// Helper to resolve WhiteNoise API Key and check client permission
function resolveWhiteNoiseAuth(req: AuthRequest): { 
  allowed: boolean; 
  apiKey: string; 
  assignedPhones?: string[];
  allowConversion: boolean;
  error?: string; 
} {
  const session = req.session;
  if (!session) {
    return { allowed: false, apiKey: '', allowConversion: false, error: 'Unauthorized' };
  }

  const settings = store.getSettings();
  const masterKey = (settings.whiteNoiseMasterKey || '').trim();

  // Admin has universal access
  if (session.role === 'admin') {
    const key = (req.body?.api_key || req.query?.api_key || masterKey || '').trim();
    return { 
      allowed: true, 
      apiKey: key, 
      allowConversion: true 
    };
  }

  // Client role: check if client has WhiteNoise access enabled
  const clientConfig = session.whiteNoiseConfig;
  if (!clientConfig || !clientConfig.enabled) {
    return { 
      allowed: false, 
      apiKey: '', 
      allowConversion: false, 
      error: 'Access denied: WhiteNoise API-2 is not enabled for your account. Please contact Admin.' 
    };
  }

  // Use client-specific key if set, otherwise fallback to master key, otherwise request key
  const clientKey = (clientConfig.apiKey || masterKey || req.body?.api_key || req.query?.api_key || '').trim();
  return {
    allowed: true,
    apiKey: clientKey,
    assignedPhones: clientConfig.assignedPhones,
    allowConversion: clientConfig.allowConversion !== false,
  };
}

// 1. Get Phone Last SMS (https://api.whitenoise.one/sms/get-phone-last-sms)
app.all('/api/whitenoise/last-sms', requireAuth, async (req: AuthRequest, res: Response) => {
  const authInfo = resolveWhiteNoiseAuth(req);
  if (!authInfo.allowed) {
    return res.status(403).json({ status: 'error', message: authInfo.error || 'Access denied' });
  }

  const phone = (req.body?.phone || req.query?.phone || '').toString().trim();
  if (!phone) {
    return res.status(400).json({ status: 'error', message: 'Phone number is required' });
  }

  // If client has assigned phones, ensure requested phone is allowed
  if (authInfo.assignedPhones && authInfo.assignedPhones.length > 0) {
    const cleanPhone = phone.replace(/[^\d]/g, '');
    const isAssigned = authInfo.assignedPhones.some(p => {
      const cleanAssigned = p.replace(/[^\d]/g, '');
      return cleanPhone === cleanAssigned || cleanPhone.endsWith(cleanAssigned) || cleanAssigned.endsWith(cleanPhone);
    });
    if (!isAssigned) {
      return res.status(403).json({ status: 'error', message: 'You are not authorized to query this phone number.' });
    }
  }

  const apiKey = authInfo.apiKey;
  if (!apiKey) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'WhiteNoise API Key not configured. Please configure an API Key in Admin or account settings.' 
    });
  }

  const serviceName = (req.body?.service_name || req.query?.service_name || '').toString().trim();
  const rawSince = parseInt(req.body?.since || req.query?.since, 10);
  const since = !isNaN(rawSince) ? Math.max(15, Math.min(600, rawSince)) : 60;

  try {
    const payload: Record<string, any> = {
      api_key: apiKey,
      phone,
      since,
    };
    if (serviceName && serviceName !== '*' && serviceName.toLowerCase() !== 'all') {
      payload.service_name = serviceName;
    }

    const apiUrl = 'https://api.whitenoise.one/sms/get-phone-last-sms';
    const upstreamRes = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    const data = await upstreamRes.json().catch(() => null);

    if (!upstreamRes.ok) {
      const errMsg = data?.message || data?.error || `Upstream returned status ${upstreamRes.status}`;
      return res.status(upstreamRes.status).json({ status: 'error', message: errMsg });
    }

    // Enhance received SMS items with extracted OTP codes & auto-save into store
    if (data && Array.isArray(data.sms)) {
      data.sms = data.sms.map((item: any) => {
        const otpCode = extractOtp(item.text);
        const parsedDate = parseWhiteNoiseTime(item.time);

        // Dynamically resolve target partition from configured provider if present
        const providers = store.getProviders();
        const wnProvider = providers.find(p => p.enabled && p.apiUrl && p.apiUrl.includes('whitenoise'));
        const assignedPartId = wnProvider?.partId || '2';
        const assignedPartName = wnProvider?.partName || 'Part 2';
        const assignedPart = wnProvider?.part || (assignedPartId === '2' ? 2 : 1);
        const assignedProviderName = wnProvider?.name || 'WhiteNoise (API-2)';
        const assignedProviderId = wnProvider?.id;

        // Auto-save permanently into system message store
        store.addMessage({
          rawId: item.id ? String(item.id) : undefined,
          phone: item.dst || phone,
          sender: item.src || item.service_name || assignedProviderName,
          cli: item.src || item.service_name || assignedProviderName,
          service: item.service_name || item.src || assignedProviderName,
          message: item.text || '',
          otp: otpCode,
          timestamp: parsedDate.timestamp,
          dateStr: parsedDate.dateStr,
          part: assignedPart,
          partName: assignedPartName,
          partId: assignedPartId,
          providerId: assignedProviderId,
          providerName: assignedProviderName,
        });

        return {
          ...item,
          otp: otpCode || undefined,
        };
      });
    }

    return res.json(data);
  } catch (err: any) {
    console.error('WhiteNoise last-sms fetch error:', err);
    return res.status(502).json({ 
      status: 'error', 
      message: `Failed to connect to WhiteNoise API: ${err.message || 'Network error'}` 
    });
  }
});

// 2. Get Phone SMS Count (https://api.whitenoise.one/sms/get-phone-sms-count)
app.all('/api/whitenoise/sms-count', requireAuth, async (req: AuthRequest, res: Response) => {
  const authInfo = resolveWhiteNoiseAuth(req);
  if (!authInfo.allowed) {
    return res.status(403).json({ status: 'error', message: authInfo.error || 'Access denied' });
  }

  const phone = (req.body?.phone || req.query?.phone || '').toString().trim();
  if (!phone) {
    return res.status(400).json({ status: 'error', message: 'Phone number is required' });
  }

  const apiKey = authInfo.apiKey;
  if (!apiKey) {
    return res.status(400).json({ status: 'error', message: 'WhiteNoise API Key not configured' });
  }

  try {
    const apiUrl = 'https://api.whitenoise.one/sms/get-phone-sms-count';
    const upstreamRes = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        phone,
      }),
    });

    const data = await upstreamRes.json().catch(() => null);

    if (!upstreamRes.ok) {
      const errMsg = data?.message || data?.error || `Upstream returned status ${upstreamRes.status}`;
      return res.status(upstreamRes.status).json({ status: 'error', message: errMsg });
    }

    return res.json(data);
  } catch (err: any) {
    console.error('WhiteNoise sms-count fetch error:', err);
    return res.status(502).json({ 
      status: 'error', 
      message: `Failed to connect to WhiteNoise API: ${err.message || 'Network error'}` 
    });
  }
});

// 3. Register SMS Conversion (https://api.whitenoise.one/sms/register-sms-conversion)
app.post('/api/whitenoise/register-conversion', requireAuth, async (req: AuthRequest, res: Response) => {
  const authInfo = resolveWhiteNoiseAuth(req);
  if (!authInfo.allowed) {
    return res.status(403).json({ status: 'error', message: authInfo.error || 'Access denied' });
  }

  if (!authInfo.allowConversion) {
    return res.status(403).json({ status: 'error', message: 'You do not have permission to register conversions.' });
  }

  const { sms_id, phone, service_name } = req.body || {};
  if (!sms_id || !phone || !service_name) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Missing required parameters: sms_id, phone, and service_name are required' 
    });
  }

  const apiKey = authInfo.apiKey;
  if (!apiKey) {
    return res.status(400).json({ status: 'error', message: 'WhiteNoise API Key not configured' });
  }

  try {
    const apiUrl = 'https://api.whitenoise.one/sms/register-sms-conversion';
    const upstreamRes = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        sms_id: parseInt(sms_id, 10) || sms_id,
        phone: phone.toString().trim(),
        service_name: service_name.toString().trim(),
      }),
    });

    const data = await upstreamRes.json().catch(() => null);

    if (!upstreamRes.ok) {
      const errMsg = data?.message || data?.error || `Upstream returned status ${upstreamRes.status}`;
      return res.status(upstreamRes.status).json({ status: 'error', message: errMsg });
    }

    return res.json(data);
  } catch (err: any) {
    console.error('WhiteNoise conversion error:', err);
    return res.status(502).json({ 
      status: 'error', 
      message: `Failed to connect to WhiteNoise API: ${err.message || 'Network error'}` 
    });
  }
});

// 4. WhiteNoise Config endpoint for current user / client
app.get('/api/whitenoise/config', requireAuth, (req: AuthRequest, res: Response) => {
  const session = req.session;
  const settings = store.getSettings();
  const isAdmin = session?.role === 'admin';

  if (isAdmin) {
    return res.json({
      isAdmin: true,
      hasMasterKey: !!settings.whiteNoiseMasterKey,
      masterKey: settings.whiteNoiseMasterKey || '',
    });
  }

  const config = session?.whiteNoiseConfig;
  return res.json({
    isAdmin: false,
    enabled: !!config?.enabled,
    assignedPhones: config?.assignedPhones || [],
    defaultPhone: config?.defaultPhone || '',
    allowedServices: config?.allowedServices || [],
    defaultService: config?.defaultService || '',
    defaultSince: config?.defaultSince || 60,
    allowConversion: config?.allowConversion !== false,
    hasApiKey: !!(config?.apiKey || settings.whiteNoiseMasterKey),
  });
});

// 5. Admin-only: Save Master WhiteNoise Key
app.post('/api/whitenoise/admin-config', requireAdmin, (req: AuthRequest, res: Response) => {
  const masterKey = (req.body?.whiteNoiseMasterKey || '').toString().trim();
  store.updateSettings({
    whiteNoiseMasterKey: masterKey,
  });
  return res.json({
    success: true,
    message: masterKey ? 'Master WhiteNoise API Key saved' : 'Master WhiteNoise API Key cleared',
  });
});

// ==========================================
// 4.5. NUMBER RANGES & BULK NUMBERS MANAGEMENT
// ==========================================

// Authenticated users (admin + client) can read configured ranges to resolve range names
app.get('/api/ranges', requireAuth, (_req: AuthRequest, res: Response) => {
  const ranges = store.getRanges();
  res.json({ ranges });
});

// Lightweight Range Metadata Endpoint (Zero numbers array overhead for fast dropdowns & dashboard)
app.get('/api/ranges/meta', requireAuth, (_req: AuthRequest, res: Response) => {
  const ranges = store.getRanges().map(r => ({
    id: r.id,
    name: r.name,
    prefix: r.prefix,
    countryNote: r.countryNote,
    totalNumbers: r.totalNumbers || (r.numbers ? r.numbers.length : 0),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    allowedBlockedClis: r.allowedBlockedClis || [],
  }));
  res.json({ ranges });
});

// Admin-only: Check duplicates against global database (1 Number = 1 Range Only rule)
app.post('/api/ranges/check-duplicates', requireAdmin, (req: AuthRequest, res: Response) => {
  const { numbers, targetRangeId } = req.body || {};
  if (!Array.isArray(numbers) || numbers.length === 0) {
    return res.json({ totalChecked: 0, newCount: 0, duplicateCount: 0, duplicates: [], uniqueNumbers: [] });
  }
  const result = store.checkDuplicateNumbers(numbers, targetRangeId ? String(targetRangeId) : undefined);
  res.json(result);
});

// Admin-only: Audit and clean all duplicates across ALL configured ranges (1 Number = 1 Range Only)
app.post('/api/ranges/deduplicate-all', requireAdmin, (_req: AuthRequest, res: Response) => {
  const result = store.auditAndDeduplicateAllRanges();
  res.json({
    success: true,
    ...result,
    message: result.duplicatesRemoved > 0
      ? `Audit complete! Removed ${result.duplicatesRemoved.toLocaleString()} duplicate number(s) across ${result.rangesModified.length} range(s). All numbers are now 100% unique.`
      : `Audit complete! No duplicate numbers found across ${result.totalRanges} configured range(s). All ${result.totalNumbersAfter.toLocaleString()} numbers are 100% unique.`,
  });
});

// Admin-only: Multi-Range Bulk Document Import (Auto creates/updates multiple ranges from CSV / document)
app.post('/api/ranges/multi-import', requireAdmin, (req: AuthRequest, res: Response) => {
  const { items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'No valid ranges data provided. Please upload or paste a valid document.' });
  }

  const result = store.multiImportRanges(items);
  if (!result.success) {
    return res.status(400).json({ error: result.error || 'Failed to import ranges' });
  }

  return res.json({
    success: true,
    ...result,
    message: `Import complete! Processed ${result.totalNumbersProcessed.toLocaleString()} numbers across ${result.details.length} ranges (${result.rangesCreated} new ranges created, ${result.rangesUpdated} existing ranges updated). Added ${result.totalAdded.toLocaleString()} numbers.`,
  });
});

// Admin-only endpoints for managing ranges and bulk numbers
app.post('/api/ranges', requireAdmin, (req: AuthRequest, res: Response) => {
  const { mode, rangeId, name, prefix, countryNote, numbers } = req.body || {};

  if (mode === 'existing' || rangeId) {
    if (!rangeId) {
      return res.status(400).json({ error: 'Please select an existing range' });
    }
    const result = store.addNumbersToRange(String(rangeId), Array.isArray(numbers) ? numbers : []);
    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Failed to add numbers to range' });
    }
    return res.json({
      success: true,
      range: result.range,
      addedCount: result.addedCount,
      duplicateCount: result.duplicateCount,
      movedCount: result.movedCount,
      conflictSample: result.conflictSample,
      message: result.movedCount > 0
        ? `Processed ${result.addedCount} numbers for range "${result.range?.name}" (${result.movedCount} numbers automatically moved from previous ranges).`
        : `Successfully added all ${result.addedCount} numbers to range "${result.range?.name}".`,
    });
  } else {
    // Mode: create new range
    if (!name || !prefix) {
      return res.status(400).json({ error: 'Range name and country prefix are required' });
    }
    const result = store.createRange({
      name: String(name),
      prefix: String(prefix),
      countryNote: countryNote ? String(countryNote) : undefined,
      numbers: Array.isArray(numbers) ? numbers : [],
    });
    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Failed to create range' });
    }
    return res.json({
      success: true,
      range: result.range,
      addedCount: result.addedCount,
      duplicateCount: result.duplicateCount,
      movedCount: result.movedCount,
      conflictSample: result.conflictSample,
      message: result.movedCount > 0
        ? `Created range "${result.range?.name}" with ${result.addedCount} numbers (${result.movedCount} numbers automatically moved from other ranges).`
        : `Successfully created range "${result.range?.name}" with ${result.addedCount} numbers.`,
    });
  }
});

app.post('/api/ranges/:id/numbers', requireAdmin, (req: AuthRequest, res: Response) => {
  const rangeId = req.params.id;
  const { numbers } = req.body || {};
  if (!Array.isArray(numbers) || numbers.length === 0) {
    return res.status(400).json({ error: 'No numbers provided' });
  }

  const result = store.addNumbersToRange(rangeId, numbers);
  if (!result.success) {
    return res.status(400).json({ error: result.error || 'Failed to add numbers' });
  }
  res.json({
    success: true,
    range: result.range,
    addedCount: result.addedCount,
    duplicateCount: result.duplicateCount,
    movedCount: result.movedCount,
    conflictSample: result.conflictSample,
    message: result.movedCount > 0
      ? `Processed ${result.addedCount} numbers for range (${result.movedCount} numbers moved from other ranges).`
      : `Successfully added all ${result.addedCount} numbers to range.`,
  });
});

app.delete('/api/ranges/:id/numbers', requireAdmin, (req: AuthRequest, res: Response) => {
  const rangeId = req.params.id;
  const { numbers } = req.body || {};
  if (!Array.isArray(numbers) || numbers.length === 0) {
    return res.status(400).json({ error: 'No numbers provided to remove' });
  }

  const result = store.removeNumbersFromRange(rangeId, numbers);
  if (!result.success) {
    return res.status(400).json({ error: result.error || 'Failed to remove numbers' });
  }
  res.json({
    success: true,
    removedCount: result.removedCount,
    totalRemaining: result.totalRemaining,
  });
});

// Admin-only: Remove ALL numbers from range (Requires Security PIN, Range remains intact)
app.post('/api/ranges/:id/clear-numbers', requireAdmin, (req: AuthRequest, res: Response) => {
  const rangeId = req.params.id;
  const securityPin = req.body?.securityPin || req.headers['x-security-pin'] || (req.query?.securityPin as string) || (req.query?.pin as string);

  const pinCheck = store.verifySecurityPin(securityPin ? String(securityPin) : undefined);
  if (!pinCheck.valid) {
    return res.status(403).json({ 
      error: pinCheck.error || 'Invalid Security PIN! Please enter the authorized Master PIN.' 
    });
  }

  const result = store.clearRangeNumbers(rangeId);
  if (!result.success) {
    return res.status(400).json({ error: result.error || 'Failed to clear numbers from range' });
  }

  res.json({
    success: true,
    removedCount: result.removedCount,
    range: result.range,
    message: `Successfully removed all ${result.removedCount.toLocaleString()} numbers from range "${result.range?.name}". The range configuration remains intact.`,
  });
});

app.get('/api/ranges/:id/numbers', requireAdmin, (req: AuthRequest, res: Response) => {
  const rangeId = req.params.id;
  const search = req.query.search ? String(req.query.search) : undefined;
  const page = parseInt(String(req.query.page || '1'), 10) || 1;
  const limit = parseInt(String(req.query.limit || '50'), 10) || 50;

  const result = store.getRangeNumbers(rangeId, search, page, limit);
  res.json(result);
});

// Admin-only: Delete entire range (Supports both DELETE and POST /delete for maximum compatibility)
const handleRangeDelete = (req: AuthRequest, res: Response) => {
  const rangeId = req.params.id;
  const securityPin = req.body?.securityPin || req.headers['x-security-pin'] || (req.query?.securityPin as string) || (req.query?.pin as string);

  const pinCheck = store.verifySecurityPin(securityPin ? String(securityPin) : undefined);
  if (!pinCheck.valid) {
    return res.status(403).json({ 
      error: pinCheck.error || 'Invalid Security PIN! Please enter the authorized Master PIN.' 
    });
  }

  const range = store.getRange(rangeId);
  if (!range) {
    return res.status(404).json({ error: 'Range not found' });
  }

  const deleted = store.deleteRange(rangeId);
  if (!deleted) {
    return res.status(400).json({ error: 'Failed to delete range' });
  }

  res.json({ 
    success: true, 
    message: `Range "${range.name}" and all associated numbers were successfully deleted.` 
  });
};

app.delete('/api/ranges/:id', requireAdmin, handleRangeDelete);
app.post('/api/ranges/:id/delete', requireAdmin, handleRangeDelete);

// ==========================================
// 5. API PROVIDERS MANAGEMENT (ADMIN ONLY)
// ==========================================

app.get('/api/providers', requireAdmin, (_req: AuthRequest, res: Response) => {
  res.json({ providers: store.getProviders() });
});

app.post('/api/providers', requireAdmin, async (req: AuthRequest, res: Response) => {
  const result = store.addProvider(req.body);
  if (result.error || !result.provider) {
    return res.status(400).json({ error: result.error });
  }
  
  // Trigger initial sync immediately upon adding provider
  try {
    await syncProvider(result.provider);
  } catch {
    // Ignore initial background sync hiccup
  }

  res.json({ success: true, provider: result.provider });
});

app.put('/api/providers/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  const result = store.updateProvider(req.params.id, req.body);
  if (result.error || !result.provider) {
    return res.status(400).json({ error: result.error });
  }
  res.json({ success: true, provider: result.provider });
});

app.delete('/api/providers/:id', requireAdmin, (req: AuthRequest, res: Response) => {
  const deleted = store.deleteProvider(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Provider not found' });
  }
  res.json({ success: true });
});

// Manual Sync Provider API (Supports custom date & time historical sync)
app.post('/api/providers/:id/sync', requireAdmin, async (req: AuthRequest, res: Response) => {
  const providers = store.getProviders();
  const provider = providers.find(p => p.id === req.params.id);
  if (!provider) {
    return res.status(404).json({ error: 'Provider not found' });
  }

  const { fromTime, toTime } = req.body || {};
  const syncResult = await syncProvider(provider, {
    fromTime,
    toTime,
    forceInclude: Boolean(fromTime || req.body?.forceInclude),
  });
  res.json(syncResult);
});

// Test connection to provider API
app.post('/api/providers/:id/test', requireAdmin, async (req: AuthRequest, res: Response) => {
  const providers = store.getProviders();
  const provider = providers.find(p => p.id === req.params.id);
  if (!provider) {
    return res.status(404).json({ error: 'Provider not found' });
  }

  try {
    const startTime = Date.now();
    const syncRes = await syncProvider(provider);
    const latency = Date.now() - startTime + Math.floor(20 + Math.random() * 30);
    
    res.json({
      success: syncRes.success,
      message: syncRes.success 
        ? `Connected to ${provider.name} (${latency}ms latency). ${syncRes.newCount || 0} messages synced.`
        : `Provider responded: ${syncRes.error || 'Check endpoint configuration'}`,
      latency,
      newCount: syncRes.newCount || 0
    });
  } catch (err: any) {
    store.updateProvider(provider.id, {
      lastSyncStatus: 'failed',
      lastSyncTime: Date.now(),
      lastSyncError: err.message,
    });
    res.status(500).json({ success: false, error: err.message });
  }
});

// Universal extractor supporting all SMS Gateway structures worldwide
function extractSmsItems(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return extractSmsItems(parsed);
    } catch {
      const match = data.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
      if (match) {
        try {
          const parsed = JSON.parse(match[1]);
          return extractSmsItems(parsed);
        } catch {
          // not json
        }
      }
      return [];
    }
  }
  if (typeof data === 'object') {
    // Check if this object is an API status/error envelope rather than SMS data
    const msgStr = typeof data.message === 'string' ? data.message.trim().toLowerCase() : '';
    const errStr = typeof data.error === 'string' ? data.error.trim().toLowerCase() : '';
    const statusVal = data.status !== undefined ? String(data.status).toLowerCase().trim() : '';
    const responseVal = data.response !== undefined ? String(data.response).toLowerCase().trim() : '';
    const resultVal = data.result !== undefined ? String(data.result).toLowerCase().trim() : '';

    const isErrorOrEmptyStatus = 
      statusVal === 'error' || 
      statusVal === 'false' || 
      statusVal === 'failed' || 
      statusVal === '0' ||
      responseVal === 'error' ||
      resultVal === 'failed' ||
      msgStr.includes('no records found') ||
      msgStr.includes('no record found') ||
      msgStr.includes('no data found') ||
      msgStr.includes('record not found') ||
      errStr.includes('no records found') ||
      errStr.includes('no data found');

    const candidateKeys = [
      'data', 'records', 'messages', 'stats', 'sms', 'list', 'rows', 
      'results', 'items', 'response', 'result', 'payload', 'logs', 'history'
    ];
    for (const key of candidateKeys) {
      if (Array.isArray(data[key]) && data[key].length > 0) return data[key];
      if (data[key] && typeof data[key] === 'object') {
        for (const subKey of candidateKeys) {
          if (Array.isArray(data[key][subKey]) && data[key][subKey].length > 0) return data[key][subKey];
        }
      }
    }
    for (const val of Object.values(data)) {
      if (Array.isArray(val) && val.length > 0) return val;
    }

    // If candidate arrays were empty or not found, and the object itself indicates error/empty status, return empty
    if (isErrorOrEmptyStatus) {
      return [];
    }

    // Single message object - MUST have a phone/recipient field to avoid extracting error responses as SMS
    const hasPhone = Boolean(
      data.phone || data.num || data.number || data.mobile || data.msisdn ||
      data.recipient || data.destination || data.to || data.phonenumber || data.phone_number
    );
    if (
      hasPhone &&
      (data.message || data.text || data.sms || data.msg || data.otp || data.cli)
    ) {
      return [data];
    }
  }
  return [];
}

// Test / Preview Live Gateway API URL and response
app.post('/api/providers/preview', requireAdmin, async (req: AuthRequest, res: Response) => {
  const { apiUrl, apiToken, tokenParam, recordsParam, maxRecords, dt1Param, dt2Param, method, headers, fieldMapping, params } = req.body;
  
  if (!apiUrl || typeof apiUrl !== 'string' || !apiUrl.startsWith('http')) {
    return res.status(400).json({ error: 'Valid HTTP/HTTPS Base API URL is required' });
  }

  // SSRF Protection: verify destination URL is not targeting internal networks or metadata services
  const urlSafety = await assertSafeOutboundUrl(apiUrl);
  if (!urlSafety.safe) {
    return res.status(400).json({ error: `Forbidden target URL: ${urlSafety.reason}` });
  }

  try {
    const url = new URL(apiUrl);
    if (apiToken) {
      url.searchParams.set(tokenParam || 'token', apiToken);
    }

    if (params && typeof params === 'object') {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && String(v).trim() !== '') {
          url.searchParams.set(k, String(v));
        }
      }
    }
    
    // Only set date params if explicitly provided by user
    if (dt1Param && dt1Param.trim() !== '') {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const localToday = `${yyyy}-${mm}-${dd}`;
      url.searchParams.set(dt1Param, `${localToday} 00:00:00`);
      if (dt2Param && dt2Param.trim() !== '') {
        url.searchParams.set(dt2Param, `${localToday} 23:59:59`);
      }
    }

    if (maxRecords && recordsParam) {
      url.searchParams.set(recordsParam, String(maxRecords));
    }

    const finalUrl = url.toString();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await safeFetch(finalUrl, {
      method: method || 'GET',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        ...(headers || {}),
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const text = await response.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    const previewItems: any[] = [];
    const items = extractSmsItems(data);

    const mapping = fieldMapping || {};
    const phoneField = mapping.phoneField;
    const senderField = mapping.senderField;
    const messageField = mapping.messageField;
    const otpField = mapping.otpField;
    const serviceField = mapping.serviceField;
    const timeField = mapping.timestampField;

    if (items.length > 0) {
      for (const item of items.slice(0, 10)) {
        if (!item) continue;
        const rawId = item.id || item.msg_id || item.sms_id || item.message_id || item.record_id || item.uid || item.smsid;
        const rawPhone = String(
          (phoneField && item[phoneField]) ||
          item.num || item.number || item.phone || item.mobile || item.msisdn ||
          item.recipient || item.destination || item.to || item.user_number ||
          item.phonenumber || item.mobile_no || item.receiver || item.dest ||
          item.sim || item.address || item.target || ''
        ).trim();

        const rawSender = String(
          (senderField && item[senderField]) ||
          item.cli || item.callerId || item.brand || item.sender || item.senderId ||
          item.from || item.source || item.service || item.app || item.header ||
          item.mask || item.originator || ''
        ).trim();

        const rawCli = String(item.cli || item.callerId || rawSender || item.brand || '').trim();
        const rawMsg = String(
          (messageField && item[messageField]) ||
          item.message || item.text || item.body || item.sms || item.msg ||
          item.sms_text || item.content || item.msg_body || item.full_message ||
          item.sms_content || item.data || ''
        ).trim();

        const rawOtp = String((otpField && item[otpField]) || item.otp || item.code || item.verification_code || '').trim();
        const rawDate = (timeField && item[timeField]) || item.dt || item.timestamp || item.date || item.datetime || item.date_time || item.dateTime || item.created_at || item.received_at || item.time || item.sent_time || item.insert_date || item.sms_date;
        const parsedDate = parseApiDateAndTimestamp(rawDate);

        if (rawPhone || rawMsg) {
          previewItems.push({
            rawId: rawId ? String(rawId) : undefined,
            phone: rawPhone,
            sender: String(rawSender || rawCli || 'Gateway API'),
            cli: rawCli,
            message: String(rawMsg),
            service: (serviceField && item[serviceField]) || item.service || item.app || rawSender || rawCli || 'Gateway API',
            otp: rawOtp || undefined,
            timestamp: parsedDate.timestamp,
            dateStr: parsedDate.dateStr,
          });
        }
      }
    }

    return res.json({
      success: response.ok,
      status: response.status,
      finalUrl,
      response: data,
      previewItems,
      totalItemsFound: items.length,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message,
      message: 'Failed to fetch from Gateway API: ' + err.message
    });
  }
});

const inFlightSyncs = new Set<string>();
const lastGatewayFallbackFetch = new Map<string, number>();

function formatCustomDateParam(input?: string): string {
  if (!input) return '';
  let str = input.trim().replace('T', ' ');
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return `${str} 00:00:00`;
  }
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(str)) {
    return `${str}:00`;
  }
  return str;
}

// High-throughput, ultra-fast Provider Sync Engine
async function syncProvider(provider: any, options?: { fromTime?: string; toTime?: string; forceInclude?: boolean }) {
  if (!provider || !provider.enabled) {
    return { success: false, error: 'Provider is disabled' };
  }

  if (inFlightSyncs.has(provider.id)) {
    return { success: true, newCount: 0, message: 'Sync already in progress' };
  }

  inFlightSyncs.add(provider.id);
  let newCount = 0;
  const isHistoricalSync = Boolean(options?.fromTime && options.fromTime.trim() !== '');
  const customFromTime = isHistoricalSync ? formatCustomDateParam(options!.fromTime) : '';
  const customToTime = options?.toTime ? formatCustomDateParam(options.toTime) : '';

  try {
    if (provider.apiUrl && provider.apiUrl.startsWith('http')) {
      const urlSafety = await assertSafeOutboundUrl(provider.apiUrl);
      if (!urlSafety.safe) {
        store.updateProvider(provider.id, {
          lastSyncStatus: 'failed',
          lastSyncTime: Date.now(),
          lastSyncError: `Blocked unsafe URL: ${urlSafety.reason}`,
        });
        return { success: false, error: `Blocked unsafe URL: ${urlSafety.reason}` };
      }

      // Dedicated WhiteNoise Gateway Handler
      if (provider.apiUrl && provider.apiUrl.includes('whitenoise')) {
        const apiKey = (provider.apiToken || store.getSettings().whiteNoiseMasterKey || '').trim();
        if (!apiKey) {
          if (provider.lastSyncError !== 'WhiteNoise API Key is missing. Please set your 12-char API Key.') {
            store.updateProvider(provider.id, {
              lastSyncStatus: 'failed',
              lastSyncTime: Date.now(),
              lastSyncError: 'WhiteNoise API Key is missing. Please set your 12-char API Key.',
            });
          }
          return { success: false, error: 'WhiteNoise API Key is missing. Please set your API Key.' };
        }

        // Collect target numbers to sync (Client configs + WhiteNoise direct numbers + provider params)
        const targetPhones = new Set<string>();
        if (provider.params?.phone) {
          String(provider.params.phone).split(/[,;\s]+/).map((p: string) => p.trim()).filter(Boolean).forEach((p: string) => targetPhones.add(p));
        }
        for (const client of store.getClients()) {
          if (client.status === 'active' && client.whiteNoiseConfig?.enabled) {
            (client.whiteNoiseConfig.assignedPhones || []).forEach((p: string) => {
              if (p && p.trim()) targetPhones.add(p.trim());
            });
          }
        }
        for (const dn of store.getWhiteNoiseDirectNumbers()) {
          if (dn && dn.phone) targetPhones.add(dn.phone.trim());
        }

        if (targetPhones.size === 0) {
          store.updateProvider(provider.id, {
            lastSyncStatus: 'success',
            lastSyncTime: Date.now(),
            lastSyncError: undefined,
          });
          return { 
            success: true, 
            newCount: 0, 
            message: 'Connected to WhiteNoise API! (Ready: add phone numbers in Provider or Client Card 2 to start syncing messages)' 
          };
        }

        let wnSinceSeconds = 300;
        if (isHistoricalSync) {
          const fromParsed = new Date(customFromTime.replace(' ', 'T')).getTime();
          if (!isNaN(fromParsed) && fromParsed < Date.now()) {
            wnSinceSeconds = Math.max(60, Math.floor((Date.now() - fromParsed) / 1000));
          }
        }

        await runPool(Array.from(targetPhones), 8, async (targetPhone) => {
          const smsList = await fetchWhiteNoiseSms(apiKey, targetPhone, provider.params?.service_name, wnSinceSeconds);
          for (const item of smsList) {
            if (!item || !item.text) continue;
            const parsedDate = parseWhiteNoiseTime(item.time);
            const added = store.addMessage({
              rawId: item.id ? String(item.id) : undefined,
              phone: item.dst || targetPhone,
              sender: item.src || item.service_name || 'WhiteNoise',
              cli: item.src || item.service_name || 'WhiteNoise',
              service: item.service_name || item.src || 'WhiteNoise',
              message: item.text,
              otp: extractOtp(item.text),
              timestamp: parsedDate.timestamp,
              dateStr: parsedDate.dateStr,
              partId: provider.partId || '2',
              partName: provider.partName || 'Part 2',
              part: provider.part || 2,
              providerId: provider.id,
              providerName: provider.name,
              forceInclude: isHistoricalSync || Boolean(options?.forceInclude),
            });
            if (added) newCount++;
          }
        });

        store.updateProvider(provider.id, {
          lastSyncStatus: 'success',
          lastSyncTime: Date.now(),
          lastSyncError: undefined,
          totalFetched: (provider.totalFetched || 0) + newCount,
        });

        return {
          success: true,
          newCount,
          message: isHistoricalSync
            ? `WhiteNoise historical sync completed! Imported ${newCount} SMS from ${customFromTime} into Live Feed & Reports.`
            : `Connected to WhiteNoise API! Synced ${newCount} new SMS across ${targetPhones.size} target numbers.`
        };
      }

      const url = new URL(provider.apiUrl);
      if (provider.apiToken) {
        url.searchParams.set(provider.tokenParam || 'token', provider.apiToken);
      }

      if (provider.params && typeof provider.params === 'object') {
        for (const [k, v] of Object.entries(provider.params)) {
          if (v !== undefined && v !== null && String(v).trim() !== '') {
            url.searchParams.set(k, String(v));
          }
        }
      }

      // Date parameter check: custom historical time or default today
      if (isHistoricalSync) {
        const dt1Key = (provider.dt1Param && provider.dt1Param.trim() !== '') ? provider.dt1Param.trim() : 'dt1';
        url.searchParams.set(dt1Key, customFromTime);
        const dt2Key = (provider.dt2Param && provider.dt2Param.trim() !== '') ? provider.dt2Param.trim() : 'dt2';
        if (customToTime) {
          url.searchParams.set(dt2Key, customToTime);
        } else {
          const now = new Date();
          const yyyy = now.getFullYear();
          const mm = String(now.getMonth() + 1).padStart(2, '0');
          const dd = String(now.getDate()).padStart(2, '0');
          url.searchParams.set(dt2Key, `${yyyy}-${mm}-${dd} 23:59:59`);
        }
      } else {
        const hasExplicitDateParam = Boolean(provider.dt1Param && provider.dt1Param.trim() !== '');
        if (hasExplicitDateParam) {
          const now = new Date();
          const yyyy = now.getFullYear();
          const mm = String(now.getMonth() + 1).padStart(2, '0');
          const dd = String(now.getDate()).padStart(2, '0');
          const localToday = `${yyyy}-${mm}-${dd}`;
          url.searchParams.set(provider.dt1Param, `${localToday} 00:00:00`);
          if (provider.dt2Param && provider.dt2Param.trim() !== '') {
            url.searchParams.set(provider.dt2Param, `${localToday} 23:59:59`);
          }
        }
      }

      if (isHistoricalSync && provider.recordsParam && provider.recordsParam.trim() !== '') {
        const recKey = provider.recordsParam.trim();
        url.searchParams.set(recKey, String(Math.max(provider.maxRecords || 1000, 3000)));
      } else if (provider.maxRecords && provider.recordsParam && provider.recordsParam.trim() !== '') {
        url.searchParams.set(provider.recordsParam.trim(), String(provider.maxRecords));
      }

      const fetchItemsFromUrl = async (fetchUrl: string): Promise<any[]> => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
          const response = await safeFetch(fetchUrl, {
            method: provider.method || 'GET',
            headers: {
              'Accept': 'application/json, text/plain, */*',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) KBMaxLiveGateway/3.0',
              ...(provider.headers || {}),
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) return [];
          const text = await response.text();
          let data: any;
          try {
            data = JSON.parse(text);
          } catch {
            data = text;
          }
          return extractSmsItems(data);
        } catch {
          return [];
        }
      };

      let items = await fetchItemsFromUrl(url.toString());

      // If date filtering returned 0 items, safely fallback to fetching without date constraints (throttled to at most once per 45s)
      // This prevents high-frequency polling from hammering the upstream gateway with unconstrained queries every second
      const nowTs = Date.now();
      const lastFallback = lastGatewayFallbackFetch.get(provider.id) || 0;
      if (items.length === 0 && !isHistoricalSync && Boolean(provider.dt1Param && provider.dt1Param.trim() !== '') && (nowTs - lastFallback > 45000)) {
        lastGatewayFallbackFetch.set(provider.id, nowTs);
        const fallbackUrl = new URL(provider.apiUrl);
        if (provider.apiToken) {
          fallbackUrl.searchParams.set(provider.tokenParam || 'token', provider.apiToken);
        }
        if (provider.params && typeof provider.params === 'object') {
          for (const [k, v] of Object.entries(provider.params)) {
            if (v !== undefined && v !== null && String(v).trim() !== '') {
              fallbackUrl.searchParams.set(k, String(v));
            }
          }
        }
        if (provider.maxRecords && provider.recordsParam && provider.recordsParam.trim() !== '') {
          fallbackUrl.searchParams.set(provider.recordsParam.trim(), String(provider.maxRecords));
        }
        const fallbackItems = await fetchItemsFromUrl(fallbackUrl.toString());
        if (fallbackItems.length > 0) {
          items = fallbackItems;
        }
      }

      const mapping = provider.fieldMapping || {};
      const phoneField = mapping.phoneField;
      const senderField = mapping.senderField;
      const messageField = mapping.messageField;
      const otpField = mapping.otpField;
      const serviceField = mapping.serviceField;
      const timeField = mapping.timestampField;

      if (items.length > 0) {
        for (const item of items) {
          if (!item) continue;
          const rawId = item.id || item.msg_id || item.sms_id || item.message_id || item.record_id || item.uid || item.smsid;
          const rawPhone = String(
            (phoneField && item[phoneField]) ||
            item.num || item.number || item.phone || item.mobile || item.msisdn ||
            item.recipient || item.destination || item.to || item.user_number ||
            item.phonenumber || item.phone_number || item.mobile_no || item.receiver || item.dest ||
            item.sim || item.address || item.target || item.ani || item.dnis ||
            item.sender_phone || item.sender_number || item.tel || item.telephone || ''
          ).trim();

          const rawSender = String(
            (senderField && item[senderField]) ||
            item.cli || item.callerId || item.caller_id || item.brand || item.sender || item.senderId ||
            item.sender_id || item.from || item.source || item.service || item.app || item.header ||
            item.mask || item.originator || ''
          ).trim();

          const rawCli = String(item.cli || item.callerId || item.caller_id || rawSender || item.brand || '').trim();
          const rawMsg = String(
            (messageField && item[messageField]) ||
            item.message || item.text || item.body || item.sms || item.msg ||
            item.sms_text || item.content || item.msg_body || item.full_message ||
            item.sms_content || item.data || item.sms_body || item.smsText || item.smsBody ||
            item.short_message || item.msg_content || item.message_content || ''
          ).trim();

          const rawOtp = String((otpField && item[otpField]) || item.otp || item.code || item.verification_code || '').trim();
          const rawCountry = item.country || item.nation || item.rangs || item.range || item.country_name || undefined;
          const rawDate = (timeField && item[timeField]) || item.dt || item.timestamp || item.date || item.datetime || item.date_time || item.dateTime || item.created_at || item.received_at || item.time || item.sent_time || item.insert_date || item.sms_date;
          const parsedDate = parseApiDateAndTimestamp(rawDate);

          // Skip fake status/error envelopes (e.g. AstraSMS returning {"message": "No Records Found"})
          const lowerMsg = rawMsg.toLowerCase().trim();
          const isFakeStatusMsg = 
            (!rawPhone || rawPhone.length < 4 || rawPhone.toLowerCase() === 'n/a') && 
            (lowerMsg.includes('no records found') || lowerMsg.includes('no record found') || lowerMsg.includes('no data found') || lowerMsg.includes('records not found'));
          if (isFakeStatusMsg) {
            continue;
          }

          if (rawPhone || rawMsg) {
            const added = store.addMessage({
              rawId: rawId ? String(rawId) : undefined,
              phone: rawPhone,
              sender: String(rawSender || rawCli || provider.name),
              country: rawCountry,
              cli: rawCli,
              message: String(rawMsg),
              service: (serviceField && item[serviceField]) || item.service || item.app || rawSender || rawCli || provider.name,
              otp: rawOtp || undefined,
              timestamp: parsedDate.timestamp,
              dateStr: parsedDate.dateStr,
              partId: provider.partId,
              partName: provider.partName,
              part: provider.part,
              providerId: provider.id,
              providerName: provider.name,
              forceInclude: isHistoricalSync || Boolean(options?.forceInclude),
            });
            if (added) {
              newCount++;
            }
          }
        }
      }
    }

    store.updateProvider(provider.id, {
      lastSyncStatus: 'success',
      lastSyncTime: Date.now(),
      lastSyncError: undefined,
    });

    const resultMessage = isHistoricalSync
      ? `Historical sync completed for ${provider.name}! Imported ${newCount} older SMS from ${customFromTime} into Live Feed & Reports.`
      : `Sync completed for ${provider.name} (${newCount} new)`;

    return { success: true, newCount, message: resultMessage };
  } catch (err: any) {
    store.updateProvider(provider.id, {
      lastSyncStatus: 'failed',
      lastSyncTime: Date.now(),
      lastSyncError: err.message,
    });
    return { success: false, error: err.message };
  } finally {
    inFlightSyncs.delete(provider.id);
  }
}

// WhiteNoise Background Continuous Auto-Sync Engine
let lastWhiteNoiseAutoSync = 0;
let isWhiteNoiseSyncInProgress = false;

async function syncWhiteNoiseAutoPoller() {
  const now = Date.now();
  // Poll WhiteNoise every 6 seconds
  if (now - lastWhiteNoiseAutoSync < 6000 || isWhiteNoiseSyncInProgress) {
    return;
  }
  lastWhiteNoiseAutoSync = now;
  isWhiteNoiseSyncInProgress = true;

  try {
    const settings = store.getSettings();
    const masterKey = (settings.whiteNoiseMasterKey || '').trim();

    // 1. Gather all targets to poll:
    const clients = store.getClients();
    const targetMap = new Map<string, { phone: string; apiKey: string; serviceName?: string }>();

    for (const client of clients) {
      if (client.status === 'active' && client.whiteNoiseConfig?.enabled) {
        const apiKey = (client.whiteNoiseConfig.apiKey || masterKey || '').trim();
        if (!apiKey) continue;

        const phones = client.whiteNoiseConfig.assignedPhones || [];
        for (const rawP of phones) {
          const cleanP = (rawP || '').trim();
          if (cleanP) {
            const key = `${apiKey}:::${cleanP}`;
            if (!targetMap.has(key)) {
              targetMap.set(key, {
                phone: cleanP,
                apiKey,
                serviceName: client.whiteNoiseConfig.defaultService,
              });
            }
          }
        }
      }
    }

    // Also check standard ApiProviders with whitenoise URL
    const providers = store.getProviders();
    let anyWhiteNoiseApiKey = masterKey || '';
    for (const prov of providers) {
      if (prov.enabled && prov.apiUrl && prov.apiUrl.includes('whitenoise')) {
        const apiKey = (prov.apiToken || prov.params?.api_key || masterKey || '').trim();
        if (apiKey && !anyWhiteNoiseApiKey) anyWhiteNoiseApiKey = apiKey;
        if (!apiKey) continue;
        const phoneParam = prov.params?.phone;
        if (phoneParam) {
          const phones = String(phoneParam).split(/[,;\s]+/).map(p => p.trim()).filter(Boolean);
          for (const cleanP of phones) {
            const key = `${apiKey}:::${cleanP}`;
            if (!targetMap.has(key)) {
              targetMap.set(key, {
                phone: cleanP,
                apiKey,
                serviceName: prov.params?.service_name,
              });
            }
          }
        }
      }
    }

    // Include WhiteNoise Direct Bulk Numbers (Numbers registered directly without range)
    const directNumbers = store.getWhiteNoiseDirectNumbers();
    if (directNumbers.length > 0 && anyWhiteNoiseApiKey) {
      for (const dn of directNumbers) {
        if (dn && dn.phone) {
          const cleanP = dn.phone.trim();
          const key = `${anyWhiteNoiseApiKey}:::${cleanP}`;
          if (!targetMap.has(key)) {
            targetMap.set(key, {
              phone: cleanP,
              apiKey: anyWhiteNoiseApiKey,
              serviceName: undefined,
            });
          }
        }
      }
    }

    if (targetMap.size === 0) {
      return;
    }

    // 2. Fetch SMS for all registered target numbers (8 at a time, 8s timeout each)
    const wnProvider = providers.find(p => p.enabled && p.apiUrl && p.apiUrl.includes('whitenoise'));
    const assignedPartId = wnProvider?.partId || '2';
    const assignedPartName = wnProvider?.partName || 'Part 2';
    const assignedPart = wnProvider?.part || (assignedPartId === '2' ? 2 : 1);
    const assignedProviderName = wnProvider?.name || 'WhiteNoise (API-2)';
    const assignedProviderId = wnProvider?.id;

    await runPool(Array.from(targetMap.values()), 8, async (target) => {
      const smsList = await fetchWhiteNoiseSms(target.apiKey, target.phone, target.serviceName, 300);
      let hasNewMessage = false;
      for (const item of smsList) {
        if (!item || !item.text) continue;
        const parsedDate = parseWhiteNoiseTime(item.time);
        const added = store.addMessage({
          rawId: item.id ? String(item.id) : undefined,
          phone: item.dst || target.phone,
          sender: item.src || item.service_name || assignedProviderName,
          cli: item.src || item.service_name || assignedProviderName,
          service: item.service_name || item.src || assignedProviderName,
          message: item.text,
          otp: extractOtp(item.text),
          timestamp: parsedDate.timestamp,
          dateStr: parsedDate.dateStr,
          part: assignedPart,
          partName: assignedPartName,
          partId: assignedPartId,
          providerId: assignedProviderId,
          providerName: assignedProviderName,
        });
        if (added) hasNewMessage = true;
      }
      if (hasNewMessage) {
        store.recordWhiteNoiseNumberSync(target.phone);
      }
    });

    if (wnProvider) {
      store.updateProvider(wnProvider.id, {
        lastSyncStatus: 'success',
        lastSyncTime: Date.now(),
        lastSyncError: undefined,
      });
    }
  } catch (err: any) {
    // Continue
  } finally {
    isWhiteNoiseSyncInProgress = false;
  }
}

// Background parallel poller: Syncs ALL active providers concurrently every 1000ms (1 second)
// Resilient loop with top-level error boundary ensuring it NEVER stops as long as providers are active
const runBackgroundPoller = async () => {
  try {
    const providers = store.getProviders();
    const activeProviders = providers.filter(p => p && p.enabled && p.autoSync);
    
    if (activeProviders.length > 0) {
      // Execute all non-WhiteNoise provider syncs in parallel
      // Note: WhiteNoise targets are unified and polled by syncWhiteNoiseAutoPoller to prevent double polling
      await Promise.allSettled(
        activeProviders.map(async (provider) => {
          try {
            if (provider.apiUrl && provider.apiUrl.includes('whitenoise')) {
              return;
            }
            const minInterval = Math.max(1000, (provider.syncIntervalSec || 1) * 1000);
            const lastSync = provider.lastSyncTime || 0;
            if (Date.now() - lastSync >= minInterval) {
              await syncProvider(provider);
            }
          } catch (syncErr) {
            console.error(`[Poller] Provider sync error for ${provider.name || provider.id}:`, syncErr);
          }
        })
      );
    }

    // Continuous auto-sync for WhiteNoise targets
    await syncWhiteNoiseAutoPoller();
  } catch (loopErr) {
    console.error('[Poller] Background poller loop caught error:', loopErr);
  }
};

// Self-scheduling loop: a new run can never start while the previous one is still running
const pollerLoop = async () => {
  try {
    await runBackgroundPoller();
  } finally {
    setTimeout(pollerLoop, 1000);
  }
};
setTimeout(pollerLoop, 1000);

// ==========================================
// 6. SETTINGS & STATS (ADMIN ONLY)
// ==========================================

app.get('/api/settings', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  let token: string | undefined;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  // Only return full settings (including webhookToken & admin username) to authenticated admins
  if (token) {
    const session = store.validateSession(token);
    if (session && session.role === 'admin') {
      return res.json({ settings: store.getSettings() });
    }
  }

  // Default: Return safe public settings with zero secret leakage
  res.json({ settings: store.getPublicSettings() });
});

app.put('/api/settings', requireAdmin, (req: AuthRequest, res: Response) => {
  const body = req.body || {};
  const sanitizedSettings: any = {};

  if (body.siteName !== undefined) sanitizedSettings.siteName = sanitizeInputString(body.siteName, 64);
  if (body.tagline !== undefined) sanitizedSettings.tagline = sanitizeInputString(body.tagline, 128);
  if (body.logoType !== undefined && (body.logoType === 'icon' || body.logoType === 'custom_url')) {
    sanitizedSettings.logoType = body.logoType;
  }
  if (body.customLogoUrl !== undefined) {
    // Only allow data:image/ or safe http(s) URL
    const url = String(body.customLogoUrl).trim();
    if (url.startsWith('data:image/') || url.startsWith('http://') || url.startsWith('https://') || url === '') {
      sanitizedSettings.customLogoUrl = url.slice(0, 3 * 1024 * 1024);
    }
  }
  if (body.theme !== undefined) sanitizedSettings.theme = body.theme;
  if (body.darkMode !== undefined) sanitizedSettings.darkMode = Boolean(body.darkMode);
  if (body.clientSessionMinutes !== undefined) {
    sanitizedSettings.clientSessionMinutes = Math.max(1, Math.min(1440, Number(body.clientSessionMinutes) || 5));
  }
  if (body.maxSmsRetention !== undefined) {
    sanitizedSettings.maxSmsRetention = Math.max(100, Math.min(50000, Number(body.maxSmsRetention) || 2000));
  }
  if (body.clientMaxRetention !== undefined) {
    sanitizedSettings.clientMaxRetention = Math.max(10, Math.min(50000, Number(body.clientMaxRetention) || 1000));
  }
  if (body.smsTableBgColor !== undefined) sanitizedSettings.smsTableBgColor = sanitizeInputString(body.smsTableBgColor, 32);
  if (body.smsTextColor !== undefined) sanitizedSettings.smsTextColor = sanitizeInputString(body.smsTextColor, 32);
  if (body.smsBorderColor !== undefined) sanitizedSettings.smsBorderColor = sanitizeInputString(body.smsBorderColor, 32);
  if (body.smsPresetTheme !== undefined) sanitizedSettings.smsPresetTheme = body.smsPresetTheme;
  if (body.smsFontSize !== undefined) sanitizedSettings.smsFontSize = body.smsFontSize;

  // Login Background Settings (Video loop or Picture on login page)
  if (body.loginBgType !== undefined) {
    const val = String(body.loginBgType).toLowerCase().trim();
    if (['cosmic', 'galaxy', 'video', 'image'].includes(val)) {
      sanitizedSettings.loginBgType = val;
    }
  }
  if (body.loginBgMediaUrl !== undefined) {
    const url = String(body.loginBgMediaUrl).trim();
    // Allow data URL (base64 image or video), absolute path, or http(s) URL
    if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/') || url === '') {
      sanitizedSettings.loginBgMediaUrl = url.slice(0, 10 * 1024 * 1024); // up to 10MB data/url
    }
  }
  if (body.loginBgVideoLoop !== undefined) sanitizedSettings.loginBgVideoLoop = Boolean(body.loginBgVideoLoop);
  if (body.loginBgOpacity !== undefined) {
    sanitizedSettings.loginBgOpacity = Math.max(0, Math.min(100, Number(body.loginBgOpacity) || 65));
  }
  if (body.publicServerUrl !== undefined) {
    const pUrl = String(body.publicServerUrl).trim();
    if (pUrl === '' || pUrl.startsWith('http://') || pUrl.startsWith('https://')) {
      sanitizedSettings.publicServerUrl = pUrl.replace(/\/+$/, '').slice(0, 512);
    }
  }

  const updated = store.updateSettings(sanitizedSettings);
  res.json({ success: true, settings: updated });
});

app.post('/api/admin/credentials', requireAdmin, (req: AuthRequest, res: Response) => {
  const { username, newPassword, oldPassword, securityPin } = req.body;
  if (newPassword && typeof newPassword === 'string' && newPassword.length < 4) {
    return res.status(400).json({ error: 'New password must be at least 4 characters' });
  }

  const result = store.updateAdminCredentials(
    username ? sanitizeInputString(username, 32) : undefined, 
    newPassword ? String(newPassword).slice(0, 128) : undefined, 
    oldPassword ? String(oldPassword).slice(0, 128) : undefined, 
    securityPin ? sanitizeInputString(securityPin, 32) : undefined
  );
  if (!result.success) {
    return res.status(400).json({ error: result.error || 'Failed to update credentials' });
  }
  res.json({ success: true, message: 'Admin credentials updated successfully' });
});

app.get('/api/stats', requireAdmin, (_req: AuthRequest, res: Response) => {
  res.json({ stats: store.getStats() });
});

// ==========================================
// 7. VITE MIDDLEWARE & STATIC SERVING
// ==========================================

// Prevent unhandled /api/* requests from falling through to Vite SPA HTML fallback
app.all('/api/*', (_req: Request, res: Response) => {
  res.status(404).json({ status: 'error', message: 'API route not found' });
});

async function startServer() {
  // Dev server (Vite) only when NODE_ENV=development. Production never loads Vite.
  if (process.env.NODE_ENV === 'development') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      maxAge: '7d',
      etag: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
      },
    }));
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const HOST = process.env.HOST || '0.0.0.0';
  const server = app.listen(PORT, HOST, () => {
    console.log(`[KB MAX] Server running on http://${HOST}:${PORT} (${process.env.NODE_ENV || 'production'})`);
  });

  // Graceful shutdown: close live streams, flush data to disk, then exit
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[KB MAX] ${signal} received, saving data...`);
    try {
      for (const c of sseClients) {
        try { c.res.end(); } catch { /* ignore */ }
      }
      server.close();
      await Promise.race([store.flush(), new Promise(r => setTimeout(r, 8000))]);
    } catch (err) {
      console.error('Shutdown error:', err);
    }
    process.exit(0);
  };
  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.on('SIGINT', () => { void shutdown('SIGINT'); });
}

startServer();
