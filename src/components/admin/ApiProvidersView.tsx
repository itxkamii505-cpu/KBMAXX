import React, { useState, useEffect, useCallback } from 'react';
import { usePolling } from '../../hooks/usePolling';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Server, 
  Plus, 
  Trash2, 
  Edit3, 
  Play, 
  Copy, 
  Check, 
  Code, 
  RefreshCw,
  Zap,
  Clock,
  Layers,
  X,
  Sparkles,
  ChevronRight,
  ShieldAlert,
  ArrowLeft,
  SlidersHorizontal,
  CheckCircle2,
  FolderPlus
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { THEMES } from '../../utils/theme';
import type { ApiProvider, Partition } from '../../types';

export const ApiProvidersView: React.FC = () => {
  const { session, settings } = useAuth();
  const theme = settings?.theme ? THEMES[settings.theme] : THEMES.emerald;

  const [providers, setProviders] = useState<ApiProvider[]>([]);
  const [partitions, setPartitions] = useState<Partition[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);
  
  // Partition Filter in Providers view
  const [activePartTab, setActivePartTab] = useState<string>('all');

  // Modal Step State: 'select-part' | 'config'
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<'select-part' | 'config'>('select-part');
  const [editingProvider, setEditingProvider] = useState<ApiProvider | null>(null);
  const [providerToDelete, setProviderToDelete] = useState<ApiProvider | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastNotice, setToastNotice] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [activeCodeTab, setActiveCodeTab] = useState<'curl' | 'php' | 'nodejs' | 'python'>('curl');

  // Partition Management State (Rename / Add Partitions)
  const [isPartitionManagerOpen, setIsPartitionManagerOpen] = useState(false);
  const [newPartitionName, setNewPartitionName] = useState('');
  const [isCreatingPartition, setIsCreatingPartition] = useState(false);
  const [editingPartitionId, setEditingPartitionId] = useState<string | null>(null);
  const [editingPartitionName, setEditingPartitionName] = useState('');

  // Preview Console State
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewResult, setPreviewResult] = useState<{
    finalUrl: string;
    response: any;
    insertedCount?: number;
    success?: boolean;
    error?: string;
  } | null>(null);

  // Form State with Dynamic Partition support
  const [formData, setFormData] = useState({
    name: 'AstraSMS Gateway',
    apiUrl: 'https://astrasms.com/api/viewstats',
    apiToken: '',
    partId: 'part_1',
    partName: 'Part 1',
    part: 1,
    maxRecords: 10,
    tokenParam: 'token',
    recordsParam: 'records',
    dt1Param: 'dt1',
    dt2Param: 'dt2',
    method: 'GET' as 'GET' | 'POST',
    autoSync: true,
    syncIntervalSec: 2,
    enabled: true,
  });

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastNotice({ text, type });
    setTimeout(() => setToastNotice(null), 4000);
  };

  const fetchPartitions = useCallback(async () => {
    if (!session) return;
    try {
      const res = await fetch('/api/partitions', {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPartitions(data.partitions || []);
      }
    } catch {
      // Ignore
    }
  }, [session]);

  const fetchProviders = useCallback(async () => {
    if (!session) return;
    try {
      const res = await fetch('/api/providers', {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers || []);
      }
    } catch {
      // Ignore
    }
  }, [session]);

  useEffect(() => {
    fetchPartitions();
    fetchProviders();
  }, [fetchProviders, fetchPartitions]);
  usePolling(() => {
    fetchProviders();
    fetchPartitions();
  }, 8000, true);

  const handleOpenAdd = () => {
    setEditingProvider(null);
    setFormError(null);
    const defaultPart = partitions[0] || { id: 'part_1', name: 'Part 1' };
    setFormData({
      name: 'AstraSMS Gateway',
      apiUrl: 'https://astrasms.com/api/viewstats',
      apiToken: '',
      partId: defaultPart.id,
      partName: defaultPart.name,
      part: defaultPart.id === 'part_2' ? 2 : 1,
      maxRecords: 10,
      tokenParam: 'token',
      recordsParam: 'records',
      dt1Param: 'dt1',
      dt2Param: 'dt2',
      method: 'GET',
      autoSync: true,
      syncIntervalSec: 2,
      enabled: true,
    });
    setPreviewResult(null);
    // User requested: Prompt to choose Part first
    setModalStep('select-part');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: ApiProvider) => {
    setEditingProvider(p);
    setFormError(null);
    const matchedPart = partitions.find((part) => part.id === p.partId || (part.id === 'part_1' && p.part === 1) || (part.id === 'part_2' && p.part === 2));
    setFormData({
      name: p.name,
      apiUrl: p.apiUrl || 'https://astrasms.com/api/viewstats',
      apiToken: p.apiToken || '',
      partId: p.partId || matchedPart?.id || 'part_1',
      partName: p.partName || matchedPart?.name || 'Part 1',
      part: p.part === 2 ? 2 : 1,
      maxRecords: p.maxRecords || 10,
      tokenParam: p.tokenParam || 'token',
      recordsParam: p.recordsParam || 'records',
      dt1Param: p.dt1Param || 'dt1',
      dt2Param: p.dt2Param || 'dt2',
      method: p.method || 'GET',
      autoSync: p.autoSync !== undefined ? p.autoSync : true,
      syncIntervalSec: p.syncIntervalSec || 2,
      enabled: p.enabled !== undefined ? p.enabled : true,
    });
    setPreviewResult(null);
    setModalStep('config');
    setIsModalOpen(true);
  };

  // Run Live Preview API call with selected partition
  const handleRunPreview = async () => {
    if (!formData.apiUrl || !formData.apiUrl.trim()) {
      showToast('Please specify a valid Base API URL first.', 'error');
      return;
    }

    setIsPreviewing(true);
    setPreviewResult(null);
    setFormError(null);

    try {
      const res = await fetch('/api/providers/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.token}`,
        },
        body: JSON.stringify({
          apiUrl: formData.apiUrl,
          apiToken: formData.apiToken,
          tokenParam: formData.tokenParam || 'token',
          recordsParam: formData.recordsParam || 'records',
          maxRecords: formData.maxRecords || 10,
          dt1Param: formData.dt1Param || 'dt1',
          dt2Param: formData.dt2Param || 'dt2',
          method: formData.method || 'GET',
          partId: formData.partId,
          part: formData.part || 1,
        }),
      });

      const data = await res.json();
      setPreviewResult({
        finalUrl: data.finalUrl || formData.apiUrl,
        response: data.response || data,
        insertedCount: data.insertedCount || 0,
        success: data.success,
        error: data.error,
      });

      if (data.insertedCount && data.insertedCount > 0) {
        showToast(`Preview loaded! ${data.insertedCount} live numbers ingested into ${formData.partName || 'selected partition'}.`, 'success');
      } else if (data.success) {
        showToast(`Connected to gateway in ${formData.partName || 'selected partition'} successfully.`, 'success');
      } else {
        showToast(data.error || 'Preview returned non-200 status', 'error');
      }
    } catch (err: any) {
      setPreviewResult({
        finalUrl: formData.apiUrl,
        response: { error: err.message },
        success: false,
        error: err.message,
      });
      showToast('Failed to connect to gateway: ' + err.message, 'error');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setFormError(null);

    const payload = {
      name: formData.name,
      apiUrl: formData.apiUrl,
      apiToken: formData.apiToken,
      partId: formData.partId,
      partName: formData.partName,
      part: formData.part || 1,
      maxRecords: Number(formData.maxRecords) || 1000,
      tokenParam: formData.tokenParam || 'token',
      recordsParam: formData.recordsParam || 'records',
      dt1Param: formData.dt1Param || 'dt1',
      dt2Param: formData.dt2Param || 'dt2',
      method: formData.method,
      autoSync: formData.autoSync,
      syncIntervalSec: Number(formData.syncIntervalSec) || 2,
      enabled: formData.enabled,
    };

    try {
      if (editingProvider) {
        const res = await fetch(`/api/providers/${editingProvider.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.token}`,
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok) {
          showToast(`Provider "${formData.name}" updated in ${formData.partName}.`, 'success');
          setIsModalOpen(false);
          fetchProviders();
        } else {
          setFormError(data.error || 'Failed to update Gateway API Provider.');
          showToast(data.error || 'Failed to update Gateway API Provider.', 'error');
        }
      } else {
        const res = await fetch('/api/providers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.token}`,
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok) {
          showToast(`New Provider "${formData.name}" added to ${formData.partName} and live synced!`, 'success');
          setIsModalOpen(false);
          fetchProviders();
        } else {
          setFormError(data.error || 'Failed to create Gateway API Provider.');
          showToast(data.error || 'Failed to create Gateway API Provider.', 'error');
        }
      }
    } catch {
      setFormError('Network error while saving Gateway API Provider.');
      showToast('Network error while saving Gateway API Provider.', 'error');
    }
  };

  const confirmDeleteProvider = async () => {
    if (!providerToDelete || !session) return;
    setIsDeleting(true);

    try {
      setProviders((prev) => prev.filter((p) => p.id !== providerToDelete.id));

      const res = await fetch(`/api/providers/${providerToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.token}` },
      });

      if (res.ok) {
        showToast(`API Provider "${providerToDelete.name}" deleted successfully!`, 'success');
      } else {
        showToast('Failed to delete API Provider.', 'error');
      }
      fetchProviders();
    } catch {
      showToast('Network error deleting API Provider.', 'error');
      fetchProviders();
    } finally {
      setIsDeleting(false);
      setProviderToDelete(null);
    }
  };

  const handleSyncNow = async (id: string) => {
    if (!session) return;
    setSyncingId(id);
    try {
      const res = await fetch(`/api/providers/${id}/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
      });
      const data = await res.json();
      setTestResult({
        id,
        success: data.success,
        message: data.message || (data.success ? `Live SMS feed synced (${data.newCount || 0} items)` : data.error),
      });
      fetchProviders();
    } catch {
      setTestResult({
        id,
        success: false,
        message: 'Sync request failed',
      });
    } finally {
      setSyncingId(null);
    }
  };

  const handleTestConnection = async (id: string) => {
    if (!session) return;
    setTestingId(id);
    setTestResult(null);

    try {
      const res = await fetch(`/api/providers/${id}/test`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
      });
      const data = await res.json();
      setTestResult({
        id,
        success: data.success,
        message: data.message || data.error || 'Connection tested successfully',
      });
      fetchProviders();
    } catch {
      setTestResult({
        id,
        success: false,
        message: 'Could not connect to API Provider endpoint',
      });
    } finally {
      setTestingId(null);
    }
  };

  // Create Partition Handler
  const handleCreatePartition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartitionName.trim() || !session) return;
    setIsCreatingPartition(true);

    try {
      const res = await fetch('/api/partitions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ name: newPartitionName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Partition "${newPartitionName.trim()}" created successfully!`, 'success');
        setNewPartitionName('');
        fetchPartitions();
      } else {
        showToast(data.error || 'Failed to create partition', 'error');
      }
    } catch {
      showToast('Network error creating partition', 'error');
    } finally {
      setIsCreatingPartition(false);
    }
  };

  // Rename Partition Handler
  const handleRenamePartition = async (id: string) => {
    if (!editingPartitionName.trim() || !session) return;

    try {
      const res = await fetch(`/api/partitions/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ name: editingPartitionName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Partition renamed to "${editingPartitionName.trim()}"`, 'success');
        setEditingPartitionId(null);
        setEditingPartitionName('');
        fetchPartitions();
        fetchProviders();
      } else {
        showToast(data.error || 'Failed to rename partition', 'error');
      }
    } catch {
      showToast('Network error renaming partition', 'error');
    }
  };

  // Delete Partition Handler
  const handleDeletePartition = async (id: string, name: string) => {
    if (!session) return;
    try {
      const res = await fetch(`/api/partitions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.token}` },
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Partition "${name}" deleted.`, 'success');
        fetchPartitions();
        fetchProviders();
      } else {
        showToast(data.error || 'Cannot delete partition with active providers', 'error');
      }
    } catch {
      showToast('Network error deleting partition', 'error');
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const currentHost = settings?.publicServerUrl?.trim()
    ? settings.publicServerUrl.replace(/\/+$/, '')
    : (typeof window !== 'undefined' ? window.location.origin : 'http://your-vps-ip');
  const webhookUrl = `${currentHost}/api/webhook/sms?token=${settings?.webhookToken || 'kbmax_secret_token'}`;

  const snippetCurl = `curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -d '[
    {
      "num": "224610351009",
      "country": "Guinea",
      "cli": "TM Italla",
      "message": "Your verification code is 481920",
      "dt": "2026-08-27 06:10:44"
    }
  ]'`;

  const snippetPhp = `<?php
$data = [
  [
    'num' => '224610351009',
    'country' => 'Guinea',
    'cli' => 'TM Italla',
    'message' => 'Your verification code is 481920',
    'dt' => date('Y-m-d H:i:s')
  ]
];

$ch = curl_init('${webhookUrl}');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
$response = curl_exec($ch);
curl_close($ch);
echo $response;
?>`;

  const snippetNode = `const axios = require('axios');

const smsData = [
  {
    num: "224610351009",
    country: "Guinea",
    cli: "TM Italla",
    message: "Your verification code is 481920",
    dt: new Date().toISOString()
  }
];

axios.post('${webhookUrl}', smsData)
  .then(res => console.log('Relayed to KB MAX:', res.data))
  .catch(err => console.error('Relay error:', err.message));`;

  const snippetPython = `import requests

payload = [
    {
        "num": "224610351009",
        "country": "Guinea",
        "cli": "TM Italla",
        "message": "Your verification code is 481920",
        "dt": "2026-08-27 06:10:44"
    }
]

response = requests.post("${webhookUrl}", json=payload)
print(response.json())`;

  // Filtered list based on active tab
  const displayedProviders = providers.filter((p) => {
    if (activePartTab === 'all') return true;
    return p.partId === activePartTab || (activePartTab === 'part_1' && p.part === 1) || (activePartTab === 'part_2' && p.part === 2);
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastNotice && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-2xl border text-xs font-semibold flex items-center gap-2 ${
              toastNotice.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/90 border-rose-500/40 text-rose-300'
            }`}
          >
            {toastNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-rose-400" />
            )}
            <span>{toastNotice.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header Card with Actions */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Server className="w-6 h-6 text-blue-400" />
              <span>Gateway API & Partition Management</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Ultra-Fast Sync
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Connect unlimited Gateway APIs, create and rename partitions, and isolate incoming live SMS streams.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Manage Partitions Button */}
          <button
            type="button"
            onClick={() => setIsPartitionManagerOpen(!isPartitionManagerOpen)}
            className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border ${
              isPartitionManagerOpen
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300'
            }`}
          >
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>Manage Partitions ({partitions.length})</span>
          </button>

          {/* Add API Provider Button */}
          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Gateway API</span>
          </button>
        </div>
      </div>

      {/* Expandable Partition Manager Card */}
      <AnimatePresence>
        {isPartitionManagerOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-slate-900/90 border border-indigo-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
                  <span>Partition Stream Definitions & Custom Names</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Rename existing partitions or create new streams to group your Gateway APIs.
                </p>
              </div>

              {/* Add New Partition Input */}
              <form onSubmit={handleCreatePartition} className="flex items-center gap-2">
                <input
                  type="text"
                  value={newPartitionName}
                  onChange={(e) => setNewPartitionName(e.target.value)}
                  placeholder="e.g. Part 3, Route B, US Direct..."
                  className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500 w-48 sm:w-56"
                />
                <button
                  type="submit"
                  disabled={isCreatingPartition || !newPartitionName.trim()}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Part</span>
                </button>
              </form>
            </div>

            {/* Partitions List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {partitions.map((part) => {
                const isEditing = editingPartitionId === part.id;
                const partProvidersCount = providers.filter((p) => p.partId === part.id || (part.id === 'part_1' && p.part === 1) || (part.id === 'part_2' && p.part === 2)).length;

                return (
                  <div
                    key={part.id}
                    className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col justify-between gap-3 group hover:border-slate-700 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 flex-1">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={editingPartitionName}
                              onChange={(e) => setEditingPartitionName(e.target.value)}
                              className="px-2.5 py-1 bg-slate-900 border border-indigo-500 rounded-lg text-xs text-white font-bold w-full focus:outline-none"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleRenamePartition(part.id)}
                              className="p-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white"
                              title="Save Name"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingPartitionId(null)}
                              className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                              {part.name}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-900 text-slate-400 border border-slate-800">
                              {part.id}
                            </span>
                          </div>
                        )}
                        <p className="text-[11px] text-slate-400">
                          {partProvidersCount} Gateway API provider{partProvidersCount === 1 ? '' : 's'} assigned
                        </p>
                      </div>

                      {!isEditing && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPartitionId(part.id);
                              setEditingPartitionName(part.name);
                            }}
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                            title="Rename Partition"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {partitions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleDeletePartition(part.id, part.name)}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors"
                              title="Delete Partition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic Partition Filter Tabs */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 sm:p-3 shadow-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 font-semibold flex items-center gap-1 pl-2">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>Filter by Stream:</span>
          </span>

          <button
            type="button"
            onClick={() => setActivePartTab('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activePartTab === 'all'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <span>All Partitions</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/70 font-mono">
              {providers.length}
            </span>
          </button>

          {partitions.map((part) => {
            const count = providers.filter((p) => p.partId === part.id || (part.id === 'part_1' && p.part === 1) || (part.id === 'part_2' && p.part === 2)).length;
            const isSelected = activePartTab === part.id;
            return (
              <button
                key={part.id}
                type="button"
                onClick={() => setActivePartTab(part.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                }`}
              >
                <span>{part.name}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/70 font-mono text-indigo-300">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400 pr-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Total Providers: {providers.length}</span>
        </div>
      </div>

      {/* Providers Grid / List */}
      <div className="space-y-3">
        {displayedProviders.length === 0 ? (
          <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-3xl space-y-3">
            <Server className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-white">No Gateway API Providers in this Partition</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Add your AstraSMS or other Gateway API endpoint to start live syncing SMS in real-time.
            </p>
            <button
              type="button"
              onClick={handleOpenAdd}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add API Provider</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {displayedProviders.map((p) => {
              const matchedPart = partitions.find((part) => part.id === p.partId || (part.id === 'part_1' && p.part === 1) || (part.id === 'part_2' && p.part === 2));
              const partName = p.partName || matchedPart?.name || (p.part === 2 ? 'Part 2' : 'Part 1');

              return (
                <div
                  key={p.id}
                  className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-3xl p-5 shadow-xl space-y-4 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-white tracking-tight">{p.name}</h3>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-indigo-950/80 text-indigo-300 border border-indigo-500/40">
                          {partName}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-mono truncate max-w-md">
                        {p.apiUrl}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className={`w-2.5 h-2.5 rounded-full ${p.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                      <span className="text-[11px] font-mono text-slate-400">{p.enabled ? 'Active' : 'Disabled'}</span>
                    </div>
                  </div>

                  {/* Token & Polling stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-[11px] font-mono">
                    <div className="p-2 bg-slate-950 rounded-xl border border-slate-800/80">
                      <span className="text-slate-500 block text-[10px]">Method</span>
                      <span className="text-white font-bold">{p.method || 'GET'}</span>
                    </div>
                    <div className="p-2 bg-slate-950 rounded-xl border border-slate-800/80">
                      <span className="text-slate-500 block text-[10px]">Sync Rate</span>
                      <span className="text-emerald-400 font-bold">{p.syncIntervalSec || 2}s Live</span>
                    </div>
                    <div className="p-2 bg-slate-950 rounded-xl border border-slate-800/80">
                      <span className="text-slate-500 block text-[10px]">Max Fetch</span>
                      <span className="text-white font-bold">{p.maxRecords || 1000}</span>
                    </div>
                    <div className="p-2 bg-slate-950 rounded-xl border border-slate-800/80">
                      <span className="text-slate-500 block text-[10px]">Last Status</span>
                      <span className={p.lastSyncStatus === 'failed' ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                        {p.lastSyncStatus || 'idle'}
                      </span>
                    </div>
                  </div>

                  {/* Today & Yesterday 5:00 AM PKT Cycle Stats */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div className="p-2.5 bg-emerald-950/30 rounded-xl border border-emerald-500/20 flex items-center justify-between">
                      <div>
                        <span className="text-emerald-400 font-bold block text-[10px]">Today SMS</span>
                        <span className="text-slate-400 text-[9px]">5:00 AM PKT Cycle</span>
                      </div>
                      <span className="text-emerald-300 font-bold text-sm">{(p.todayFetched || 0).toLocaleString()}</span>
                    </div>
                    <div className="p-2.5 bg-blue-950/30 rounded-xl border border-blue-500/20 flex items-center justify-between">
                      <div>
                        <span className="text-blue-400 font-bold block text-[10px]">Yesterday SMS</span>
                        <span className="text-slate-400 text-[9px]">Previous Cycle</span>
                      </div>
                      <span className="text-blue-300 font-bold text-sm">{(p.yesterdayFetched || 0).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Test Status feedback if clicked */}
                  {testResult && testResult.id === p.id && (
                    <div className={`p-2.5 rounded-xl border text-xs font-mono flex items-center gap-2 ${
                      testResult.success
                        ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-950/70 border-rose-500/40 text-rose-300'
                    }`}>
                      <Zap className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{testResult.message}</span>
                    </div>
                  )}

                  {/* Actions toolbar */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSyncNow(p.id)}
                        disabled={syncingId === p.id}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-all cursor-pointer"
                        title="Force sync now"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${syncingId === p.id ? 'animate-spin' : ''}`} />
                        <span>{syncingId === p.id ? 'Syncing...' : 'Sync Now'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleTestConnection(p.id)}
                        disabled={testingId === p.id}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-all cursor-pointer"
                        title="Test Connection"
                      >
                        <Play className={`w-3.5 h-3.5 text-emerald-400 ${testingId === p.id ? 'animate-spin' : ''}`} />
                        <span>{testingId === p.id ? 'Testing...' : 'Test'}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(p)}
                        className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
                        title="Edit Provider & Preview"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setProviderToDelete(p)}
                        className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 hover:border-rose-500/40 transition-all cursor-pointer"
                        title="Delete Provider"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Integration Code Snippets Tabs */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Code className="w-4 h-4 text-emerald-400" />
              <span>Main Website & Server Relay Code Snippets</span>
            </h3>
            <p className="text-xs text-slate-400">
              Integrate this snippet into your main website backend to auto-forward all incoming SMS to KB MAX.
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            {(['curl', 'php', 'nodejs', 'python'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveCodeTab(tab)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                  activeCodeTab === tab
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <pre className="p-4 bg-slate-950 border border-slate-800/90 rounded-xl font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed">
            {activeCodeTab === 'curl' && snippetCurl}
            {activeCodeTab === 'php' && snippetPhp}
            {activeCodeTab === 'nodejs' && snippetNode}
            {activeCodeTab === 'python' && snippetPython}
          </pre>

          <button
            type="button"
            onClick={() => {
              const code =
                activeCodeTab === 'curl'
                  ? snippetCurl
                  : activeCodeTab === 'php'
                  ? snippetPhp
                  : activeCodeTab === 'nodejs'
                  ? snippetNode
                  : snippetPython;
              handleCopy(code, 'snippet');
            }}
            className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1 transition-all border border-slate-700"
          >
            {copiedKey === 'snippet' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {providerToDelete && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Delete API Provider</h3>
                  <p className="text-xs text-slate-400 font-mono">{providerToDelete.name}</p>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Are you sure you want to remove <span className="text-white font-bold">{providerToDelete.name}</span> from {providerToDelete.partName || 'the partition'}? Live SMS synchronization from this gateway will be stopped immediately.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setProviderToDelete(null)}
                  disabled={isDeleting}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteProvider}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-all shadow-md active:scale-95"
                >
                  {isDeleting ? 'Deleting...' : 'Yes, Delete Provider'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add / Edit Gateway API Provider Modal with Interactive Dynamic Partition Flow */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 15 }}
              className="w-full max-w-2xl bg-[#0b1120] border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto"
            >
              {/* STEP 1: SELECT DYNAMIC PARTITION */}
              {modalStep === 'select-part' ? (
                <div className="space-y-6 py-2">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 font-mono">
                        Step 1 of 2
                      </span>
                      <h3 className="text-base sm:text-lg font-bold text-white tracking-tight mt-0.5">
                        Select Gateway Stream Partition
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Choose which partition to route incoming SMS from this Gateway API into.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {partitions.map((part, index) => {
                      const count = providers.filter((p) => p.partId === part.id || (part.id === 'part_1' && p.part === 1) || (part.id === 'part_2' && p.part === 2)).length;
                      const isAmber = index === 0;
                      const isPurple = index === 1;

                      return (
                        <button
                          key={part.id}
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({
                              ...prev,
                              partId: part.id,
                              partName: part.name,
                              part: part.id === 'part_2' ? 2 : 1,
                            }));
                            setModalStep('config');
                          }}
                          className={`text-left p-5 rounded-2xl border-2 transition-all group cursor-pointer flex flex-col justify-between gap-4 ${
                            isAmber
                              ? 'bg-gradient-to-b from-amber-950/30 to-slate-900/90 border-amber-500/30 hover:border-amber-400 hover:shadow-xl hover:shadow-amber-500/10'
                              : isPurple
                              ? 'bg-gradient-to-b from-purple-950/30 to-slate-900/90 border-purple-500/30 hover:border-purple-400 hover:shadow-xl hover:shadow-purple-500/10'
                              : 'bg-gradient-to-b from-indigo-950/30 to-slate-900/90 border-indigo-500/30 hover:border-indigo-400 hover:shadow-xl hover:shadow-indigo-500/10'
                          }`}
                        >
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border font-mono ${
                                isAmber
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  : isPurple
                                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                  : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                              }`}>
                                {part.name}
                              </span>
                              <span className="text-xs text-slate-400 font-mono">
                                {count} Active API{count === 1 ? '' : 's'}
                              </span>
                            </div>
                            <div className="space-y-1">
                              <h4 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                                {part.name} Gateway Stream
                              </h4>
                              <p className="text-xs text-slate-400 leading-relaxed">
                                Incoming SMS will stream live into <strong>{part.name}</strong>. Messages are strictly isolated and filterable.
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-400 pt-2 border-t border-slate-800">
                            <span>Select {part.name}</span>
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* STEP 2: CONFIGURATION & LIVE PREVIEW */
                <>
                  {/* Modal Header */}
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {!editingProvider && (
                          <button
                            type="button"
                            onClick={() => setModalStep('select-part')}
                            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                            title="Back to partition selection"
                          >
                            <ArrowLeft className="w-4 h-4" />
                          </button>
                        )}
                        <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                          <Server className="w-5 h-5 text-blue-400" />
                          <span>{editingProvider ? 'Edit Gateway API Provider' : 'Configure Gateway API Provider'}</span>
                        </h3>
                      </div>
                      <p className="text-xs text-slate-400">
                        Configure AstraSMS endpoint and test incoming records with Live Preview.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Active Partition Selector Banner */}
                  <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-semibold">Target Partition:</span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-indigo-950/80 text-indigo-300 border border-indigo-500/40">
                        {formData.partName || 'Selected Partition'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1">
                      {partitions.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setFormData((prev) => ({
                            ...prev,
                            partId: p.id,
                            partName: p.name,
                            part: p.id === 'part_2' ? 2 : 1,
                          }))}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            formData.partId === p.id
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-slate-900 text-slate-400 hover:text-white'
                          }`}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Duplicate / Validation Error Alert */}
                  {formError && (
                    <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2.5">
                      <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {/* Modal Form */}
                  <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
                    {/* 1. Gateway Name / Label */}
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1 text-[11px]">
                        Gateway Name / Label
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. AstraSMS High Speed"
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-sans text-xs"
                      />
                    </div>

                    {/* 2. Base API URL */}
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1 text-[11px]">
                        Base API URL
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.apiUrl}
                        onChange={(e) => setFormData({ ...formData, apiUrl: e.target.value })}
                        placeholder="https://astrasms.com/api/viewstats"
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-xs"
                      />
                    </div>

                    {/* 3. Secret API Token */}
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1 text-[11px]">
                        Secret API Token (e.g. AstraSMS Token)
                      </label>
                      <input
                        type="text"
                        value={formData.apiToken}
                        onChange={(e) => setFormData({ ...formData, apiToken: e.target.value })}
                        placeholder="Paste provider API token (e.g. 39ef9ef6dc978c8d4cddea04c88965...)"
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-xs"
                      />
                    </div>

                    {/* 4. Parameters Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-300 mb-1 text-[11px]">
                          Token Param
                        </label>
                        <input
                          type="text"
                          value={formData.tokenParam}
                          onChange={(e) => setFormData({ ...formData, tokenParam: e.target.value })}
                          placeholder="token"
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-xs"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-300 mb-1 text-[11px]">
                          Max Records Param
                        </label>
                        <input
                          type="text"
                          value={formData.recordsParam}
                          onChange={(e) => setFormData({ ...formData, recordsParam: e.target.value })}
                          placeholder="records"
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-xs"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-300 mb-1 text-[11px]">
                          Max Records Value
                        </label>
                        <input
                          type="number"
                          value={formData.maxRecords}
                          onChange={(e) => setFormData({ ...formData, maxRecords: Number(e.target.value) })}
                          min={1}
                          max={5000}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-xs"
                        />
                      </div>
                    </div>

                    {/* Date Params */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-300 mb-1 text-[11px]">
                          Start Date Param (dt1)
                        </label>
                        <input
                          type="text"
                          value={formData.dt1Param}
                          onChange={(e) => setFormData({ ...formData, dt1Param: e.target.value })}
                          placeholder="dt1"
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-xs"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-300 mb-1 text-[11px]">
                          End Date Param (dt2)
                        </label>
                        <input
                          type="text"
                          value={formData.dt2Param}
                          onChange={(e) => setFormData({ ...formData, dt2Param: e.target.value })}
                          placeholder="dt2"
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-xs"
                        />
                      </div>
                    </div>

                    {/* Polling & Mode */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-950 rounded-2xl border border-slate-800">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.autoSync}
                          onChange={(e) => setFormData({ ...formData, autoSync: e.target.checked })}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-700 bg-slate-900"
                        />
                        <span className="font-semibold text-slate-300">Enable Auto High-Speed Sync (2s)</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.enabled}
                          onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-700 bg-slate-900"
                        />
                        <span className="font-semibold text-slate-300">Provider Enabled</span>
                      </label>
                    </div>

                    {/* Live Preview Button */}
                    <div className="flex items-center justify-between gap-3 pt-2">
                      <button
                        type="button"
                        onClick={handleRunPreview}
                        disabled={isPreviewing}
                        className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
                      >
                        <Sparkles className={`w-4 h-4 text-amber-400 ${isPreviewing ? 'animate-spin' : ''}`} />
                        <span>{isPreviewing ? 'Connecting & Fetching...' : 'Run Live Preview Test'}</span>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsModalOpen(false)}
                          className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 text-xs font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 active:scale-95"
                        >
                          {editingProvider ? 'Save Changes' : 'Save & Start Syncing'}
                        </button>
                      </div>
                    </div>
                  </form>

                  {/* Preview Result Console */}
                  {previewResult && (
                    <div className="space-y-2 pt-3 border-t border-slate-800 font-mono text-xs">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${previewResult.success ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                          <span>Live Response Console</span>
                        </span>
                        <span>Ingested: {previewResult.insertedCount || 0} messages</span>
                      </div>
                      <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 max-h-48 overflow-y-auto leading-relaxed text-[11px]">
                        {JSON.stringify(previewResult.response, null, 2)}
                      </pre>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
