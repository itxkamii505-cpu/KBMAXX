import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldAlert, 
  Plus, 
  Trash2, 
  Search, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  FileText,
  Phone,
  Power,
  Sparkles,
  Info,
  Layers,
  Globe,
  KeyRound,
  Unlock,
  Lock,
  X,
  Check,
  Target,
  AppWindow,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ClientFilterRule, NumberRange } from '../../types';

export const ClientFilterView: React.FC = () => {
  const { session } = useAuth();
  const [rules, setRules] = useState<ClientFilterRule[]>([]);
  const [ranges, setRanges] = useState<NumberRange[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'app' | 'cli' | 'sms_body' | 'range'>('all');

  // Form state for creating new blacklist rule
  const [targetType, setTargetType] = useState<'app' | 'cli' | 'sms_body' | 'range' | 'all'>('app');
  const [pattern, setPattern] = useState('');
  const [matchType, setMatchType] = useState<'contains' | 'exact' | 'starts_with'>('contains');
  const [ruleScope, setRuleScope] = useState<'all' | 'specific_ranges'>('all');
  const [selectedTargetRanges, setSelectedTargetRanges] = useState<string[]>([]);
  const [targetRangeSearch, setTargetRangeSearch] = useState('');
  const [selectedAllowedRanges, setSelectedAllowedRanges] = useState<string[]>([]);
  const [allowedRangeSearch, setAllowedRangeSearch] = useState('');
  const [showOverrideSection, setShowOverrideSection] = useState(false);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Modal state for editing Target Ranges on an existing rule
  const [editingRuleForTargetRanges, setEditingRuleForTargetRanges] = useState<ClientFilterRule | null>(null);
  const [modalTargetRanges, setModalTargetRanges] = useState<string[]>([]);
  const [modalTargetScope, setModalTargetScope] = useState<'all' | 'specific_ranges'>('all');
  const [modalTargetSearch, setModalTargetSearch] = useState('');
  const [isSavingTargetRanges, setIsSavingTargetRanges] = useState(false);
  const [modalTargetFeedback, setModalTargetFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal state for editing Range Access Exceptions on an existing rule
  const [editingRuleForAllowedRanges, setEditingRuleForAllowedRanges] = useState<ClientFilterRule | null>(null);
  const [modalAllowedRanges, setModalAllowedRanges] = useState<string[]>([]);
  const [modalAllowedSearch, setModalAllowedSearch] = useState('');
  const [isSavingAllowedRanges, setIsSavingAllowedRanges] = useState(false);
  const [modalAllowedFeedback, setModalAllowedFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Live Simulator state
  const [testApp, setTestApp] = useState('');
  const [testCli, setTestCli] = useState('');
  const [testRange, setTestRange] = useState('');
  const [testBody, setTestBody] = useState('');

  const fetchRules = async () => {
    if (!session) return;
    try {
      setLoading(true);
      const res = await fetch('/api/client-filters', {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || []);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  const fetchRanges = async () => {
    if (!session) return;
    try {
      const res = await fetch('/api/ranges', {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRanges(data.ranges || []);
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    fetchRules();
    fetchRanges();
  }, [session]);

  // Sorted ranges alphabetically A-to-Z for clean, professional UX
  const sortedRanges = useMemo(() => {
    return [...ranges].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true })
    );
  }, [ranges]);

  const toggleTargetRange = (rangeName: string) => {
    setSelectedTargetRanges((prev) =>
      prev.includes(rangeName) ? prev.filter((r) => r !== rangeName) : [...prev, rangeName]
    );
  };

  const toggleAllowedRange = (rangeName: string) => {
    setSelectedAllowedRanges((prev) =>
      prev.includes(rangeName) ? prev.filter((r) => r !== rangeName) : [...prev, rangeName]
    );
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setFormError('');
    setFormSuccess('');

    const cleanPattern = pattern.trim();
    if (!cleanPattern) {
      setFormError('Please enter an Application name, CLI, Range name, or SMS body keyword to block.');
      return;
    }

    if (ruleScope === 'specific_ranges' && selectedTargetRanges.length === 0) {
      setFormError('Please select at least one specific range to stop this application/rule on, or select "All Ranges (Global)".');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/client-filters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          type: targetType,
          pattern: cleanPattern,
          matchType,
          scope: ruleScope,
          targetRanges: ruleScope === 'specific_ranges' ? selectedTargetRanges : [],
          allowedRanges: selectedAllowedRanges,
          notes: notes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setFormError(data.error || 'Failed to create blacklist rule');
        return;
      }

      const scopeInfo = ruleScope === 'specific_ranges'
        ? ` specifically stopped on ${selectedTargetRanges.length} range(s) (${selectedTargetRanges.join(', ')})`
        : ' stopped globally across all ranges';

      setFormSuccess(`Filter rule created: "${cleanPattern}" is${scopeInfo}.`);
      setPattern('');
      setNotes('');
      setSelectedTargetRanges([]);
      setSelectedAllowedRanges([]);
      setRuleScope('all');
      fetchRules();
    } catch (err: any) {
      setFormError(err?.message || 'Network error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async (id: string) => {
    if (!session) return;
    try {
      const res = await fetch(`/api/client-filters/${id}/toggle`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || []);
      }
    } catch {
      // Ignore
    }
  };

  const handleDelete = async (id: string) => {
    if (!session) return;
    if (!window.confirm('Are you sure you want to delete this filter rule? Clients will be able to receive matching messages again.')) {
      return;
    }

    try {
      const res = await fetch(`/api/client-filters/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || []);
      }
    } catch {
      // Ignore
    }
  };

  // Open modal to configure Target Ranges (where this app/rule is stopped)
  const openTargetRangesModal = (rule: ClientFilterRule) => {
    setEditingRuleForTargetRanges(rule);
    const hasTargets = Array.isArray(rule.targetRanges) && rule.targetRanges.length > 0;
    setModalTargetScope(hasTargets ? 'specific_ranges' : (rule.scope || 'all'));
    setModalTargetRanges(rule.targetRanges || []);
    setModalTargetSearch('');
    setModalTargetFeedback(null);
  };

  const handleSaveModalTargetRanges = async () => {
    if (!editingRuleForTargetRanges || !session) return;
    try {
      setIsSavingTargetRanges(true);
      setModalTargetFeedback(null);

      const finalTargetRanges = modalTargetScope === 'specific_ranges' ? modalTargetRanges : [];
      const res = await fetch(`/api/client-filters/${editingRuleForTargetRanges.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          scope: modalTargetScope,
          targetRanges: finalTargetRanges,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setModalTargetFeedback({ type: 'error', message: data.error || 'Failed to update target ranges' });
        return;
      }

      setRules(data.rules || []);
      setModalTargetFeedback({
        type: 'success',
        message: modalTargetScope === 'specific_ranges' && finalTargetRanges.length > 0
          ? `Rule is now strictly stopped ONLY for ${finalTargetRanges.length} selected range(s). All other ranges and countries remain unrestricted.`
          : 'Rule is now set to Global (stopped across all ranges and countries).',
      });
      setTimeout(() => {
        setEditingRuleForTargetRanges(null);
      }, 1000);
    } catch (err: any) {
      setModalTargetFeedback({ type: 'error', message: err?.message || 'Network error' });
    } finally {
      setIsSavingTargetRanges(false);
    }
  };

  // Open modal to configure Range Access Exceptions (bypasses block)
  const openAllowedRangesModal = (rule: ClientFilterRule) => {
    setEditingRuleForAllowedRanges(rule);
    setModalAllowedRanges(rule.allowedRanges || []);
    setModalAllowedSearch('');
    setModalAllowedFeedback(null);
  };

  const handleSaveModalAllowedRanges = async () => {
    if (!editingRuleForAllowedRanges || !session) return;
    try {
      setIsSavingAllowedRanges(true);
      setModalAllowedFeedback(null);
      const res = await fetch(`/api/client-filters/${editingRuleForAllowedRanges.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          allowedRanges: modalAllowedRanges,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setModalAllowedFeedback({ type: 'error', message: data.error || 'Failed to update range access' });
        return;
      }

      setRules(data.rules || []);
      setModalAllowedFeedback({
        type: 'success',
        message: modalAllowedRanges.length > 0
          ? `Access granted to ${modalAllowedRanges.length} range(s). Block is bypassed for these ranges.`
          : 'Block exception removed. Rule enforced according to scope.',
      });
      setTimeout(() => {
        setEditingRuleForAllowedRanges(null);
      }, 1000);
    } catch (err: any) {
      setModalAllowedFeedback({ type: 'error', message: err?.message || 'Network error' });
    } finally {
      setIsSavingAllowedRanges(false);
    }
  };

  // Displayed rules with category filter and search
  const displayedRules = useMemo(() => {
    return rules.filter((r) => {
      const matchesType = filterType === 'all' || r.type === filterType;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        r.pattern.toLowerCase().includes(q) ||
        (r.notes && r.notes.toLowerCase().includes(q)) ||
        (r.targetRanges && r.targetRanges.some((tr) => tr.toLowerCase().includes(q))) ||
        (r.allowedRanges && r.allowedRanges.some((ar) => ar.toLowerCase().includes(q)));
      return matchesType && matchesSearch;
    });
  }, [rules, filterType, searchQuery]);

  // Live Simulator calculation
  const testResult = useMemo(() => {
    if (!testApp.trim() && !testCli.trim() && !testRange.trim() && !testBody.trim()) {
      return null;
    }

    const activeRules = rules.filter((r) => r.enabled);
    const appLower = testApp.toLowerCase().trim();
    const cliLower = testCli.toLowerCase().trim();
    const rangeLower = testRange.toLowerCase().trim();
    const bodyLower = testBody.toLowerCase().trim();

    for (const rule of activeRules) {
      // 1. Check if rule is scoped to specific target ranges
      if (Array.isArray(rule.targetRanges) && rule.targetRanges.length > 0) {
        const isTargetedToRange = rule.targetRanges.some((tr) => {
          const t = tr.toLowerCase().trim();
          return rangeLower && (rangeLower === t || rangeLower.includes(t) || t.includes(rangeLower));
        });

        if (!isTargetedToRange) {
          // Rule is targeted ONLY to specific ranges, and testRange does not match -> NOT BLOCKED!
          continue;
        }
      }

      const rawPat = (rule.pattern || '').toLowerCase().trim();
      if (!rawPat) continue;

      const subPatterns = rawPat.includes(',')
        ? rawPat.split(',').map((p) => p.toLowerCase().trim()).filter(Boolean)
        : [rawPat];

      const matchType = rule.matchType || 'contains';

      for (const pat of subPatterns) {
        const checkStr = (val: string): boolean => {
          if (!val) return false;
          const clean = val.toLowerCase().trim();
          if (matchType === 'exact') return clean === pat;
          if (matchType === 'starts_with') return clean.startsWith(pat);
          return clean.includes(pat);
        };

        let matched = false;
        let matchDescription = '';

        if (rule.type === 'app') {
          if (checkStr(appLower) || checkStr(cliLower)) {
            matched = true;
            matchDescription = `Matches Application / Service rule: "${pat}"`;
          }
        } else if (rule.type === 'cli') {
          if (checkStr(cliLower) || checkStr(appLower)) {
            matched = true;
            matchDescription = `Matches CLI / Sender rule: "${pat}"`;
          }
        } else if (rule.type === 'sms_body') {
          if (checkStr(bodyLower)) {
            matched = true;
            matchDescription = `Matches SMS Body keyword: "${pat}"`;
          }
        } else if (rule.type === 'range') {
          if (checkStr(rangeLower)) {
            matched = true;
            matchDescription = `Matches Range rule: "${pat}"`;
          }
        } else {
          // 'all'
          if (checkStr(appLower) || checkStr(cliLower) || checkStr(bodyLower) || checkStr(rangeLower)) {
            matched = true;
            matchDescription = `Matches Global Blacklist rule: "${pat}"`;
          }
        }

        if (matched) {
          // Check if testRange has an allowedRanges override exception
          const isAllowedOnTestedRange = (rule.allowedRanges || []).some((ar) => {
            const a = ar.toLowerCase().trim();
            return rangeLower && (rangeLower === a || rangeLower.includes(a) || a.includes(rangeLower));
          });

          if (isAllowedOnTestedRange) {
            return {
              blocked: false,
              isRangeAllowed: true,
              rule,
              reason: `ALLOWED (Range Access Override): Rule matched "${pat}", but Range "${testRange}" is granted an explicit access override.`,
            };
          }

          const targetScopeInfo = Array.isArray(rule.targetRanges) && rule.targetRanges.length > 0
            ? `Rule is specifically targeted to stop on range "${testRange}".`
            : 'Rule is set to Global (all ranges).';

          return {
            blocked: true,
            isRangeAllowed: false,
            rule,
            reason: `${matchDescription}. ${targetScopeInfo} Message will be hidden from client panels.`,
          };
        }
      }
    }

    return {
      blocked: false,
      isRangeAllowed: false,
      reason: 'ALLOWED: No blocking rule applies to this application/range. Visible in Client Panel.',
    };
  }, [rules, testApp, testCli, testRange, testBody]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-md">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2 flex-wrap">
                Application, Range & CLI Filter Management
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-500/40 font-mono font-bold">
                  Targeted Blocking
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-mono font-bold flex items-center gap-1">
                  <Target className="w-3 h-3 text-emerald-400" />
                  Range-Specific Controls
                </span>
              </h1>
              <p className="text-xs text-slate-400 pt-0.5">
                Configure global or range-targeted blocks for applications, sender IDs, and keywords.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              fetchRules();
              fetchRanges();
            }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            title="Refresh Rules & Ranges"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Information Guide Card */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-start gap-3.5 text-xs text-slate-300">
        <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
        <div className="space-y-1.5 leading-relaxed">
          <div className="font-bold text-white flex items-center gap-2">
            <span>Range-Targeted Application & CLI Blocking:</span>
          </div>
          <div className="text-slate-400">
            You can block an application (such as <code className="text-amber-300 font-mono">WhatsApp</code>, <code className="text-amber-300 font-mono">Google</code>, or <code className="text-amber-300 font-mono">Telegram</code>) globally across <strong>All Ranges</strong>, OR stop it strictly on <strong>Specific Selected Ranges</strong>. When a specific range is targeted, the application is stopped only on that chosen range, while all other ranges and countries continue operating normally without interruption.
          </div>
        </div>
      </div>

      {/* Main Grid: Left Column (Add Rule & Simulator), Right Column (Rules List) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form & Simulator */}
        <div className="lg:col-span-5 space-y-6">
          {/* Create Rule Form */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <Plus className="w-4 h-4 text-rose-400" />
              <h2 className="text-sm font-bold text-white">Add New Filter Rule</h2>
            </div>

            {formError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateRule} className="space-y-4">
              {/* Type Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Filter Target Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetType('app')}
                    className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      targetType === 'app'
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <AppWindow className="w-3.5 h-3.5" />
                    <span>App / Service</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetType('cli')}
                    className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      targetType === 'cli'
                        ? 'bg-sky-500/20 border-sky-500/50 text-sky-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>CLI / Sender</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetType('sms_body')}
                    className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      targetType === 'sms_body'
                        ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>SMS Body Text</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetType('range')}
                    className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      targetType === 'range'
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Range Name</span>
                  </button>
                </div>
              </div>

              {/* Pattern Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {targetType === 'app' && 'Application / Service Name to Block'}
                  {targetType === 'cli' && 'CLI / Sender ID to Block'}
                  {targetType === 'sms_body' && 'SMS Text / Keyword to Block'}
                  {targetType === 'range' && 'Range Name or Country to Block'}
                  {targetType === 'all' && 'Global Keyword / Pattern to Block'}
                </label>
                <input
                  type="text"
                  required
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  placeholder={
                    targetType === 'app'
                      ? 'e.g. WhatsApp, Google, Telegram, Facebook'
                      : targetType === 'cli'
                      ? 'e.g. Apple, WhatsApp, 255123456789'
                      : targetType === 'sms_body'
                      ? 'e.g. verification code, OTP, pin'
                      : targetType === 'range'
                      ? 'e.g. Guinea Orange, Tanzania LX'
                      : 'e.g. WhatsApp, Apple...'
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-xs font-mono focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Match Criteria */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Matching Criteria
                </label>
                <select
                  value={matchType}
                  onChange={(e: any) => setMatchType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="contains">Contains (Default - Matches if name appears anywhere in text)</option>
                  <option value="exact">Exact Match (Strictly identical match)</option>
                  <option value="starts_with">Starts With (Matches beginning of text)</option>
                </select>
              </div>

              {/* Scope Selection: All Ranges vs Specific Ranges */}
              <div className="space-y-2 pt-1 border-t border-slate-800/80">
                <label className="block text-xs font-bold text-slate-200">
                  Target Scope (Where to Stop this {targetType === 'app' ? 'App' : 'Rule'}):
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRuleScope('all');
                      setSelectedTargetRanges([]);
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      ruleScope === 'all'
                        ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>All Ranges (Global)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRuleScope('specific_ranges')}
                    className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      ruleScope === 'specific_ranges'
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold ring-1 ring-emerald-500/30'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Target className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Specific Range(s)</span>
                  </button>
                </div>

                {ruleScope === 'specific_ranges' && (
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-emerald-500/30 space-y-2 mt-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5 text-emerald-400" />
                        Select Ranges to Stop:
                      </span>
                      {selectedTargetRanges.length > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-mono font-bold">
                          {selectedTargetRanges.length} Selected
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      This application/pattern will be blocked <strong>ONLY</strong> on the selected ranges. It will <strong>NOT</strong> be stopped for any other range or country.
                    </p>

                    {/* Range search */}
                    {sortedRanges.length > 5 && (
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={targetRangeSearch}
                          onChange={(e) => setTargetRangeSearch(e.target.value)}
                          placeholder="Search ranges (A to Z)..."
                          className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-[11px] placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    )}

                    {/* Range list */}
                    <div className="max-h-36 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                      {sortedRanges.length === 0 ? (
                        <div className="text-[11px] text-slate-500 py-2 text-center">
                          No ranges configured yet.
                        </div>
                      ) : (
                        sortedRanges
                          .filter((rng) => !targetRangeSearch || (rng.name || '').toLowerCase().includes(targetRangeSearch.toLowerCase()))
                          .map((rng) => {
                            const isSelected = selectedTargetRanges.includes(rng.name);
                            return (
                              <button
                                key={rng.id}
                                type="button"
                                onClick={() => toggleTargetRange(rng.name)}
                                className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors cursor-pointer border ${
                                  isSelected
                                    ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200 font-semibold'
                                    : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-850'
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] border ${
                                    isSelected ? 'bg-emerald-500 border-emerald-400 text-slate-950 font-bold' : 'border-slate-700'
                                  }`}>
                                    {isSelected ? '✓' : ''}
                                  </span>
                                  <span className="truncate">{rng.name}</span>
                                  <span className="text-[10px] font-mono text-slate-500">+{rng.prefix}</span>
                                </div>
                                <span className="text-[10px] font-mono text-slate-500 shrink-0">
                                  {(rng.totalNumbers || 0).toLocaleString()} MSISDNs
                                </span>
                              </button>
                            );
                          })
                      )}
                    </div>

                    {sortedRanges.length > 0 && (
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
                        <button
                          type="button"
                          onClick={() => setSelectedTargetRanges(sortedRanges.map((r) => r.name))}
                          className="text-[10px] text-emerald-400 hover:underline cursor-pointer"
                        >
                          Select All
                        </button>
                        {selectedTargetRanges.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedTargetRanges([])}
                            className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                          >
                            Clear Selection
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Optional Range Access Override Section */}
              <div className="pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setShowOverrideSection(!showOverrideSection)}
                  className="flex items-center justify-between w-full text-xs text-slate-400 hover:text-white transition-colors cursor-pointer py-1"
                >
                  <span className="flex items-center gap-1.5 font-semibold">
                    <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                    <span>Range Access Override Exceptions (Optional)</span>
                    {selectedAllowedRanges.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-500/30">
                        {selectedAllowedRanges.length}
                      </span>
                    )}
                  </span>
                  {showOverrideSection ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showOverrideSection && (
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 mt-2">
                    <p className="text-[11px] text-slate-400">
                      If you want to grant an explicit override exception so this item still works on specific ranges:
                    </p>

                    {/* Range selection for override */}
                    <div className="max-h-28 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                      {sortedRanges.map((rng) => {
                        const isSelected = selectedAllowedRanges.includes(rng.name);
                        return (
                          <button
                            key={rng.id}
                            type="button"
                            onClick={() => toggleAllowedRange(rng.name)}
                            className={`w-full flex items-center justify-between p-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer border ${
                              isSelected
                                ? 'bg-amber-950/70 border-amber-500/50 text-amber-200'
                                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            <span className="truncate">{rng.name}</span>
                            <span className="text-[10px] font-mono text-slate-500">+{rng.prefix}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Internal Note (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. WhatsApp stopped only on Guinea Orange range"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !pattern.trim()}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-emerald-950/40 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>{isSubmitting ? 'Saving Filter Rule...' : 'Save Filter Rule'}</span>
              </button>
            </form>
          </div>

          {/* Live Tester / Simulator */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-400" />
              <h2 className="text-sm font-bold text-white">Live Filter Simulator</h2>
            </div>
            <p className="text-xs text-slate-400">
              Test whether a specific Application or CLI on a selected Range is blocked or allowed.
            </p>

            <div className="space-y-2.5">
              <input
                type="text"
                value={testApp}
                onChange={(e) => setTestApp(e.target.value)}
                placeholder="Test Application / Service Name (e.g. WhatsApp, Google)"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-xs font-mono focus:outline-none focus:border-sky-500"
              />

              <div className="flex gap-2">
                <input
                  type="text"
                  value={testCli}
                  onChange={(e) => setTestCli(e.target.value)}
                  placeholder="Test CLI / Sender ID (optional)"
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-xs font-mono focus:outline-none focus:border-sky-500"
                />

                {sortedRanges.length > 0 && (
                  <select
                    value={testRange}
                    onChange={(e) => setTestRange(e.target.value)}
                    className="px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 text-xs focus:outline-none focus:border-sky-500 cursor-pointer max-w-[150px]"
                  >
                    <option value="">Pick Range...</option>
                    {sortedRanges.map((rng) => (
                      <option key={rng.id} value={rng.name}>
                        {rng.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <textarea
                value={testBody}
                onChange={(e) => setTestBody(e.target.value)}
                placeholder="Test SMS Message body (optional)"
                rows={2}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none focus:border-sky-500 resize-none font-sans"
              />
            </div>

            {testResult && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 transition-all ${
                  testResult.blocked
                    ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                    : testResult.isRangeAllowed
                    ? 'bg-emerald-950/60 border-emerald-400 text-emerald-200 shadow-md'
                    : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                }`}
              >
                {testResult.blocked ? (
                  <XCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                )}
                <div>
                  <p className="font-bold">
                    {testResult.blocked
                      ? 'BLOCKED from Client Panel'
                      : testResult.isRangeAllowed
                      ? 'ALLOWED (Range Access Override Active)'
                      : 'ALLOWED for Client Panel'}
                  </p>
                  <p className="text-[11px] opacity-90 mt-0.5 leading-relaxed">{testResult.reason}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Existing Rules List */}
        <div className="lg:col-span-7 space-y-4">
          {/* Controls Bar: Search & Category Filter */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search filter rules by pattern, range, or notes..."
                className="w-full pl-9 pr-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {(['all', 'app', 'cli', 'sms_body', 'range'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFilterType(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border ${
                    filterType === t
                      ? 'bg-emerald-600 text-slate-950 border-emerald-500 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {t === 'all'
                    ? 'All Rules'
                    : t === 'app'
                    ? 'Apps'
                    : t === 'cli'
                    ? 'CLIs'
                    : t === 'sms_body'
                    ? 'SMS Body'
                    : 'Ranges'}
                </button>
              ))}
            </div>
          </div>

          {/* Rules List Container */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold text-white">Active Blacklist Rules</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                  {displayedRules.length}
                </span>
              </div>
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-400" />
                <span>Loading filter rules...</span>
              </div>
            ) : displayedRules.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs bg-slate-950/60 rounded-xl border border-slate-800/60">
                <ShieldAlert className="w-6 h-6 mx-auto mb-2 text-slate-600" />
                <p className="font-semibold text-slate-400">No filter rules found</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Create a rule using the form on the left to block specific apps or CLIs.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {displayedRules.map((rule) => {
                  const hasTargetRanges = Array.isArray(rule.targetRanges) && rule.targetRanges.length > 0;
                  const hasAllowedRanges = Array.isArray(rule.allowedRanges) && rule.allowedRanges.length > 0;

                  return (
                    <div
                      key={rule.id}
                      className={`p-3.5 bg-slate-950 border rounded-xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        rule.enabled
                          ? 'border-slate-800 hover:border-slate-700'
                          : 'border-slate-850 opacity-60 bg-slate-950/40'
                      }`}
                    >
                      <div className="space-y-2 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-sm text-white">
                            {rule.pattern}
                          </span>

                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {rule.matchType || 'contains'}
                          </span>

                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              rule.type === 'app'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : rule.type === 'cli'
                                ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                                : rule.type === 'sms_body'
                                ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                                : rule.type === 'range'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            }`}
                          >
                            {rule.type === 'app'
                              ? 'APP'
                              : rule.type === 'cli'
                              ? 'CLI'
                              : rule.type === 'sms_body'
                              ? 'SMS BODY'
                              : rule.type === 'range'
                              ? 'RANGE'
                              : 'ALL FIELDS'}
                          </span>
                        </div>

                        {/* Target Scope Badge */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {hasTargetRanges ? (
                            <div className="flex items-center gap-1.5 flex-wrap p-1.5 px-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs">
                              <Target className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span className="font-bold text-[11px]">Stopped Only on:</span>
                              {rule.targetRanges!.map((tr) => (
                                <span
                                  key={tr}
                                  className="px-2 py-0.5 rounded bg-emerald-900/60 border border-emerald-500/40 font-mono text-[10px] text-emerald-200"
                                >
                                  {tr}
                                </span>
                              ))}
                              <span className="text-[10px] text-slate-400 italic ml-1">
                                (Allowed on all other ranges)
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] p-1 px-2 rounded-lg bg-slate-900 border border-slate-800">
                              <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>Global: Stopped across all ranges</span>
                            </div>
                          )}

                          {/* Range Override Exceptions Badge */}
                          {hasAllowedRanges && (
                            <div className="flex items-center gap-1.5 flex-wrap p-1.5 px-2 rounded-lg bg-amber-950/40 border border-amber-500/30 text-amber-300 text-xs">
                              <Unlock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span className="font-bold text-[11px]">Override on:</span>
                              {rule.allowedRanges!.map((ar) => (
                                <span
                                  key={ar}
                                  className="px-1.5 py-0.5 rounded bg-amber-900/60 border border-amber-500/40 font-mono text-[10px] text-amber-200"
                                >
                                  {ar}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {rule.notes && (
                          <p className="text-xs text-slate-400 italic">
                            "{rule.notes}"
                          </p>
                        )}
                      </div>

                      {/* Rule Actions */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => openTargetRangesModal(rule)}
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                          title="Configure which ranges this rule is stopped on"
                        >
                          <Target className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Target Ranges ({rule.targetRanges?.length || 0})</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openAllowedRangesModal(rule)}
                          className="p-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 text-xs font-semibold transition-all cursor-pointer"
                          title="Range Access Override Exception"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggle(rule.id)}
                          className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                            rule.enabled
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                          }`}
                          title={rule.enabled ? 'Disable Rule' : 'Enable Rule'}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(rule.id)}
                          className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
                          title="Delete Rule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* Target Ranges Modal */}
      {editingRuleForTargetRanges && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden space-y-4 p-6">
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Target className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-white">
                    Target Ranges Configuration
                  </h3>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Pattern:</span>
                  <span className="px-2 py-0.5 rounded bg-slate-950 font-mono text-emerald-400 font-bold border border-slate-800">
                    {editingRuleForTargetRanges.pattern}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingRuleForTargetRanges(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-200">
                Rule Scope:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalTargetScope('all');
                    setModalTargetRanges([]);
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    modalTargetScope === 'all'
                      ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>All Ranges (Global)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setModalTargetScope('specific_ranges')}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    modalTargetScope === 'specific_ranges'
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <Target className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Specific Range(s) Only</span>
                </button>
              </div>

              {modalTargetScope === 'specific_ranges' && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-300 font-semibold">
                      Select ranges where this rule will be stopped:
                    </span>
                    <span className="text-[11px] font-mono text-emerald-400">
                      {modalTargetRanges.length} selected
                    </span>
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={modalTargetSearch}
                      onChange={(e) => setModalTargetSearch(e.target.value)}
                      placeholder="Search ranges (A to Z)..."
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {sortedRanges
                      .filter((r) => !modalTargetSearch || (r.name || '').toLowerCase().includes(modalTargetSearch.toLowerCase()))
                      .map((rng) => {
                        const isSelected = modalTargetRanges.includes(rng.name);
                        return (
                          <button
                            key={rng.id}
                            type="button"
                            onClick={() => {
                              setModalTargetRanges((prev) =>
                                prev.includes(rng.name) ? prev.filter((r) => r !== rng.name) : [...prev, rng.name]
                              );
                            }}
                            className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors cursor-pointer border ${
                              isSelected
                                ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200 font-semibold'
                                : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-white'
                            }`}
                          >
                            <span className="truncate">{rng.name}</span>
                            <span className="text-[10px] font-mono text-slate-500">+{rng.prefix}</span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {modalTargetFeedback && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  modalTargetFeedback.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                }`}
              >
                {modalTargetFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                )}
                <span>{modalTargetFeedback.message}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingRuleForTargetRanges(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingTargetRanges}
                onClick={handleSaveModalTargetRanges}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold cursor-pointer transition-colors"
              >
                {isSavingTargetRanges ? 'Saving...' : 'Save Target Ranges'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Allowed Ranges Modal (Override Exception) */}
      {editingRuleForAllowedRanges && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden space-y-4 p-6">
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-white">
                    Range Access Override Permissions
                  </h3>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Rule Pattern:</span>
                  <span className="px-2 py-0.5 rounded bg-slate-950 font-mono text-amber-400 font-bold border border-slate-800">
                    {editingRuleForAllowedRanges.pattern}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingRuleForAllowedRanges(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-xs space-y-1">
              <p className="font-bold text-amber-300">
                Grant Access Exception for Specific Range(s)
              </p>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Check the ranges below where this blocked item should STILL WORK and be accessible to clients.
              </p>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={modalAllowedSearch}
                  onChange={(e) => setModalAllowedSearch(e.target.value)}
                  placeholder="Search ranges (A to Z)..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {sortedRanges
                  .filter((r) => !modalAllowedSearch || (r.name || '').toLowerCase().includes(modalAllowedSearch.toLowerCase()))
                  .map((rng) => {
                    const isSelected = modalAllowedRanges.includes(rng.name);
                    return (
                      <button
                        key={rng.id}
                        type="button"
                        onClick={() => {
                          setModalAllowedRanges((prev) =>
                            prev.includes(rng.name) ? prev.filter((r) => r !== rng.name) : [...prev, rng.name]
                          );
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors cursor-pointer border ${
                          isSelected
                            ? 'bg-amber-950/70 border-amber-500/50 text-amber-200 font-semibold'
                            : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-white'
                        }`}
                      >
                        <span className="truncate">{rng.name}</span>
                        <span className="text-[10px] font-mono text-slate-500">+{rng.prefix}</span>
                      </button>
                    );
                  })}
              </div>
            </div>

            {modalAllowedFeedback && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  modalAllowedFeedback.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                }`}
              >
                {modalAllowedFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                )}
                <span>{modalAllowedFeedback.message}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingRuleForAllowedRanges(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingAllowedRanges}
                onClick={handleSaveModalAllowedRanges}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-bold cursor-pointer transition-colors"
              >
                {isSavingAllowedRanges ? 'Saving...' : 'Save Override'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
