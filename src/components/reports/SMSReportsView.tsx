import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Search, 
  Copy, 
  Check, 
  RefreshCw, 
  SlidersHorizontal, 
  Calendar, 
  Phone, 
  MessageSquare, 
  Layers, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  Clock,
  X,
  FileSpreadsheet,
  Trash2,
  AlertTriangle,
  Shield,
  ShieldAlert,
  EyeOff,
  Plus,
  Lock,
  Filter
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatDateTime, resolveRangeName } from '../../utils/countryLookup';
import type { SmsMessage, NumberRange, SmsReportGroup, Reports2FilterRule } from '../../types';

interface SMSReportsViewProps {
  embeddedInClient?: boolean;
  reportType?: 'primary' | 'reports2';
}

/**
 * Formats date into Pakistan Standard Time "YYYY-MM-DD 00:00:00" and "YYYY-MM-DD 23:59:59"
 * matching the default display.
 */
function getTodayDateRange(): { from: string; to: string } {
  const pktDate = new Date(Date.now() + 5 * 60 * 60 * 1000);
  const yyyy = pktDate.getUTCFullYear();
  const mm = String(pktDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(pktDate.getUTCDate()).padStart(2, '0');
  return {
    from: `${yyyy}-${mm}-${dd} 00:00:00`,
    to: `${yyyy}-${mm}-${dd} 23:59:59`,
  };
}

/**
 * Formats SMS message text into clean lines of maximum ~40 characters as requested.
 * Wraps naturally on word boundaries or at 40 characters for contiguous strings.
 */
function formatSmsInto40CharLines(text: string, maxCharsPerLine = 40): string {
  if (!text) return '';
  const paragraphs = text.split(/\r?\n/);
  const formattedParagraphs = paragraphs.map((para) => {
    const words = para.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if (!word) continue;

      if (word.length > maxCharsPerLine) {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = '';
        }
        for (let i = 0; i < word.length; i += maxCharsPerLine) {
          lines.push(word.slice(i, i + maxCharsPerLine));
        }
        continue;
      }

      if (!currentLine) {
        currentLine = word;
      } else if (currentLine.length + 1 + word.length <= maxCharsPerLine) {
        currentLine += ' ' + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
    return lines.join('\n');
  });

  return formattedParagraphs.join('\n');
}

export const SMSReportsView: React.FC<SMSReportsViewProps> = ({ 
  embeddedInClient = false,
  reportType = 'primary'
}) => {
  const { session } = useAuth();
  const isReports2 = reportType === 'reports2' || session?.panelType === 'reports2';

  // Available Ranges for dropdown
  const [ranges, setRanges] = useState<NumberRange[]>([]);

  // Default From/To: Today 00:00:00 to 23:59:59
  const defaultDates = useMemo(() => getTodayDateRange(), []);
  const [fromDateStr, setFromDateStr] = useState<string>(defaultDates.from);
  const [toDateStr, setToDateStr] = useState<string>(defaultDates.to);
  const [selectedRange, setSelectedRange] = useState<string>('All');
  const [numberFilter, setNumberFilter] = useState<string>('');
  const [cliFilter, setCliFilter] = useState<string>('');

  // Group By State (Hour, Date, Month, Range, Number, CLI) - Client option removed as requested
  const [groupBy, setGroupBy] = useState<{
    hour: boolean;
    date: boolean;
    month: boolean;
    range: boolean;
    number: boolean;
    cli: boolean;
  }>({
    hour: false,
    date: false,
    month: false,
    range: false,
    number: false,
    cli: false,
  });

  // Table In-Search & Controls State
  const [tableSearch, setTableSearch] = useState<string>('');
  const [recordsPerPage, setRecordsPerPage] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showColumnsMenu, setShowColumnsMenu] = useState<boolean>(false);
  const columnsMenuRef = useRef<HTMLDivElement>(null);

  // Column Visibility toggles (Date, Range, Number, CLI, SMS) - Client column removed as requested
  const [visibleColumns, setVisibleColumns] = useState<{
    date: boolean;
    range: boolean;
    number: boolean;
    cli: boolean;
    sms: boolean;
  }>({
    date: true,
    range: true,
    number: true,
    cli: true,
    sms: true,
  });

  // Query Results State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [groups, setGroups] = useState<SmsReportGroup[]>([]);
  const [isGroupedMode, setIsGroupedMode] = useState<boolean>(false);
  const [appliedGroupFields, setAppliedGroupFields] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [filteredCount, setFilteredCount] = useState<number>(0);

  // Query result limit ('all' by default to load all matched historical reports)
  const [capacityLimit, setCapacityLimit] = useState<number | 'all'>('all');
  const [showClearModal, setShowClearModal] = useState<boolean>(false);
  const [clearTarget, setClearTarget] = useState<'client' | 'table' | 'all'>('client');
  const [isClearing, setIsClearing] = useState<boolean>(false);

  // Reports 2 (Team Mode) Independent Stop & Rule State
  const [reports2Rules, setReports2Rules] = useState<Reports2FilterRule[]>([]);
  const [quickStopValue, setQuickStopValue] = useState<string>('');
  const [quickStopTarget, setQuickStopTarget] = useState<'cli' | 'app'>('cli');
  const [isSubmittingQuickStop, setIsSubmittingQuickStop] = useState<boolean>(false);
  const [quickStopSuccessMsg, setQuickStopSuccessMsg] = useState<string | null>(null);
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [newRulePattern, setNewRulePattern] = useState<string>('');
  const [newRuleType, setNewRuleType] = useState<'cli' | 'app' | 'sms_body' | 'number'>('cli');
  const [newRuleAction, setNewRuleAction] = useState<'block' | 'mask'>('block');
  const [newRuleNotes, setNewRuleNotes] = useState<string>('');
  const [isSavingRule, setIsSavingRule] = useState<boolean>(false);

  const fetchReports2Rules = useCallback(async () => {
    if (!session || session.role !== 'admin') return;
    try {
      const res = await fetch('/api/reports2-filters', {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setReports2Rules(data.rules || []);
      }
    } catch {
      // ignore
    }
  }, [session]);

  useEffect(() => {
    if (isReports2 && session?.role === 'admin') {
      fetchReports2Rules();
    }
  }, [isReports2, session, fetchReports2Rules]);

  const handleQuickStop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !quickStopValue.trim()) return;
    setIsSubmittingQuickStop(true);
    try {
      const res = await fetch('/api/reports2-filters/quick-stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          target: quickStopTarget,
          value: quickStopValue.trim(),
        }),
      });
      if (res.ok) {
        const d = await res.json();
        if (d.rules) setReports2Rules(d.rules);
        setQuickStopSuccessMsg(`Stopped "${quickStopValue.trim()}" in Reports 2 (Team View)`);
        setQuickStopValue('');
        setTimeout(() => setQuickStopSuccessMsg(null), 3500);
        handleShowReport();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingQuickStop(false);
    }
  };

  const handleToggleRule = async (ruleId: string) => {
    if (!session) return;
    try {
      const res = await fetch(`/api/reports2-filters/${ruleId}/toggle`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (res.ok) {
        const d = await res.json();
        if (d.rules) setReports2Rules(d.rules);
        handleShowReport();
      }
    } catch {}
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!session) return;
    try {
      const res = await fetch(`/api/reports2-filters/${ruleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (res.ok) {
        const d = await res.json();
        if (d.rules) setReports2Rules(d.rules);
        handleShowReport();
      }
    } catch {}
  };

  const handleCreateCustomRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !newRulePattern.trim()) return;
    setIsSavingRule(true);
    try {
      const res = await fetch('/api/reports2-filters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          type: newRuleType,
          pattern: newRulePattern.trim(),
          action: newRuleAction,
          notes: newRuleNotes.trim() || undefined,
          enabled: true,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        if (d.rules) setReports2Rules(d.rules);
        setNewRulePattern('');
        setNewRuleNotes('');
        handleShowReport();
      }
    } catch {} finally {
      setIsSavingRule(false);
    }
  };

  // Close columns dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (columnsMenuRef.current && !columnsMenuRef.current.contains(e.target as Node)) {
        setShowColumnsMenu(false);
      }
    };
    if (showColumnsMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showColumnsMenu]);

  // Fetch Ranges for dropdown
  useEffect(() => {
    if (!session) return;
    fetch('/api/ranges', {
      headers: { Authorization: `Bearer ${session.token}` },
    })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data?.ranges) {
          const sorted = [...data.ranges].sort((a: NumberRange, b: NumberRange) =>
            a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
          );
          setRanges(sorted);
        }
      })
      .catch(() => {});
  }, [session]);

  // Parse date string reliably
  const parseSafeDate = (dStr: string): number => {
    if (!dStr || !dStr.trim()) return NaN;
    const isoFormat = dStr.trim().replace(' ', 'T');
    const t = new Date(isoFormat).getTime();
    if (!isNaN(t)) return t;
    return new Date(dStr).getTime();
  };

  // Execute Show Report Query (Strictly on button click)
  const handleShowReport = useCallback(async () => {
    if (!session) return;
    setIsLoading(true);

    try {
      // Determine active group fields at execution time
      const activeGroups = Object.entries(groupBy)
        .filter(([_, active]) => active)
        .map(([key]) => key);

      const parsedFrom = parseSafeDate(fromDateStr);
      const parsedTo = parseSafeDate(toDateStr);

      const params = new URLSearchParams();
      if (!isNaN(parsedFrom)) params.set('from', String(parsedFrom));
      if (!isNaN(parsedTo)) params.set('to', String(parsedTo));
      if (selectedRange && selectedRange !== 'All') params.set('range', selectedRange);
      if (numberFilter.trim()) params.set('number', numberFilter.trim());
      if (cliFilter.trim()) params.set('cli', cliFilter.trim());
      if (tableSearch.trim()) params.set('q', tableSearch.trim());
      if (activeGroups.length > 0) params.set('groupBy', activeGroups.join(','));
      if (isReports2) params.set('reportSource', 'reports2');
      const queryLimit = capacityLimit === 'all' ? '50000' : String(capacityLimit || 1000);
      params.set('limit', queryLimit);

      const res = await fetch(`/api/sms/reports?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setTotalCount(data.totalCount || 0);
        setFilteredCount(data.filteredCount || 0);

        if (activeGroups.length > 0 && Array.isArray(data.groups)) {
          setGroups(data.groups);
          setMessages([]);
          setIsGroupedMode(true);
          setAppliedGroupFields(activeGroups);
        } else {
          const rawMsgs: SmsMessage[] = data.messages || [];
          const isClientUser = session?.role === 'client' || embeddedInClient;
          const newMsgs = isClientUser ? rawMsgs.filter((m) => !m.isClientBlocked) : rawMsgs;
          setMessages(newMsgs);
          setGroups([]);
          setIsGroupedMode(false);
          setAppliedGroupFields([]);
        }
        setCurrentPage(1);
      }
    } catch (err) {
      console.error('Failed to load SMS report', err);
    } finally {
      setIsLoading(false);
    }
  }, [session, fromDateStr, toDateStr, selectedRange, numberFilter, cliFilter, groupBy, tableSearch, capacityLimit, isReports2]);

  // Clear Logs handler (Support clearing client logs, table, or master buffer)
  const handleConfirmClear = async () => {
    if (!session) return;
    setIsClearing(true);
    try {
      if (clearTarget === 'table') {
        setMessages([]);
        setGroups([]);
        setTotalCount(0);
        setFilteredCount(0);
      } else {
        const url = `/api/sms/clear?target=${encodeURIComponent(clearTarget)}`;
        await fetch(url, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${session.token}` },
        });
        setMessages([]);
        setGroups([]);
        setTotalCount(0);
        setFilteredCount(0);
      }
    } catch {
      // Ignore
    } finally {
      setIsClearing(false);
      setShowClearModal(false);
    }
  };

  // Initial load on mount
  useEffect(() => {
    handleShowReport();
  }, []);

  // Filter messages / groups locally with tableSearch for instant responsiveness
  const displayItems = useMemo(() => {
    if (isGroupedMode) {
      if (!tableSearch.trim()) return groups;
      const q = tableSearch.toLowerCase().trim();
      return groups.filter(g => {
        return Object.values(g).some(val => String(val).toLowerCase().includes(q));
      });
    } else {
      if (!tableSearch.trim()) return messages;
      const q = tableSearch.toLowerCase().trim();
      return messages.filter(m => {
        const rName = resolveRangeName(m.country, m.phone, ranges) || m.rangeName || 'Direct';
        return (
          (m.phone || '').toLowerCase().includes(q) ||
          (m.cli || m.service || m.sender || '').toLowerCase().includes(q) ||
          (m.message || '').toLowerCase().includes(q) ||
          rName.toLowerCase().includes(q)
        );
      });
    }
  }, [isGroupedMode, groups, messages, tableSearch, ranges]);

  // Pagination calculation
  const totalEntries = displayItems.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / recordsPerPage));
  const safePage = Math.max(1, Math.min(currentPage, totalPages));
  const startIndex = (safePage - 1) * recordsPerPage;
  const paginatedItems = displayItems.slice(startIndex, startIndex + recordsPerPage);

  // Toggle individual Group By checkbox
  const handleToggleGroup = (field: keyof typeof groupBy) => {
    setGroupBy(prev => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  // Export functions (Copy, CSV, Excel, PDF)
  const handleExportCopy = () => {
    if (displayItems.length === 0) {
      alert('No data to copy.');
      return;
    }
    if (isGroupedMode) {
      const activeKeys = appliedGroupFields;
      const header = [...activeKeys.map(k => k.toUpperCase()), 'TOTAL'].join('\t');
      const rows = (displayItems as SmsReportGroup[]).map(g => {
        return [...activeKeys.map(k => g[k] || ''), g.count].join('\t');
      });
      navigator.clipboard.writeText([header, ...rows].join('\n'));
    } else {
      const header = ['Date', 'Range', 'Number', 'CLI', 'SMS'].join('\t');
      const rows = (displayItems as SmsMessage[]).map(m => {
        const rName = resolveRangeName(m.country, m.phone, ranges) || m.rangeName || 'Direct';
        const cliName = m.cli || m.service || m.sender || 'Direct';
        return [
          formatDateTime(m.timestamp),
          rName,
          m.phone,
          cliName,
          m.message.replace(/\t|\n/g, ' ')
        ].join('\t');
      });
      navigator.clipboard.writeText([header, ...rows].join('\n'));
    }
    setCopiedId('table-all');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportCsv = () => {
    if (displayItems.length === 0) {
      alert('No data to export.');
      return;
    }
    let csvContent = 'data:text/csv;charset=utf-8,';
    if (isGroupedMode) {
      const activeKeys = appliedGroupFields;
      const header = [...activeKeys.map(k => k.toUpperCase()), 'TOTAL'].join(',');
      const rows = (displayItems as SmsReportGroup[]).map(g => {
        return [...activeKeys.map(k => `"${String(g[k] || '').replace(/"/g, '""')}"`), g.count].join(',');
      });
      csvContent += [header, ...rows].join('\n');
    } else {
      const header = ['Date', 'Range', 'Number', 'CLI', 'SMS'].join(',');
      const rows = (displayItems as SmsMessage[]).map(m => {
        const rName = resolveRangeName(m.country, m.phone, ranges) || m.rangeName || 'Direct';
        const cliName = m.cli || m.service || m.sender || 'Direct';
        return [
          `"${formatDateTime(m.timestamp)}"`,
          `"${rName.replace(/"/g, '""')}"`,
          `"${(m.phone || '').replace(/"/g, '""')}"`,
          `"${cliName.replace(/"/g, '""')}"`,
          `"${(m.message || '').replace(/"/g, '""')}"`
        ].join(',');
      });
      csvContent += [header, ...rows].join('\n');
    }
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SMS_Reports_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExcel = async () => {
    if (displayItems.length === 0) {
      alert('No data to export.');
      return;
    }
    let exportData: any[] = [];
    if (isGroupedMode) {
      const activeKeys = appliedGroupFields;
      exportData = (displayItems as SmsReportGroup[]).map(g => {
        const item: any = {};
        for (const k of activeKeys) {
          item[k.toUpperCase()] = g[k] || '';
        }
        item['TOTAL'] = g.count;
        return item;
      });
    } else {
      exportData = (displayItems as SmsMessage[]).map(m => ({
        'Date': formatDateTime(m.timestamp),
        'Range': resolveRangeName(m.country, m.phone, ranges) || m.rangeName || 'Direct',
        'Number': m.phone,
        'CLI': m.cli || m.service || m.sender || 'Direct',
        'SMS': m.message,
      }));
    }

    const XLSX = await import('xlsx');
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'SMS Reports');
    XLSX.writeFile(workbook, `SMS_Reports_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#edf2f7] p-2.5 sm:p-5 lg:p-6 font-sans text-slate-800 -m-2 sm:-m-4 lg:-m-6">
      <div className="max-w-4xl mx-auto space-y-4" id="sms-reports-view">
        
        {/* TOP HEADER: Clean Title & Team Reports 2 indicator */}
        <div className="py-2 px-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-serif font-black text-slate-800 tracking-tight select-none">
                {isReports2 ? 'SMS Reports 2 (Team View)' : 'SMS Reports'}
              </h1>
              {isReports2 && (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center gap-1 shadow-2xs">
                  <Shield className="w-3.5 h-3.5 text-indigo-600" />
                  Independent Filter Active
                </span>
              )}
            </div>
            {isReports2 && (
              <p className="text-xs text-slate-500 mt-1">
                Secondary team portal with isolated CLI stop rules, app access restrictions, and sensitive SMS body masking.
              </p>
            )}
          </div>
        </div>

        {/* Reports 2 (Team Mode) Admin Quick Stop & Rule Manager Card */}
        {isReports2 && session?.role === 'admin' && (
          <div className="bg-white border border-indigo-200/80 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                <span>Team Stop Controls (Safe for Sharing with Team)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowRulesModal(true)}
                className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg border border-indigo-200 transition-all flex items-center gap-1 cursor-pointer"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Manage Rules ({reports2Rules.length})</span>
              </button>
            </div>

            {/* Quick Stop Form */}
            <form onSubmit={handleQuickStop} className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
                <span className="text-slate-400 font-medium">Target:</span>
                <select 
                  value={quickStopTarget} 
                  onChange={(e) => setQuickStopTarget(e.target.value as any)}
                  className="bg-transparent font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="cli">CLI / Sender</option>
                  <option value="app">App / Service</option>
                </select>
              </div>

              <input
                type="text"
                placeholder={quickStopTarget === 'cli' ? "Enter CLI to stop for team (e.g. WHATSAPP, OTP, PAYPAL)" : "Enter App name to stop for team"}
                value={quickStopValue}
                onChange={(e) => setQuickStopValue(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />

              <button
                type="submit"
                disabled={isSubmittingQuickStop || !quickStopValue.trim()}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Stop in Team Reports</span>
              </button>
            </form>

            {quickStopSuccessMsg && (
              <div className="text-xs text-emerald-600 font-medium flex items-center gap-1 animate-fadeIn">
                <Check className="w-3.5 h-3.5" />
                <span>{quickStopSuccessMsg}</span>
              </div>
            )}

            {/* Active Stopped Tags Pill Row */}
            {reports2Rules.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Stopped for Team:</span>
                {reports2Rules.map((rule) => (
                  <span 
                    key={rule.id}
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono transition-all ${
                      rule.enabled 
                        ? 'bg-rose-50 border border-rose-200 text-rose-700' 
                        : 'bg-slate-100 border border-slate-200 text-slate-400 line-through'
                    }`}
                  >
                    <span className="font-semibold">{rule.type.toUpperCase()}:</span>
                    <span>{rule.pattern}</span>
                    {rule.action === 'mask' && <span title="Masked message body"><EyeOff className="w-3 h-3 text-amber-500" /></span>}
                    <button
                      type="button"
                      onClick={() => handleToggleRule(rule.id)}
                      className="text-slate-400 hover:text-slate-700 cursor-pointer ml-0.5 text-[10px]"
                      title={rule.enabled ? "Disable this rule" : "Enable this rule"}
                    >
                      {rule.enabled ? "●" : "○"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteRule(rule.id)}
                      className="text-rose-400 hover:text-rose-600 cursor-pointer ml-0.5"
                      title="Remove rule"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Reports 2 Comprehensive Rules Management Modal */}
        {showRulesModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Reports 2 (Team) Filter & Masking Rules</h3>
                    <p className="text-xs text-slate-500">Rules applied ONLY to the secondary team portal</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRulesModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Add New Rule Form */}
              <form onSubmit={handleCreateCustomRule} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">Add Rule for Team View</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Rule Target</label>
                    <select
                      value={newRuleType}
                      onChange={(e) => setNewRuleType(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl"
                    >
                      <option value="cli">CLI / Sender</option>
                      <option value="app">App / Service</option>
                      <option value="sms_body">SMS Body Text</option>
                      <option value="number">Phone Number</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Pattern / Value</label>
                    <input
                      type="text"
                      placeholder="e.g. WHATSAPP or OTP"
                      value={newRulePattern}
                      onChange={(e) => setNewRulePattern(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Action</label>
                    <select
                      value={newRuleAction}
                      onChange={(e) => setNewRuleAction(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl"
                    >
                      <option value="block">Block SMS (Drop)</option>
                      <option value="mask">Mask Sensitive Body</option>
                    </select>
                  </div>
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Optional notes / reason (e.g. Block WhatsApp for junior team member)"
                    value={newRuleNotes}
                    onChange={(e) => setNewRuleNotes(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingRule || !newRulePattern.trim()}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Filter Rule</span>
                  </button>
                </div>
              </form>

              {/* Existing Rules Table */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700">Existing Rules ({reports2Rules.length})</div>
                {reports2Rules.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    No active team filter rules yet. Add one above or use the Quick Stop bar.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                    {reports2Rules.map((rule) => (
                      <div 
                        key={rule.id}
                        className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            rule.action === 'block' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {rule.action}
                          </span>
                          <span className="font-semibold text-slate-700">{rule.type.toUpperCase()}:</span>
                          <span className="font-mono text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                            {rule.pattern}
                          </span>
                          {rule.notes && <span className="text-slate-400 text-[11px] italic">({rule.notes})</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleRule(rule.id)}
                            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                              rule.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'
                            }`}
                          >
                            {rule.enabled ? 'Enabled' : 'Disabled'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRule(rule.id)}
                            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all"
                            title="Delete rule"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Clear Logs Confirmation Modal */}
        {showClearModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 animate-fadeIn">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Clear Logs Management</h3>
                  <p className="text-xs text-slate-500">Choose log scope to clear</p>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <label 
                  onClick={() => setClearTarget('client')}
                  className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                    clearTarget === 'client' ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/20' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="clearScope"
                    checked={clearTarget === 'client'}
                    onChange={() => setClearTarget('client')}
                    className="mt-0.5 text-blue-600 focus:ring-0"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-800">Clear Client Portal Logs (Recommended)</div>
                    <div className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                      Clears logs from client screens & history. Admin records remain saved and Dashboard cumulative counts never drop.
                    </div>
                  </div>
                </label>

                <label 
                  onClick={() => setClearTarget('table')}
                  className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                    clearTarget === 'table' ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/20' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="clearScope"
                    checked={clearTarget === 'table'}
                    onChange={() => setClearTarget('table')}
                    className="mt-0.5 text-blue-600 focus:ring-0"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-800">Clear Current Report Results</div>
                    <div className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                      Empties the current report table and results without clearing backend logs.
                    </div>
                  </div>
                </label>

                <label 
                  onClick={() => setClearTarget('all')}
                  className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                    clearTarget === 'all' ? 'border-rose-500 bg-rose-50/60 ring-2 ring-rose-500/20' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="clearScope"
                    checked={clearTarget === 'all'}
                    onChange={() => setClearTarget('all')}
                    className="mt-0.5 text-rose-600 focus:ring-0"
                  />
                  <div>
                    <div className="text-xs font-bold text-rose-800">Clear Master Live Stream Buffer</div>
                    <div className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                      Flushes live gateway buffer memory. Dashboard cumulative total SMS count is permanent and will not decrease.
                    </div>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowClearModal(false)}
                  disabled={isClearing}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmClear}
                  disabled={isClearing}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {isClearing ? 'Clearing...' : 'Confirm Clear'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MAIN FILTER CARD: Optimized layout matching user specifications */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-3.5 sm:p-5 shadow-xs space-y-3 sm:space-y-3.5">
          <form onSubmit={(e) => { e.preventDefault(); handleShowReport(); }} className="space-y-3">
            {/* Row 1: Date to Date in a single row (Mobile & Desktop) */}
            <div className="flex items-center gap-2 sm:gap-3 w-full">
              <div className="flex-1 min-w-0">
                <label className="block text-[11px] sm:text-xs font-serif text-slate-500 mb-0.5 sm:mb-1">
                  From
                </label>
                <input
                  type="text"
                  value={fromDateStr}
                  onChange={(e) => setFromDateStr(e.target.value)}
                  placeholder="YYYY-MM-DD HH:mm:ss"
                  className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 font-sans shadow-2xs focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="shrink-0 pt-3 sm:pt-4 text-xs font-semibold text-slate-400 select-none">
                to
              </div>

              <div className="flex-1 min-w-0">
                <label className="block text-[11px] sm:text-xs font-serif text-slate-500 mb-0.5 sm:mb-1">
                  To
                </label>
                <input
                  type="text"
                  value={toDateStr}
                  onChange={(e) => setToDateStr(e.target.value)}
                  placeholder="YYYY-MM-DD HH:mm:ss"
                  className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 font-sans shadow-2xs focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            {/* Row 2: Number and CLI side-by-side in one row */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div>
                <label className="block text-[11px] sm:text-xs font-serif text-slate-500 mb-0.5 sm:mb-1">
                  Number
                </label>
                <input
                  type="text"
                  value={numberFilter}
                  onChange={(e) => setNumberFilter(e.target.value)}
                  placeholder="Number contains..."
                  className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 font-sans shadow-2xs focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] sm:text-xs font-serif text-slate-500 mb-0.5 sm:mb-1 flex items-center justify-between">
                  <span>CLI / App Keyword</span>
                  {cliFilter && (
                    <button
                      type="button"
                      onClick={() => setCliFilter('')}
                      className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </label>
                <input
                  type="text"
                  value={cliFilter}
                  onChange={(e) => setCliFilter(e.target.value)}
                  placeholder="CLI, app name..."
                  className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 font-sans shadow-2xs focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            {/* Row 3: Range full-width compact box */}
            <div>
              <label className="block text-[11px] sm:text-xs font-serif text-slate-500 mb-0.5 sm:mb-1">
                Range
              </label>
              <div className="relative">
                <select
                  value={selectedRange}
                  onChange={(e) => setSelectedRange(e.target.value)}
                  className="w-full appearance-none px-3 py-1.5 sm:py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 font-sans shadow-2xs focus:outline-none focus:border-blue-500 cursor-pointer pr-8 transition-colors"
                >
                  <option value="All">All</option>
                  {[...ranges]
                    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }))
                    .map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.name}
                      </option>
                    ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Row 4: Group By - smaller chips in a single row */}
            <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5">
              <span className="text-[11px] sm:text-xs font-semibold text-slate-600 shrink-0 select-none">
                Group By :
              </span>
              <div className="flex items-center gap-1 sm:gap-1.5 flex-nowrap shrink-0">
                {(
                  [
                    { key: 'hour', label: 'Hour' },
                    { key: 'date', label: 'Date' },
                    { key: 'month', label: 'Month' },
                    { key: 'range', label: 'Range' },
                    { key: 'number', label: 'Number' },
                    { key: 'cli', label: 'CLI' },
                  ] as const
                ).map(({ key, label }) => {
                  const isChecked = groupBy[key];
                  return (
                    <label
                      key={key}
                      onClick={() => handleToggleGroup(key)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium cursor-pointer transition-all select-none shadow-2xs whitespace-nowrap ${
                        isChecked
                          ? 'border-blue-500 bg-blue-50 text-blue-800'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
                      />
                      <span>{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons: Export Report & Show Report (Preserved as requested) */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handleExportExcel}
                className="w-full py-2.5 sm:py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-white font-semibold text-sm sm:text-base shadow-xs transition-all text-center cursor-pointer border border-slate-700"
              >
                Export Report
              </button>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 sm:py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 active:scale-[0.98] text-white font-bold text-sm sm:text-base shadow-md shadow-blue-600/20 transition-all text-center cursor-pointer disabled:opacity-50"
              >
                {isLoading ? 'Loading...' : 'Show Report'}
              </button>
            </div>
          </form>
        </div>

        {/* TABLE CONTROLS & RESULTS CARD */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-4 sm:p-5 shadow-xs space-y-3">
          {/* Row 1: Search & Show Records */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input with Magnifier */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => {
                  setTableSearch(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Number, CLI, message, range..."
                className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-2xs font-sans transition-colors"
              />
              {tableSearch && (
                <button
                  type="button"
                  onClick={() => setTableSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Show Records Dropdown */}
            <div className="flex items-center gap-2 justify-end shrink-0">
              <span className="text-xs text-slate-600 font-medium whitespace-nowrap">
                Show Records
              </span>
              <div className="relative">
                <select
                  value={recordsPerPage}
                  onChange={(e) => {
                    setRecordsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="appearance-none pl-3 pr-7 py-1.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:outline-none cursor-pointer shadow-2xs"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Row 2: Export Buttons (Copy, CSV, Excel, PDF) & Columns Dropdown */}
          <div className="flex items-center justify-between gap-2 pt-1 flex-wrap sm:flex-nowrap">
            {/* Export Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={handleExportCopy}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 shadow-2xs transition-colors cursor-pointer"
              >
                {copiedId === 'table-all' ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 shadow-2xs transition-colors cursor-pointer"
              >
                CSV
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 shadow-2xs transition-colors cursor-pointer"
              >
                Excel
              </button>
              <button
                type="button"
                onClick={handlePrintPdf}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 shadow-2xs transition-colors cursor-pointer"
              >
                PDF
              </button>
            </div>

            {/* Columns Toggle on the Right */}
            {!isGroupedMode && (
              <div className="relative shrink-0 ml-auto" ref={columnsMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowColumnsMenu(!showColumnsMenu)}
                  className={`px-3.5 py-1.5 rounded-xl border text-xs font-medium shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer ${
                    showColumnsMenu
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                  id="columns-menu-toggle-btn"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                  <span>Columns</span>
                </button>

                {showColumnsMenu && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl p-2.5 z-50 space-y-1 text-xs animate-fadeIn">
                    <div className="flex items-center justify-between px-2 py-1 mb-1 border-b border-slate-100 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <span>Visible Columns</span>
                      <button
                        type="button"
                        onClick={() => setShowColumnsMenu(false)}
                        className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {(['date', 'range', 'number', 'cli', 'sms'] as const).map((col) => (
                      <label
                        key={col}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-slate-700 capitalize transition-colors select-none"
                      >
                        <span className="font-medium text-xs">
                          {col === 'cli' ? 'CLI' : col === 'sms' ? 'SMS Message' : col}
                        </span>
                        <input
                          type="checkbox"
                          checked={visibleColumns[col]}
                          onChange={() => setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }))}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer ml-3"
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Clean Data Table: Client column removed as requested */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 mt-2">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                  {isGroupedMode ? (
                    <>
                      {appliedGroupFields.map((field) => (
                        <th key={field} className="py-3 px-3.5 border-r border-slate-200 capitalize font-mono text-slate-700">
                          {field}
                        </th>
                      ))}
                      <th className="py-3 px-3.5 text-right w-32 font-mono text-emerald-700 font-bold">
                        Total
                      </th>
                    </>
                  ) : (
                    <>
                      {visibleColumns.date && (
                        <th className="py-3 px-3.5 border-r border-slate-200 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-slate-600">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>Date</span>
                          </div>
                        </th>
                      )}
                      {visibleColumns.range && (
                        <th className="py-3 px-3.5 border-r border-slate-200 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-slate-600">
                            <Layers className="w-3.5 h-3.5 text-slate-400" />
                            <span>Range</span>
                          </div>
                        </th>
                      )}
                      {visibleColumns.number && (
                        <th className="py-3 px-3.5 border-r border-slate-200 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-slate-600">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>Number</span>
                          </div>
                        </th>
                      )}
                      {visibleColumns.cli && (
                        <th className="py-3 px-3.5 border-r border-slate-200 whitespace-nowrap">
                          <span className="text-slate-600">CLI</span>
                        </th>
                      )}
                      {visibleColumns.sms && (
                        <th className="py-3 px-3.5 min-w-[280px]">
                          <div className="flex items-center gap-1.5 text-slate-600">
                            <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                            <span>SMS</span>
                          </div>
                        </th>
                      )}
                    </>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 font-sans">
                {isLoading ? (
                  <tr>
                    <td colSpan={10} className="py-14 text-center text-slate-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                      <span>Loading report records...</span>
                    </td>
                  </tr>
                ) : paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-14 text-center text-slate-500">
                      <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold text-slate-700">No records found matching filters</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Adjust your date range or filters and click "Show Report".
                      </p>
                    </td>
                  </tr>
                ) : isGroupedMode ? (
                  // Grouped Table Rows
                  (paginatedItems as SmsReportGroup[]).map((group, idx) => {
                    const activeKeys = appliedGroupFields;
                    return (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        {activeKeys.map((k) => (
                          <td key={k} className="py-3 px-3.5 font-mono border-r border-slate-100 text-slate-800">
                            {group[k] || 'N/A'}
                          </td>
                        ))}
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-700">
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {group.count.toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  // Normal SMS Table Rows (Client column removed)
                  (paginatedItems as SmsMessage[]).map((msg) => {
                    const dateStr = formatDateTime(msg.timestamp);
                    const rangeName = resolveRangeName(msg.country, msg.phone, ranges) || msg.rangeName || 'Direct';
                    const cliName = (msg.cli || msg.service || msg.sender || 'Direct').trim();

                    return (
                      <tr key={msg.id} className="hover:bg-slate-50 transition-colors">
                        {visibleColumns.date && (
                          <td className="py-3 px-3.5 font-mono text-[11px] text-slate-500 whitespace-nowrap border-r border-slate-100">
                            {dateStr}
                          </td>
                        )}
                        {visibleColumns.range && (
                          <td className="py-3 px-3.5 whitespace-nowrap border-r border-slate-100">
                            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold border border-slate-200 text-[11px]">
                              {rangeName}
                            </span>
                          </td>
                        )}
                        {visibleColumns.number && (
                          <td className="py-3 px-3.5 font-mono font-bold text-sky-700 select-all whitespace-nowrap border-r border-slate-100">
                            {msg.phone}
                          </td>
                        )}
                        {visibleColumns.cli && (
                          <td className="py-3 px-3.5 whitespace-nowrap border-r border-slate-100">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 text-[11px] font-mono">
                                {cliName}
                              </span>
                              {msg.isClientBlocked && session?.role === 'admin' && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200" title="Hidden from client panels by blacklist">
                                  Blocked for Client
                                </span>
                              )}
                            </div>
                          </td>
                        )}
                        {visibleColumns.sms && (
                          <td className="py-3 px-3.5">
                            <div className="w-[40ch] max-w-[40ch] p-3 rounded-xl bg-slate-50/90 border border-slate-200 text-slate-800 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words select-text">
                              {formatSmsInto40CharLines(msg.message, 40)}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer & Pagination */}
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 font-medium text-slate-700">
                Total SMS: <strong className="text-slate-900 font-bold">{totalEntries.toLocaleString()}</strong>
              </span>
              <span className="text-[11px] text-slate-500">
                Showing {totalEntries > 0 ? startIndex + 1 : 0} to {Math.min(startIndex + recordsPerPage, totalEntries)} of {totalEntries.toLocaleString()} entries
              </span>
            </div>

            {/* Pagination Buttons */}
            <div className="flex items-center gap-1.5 font-sans">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage(safePage - 1)}
                className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-40 cursor-pointer transition-colors shadow-2xs"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) pageNum = i + 1;
                else if (safePage <= 3) pageNum = i + 1;
                else if (safePage >= totalPages - 2) pageNum = totalPages - 4 + i;
                else pageNum = safePage - 2 + i;

                const isCurrent = safePage === pageNum;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-2xs ${
                      isCurrent
                        ? 'bg-[#0080c6] text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage(safePage + 1)}
                className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-40 cursor-pointer transition-colors shadow-2xs"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SMSReportsView;
