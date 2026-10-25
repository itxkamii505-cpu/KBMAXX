import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Zap, 
  Phone, 
  RefreshCw, 
  Clock, 
  CheckCircle2, 
  Copy, 
  Check, 
  AlertCircle, 
  Key, 
  Layers, 
  Sliders, 
  Hash, 
  Flame, 
  Volume2, 
  VolumeX, 
  ArrowUpRight,
  ShieldCheck,
  Send
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { soundManager } from '../../utils/sound';
import type { WhiteNoiseSmsItem } from '../../types';

interface WhiteNoisePortalViewProps {
  isAdmin?: boolean;
}

async function parseSafeJson(res: Response): Promise<{ data: any; ok: boolean; errorMessage?: string }> {
  let text = '';
  try {
    text = await res.text();
  } catch (err: any) {
    return { data: null, ok: false, errorMessage: `Network error: ${err.message}` };
  }

  if (!text || !text.trim()) {
    return { data: null, ok: res.ok, errorMessage: res.ok ? undefined : `Server returned status ${res.status}` };
  }

  try {
    const data = JSON.parse(text);
    return { data, ok: res.ok };
  } catch {
    const cleanText = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
    return { 
      data: null, 
      ok: false, 
      errorMessage: cleanText ? `Server Response: ${cleanText}` : `Server returned non-JSON format (${res.status})` 
    };
  }
}

export const WhiteNoisePortalView: React.FC<WhiteNoisePortalViewProps> = ({ isAdmin = false }) => {
  const { session } = useAuth();
  
  // Client pre-assigned configurations (if client)
  const clientConfig = session?.whiteNoiseConfig;
  const assignedPhones = clientConfig?.assignedPhones || [];
  const defaultPhone = clientConfig?.defaultPhone || (assignedPhones.length > 0 ? assignedPhones[0] : '');
  const allowConversion = isAdmin || (clientConfig?.allowConversion !== false);

  // Query Controls State
  const [phone, setPhone] = useState<string>(defaultPhone || '+959686338504');
  const [serviceName, setServiceName] = useState<string>(clientConfig?.defaultService || '');
  const [since, setSince] = useState<number>(clientConfig?.defaultSince || 60);
  const [apiKeyOverride, setApiKeyOverride] = useState<string>('');
  
  // Results & Stats State
  const [messages, setMessages] = useState<WhiteNoiseSmsItem[]>([]);
  const [phoneCount, setPhoneCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isCountLoading, setIsCountLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  
  // Auto-polling state
  const [autoPoll, setAutoPoll] = useState<boolean>(false);
  const [pollIntervalSec, setPollIntervalSec] = useState<number>(15);
  const [countdown, setCountdown] = useState<number>(15);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Copy feedback states
  const [copiedOtpId, setCopiedOtpId] = useState<string | number | null>(null);
  const [convertingSmsId, setConvertingSmsId] = useState<string | number | null>(null);
  const [convertedIds, setConvertedIds] = useState<Set<string | number>>(new Set());

  // Conversion feedback toast
  const [conversionNotice, setConversionNotice] = useState<string | null>(null);

  // Master API Key Management (Admin only)
  const [masterKey, setMasterKey] = useState<string>('');
  const [hasMasterKey, setHasMasterKey] = useState<boolean>(false);
  const [isSavingKey, setIsSavingKey] = useState<boolean>(false);
  const [isTestingKey, setIsTestingKey] = useState<boolean>(false);
  const [keyNotice, setKeyNotice] = useState<{ text: string; success: boolean } | null>(null);

  // Load config on mount
  const fetchConfig = useCallback(async () => {
    if (!session?.token) return;
    try {
      const res = await fetch('/api/whitenoise/config', {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      const { data, ok } = await parseSafeJson(res);
      if (ok && data?.isAdmin) {
        setHasMasterKey(Boolean(data.hasMasterKey));
        setMasterKey(data.masterKey || '');
      }
    } catch {
      // Ignore
    }
  }, [session?.token]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSaveMasterKey = async () => {
    if (!session?.token) return;
    setIsSavingKey(true);
    setKeyNotice(null);
    try {
      const res = await fetch('/api/whitenoise/admin-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ whiteNoiseMasterKey: masterKey.trim() }),
      });
      const { data, ok, errorMessage } = await parseSafeJson(res);
      if (ok && data?.success) {
        setHasMasterKey(Boolean(masterKey.trim()));
        setKeyNotice({ text: 'Master WhiteNoise API Key saved successfully!', success: true });
        setTimeout(() => setKeyNotice(null), 4000);
      } else {
        setKeyNotice({ text: data?.message || errorMessage || 'Failed to save API key', success: false });
      }
    } catch (err: any) {
      setKeyNotice({ text: err.message || 'Network error saving API key', success: false });
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleTestMasterKey = async () => {
    if (!masterKey.trim()) {
      setKeyNotice({ text: 'Please enter a 12-character API Key first.', success: false });
      return;
    }
    if (!session?.token) {
      setKeyNotice({ text: 'Please log in to test API key.', success: false });
      return;
    }
    setIsTestingKey(true);
    setKeyNotice(null);
    try {
      const res = await fetch('/api/whitenoise/last-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          phone: phone.trim() || '+959686338504',
          api_key: masterKey.trim(),
          since: 60,
        }),
      });

      const { data, ok, errorMessage } = await parseSafeJson(res);
      if (ok && data?.status === 'ok') {
        setKeyNotice({ text: 'Connection Verified! WhiteNoise API responded with status 200 OK.', success: true });
      } else {
        const msg = data?.message || errorMessage || `Server status ${res.status}`;
        setKeyNotice({ 
          text: `WhiteNoise API: ${msg}`, 
          success: false 
        });
      }
    } catch (err: any) {
      setKeyNotice({ text: `Connection error: ${err.message}`, success: false });
    } finally {
      setIsTestingKey(false);
    }
  };

  // Keep track of seen IDs to detect new messages for sound notification
  const seenIdsRef = useRef<Set<string | number>>(new Set());

  // Fetch Phone SMS Count (Page 2: https://api.whitenoise.one/sms/get-phone-sms-count)
  const fetchPhoneCount = useCallback(async (targetPhone: string) => {
    if (!targetPhone.trim() || !session?.token) return;
    setIsCountLoading(true);
    try {
      const res = await fetch('/api/whitenoise/sms-count', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          phone: targetPhone.trim(),
          ...(isAdmin && apiKeyOverride ? { api_key: apiKeyOverride.trim() } : {}),
        }),
      });

      const { data, ok } = await parseSafeJson(res);
      if (ok && data?.status === 'ok') {
        setPhoneCount(typeof data.count === 'number' ? data.count : null);
      }
    } catch {
      // Quiet ignore for background count
    } finally {
      setIsCountLoading(false);
    }
  }, [session?.token, isAdmin, apiKeyOverride]);

  // Fetch Phone Last SMS (Page 1: https://api.whitenoise.one/sms/get-phone-last-sms)
  const fetchLastSms = useCallback(async (manual = false) => {
    if (!phone.trim() || !session?.token) {
      if (manual) setError('Please enter a phone number.');
      return;
    }

    if (manual) setIsLoading(true);
    setError(null);

    try {
      const payload: Record<string, any> = {
        phone: phone.trim(),
        since: Number(since) || 60,
      };

      if (serviceName.trim() && serviceName.toLowerCase() !== 'all') {
        payload.service_name = serviceName.trim();
      }

      if (isAdmin && apiKeyOverride.trim()) {
        payload.api_key = apiKeyOverride.trim();
      }

      const res = await fetch('/api/whitenoise/last-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify(payload),
      });

      const { data, ok, errorMessage } = await parseSafeJson(res);

      if (!ok || data?.status !== 'ok') {
        throw new Error(data?.message || errorMessage || `Failed to fetch SMS (${res.status})`);
      }

      const smsList: WhiteNoiseSmsItem[] = Array.isArray(data.sms) ? data.sms : [];

      // Check for newly arrived messages for sound trigger
      let hasNew = false;
      smsList.forEach(item => {
        if (!seenIdsRef.current.has(item.id)) {
          seenIdsRef.current.add(item.id);
          hasNew = true;
        }
      });

      if (hasNew && soundEnabled && !manual) {
        soundManager.playNewSmsPing();
      }

      setMessages(smsList);
      setLastFetchedAt(Date.now());
      
      // Also update today's SMS count for this number
      fetchPhoneCount(phone.trim());
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching SMS from WhiteNoise API');
    } finally {
      if (manual) setIsLoading(false);
    }
  }, [phone, since, serviceName, isAdmin, apiKeyOverride, session?.token, soundEnabled, fetchPhoneCount]);

  // Initial load
  useEffect(() => {
    if (phone.trim()) {
      fetchLastSms(true);
      fetchPhoneCount(phone.trim());
    }
  }, []);

  // Auto-polling interval
  useEffect(() => {
    if (!autoPoll) {
      setCountdown(pollIntervalSec);
      return;
    }

    setCountdown(pollIntervalSec);
    const ticker = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchLastSms(false);
          return pollIntervalSec;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(ticker);
  }, [autoPoll, pollIntervalSec, fetchLastSms]);

  // Register SMS Conversion (Page 3: https://api.whitenoise.one/sms/register-sms-conversion)
  const handleRegisterConversion = async (item: WhiteNoiseSmsItem) => {
    if (!session?.token) return;
    setConvertingSmsId(item.id);
    setConversionNotice(null);

    try {
      const res = await fetch('/api/whitenoise/register-conversion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          sms_id: item.id,
          phone: item.dst || phone,
          service_name: item.service_name || 'tiktok',
          ...(isAdmin && apiKeyOverride ? { api_key: apiKeyOverride.trim() } : {}),
        }),
      });

      const { data, ok, errorMessage } = await parseSafeJson(res);
      if (ok && data?.status === 'ok') {
        setConvertedIds((prev) => new Set(prev).add(item.id));
        setConversionNotice(`Conversion registered for SMS #${item.id}!`);
        setTimeout(() => setConversionNotice(null), 3500);
      } else {
        setError(data?.message || errorMessage || 'Failed to register conversion');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to register conversion');
    } finally {
      setConvertingSmsId(null);
    }
  };

  const copyToClipboard = (text: string, id: string | number) => {
    navigator.clipboard.writeText(text);
    setCopiedOtpId(id);
    setTimeout(() => setCopiedOtpId(null), 2000);
  };

  const servicePresets = ['All', 'tiktok', 'whatsapp', 'telegram', 'google', 'facebook', 'instagram', 'viber'];

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-10">
      {/* Top Banner / Hero */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-3xl p-5 sm:p-6 shadow-[0_10px_35px_rgba(79,70,229,0.15)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-400 shadow-xs">
                <Zap className="w-4 h-4" />
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                <span>WhiteNoise Live SMS Gateway</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  API-2 (Sidebar 2)
                </span>
              </h2>
            </div>
            <p className="text-xs text-indigo-200/80">
              Direct high-speed number feed for OTPs, verification codes, and instant conversion tracking.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center flex-wrap gap-2.5">
            {/* Today's Count Card */}
            <div className="bg-slate-900/80 border border-slate-700/80 rounded-2xl px-3.5 py-2 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Hash className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Today's Received</span>
                <div className="flex items-center gap-1.5 font-bold text-white text-sm">
                  {isCountLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400" />
                  ) : phoneCount !== null ? (
                    <span className="font-mono text-emerald-400 text-base">{phoneCount} SMS</span>
                  ) : (
                    <span className="text-slate-500 text-xs">--</span>
                  )}
                </div>
              </div>
            </div>

            {/* Total In Session */}
            <div className="bg-slate-900/80 border border-slate-700/80 rounded-2xl px-3.5 py-2 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Fetched Now</span>
                <span className="font-mono text-blue-400 font-bold text-base">{messages.length} SMS</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Master Key Binding Box */}
      {isAdmin && (
        <div className="bg-slate-900 border-2 border-indigo-500/50 rounded-3xl p-5 shadow-xl space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Key className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <span>API Key Binding (System Master Key)</span>
                  {hasMasterKey ? (
                    <span className="text-[10px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-2 py-0.5 rounded-full font-mono font-bold">
                      ✓ Bound & Active
                    </span>
                  ) : (
                    <span className="text-[10px] bg-amber-500/20 border border-amber-500/40 text-amber-300 px-2 py-0.5 rounded-full font-mono font-bold">
                      Not Configured Yet
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-400">
                  Bind WhiteNoise 12-char API Key here. All clients with Sidebar 2 access will use this key automatically.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <input
                type="text"
                value={masterKey}
                onChange={(e) => setMasterKey(e.target.value)}
                placeholder="Paste WhiteNoise 12-character API Key here (e.g. AbC123XyZ456)"
                className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-colors"
              />
              <Key className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleSaveMasterKey}
                disabled={isSavingKey}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isSavingKey ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                <span>Save Key</span>
              </button>

              <button
                type="button"
                onClick={handleTestMasterKey}
                disabled={isTestingKey}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/50 text-indigo-200 text-xs font-bold transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isTestingKey ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-400" />}
                <span>Test Key</span>
              </button>
            </div>
          </div>

          {keyNotice && (
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              keyNotice.success
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
              {keyNotice.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              )}
              <span>{keyNotice.text}</span>
            </div>
          )}
        </div>
      )}

      {/* Main Query & Control Console */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">Target Phone & Filter Parameters</h3>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Sound Toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                soundEnabled 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
              title={soundEnabled ? 'Sound alert enabled' : 'Sound alert muted'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Auto-Poll Switch */}
            <button
              type="button"
              onClick={() => setAutoPoll(!autoPoll)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold font-mono flex items-center gap-2 transition-all cursor-pointer ${
                autoPoll 
                  ? 'bg-indigo-500/20 border-indigo-400/40 text-indigo-300 ring-2 ring-indigo-500/20' 
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${autoPoll ? 'animate-spin text-indigo-400' : ''}`} />
              <span>{autoPoll ? `Polling (${countdown}s)` : 'Auto-Poll Off'}</span>
            </button>
          </div>
        </div>

        {/* Input Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* 1. Phone Input / Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Target Phone *</span>
              {assignedPhones.length > 0 && (
                <span className="text-[10px] text-indigo-400 lowercase font-mono">
                  {assignedPhones.length} assigned
                </span>
              )}
            </label>
            
            {assignedPhones.length > 0 ? (
              <select
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm focus:border-indigo-400"
              >
                {assignedPhones.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+959686338504"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm focus:border-indigo-400 transition-colors"
                />
                <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            )}
          </div>

          {/* 2. Service Name Filter */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
              Service Name Filter
            </label>
            <input
              type="text"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              placeholder="e.g. tiktok, whatsapp (or all)"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm focus:border-indigo-400"
            />
          </div>

          {/* 3. Time Window (since 15-600s) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                Time Window (`since`)
              </label>
              <span className="text-[11px] font-mono font-bold text-indigo-400">{since}s</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={since}
                onChange={(e) => setSince(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm focus:border-indigo-400"
              >
                <option value={15}>Last 15 seconds</option>
                <option value={30}>Last 30 seconds</option>
                <option value={60}>Last 60 seconds (Default)</option>
                <option value={120}>Last 2 minutes</option>
                <option value={300}>Last 5 minutes</option>
                <option value={600}>Last 10 minutes (Max)</option>
              </select>
            </div>
          </div>

          {/* 4. Action Button */}
          <div className="space-y-1.5 flex flex-col justify-end">
            <button
              type="button"
              onClick={() => fetchLastSms(true)}
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-600/20 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Fetching SMS...' : 'Fetch SMS Now'}</span>
            </button>
          </div>
        </div>

        {/* Quick Service Presets Bar */}
        <div className="flex items-center flex-wrap gap-1.5 pt-1">
          <span className="text-[10px] text-slate-400 uppercase font-mono mr-1">Quick Filter:</span>
          {servicePresets.map((srv) => (
            <button
              key={srv}
              type="button"
              onClick={() => setServiceName(srv === 'All' ? '' : srv)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all cursor-pointer ${
                (srv === 'All' && !serviceName) || serviceName.toLowerCase() === srv.toLowerCase()
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {srv}
            </button>
          ))}
        </div>

        {/* Admin Only API Key Override Bar */}
        {isAdmin && (
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center gap-3">
            <div className="flex items-center gap-2 text-slate-400 text-xs shrink-0">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span>Admin Key Override:</span>
            </div>
            <input
              type="text"
              value={apiKeyOverride}
              onChange={(e) => setApiKeyOverride(e.target.value)}
              placeholder="Leave empty to use System Master Key or type 12-char key"
              className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs focus:border-amber-400"
            />
          </div>
        )}
      </div>

      {/* Error & Feedback Messages */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-400 hover:text-white font-bold text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {conversionNotice && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{conversionNotice}</span>
        </div>
      )}

      {/* Live SMS Feed Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Received SMS Stream</span>
              <span className="text-xs font-mono font-normal text-slate-400">
                ({messages.length} messages)
              </span>
            </h3>
          </div>

          {lastFetchedAt && (
            <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Updated: {new Date(lastFetchedAt).toLocaleTimeString()}</span>
            </span>
          )}
        </div>

        {messages.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
              <Phone className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-white">No SMS found for this period</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              No messages have been received for <span className="text-white font-mono">{phone}</span> within the last {since} seconds.
              Trigger a verification code or adjust the time window above.
            </p>
            <button
              type="button"
              onClick={() => fetchLastSms(true)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Re-check Now</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5">
            {messages.map((sms) => {
              const isConverted = convertedIds.has(sms.id);
              return (
                <div
                  key={sms.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 sm:p-5 shadow-lg transition-all space-y-3"
                >
                  {/* Top Meta Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                    <div className="flex items-center flex-wrap gap-2">
                      {/* Service Badge */}
                      <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-mono text-[11px] font-bold uppercase">
                        {sms.service_name || 'Service'}
                      </span>

                      {/* Sender */}
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-sans text-[11px] font-medium">
                        From: <strong className="text-white">{sms.src}</strong>
                      </span>

                      {/* Target Phone */}
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[11px]">
                        To: <strong className="text-white">{sms.dst}</strong>
                      </span>

                      {/* SMS ID */}
                      <span className="text-[10px] text-slate-500 font-mono">
                        #{sms.id}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Timestamp */}
                      <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{sms.time}</span>
                      </span>

                      {/* Converted Indicator */}
                      {isConverted && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-bold font-mono flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>Converted</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body Content & Extracted OTP Box */}
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    {/* Message Body */}
                    <div className="flex-1">
                      <p className="text-sm text-slate-200 font-sans leading-relaxed break-words">
                        {sms.text}
                      </p>
                    </div>

                    {/* Extracted OTP Badge (1-Click Copy) */}
                    {sms.otp ? (
                      <div className="flex items-center gap-2 bg-emerald-950/40 border-2 border-emerald-500/40 rounded-2xl p-2.5 px-3.5 shrink-0 shadow-inner">
                        <div className="text-right">
                          <span className="text-[9px] uppercase font-mono tracking-wider text-emerald-400 font-bold block">
                            Verification Code
                          </span>
                          <span className="text-lg font-black font-mono text-emerald-300 tracking-wider">
                            {sms.otp}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(sms.otp!, sms.id)}
                          className="p-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 transition-colors cursor-pointer"
                          title="Copy Code"
                        >
                          {copiedOtpId === sms.id ? (
                            <Check className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {/* Action Footer */}
                  {allowConversion && (
                    <div className="flex items-center justify-end pt-2 border-t border-slate-800/60">
                      <button
                        type="button"
                        onClick={() => handleRegisterConversion(sms)}
                        disabled={convertingSmsId === sms.id || isConverted}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                          isConverted
                            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 opacity-80 cursor-default'
                            : 'bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 active:scale-95'
                        }`}
                        title="Register SMS conversion to WhiteNoise API"
                      >
                        {convertingSmsId === sms.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : isConverted ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        )}
                        <span>{isConverted ? 'Conversion Registered' : 'Register Conversion'}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default WhiteNoisePortalView;
