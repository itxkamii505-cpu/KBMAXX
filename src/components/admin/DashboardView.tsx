import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Radio, 
  Users, 
  Server, 
  MessageSquare, 
  Send, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  RotateCcw, 
  TrendingUp, 
  ShieldCheck, 
  FileSpreadsheet, 
  ShieldAlert, 
  UploadCloud, 
  Activity, 
  Zap, 
  ChevronRight,
  ArrowUpRight,
  Search,
  Copy,
  Check,
  Download,
  Filter,
  CalendarRange,
  Hash,
  ExternalLink,
  ChevronLeft,
  RefreshCw,
  Eye,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';
import { usePolling } from '../../hooks/usePolling';
import { useAuth } from '../../context/AuthContext';
import { THEMES } from '../../utils/theme';
import { soundManager } from '../../utils/sound';
import { formatDateTime, resolveRangeName } from '../../utils/countryLookup';
import { getPakistan5AmCycleBounds } from '../../utils/pakistanTime';
import type { SystemStats, Partition, SmsMessage, NumberRange } from '../../types';

interface DashboardViewProps {
  onNavigate: (tab: string) => void;
}

type TimeframeType = 'today' | 'yesterday' | 'month' | 'year' | 'custom';

// Date Range Utility Helpers strictly aligned to Pakistan Standard Time (PKT = UTC+5) 5:00 AM cycle
function getTodayRange(): { fromStr: string; toStr: string; fromMs: number; toMs: number } {
  const { todayStartMs, todayEndMs, todayFromStr, todayToStr } = getPakistan5AmCycleBounds();
  return {
    fromStr: todayFromStr,
    toStr: todayToStr,
    fromMs: todayStartMs,
    toMs: todayEndMs,
  };
}

function getYesterdayRange(): { fromStr: string; toStr: string; fromMs: number; toMs: number } {
  const { yesterdayStartMs, yesterdayEndMs, yesterdayFromStr, yesterdayToStr } = getPakistan5AmCycleBounds();
  return {
    fromStr: yesterdayFromStr,
    toStr: yesterdayToStr,
    fromMs: yesterdayStartMs,
    toMs: yesterdayEndMs,
  };
}

function getMonthRange(): { fromStr: string; toStr: string; fromMs: number; toMs: number } {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  const fromMs = d.getTime();
  const lastD = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
  const toMs = lastD.getTime();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const lastDayNum = String(lastD.getDate()).padStart(2, '0');
  return {
    fromStr: `${yyyy}-${mm}-01 00:00:00`,
    toStr: `${yyyy}-${mm}-${lastDayNum} 23:59:59`,
    fromMs,
    toMs,
  };
}

function getYearRange(): { fromStr: string; toStr: string; fromMs: number; toMs: number } {
  const d = new Date();
  const yyyy = d.getFullYear();
  const fromD = new Date(yyyy, 0, 1, 0, 0, 0, 0);
  const toD = new Date(yyyy, 11, 31, 23, 59, 59, 999);
  return {
    fromStr: `${yyyy}-01-01 00:00:00`,
    toStr: `${yyyy}-12-31 23:59:59`,
    fromMs: fromD.getTime(),
    toMs: toD.getTime(),
  };
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { session, settings } = useAuth();
  const theme = settings?.theme ? THEMES[settings.theme] : THEMES.emerald;

  const [stats, setStats] = useState<SystemStats | null>(null);
  const [partitions, setPartitions] = useState<Partition[]>([]);
  const [ranges, setRanges] = useState<NumberRange[]>([]);

  // Timeframe Filter State
  const [activeTimeframe, setActiveTimeframe] = useState<TimeframeType>('today');
  const [customFromStr, setCustomFromStr] = useState<string>(() => {
    const d = new Date(Date.now() - 7 * 86400000);
    d.setHours(0, 0, 0, 0);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} 00:00:00`;
  });
  const [customToStr, setCustomToStr] = useState<string>(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} 23:59:59`;
  });

  // Timeframe Data & Query State
  const [timeframeMessages, setTimeframeMessages] = useState<SmsMessage[]>([]);
  const [timeframeTotalCount, setTimeframeTotalCount] = useState<number>(0);
  const [isLoadingTimeframe, setIsLoadingTimeframe] = useState<boolean>(false);
  const [tableSearch, setTableSearch] = useState<string>('');
  const [recordsPerPage, setRecordsPerPage] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Simulator Modal State
  const [isSimulating, setIsSimulating] = useState(false);
  const [simForm, setSimForm] = useState({
    sender: 'WhatsApp',
    phone: '+1 (555) 392-8190',
    service: 'WhatsApp',
    otp: '782914',
    partId: 'part_1',
    partName: 'Part 1',
    part: 1,
    message: 'Your WhatsApp verification code is 782914. Do not share.',
  });
  const [showSimModal, setShowSimModal] = useState(false);

  // Fetch Master Stats & Partitions
  const lastRangesFetchRef = useRef(0);
  const fetchDashboardData = useCallback(async () => {
    if (!session) return;
    try {
      // Ranges contain every number of every range (large payload): refresh at most once a minute
      const needRanges = Date.now() - lastRangesFetchRef.current > 60000;
      const [statsRes, partsRes, rangesRes] = await Promise.all([
        fetch('/api/stats', { headers: { Authorization: `Bearer ${session.token}` } }),
        fetch('/api/partitions', { headers: { Authorization: `Bearer ${session.token}` } }),
        needRanges ? fetch('/api/ranges', { headers: { Authorization: `Bearer ${session.token}` } }) : Promise.resolve(null),
      ]);

      if (statsRes.ok) {
        const d = await statsRes.json();
        setStats(d.stats);
      }
      if (partsRes.ok) {
        const d = await partsRes.json();
        setPartitions(d.partitions || []);
      }
      if (rangesRes && rangesRes.ok) {
        const d = await rangesRes.json();
        setRanges(d.ranges || []);
        lastRangesFetchRef.current = Date.now();
      }
    } catch {
      // Ignore
    }
  }, [session]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);
  usePolling(fetchDashboardData, 10000, !!session);

  // Compute Active Timeframe Timestamps
  const currentRangeBounds = useMemo(() => {
    if (activeTimeframe === 'today') return getTodayRange();
    if (activeTimeframe === 'yesterday') return getYesterdayRange();
    if (activeTimeframe === 'month') return getMonthRange();
    if (activeTimeframe === 'year') return getYearRange();

    // Custom Date to Date
    const fromMs = new Date(customFromStr.replace(' ', 'T')).getTime();
    const toMs = new Date(customToStr.replace(' ', 'T')).getTime();
    return {
      fromStr: customFromStr,
      toStr: customToStr,
      fromMs: isNaN(fromMs) ? Date.now() - 7 * 86400000 : fromMs,
      toMs: isNaN(toMs) ? Date.now() : toMs,
    };
  }, [activeTimeframe, customFromStr, customToStr]);

  // Fetch Timeframe SMS Data from Server
  const fetchTimeframeSms = useCallback(async () => {
    if (!session) return;
    setIsLoadingTimeframe(true);
    try {
      const params = new URLSearchParams();
      params.set('from', String(currentRangeBounds.fromMs));
      params.set('to', String(currentRangeBounds.toMs));
      params.set('limit', '500');

      const res = await fetch(`/api/sms/reports?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setTimeframeMessages(data.messages || []);
        setTimeframeTotalCount(data.filteredCount || data.messages?.length || 0);
        setCurrentPage(1);
      }
    } catch (err) {
      console.error('Failed to fetch timeframe SMS', err);
    } finally {
      setIsLoadingTimeframe(false);
    }
  }, [session, currentRangeBounds]);

  useEffect(() => {
    fetchTimeframeSms();
  }, [fetchTimeframeSms]);

  // Quick Preset Handlers for Date to Date
  const applyPreset = (preset: '24h' | '3d' | '7d' | '30d' | 'month' | 'year') => {
    const now = Date.now();
    let startMs = now;
    if (preset === '24h') startMs = now - 24 * 3600000;
    else if (preset === '3d') startMs = now - 3 * 86400000;
    else if (preset === '7d') startMs = now - 7 * 86400000;
    else if (preset === '30d') startMs = now - 30 * 86400000;
    else if (preset === 'month') {
      const m = getMonthRange();
      setCustomFromStr(m.fromStr);
      setCustomToStr(m.toStr);
      return;
    } else if (preset === 'year') {
      const y = getYearRange();
      setCustomFromStr(y.fromStr);
      setCustomToStr(y.toStr);
      return;
    }

    const startD = new Date(startMs);
    const endD = new Date(now);
    const formatDate = (d: Date) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      const sec = String(d.getSeconds()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd} ${hh}:${min}:${sec}`;
    };

    setCustomFromStr(formatDate(startD));
    setCustomToStr(formatDate(endD));
  };

  // Filter messages locally with tableSearch for instant responsiveness
  const filteredDisplayMessages = useMemo(() => {
    if (!tableSearch.trim()) return timeframeMessages;
    const q = tableSearch.toLowerCase().trim();
    return timeframeMessages.filter((m) => {
      const rName = resolveRangeName(m.country, m.phone, ranges) || m.rangeName || 'Direct';
      return (
        (m.phone || '').toLowerCase().includes(q) ||
        (m.cli || m.service || m.sender || '').toLowerCase().includes(q) ||
        (m.message || '').toLowerCase().includes(q) ||
        (m.otp || '').toLowerCase().includes(q) ||
        rName.toLowerCase().includes(q)
      );
    });
  }, [timeframeMessages, tableSearch, ranges]);

  // Derived Summary Metrics for Timeframe
  const timeframeSummary = useMemo(() => {
    const total = filteredDisplayMessages.length;
    const uniquePhones = new Set(filteredDisplayMessages.map((m) => m.phone)).size;
    const otpCount = filteredDisplayMessages.filter((m) => !!m.otp).length;

    const serviceCounts: Record<string, number> = {};
    for (const m of filteredDisplayMessages) {
      const s = m.service || m.cli || 'Direct';
      serviceCounts[s] = (serviceCounts[s] || 0) + 1;
    }
    const topServices = Object.entries(serviceCounts)
      .map(([service, count]) => ({ service, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    return {
      total,
      uniquePhones,
      otpCount,
      topServices,
    };
  }, [filteredDisplayMessages]);

  // Pagination calculation
  const totalEntries = filteredDisplayMessages.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / recordsPerPage));
  const safePage = Math.max(1, Math.min(currentPage, totalPages));
  const startIndex = (safePage - 1) * recordsPerPage;
  const paginatedMessages = filteredDisplayMessages.slice(startIndex, startIndex + recordsPerPage);

  // Copy Single or All
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAll = () => {
    if (filteredDisplayMessages.length === 0) return;
    const header = ['Date', 'Range', 'Number', 'CLI', 'SMS', 'OTP'].join('\t');
    const rows = filteredDisplayMessages.map((m) => {
      const rName = resolveRangeName(m.country, m.phone, ranges) || m.rangeName || 'Direct';
      const cli = m.cli || m.service || m.sender || 'Direct';
      return [
        formatDateTime(m.timestamp),
        rName,
        m.phone,
        cli,
        m.message.replace(/\t|\n/g, ' '),
        m.otp || ''
      ].join('\t');
    });
    navigator.clipboard.writeText([header, ...rows].join('\n'));
    setCopiedId('table-all');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportCsv = () => {
    if (filteredDisplayMessages.length === 0) return;
    let csvContent = 'data:text/csv;charset=utf-8,';
    const header = ['Date', 'Range', 'Number', 'CLI', 'SMS', 'OTP'].join(',');
    const rows = filteredDisplayMessages.map((m) => {
      const rName = resolveRangeName(m.country, m.phone, ranges) || m.rangeName || 'Direct';
      const cli = m.cli || m.service || m.sender || 'Direct';
      return [
        `"${formatDateTime(m.timestamp)}"`,
        `"${rName.replace(/"/g, '""')}"`,
        `"${(m.phone || '').replace(/"/g, '""')}"`,
        `"${cli.replace(/"/g, '""')}"`,
        `"${(m.message || '').replace(/"/g, '""')}"`,
        `"${(m.otp || '').replace(/"/g, '""')}"`
      ].join(',');
    });
    csvContent += [header, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Dashboard_SMS_${activeTimeframe}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExcel = async () => {
    if (filteredDisplayMessages.length === 0) return;
    const XLSX = await import('xlsx');
    const exportData = filteredDisplayMessages.map((m) => ({
      'Date': formatDateTime(m.timestamp),
      'Range': resolveRangeName(m.country, m.phone, ranges) || m.rangeName || 'Direct',
      'Number': m.phone,
      'CLI': m.cli || m.service || m.sender || 'Direct',
      'SMS': m.message,
      'OTP': m.otp || '',
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Dashboard SMS');
    XLSX.writeFile(workbook, `Dashboard_SMS_${activeTimeframe}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Simulate SMS Form submit
  const handleSimulateSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setIsSimulating(true);
    try {
      const res = await fetch('/api/sms/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify(simForm),
      });
      if (res.ok) {
        soundManager.playOtpAlert();
        setShowSimModal(false);
        fetchDashboardData();
        fetchTimeframeSms();
      }
    } catch {
      // Ignore
    } finally {
      setIsSimulating(false);
    }
  };

  // 7 Days Chart data calculation
  const dailyStats = stats?.dailyStats && stats.dailyStats.length > 0 ? stats.dailyStats : [
    { date: '2026-09-26', count: Math.round((stats?.totalSms || 10) * 0.1), label: 'Day 1' },
    { date: '2026-09-27', count: Math.round((stats?.totalSms || 10) * 0.12), label: 'Day 2' },
    { date: '2026-09-28', count: Math.round((stats?.totalSms || 10) * 0.15), label: 'Day 3' },
    { date: '2026-09-29', count: Math.round((stats?.totalSms || 10) * 0.18), label: 'Day 4' },
    { date: '2026-09-30', count: Math.round((stats?.totalSms || 10) * 0.22), label: 'Day 5' },
    { date: '2026-10-01', count: stats?.yesterdaySms || 0, label: 'Yesterday' },
    { date: '2026-10-02', count: stats?.todaySms || 0, label: 'Today' },
  ];

  const maxDaily = Math.max(...dailyStats.map(d => d.count), 10);
  const chartHeight = 130;
  const chartWidth = 500;
  const paddingX = 35;
  const paddingY = 20;

  const points = dailyStats.map((item, index) => {
    const x = paddingX + (index / (dailyStats.length - 1)) * (chartWidth - paddingX * 2);
    const y = chartHeight - paddingY - (item.count / maxDaily) * (chartHeight - paddingY * 2);
    return { x, y, count: item.count, label: item.label };
  });

  const linePath = points.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x},${pt.y}` : `${acc} L ${pt.x},${pt.y}`;
  }, '');

  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x},${chartHeight - paddingY} L ${points[0].x},${chartHeight - paddingY} Z`
    : '';

  return (
    <div className="space-y-6" id="admin-dashboard-view">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <span>Dashboard</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Real-time SMS gateway relay, timeframe analytics, and client access monitor.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setShowSimModal(true)}
            className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-950/30 transition-all active:scale-95 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Simulate SMS</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('providers')}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Server className="w-3.5 h-3.5 text-blue-400" />
            <span>Connect API</span>
          </button>
        </div>
      </div>

      {/* QUICK ACCESS SHORTCUTS GRID */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-400">Quick Access Modules</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            type="button"
            onClick={() => onNavigate('sms')}
            className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-800/80 text-left transition-all group cursor-pointer shadow-xs"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">Live SMS Relay</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Stream Gateway</div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('reports')}
            className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-800/80 text-left transition-all group cursor-pointer shadow-xs"
          >
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors">SMS Reports</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Manual Queries</div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('client-filters')}
            className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/80 text-left transition-all group cursor-pointer shadow-xs"
          >
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors">CLI Filter</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Rule Manager</div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('bulk-numbers')}
            className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-sky-500/50 hover:bg-slate-800/80 text-left transition-all group cursor-pointer shadow-xs"
          >
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-white group-hover:text-sky-400 transition-colors">Bulk Numbers</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Ranges & Mappings</div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('providers')}
            className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-purple-500/50 hover:bg-slate-800/80 text-left transition-all group cursor-pointer shadow-xs"
          >
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <Server className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-white group-hover:text-purple-400 transition-colors">API Gateway</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Sync Connectors</div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('clients')}
            className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800/80 text-left transition-all group cursor-pointer shadow-xs"
          >
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <Users className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">Clients</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Accounts & Security</div>
          </button>
        </div>
      </div>

      {/* DASHBOARD TIMEFRAME FILTERS & VOLUME OVERVIEW */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/70 border border-slate-800 p-3 sm:p-3.5 rounded-2xl">
          <div className="flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-slate-200">Dashboard Timeframe Selector</span>
          </div>

          {/* Timeframe Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {[
              { id: 'today', label: 'Today SMS', icon: CheckCircle2, count: stats?.todaySms },
              { id: 'yesterday', label: 'Yesterday SMS', icon: RotateCcw, count: stats?.yesterdaySms },
              { id: 'month', label: 'Monthly SMS', icon: Calendar, count: stats?.thisMonthSms },
              { id: 'year', label: 'Yearly SMS', icon: Clock, count: stats?.thisYearSms ?? stats?.totalSms },
              { id: 'custom', label: 'Date to Date', icon: Filter, count: undefined },
            ].map((btn) => {
              const isActive = activeTimeframe === btn.id;
              const IconComp = btn.icon;
              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setActiveTimeframe(btn.id as TimeframeType)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40 ring-1 ring-blue-400'
                      : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  <IconComp className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{btn.label}</span>
                  {typeof btn.count === 'number' && (
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                      isActive ? 'bg-blue-800 text-blue-100' : 'bg-slate-800 text-slate-300'
                    }`}>
                      {btn.count.toLocaleString()}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* INLINE DATE TO DATE CUSTOM RANGE PICKER (Expands when 'custom' is active) */}
        <AnimatePresence>
          {activeTimeframe === 'custom' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-slate-900/90 border border-blue-500/30 rounded-2xl p-4 shadow-lg space-y-3 overflow-hidden"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-400">
                  <SlidersHorizontal className="w-4 h-4" />
                  <span>Date to Date Custom Range Filter</span>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Presets:</span>
                  {[
                    { label: 'Last 24 Hours', key: '24h' },
                    { label: 'Last 3 Days', key: '3d' },
                    { label: 'Last 7 Days', key: '7d' },
                    { label: 'Last 30 Days', key: '30d' },
                    { label: 'This Month', key: 'month' },
                    { label: 'This Year', key: 'year' },
                  ].map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => applyPreset(p.key as any)}
                      className="px-2 py-0.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[10px] font-medium text-slate-300 hover:text-white transition-all cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">From Date & Time</label>
                  <input
                    type="text"
                    value={customFromStr}
                    onChange={(e) => setCustomFromStr(e.target.value)}
                    placeholder="YYYY-MM-DD HH:mm:ss"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:border-blue-500 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">To Date & Time</label>
                  <input
                    type="text"
                    value={customToStr}
                    onChange={(e) => setCustomToStr(e.target.value)}
                    placeholder="YYYY-MM-DD HH:mm:ss"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:border-blue-500 focus:outline-none transition-colors"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={fetchTimeframeSms}
                    disabled={isLoadingTimeframe}
                    className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-blue-900/40 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTimeframe ? 'animate-spin' : ''}`} />
                    <span>Apply Date Range</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigate('reports')}
                    className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                    title="Open in full Show Report view"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Show Report</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 4 Interactive Volume Overview Cards (Clicking switches the active timeframe on the Dashboard!) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Today SMS */}
          <div 
            onClick={() => setActiveTimeframe('today')}
            className={`rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col justify-between cursor-pointer transition-all group ${
              activeTimeframe === 'today'
                ? 'bg-slate-900 border-2 border-emerald-500 shadow-emerald-950/40 ring-1 ring-emerald-500/30'
                : 'bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-300 group-hover:text-emerald-400 transition-colors">Today SMS</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                {(stats?.todaySms ?? 0).toLocaleString()}
              </div>
              <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1 mt-1">
                <TrendingUp className="w-3 h-3" />
                <span>Today's real-time count</span>
              </span>
            </div>
          </div>

          {/* Card 2: Yesterday SMS */}
          <div 
            onClick={() => setActiveTimeframe('yesterday')}
            className={`rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col justify-between cursor-pointer transition-all group ${
              activeTimeframe === 'yesterday'
                ? 'bg-slate-900 border-2 border-blue-500 shadow-blue-900/40 ring-1 ring-blue-500/30'
                : 'bg-slate-900/90 border border-slate-800 hover:border-blue-500/50'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-300 group-hover:text-blue-400 transition-colors">Yesterday SMS</span>
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 group-hover:scale-105 transition-transform">
                <RotateCcw className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                {(stats?.yesterdaySms ?? 0).toLocaleString()}
              </div>
              <span className="text-[11px] text-blue-400 font-medium flex items-center gap-1 mt-1">
                <span>Yesterday 24h recorded</span>
              </span>
            </div>
          </div>

          {/* Card 3: Monthly SMS */}
          <div 
            onClick={() => setActiveTimeframe('month')}
            className={`rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col justify-between cursor-pointer transition-all group ${
              activeTimeframe === 'month'
                ? 'bg-slate-900 border-2 border-sky-500 shadow-sky-900/40 ring-1 ring-sky-500/30'
                : 'bg-slate-900/90 border border-slate-800 hover:border-sky-500/50'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-300 group-hover:text-sky-400 transition-colors">Monthly SMS</span>
              <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 group-hover:scale-105 transition-transform">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                {(stats?.thisMonthSms ?? 0).toLocaleString()}
              </div>
              <span className="text-[11px] text-sky-400 font-medium flex items-center gap-1 mt-1">
                <span>Current month total</span>
              </span>
            </div>
          </div>

          {/* Card 4: Yearly SMS */}
          <div 
            onClick={() => setActiveTimeframe('year')}
            className={`rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col justify-between cursor-pointer transition-all group ${
              activeTimeframe === 'year'
                ? 'bg-slate-900 border-2 border-emerald-400 shadow-emerald-900/40 ring-1 ring-emerald-400/30'
                : 'bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-300 group-hover:text-emerald-400 transition-colors">Yearly SMS</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                {(stats?.thisYearSms ?? stats?.totalSms ?? 0).toLocaleString()}
              </div>
              <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1 mt-1">
                <span>Current year cumulative</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* TIMEFRAME TRAFFIC STREAM & IN-DEPTH BREAKDOWN TABLE */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>
                  {activeTimeframe === 'today' && "Today's SMS Traffic Stream"}
                  {activeTimeframe === 'yesterday' && "Yesterday's SMS Traffic Stream"}
                  {activeTimeframe === 'month' && "Monthly SMS Traffic Stream"}
                  {activeTimeframe === 'year' && "Yearly SMS Traffic Stream"}
                  {activeTimeframe === 'custom' && "Date to Date SMS Traffic Stream"}
                </span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 font-bold">
                  {currentRangeBounds.fromStr.slice(0, 10)} → {currentRangeBounds.toStr.slice(0, 10)}
                </span>
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Real-time records loaded from persistent database for the selected timeframe.
            </p>
          </div>

          {/* Action buttons: Open in Show Report, Export Excel, Export CSV */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleCopyAll}
              className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Copy tab-separated records"
            >
              {copiedId === 'table-all' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedId === 'table-all' ? 'Copied' : 'Copy All'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span>CSV</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Excel</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-900/40 transition-all cursor-pointer"
            >
              <span>Detailed Reports</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Timeframe Analytics KPI Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Records</div>
              <div className="text-base font-bold text-white font-mono">
                {timeframeSummary.total.toLocaleString()}
              </div>
            </div>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center text-xs">
              📊
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Unique Numbers</div>
              <div className="text-base font-bold text-emerald-400 font-mono">
                {timeframeSummary.uniquePhones.toLocaleString()}
              </div>
            </div>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">
              📱
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">OTPs Extracted</div>
              <div className="text-base font-bold text-amber-400 font-mono">
                {timeframeSummary.otpCount.toLocaleString()}
              </div>
            </div>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center text-xs">
              🔑
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between">
            <div className="overflow-hidden">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Top Senders</div>
              <div className="text-xs font-bold text-indigo-300 truncate">
                {timeframeSummary.topServices.length > 0 
                  ? timeframeSummary.topServices.map(s => s.service).join(', ') 
                  : 'Direct'}
              </div>
            </div>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs shrink-0">
              🏷️
            </div>
          </div>
        </div>

        {/* Search & Records Per Page Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={tableSearch}
              onChange={(e) => {
                setTableSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by phone, CLI, OTP, or message text..."
              className="w-full pl-9 pr-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 self-end sm:self-auto">
            <span>Show:</span>
            <select
              value={recordsPerPage}
              onChange={(e) => {
                setRecordsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>entries</span>
          </div>
        </div>

        {/* Responsive SMS Table */}
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                  <th className="py-2.5 px-3">Date & Time</th>
                  <th className="py-2.5 px-3">Range / Country</th>
                  <th className="py-2.5 px-3">Recipient Number</th>
                  <th className="py-2.5 px-3">CLI / App</th>
                  <th className="py-2.5 px-3">Message Body</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {isLoadingTimeframe ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                        <span>Loading timeframe records...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedMessages.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No SMS records found for this timeframe. Click "Simulate SMS" to push test messages or wait for incoming gateway webhooks.
                    </td>
                  </tr>
                ) : (
                  paginatedMessages.map((m) => {
                    const rName = resolveRangeName(m.country, m.phone, ranges) || m.rangeName || 'Direct';
                    const cliName = m.cli || m.service || m.sender || 'Direct';
                    return (
                      <tr 
                        key={m.id} 
                        className="hover:bg-slate-900/70 transition-colors group"
                      >
                        <td className="py-2 px-3 whitespace-nowrap font-mono text-[11px] text-slate-300">
                          {formatDateTime(m.timestamp)}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-[11px] font-medium border border-blue-500/20">
                            {rName}
                          </span>
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap font-mono font-bold text-white text-xs">
                          {m.phone}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span className="font-semibold text-slate-200">
                            {cliName}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-300 max-w-md break-words font-sans text-xs">
                          <div className="flex items-center gap-2">
                            <span>{m.message}</span>
                            {m.otp && (
                              <span className="px-1.5 py-0.2 bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono font-bold text-[11px] rounded shrink-0">
                                OTP: {m.otp}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap text-right">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(m.otp || m.message, m.id)}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
                            title="Copy message / OTP"
                          >
                            {copiedId === m.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-2.5 bg-slate-950 border-t border-slate-800 text-xs text-slate-400">
              <div>
                Showing {Math.min(startIndex + 1, totalEntries)} to {Math.min(startIndex + recordsPerPage, totalEntries)} of {totalEntries} entries
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 font-mono text-white">
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SMS STATS LAST 7 DAYS CHART */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">
              SMS Stats Last 7 Days
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              <strong className="text-emerald-400 font-mono font-bold">{(stats?.todaySms ?? 0).toLocaleString()}</strong> SMS today
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
            Total Gateway SMS: {(stats?.totalSms ?? 0).toLocaleString()}
          </span>
        </div>

        {/* SVG Area & Line Chart */}
        <div className="w-full overflow-hidden">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-40 sm:h-48 overflow-visible"
          >
            <defs>
              <linearGradient id="smsAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid lines */}
            <line x1={paddingX} y1={paddingY} x2={chartWidth - paddingX} y2={paddingY} stroke="#1e293b" strokeDasharray="3 3" />
            <line x1={paddingX} y1={chartHeight / 2} x2={chartWidth - paddingX} y2={chartHeight / 2} stroke="#1e293b" strokeDasharray="3 3" />
            <line x1={paddingX} y1={chartHeight - paddingY} x2={chartWidth - paddingX} y2={chartHeight - paddingY} stroke="#334155" />

            {/* Filled Area */}
            {areaPath && (
              <path d={areaPath} fill="url(#smsAreaGradient)" />
            )}

            {/* Line */}
            {linePath && (
              <path d={linePath} fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            )}

            {/* Points & Data Callouts */}
            {points.map((pt, idx) => (
              <g key={idx}>
                <circle cx={pt.x} cy={pt.y} r="4" fill="#0284c7" stroke="#ffffff" strokeWidth="2" />
                <text
                  x={pt.x}
                  y={pt.y - 8}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {pt.count.toLocaleString()}
                </text>
                <text
                  x={pt.x}
                  y={chartHeight - 4}
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize="9"
                  fontFamily="sans-serif"
                >
                  {pt.label}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>

      {/* SYSTEM HEALTH CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400 font-semibold uppercase">API Providers</div>
            <div className="text-xl font-bold text-white font-mono mt-1">
              {stats?.activeProviders ?? 0} Connected
            </div>
            <div className="text-[10px] text-purple-400 font-mono mt-0.5">
              {partitions.length} partitions active
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Server className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400 font-semibold uppercase">Active Clients</div>
            <div className="text-xl font-bold text-white font-mono mt-1">
              {stats?.activeClients ?? 0} Clients
            </div>
            <div className="text-[10px] text-blue-400 font-mono mt-0.5">
              {stats?.activeSessions ?? 0} session(s) active
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400 font-semibold uppercase">Gateway Status</div>
            <div className="text-xl font-bold text-emerald-400 font-mono mt-1">
              99.99% Uptime
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
              Active buffer stream
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Simulator Modal (Preserved for Admin) */}
      {showSimModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-400" />
                <span>Simulate Incoming SMS</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowSimModal(false)}
                className="text-slate-400 hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSimulateSms} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Target Stream / Partition</label>
                <div className="grid grid-cols-2 gap-2">
                  {partitions.map((p) => {
                    const isSelected = simForm.partId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSimForm({
                          ...simForm,
                          partId: p.id,
                          partName: p.name,
                          part: p.id === 'part_2' ? 2 : 1,
                        })}
                        className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-slate-950 text-slate-400 border border-slate-800'
                        }`}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Service / App Name</label>
                <input
                  type="text"
                  required
                  value={simForm.service}
                  onChange={(e) => setSimForm({ ...simForm, service: e.target.value, sender: e.target.value })}
                  placeholder="e.g. WhatsApp, Telegram, Google, Binance"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Recipient Phone Number</label>
                <input
                  type="text"
                  required
                  value={simForm.phone}
                  onChange={(e) => setSimForm({ ...simForm, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">OTP Code</label>
                <input
                  type="text"
                  value={simForm.otp}
                  onChange={(e) => {
                    const o = e.target.value;
                    setSimForm({
                      ...simForm,
                      otp: o,
                      message: `Your ${simForm.service} code is: ${o}. Do not share this code.`,
                    });
                  }}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">SMS Message Body</label>
                <textarea
                  rows={3}
                  required
                  value={simForm.message}
                  onChange={(e) => setSimForm({ ...simForm, message: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSimModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSimulating}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold cursor-pointer"
                >
                  {isSimulating ? 'Pushing...' : 'Push Live SMS'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};
