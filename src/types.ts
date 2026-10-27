export type UserRole = 'admin' | 'client';

export interface WhiteNoiseDirectNumber {
  phone: string;
  country: string;
  countryCode?: string;
  addedAt: number;
  totalSynced?: number;
  lastSyncedAt?: number;
}

export interface Reports2FilterRule {
  id: string;
  type: 'country' | 'number' | 'cli' | 'sms' | 'app' | 'sms_body';
  pattern: string;
  matchType?: 'contains' | 'exact' | 'starts_with';
  action: 'block' | 'mask'; // block = completely hide, mask = hide text but keep OTP
  enabled: boolean;
  createdAt: number;
  notes?: string;
}

export interface ClientWhiteNoiseConfig {
  enabled: boolean;          // Access granted by Admin to 2nd API / Sidebar 2
  apiKey?: string;           // Optional client-specific 12-char API key (falls back to master key)
  assignedPhones?: string[]; // Specific phone numbers assigned to client (e.g. ["+959686338504"])
  defaultPhone?: string;     // Default pre-selected phone
  allowedServices?: string[];// Allowed service names (e.g. ["tiktok", "whatsapp"])
  defaultService?: string;   // Default service filter
  defaultSince?: number;     // 15 - 600 seconds, default 60
  allowConversion?: boolean; // Permission to register conversion
}

export interface WhiteNoiseSmsItem {
  id: number | string;
  time: string;
  src: string;
  dst: string;
  service_name: string;
  text: string;
  otp?: string;
  converted?: boolean;
}

export interface UserSession {
  token: string;
  userId: string;
  username: string;
  role: UserRole;
  expiresAt: number; // Unix timestamp (ms)
  createdAt: number;
  durationSeconds?: number; // Total configured session duration in seconds
  storageLimit?: number; // Client OTP box storage limit (min 500)
  allowedServices?: string[];
  whiteNoiseConfig?: ClientWhiteNoiseConfig;
  panelType?: 'primary' | 'reports2'; // Default: 'primary'
  maskSensitiveBody?: boolean;        // If true, payload body is masked
}

export interface ClientAccount {
  id: string;
  username: string;
  password?: string; // only visible when creating/updating or in admin secure view
  allowedServices: string[]; // e.g. ["*"] for all or ["WhatsApp", "Telegram", "Google"]
  status: 'active' | 'inactive';
  deactivatedReason?: 'inactive_3_days' | string;
  deactivatedAt?: number;
  createdAt: number;
  notes?: string;
  sessionMinutes?: number; // Configured session duration in minutes (e.g. 5)
  storageLimit?: number; // Client OTP box storage capacity (min 500, e.g. 500, 1000)
  activeSessionsCount?: number;
  lastActive?: number; // Last activity timestamp (ms)
  lastLoginAt?: number; // Last login timestamp (ms)
  panelOpenCount?: number; // Total number of times client opened the panel
  lastIp?: string;
  maxConcurrentSessions?: number; // default 3
  isLocked?: boolean;
  lockedUntil?: number; // Unix timestamp in ms when lockout expires
  lockReason?: string;
  whiteNoiseConfig?: ClientWhiteNoiseConfig;
  panelType?: 'primary' | 'reports2'; // Panel assigned: 'primary' (full) or 'reports2' (restricted team view)
  maskSensitiveBody?: boolean;        // If true, sensitive message body is masked
  reports2AllowedApps?: string[];     // Allowed apps specific to Reports 2
  reports2StoppedClis?: string[];     // CLIs stopped specifically for this client/Reports 2
}

export interface Partition {
  id: string;
  name: string;
  createdAt?: number;
}

export interface NumberRange {
  id: string;
  name: string;              // e.g. "Tanzania LX 26Aug", "Guinea Orange", "Ukraine Kyivstar"
  prefix: string;            // e.g. "255", "224", "380"
  countryNote?: string;      // e.g. "Tanzania", "Guinea", "Ukraine"
  numbers: string[];         // Assigned phone numbers (MSISDNs)
  totalNumbers: number;
  createdAt: number;
  updatedAt?: number;
  allowedBlockedClis?: string[]; // Specific blocked CLIs/patterns granted access to work on this range
}

export interface ApiProviderMapping {
  phoneField: string;
  senderField: string;
  messageField: string;
  otpField?: string;
  serviceField?: string;
  timestampField?: string;
}

export interface ApiProvider {
  id: string;
  name: string;
  partId?: string;
  partName?: string;
  part?: 1 | 2 | string | number;
  apiUrl: string;
  apiToken?: string;
  maxRecords?: number;
  tokenParam?: string;
  recordsParam?: string;
  dt1Param?: string;
  dt2Param?: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  params?: Record<string, string>;
  fieldMapping: ApiProviderMapping;
  autoSync: boolean;
  syncIntervalSec: number;
  lastSyncTime?: number;
  lastSyncStatus?: 'success' | 'failed' | 'idle' | 'running';
  lastSyncError?: string;
  totalFetched: number;
  todayFetched?: number;
  yesterdayFetched?: number;
  webhookSecret: string;
  enabled: boolean;
  createdAt: number;
}

export interface SmsMessage {
  id: string;
  phone: string;
  sender: string;
  service: string;
  country?: string;
  rangeName?: string; // Automatically detected range name (e.g. Guinea Orange, Tanzania LX)
  cli?: string;
  message: string;
  otp?: string;
  timestamp: number;
  dateStr?: string;
  partId?: string;
  partName?: string;
  part?: 1 | 2 | string | number;
  providerId?: string;
  providerName?: string;
  ipAddress?: string;
  rawId?: string;
  isNew?: boolean;
  isClientBlocked?: boolean;
}

export interface ClientFilterRule {
  id: string;
  type: 'app' | 'cli' | 'sms_body' | 'range' | 'all';
  pattern: string;
  matchType?: 'exact' | 'contains' | 'starts_with';
  enabled: boolean;
  notes?: string;
  createdAt: number;
  scope?: 'all' | 'specific_ranges'; // 'all' = blocks globally on all ranges; 'specific_ranges' = only blocks on targetRanges
  targetRanges?: string[]; // Specific ranges where this app/CLI/rule is strictly blocked (does not stop for any other range or country)
  allowedRanges?: string[]; // Range names or IDs that have ACCESS even if this rule matches (Bypasses block for these ranges)
}

export type ThemePreset = 'emerald' | 'cyan' | 'sapphire' | 'violet' | 'amber' | 'crimson';

export interface SiteSettings {
  siteName: string;
  tagline: string;
  logoType: 'icon' | 'custom_url';
  customLogoUrl: string;
  theme: ThemePreset;
  darkMode: boolean;
  clientSessionMinutes: number;
  enableSoundByDefault: boolean;
  webhookToken: string;
  adminUsername: string;
  maxSmsRetention?: number;
  clientMaxRetention?: number;
  // Live SMS Custom Color & Font Styling Options
  smsTableBgColor?: string;
  smsTextColor?: string;
  smsBorderColor?: string;
  smsCardBgColor?: string;
  smsFontSize?: 'compact' | 'normal' | 'large';
  smsPresetTheme?: 'default' | 'oled' | 'matrix' | 'navy' | 'light' | 'gold' | 'custom';
  // Admin Login Background Settings (Picture or Video loop)
  loginBgType?: 'cosmic' | 'galaxy' | 'video' | 'image';
  loginBgMediaUrl?: string;
  loginBgVideoLoop?: boolean;
  loginBgOpacity?: number;
  // VPS Host / Public URL (Optional: direct domain/IP without port 3000)
  publicServerUrl?: string;
  // WhiteNoise Master API Key (Default system key for API-2)
  whiteNoiseMasterKey?: string;
}

export interface SystemStats {
  totalSms: number;
  todaySms: number;
  yesterdaySms?: number;
  thisWeekSms?: number;
  thisMonthSms?: number;
  thisYearSms?: number;
  dailyStats?: { date: string; count: number; label: string }[];
  activeClients: number;
  activeProviders: number;
  activeSessions: number;
  recentOtpCount: number;
  topServices: { service: string; count: number }[];
}

export interface SmsReportGroup {
  hour?: string;
  date?: string;
  month?: string;
  range?: string;
  number?: string;
  cli?: string;
  count: number;
  [key: string]: any;
}

