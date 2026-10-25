import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Radio, 
  Clock, 
  LogOut, 
  Search, 
  Copy, 
  Check, 
  RefreshCw, 
  Download, 
  ShieldAlert, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  Globe, 
  SlidersHorizontal, 
  Layers, 
  ZoomOut, 
  List, 
  LayoutGrid, 
  Phone,
  Sparkles,
  Filter,
  MessageSquare,
  KeyRound,
  Hash,
  Trash2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { BrandLogo } from '../common/BrandLogo';
import { ThemeToggle } from '../common/ThemeToggle';
import { THEMES } from '../../utils/theme';
import { resolveCountryName, resolveRangeName, formatDateTime } from '../../utils/countryLookup';
import type { SmsMessage, Partition, NumberRange } from '../../types';

function getRelativeTime(timestamp: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 5) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

function extractQuickOtp(msgText: string): string | null {
  if (!msgText) return null;
  const match = msgText.match(/(?:code|otp|verification|pin|password|is|secret)[\s:]*([0-9]{4,8})/i) ||
                msgText.match(/(?:code|otp|verification|pin|password)[\s:]*([0-9]{3}-[0-9]{3})/i) ||
                msgText.match(/\b([0-9]{4,8})\b/);
  return match ? match[1] : null;
}

export const ClientLiveSMS: React.FC = () => {
  const { session, logout, formattedTimeRemaining, timeRemaining, isExpiringSoon, settings } = useAuth();
  const theme = settings?.theme ? THEMES[settings.theme] : THEMES.emerald;

  // Custom SMS Table & Font Color Styling from Settings
  const customSmsBg = settings?.smsTableBgColor;
  const customSmsText = settings?.smsTextColor;
  const customSmsBorder = settings?.smsBorderColor;
  const customFontSize = settings?.smsFontSize;

  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [partitions, setPartitions] = useState<Partition[]>([]);
  const [ranges, setRanges] = useState<NumberRange[]>([]);
  const [selectedPart, setSelectedPart] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('all');
  const [selectedCli, setSelectedCli] = useState('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Zoom / Density Mode for Mobile & Desktop (Normal, Compact Zoom Out, Ultra Compact)
  const [zoomMode, setZoomMode] = useState<'normal' | 'compact' | 'ultra'>('compact');
  // View Layout Mode (Pro Table vs Mobile Cards)
  const [viewFormat, setViewFormat] = useState<'table' | 'cards'>('table');
  
  // Pagination State - 25 rows per page default
  const [rowsPerPage, setRowsPerPage] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);
  
  const previousMessageCount = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchPartitions = useCallback(async () => {
    if (!session) return;
    try {
      const res = await fetch('/api/partitions', {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const parts: Partition[] = data.partitions || [];
        setPartitions(parts);
        setSelectedPart((prev) => {
          if (!prev || prev === 'all' || !parts.some((p) => p.id === prev)) {
            return parts[0]?.id || '1';
          }
          return prev;
        });
      }
    } catch {
      // Ignore
    }
  }, [session]);

  const fetchLiveMessages = useCallback(async (manual = false) => {
    if (!session) return;
    if (manual) setIsRefreshing(true);

    try {
      // Abort previous in-flight request if still pending to prevent piling up over slow VPN
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const queryPart = selectedPart && selectedPart !== 'all' ? `&part=${encodeURIComponent(selectedPart)}` : '';
      const clientBoxLimit = session?.storageLimit || settings?.clientMaxRetention || 500;
      const res = await fetch(`/api/sms?limit=${clientBoxLimit}${queryPart}`, {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        signal: controller.signal,
      });

      if (res.status === 401 || res.status === 403) {
        logout('Session terminated: Your client access has expired or was revoked by admin.');
        return;
      }

      if (res.ok) {
        const data = await res.json();
        const rawMsgs: SmsMessage[] = data.messages || [];
        const newMsgs = rawMsgs.filter((m) => !m.isClientBlocked).slice(0, clientBoxLimit);
        setMessages((prev) => {
          if (prev.length === newMsgs.length && prev[0]?.id === newMsgs[0]?.id) {
            return prev;
          }
          previousMessageCount.current = newMsgs.length;
          return newMsgs;
        });
      }
    } catch {
      // Ignore network hiccup / VPN route change gracefully
    } finally {
      if (manual) setIsRefreshing(false);
    }
  }, [session, logout, selectedPart, settings?.clientMaxRetention]);

  useEffect(() => {
    fetchPartitions();
    // Poll partitions every 25 seconds
    const partInterval = setInterval(() => { if (!document.hidden) fetchPartitions(); }, 60000);
    return () => clearInterval(partInterval);
  }, [fetchPartitions]);

  useEffect(() => {
    if (!session) return;
    fetch('/api/ranges', {
      headers: { Authorization: `Bearer ${session.token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.ranges) setRanges(data.ranges);
      })
      .catch(() => {});
  }, [session]);

  useEffect(() => {
    if (!selectedPart || !session) return;
    fetchLiveMessages();

    // Resilient adaptive polling: 15s gentle reconciliation when SSE is healthy, 4s fallback if SSE is disconnected
    let isSseConnected = false;
    let pollInterval = 15000;
    let interval: NodeJS.Timeout | null = null;

    const startPollTimer = (ms: number) => {
      if (interval) clearInterval(interval);
      pollInterval = ms;
      interval = setInterval(() => {
        fetchLiveMessages();
      }, ms);
    };

    startPollTimer(15000);

    // Instant 0ms Server-Sent Events (SSE) stream listener for real-time live SMS ingestion
    let eventSource: EventSource | null = null;
    try {
      const sseUrl = `/api/sms/stream?token=${encodeURIComponent(session.token)}&part=${encodeURIComponent(selectedPart)}`;
      eventSource = new EventSource(sseUrl);

      eventSource.onopen = () => {
        isSseConnected = true;
        if (pollInterval !== 15000) startPollTimer(15000);
      };

      eventSource.onerror = () => {
        isSseConnected = false;
        if (pollInterval !== 4000) startPollTimer(4000);
      };

      eventSource.addEventListener('new_sms', (event) => {
        try {
          const newMsg: SmsMessage = JSON.parse(event.data);
          if (newMsg && newMsg.id && !newMsg.isClientBlocked) {
            const clientBoxLimit = session?.storageLimit || settings?.clientMaxRetention || 500;
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [newMsg, ...prev].slice(0, clientBoxLimit);
            });
          }
        } catch {
          // Ignore
        }
      });

      eventSource.addEventListener('clear_logs', (event) => {
        try {
          const clearData = JSON.parse(event.data);
          if (clearData.target === 'client' || clearData.target === 'all') {
            setMessages([]);
            setCurrentPage(1);
          }
        } catch {
          // Ignore
        }
      });
    } catch {
      startPollTimer(4000);
    }

    // When tab becomes active again or network reconnects from VPN, refresh feed immediately
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchLiveMessages();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleVisibility);

    return () => {
      if (interval) clearInterval(interval);
      if (eventSource) {
        eventSource.close();
      }
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleVisibility);
    };
  }, [fetchLiveMessages, selectedPart, session]);

  const handleClientClearLogs = async () => {
    if (!session) return;
    try {
      setMessages([]);
      setCurrentPage(1);
      const url = selectedPart ? `/api/client/sms/clear?part=${encodeURIComponent(selectedPart)}` : '/api/client/sms/clear';
      await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.token}` },
      });
    } catch {
      // Ignore
    }
  };

  const handleCopyContent = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(`content-${id}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper to match message against active selected partition
  const matchesPartition = (m: SmsMessage, partFilter: string): boolean => {
    if (!partFilter || partFilter === 'all') return true;
    const target = partFilter.toLowerCase();
    const mPartId = String(m.partId || '').toLowerCase();
    const mPart = String(m.part || '').toLowerCase();
    const mPartName = String(m.partName || '').toLowerCase();

    if (target === '1' || target === 'part_1') {
      return mPartId === 'part_1' || mPartId === '1' || mPart === '1' || mPartName.includes('part 1');
    }
    if (target === '2' || target === 'part_2') {
      return mPartId === 'part_2' || mPartId === '2' || mPart === '2' || mPartName.includes('part 2');
    }

    return mPartId === target || mPartName === target || mPart === target;
  };

  // Distinct ranges & CLIs based on active partition filter
  const partFiltered = messages.filter((m) => matchesPartition(m, selectedPart));

  const availableRanges: string[] = Array.from(
    new Set<string>(partFiltered.map((m) => (m.rangeName || resolveRangeName(m.country, m.phone, ranges)).trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));

  const availableClis = Array.from(
    new Set(partFiltered.map((m) => (m.cli || m.service || m.sender || '').trim()).filter(Boolean))
  ).sort();

  const rangeClis = selectedCountry === 'all'
    ? availableClis
    : Array.from(
        new Set(
          partFiltered
            .filter((m) => (m.rangeName || resolveRangeName(m.country, m.phone, ranges)).toLowerCase() === selectedCountry.toLowerCase())
            .map((m) => (m.cli || m.service || m.sender || '').trim())
            .filter(Boolean)
        )
      ).sort();

  // Filtered Messages
  const filteredMessages = partFiltered.filter((m) => {
    const rangeName = (m.rangeName || resolveRangeName(m.country, m.phone, ranges)).trim();
    const cli = (m.cli || m.service || m.sender || '').trim();

    const matchesCountry = selectedCountry === 'all' || rangeName.toLowerCase() === selectedCountry.toLowerCase();
    const matchesCli = selectedCli === 'all' || cli.toLowerCase() === selectedCli.toLowerCase();

    const q = searchQuery.toLowerCase().trim();
    if (!q) return matchesCountry && matchesCli;

    const matchesQuery =
      m.phone.toLowerCase().includes(q) ||
      rangeName.toLowerCase().includes(q) ||
      cli.toLowerCase().includes(q) ||
      m.sender.toLowerCase().includes(q) ||
      m.service.toLowerCase().includes(q) ||
      m.message.toLowerCase().includes(q) ||
      Boolean(m.otp && m.otp.toLowerCase().includes(q));

    return matchesCountry && matchesCli && matchesQuery;
  });

  // Calculate 25-line pagination
  const totalEntries = filteredMessages.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / rowsPerPage));
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalEntries);
  const paginatedMessages = filteredMessages.slice(startIndex, endIndex);

  // Active partition label
  const activePartitionObj = partitions.find((p) => p.id === selectedPart);
  const activePartitionLabel = activePartitionObj?.name || 'Selected Stream';

  // Export to CSV helper
  const handleExportCsv = () => {
    if (filteredMessages.length === 0) return;
    const headers = ['Date & Time', 'Range', 'Mobile Number', 'CLI', 'SMS Content'];
    const rows = filteredMessages.map((m) => [
      `"${formatDateTime(m.timestamp)}"`,
      `"${m.rangeName || resolveRangeName(m.country, m.phone, ranges)}"`,
      `"${m.phone}"`,
      `"${m.cli || m.service || m.sender}"`,
      `"${m.message.replace(/"/g, '""')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const safeName = activePartitionLabel.toLowerCase().replace(/[^a-z0-9]/g, '_');
    link.setAttribute('download', `live_sms_${safeName}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation Bar with Countdown Timer (Distraction-Free Clean Live SMS View) */}
      <header className="sticky top-0 z-40 bg-slate-900/90 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-xl text-xs font-black bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 font-mono tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>LIVE SMS FEED</span>
            </span>
          </div>

          {/* Session Timer & Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Countdown Session Timer */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition-colors ${
                isExpiringSoon
                  ? 'bg-rose-950/80 border-rose-500/50 text-rose-300 animate-pulse'
                  : 'bg-slate-950 border-slate-800 text-slate-300'
              }`}
              title="Automatic session auto-logout countdown (5 minutes strict)"
            >
              <Clock className={`w-3.5 h-3.5 ${isExpiringSoon ? 'text-rose-400' : 'text-emerald-400'}`} />
              <span className="hidden xs:inline text-slate-400 font-sans font-normal">Session:</span>
              <span className="text-white font-mono">{formattedTimeRemaining}</span>
            </div>

            {/* Dark & Sun Theme Mode Toggle */}
            <ThemeToggle size="sm" />

            {/* Logout Button */}
            <button
              id="btn-client-logout"
              type="button"
              onClick={() => logout('Logged out successfully')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 text-xs font-semibold transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Warning bar when <= 60 seconds left */}
        <AnimatePresence>
          {isExpiringSoon && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-rose-600 text-white text-xs px-4 py-1 text-center font-medium flex items-center justify-center gap-2"
            >
              <ShieldAlert className="w-3.5 h-3.5 animate-bounce" />
              <span>Security notice: Your session is ending in {timeRemaining} seconds!</span>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Stream Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 space-y-4" id="client-live-sms-container">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
                <Radio className={`w-6 h-6 ${theme.primaryText} animate-pulse`} />
                <span>Live SMS Stream</span>
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>LIVE SYNC</span>
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Active Stream: <strong className="text-emerald-400 font-bold">{activePartitionLabel}</strong> (Only APIs assigned to this partition stream are displayed).
            </p>
          </div>

          {/* Action Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Refresh Button */}
            <button
              id="btn-client-refresh-sms"
              type="button"
              onClick={() => fetchLiveMessages(true)}
              disabled={isRefreshing}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition-all cursor-pointer"
              title="Refresh feed"
            >
              <RefreshCw className={`w-4 h-4 text-slate-400 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Export CSV */}
            <button
              id="btn-client-export-csv"
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition-all cursor-pointer"
              title="Export filtered records to CSV"
            >
              <Download className="w-4 h-4 text-slate-400" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            {/* Clear Logs Button (Only clears client view, Admin keeps all master logs) */}
            <button
              id="btn-client-clear-sms"
              type="button"
              onClick={handleClientClearLogs}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-800/60 text-xs font-semibold text-slate-300 hover:text-rose-300 flex items-center gap-1.5 transition-all cursor-pointer"
              title="Clear your stream view"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span className="hidden sm:inline">Clear Logs</span>
            </button>
          </div>
        </div>

        {/* Stream / Partition Switcher Bar - Strictly Individual Named Partitions */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 sm:p-3 shadow-xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold flex items-center gap-1.5 pl-2 pr-1">
              <Layers className="w-4 h-4 text-blue-400" />
              <span>Select Stream:</span>
            </span>

            {/* DYNAMIC PARTITIONS BUTTONS */}
            {partitions.map((part) => {
              const count = messages.filter((m) => matchesPartition(m, part.id)).length;
              const isSelected = selectedPart === part.id;
              return (
                <button
                  key={part.id}
                  type="button"
                  onClick={() => {
                    setSelectedPart(part.id);
                    setCurrentPage(1);
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-500/20 border border-indigo-500/50'
                      : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                  }`}
                >
                  <span>{part.name}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    isSelected ? 'bg-indigo-950 text-indigo-200' : 'bg-slate-900 text-slate-400'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 pr-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Active: <strong className="text-white">{activePartitionLabel}</strong></span>
          </div>
        </div>

        {/* Filter Toolbar (Search + Country + CLI Dropdowns + Zoom Out & View Switches) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xl space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Box */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="input-client-search-sms"
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={`Search in ${activePartitionLabel} by Mobile, Range, CLI, or SMS text...`}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500 font-sans"
              />
            </div>

            {/* Quick Zoom & View Mode Switcher for Mobile & Desktop */}
            <div className="flex items-center gap-1.5 self-end md:self-auto flex-wrap">
              {/* View Mode Toggle: Pro Table vs Cards */}
              <div className="flex items-center bg-slate-950 p-0.5 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setViewFormat('table')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    viewFormat === 'table'
                      ? 'bg-slate-800 text-emerald-400 shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Pro Table View (Structured Separate Columns)"
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Pro Table</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewFormat('cards')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                    viewFormat === 'cards'
                      ? 'bg-slate-800 text-emerald-400 shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Mobile Cards View (Easy phone reading)"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Cards</span>
                </button>
              </div>

              {/* Zoom Out / Density Switcher */}
              <div className="flex items-center bg-slate-950 p-0.5 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setZoomMode('normal')}
                  className={`px-2 py-1 rounded-lg text-[11px] font-mono transition-all cursor-pointer ${
                    zoomMode === 'normal'
                      ? 'bg-emerald-950/80 text-emerald-400 font-bold border border-emerald-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="100% Standard Scale"
                >
                  100%
                </button>
                <button
                  type="button"
                  onClick={() => setZoomMode('compact')}
                  className={`px-2 py-1 rounded-lg text-[11px] font-mono transition-all cursor-pointer ${
                    zoomMode === 'compact'
                      ? 'bg-emerald-950/80 text-emerald-400 font-bold border border-emerald-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="90% Compact Zoom Out"
                >
                  90%
                </button>
                <button
                  type="button"
                  onClick={() => setZoomMode('ultra')}
                  className={`px-2 py-1 rounded-lg text-[11px] font-mono transition-all cursor-pointer flex items-center gap-0.5 ${
                    zoomMode === 'ultra'
                      ? 'bg-emerald-950/80 text-emerald-400 font-bold border border-emerald-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="80% Ultra Zoom Out (Best for Mobile Screens)"
                >
                  <ZoomOut className="w-3 h-3" />
                  <span>80%</span>
                </button>
              </div>
            </div>
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
            <div className="flex flex-wrap items-center gap-2">
              {/* Range Filter */}
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <select
                  value={selectedCountry}
                  onChange={(e) => {
                    setSelectedCountry(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-transparent text-slate-300 font-semibold text-xs focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-slate-900 text-white">All Ranges ({availableRanges.length})</option>
                  {availableRanges.map((r) => (
                    <option key={r} value={r} className="bg-slate-900 text-white">
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {/* CLI Filter */}
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                <SlidersHorizontal className="w-3.5 h-3.5 text-sky-400" />
                <select
                  value={selectedCli}
                  onChange={(e) => {
                    setSelectedCli(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-transparent text-slate-300 font-semibold text-xs focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-slate-900 text-white">
                    {selectedCountry !== 'all' ? `CLIs for ${selectedCountry} (${rangeClis.length})` : `All CLIs (${availableClis.length})`}
                  </option>
                  {(selectedCountry !== 'all' ? rangeClis : availableClis).map((cli) => (
                    <option key={cli} value={cli} className="bg-slate-900 text-white">
                      {cli}
                    </option>
                  ))}
                  {selectedCountry !== 'all' && availableClis.length > rangeClis.length && (
                    <optgroup label="Other Available CLIs" className="bg-slate-950 text-slate-400">
                      {availableClis
                        .filter((c) => !rangeClis.includes(c))
                        .map((cli) => (
                          <option key={cli} value={cli} className="bg-slate-900 text-white">
                            {cli}
                          </option>
                        ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* Rows Per Page Selector */}
              <div className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono">
                <span className="text-slate-500">Rows:</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-transparent text-emerald-400 font-bold text-xs focus:outline-none cursor-pointer"
                >
                  <option value={10} className="bg-slate-900 text-white">10 / page</option>
                  <option value={25} className="bg-slate-900 text-white">25 / page</option>
                  <option value={50} className="bg-slate-900 text-white">50 / page</option>
                  <option value={100} className="bg-slate-900 text-white">100 / page</option>
                </select>
              </div>
            </div>

            <div className="text-xs text-slate-400 font-mono px-2.5 py-1 bg-slate-950/80 rounded-lg border border-slate-800">
              {totalEntries} records
            </div>
          </div>

          {/* Active Filters Pill Bar */}
          {(selectedCountry !== 'all' || selectedCli !== 'all' || searchQuery) && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/60 text-xs">
              <span className="text-slate-400 flex items-center gap-1 font-semibold text-[11px]">
                <Filter className="w-3.5 h-3.5 text-emerald-400" /> Active Filters:
              </span>
              {selectedCountry !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-semibold text-[11px]">
                  <span>Range: {selectedCountry}</span>
                  <button
                    type="button"
                    onClick={() => { setSelectedCountry('all'); setCurrentPage(1); }}
                    className="hover:text-rose-400 cursor-pointer ml-1 text-slate-400 hover:text-white"
                    title="Clear range filter"
                  >
                    ✕
                  </button>
                </span>
              )}
              {selectedCli !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-sky-950/80 border border-sky-500/40 text-sky-300 font-semibold text-[11px]">
                  <span>CLI: {selectedCli}</span>
                  <button
                    type="button"
                    onClick={() => { setSelectedCli('all'); setCurrentPage(1); }}
                    className="hover:text-rose-400 cursor-pointer ml-1 text-slate-400 hover:text-white"
                    title="Clear CLI filter"
                  >
                    ✕
                  </button>
                </span>
              )}
              {searchQuery && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-indigo-950/80 border border-indigo-500/40 text-indigo-300 font-semibold text-[11px]">
                  <span>Search: "{searchQuery}"</span>
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
                    className="hover:text-rose-400 cursor-pointer ml-1 text-slate-400 hover:text-white"
                    title="Clear search query"
                  >
                    ✕
                  </button>
                </span>
              )}
              <span className="text-[11px] font-mono text-emerald-400 font-bold ml-1">
                ({totalEntries} matching SMS found)
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedCountry('all');
                  setSelectedCli('all');
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="ml-auto text-[10.5px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer font-mono transition-colors"
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>

        {/* Main Content Area: Mobile Cards Mode OR Pro Table Mode */}
        {viewFormat === 'cards' ? (
          /* Mobile Cards Mode: Specially formatted for phone screens */
          <div className="space-y-2.5" id="client-recent-sms-cards-view">
            {paginatedMessages.length === 0 ? (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 text-center space-y-2">
                <Radio className="w-8 h-8 text-slate-600 mx-auto animate-pulse" />
                <p className="text-sm font-semibold text-slate-300">
                  No live SMS entries found in {activePartitionLabel}
                </p>
                <p className="text-xs text-slate-500">
                  Incoming messages will stream in real-time.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {paginatedMessages.map((msg) => {
                  const rangeName = msg.rangeName || resolveRangeName(msg.country, msg.phone, ranges);
                  const cliName = msg.cli || msg.service || msg.sender;
                  const dateStr = formatDateTime(msg.timestamp);

                  return (
                    <div
                      key={msg.id}
                      style={customSmsBg ? { backgroundColor: customSmsBg, borderColor: customSmsBorder || undefined } : undefined}
                      className={`border rounded-2xl p-3 sm:p-3.5 shadow-lg space-y-2 transition-all ${
                        !customSmsBg && 'bg-slate-900/95'
                      } ${!customSmsBorder ? 'border-slate-800 hover:border-slate-700' : ''}`}
                    >
                      {/* Card Header: Range & CLI + Date */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 tracking-wide shadow-sm">
                            <Layers className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="font-extrabold">{rangeName}</span>
                          </span>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-black bg-sky-950/90 text-sky-300 border border-sky-500/40 font-mono tracking-wider shadow-sm">
                            <span className="font-extrabold">{cliName}</span>
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{dateStr}</span>
                        </div>
                      </div>

                      {/* Phone Number Bar */}
                      <div
                        style={customSmsBg ? { backgroundColor: customSmsBg === '#ffffff' ? '#f8fafc' : 'rgba(0,0,0,0.3)', borderColor: customSmsBorder || undefined } : undefined}
                        className="flex items-center justify-between bg-slate-950/80 px-2.5 py-1.5 rounded-xl border border-slate-800/80"
                      >
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-emerald-400" />
                          <span
                            style={customSmsText ? { color: customSmsText } : undefined}
                            className="font-mono font-bold text-white text-xs sm:text-sm tracking-wide select-all"
                          >
                            {msg.phone || (msg as any).num || (msg as any).number || 'N/A'}
                          </span>
                        </div>
                      </div>

                      {/* SMS Content Box */}
                      <div
                        style={customSmsBg ? { backgroundColor: customSmsBg === '#ffffff' ? '#f1f5f9' : 'rgba(0,0,0,0.3)', borderColor: customSmsBorder || undefined } : undefined}
                        className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60 flex items-start justify-between gap-2"
                      >
                        <p
                          style={customSmsText ? { color: customSmsText } : undefined}
                          className={`${
                            customFontSize === 'large'
                              ? 'text-sm'
                              : customFontSize === 'compact'
                              ? 'text-[11px]'
                              : 'text-xs'
                          } text-slate-200 leading-relaxed font-sans select-text break-words flex-1`}
                        >
                          {msg.message}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Pro-Level Table Mode with Separate Distinct Columns */
          <div
            style={customSmsBg ? { backgroundColor: customSmsBg, borderColor: customSmsBorder || undefined } : undefined}
            className="bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
            id="client-recent-sms-pro-table-wrapper"
          >
            <div className="overflow-x-auto">
              <table
                style={customSmsBg ? { backgroundColor: customSmsBg } : undefined}
                className={`w-full text-left border-collapse ${
                  zoomMode === 'ultra'
                    ? 'text-[10px]'
                    : zoomMode === 'compact'
                    ? 'text-[11.5px]'
                    : 'text-xs'
                }`}
                id="client-recent-sms-status-table"
              >
                <thead>
                  <tr
                    style={customSmsBorder ? { borderColor: customSmsBorder } : undefined}
                    className="bg-slate-950 text-slate-300 uppercase tracking-wider font-bold border-b-2 border-slate-800 text-[11px]"
                  >
                    {/* COLUMN 1: DATE & TIME */}
                    <th className={`${zoomMode === 'ultra' ? 'py-2.5 px-2.5' : 'py-3.5 px-3.5'} font-bold whitespace-nowrap border-r border-slate-800/80 w-[165px]`}>
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>DATE & TIME</span>
                      </div>
                    </th>

                    {/* COLUMN 2: RANGE */}
                    <th className={`${zoomMode === 'ultra' ? 'py-2.5 px-2.5' : 'py-3.5 px-3.5'} font-bold whitespace-nowrap border-r border-slate-800/80 w-[155px]`}>
                      <div className="flex items-center gap-1.5 text-emerald-400">
                        <Layers className="w-3.5 h-3.5 text-emerald-400" />
                        <span>RANGES</span>
                      </div>
                    </th>

                    {/* COLUMN 3: MOBILE NUMBER */}
                    <th className={`${zoomMode === 'ultra' ? 'py-2.5 px-2.5' : 'py-3.5 px-3.5'} font-bold whitespace-nowrap border-r border-slate-800/80 w-[185px]`}>
                      <div className="flex items-center gap-1.5 text-sky-400">
                        <Phone className="w-3.5 h-3.5 text-sky-400" />
                        <span>MOBILE NUMBER</span>
                      </div>
                    </th>

                    {/* COLUMN 4: CLI */}
                    <th className={`${zoomMode === 'ultra' ? 'py-2.5 px-2.5' : 'py-3.5 px-3.5'} font-bold whitespace-nowrap border-r border-slate-800/80 w-[135px]`}>
                      <div className="flex items-center gap-1.5 text-indigo-400">
                        <span>CLI</span>
                      </div>
                    </th>

                    {/* COLUMN 5: SMS */}
                    <th className={`${zoomMode === 'ultra' ? 'py-2.5 px-2.5' : 'py-3.5 px-3.5'} font-bold min-w-[300px]`}>
                      <div className="flex items-center gap-1.5 text-amber-400">
                        <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                        <span>SMS</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody
                  style={customSmsBorder ? { borderColor: customSmsBorder } : undefined}
                  className="divide-y divide-slate-800/70 font-sans"
                >
                  {paginatedMessages.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-14 text-center text-slate-400 space-y-2">
                        <Radio className="w-9 h-9 text-slate-600 mx-auto animate-pulse" />
                        <p className="text-sm font-semibold text-slate-300">
                          No live SMS entries found in {activePartitionLabel}
                        </p>
                        <p className="text-xs text-slate-500">
                          Incoming messages will populate this table automatically in real-time.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    paginatedMessages.map((msg) => {
                      const rangeName = msg.rangeName || resolveRangeName(msg.country, msg.phone, ranges);
                      const cliName = (msg.cli || msg.service || msg.sender || 'Direct').trim();
                      const dateStr = formatDateTime(msg.timestamp);
                      const relativeTime = getRelativeTime(msg.timestamp);
                      const extractedOtp = extractQuickOtp(msg.message);
                      const isRecent = Date.now() - msg.timestamp < 30000;

                      return (
                        <tr
                          key={msg.id}
                          style={customSmsBorder ? { borderColor: customSmsBorder } : undefined}
                          className={`hover:bg-slate-800/50 transition-colors group ${
                            isRecent ? 'bg-emerald-500/5 ring-1 ring-inset ring-emerald-500/20' : ''
                          }`}
                        >
                          {/* COLUMN 1: DATE & TIME */}
                          <td
                            className={`${
                              zoomMode === 'ultra' ? 'py-2.5 px-2.5' : 'py-3.5 px-3.5'
                            } text-slate-300 whitespace-nowrap font-mono border-r border-slate-800/70`}
                          >
                            <div className="flex flex-col">
                              <span className="font-semibold text-white text-[11px] tracking-tight">{dateStr}</span>
                              <span className="text-[9.5px] text-slate-400 flex items-center gap-1 mt-0.5">
                                {isRecent ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    {relativeTime}
                                  </span>
                                ) : (
                                  <span>{relativeTime}</span>
                                )}
                              </span>
                            </div>
                          </td>

                          {/* COLUMN 2: RANGE */}
                          <td
                            className={`${
                              zoomMode === 'ultra' ? 'py-2.5 px-2.5' : 'py-3.5 px-3.5'
                            } whitespace-nowrap border-r border-slate-800/70`}
                          >
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 shadow-sm tracking-wide">
                              <Layers className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="font-extrabold">{rangeName}</span>
                            </span>
                          </td>

                          {/* COLUMN 3: MOBILE NUMBER */}
                          <td
                            className={`${
                              zoomMode === 'ultra' ? 'py-2.5 px-2.5' : 'py-3.5 px-3.5'
                            } whitespace-nowrap border-r border-slate-800/70`}
                          >
                            <span
                              style={customSmsText ? { color: customSmsText } : undefined}
                              className="font-mono font-bold text-white text-xs sm:text-[13px] tracking-wide select-all"
                            >
                              {msg.phone || (msg as any).num || (msg as any).number || 'N/A'}
                            </span>
                          </td>

                          {/* COLUMN 4: CLI */}
                          <td
                            className={`${
                              zoomMode === 'ultra' ? 'py-2.5 px-2.5' : 'py-3.5 px-3.5'
                            } whitespace-nowrap border-r border-slate-800/70`}
                          >
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black bg-sky-950/80 text-sky-300 border border-sky-500/50 font-mono shadow-sm tracking-wider">
                              <span className="truncate max-w-[130px] font-extrabold">{cliName}</span>
                            </span>
                          </td>

                          {/* COLUMN 5: SMS */}
                          <td
                            className={`${
                              zoomMode === 'ultra' ? 'py-2.5 px-2.5' : 'py-3.5 px-3.5'
                            } text-slate-200 leading-relaxed`}
                          >
                            <p
                              style={customSmsText ? { color: customSmsText } : undefined}
                              className={`${
                                customFontSize === 'large'
                                  ? 'text-sm'
                                  : customFontSize === 'compact'
                                  ? 'text-[11px]'
                                  : 'text-xs'
                              } text-slate-200 font-sans select-text break-words leading-relaxed`}
                            >
                              {msg.message}
                            </p>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 25-line Pagination Navigation Footer */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-2xl px-4 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2 font-sans font-mono text-center sm:text-left">
            <span>
              Showing <strong className="text-white">{totalEntries > 0 ? startIndex + 1 : 0}</strong> to{' '}
              <strong className="text-white">{endIndex}</strong> of{' '}
              <strong className="text-white">{totalEntries}</strong> entries
              <span className="ml-2 text-indigo-400 font-sans">
                ({activePartitionLabel})
              </span>
            </span>
          </div>

          {/* Page Navigator */}
          <div className="flex items-center gap-1">
            {/* First Page */}
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="First Page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>

            {/* Prev Page */}
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-lg font-mono text-white font-bold">
              Page {currentPage} of {totalPages}
            </span>

            {/* Next Page */}
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Last Page */}
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Last Page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ClientLiveSMS;
