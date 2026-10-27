import React, { useState, useEffect, useMemo } from 'react';
import { usePolling } from '../../hooks/usePolling';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  UserPlus, 
  Trash2, 
  Edit3, 
  Key, 
  ShieldCheck, 
  ShieldAlert, 
  Shield,
  Clock, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock,
  Power,
  Sparkles,
  Radio,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Search,
  ArrowUpDown,
  Filter,
  Check,
  ChevronDown,
  Copy,
  Globe,
  Link2,
  Share2,
  Zap
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { THEMES } from '../../utils/theme';
import { triggerHapticFeedback } from '../../utils/haptics';
import type { ClientAccount } from '../../types';

function formatLifetimeDateTime(timestamp?: number): string {
  if (!timestamp) return 'No Activity Recorded';
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

function formatLastSeen(timestamp?: number): { relative: string; full: string; isRecent: boolean } {
  if (!timestamp) return { relative: 'Never', full: 'No activity recorded', isRecent: false };
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 15) return { relative: 'Active now', full: new Date(timestamp).toLocaleString(), isRecent: true };
  if (diffSec < 60) return { relative: `${diffSec}s ago`, full: new Date(timestamp).toLocaleString(), isRecent: true };
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return { relative: `${diffMin}m ago`, full: new Date(timestamp).toLocaleString(), isRecent: diffMin < 10 };
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return { relative: `${diffHr}h ago`, full: new Date(timestamp).toLocaleString(), isRecent: false };
  const diffDays = Math.floor(diffHr / 24);
  return { relative: `${diffDays}d ago`, full: new Date(timestamp).toLocaleString(), isRecent: false };
}

const ALPHABET = ['ALL', '0-9', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

export const ClientsView: React.FC = () => {
  const { session, settings } = useAuth();
  const theme = settings?.theme ? THEMES[settings.theme] : THEMES.emerald;

  const [clients, setClients] = useState<ClientAccount[]>([]);
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
  
  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientAccount | null>(null);
  const [deletePinModal, setDeletePinModal] = useState<{
    isOpen: boolean;
    mode: 'single' | 'batch';
    targetClient: ClientAccount | null;
    securityPin: string;
    error: string | null;
    isProcessing: boolean;
    showPin: boolean;
  }>({
    isOpen: false,
    mode: 'single',
    targetClient: null,
    securityPin: '',
    error: null,
    isProcessing: false,
    showPin: false,
  });

  // A-to-Z and Numerical Filters & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [letterFilter, setLetterFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'num-asc' | 'num-desc' | 'name-asc' | 'name-desc' | 'status'>('name-asc');

  const [messageNotice, setMessageNotice] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Simplified Form State:
  // When creating: ONLY username, password, maxConcurrentSessions (count limit), and optional 2nd API card
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    maxConcurrentSessions: 3,
    status: 'active' as 'active' | 'inactive',
    notes: '',
    allowApi2: false,
    api2ApiKey: '',
    api2PhoneNumbers: '',
    api2DefaultService: '',
    api2Since: 60,
    api2AllowConversion: true,
    panelType: 'primary' as 'primary' | 'reports2',
    maskSensitiveBody: false,
    reports2AllowedApps: '',
    reports2StoppedClis: '',
  });

  const [passwordVisibleInModal, setPasswordVisibleInModal] = useState(false);

  const fetchClients = async () => {
    if (!session) return;
    try {
      const res = await fetch('/api/clients', {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setClients(data.clients || []);
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    fetchClients();
  }, [session]);
  usePolling(fetchClients, 10000, !!session);

  const [copiedClientId, setCopiedClientId] = useState<string | null>(null);

  // Dynamic Login URL resolution (Respects custom VPS URL or current host, with or without port 3000)
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const configuredBase = settings?.publicServerUrl?.trim()
    ? settings.publicServerUrl.replace(/\/+$/, '')
    : currentOrigin;
  const directLoginUrl = `${configuredBase}/ints/login`;

  const handleCopyClientAccess = (client: ClientAccount) => {
    triggerHapticFeedback(15);
    const accessText = `🌐 ${settings?.siteName || 'KB MAX'} Client Portal\n🔗 Login URL: ${directLoginUrl}\n👤 Username: ${client.username}\n🔑 Password: ${client.password}`;
    try {
      navigator.clipboard.writeText(accessText);
      setCopiedClientId(client.id);
      showToast(`Copied login credentials & direct URL for "${client.username}"!`, 'success');
      setTimeout(() => setCopiedClientId(null), 2500);
    } catch {
      showToast('Failed to copy to clipboard', 'error');
    }
  };

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setMessageNotice({ text, type });
    setTimeout(() => setMessageNotice(null), 4000);
  };

  const handleOpenAdd = () => {
    triggerHapticFeedback(15);
    setEditingClient(null);
    setPasswordVisibleInModal(true);
    setFormData({
      username: '',
      password: '',
      maxConcurrentSessions: 3,
      status: 'active',
      notes: '',
      allowApi2: false,
      api2ApiKey: '',
      api2PhoneNumbers: '',
      api2DefaultService: '',
      api2Since: 60,
      api2AllowConversion: true,
      panelType: 'primary',
      maskSensitiveBody: false,
      reports2AllowedApps: '',
      reports2StoppedClis: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: ClientAccount) => {
    triggerHapticFeedback(15);
    setEditingClient(c);
    // When editing, password starts masked with an eye toggle so Admin can view/change it
    setPasswordVisibleInModal(false);
    const wn = c.whiteNoiseConfig;
    setFormData({
      username: c.username,
      password: c.password || '',
      maxConcurrentSessions: c.maxConcurrentSessions || 3,
      status: c.status,
      notes: c.notes || '',
      allowApi2: Boolean(wn?.enabled),
      api2ApiKey: wn?.apiKey || '',
      api2PhoneNumbers: (wn?.assignedPhones || []).join(', '),
      api2DefaultService: wn?.defaultService || (wn?.allowedServices?.[0] || ''),
      api2Since: wn?.defaultSince || 60,
      api2AllowConversion: wn?.allowConversion !== false,
      panelType: c.panelType || 'primary',
      maskSensitiveBody: Boolean(c.maskSensitiveBody),
      reports2AllowedApps: (c.reports2AllowedApps || []).join(', '),
      reports2StoppedClis: (c.reports2StoppedClis || []).join(', '),
    });
    setIsModalOpen(true);
  };

  const handleUnlockClient = async (clientId: string) => {
    if (!session) return;
    triggerHapticFeedback(20);
    setActionLoadingId(clientId);
    try {
      const res = await fetch(`/api/clients/${clientId}/unlock`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (res.ok) {
        showToast('Client account unlocked immediately. Users can now sign in.', 'success');
        await fetchClients();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to unlock client', 'error');
      }
    } catch {
      showToast('Network error unlocking client', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleResetSessions = async (clientId: string) => {
    if (!session) return;
    triggerHapticFeedback(20);
    setActionLoadingId(clientId);
    try {
      const res = await fetch(`/api/clients/${clientId}/reset-sessions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        showToast(data.message || 'All active user sessions terminated.', 'success');
        await fetchClients();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to reset sessions', 'error');
      }
    } catch {
      showToast('Network error resetting sessions', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReactivateClient = async (clientId: string, username: string) => {
    if (!session) return;
    triggerHapticFeedback(15);
    setActionLoadingId(clientId);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ status: 'active' }),
      });
      if (res.ok) {
        showToast(`Client "${username}" reactivated successfully!`, 'success');
        await fetchClients();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to reactivate client', 'error');
      }
    } catch {
      showToast('Network error reactivating client', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    triggerHapticFeedback(25);

    const cleanUser = formData.username.trim();
    if (cleanUser.length < 5) {
      showToast('Client username must be at least 5 characters', 'error');
      return;
    }

    // Uniqueness validation against other existing clients
    const isDuplicate = clients.some(
      (c) => c.username.toLowerCase() === cleanUser.toLowerCase() && c.id !== editingClient?.id
    );
    if (isDuplicate) {
      showToast('Username already exists in the system. Please use a unique username.', 'error');
      return;
    }

    const cleanPass = formData.password.trim();
    if (!editingClient && cleanPass.length < 5) {
      showToast('Password must be at least 5 characters', 'error');
      return;
    }
    if (editingClient && cleanPass.length > 0 && cleanPass.length < 5) {
      showToast('Password must be at least 5 characters', 'error');
      return;
    }

    const assignedPhonesList = (formData.api2PhoneNumbers || '')
      .split(/[,;\n]+/)
      .map(p => p.trim())
      .filter(Boolean);

    // Clean payload: auto-tie backend settings cleanly
    const payload: any = {
      username: cleanUser,
      password: cleanPass,
      maxConcurrentSessions: Number(formData.maxConcurrentSessions) || 3,
      allowedServices: ['*'],
      status: formData.status || 'active',
      notes: formData.notes || '',
      sessionMinutes: settings?.clientSessionMinutes || 5,
      storageLimit: settings?.clientMaxRetention || 1000,
      panelType: formData.panelType || 'primary',
      maskSensitiveBody: Boolean(formData.maskSensitiveBody),
      reports2AllowedApps: formData.reports2AllowedApps
        ? formData.reports2AllowedApps.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean)
        : undefined,
      reports2StoppedClis: formData.reports2StoppedClis
        ? formData.reports2StoppedClis.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean)
        : undefined,
      whiteNoiseConfig: {
        enabled: Boolean(formData.allowApi2),
        apiKey: formData.api2ApiKey?.trim() || undefined,
        assignedPhones: assignedPhonesList,
        defaultPhone: assignedPhonesList.length > 0 ? assignedPhonesList[0] : undefined,
        allowedServices: formData.api2DefaultService?.trim() ? [formData.api2DefaultService.trim()] : undefined,
        defaultService: formData.api2DefaultService?.trim() || undefined,
        defaultSince: Number(formData.api2Since) || 60,
        allowConversion: Boolean(formData.api2AllowConversion),
      },
    };

    try {
      if (editingClient) {
        const res = await fetch(`/api/clients/${editingClient.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.token}`,
          },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          showToast(`Client "${formData.username}" updated successfully.`, 'success');
          setIsModalOpen(false);
          fetchClients();
        } else {
          const err = await res.json();
          showToast(err.error || 'Failed to update client', 'error');
        }
      } else {
        const res = await fetch('/api/clients', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.token}`,
          },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          showToast(`New Client "${formData.username}" created successfully.`, 'success');
          setIsModalOpen(false);
          fetchClients();
        } else {
          const err = await res.json();
          showToast(err.error || 'Failed to create client', 'error');
        }
      }
    } catch {
      showToast('Network error saving client account', 'error');
    }
  };

  const handleToggleSelect = (id: string) => {
    triggerHapticFeedback(10);
    setSelectedClientIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = (visibleIds: string[]) => {
    triggerHapticFeedback(12);
    if (selectedClientIds.size === visibleIds.length && visibleIds.length > 0) {
      setSelectedClientIds(new Set());
    } else {
      setSelectedClientIds(new Set(visibleIds));
    }
  };

  const handleOpenSingleDelete = (c: ClientAccount) => {
    triggerHapticFeedback(20);
    setDeletePinModal({
      isOpen: true,
      mode: 'single',
      targetClient: c,
      securityPin: '',
      error: null,
      isProcessing: false,
      showPin: false,
    });
  };

  const handleOpenBatchDelete = () => {
    if (selectedClientIds.size === 0) return;
    triggerHapticFeedback(20);
    setDeletePinModal({
      isOpen: true,
      mode: 'batch',
      targetClient: null,
      securityPin: '',
      error: null,
      isProcessing: false,
      showPin: false,
    });
  };

  const handleConfirmPinDelete = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!session) return;
    triggerHapticFeedback(30);

    const pin = deletePinModal.securityPin.trim();
    if (!pin) {
      setDeletePinModal((prev) => ({ ...prev, error: 'Master Security PIN is required to authorize deletion.' }));
      return;
    }

    setDeletePinModal((prev) => ({ ...prev, isProcessing: true, error: null }));

    try {
      if (deletePinModal.mode === 'single') {
        const client = deletePinModal.targetClient;
        if (!client) return;

        const res = await fetch(`/api/clients/${client.id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${session.token}`,
            'X-Security-PIN': pin,
          },
        });

        const data = await res.json();
        if (res.ok) {
          showToast(`Client "${client.username}" deleted successfully!`, 'success');
          setSelectedClientIds((prev) => {
            const next = new Set(prev);
            next.delete(client.id);
            return next;
          });
          setDeletePinModal((prev) => ({ ...prev, isOpen: false }));
          await fetchClients();
        } else {
          setDeletePinModal((prev) => ({ ...prev, error: data.error || 'Failed to delete client account.' }));
        }
      } else {
        // Batch delete
        const clientIdsArray = Array.from(selectedClientIds);
        const res = await fetch('/api/clients/batch-delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.token}`,
            'X-Security-PIN': pin,
          },
          body: JSON.stringify({ clientIds: clientIdsArray, securityPin: pin }),
        });

        const data = await res.json();
        if (res.ok) {
          showToast(`Successfully deleted ${data.deletedCount || clientIdsArray.length} client account(s)!`, 'success');
          setSelectedClientIds(new Set());
          setDeletePinModal((prev) => ({ ...prev, isOpen: false }));
          await fetchClients();
        } else {
          setDeletePinModal((prev) => ({ ...prev, error: data.error || 'Failed to delete selected clients.' }));
        }
      }
    } catch {
      setDeletePinModal((prev) => ({ ...prev, error: 'Network error communicating with server.' }));
    } finally {
      setDeletePinModal((prev) => ({ ...prev, isProcessing: false }));
    }
  };

  // Filter & Sort Pipeline
  const filteredAndSortedClients = useMemo(() => {
    let list = [...clients];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((c) => 
        c.username.toLowerCase().includes(q) || 
        (c.notes && c.notes.toLowerCase().includes(q))
      );
    }

    // A-Z Alphabetical & Numerical Filter
    if (letterFilter !== 'ALL') {
      if (letterFilter === '0-9') {
        list = list.filter((c) => /^[0-9]/.test(c.username.trim()));
      } else {
        list = list.filter((c) => c.username.trim().toUpperCase().startsWith(letterFilter));
      }
    }

    // Sort order
    list.sort((a, b) => {
      if (sortBy === 'name-asc') {
        return a.username.localeCompare(b.username, undefined, { numeric: true, sensitivity: 'base' });
      }
      if (sortBy === 'name-desc') {
        return b.username.localeCompare(a.username, undefined, { numeric: true, sensitivity: 'base' });
      }
      if (sortBy === 'num-desc') {
        return (b.createdAt || 0) - (a.createdAt || 0);
      }
      if (sortBy === 'status') {
        if (a.status === b.status) return a.username.localeCompare(b.username);
        return a.status === 'active' ? -1 : 1;
      }
      // 'num-asc' (Oldest / creation chronological order)
      return (a.createdAt || 0) - (b.createdAt || 0);
    });

    return list;
  }, [clients, searchQuery, letterFilter, sortBy]);

  const visibleIds = useMemo(() => filteredAndSortedClients.map(c => c.id), [filteredAndSortedClients]);

  return (
    <div className="space-y-5" id="admin-clients-view">
      {/* Header Banner - Emerald, White & Blue Cosmic Theme */}
      <div className="bg-slate-900/90 border border-blue-500/20 rounded-2xl p-4 sm:p-6 shadow-[0_10px_30px_rgba(2,6,23,0.7),0_0_20px_rgba(37,99,235,0.12)] flex flex-col md:flex-row md:items-center justify-between gap-4 ring-1 ring-white/5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-mono font-bold tracking-wider">
              CLIENT ACCESS CONTROL
            </span>
            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[11px] font-mono">
              A-to-Z Directory
            </span>
            <span className="px-2 py-0.5 rounded-full bg-white/10 text-white border border-white/20 text-[11px] font-mono">
              Total: {clients.length}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span>Client Management</span>
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl font-sans">
            Manage live client credentials. System automatically enforces <span className="text-emerald-400 font-semibold">{settings?.clientSessionMinutes || 5}-min session auto-timeout</span> and <span className="text-blue-400 font-semibold">3-user concurrency security lock</span>.
          </p>
        </div>

        <button
          id="btn-add-new-client"
          type="button"
          onClick={handleOpenAdd}
          className="px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-blue-600 hover:from-emerald-400 hover:to-blue-500 text-white font-black text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/40 border border-white/20 active:scale-95 shrink-0 cursor-pointer"
        >
          <UserPlus className="w-4 h-4 text-white" />
          <span>Add New Client</span>
        </button>
      </div>

      {/* Notice Banner */}
      <AnimatePresence>
        {messageNotice && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-2xl text-xs flex items-center gap-2.5 font-medium shadow-lg ${
              messageNotice.type === 'success'
                ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-200'
                : 'bg-rose-950/80 border border-rose-500/50 text-rose-200'
            }`}
          >
            {messageNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span className="font-semibold">{messageNotice.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search & A-to-Z Filtering Ribbon */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clients by username or notes..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950/90 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs px-1 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Sort Control */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-slate-300 font-semibold flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-blue-400" />
              <span>Sort:</span>
            </span>
            <select
              value={sortBy}
              onChange={(e) => {
                triggerHapticFeedback(10);
                setSortBy(e.target.value as any);
              }}
              className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-emerald-400 cursor-pointer"
            >
              <option value="name-asc">Alphabetical (A → Z)</option>
              <option value="name-desc">Alphabetical (Z → A)</option>
              <option value="num-asc">Number (#1 → #N Oldest)</option>
              <option value="num-desc">Number (#N → #1 Newest)</option>
              <option value="status">Status (Active First)</option>
            </select>
          </div>
        </div>

        {/* A-to-Z Letter Bar (Horizontally scrollable on mobile/tablet) */}
        <div className="pt-1 border-t border-slate-800/80">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-700">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
              <Filter className="w-3 h-3 text-emerald-400" />
              <span>A-Z Index:</span>
            </span>
            {ALPHABET.map((char) => {
              const isActive = letterFilter === char;
              // Check if any clients match this letter
              const hasMatches = char === 'ALL' 
                ? clients.length > 0
                : char === '0-9'
                  ? clients.some((c) => /^[0-9]/.test(c.username.trim()))
                  : clients.some((c) => c.username.trim().toUpperCase().startsWith(char));

              return (
                <button
                  key={char}
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback(10);
                    setLetterFilter(char);
                  }}
                  className={`px-2 py-1 rounded-lg text-[11px] font-mono font-bold transition-all shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-500 to-blue-600 text-white shadow-md shadow-blue-900/30 ring-1 ring-white/30 scale-105'
                      : hasMatches
                        ? 'bg-slate-950/70 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-800'
                        : 'bg-slate-950/40 text-slate-600 border border-transparent cursor-default'
                  }`}
                >
                  {char}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Clients Table Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Directory</span>
                <span className="text-xs text-slate-400 font-mono font-normal">
                  (Showing {filteredAndSortedClients.length} of {clients.length})
                </span>
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-300 font-mono">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>Session: <strong className="text-emerald-400">{settings?.clientSessionMinutes || 5}m</strong></span>
            </span>
          </div>
        </div>

        {/* Batch Selection Action Bar */}
        {selectedClientIds.size > 0 && (
          <div className="bg-gradient-to-r from-blue-950/60 via-slate-900 to-emerald-950/60 border-b border-blue-500/30 px-4 py-2.5 flex items-center justify-between flex-wrap gap-2 animate-fadeIn">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-white">
                {selectedClientIds.size} of {visibleIds.length} client(s) selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  triggerHapticFeedback(10);
                  setSelectedClientIds(new Set());
                }}
                className="px-2.5 py-1 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                Clear Selection
              </button>
              <button
                type="button"
                onClick={handleOpenBatchDelete}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-rose-950/50 transition-all active:scale-95 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected ({selectedClientIds.size}) [PIN Required]</span>
              </button>
            </div>
          </div>
        )}

        {filteredAndSortedClients.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <Users className="w-12 h-12 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-200">No client accounts match your filter</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchQuery || letterFilter !== 'ALL'
                ? 'Try clearing the search query or resetting the A-Z filter.'
                : 'Click "Add New Client" above to create client access credentials.'}
            </p>
            {(searchQuery || letterFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setLetterFilter('ALL');
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-white font-semibold transition-all cursor-pointer"
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/90 text-slate-300 border-b border-slate-800 text-[11px] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={visibleIds.length > 0 && selectedClientIds.size === visibleIds.length}
                      onChange={() => handleSelectAll(visibleIds)}
                      className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500/20 w-4 h-4 cursor-pointer"
                      title="Select / Deselect all currently visible clients"
                    />
                  </th>
                  <th className="py-3 px-3 w-12 text-center text-slate-400 font-mono">#</th>
                  <th className="py-3 px-4">Client User</th>
                  <th className="py-3 px-4">Password</th>
                  <th className="py-3 px-4">Status & Sessions</th>
                  <th className="py-3 px-4">Allowed Limit</th>
                  <th className="py-3 px-4">Last Active</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {filteredAndSortedClients.map((c, index) => {
                  const isSelected = selectedClientIds.has(c.id);
                  const isLocked = !!c.isLocked || (!!c.lockedUntil && Date.now() < c.lockedUntil);
                  const remainingSec = c.lockedUntil ? Math.max(0, Math.floor((c.lockedUntil - Date.now()) / 1000)) : 0;
                  const remMin = Math.floor(remainingSec / 60);
                  const remSec = remainingSec % 60;
                  const remTimeStr = `${remMin}m ${remSec}s`;
                  const lastSeen = formatLastSeen(c.lastActive || c.lastLoginAt);

                  return (
                    <tr 
                      key={c.id} 
                      className={`hover:bg-slate-800/50 transition-colors ${
                        isSelected ? 'bg-blue-950/30' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(c.id)}
                          className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500/20 w-4 h-4 cursor-pointer"
                        />
                      </td>

                      {/* Number Column (# 1, 2, 3...) */}
                      <td className="py-3.5 px-3 text-center font-mono font-bold text-slate-400 text-xs">
                        <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                          {index + 1}
                        </span>
                      </td>

                      {/* Username with Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-emerald-500/40 flex items-center justify-center font-bold text-white text-xs font-mono shadow-sm">
                            {c.username.slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white block font-mono text-xs tracking-wide">
                                {c.username}
                              </span>
                              {c.whiteNoiseConfig?.enabled && (
                                <span 
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-400/40 text-[9px] font-mono font-bold text-indigo-300"
                                  title="WhiteNoise API-2 (Sidebar 2) Access Granted"
                                >
                                  <Zap className="w-2.5 h-2.5 text-indigo-400" />
                                  <span>API-2</span>
                                </span>
                              )}
                              {c.panelType === 'reports2' && (
                                <span 
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-[9px] font-mono font-bold text-emerald-300"
                                  title="Assigned to Team Portal (Reports 2 - Independent Filter View)"
                                >
                                  <Shield className="w-2.5 h-2.5 text-emerald-400" />
                                  <span>Reports 2</span>
                                </span>
                              )}
                              {c.maskSensitiveBody && (
                                <span 
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/40 text-[9px] font-mono font-bold text-amber-300"
                                  title="Sensitive message body is masked [Protected] OTP: ****"
                                >
                                  <EyeOff className="w-2.5 h-2.5 text-amber-400" />
                                  <span>Masked</span>
                                </span>
                              )}
                            </div>
                            {c.notes && (
                              <span className="text-[10px] text-slate-400 block truncate max-w-xs">
                                {c.notes}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Password: STRICTLY MASKED in table (NO open eye-toggle here!) */}
                      <td className="py-3.5 px-4 font-mono">
                        <div 
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/90 border border-slate-800 text-slate-300 shadow-inner group"
                          title="Password is secure and hidden. Click 'Edit' to view or update password."
                        >
                          <Lock className="w-3 h-3 text-emerald-400" />
                          <span className="tracking-widest text-slate-300 font-bold text-xs select-none">
                            ••••••••
                          </span>
                          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-sans ml-1 bg-slate-800/80 px-1 py-0.2 rounded border border-slate-700">
                            Hidden
                          </span>
                        </div>
                      </td>

                      {/* Status & Active Sessions */}
                      <td className="py-3.5 px-4">
                        {isLocked ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                              <ShieldAlert className="w-3 h-3 text-rose-400" />
                              <span>LOCKED (4 USERS)</span>
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono text-amber-300 font-bold">
                                ⏳ {remTimeStr}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUnlockClient(c.id)}
                                disabled={actionLoadingId === c.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold transition-all cursor-pointer"
                                title="Unlock immediately"
                              >
                                <Unlock className="w-2.5 h-2.5" />
                                <span>Unlock</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  c.status === 'active'
                                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    c.status === 'active' ? 'bg-emerald-400' : 'bg-rose-400'
                                  }`}
                                />
                                <span className="uppercase">{c.status}</span>
                              </span>

                              {c.status === 'inactive' && (
                                <button
                                  type="button"
                                  onClick={() => handleReactivateClient(c.id, c.username)}
                                  disabled={actionLoadingId === c.id}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                                  title="Reactivate immediately"
                                >
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  <span>Activate</span>
                                </button>
                              )}
                            </div>

                            <div className="text-[10px] text-slate-300 font-mono flex items-center gap-1">
                              <span>Live Sessions:</span>
                              <strong className={(c.activeSessionsCount || 0) > 0 ? 'text-emerald-400' : 'text-slate-400'}>
                                {c.activeSessionsCount || 0} / {c.maxConcurrentSessions || 3}
                              </strong>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Allowed Limit */}
                      <td className="py-3.5 px-4 font-mono">
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 text-[10px] font-bold">
                            <span>Max Users: {c.maxConcurrentSessions || 3}</span>
                          </span>
                          <span className="block text-[10px] text-slate-400">
                            Session: {settings?.clientSessionMinutes || 5} min
                          </span>
                        </div>
                      </td>

                      {/* Last Active */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <span className={`text-[11px] font-semibold block ${lastSeen.isRecent ? 'text-emerald-400' : 'text-slate-300'}`}>
                            {lastSeen.relative}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono block">
                            {formatLifetimeDateTime(c.lastActive || c.lastLoginAt)}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {(c.activeSessionsCount || 0) > 0 && (
                            <button
                              type="button"
                              onClick={() => handleResetSessions(c.id)}
                              disabled={actionLoadingId === c.id}
                              className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 transition-all cursor-pointer active:scale-95"
                              title="Disconnect all active client sessions"
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleCopyClientAccess(c)}
                            className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 hover:border-emerald-500/40 transition-all cursor-pointer active:scale-95"
                            title="Copy Client Login URL & Credentials"
                          >
                            {copiedClientId === c.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Share2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(c)}
                            className="p-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/20 hover:border-blue-500/40 transition-all cursor-pointer active:scale-95"
                            title="Edit Client (View Password & Update)"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenSingleDelete(c)}
                            className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 hover:border-rose-500/40 transition-all cursor-pointer active:scale-95"
                            title="Delete Client (Requires Admin PIN)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Security Master PIN Delete Confirmation Modal */}
      <AnimatePresence>
        {deletePinModal.isOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-slate-900 border-2 border-rose-500/50 rounded-3xl p-5 sm:p-7 shadow-[0_25px_60px_rgba(0,0,0,0.9),0_0_35px_rgba(244,63,94,0.25)] space-y-4 ring-1 ring-white/10 max-h-[92vh] overflow-y-auto"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0 shadow-lg">
                  <ShieldAlert className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">
                    {deletePinModal.mode === 'single'
                      ? 'Authorize Client Deletion'
                      : `Batch Delete (${selectedClientIds.size} Clients)`}
                  </h3>
                  <p className="text-xs text-rose-300 font-mono">
                    {deletePinModal.mode === 'single'
                      ? `@${deletePinModal.targetClient?.username}`
                      : `${selectedClientIds.size} accounts selected`}
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-rose-950/50 border border-rose-500/30 rounded-2xl text-xs text-rose-200 leading-relaxed space-y-1">
                <p className="font-bold text-white">
                  Security Protection: Master Security PIN Required
                </p>
                <p className="text-slate-300 text-[11px]">
                  {deletePinModal.mode === 'single'
                    ? `Deleting client "@${deletePinModal.targetClient?.username}" will immediately revoke all sessions.`
                    : `Permanently deleting ${selectedClientIds.size} client account(s). This action cannot be undone.`}
                </p>
              </div>

              <form onSubmit={handleConfirmPinDelete} className="space-y-4 pt-1">
                <div>
                  <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-rose-400" />
                    <span>Enter Admin Security PIN</span>
                  </label>
                  <div className="relative">
                    <input
                      type={deletePinModal.showPin ? 'text' : 'password'}
                      autoFocus
                      required
                      value={deletePinModal.securityPin}
                      onChange={(e) =>
                        setDeletePinModal((prev) => ({
                          ...prev,
                          securityPin: e.target.value,
                          error: null,
                        }))
                      }
                      placeholder="Enter Master PIN (e.g. 12345)"
                      className="w-full px-4 py-3 pr-11 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setDeletePinModal((prev) => ({
                          ...prev,
                          showPin: !prev.showPin,
                        }))
                      }
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                      tabIndex={-1}
                    >
                      {deletePinModal.showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {deletePinModal.error && (
                  <div className="p-3 bg-rose-950/80 border border-rose-500/50 rounded-xl flex items-center gap-2 text-rose-200 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span className="font-semibold">{deletePinModal.error}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() =>
                      setDeletePinModal((prev) => ({ ...prev, isOpen: false }))
                    }
                    disabled={deletePinModal.isProcessing}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={deletePinModal.isProcessing || !deletePinModal.securityPin.trim()}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white text-xs font-black transition-all shadow-lg shadow-rose-950/60 flex items-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95"
                  >
                    {deletePinModal.isProcessing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying PIN...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>Confirm Delete</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CREATE / EDIT MODAL - PC TYPE & FULLY RESPONSIVE FOR MOBILE & TABLET */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 overflow-hidden">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 15 }}
            className="w-full sm:max-w-3xl lg:max-w-4xl bg-slate-900 border sm:border-2 border-blue-500/40 rounded-t-3xl sm:rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.9),0_0_35px_rgba(37,99,235,0.25)] ring-1 ring-white/10 flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden"
          >
            {/* Modal Header (Pinned / Sticky) */}
            <div className="px-5 sm:px-7 py-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/95 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-emerald-950/40 shrink-0">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                      {editingClient ? `Edit Client (@${editingClient.username})` : 'Create New Client Account'}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                      {editingClient ? `ID #${editingClient.id.slice(0, 6)}` : 'Client Access Portal'}
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-400 font-sans mt-0.5">
                    {editingClient ? 'Update login credentials, permissions, and report routing' : 'Configure client login access, WhiteNoise API-2, and team report filters'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold cursor-pointer transition-colors shrink-0"
              >
                ✕
              </button>
            </div>

            {/* FORM WRAPPER */}
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Scrollable Modal Body (Smooth Scrolling on Mobile, Tablet & PC) */}
              <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-5 space-y-5 text-xs overscroll-contain">
                
                {/* SECTION 1: PRIMARY ACCOUNT CREDENTIALS (PC 2-Column Responsive Grid) */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2.5">
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                      1
                    </div>
                    <span className="font-bold text-white text-xs uppercase tracking-wider">
                      Account Credentials & Concurrency
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Username */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="font-bold text-white uppercase tracking-wider text-[11px]">
                          Client Username
                        </label>
                        {formData.username.trim().length > 0 && (
                          clients.some(c => c.username.toLowerCase() === formData.username.trim().toLowerCase() && c.id !== editingClient?.id) ? (
                            <span className="text-[10px] font-bold text-rose-400 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Already taken!</span>
                            </span>
                          ) : formData.username.trim().length < 5 ? (
                            <span className="text-[10px] text-amber-400 font-medium">Min 5 chars</span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Available</span>
                            </span>
                          )
                        )}
                      </div>
                      <input
                        type="text"
                        required
                        minLength={5}
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        placeholder="e.g. client01"
                        className={`w-full px-3.5 py-2.5 bg-slate-900 border rounded-xl text-white font-mono text-sm transition-colors ${
                          clients.some(c => c.username.toLowerCase() === formData.username.trim().toLowerCase() && c.id !== editingClient?.id)
                            ? 'border-rose-500 focus:border-rose-400'
                            : 'border-slate-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400'
                        }`}
                      />
                    </div>

                    {/* Password */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="font-bold text-white uppercase tracking-wider text-[11px]">
                          Client Password
                        </label>
                        {formData.password.trim().length > 0 && (
                          formData.password.trim().length < 5 ? (
                            <span className="text-[10px] text-amber-400 font-medium">Min 5 chars</span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Valid</span>
                            </span>
                          )
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type={passwordVisibleInModal ? 'text' : 'password'}
                          required={!editingClient}
                          minLength={5}
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          placeholder={editingClient ? 'Leave blank to keep current' : 'Enter password (min 5 chars)'}
                          className="w-full px-3.5 py-2.5 pr-10 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-sm focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            triggerHapticFeedback(10);
                            setPasswordVisibleInModal(!passwordVisibleInModal);
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
                          title={passwordVisibleInModal ? 'Hide password' : 'Show password'}
                        >
                          {passwordVisibleInModal ? <EyeOff className="w-4 h-4 text-emerald-400" /> : <Eye className="w-4 h-4 text-slate-400" />}
                        </button>
                      </div>
                    </div>

                    {/* Concurrency Limit */}
                    <div>
                      <label className="block font-bold text-white uppercase tracking-wider text-[11px] mb-1.5">
                        Max Allowed Concurrency Limit
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          max="10"
                          required
                          value={formData.maxConcurrentSessions}
                          onChange={(e) => setFormData({ ...formData, maxConcurrentSessions: parseInt(e.target.value) || 3 })}
                          className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                        />
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-sans">
                          Users
                        </span>
                      </div>
                      <p className="text-[10px] text-blue-300 mt-1">
                        Concurrent devices/users allowed for this client ID (Default: 3 users).
                      </p>
                    </div>

                    {/* Status (In edit mode) or Session Timeout Info */}
                    {editingClient ? (
                      <div>
                        <label className="block font-bold text-white uppercase tracking-wider text-[11px] mb-1.5">
                          Account Status
                        </label>
                        <select
                          value={formData.status}
                          onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                          className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-sans text-xs focus:border-emerald-400"
                        >
                          <option value="active">Active (Permit Portal Access)</option>
                          <option value="inactive">Inactive / Suspended (Block & Kick)</option>
                        </select>
                      </div>
                    ) : (
                      <div>
                        <label className="block font-bold text-white uppercase tracking-wider text-[11px] mb-1.5">
                          Session Security
                        </label>
                        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>Auto-timeout: <strong className="text-emerald-400">{settings?.clientSessionMinutes || 5} minutes</strong> of inactivity</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Notes & Customer Reference */}
                  <div>
                    <label className="block font-bold text-white uppercase tracking-wider text-[11px] mb-1.5">
                      Customer Reference / Notes (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Optional notes, customer Skype/Telegram or contact reference"
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-sans text-xs focus:border-emerald-400"
                    />
                  </div>
                </div>

                {/* SECTION 2: API-2 / WHITENOISE DIRECT SMS (PC TYPE DESKTOP CARD) */}
                <div className="bg-gradient-to-b from-indigo-950/40 to-slate-950/80 border-2 border-indigo-500/40 rounded-2xl p-4 sm:p-5 space-y-4 shadow-inner">
                  {/* Card 2 Header */}
                  <div className="flex items-center justify-between border-b border-indigo-500/20 pb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-400 shrink-0">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] font-mono font-black uppercase tracking-wider text-indigo-400 block">
                          SECTION 2 • API-2 GATEWAY
                        </span>
                        <h4 className="text-xs sm:text-sm font-bold text-white">
                          WhiteNoise SMS (Sidebar 2 Access)
                        </h4>
                      </div>
                    </div>

                    {/* Toggle Switch */}
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.allowApi2}
                        onChange={(e) => setFormData({ ...formData, allowApi2: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      <span className="ml-2 text-xs font-bold text-white font-mono">
                        {formData.allowApi2 ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </label>
                  </div>

                  {formData.allowApi2 ? (
                    <div className="space-y-4 pt-1">
                      <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-200 text-xs flex items-center gap-2.5">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                        <span>
                          <strong>Sidebar 2 Enabled:</strong> Client will see WhiteNoise SMS tab to view direct messages and verification OTPs.
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* API Key */}
                        <div>
                          <label className="block font-bold text-white uppercase tracking-wider text-[11px] mb-1">
                            WhiteNoise API Key (12 Characters)
                          </label>
                          <input
                            type="text"
                            maxLength={64}
                            value={formData.api2ApiKey}
                            onChange={(e) => setFormData({ ...formData, api2ApiKey: e.target.value })}
                            placeholder="Leave blank for Master Key, or custom key"
                            className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs focus:border-indigo-400"
                          />
                          <p className="text-[10px] text-slate-400 mt-1">
                            {formData.api2ApiKey.trim() ? `${formData.api2ApiKey.trim().length} characters entered` : 'Empty = Uses Admin master key.'}
                          </p>
                        </div>

                        {/* Assigned Phones */}
                        <div>
                          <label className="block font-bold text-white uppercase tracking-wider text-[11px] mb-1">
                            Assigned Phone Numbers (Target Numbers)
                          </label>
                          <input
                            type="text"
                            value={formData.api2PhoneNumbers}
                            onChange={(e) => setFormData({ ...formData, api2PhoneNumbers: e.target.value })}
                            placeholder="e.g. +959686338504, +959686338505"
                            className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs focus:border-indigo-400"
                          />
                          <p className="text-[10px] text-slate-400 mt-1">
                            Comma-separated numbers client can view. Empty allows any.
                          </p>
                        </div>

                        {/* Service filter */}
                        <div>
                          <label className="block font-bold text-white uppercase tracking-wider text-[11px] mb-1">
                            Default Service Filter
                          </label>
                          <input
                            type="text"
                            value={formData.api2DefaultService}
                            onChange={(e) => setFormData({ ...formData, api2DefaultService: e.target.value })}
                            placeholder="e.g. tiktok (or empty for all)"
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-sans text-xs focus:border-indigo-400"
                          />
                        </div>

                        {/* Since window */}
                        <div>
                          <label className="block font-bold text-white uppercase tracking-wider text-[11px] mb-1">
                            Default Time Range (`since`)
                          </label>
                          <select
                            value={formData.api2Since}
                            onChange={(e) => setFormData({ ...formData, api2Since: Number(e.target.value) })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-sans text-xs focus:border-indigo-400"
                          >
                            <option value={15}>15 seconds</option>
                            <option value={30}>30 seconds</option>
                            <option value={60}>60 seconds (Default)</option>
                            <option value={120}>2 minutes</option>
                            <option value={300}>5 minutes</option>
                            <option value={600}>10 minutes (Max)</option>
                          </select>
                        </div>
                      </div>

                      {/* Conversion toggle */}
                      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                        <div>
                          <span className="text-xs font-bold text-white block">
                            Permit Conversion Registration
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Allow client to mark SMS as converted via POST /register-sms-conversion
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={formData.api2AllowConversion}
                          onChange={(e) => setFormData({ ...formData, api2AllowConversion: e.target.checked })}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-slate-700 cursor-pointer"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-400 text-xs">
                      WhiteNoise SMS access is disabled for this client.
                    </div>
                  )}
                </div>

                {/* SECTION 3: TEAM ACCESS & DATA PRIVACY (SMS REPORTS 2) */}
                <div className="bg-gradient-to-b from-emerald-950/30 to-slate-950/80 border-2 border-emerald-500/40 rounded-2xl p-4 sm:p-5 space-y-4 shadow-inner">
                  {/* Card 3 Header */}
                  <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0">
                        <Shield className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] font-mono font-black uppercase tracking-wider text-emerald-400 block">
                          SECTION 3 • TEAM SHARING & PRIVACY
                        </span>
                        <h4 className="text-xs sm:text-sm font-bold text-white">
                          SMS Reports 2 (Restricted Team Sharing)
                        </h4>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-1">
                    {/* Portal View Selection (PC 2-Column Grid) */}
                    <div>
                      <label className="block font-bold text-white uppercase tracking-wider text-[11px] mb-2">
                        Assigned Reports Portal
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label 
                          onClick={() => setFormData({ ...formData, panelType: 'primary' })}
                          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            formData.panelType === 'primary'
                              ? 'border-blue-500 bg-blue-500/15 text-white ring-1 ring-blue-500/40'
                              : 'border-slate-800 bg-slate-950/70 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <input
                            type="radio"
                            name="panelType"
                            checked={formData.panelType === 'primary'}
                            onChange={() => setFormData({ ...formData, panelType: 'primary' })}
                            className="mt-1 text-blue-500 focus:ring-0"
                          />
                          <div>
                            <div className="text-xs font-bold text-white">Primary Portal (Full Access)</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">Standard client view with full message access</div>
                          </div>
                        </label>

                        <label 
                          onClick={() => setFormData({ ...formData, panelType: 'reports2' })}
                          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            formData.panelType === 'reports2'
                              ? 'border-emerald-500 bg-emerald-500/15 text-white ring-1 ring-emerald-500/40'
                              : 'border-slate-800 bg-slate-950/70 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <input
                            type="radio"
                            name="panelType"
                            checked={formData.panelType === 'reports2'}
                            onChange={() => setFormData({ ...formData, panelType: 'reports2' })}
                            className="mt-1 text-emerald-500 focus:ring-0"
                          />
                          <div>
                            <div className="text-xs font-bold text-emerald-300">Reports 2 (Team Portal)</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">Enforces independent team stop rules & privacy</div>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Mask Sensitive Body Toggle */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                      <div>
                        <span className="text-xs font-bold text-white block flex items-center gap-1.5">
                          <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                          <span>Mask Sensitive Message Body</span>
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Replaces sensitive text with <code className="text-amber-300">[Protected] OTP: ****</code> to protect customer payload data from team members
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.maskSensitiveBody}
                        onChange={(e) => setFormData({ ...formData, maskSensitiveBody: e.target.checked })}
                        className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-slate-700 cursor-pointer"
                      />
                    </div>

                    {/* Optional Allowed Apps & Stopped CLIs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-bold text-white uppercase tracking-wider text-[11px] mb-1">
                          Reports 2 Allowed Apps
                        </label>
                        <input
                          type="text"
                          value={formData.reports2AllowedApps}
                          onChange={(e) => setFormData({ ...formData, reports2AllowedApps: e.target.value })}
                          placeholder="e.g. WHATSAPP, TELEGRAM (or empty for all)"
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-sans text-xs focus:border-emerald-400"
                        />
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Only these apps will be visible in Reports 2.
                        </p>
                      </div>

                      <div>
                        <label className="block font-bold text-white uppercase tracking-wider text-[11px] mb-1">
                          Reports 2 Specific Stopped CLIs
                        </label>
                        <input
                          type="text"
                          value={formData.reports2StoppedClis}
                          onChange={(e) => setFormData({ ...formData, reports2StoppedClis: e.target.value })}
                          placeholder="e.g. CLI1, CLI2, 959... (comma-separated)"
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-sans text-xs focus:border-rose-400"
                        />
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          These CLIs are stopped specifically for this client.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Form Action Buttons (Sticky at bottom, accessible on mobile & PC) */}
              <div className="px-5 sm:px-7 py-3.5 border-t border-slate-800 shrink-0 bg-slate-900/95 backdrop-blur-md flex items-center justify-between gap-3">
                <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Credentials stored with AES-256-GCM encryption</span>
                </div>
                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-blue-600 hover:from-emerald-400 hover:to-blue-500 text-white text-xs font-black shadow-lg shadow-emerald-950/40 border border-white/20 cursor-pointer active:scale-95 transition-all"
                  >
                    {editingClient ? 'Save Changes' : 'Create Client'}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};
