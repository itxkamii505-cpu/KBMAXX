import React, { useState, useMemo } from 'react';
import { 
  Shield, 
  ShieldAlert, 
  Plus, 
  Trash2, 
  Search, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Globe, 
  Phone, 
  MessageSquare, 
  Layers, 
  Info, 
  Check, 
  X,
  Lock,
  EyeOff,
  Sparkles
} from 'lucide-react';
import type { Reports2FilterRule } from '../../types';

interface Reports2FilterSectionProps {
  rules: Reports2FilterRule[];
  loading: boolean;
  onRefresh: () => void;
  onCreateRule: (data: {
    type: 'country' | 'number' | 'cli' | 'sms';
    pattern: string;
    matchType: 'contains' | 'exact' | 'starts_with';
    action: 'block' | 'mask';
    notes?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  onToggleRule: (id: string) => Promise<void>;
  onDeleteRule: (id: string) => Promise<void>;
}

export const Reports2FilterSection: React.FC<Reports2FilterSectionProps> = ({
  rules,
  loading,
  onRefresh,
  onCreateRule,
  onToggleRule,
  onDeleteRule,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'country' | 'number' | 'cli' | 'sms'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [targetType, setTargetType] = useState<'country' | 'number' | 'cli' | 'sms'>('country');
  const [pattern, setPattern] = useState('');
  const [matchType, setMatchType] = useState<'contains' | 'exact' | 'starts_with'>('contains');
  const [action, setAction] = useState<'block' | 'mask'>('block');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Simulator state
  const [testCountry, setTestCountry] = useState('');
  const [testNumber, setTestNumber] = useState('');
  const [testCli, setTestCli] = useState('');
  const [testSms, setTestSms] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pattern.trim()) {
      setFormError('Pattern / Value is required');
      return;
    }
    setIsSubmitting(true);
    setFormError('');
    setFormSuccess('');

    try {
      const res = await onCreateRule({
        type: targetType,
        pattern: pattern.trim(),
        matchType,
        action,
        notes: notes.trim() || undefined,
      });

      if (!res.success) {
        setFormError(res.error || 'Failed to create rule');
      } else {
        setFormSuccess(`Report 2 block rule for "${pattern.trim()}" created successfully!`);
        setPattern('');
        setNotes('');
        setTimeout(() => setFormSuccess(''), 4000);
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to create rule');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered Rules
  const filteredRules = useMemo(() => {
    return rules.filter((r) => {
      const normType = r.type === 'sms_body' ? 'sms' : r.type;
      if (filterType !== 'all' && normType !== filterType) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const p = (r.pattern || '').toLowerCase();
        const n = (r.notes || '').toLowerCase();
        const t = (r.type || '').toLowerCase();
        return p.includes(q) || n.includes(q) || t.includes(q);
      }
      return true;
    });
  }, [rules, filterType, searchQuery]);

  // Simulator Result
  const simulationResult = useMemo(() => {
    if (!testCountry && !testNumber && !testCli && !testSms) {
      return null;
    }
    const cLower = testCountry.toLowerCase().trim();
    const nClean = testNumber.replace(/[^0-9]/g, '');
    const cliLower = testCli.toLowerCase().trim();
    const smsLower = testSms.toLowerCase().trim();

    for (const r of rules) {
      if (!r.enabled) continue;
      const rawPat = (r.pattern || '').toLowerCase().trim();
      if (!rawPat) continue;
      const subPatterns = rawPat.includes(',') ? rawPat.split(',').map((s) => s.trim()) : [rawPat];

      for (const sp of subPatterns) {
        const testStr = (val: string) => {
          if (!val) return false;
          if (r.matchType === 'exact') return val === sp;
          if (r.matchType === 'starts_with') return val.startsWith(sp);
          return val.includes(sp);
        };

        const cleanPatDigits = sp.replace(/[^0-9]/g, '');

        if (
          r.type === 'country' &&
          cLower &&
          (testStr(cLower) || (cleanPatDigits.length >= 1 && nClean.startsWith(cleanPatDigits)))
        ) {
          return {
            blocked: true,
            action: r.action,
            rule: r,
            reason: `Matches Country Rule: "${sp}" (${r.matchType}). Message is hidden from Report 2.`,
          };
        }
        if (
          r.type === 'number' &&
          nClean &&
          (testStr(nClean) || testStr(testNumber.toLowerCase()) || (cleanPatDigits.length >= 3 && nClean.includes(cleanPatDigits)))
        ) {
          return {
            blocked: true,
            action: r.action,
            rule: r,
            reason: `Matches Number Rule: "${sp}" (${r.matchType}). Message is hidden from Report 2.`,
          };
        }
        if (r.type === 'cli' && cliLower && testStr(cliLower)) {
          return {
            blocked: true,
            action: r.action,
            rule: r,
            reason: `Matches CLI / Sender Rule: "${sp}" (${r.matchType}). Message is hidden from Report 2.`,
          };
        }
        if ((r.type === 'sms' || r.type === 'sms_body') && smsLower && testStr(smsLower)) {
          return {
            blocked: true,
            action: r.action,
            rule: r,
            reason: `Matches SMS Keyword Rule: "${sp}" (${r.matchType}). ${
              r.action === 'mask' ? 'Message body will be masked in Report 2.' : 'Message is hidden from Report 2.'
            }`,
          };
        }
      }
    }

    return {
      blocked: false,
      reason: 'ALLOWED: No blocking rule matches. This SMS will be visible in Report 2.',
    };
  }, [rules, testCountry, testNumber, testCli, testSms]);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-md">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2 flex-wrap">
                Report 2 (Team) Filter & Blocking Management
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-500/40 font-mono font-bold">
                  Country
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-mono font-bold">
                  Number
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-500/40 font-mono font-bold">
                  CLI
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-500/40 font-mono font-bold">
                  SMS
                </span>
              </h1>
              <p className="text-xs text-slate-400 pt-0.5">
                Block messages in Report 2 by Country, Number, CLI, or SMS text. These rules operate independently without affecting primary admin records.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={onRefresh}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            title="Refresh Report 2 Rules"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Information Guide Card */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-start gap-3.5 text-xs text-slate-300">
        <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div className="space-y-1 leading-relaxed">
          <div className="font-bold text-white flex items-center gap-2">
            <span>Report 2 Blocking Capabilities (Country, Number, CLI, SMS):</span>
          </div>
          <div className="text-slate-400 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-1 text-[11px]">
            <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="font-bold text-blue-400 block mb-0.5">🌍 Country:</span>
              Blocks messages from a country name (e.g. Guinea, Pakistan) or country dialing code (e.g. 224, 92).
            </div>
            <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="font-bold text-emerald-400 block mb-0.5">📱 Number:</span>
              Blocks specific MSISDN phone numbers, prefixes, or ranges from appearing in Report 2.
            </div>
            <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="font-bold text-indigo-400 block mb-0.5">🏷️ CLI:</span>
              Blocks specific brand caller IDs, applications, or sender headers (e.g. AstraSMS, WhatsApp).
            </div>
            <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="font-bold text-amber-400 block mb-0.5">💬 SMS:</span>
              Blocks or masks messages containing sensitive body text, OTP codes, or security keywords.
            </div>
          </div>
        </div>
      </div>

      {/* 2-Column Grid: Form & Simulator (Left), Rules List (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form & Simulator */}
        <div className="lg:col-span-5 space-y-6">
          {/* Add Rule Form */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <Plus className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-bold text-white">Add New Report 2 Filter Rule</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Target Type Selector: Country, Number, CLI, SMS */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Block Target
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(
                    [
                      { id: 'country', label: 'Country', icon: Globe },
                      { id: 'number', label: 'Number', icon: Phone },
                      { id: 'cli', label: 'CLI', icon: Layers },
                      { id: 'sms', label: 'SMS', icon: MessageSquare },
                    ] as const
                  ).map((t) => {
                    const Icon = t.icon;
                    const isSelected = targetType === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTargetType(t.id)}
                        className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-400 text-white shadow-md'
                            : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/60'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 mb-1" />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Match Type & Action */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Match Type
                  </label>
                  <select
                    value={matchType}
                    onChange={(e) => setMatchType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="contains">Contains (Includes)</option>
                    <option value="exact">Exact Match</option>
                    <option value="starts_with">Starts With</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Action
                  </label>
                  <select
                    value={action}
                    onChange={(e) => setAction(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500 cursor-pointer font-bold"
                  >
                    <option value="block">Block SMS (Drop / Hide)</option>
                    <option value="mask">Mask Sensitive Body</option>
                  </select>
                </div>
              </div>

              {/* Pattern / Value Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Pattern / Value to Block <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  placeholder={
                    targetType === 'country'
                      ? 'e.g. Guinea, Pakistan, 224, 92'
                      : targetType === 'number'
                      ? 'e.g. 224620000000 or 92300'
                      : targetType === 'cli'
                      ? 'e.g. AstraSMS, WhatsApp, OTP'
                      : 'e.g. verification code, password reset'
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Comma-separated values supported (e.g. "Guinea, Pakistan" or "WhatsApp, Telegram")
                </p>
              </div>

              {/* Optional Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Notes / Reason (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Blocked for secondary team view per management directive"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !pattern.trim()}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Creating Rule...' : 'Add Report 2 Filter Rule'}</span>
              </button>
            </form>
          </div>

          {/* Report 2 Live Simulator */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-bold text-white">Report 2 Live Blocking Simulator</h2>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Test how an incoming SMS behaves against all active Report 2 rules.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Country</label>
                <input
                  type="text"
                  value={testCountry}
                  onChange={(e) => setTestCountry(e.target.value)}
                  placeholder="e.g. Guinea or Pakistan"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={testNumber}
                  onChange={(e) => setTestNumber(e.target.value)}
                  placeholder="e.g. 224620123456"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">CLI / Sender ID</label>
                <input
                  type="text"
                  value={testCli}
                  onChange={(e) => setTestCli(e.target.value)}
                  placeholder="e.g. AstraSMS or WhatsApp"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">SMS Message Body</label>
                <input
                  type="text"
                  value={testSms}
                  onChange={(e) => setTestSms(e.target.value)}
                  placeholder="e.g. Your OTP code is 492018"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {simulationResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs leading-relaxed space-y-1.5 animate-fadeIn ${
                    simulationResult.blocked
                      ? simulationResult.action === 'mask'
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold">
                    {simulationResult.blocked ? (
                      simulationResult.action === 'mask' ? (
                        <>
                          <EyeOff className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>MASKED IN REPORT 2</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                          <span>BLOCKED IN REPORT 2</span>
                        </>
                      )
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>ALLOWED IN REPORT 2</span>
                      </>
                    )}
                  </div>
                  <div className="text-[11px] opacity-90">{simulationResult.reason}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Rules List */}
        <div className="lg:col-span-7 space-y-4">
          {/* Search & Filter Toolbar */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Report 2 rules by pattern, country, number, CLI, or note..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                {(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'country', label: 'Country' },
                    { id: 'number', label: 'Number' },
                    { id: 'cli', label: 'CLI' },
                    { id: 'sms', label: 'SMS' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilterType(f.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      filterType === f.id
                        ? 'bg-indigo-600 text-white shadow-xs font-bold'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/80">
              <span>Showing {filteredRules.length} of {rules.length} active rules</span>
              <span className="text-[11px] font-mono text-indigo-400">Targeting: Country • Number • CLI • SMS</span>
            </div>
          </div>

          {/* Rules List */}
          {filteredRules.length === 0 ? (
            <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-2">
              <Shield className="w-8 h-8 text-slate-600 mx-auto" />
              <div className="font-bold text-slate-300">No Report 2 Filter Rules Found</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchQuery || filterType !== 'all'
                  ? 'No rules match your filter criteria. Try adjusting your search query.'
                  : 'Add a rule using the form on the left to block specific Countries, Numbers, CLIs, or SMS content from Report 2.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[700px] overflow-y-auto custom-scrollbar pr-1">
              {filteredRules.map((rule) => {
                const normType = rule.type === 'sms_body' ? 'sms' : rule.type;
                const typeColorClasses = {
                  country: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
                  number: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
                  cli: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300',
                  sms: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
                  app: 'bg-purple-500/10 border-purple-500/30 text-purple-300',
                }[normType] || 'bg-slate-800 border-slate-700 text-slate-300';

                return (
                  <div
                    key={rule.id}
                    className={`bg-slate-900/90 border rounded-2xl p-4 shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      rule.enabled ? 'border-slate-800' : 'border-slate-800/40 opacity-60'
                    }`}
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Target Type Badge */}
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border uppercase tracking-wider ${typeColorClasses}`}>
                          {normType}
                        </span>

                        {/* Action Badge */}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${
                            rule.action === 'block'
                              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                              : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                          }`}
                        >
                          {rule.action === 'block' ? 'Block (Drop)' : 'Mask Body'}
                        </span>

                        {/* Match Type */}
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                          {rule.matchType || 'contains'}
                        </span>
                      </div>

                      {/* Pattern String */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-bold text-white tracking-wide truncate">
                          {rule.pattern}
                        </span>
                      </div>

                      {rule.notes && (
                        <p className="text-xs text-slate-400 italic leading-snug">
                          {rule.notes}
                        </p>
                      )}
                    </div>

                    {/* Actions: Toggle & Delete */}
                    <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => onToggleRule(rule.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                          rule.enabled
                            ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
                        }`}
                        title={rule.enabled ? 'Click to disable rule' : 'Click to enable rule'}
                      >
                        {rule.enabled ? 'Enabled' : 'Disabled'}
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteRule(rule.id)}
                        className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 hover:border-rose-500/40 transition-colors cursor-pointer"
                        title="Delete rule permanently"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
