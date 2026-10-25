import React, { useState, useEffect, useRef } from 'react';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  Plus, 
  Layers, 
  Trash2, 
  Search, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  X, 
  Phone, 
  Hash, 
  Globe, 
  Filter, 
  Copy, 
  Check,
  FileText,
  ChevronRight,
  Database,
  Lock,
  ShieldAlert,
  KeyRound,
  Eye,
  EyeOff,
  RotateCcw,
  AlertTriangle,
  ShieldCheck,
  Info,
  Shield,
  Sparkles,
  ArrowRight,
  Table,
  CheckCheck,
  FileUp,
  Zap
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type { NumberRange, WhiteNoiseDirectNumber } from '../../types';
import { detectCountryFromPhone, cleanPhoneNumber } from '../../utils/countryDetect';
import { 
  parseMultiRangeDocument, 
  type ParsedRangeBatchItem, 
  type MultiRangeParseResult 
} from '../../utils/multiRangeParser';

interface BulkNumbersViewProps {
  token: string;
}

interface SecurityModalState {
  isOpen: boolean;
  type: 'delete_range' | 'clear_all_numbers';
  range: NumberRange | null;
  securityPin: string;
  error: string | null;
  isProcessing: boolean;
  showPin: boolean;
}

export const BulkNumbersView: React.FC<BulkNumbersViewProps> = ({ token }) => {
  // State for Ranges
  const [ranges, setRanges] = useState<NumberRange[]>([]);
  const [isLoadingRanges, setIsLoadingRanges] = useState(true);
  const [rangesSearch, setRangesSearch] = useState('');

  // Primary Workspace Mode: 'document' (Auto Multi-Range Document Importer) vs 'manual' (Single Range Manual) vs 'whitenoise-direct' (Direct Bulk)
  const [activeTabMode, setActiveTabMode] = useState<'document' | 'manual' | 'whitenoise-direct'>('document');

  // WhiteNoise Direct Bulk Numbers (No Range Required) State
  const [wnDirectNumbers, setWnDirectNumbers] = useState<WhiteNoiseDirectNumber[]>([]);
  const [isLoadingWnDirect, setIsLoadingWnDirect] = useState(false);
  const [wnDirectRawText, setWnDirectRawText] = useState('');
  const [wnDirectFileName, setWnDirectFileName] = useState<string | null>(null);
  const [wnParsedPreview, setWnParsedPreview] = useState<Array<{ phone: string; country: string }>>([]);
  const [isWnSubmitting, setIsWnSubmitting] = useState(false);
  const [wnSearch, setWnSearch] = useState('');
  const [wnCountryFilter, setWnCountryFilter] = useState('ALL');
  const [wnNotice, setWnNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const wnFileInputRef = useRef<HTMLInputElement>(null);

  const fetchWnDirectNumbers = async () => {
    setIsLoadingWnDirect(true);
    try {
      const res = await fetch('/api/whitenoise/direct-numbers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        setWnDirectNumbers(d.numbers || []);
      }
    } catch {} finally {
      setIsLoadingWnDirect(false);
    }
  };

  useEffect(() => {
    if (activeTabMode === 'whitenoise-direct') {
      fetchWnDirectNumbers();
    }
  }, [activeTabMode]);

  // Parse raw text or file content for WhiteNoise direct numbers
  const parseWnRawText = (text: string) => {
    if (!text.trim()) {
      setWnParsedPreview([]);
      return;
    }
    const lines = text.split(/[\r\n]+/);
    const seen = new Set<string>();
    const preview: Array<{ phone: string; country: string }> = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      // If line contains delimiter like comma or tab with a potential country name
      const parts = trimmed.split(/[,;\t]+/);
      let phonePart = parts[0]?.trim();
      let countryPart = parts[1]?.trim();

      // If parts[0] is not a number and parts[1] is a number (e.g. Country, Number)
      if (phonePart && !/^\+?\d+$/.test(phonePart.replace(/\s+/g, '')) && parts[1] && /^\+?\d+$/.test(parts[1].trim().replace(/\s+/g, ''))) {
        countryPart = parts[0].trim();
        phonePart = parts[1].trim();
      }

      if (phonePart) {
        const cleaned = cleanPhoneNumber(phonePart);
        const digitsOnly = cleaned.replace(/\D/g, '');
        if (digitsOnly.length >= 6 && digitsOnly.length <= 16) {
          if (!seen.has(cleaned)) {
            seen.add(cleaned);
            const detectedCountry = countryPart && isNaN(Number(countryPart)) ? countryPart : detectCountryFromPhone(cleaned);
            preview.push({
              phone: cleaned,
              country: detectedCountry || 'Unknown',
            });
          }
        }
      }
    }
    setWnParsedPreview(preview);
  };

  const handleWnFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setWnDirectFileName(file.name);
    try {
      const isSpreadsheet = /\.(xlsx|xls|csv|tsv)$/i.test(file.name);
      if (isSpreadsheet) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        const preview: Array<{ phone: string; country: string }> = [];
        const seen = new Set<string>();

        for (const row of rawJson) {
          if (!row || typeof row !== 'object') continue;
          let phoneVal = '';
          let countryVal = '';

          for (const [k, v] of Object.entries(row)) {
            const keyLower = k.toLowerCase().replace(/[^a-z]/g, '');
            const valStr = String(v).trim();
            if (!phoneVal && (keyLower.includes('phone') || keyLower.includes('number') || keyLower.includes('msisdn') || keyLower.includes('mobile') || keyLower.includes('num') || /^\+?\d{7,16}$/.test(valStr.replace(/\s+/g, '')))) {
              if (/^\+?\d{6,16}$/.test(valStr.replace(/\D/g, ''))) {
                phoneVal = valStr;
              }
            }
            if (!countryVal && (keyLower.includes('country') || keyLower.includes('nation') || keyLower.includes('range') || keyLower.includes('carrier'))) {
              if (valStr && isNaN(Number(valStr))) {
                countryVal = valStr;
              }
            }
          }

          if (phoneVal) {
            const cleaned = cleanPhoneNumber(phoneVal);
            if (!seen.has(cleaned)) {
              seen.add(cleaned);
              const finalCountry = countryVal || detectCountryFromPhone(cleaned);
              preview.push({
                phone: cleaned,
                country: finalCountry || 'Unknown',
              });
            }
          }
        }

        setWnParsedPreview(preview);
        setWnDirectRawText(preview.map(p => `${p.phone}, ${p.country}`).join('\n'));
        setWnNotice({
          type: 'info',
          text: `Loaded ${preview.length} numbers from "${file.name}" with auto-detected countries!`,
        });
      } else {
        const text = await file.text();
        setWnDirectRawText(text);
        parseWnRawText(text);
        setWnNotice({
          type: 'info',
          text: `Loaded text document "${file.name}"!`,
        });
      }
    } catch (err: any) {
      setWnNotice({
        type: 'error',
        text: `Failed to read file: ${err.message}`,
      });
    }
  };

  const handleSaveWnDirectNumbers = async () => {
    if (wnParsedPreview.length === 0) {
      setWnNotice({ type: 'error', text: 'No valid phone numbers found to import.' });
      return;
    }
    setIsWnSubmitting(true);
    setWnNotice({ type: 'info', text: `Saving ${wnParsedPreview.length} direct numbers into WhiteNoise pool...` });

    try {
      const res = await fetch('/api/whitenoise/direct-numbers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ numbers: wnParsedPreview }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setWnNotice({
          type: 'success',
          text: `Successfully added ${data.addedCount} new numbers (${data.updatedCount} updated). WhiteNoise auto-sync is now continuously polling these numbers!`,
        });
        setWnDirectRawText('');
        setWnDirectFileName(null);
        setWnParsedPreview([]);
        if (wnFileInputRef.current) wnFileInputRef.current.value = '';
        await fetchWnDirectNumbers();
      } else {
        setWnNotice({ type: 'error', text: data.error || 'Failed to save WhiteNoise numbers' });
      }
    } catch (err: any) {
      setWnNotice({ type: 'error', text: `Network error: ${err.message}` });
    } finally {
      setIsWnSubmitting(false);
    }
  };

  const handleDeleteWnDirectNumber = async (phone: string) => {
    try {
      const res = await fetch(`/api/whitenoise/direct-numbers/${encodeURIComponent(phone)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setWnDirectNumbers(prev => prev.filter(n => n.phone !== phone));
      }
    } catch {}
  };

  const handleClearAllWnDirectNumbers = async () => {
    if (!confirm('Are you sure you want to remove ALL direct WhiteNoise numbers? (Numbers inside ranges will remain untouched).')) {
      return;
    }
    try {
      const res = await fetch('/api/whitenoise/direct-numbers/clear', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setWnDirectNumbers([]);
        setWnNotice({ type: 'success', text: 'Cleared all direct WhiteNoise numbers from active pool.' });
      }
    } catch {}
  };

  // Multi-Range Document Importer State
  const [multiDocText, setMultiDocText] = useState<string>('');
  const [multiDocFileName, setMultiDocFileName] = useState<string | null>(null);
  const [isMultiDocDragging, setIsMultiDocDragging] = useState<boolean>(false);
  const [multiParseResult, setMultiParseResult] = useState<MultiRangeParseResult | null>(null);
  const [isMultiSubmitting, setIsMultiSubmitting] = useState<boolean>(false);
  const [multiImportSummaryModal, setMultiImportSummaryModal] = useState<{
    rangesCreated: number;
    rangesUpdated: number;
    totalNumbersProcessed: number;
    totalAdded: number;
    totalDuplicates: number;
    totalMoved: number;
    details: Array<{
      name: string;
      action: 'created' | 'updated';
      added: number;
      duplicates: number;
      moved: number;
      totalInRange: number;
      prefix: string;
      countryNote?: string;
    }>;
    message: string;
  } | null>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);

  // Mode: 'create' | 'existing'
  const [rangeMode, setRangeMode] = useState<'create' | 'existing'>('create');

  // Create Range Form Fields
  const [newRangeName, setNewRangeName] = useState('');
  const [newRangePrefix, setNewRangePrefix] = useState('');
  const [newRangeNote, setNewRangeNote] = useState('');

  // Add to Existing Range Form Fields
  const [selectedRangeId, setSelectedRangeId] = useState('');

  // Numbers Buffer
  const [numbersText, setNumbersText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ 
    type: 'success' | 'error' | 'info'; 
    text: string;
    conflictSample?: { number: string; reason: string }[];
  } | null>(null);

  // File Upload Drag & Drop State
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Security PIN Confirmation Modal State
  const [securityModal, setSecurityModal] = useState<SecurityModalState>({
    isOpen: false,
    type: 'delete_range',
    range: null,
    securityPin: '',
    error: null,
    isProcessing: false,
    showPin: false,
  });

  // Duplicate Inspection Preview State
  const [duplicateCheckResult, setDuplicateCheckResult] = useState<{
    totalChecked: number;
    newCount: number;
    duplicateCount: number;
    duplicates: { number: string; reason: string; isCurrentRange: boolean; rangeName?: string }[];
    uniqueNumbers?: string[];
  } | null>(null);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [isAuditingAllRanges, setIsAuditingAllRanges] = useState(false);
  const [auditResultModal, setAuditResultModal] = useState<{
    totalRanges: number;
    totalNumbersBefore: number;
    totalNumbersAfter: number;
    duplicatesRemoved: number;
    rangesModified: { id: string; name: string; prefix: string; beforeCount: number; afterCount: number; removedCount: number }[];
    sampleDuplicates: { number: string; keptInRange: string; removedFromRange: string }[];
    message: string;
  } | null>(null);

  // Manage Range Modal
  const [managingRange, setManagingRange] = useState<NumberRange | null>(null);
  const [rangeNumbers, setRangeNumbers] = useState<string[]>([]);
  const [isLoadingNumbers, setIsLoadingNumbers] = useState(false);
  const [numbersSearchQuery, setNumbersSearchQuery] = useState('');
  const [numbersPage, setNumbersPage] = useState(1);
  const [totalNumbersInModal, setTotalNumbersInModal] = useState(0);
  const [selectedNumbersForRemoval, setSelectedNumbersForRemoval] = useState<Set<string>>(new Set());
  const [isRemovingNumbers, setIsRemovingNumbers] = useState(false);

  // Quick add & bulk upload inside modal
  const [quickAddText, setQuickAddText] = useState('');
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [isModalBulkOpen, setIsModalBulkOpen] = useState(false);
  const [modalBulkText, setModalBulkText] = useState('');
  const [modalBulkFileName, setModalBulkFileName] = useState<string | null>(null);
  const [isModalBulkSubmitting, setIsModalBulkSubmitting] = useState(false);
  const modalFileInputRef = useRef<HTMLInputElement>(null);
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);

  // Range CLI Access Modal (Manage which blocked CLIs have permission on this range)
  const [cliAccessModal, setCliAccessModal] = useState<{
    isOpen: boolean;
    range: NumberRange | null;
    allowedClis: string[];
    newCliInput: string;
    isSaving: boolean;
    feedback: string | null;
  }>({
    isOpen: false,
    range: null,
    allowedClis: [],
    newCliInput: '',
    isSaving: false,
    feedback: null,
  });
  const [availableFilterRules, setAvailableFilterRules] = useState<any[]>([]);

  const fetchFilterRules = async () => {
    try {
      const res = await fetch('/api/client-filters', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAvailableFilterRules(data.rules || []);
      }
    } catch {
      // ignore
    }
  };

  const handleOpenRangeCliAccess = (range: NumberRange) => {
    fetchFilterRules();
    setCliAccessModal({
      isOpen: true,
      range,
      allowedClis: Array.isArray(range.allowedBlockedClis) ? [...range.allowedBlockedClis] : [],
      newCliInput: '',
      isSaving: false,
      feedback: null,
    });
  };

  const handleToggleAllowedCli = (pattern: string) => {
    const clean = pattern.trim();
    if (!clean) return;
    setCliAccessModal(prev => ({
      ...prev,
      allowedClis: prev.allowedClis.includes(clean)
        ? prev.allowedClis.filter(c => c !== clean)
        : [...prev.allowedClis, clean],
    }));
  };

  const handleAddCustomAllowedCli = () => {
    const clean = cliAccessModal.newCliInput.trim();
    if (!clean) return;
    if (!cliAccessModal.allowedClis.includes(clean)) {
      setCliAccessModal(prev => ({
        ...prev,
        allowedClis: [...prev.allowedClis, clean],
        newCliInput: '',
      }));
    } else {
      setCliAccessModal(prev => ({ ...prev, newCliInput: '' }));
    }
  };

  const handleSaveRangeCliAccess = async () => {
    if (!cliAccessModal.range) return;
    setCliAccessModal(prev => ({ ...prev, isSaving: true, feedback: null }));
    try {
      const res = await fetch(`/api/ranges/${cliAccessModal.range.id}/cli-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          allowedBlockedClis: cliAccessModal.allowedClis,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCliAccessModal(prev => ({ ...prev, isSaving: false, feedback: 'Saved successfully!' }));
        fetchRanges();
        setTimeout(() => {
          setCliAccessModal(prev => ({ ...prev, isOpen: false }));
        }, 800);
      } else {
        setCliAccessModal(prev => ({ ...prev, isSaving: false, feedback: data.error || 'Failed to save' }));
      }
    } catch {
      setCliAccessModal(prev => ({ ...prev, isSaving: false, feedback: 'Network error' }));
    }
  };

  // Fetch all ranges
  const fetchRanges = async () => {
    setIsLoadingRanges(true);
    try {
      const res = await fetch('/api/ranges', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const loadedRanges: NumberRange[] = (data.ranges || []).sort((a: NumberRange, b: NumberRange) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
        );
        setRanges(loadedRanges);
        if (loadedRanges.length > 0 && !selectedRangeId) {
          setSelectedRangeId(loadedRanges[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load number ranges', err);
    } finally {
      setIsLoadingRanges(false);
    }
  };

  useEffect(() => {
    fetchRanges();
  }, [token]);

  // Parse raw text into valid clean phone numbers
  const extractNumbersFromText = (raw: string): string[] => {
    if (!raw) return [];
    // Split by newlines, commas, semicolons, tabs, spaces
    const tokens = raw.split(/[\r\n,;\t]+/);
    const cleaned: string[] = [];
    for (const tok of tokens) {
      const digits = tok.replace(/[^\d]/g, '');
      if (digits.length >= 5) {
        cleaned.push(digits);
      }
    }
    return cleaned;
  };

  const parsedNumbers = extractNumbersFromText(numbersText);

  // Handle Drag & Drop / File Upload
  const processUploadedFile = async (file: File) => {
    setUploadedFileName(file.name);
    setStatusMessage({ type: 'info', text: `Reading file: ${file.name}...` });

    try {
      const extension = file.name.split('.').pop()?.toLowerCase();

      if (extension === 'xlsx' || extension === 'xls') {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        const rawCsv = jsonData
          .map((r) => (Array.isArray(r) ? r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',') : ''))
          .join('\n');
        const multiCheck = parseMultiRangeDocument(rawCsv);
        if (multiCheck.totalRanges > 1 || multiCheck.detectedHeaders) {
          setActiveTabMode('document');
          setMultiDocText(rawCsv);
          setMultiDocFileName(file.name);
          setMultiParseResult(multiCheck);
          setStatusMessage({
            type: 'success',
            text: `Multi-Range Spreadsheet Detected: Identified ${multiCheck.totalRanges} Range(s) and ${multiCheck.totalNumbers.toLocaleString()} numbers! Switched to Auto Multi-Range Importer.`,
          });
          return;
        }

        const extracted: string[] = [];
        for (const row of jsonData) {
          if (Array.isArray(row)) {
            for (const cell of row) {
              if (cell !== undefined && cell !== null) {
                const digits = String(cell).replace(/[^\d]/g, '');
                if (digits.length >= 5) {
                  extracted.push(digits);
                }
              }
            }
          }
        }

        if (extracted.length > 0) {
          const newText = extracted.join('\n');
          setNumbersText(prev => prev ? prev.trim() + '\n' + newText : newText);
          setStatusMessage({
            type: 'success',
            text: `Successfully extracted ${extracted.length.toLocaleString()} numbers from ${file.name}`,
          });
        } else {
          setStatusMessage({
            type: 'error',
            text: `No valid mobile numbers found in ${file.name}. Ensure cells contain numeric MSISDNs.`,
          });
        }
      } else {
        // Text, CSV, CXV, TSV
        const text = await file.text();

        const multiCheck = parseMultiRangeDocument(text);
        if (multiCheck.totalRanges > 1 || multiCheck.detectedHeaders) {
          setActiveTabMode('document');
          setMultiDocText(text);
          setMultiDocFileName(file.name);
          setMultiParseResult(multiCheck);
          setStatusMessage({
            type: 'success',
            text: `Multi-Range Document Detected: Identified ${multiCheck.totalRanges} Range(s) and ${multiCheck.totalNumbers.toLocaleString()} numbers! Switched to Auto Multi-Range Importer.`,
          });
          return;
        }

        const extracted = extractNumbersFromText(text);
        if (extracted.length > 0) {
          const newText = extracted.join('\n');
          setNumbersText(prev => prev ? prev.trim() + '\n' + newText : newText);
          setStatusMessage({
            type: 'success',
            text: `Successfully extracted ${extracted.length.toLocaleString()} numbers from ${file.name}`,
          });
        } else {
          setStatusMessage({
            type: 'error',
            text: `No numbers with 5+ digits could be identified in ${file.name}`,
          });
        }
      }
    } catch (err: any) {
      console.error('File parsing error', err);
      setStatusMessage({
        type: 'error',
        text: `Failed to parse file ${file.name}: ${err?.message || 'Invalid format'}`,
      });
    }
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processUploadedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processUploadedFile(e.target.files[0]);
    }
  };

  // --- MULTI-RANGE AUTO DOCUMENT IMPORTER HANDLERS ---
  const handleMultiTextChange = (text: string) => {
    setMultiDocText(text);
    if (!text.trim()) {
      setMultiParseResult(null);
      return;
    }
    const parsed = parseMultiRangeDocument(text);
    setMultiParseResult(parsed);
  };

  const processMultiDocumentFile = async (file: File) => {
    setMultiDocFileName(file.name);
    setStatusMessage({ type: 'info', text: `Analyzing document: ${file.name}...` });

    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      let rawContent = '';

      if (ext === 'xlsx' || ext === 'xls') {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        rawContent = rows
          .map((r) => (Array.isArray(r) ? r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',') : ''))
          .join('\n');
      } else {
        rawContent = await file.text();
      }

      setMultiDocText(rawContent);
      const parsed = parseMultiRangeDocument(rawContent);
      setMultiParseResult(parsed);

      if (parsed.items.length > 0) {
        setStatusMessage({
          type: 'success',
          text: `Document ready: Identified ${parsed.totalRanges} Range(s) and ${parsed.totalNumbers.toLocaleString()} numbers from "${file.name}"!`,
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: `No valid range-number rows identified in "${file.name}". Ensure it contains range names and phone numbers.`,
        });
      }
    } catch (err: any) {
      console.error(err);
      setStatusMessage({
        type: 'error',
        text: `Failed to read file ${file.name}: ${err?.message || 'Invalid format'}`,
      });
    }
  };

  const handleMultiFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsMultiDocDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processMultiDocumentFile(e.dataTransfer.files[0]);
    }
  };

  const handleMultiFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processMultiDocumentFile(e.target.files[0]);
    }
  };

  const handleClearMultiDoc = () => {
    setMultiDocText('');
    setMultiDocFileName(null);
    setMultiParseResult(null);
    if (multiFileInputRef.current) multiFileInputRef.current.value = '';
    setStatusMessage(null);
  };

  const handleDownloadMultiSampleCsv = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      encodeURIComponent(
        '"","Range","Prefix","Number"\n' +
        '"","Nigeria Airtel - Saturn BT1","234","2348083578665"\n' +
        '"","Nigeria Airtel - Saturn BT1","234","2348083580837"\n' +
        '"","Nigeria MTN - Orion","234","2348031234567"\n' +
        '"","Pakistan Jazz - Special","92","923001234567"\n' +
        '"","Tanzania Vodacom - Prime","255","255744123456"\n'
      );
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', 'multi_range_bulk_import_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleMultiImportSubmit = async () => {
    if (!multiParseResult || multiParseResult.items.length === 0) {
      setStatusMessage({ type: 'error', text: 'No ranges detected to import. Please upload or paste a document first.' });
      return;
    }

    setIsMultiSubmitting(true);
    setStatusMessage({
      type: 'info',
      text: `Importing ${multiParseResult.totalRanges} ranges and ${multiParseResult.totalNumbers.toLocaleString()} numbers...`,
    });

    try {
      const res = await fetch('/api/ranges/multi-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ items: multiParseResult.items }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setMultiImportSummaryModal({
          rangesCreated: data.rangesCreated || 0,
          rangesUpdated: data.rangesUpdated || 0,
          totalNumbersProcessed: data.totalNumbersProcessed || 0,
          totalAdded: data.totalAdded || 0,
          totalDuplicates: data.totalDuplicates || 0,
          totalMoved: data.totalMoved || 0,
          details: data.details || [],
          message: data.message || 'Multi-range import completed successfully!',
        });

        setStatusMessage({
          type: 'success',
          text: data.message || `Successfully processed ${data.totalNumbersProcessed.toLocaleString()} numbers across ${data.details?.length || 0} ranges!`,
        });

        // Clear buffer
        setMultiDocText('');
        setMultiDocFileName(null);
        setMultiParseResult(null);
        if (multiFileInputRef.current) multiFileInputRef.current.value = '';

        // Reload ranges
        await fetchRanges();
      } else {
        setStatusMessage({
          type: 'error',
          text: data.error || 'Failed to import ranges',
        });
      }
    } catch (err: any) {
      console.error(err);
      setStatusMessage({
        type: 'error',
        text: `Network error during multi-range import: ${err?.message || 'Connection failed'}`,
      });
    } finally {
      setIsMultiSubmitting(false);
    }
  };

  // Sample CSV generator for telecoms
  const handleDownloadSampleCsv = () => {
    const csvContent = 'data:text/csv;charset=utf-8,' + 
      'msisdn,country,carrier\n' +
      '224610351009,Guinea,Orange\n' +
      '224622114455,Guinea,Orange\n' +
      '224628990011,Guinea,Orange\n' +
      '224611223344,Guinea,Orange\n' +
      '255744123456,Tanzania,Vodacom\n' +
      '255744123457,Tanzania,Vodacom\n';
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'telecom_bulk_numbers_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Quick Tools: Deduplicate
  const handleDeduplicateBuffer = () => {
    const currentList = extractNumbersFromText(numbersText);
    if (currentList.length === 0) return;

    const uniqueSet = new Set<string>();
    const uniqueList: string[] = [];
    let dupsCount = 0;

    for (const num of currentList) {
      if (uniqueSet.has(num)) {
        dupsCount++;
      } else {
        uniqueSet.add(num);
        uniqueList.push(num);
      }
    }

    setNumbersText(uniqueList.join('\n'));
    setStatusMessage({
      type: 'info',
      text: dupsCount > 0 
        ? `Cleaned buffer: Removed ${dupsCount} duplicate numbers. ${uniqueList.length} unique numbers remaining.`
        : `No duplicate numbers found in buffer. All ${uniqueList.length} numbers are unique.`,
    });
  };

  // Clean non-digits
  const handleCleanNonDigits = () => {
    const currentList = extractNumbersFromText(numbersText);
    setNumbersText(currentList.join('\n'));
    setStatusMessage({
      type: 'info',
      text: `Cleaned formatting on ${currentList.length} numbers.`,
    });
  };

  // Clear buffer
  const handleClearBuffer = () => {
    setNumbersText('');
    setUploadedFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setStatusMessage(null);
  };

  // Submit numbers to backend
  const handleSubmit = async () => {
    if (parsedNumbers.length === 0) {
      setStatusMessage({ type: 'error', text: 'Please enter or upload at least one valid phone number.' });
      return;
    }

    if (rangeMode === 'create') {
      if (!newRangeName.trim()) {
        setStatusMessage({ type: 'error', text: 'Please provide a Range Name (e.g. Tanzania LX 26Aug, Guinea Orange).' });
        return;
      }
      if (!newRangePrefix.trim()) {
        setStatusMessage({ type: 'error', text: 'Please provide a Country Prefix (e.g. 255, 224, 380).' });
        return;
      }
    } else {
      if (!selectedRangeId) {
        setStatusMessage({ type: 'error', text: 'Please select an existing range from the list.' });
        return;
      }
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const payload = rangeMode === 'create' ? {
        mode: 'create',
        name: newRangeName.trim(),
        prefix: newRangePrefix.trim().replace(/[^\d]/g, ''),
        countryNote: newRangeNote.trim() || undefined,
        numbers: parsedNumbers,
      } : {
        mode: 'existing',
        rangeId: selectedRangeId,
        numbers: parsedNumbers,
      };

      const res = await fetch('/api/ranges', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to assign numbers');
      }

      setStatusMessage({
        type: 'success',
        text: data.message || `Successfully processed numbers! Added ${data.addedCount} new numbers (${data.duplicateCount} duplicates skipped).`,
      });

      // Clear buffer & reset form on success
      setNumbersText('');
      setUploadedFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (rangeMode === 'create') {
        setNewRangeName('');
        setNewRangePrefix('');
        setNewRangeNote('');
      }

      // Refresh ranges list
      await fetchRanges();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Error communicating with server',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Numbers Management Modal for a Range
  const handleOpenManageRange = async (range: NumberRange) => {
    setManagingRange(range);
    setNumbersPage(1);
    setNumbersSearchQuery('');
    setSelectedNumbersForRemoval(new Set());
    await fetchRangeNumbers(range.id, '', 1);
  };

  const fetchRangeNumbers = async (rangeId: string, search: string, page: number) => {
    setIsLoadingNumbers(true);
    try {
      const q = new URLSearchParams({
        search,
        page: String(page),
        limit: '50',
      });
      const res = await fetch(`/api/ranges/${rangeId}/numbers?${q.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRangeNumbers(data.numbers || []);
        setTotalNumbersInModal(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to load range numbers', err);
    } finally {
      setIsLoadingNumbers(false);
    }
  };

  // Remove individual or bulk numbers from range
  const handleRemoveNumbers = async (numbersToRemove: string[]) => {
    if (!managingRange || numbersToRemove.length === 0) return;
    if (!confirm(`Are you sure you want to remove ${numbersToRemove.length} number(s) from "${managingRange.name}"?`)) {
      return;
    }

    setIsRemovingNumbers(true);
    try {
      const res = await fetch(`/api/ranges/${managingRange.id}/numbers`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ numbers: numbersToRemove }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        // Refresh list
        setSelectedNumbersForRemoval(new Set());
        await fetchRangeNumbers(managingRange.id, numbersSearchQuery, numbersPage);
        await fetchRanges();
      } else {
        alert(data.error || 'Failed to remove numbers');
      }
    } catch (err) {
      console.error(err);
      alert('Network error removing numbers');
    } finally {
      setIsRemovingNumbers(false);
    }
  };

  // Quick add numbers inside modal
  const handleQuickAddInsideModal = async () => {
    if (!managingRange) return;
    const nums = extractNumbersFromText(quickAddText);
    if (nums.length === 0) {
      alert('Please enter at least one valid phone number');
      return;
    }

    setIsQuickAdding(true);
    try {
      const res = await fetch(`/api/ranges/${managingRange.id}/numbers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ numbers: nums }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setQuickAddText('');
        const feedbackMsg = data.message || (
          data.movedCount > 0
            ? `Successfully processed ${data.addedCount} numbers (${data.movedCount} numbers automatically moved from previous range).`
            : `Successfully added ${data.addedCount} numbers to range "${managingRange.name}".`
        );
        setStatusMessage({ type: 'success', text: feedbackMsg });
        await fetchRangeNumbers(managingRange.id, numbersSearchQuery, numbersPage);
        await fetchRanges();
      } else {
        alert(data.error || 'Failed to add numbers');
      }
    } catch (err) {
      console.error(err);
      alert('Network error adding numbers');
    } finally {
      setIsQuickAdding(false);
    }
  };

  // Bulk File Upload inside modal
  const handleModalBulkFileUpload = async (file: File) => {
    setModalBulkFileName(file.name);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      let textContent = '';

      if (['xlsx', 'xls'].includes(ext)) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        const allTokens: string[] = [];
        for (const row of rows) {
          if (Array.isArray(row)) {
            for (const cell of row) {
              if (cell !== null && cell !== undefined) {
                allTokens.push(String(cell));
              }
            }
          }
        }
        textContent = allTokens.join('\n');
      } else {
        textContent = await file.text();
      }

      const extracted = extractNumbersFromText(textContent);
      if (extracted.length === 0) {
        alert('No valid numbers found in the uploaded file.');
        return;
      }

      setModalBulkText(extracted.join('\n'));
    } catch (err: any) {
      console.error(err);
      alert(`Error reading file: ${err.message}`);
    }
  };

  // Bulk submit inside modal
  const handleModalBulkSubmit = async () => {
    if (!managingRange) return;
    const nums = extractNumbersFromText(modalBulkText);
    if (nums.length === 0) {
      alert('Please enter or upload at least one valid phone number.');
      return;
    }

    setIsModalBulkSubmitting(true);
    try {
      const res = await fetch(`/api/ranges/${managingRange.id}/numbers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ numbers: nums }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setModalBulkText('');
        setModalBulkFileName(null);
        if (modalFileInputRef.current) modalFileInputRef.current.value = '';
        setIsModalBulkOpen(false);

        const feedbackMsg = data.message || (
          data.movedCount > 0
            ? `Successfully processed ${data.addedCount} numbers (${data.movedCount} numbers automatically transferred from previous range).`
            : `Successfully added all ${data.addedCount} numbers to range "${managingRange.name}".`
        );
        setStatusMessage({ type: 'success', text: feedbackMsg });

        await fetchRangeNumbers(managingRange.id, numbersSearchQuery, numbersPage);
        await fetchRanges();
      } else {
        alert(data.error || 'Failed to add numbers to range');
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    } finally {
      setIsModalBulkSubmitting(false);
    }
  };

  // Trigger Security PIN Modal for Range Delete
  const requestDeleteRange = (range: NumberRange) => {
    setSecurityModal({
      isOpen: true,
      type: 'delete_range',
      range,
      securityPin: '',
      error: null,
      isProcessing: false,
      showPin: false,
    });
  };

  // Trigger Security PIN Modal for Remove All Numbers
  const requestClearAllNumbers = (range: NumberRange) => {
    setSecurityModal({
      isOpen: true,
      type: 'clear_all_numbers',
      range,
      securityPin: '',
      error: null,
      isProcessing: false,
      showPin: false,
    });
  };

  // Execute Security PIN Action
  const handleExecuteSecurityAction = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!securityModal.range) return;
    const pin = securityModal.securityPin.trim();
    if (!pin) {
      setSecurityModal(prev => ({ ...prev, error: 'Security Master PIN is required.' }));
      return;
    }

    setSecurityModal(prev => ({ ...prev, isProcessing: true, error: null }));

    try {
      const rangeId = encodeURIComponent(securityModal.range.id);

      if (securityModal.type === 'delete_range') {
        // Use POST /api/ranges/:id/delete to avoid proxy issues with DELETE bodies
        const res = await fetch(`/api/ranges/${rangeId}/delete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'X-Security-PIN': pin,
          },
          body: JSON.stringify({ securityPin: pin }),
        });

        let data: any = {};
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          data = await res.json().catch(() => ({}));
        } else {
          const text = await res.text().catch(() => '');
          const cleanText = text.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
          data = { error: cleanText || `Server responded with status ${res.status}` };
        }

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to delete range. Please verify Security PIN.');
        }

        // Successfully deleted
        if (managingRange?.id === securityModal.range.id) {
          setManagingRange(null);
        }
        setSecurityModal(prev => ({ ...prev, isOpen: false }));
        setStatusMessage({
          type: 'success',
          text: data.message || `Range "${securityModal.range.name}" and all associated numbers deleted successfully.`,
        });
        await fetchRanges();

      } else if (securityModal.type === 'clear_all_numbers') {
        const res = await fetch(`/api/ranges/${rangeId}/clear-numbers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'X-Security-PIN': pin,
          },
          body: JSON.stringify({ securityPin: pin }),
        });

        let data: any = {};
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          data = await res.json().catch(() => ({}));
        } else {
          const text = await res.text().catch(() => '');
          const cleanText = text.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
          data = { error: cleanText || `Server responded with status ${res.status}` };
        }

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to remove numbers. Please verify Security PIN.');
        }

        // Successfully cleared numbers
        setSecurityModal(prev => ({ ...prev, isOpen: false }));
        setStatusMessage({
          type: 'success',
          text: data.message || `Removed all numbers from range "${securityModal.range.name}". Range configuration is preserved.`,
        });

        if (managingRange?.id === securityModal.range.id) {
          setManagingRange(data.range || { ...securityModal.range, numbers: [], totalNumbers: 0 });
          setRangeNumbers([]);
          setTotalNumbersInModal(0);
          setSelectedNumbersForRemoval(new Set());
        }
        await fetchRanges();
      }
    } catch (err: any) {
      setSecurityModal(prev => ({
        ...prev,
        error: err.message || 'Operation failed. Incorrect Security PIN.',
        isProcessing: false,
      }));
    }
  };

  // Inspect duplicate conflicts against global database
  const handleCheckDuplicates = async () => {
    if (parsedNumbers.length === 0) return;
    setIsCheckingDuplicates(true);
    try {
      const res = await fetch('/api/ranges/check-duplicates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          numbers: parsedNumbers,
          targetRangeId: rangeMode === 'existing' ? selectedRangeId : undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setDuplicateCheckResult(data);
        if (data.duplicateCount > 0) {
          setStatusMessage({
            type: 'info',
            text: `Detected ${data.duplicateCount} duplicate number(s) across ranges. Click "Auto-Clean Duplicates" to strip them automatically.`,
          });
        } else {
          setStatusMessage({
            type: 'success',
            text: `100% Unique: All ${data.newCount} numbers are completely unique across all ranges.`,
          });
        }
      }
    } catch (err) {
      console.error('Failed to check duplicates', err);
    } finally {
      setIsCheckingDuplicates(false);
    }
  };

  // 1-Click Auto-Clean all duplicates from buffer across all ranges
  const handleAutoCleanAllDuplicates = async () => {
    if (parsedNumbers.length === 0) return;
    setIsCheckingDuplicates(true);
    try {
      const res = await fetch('/api/ranges/check-duplicates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          numbers: parsedNumbers,
          targetRangeId: rangeMode === 'existing' ? selectedRangeId : undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const validList: string[] = data.uniqueNumbers || [];
        setNumbersText(validList.join('\n'));
        setDuplicateCheckResult(data);
        setStatusMessage({
          type: data.duplicateCount > 0 ? 'success' : 'info',
          text: data.duplicateCount > 0
            ? `Auto-removed ${data.duplicateCount} duplicate number(s)! ${validList.length} unique numbers remaining in buffer.`
            : `Buffer verified: All ${validList.length} numbers are 100% unique across all ranges.`,
        });
      }
    } catch (err) {
      console.error('Failed to auto clean duplicates', err);
    } finally {
      setIsCheckingDuplicates(false);
    }
  };

  // Audit and permanently deduplicate all ranges in the system (1 Number = 1 Range Only rule)
  const handleAuditAndDeduplicateAll = async () => {
    if (!confirm('This will audit all configured ranges across the system and permanently remove any duplicate numbers across ranges, guaranteeing that every number belongs to only 1 range. Proceed?')) {
      return;
    }
    setIsAuditingAllRanges(true);
    try {
      const res = await fetch('/api/ranges/deduplicate-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAuditResultModal(data);
        setStatusMessage({
          type: 'success',
          text: data.message,
        });
        await fetchRanges();
      } else {
        alert(data.error || 'Audit operation failed');
      }
    } catch (err: any) {
      alert(`Error auditing ranges: ${err.message}`);
    } finally {
      setIsAuditingAllRanges(false);
    }
  };

  // Export Range Numbers to CSV
  const handleExportRangeCsv = (range: NumberRange) => {
    if (!range.numbers || range.numbers.length === 0) {
      alert('This range has no numbers to export.');
      return;
    }
    const headers = ['Phone Number (MSISDN)', 'Range Name', 'Country Prefix', 'Carrier / Note'];
    const rows = range.numbers.map(num => [
      `"${num}"`,
      `"${range.name}"`,
      `"+${range.prefix}"`,
      `"${range.countryNote || ''}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `${range.name.replace(/\s+/g, '_')}_numbers.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter ranges and sort alphabetically A to Z
  const filteredRanges = ranges
    .filter(r => {
      if (!rangesSearch.trim()) return true;
      const q = rangesSearch.toLowerCase();
      return (
        r.name.toLowerCase().includes(q) ||
        r.prefix.includes(q) ||
        (r.countryNote && r.countryNote.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));

  return (
    <div className="space-y-6 pb-12" id="bulk-numbers-container">
      {/* Top Banner & Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Add Bulk Numbers</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                  Batch Manager
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
                Upload number batch files (CSV, CXV, TXT, TSV) from telecom providers to create a new range or append to an existing range.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleAuditAndDeduplicateAll}
              disabled={isAuditingAllRanges || ranges.length === 0}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-950/80 border border-emerald-500/40 hover:bg-emerald-900/60 text-emerald-300 hover:text-white text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
              title="Audit all ranges and remove duplicate numbers across ranges"
              id="audit-deduplicate-all-ranges-btn"
            >
              <ShieldCheck className={`w-3.5 h-3.5 text-emerald-400 ${isAuditingAllRanges ? 'animate-spin' : ''}`} />
              <span>{isAuditingAllRanges ? 'Auditing Ranges...' : 'Audit & Clean All Ranges'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadSampleCsv}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
              id="download-sample-csv-btn"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span>Download Sample CSV</span>
            </button>

            <button
              type="button"
              onClick={fetchRanges}
              disabled={isLoadingRanges}
              className="inline-flex items-center justify-center p-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-all disabled:opacity-50"
              title="Refresh ranges list"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingRanges ? 'animate-spin text-blue-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Status Toast Banner */}
        {statusMessage && (
          <div 
            className={`mt-4 p-3 rounded-xl border flex items-center justify-between gap-3 text-xs font-medium animate-fadeIn ${
              statusMessage.type === 'success' 
                ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300' 
                : statusMessage.type === 'error'
                ? 'bg-rose-950/80 border-rose-500/40 text-rose-300'
                : 'bg-blue-950/80 border-blue-500/40 text-blue-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : statusMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              ) : (
                <RefreshCw className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-white text-sm"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Primary Workspace Mode Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-1.5 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-lg">
        <div className="flex items-center gap-1.5 flex-1">
          <button
            type="button"
            onClick={() => setActiveTabMode('document')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3.5 sm:px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTabMode === 'document'
                ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 text-white shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
            id="mode-tab-document"
          >
            <Sparkles className="w-4 h-4 text-emerald-300" />
            <span>Auto Multi-Range Document Importer</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 uppercase font-mono hidden md:inline-block">
              Auto Setup
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTabMode('manual')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3.5 sm:px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTabMode === 'manual'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/40 ring-1 ring-blue-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
            id="mode-tab-manual"
          >
            <Layers className="w-4 h-4" />
            <span>Single Range Manual Setup</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTabMode('whitenoise-direct')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3.5 sm:px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTabMode === 'whitenoise-direct'
                ? 'bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600 text-white shadow-lg shadow-orange-950/40 ring-1 ring-amber-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
            id="mode-tab-whitenoise-direct"
          >
            <Zap className="w-4 h-4 text-amber-300" />
            <span>WhiteNoise Direct Bulk (Bina Range)</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/90 border border-amber-500/40 text-amber-300 uppercase font-mono hidden md:inline-block">
              Auto Country Detect
            </span>
          </button>
        </div>
      </div>

      {activeTabMode === 'whitenoise-direct' ? (
        <div className="space-y-6 animate-fadeIn">
          {wnNotice && (
            <div 
              className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs font-medium ${
                wnNotice.type === 'success' 
                  ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300' 
                  : wnNotice.type === 'error'
                  ? 'bg-rose-950/80 border-rose-500/40 text-rose-300'
                  : 'bg-amber-950/80 border-amber-500/40 text-amber-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{wnNotice.text}</span>
              </div>
              <button 
                type="button" 
                onClick={() => setWnNotice(null)} 
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT: Import Form & Preview */}
            <div className="lg:col-span-7 space-y-5">
              <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <span>WhiteNoise Direct Numbers</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-500/40 font-mono">
                          Bina Range / Direct
                        </span>
                      </h2>
                      <p className="text-[11px] text-slate-400">
                        Add numbers directly without binding to a range. Country is automatically detected from prefix or read from file.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Upload Document / File */}
                <div>
                  <input
                    type="file"
                    ref={wnFileInputRef}
                    accept=".xlsx,.xls,.csv,.txt,.tsv"
                    onChange={handleWnFileUpload}
                    className="hidden"
                    id="wn-direct-file-input"
                  />
                  <div
                    onClick={() => wnFileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-700 hover:border-amber-500/60 rounded-xl p-4 text-center cursor-pointer transition-colors bg-slate-950/40 hover:bg-amber-950/10 group"
                  >
                    <FileUp className="w-6 h-6 text-slate-400 group-hover:text-amber-400 mx-auto mb-1 transition-colors" />
                    <div className="text-xs font-semibold text-slate-300 group-hover:text-white">
                      {wnDirectFileName ? wnDirectFileName : 'Click to upload Excel (.xlsx), CSV, or TXT file'}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Auto-reads phone & country columns, or detects country by prefix
                    </div>
                  </div>
                </div>

                {/* Raw Paste Textarea */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                      Or Paste Raw Numbers Directly
                    </label>
                    {wnParsedPreview.length > 0 && (
                      <span className="text-[10px] font-mono font-bold text-amber-400">
                        {wnParsedPreview.length} numbers detected
                      </span>
                    )}
                  </div>
                  <textarea
                    rows={6}
                    value={wnDirectRawText}
                    onChange={(e) => {
                      setWnDirectRawText(e.target.value);
                      parseWnRawText(e.target.value);
                    }}
                    placeholder={`+959686338504\n+224610351009\n+2348083578665\n\nOr with country names:\n+959686338504, Myanmar\n+224610351009, Guinea`}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-xs placeholder-slate-600 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Live Parsed Preview Table */}
                {wnParsedPreview.length > 0 && (
                  <div className="space-y-2 bg-slate-950/80 border border-slate-800 rounded-xl p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-300">
                        Parsed Numbers Preview ({wnParsedPreview.length}):
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setWnParsedPreview([]);
                          setWnDirectRawText('');
                          setWnDirectFileName(null);
                        }}
                        className="text-[10px] text-slate-500 hover:text-slate-300"
                      >
                        Clear
                      </button>
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-1 font-mono text-xs">
                      {wnParsedPreview.slice(0, 30).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-1.5 rounded bg-slate-900 border border-slate-800/80 text-[11px]">
                          <span className="text-slate-400 font-bold w-6">{idx + 1}</span>
                          <span className="text-white font-semibold flex-1">{item.phone}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-sans">
                            {item.country}
                          </span>
                        </div>
                      ))}
                      {wnParsedPreview.length > 30 && (
                        <div className="text-[10px] text-slate-500 text-center py-1 font-sans">
                          +{wnParsedPreview.length - 30} more numbers ready to import
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleSaveWnDirectNumbers}
                      disabled={isWnSubmitting}
                      className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs shadow-lg shadow-amber-950/40 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Zap className="w-4 h-4 text-white" />
                      <span>{isWnSubmitting ? 'Saving Numbers...' : `Save ${wnParsedPreview.length} Numbers to WhiteNoise Pool`}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: Active WhiteNoise Direct Pool */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      WhiteNoise Active Pool
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    {wnDirectNumbers.length} Polling
                  </span>
                </div>

                {/* Filter and Clear */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={wnSearch}
                      onChange={(e) => setWnSearch(e.target.value)}
                      placeholder="Search phone or country..."
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none focus:border-amber-500 font-sans"
                    />
                  </div>
                  {wnDirectNumbers.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllWnDirectNumbers}
                      className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-bold cursor-pointer"
                      title="Clear all direct numbers"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Direct Numbers List */}
                <div className="space-y-1.5 max-h-[550px] overflow-y-auto pr-1">
                  {isLoadingWnDirect ? (
                    <div className="text-center py-8 text-xs text-slate-500 flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                      <span>Loading active numbers...</span>
                    </div>
                  ) : wnDirectNumbers.length === 0 ? (
                    <div className="text-center py-10 text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-dashed border-slate-800 p-4">
                      No direct numbers in WhiteNoise pool yet. Paste or upload numbers on the left to start syncing!
                    </div>
                  ) : (
                    wnDirectNumbers
                      .filter(n => {
                        if (!wnSearch.trim()) return true;
                        const q = wnSearch.toLowerCase();
                        return n.phone.toLowerCase().includes(q) || n.country.toLowerCase().includes(q);
                      })
                      .map((n, i) => (
                        <div
                          key={n.phone}
                          className="flex items-center justify-between p-2.5 bg-slate-950/70 border border-slate-800/80 rounded-xl hover:border-slate-700 transition-colors text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-slate-500 w-5">{i + 1}</span>
                            <div>
                              <div className="font-mono font-bold text-white tracking-wide">{n.phone}</div>
                              <div className="text-[10px] text-amber-400 font-sans">{n.country}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {n.totalSynced ? (
                              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-500/30">
                                {n.totalSynced} SMS
                              </span>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => handleDeleteWnDirectNumber(n.phone)}
                              className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Delete number"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Main Grid: Left is Form (Range Selection & Batch Upload), Right is Range Stats & Existing Ranges */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Input & Upload Form */}
        <div className="lg:col-span-7 space-y-6">
          {activeTabMode === 'document' ? (
            /* MULTI-RANGE AUTO DOCUMENT IMPORTER CARD */
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <span>Multi-Range Document Importer</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-mono">
                        Instant Setup
                      </span>
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      Upload your document or paste CSV. System automatically detects range names, prefixes, and indexes numbers!
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadMultiSampleCsv}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer self-start sm:self-auto"
                  title="Download sample CSV with Range, Prefix, Number"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Sample CSV Template</span>
                </button>
              </div>

              {/* File Dropzone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsMultiDocDragging(true); }}
                onDragLeave={() => setIsMultiDocDragging(false)}
                onDrop={handleMultiFileDrop}
                onClick={() => multiFileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-5 sm:p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2.5 ${
                  isMultiDocDragging
                    ? 'border-emerald-500 bg-emerald-950/30 scale-[1.01]'
                    : 'border-slate-800 bg-slate-950/60 hover:border-emerald-500/50 hover:bg-slate-950'
                }`}
              >
                <input
                  ref={multiFileInputRef}
                  type="file"
                  accept=".csv,.cxv,.txt,.tsv,.xlsx,.xls"
                  onChange={handleMultiFileSelect}
                  className="hidden"
                  id="multi-doc-hidden-input"
                />

                <div className="w-11 h-11 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-950/30">
                  <UploadCloud className="w-5 h-5" />
                </div>

                <div>
                  <p className="text-xs font-semibold text-white">
                    {multiDocFileName ? (
                      <span className="text-emerald-400 font-mono">Active Document: {multiDocFileName}</span>
                    ) : (
                      <span>Drop your Multi-Range CSV, TXT, or Excel file here or click to browse</span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Supports &quot;Range&quot;, &quot;Prefix&quot;, &quot;Number&quot; columns from spreadsheet exports.
                  </p>
                </div>
              </div>

              {/* Paste Document Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Paste Document / Spreadsheet Data Directly</span>
                  </label>
                  {multiParseResult && (
                    <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded-lg">
                      {multiParseResult.totalRanges} Ranges • {multiParseResult.totalNumbers.toLocaleString()} Numbers
                    </span>
                  )}
                </div>

                <textarea
                  value={multiDocText}
                  onChange={(e) => handleMultiTextChange(e.target.value)}
                  rows={6}
                  placeholder={'Paste CSV or spreadsheet lines here, e.g.:\n"","Range","Prefix","Number"\n"","Nigeria Airtel - Saturn BT1","234","2348083578665"\n"","Nigeria Airtel - Saturn BT1","234","2348083580837"\n"","Nigeria MTN - Orion","234","2348031234567"\n"","Pakistan Jazz - VIP","92","923001234567"'}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-xs placeholder-slate-600 focus:outline-none focus:border-emerald-500 leading-relaxed resize-y"
                  id="multi-doc-textarea"
                />
              </div>

              {/* Live Preview Card of Detected Ranges */}
              {multiParseResult && multiParseResult.items.length > 0 && (
                <div className="p-4 bg-slate-950 border border-emerald-500/40 rounded-xl space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-white">
                        Detected {multiParseResult.totalRanges} Range{multiParseResult.totalRanges === 1 ? '' : 's'} ({multiParseResult.totalNumbers.toLocaleString()} Valid Numbers)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearMultiDoc}
                      className="text-[11px] text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                    >
                      Clear Document
                    </button>
                  </div>

                  {/* Ranges list */}
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {multiParseResult.items.map((item) => {
                      const existing = ranges.find(r => r.name.toLowerCase().trim() === item.name.toLowerCase().trim());
                      return (
                        <div
                          key={item.name}
                          className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-white font-sans">{item.name}</span>
                              <span className="px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-300">
                                +{item.prefix} • {item.countryNote}
                              </span>
                              {existing ? (
                                <span className="px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[10px] font-semibold">
                                  Existing Range ({existing.totalNumbers || 0} nums currently)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-semibold">
                                  New Range (Will Auto-Create)
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap text-[10.5px] font-mono text-slate-400">
                              <span className="text-slate-500">Sample MSISDNs:</span>
                              {item.sampleNumbers.slice(0, 3).map((num) => (
                                <span key={num} className="px-1.5 py-0.2 rounded bg-slate-950 text-slate-300">
                                  {num}
                                </span>
                              ))}
                              {item.numbers.length > 3 && (
                                <span className="text-slate-500 font-sans text-[10px]">+{item.numbers.length - 3} more</span>
                              )}
                            </div>
                          </div>

                          <div className="text-left sm:text-right shrink-0">
                            <span className="text-xs font-bold font-mono text-emerald-400 block">
                              {item.totalCount.toLocaleString()} MSISDNs
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {existing ? 'Will Append' : 'Will Initialize'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Action Bar */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800/80">
                    <span className="text-[11px] text-slate-400 font-mono text-center sm:text-left">
                      ⚡ 1-Click will create all missing ranges and add all numbers automatically.
                    </span>

                    <button
                      type="button"
                      onClick={handleMultiImportSubmit}
                      disabled={isMultiSubmitting}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/50 transition-all disabled:opacity-50 cursor-pointer"
                      id="submit-multi-range-import-btn"
                    >
                      {isMultiSubmitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Importing & Indexing Ranges...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-emerald-200" />
                          <span>
                            Import All {multiParseResult.totalRanges} Range{multiParseResult.totalRanges === 1 ? '' : 's'} ({multiParseResult.totalNumbers.toLocaleString()} Numbers)
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* SECTION 1: RANGE SELECTION */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-xs font-bold font-mono">
                  1
                </span>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Range Selection
                </h2>
              </div>
              <span className="text-[11px] text-slate-400">
                {ranges.length} Configured Range{ranges.length === 1 ? '' : 's'}
              </span>
            </div>

            {/* Radio / Tab Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Card A: Create New Range */}
              <button
                type="button"
                onClick={() => setRangeMode('create')}
                className={`p-3.5 rounded-xl border text-left transition-all relative ${
                  rangeMode === 'create'
                    ? 'bg-blue-950/40 border-blue-500/60 ring-1 ring-blue-500/30 text-white'
                    : 'bg-slate-950 border-slate-800/80 text-slate-400 hover:border-slate-700'
                }`}
                id="mode-create-range-btn"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    rangeMode === 'create' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}>
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      Create New Range
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Define a new range name and prefix
                    </div>
                  </div>
                </div>
              </button>

              {/* Card B: Add to Existing Range */}
              <button
                type="button"
                onClick={() => setRangeMode('existing')}
                className={`p-3.5 rounded-xl border text-left transition-all relative ${
                  rangeMode === 'existing'
                    ? 'bg-blue-950/40 border-blue-500/60 ring-1 ring-blue-500/30 text-white'
                    : 'bg-slate-950 border-slate-800/80 text-slate-400 hover:border-slate-700'
                }`}
                id="mode-existing-range-btn"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    rangeMode === 'existing' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}>
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      Add to Existing Range ({ranges.length})
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Append numbers to an already configured range
                    </div>
                  </div>
                </div>
              </button>
            </div>

            {/* Mode: Create New Range Form */}
            {rangeMode === 'create' ? (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Range Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={newRangeName}
                    onChange={(e) => setNewRangeName(e.target.value)}
                    placeholder="e.g. Tanzania LX 26Aug, Ukraine Kyivstar, etc."
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 font-sans"
                    id="new-range-name-input"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Country Prefix <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">+</span>
                      <input
                        type="text"
                        value={newRangePrefix}
                        onChange={(e) => setNewRangePrefix(e.target.value.replace(/[^\d]/g, ''))}
                        placeholder="e.g. 255, 380, 224"
                        className="w-full pl-7 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 font-mono"
                        id="new-range-prefix-input"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Country / Carrier Note <span className="text-slate-500 text-[10px]">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={newRangeNote}
                      onChange={(e) => setNewRangeNote(e.target.value)}
                      placeholder="e.g. Tanzania, Ukraine, Guinea"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 font-sans"
                      id="new-range-note-input"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* Mode: Add to Existing Range Form */
              <div className="pt-2">
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Select Existing Range <span className="text-rose-400">*</span>
                </label>
                {ranges.length === 0 ? (
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-amber-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    <span>No ranges configured yet. Please switch to "Create New Range" above.</span>
                  </div>
                ) : (
                  <select
                    value={selectedRangeId}
                    onChange={(e) => setSelectedRangeId(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-blue-500 cursor-pointer font-sans"
                    id="existing-range-select"
                  >
                    {[...ranges]
                      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }))
                      .map(r => (
                        <option key={r.id} value={r.id} className="bg-slate-900 text-white">
                          {r.name} (+{r.prefix}) — {r.totalNumbers || 0} numbers {r.countryNote ? `[${r.countryNote}]` : ''}
                        </option>
                      ))}
                  </select>
                )}
              </div>
            )}
          </div>

          {/* SECTION 2: UPLOAD BATCH FILE & NUMBERS BUFFER */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-xs font-bold font-mono">
                  2
                </span>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Upload Batch File (CSV, CXV, TXT, TSV)
                </h2>
              </div>
              <span className="text-[10px] font-mono text-slate-400 hidden sm:inline-block">
                Supported formats: .csv, .cxv, .txt, .tsv, .xlsx
              </span>
            </div>

            {/* Dropzone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2.5 ${
                isDragging
                  ? 'border-blue-500 bg-blue-950/30 scale-[1.01]'
                  : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-950'
              }`}
              id="file-dropzone"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.cxv,.txt,.tsv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                id="bulk-file-hidden-input"
              />

              <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center">
                <UploadCloud className="w-5 h-5" />
              </div>

              <div>
                <p className="text-xs font-semibold text-white">
                  {uploadedFileName ? (
                    <span className="text-blue-400 font-mono">Active File: {uploadedFileName}</span>
                  ) : (
                    <span>Click to browse or drag & drop your number file here</span>
                  )}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Supports CSV, CXV, TXT, TSV file formats with thousands of MSISDNs.
                </p>
              </div>
            </div>

            {/* Numbers Buffer Textarea */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-blue-400" />
                  <span>Numbers Buffer (Paste directly or verify file numbers)</span>
                </label>
                <div className="flex items-center gap-2 font-mono">
                  <span className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-blue-400 font-bold">
                    {parsedNumbers.length.toLocaleString()} numbers
                  </span>
                </div>
              </div>

              <textarea
                value={numbersText}
                onChange={(e) => setNumbersText(e.target.value)}
                rows={6}
                placeholder={"Paste MSISDNs here (one per line, comma or semicolon separated):\n380961234567\n380961234568\n380961234569..."}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-xs placeholder-slate-600 focus:outline-none focus:border-blue-500 leading-relaxed resize-y"
                id="numbers-buffer-textarea"
              />

              {/* Buffer Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleAutoCleanAllDuplicates}
                    disabled={isCheckingDuplicates || parsedNumbers.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shadow-sm transition-all disabled:opacity-40 cursor-pointer"
                    title="Automatically check and remove all duplicate numbers from buffer across all ranges"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-white" />
                    <span>{isCheckingDuplicates ? 'Scanning Duplicates...' : 'Auto-Clean Duplicates'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCheckDuplicates}
                    disabled={isCheckingDuplicates || parsedNumbers.length === 0}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-[11px] font-medium transition-colors disabled:opacity-40 cursor-pointer"
                    title="Inspect if any numbers in this buffer already exist in any range across the system"
                  >
                    <Search className="w-3.5 h-3.5 text-blue-400" />
                    <span>{isCheckingDuplicates ? 'Checking...' : 'Check Conflicts'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDeduplicateBuffer}
                    disabled={parsedNumbers.length === 0}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-[11px] font-medium transition-colors disabled:opacity-40 cursor-pointer"
                    title="Remove duplicate numbers within this buffer"
                  >
                    <span>Remove Batch Dups</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCleanNonDigits}
                    disabled={parsedNumbers.length === 0}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-[11px] font-medium transition-colors disabled:opacity-40 cursor-pointer"
                    title="Clean spaces, dashes, + signs"
                  >
                    <span>Clean Non-Digits</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearBuffer}
                    disabled={!numbersText}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-rose-900/50 text-slate-400 hover:text-rose-400 text-[11px] font-medium transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear Buffer</span>
                  </button>
                </div>

                {/* Primary Save Action */}
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || parsedNumbers.length === 0}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-900/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  id="save-assign-numbers-btn"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving & Indexing...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        Save & Assign {parsedNumbers.length > 0 ? `(${parsedNumbers.length.toLocaleString()})` : ''} Numbers to Range
                      </span>
                    </>
                  )}
                </button>
              </div>

              {/* Duplicate Inspector Preview Card */}
              {duplicateCheckResult && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold text-white">Duplicate Conflict Report</span>
                      <span className="text-[10px] text-slate-400">(Rule: 1 Number = 1 Range Only)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDuplicateCheckResult(null)}
                      className="text-slate-400 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center pt-1 font-mono">
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Total Checked</div>
                      <div className="text-sm font-bold text-white">{duplicateCheckResult.totalChecked}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-emerald-400">Valid New</div>
                      <div className="text-sm font-bold text-emerald-400">{duplicateCheckResult.newCount}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-amber-400">Conflicts / Dups</div>
                      <div className="text-sm font-bold text-amber-400">{duplicateCheckResult.duplicateCount}</div>
                    </div>
                  </div>

                  {duplicateCheckResult.duplicateCount > 0 && duplicateCheckResult.uniqueNumbers && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (duplicateCheckResult.uniqueNumbers) {
                            setNumbersText(duplicateCheckResult.uniqueNumbers.join('\n'));
                            setStatusMessage({
                              type: 'success',
                              text: `Cleaned buffer! Removed ${duplicateCheckResult.duplicateCount} duplicate numbers. ${duplicateCheckResult.uniqueNumbers.length} unique numbers remaining.`,
                            });
                            setDuplicateCheckResult(null);
                          }
                        }}
                        className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/40 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Auto-Remove These {duplicateCheckResult.duplicateCount} Duplicates from Buffer</span>
                      </button>
                    </div>
                  )}

                  {duplicateCheckResult.duplicates.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <div className="text-[11px] font-semibold text-amber-300">
                        Duplicate & Relocation Details:
                      </div>
                      <div className="max-h-28 overflow-y-auto space-y-1 font-mono text-[11px] text-slate-400">
                        {duplicateCheckResult.duplicates.slice(0, 15).map((d, i) => (
                          <div key={i} className="flex items-center justify-between px-2 py-0.5 rounded bg-slate-900">
                            <span className="text-slate-300">{d.number}</span>
                            <span className="text-[10px] text-amber-400">{d.reason}</span>
                          </div>
                        ))}
                        {duplicateCheckResult.duplicates.length > 15 && (
                          <div className="text-[10px] text-slate-500 italic text-center">
                            +{duplicateCheckResult.duplicates.length - 15} more conflicts
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>

    {/* RIGHT COLUMN: Configured Ranges Directory & Management */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Configured Ranges
                </h3>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
                {ranges.reduce((acc, r) => acc + (r.totalNumbers || 0), 0).toLocaleString()} Total Numbers
              </span>
            </div>

            {/* Search Ranges */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={rangesSearch}
                onChange={(e) => setRangesSearch(e.target.value)}
                placeholder="Search ranges by name, prefix, country..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 font-sans"
                id="search-ranges-input"
              />
            </div>

            {/* Ranges List */}
            <div className="space-y-2.5 max-h-[620px] overflow-y-auto pr-1">
              {isLoadingRanges ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-400" />
                  <span>Loading ranges...</span>
                </div>
              ) : filteredRanges.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs bg-slate-950/60 rounded-xl border border-slate-800/60">
                  <Layers className="w-6 h-6 mx-auto mb-2 text-slate-600" />
                  <p className="font-semibold text-slate-400">No ranges found</p>
                  <p className="text-[11px] text-slate-500 mt-1">Create a range using the form on the left.</p>
                </div>
              ) : (
                filteredRanges.map((range) => (
                  <div
                    key={range.id}
                    className="p-3.5 bg-slate-950 border border-slate-800/90 rounded-xl hover:border-slate-700 transition-all space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-white text-xs tracking-tight">
                            {range.name}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-950/80 text-blue-300 border border-blue-500/30">
                            +{range.prefix}
                          </span>
                          {range.countryNote && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-900 text-slate-300 border border-slate-800">
                              {range.countryNote}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 mt-1">
                          Created {new Date(range.createdAt).toLocaleDateString()}
                        </div>
                      </div>

                      <span className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono font-bold text-emerald-400 shrink-0">
                        {(range.totalNumbers || 0).toLocaleString()} MSISDNs
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/60 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleOpenManageRange(range)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-[11px] font-semibold transition-colors cursor-pointer"
                          id={`manage-range-${range.id}`}
                        >
                          <Phone className="w-3 h-3 text-blue-400" />
                          <span>Manage Numbers</span>
                          <ChevronRight className="w-3 h-3 opacity-60" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenRangeCliAccess(range)}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                            range.allowedBlockedClis && range.allowedBlockedClis.length > 0
                              ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
                              : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          }`}
                          title="Manage Blocked CLI Access for this Range"
                        >
                          <KeyRound className="w-3 h-3 text-emerald-400" />
                          <span>CLI Access ({range.allowedBlockedClis?.length || 0})</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleExportRangeCsv(range)}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          title="Export all numbers to CSV"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => requestClearAllNumbers(range)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-medium transition-colors cursor-pointer"
                          title="Remove All Numbers (PIN Required - Keeps Range Active)"
                        >
                          <RotateCcw className="w-3 h-3 text-amber-400" />
                          <span>Clear Numbers</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => requestDeleteRange(range)}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/70 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                          title="Delete Range (PIN Required)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* NUMBERS MANAGEMENT MODAL */}
      {managingRange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div 
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            id="manage-numbers-modal"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/80">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <span>{managingRange.name}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-950 text-blue-300 border border-blue-500/30">
                      +{managingRange.prefix}
                    </span>
                    {managingRange.countryNote && (
                      <span className="text-xs text-slate-400">({managingRange.countryNote})</span>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Total: <strong className="text-emerald-400 font-mono">{totalNumbersInModal.toLocaleString()}</strong> assigned MSISDNs in this range
                  </p>
                </div>
              </div>

              {/* Action Toolbar in Modal Header */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleExportRangeCsv(managingRange)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-blue-400" />
                  <span>Export CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => requestClearAllNumbers(managingRange)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-colors cursor-pointer"
                  title="Remove all numbers from range while keeping range configuration active"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Remove All Numbers</span>
                </button>

                <button
                  type="button"
                  onClick={() => requestDeleteRange(managingRange)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-colors cursor-pointer"
                  title="Permanently delete range and numbers"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Delete Range</span>
                </button>

                <button
                  type="button"
                  onClick={() => setManagingRange(null)}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer ml-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Add Numbers directly into Range */}
            <div className="p-4 bg-slate-950/50 border-b border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Add Numbers to this Range:</span>
                </label>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Global Protection: 1 Number = 1 Range Only</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsModalBulkOpen(!isModalBulkOpen)}
                    className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold underline underline-offset-2 cursor-pointer"
                  >
                    {isModalBulkOpen ? 'Switch to Quick Add' : 'Bulk File Upload / Paste'}
                  </button>
                </div>
              </div>

              {!isModalBulkOpen ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={quickAddText}
                    onChange={(e) => setQuickAddText(e.target.value)}
                    placeholder="Paste numbers (e.g. 224610351009, 224622114455) - comma, space or newline"
                    className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleQuickAddInsideModal}
                    disabled={isQuickAdding || !quickAddText.trim()}
                    className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shrink-0 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isQuickAdding ? 'Adding...' : 'Add Numbers'}
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-3 animate-fadeIn">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-300">
                      Bulk Upload (CSV, TXT, XLSX) or Paste Multi-line Numbers:
                    </span>
                    <input
                      ref={modalFileInputRef}
                      type="file"
                      accept=".csv,.txt,.tsv,.xlsx,.xls"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleModalBulkFileUpload(f);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => modalFileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
                    >
                      <UploadCloud className="w-3.5 h-3.5 text-blue-400" />
                      <span>{modalBulkFileName ? modalBulkFileName : 'Choose File...'}</span>
                    </button>
                  </div>

                  <textarea
                    rows={4}
                    value={modalBulkText}
                    onChange={(e) => setModalBulkText(e.target.value)}
                    placeholder="Or paste hundreds or thousands of phone numbers here..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-y"
                  />

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      Extracted: <strong className="text-white font-mono">{extractNumbersFromText(modalBulkText).length.toLocaleString()}</strong> numbers
                    </span>

                    <button
                      type="button"
                      onClick={handleModalBulkSubmit}
                      disabled={isModalBulkSubmitting || extractNumbersFromText(modalBulkText).length === 0}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {isModalBulkSubmitting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Importing...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Add All Valid Numbers to Range</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Search & Bulk Delete Toolbar */}
            <div className="p-4 bg-slate-950/30 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={numbersSearchQuery}
                  onChange={(e) => {
                    setNumbersSearchQuery(e.target.value);
                    setNumbersPage(1);
                    fetchRangeNumbers(managingRange.id, e.target.value, 1);
                  }}
                  placeholder="Search numbers within range..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              {selectedNumbersForRemoval.size > 0 && (
                <button
                  type="button"
                  onClick={() => handleRemoveNumbers(Array.from(selectedNumbersForRemoval))}
                  disabled={isRemovingNumbers}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-sm transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Selected ({selectedNumbersForRemoval.size})</span>
                </button>
              )}
            </div>

            {/* Modal Numbers Table / List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[260px]">
              {isLoadingNumbers ? (
                <div className="p-12 text-center text-slate-500 text-xs">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-400" />
                  <span>Loading numbers...</span>
                </div>
              ) : rangeNumbers.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs">
                  <Phone className="w-6 h-6 mx-auto mb-2 text-slate-600" />
                  <p className="font-semibold text-slate-400">No numbers found</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {numbersSearchQuery ? 'Try a different search query.' : 'Add numbers using the form above.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {rangeNumbers.map((num) => {
                    const isSelected = selectedNumbersForRemoval.has(num);
                    return (
                      <div
                        key={num}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-colors ${
                          isSelected 
                            ? 'bg-rose-950/30 border-rose-500/40 text-white'
                            : 'bg-slate-950 border-slate-800/80 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              const next = new Set(selectedNumbersForRemoval);
                              if (next.has(num)) next.delete(num);
                              else next.add(num);
                              setSelectedNumbersForRemoval(next);
                            }}
                            className="w-3.5 h-3.5 rounded border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                          />
                          <span className="font-mono text-xs font-semibold select-all">
                            {num}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(num);
                              setCopiedNumber(num);
                              setTimeout(() => setCopiedNumber(null), 1500);
                            }}
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                            title="Copy number"
                          >
                            {copiedNumber === num ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveNumbers([num])}
                            className="p-1 rounded hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition-colors"
                            title="Remove number from range"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Pagination Footer */}
            <div className="p-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
              <span>
                Showing page {numbersPage} of {Math.max(1, Math.ceil(totalNumbersInModal / 50))} ({totalNumbersInModal} numbers)
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={numbersPage <= 1}
                  onClick={() => {
                    const next = numbersPage - 1;
                    setNumbersPage(next);
                    fetchRangeNumbers(managingRange.id, numbersSearchQuery, next);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-40 text-xs font-semibold"
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={numbersPage >= Math.ceil(totalNumbersInModal / 50)}
                  onClick={() => {
                    const next = numbersPage + 1;
                    setNumbersPage(next);
                    fetchRangeNumbers(managingRange.id, numbersSearchQuery, next);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-40 text-xs font-semibold"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECURITY PIN CONFIRMATION MODAL */}
      {securityModal.isOpen && securityModal.range && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn"
          id="security-action-modal"
        >
          <div 
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden p-5 sm:p-6 space-y-4"
          >
            {/* Modal Icon & Header */}
            <div className="flex items-start gap-3.5">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
                securityModal.type === 'delete_range'
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              }`}>
                {securityModal.type === 'delete_range' ? (
                  <Trash2 className="w-5 h-5" />
                ) : (
                  <RotateCcw className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <span>
                    {securityModal.type === 'delete_range' ? 'Delete Range' : 'Remove All Numbers'}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                    +{securityModal.range.prefix}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  Range: <strong className="text-white">{securityModal.range.name}</strong> ({securityModal.range.totalNumbers || 0} MSISDNs)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSecurityModal(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-white text-sm p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Warning Box */}
            <div className={`p-3.5 rounded-xl border text-xs leading-relaxed space-y-1 ${
              securityModal.type === 'delete_range'
                ? 'bg-rose-950/30 border-rose-500/30 text-rose-200'
                : 'bg-amber-950/30 border-amber-500/30 text-amber-200'
            }`}>
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  {securityModal.type === 'delete_range' 
                    ? 'Permanent Deletion Warning' 
                    : 'Clear All Numbers Warning'}
                </span>
              </div>
              <p className="text-[11px] opacity-90">
                {securityModal.type === 'delete_range' ? (
                  <>
                    This action will permanently delete range <strong>"{securityModal.range.name}"</strong> and unbind all {securityModal.range.totalNumbers || 0} MSISDNs from the system. This cannot be undone.
                  </>
                ) : (
                  <>
                    All {securityModal.range.totalNumbers || 0} numbers will be deleted from <strong>"{securityModal.range.name}"</strong>. 
                    The range configuration (+{securityModal.range.prefix}) will remain active and preserved for future batch numbers.
                  </>
                )}
              </p>
            </div>

            {/* PIN Input Form */}
            <form onSubmit={handleExecuteSecurityAction} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-blue-400" />
                    <span>Enter Security Master PIN:</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">PIN Required</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={securityModal.showPin ? 'text' : 'password'}
                    value={securityModal.securityPin}
                    onChange={(e) => setSecurityModal(prev => ({ ...prev, securityPin: e.target.value, error: null }))}
                    placeholder="Enter Master PIN"
                    autoFocus
                    className="w-full pl-9 pr-10 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 tracking-wider"
                    id="security-pin-input"
                  />
                  <button
                    type="button"
                    onClick={() => setSecurityModal(prev => ({ ...prev, showPin: !prev.showPin }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                    tabIndex={-1}
                  >
                    {securityModal.showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error Box */}
              {securityModal.error && (
                <div className="p-2.5 bg-rose-950/80 border border-rose-500/50 rounded-xl flex items-center gap-2 text-rose-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{securityModal.error}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setSecurityModal(prev => ({ ...prev, isOpen: false }))}
                  disabled={securityModal.isProcessing}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={securityModal.isProcessing || !securityModal.securityPin.trim()}
                  className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-white text-xs font-bold shadow-lg transition-all disabled:opacity-50 cursor-pointer ${
                    securityModal.type === 'delete_range'
                      ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/30'
                      : 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/30'
                  }`}
                  id="confirm-security-pin-btn"
                >
                  {securityModal.isProcessing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying PIN...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>
                        {securityModal.type === 'delete_range' ? 'Verify PIN & Delete Range' : 'Verify PIN & Clear Numbers'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GLOBAL AUDIT & DEDUPLICATION REPORT MODAL */}
      {auditResultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden p-5 sm:p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Global Ranges Duplicate Audit Report
                  </h3>
                  <p className="text-xs text-slate-400">
                    Rule Enforced: 1 Phone Number = 1 Range Only
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAuditResultModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stats summary */}
            <div className="grid grid-cols-3 gap-2.5 text-center font-mono">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Ranges</div>
                <div className="text-lg font-bold text-white mt-0.5">{auditResultModal.totalRanges}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-emerald-400 uppercase font-semibold">Active Unique</div>
                <div className="text-lg font-bold text-emerald-400 mt-0.5">{auditResultModal.totalNumbersAfter.toLocaleString()}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-amber-400 uppercase font-semibold">Duplicates Cleaned</div>
                <div className="text-lg font-bold text-amber-400 mt-0.5">{auditResultModal.duplicatesRemoved.toLocaleString()}</div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{auditResultModal.message}</span>
            </div>

            {/* List of modified ranges if any */}
            {auditResultModal.rangesModified && auditResultModal.rangesModified.length > 0 && (
              <div className="space-y-2 flex-1 overflow-y-auto">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  <span>Modified Ranges ({auditResultModal.rangesModified.length}):</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  {auditResultModal.rangesModified.map((rm: any) => (
                    <div key={rm.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-white">{rm.name} (+{rm.prefix})</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Was {rm.beforeCount} numbers → Now {rm.afterCount} numbers
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-500/30">
                        -{rm.removedCount} duplicates
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sample duplicate numbers removed */}
            {auditResultModal.sampleDuplicates && auditResultModal.sampleDuplicates.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-300">
                  Sample Duplicate Numbers Resolved:
                </div>
                <div className="max-h-28 overflow-y-auto space-y-1 font-mono text-[11px]">
                  {auditResultModal.sampleDuplicates.map((sd: any, idx: number) => (
                    <div key={idx} className="p-1.5 rounded bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-2">
                      <span className="text-emerald-400 font-bold">{sd.number}</span>
                      <span className="text-[10px] text-slate-400">
                        Kept in "{sd.keptInRange}" • Removed from "{sd.removedFromRange}"
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setAuditResultModal(null)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Close Audit Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RANGE BLOCKED CLI ACCESS MODAL */}
      {cliAccessModal.isOpen && cliAccessModal.range && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden p-5 sm:p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Range Blocked CLI Access</span>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-slate-950 font-mono text-emerald-300 border border-slate-800">
                      {cliAccessModal.range.name}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Grant this range permission to receive SMS from globally blocked CLIs.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCliAccessModal(prev => ({ ...prev, isOpen: false }))}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs space-y-1">
              <p className="font-semibold text-emerald-300">
                CLI Access Override for this Range:
              </p>
              <p className="text-[11px] text-slate-300">
                Active blocked CLIs allowed for range <strong>{cliAccessModal.range.name}</strong> will bypass client filtering and work normally for clients on this range.
              </p>
            </div>

            {cliAccessModal.feedback && (
              <div className="p-2.5 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>{cliAccessModal.feedback}</span>
              </div>
            )}

            {/* Quick add custom CLI input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Add Blocked CLI / App to Allow for this Range:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={cliAccessModal.newCliInput}
                  onChange={(e) => setCliAccessModal(prev => ({ ...prev, newCliInput: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomAllowedCli(); } }}
                  placeholder="e.g. Apple, WhatsApp, Google"
                  className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleAddCustomAllowedCli}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </div>

            {/* List of active blocked rules in system */}
            {availableFilterRules.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-400">
                  Select from active Blacklist Rules in system:
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar p-1">
                  {availableFilterRules.map((rule) => {
                    const isAllowed = cliAccessModal.allowedClis.includes(rule.pattern);
                    return (
                      <button
                        key={rule.id}
                        type="button"
                        onClick={() => handleToggleAllowedCli(rule.pattern)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all border cursor-pointer flex items-center gap-1.5 ${
                          isAllowed
                            ? 'bg-emerald-950 border-emerald-500 text-emerald-300 font-bold'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <span>{isAllowed ? '✓' : '+'}</span>
                        <span>{rule.pattern}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Current allowed CLIs for this range */}
            <div className="space-y-1.5 flex-1 overflow-y-auto">
              <span className="text-[11px] font-semibold text-slate-400">
                Currently Allowed Blocked CLIs for this Range ({cliAccessModal.allowedClis.length}):
              </span>
              {cliAccessModal.allowedClis.length === 0 ? (
                <div className="p-3 text-center rounded-xl bg-slate-950 border border-slate-800/80 text-slate-500 text-xs">
                  No blocked CLIs currently exempted. All global blacklist rules apply to this range.
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-slate-950 border border-slate-800">
                  {cliAccessModal.allowedClis.map((cli) => (
                    <span
                      key={cli}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-900/60 border border-emerald-500/40 text-emerald-200 text-xs font-mono"
                    >
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>{cli}</span>
                      <button
                        type="button"
                        onClick={() => handleToggleAllowedCli(cli)}
                        className="text-emerald-400/80 hover:text-rose-400 ml-0.5 cursor-pointer"
                        title="Remove"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Modal actions */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setCliAccessModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={cliAccessModal.isSaving}
                onClick={handleSaveRangeCliAccess}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-emerald-950/40 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{cliAccessModal.isSaving ? 'Saving...' : 'Save CLI Permissions'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MULTI-RANGE IMPORT SUMMARY MODAL */}
      {multiImportSummaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden p-5 sm:p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-950/40">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    <span>Document Import Complete</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-mono">
                      Success
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    All numbers have been indexed and assigned to their respective ranges.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMultiImportSummaryModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stats summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-emerald-400 uppercase font-semibold">New Ranges</div>
                <div className="text-lg font-bold text-emerald-300 mt-0.5">{multiImportSummaryModal.rangesCreated}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-blue-400 uppercase font-semibold">Updated</div>
                <div className="text-lg font-bold text-blue-300 mt-0.5">{multiImportSummaryModal.rangesUpdated}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-white uppercase font-semibold">Numbers Added</div>
                <div className="text-lg font-bold text-white mt-0.5">{multiImportSummaryModal.totalAdded.toLocaleString()}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-amber-400 uppercase font-semibold">Duplicates</div>
                <div className="text-lg font-bold text-amber-400 mt-0.5">{multiImportSummaryModal.totalDuplicates.toLocaleString()}</div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{multiImportSummaryModal.message}</span>
            </div>

            {/* Ranges Breakdown */}
            <div className="space-y-2 flex-1 overflow-y-auto pr-1">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <Table className="w-3.5 h-3.5 text-emerald-400" />
                <span>Imported Ranges Breakdown ({multiImportSummaryModal.details.length}):</span>
              </div>
              <div className="space-y-1.5 text-xs">
                {multiImportSummaryModal.details.map((detail, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <span>{detail.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">+{detail.prefix}</span>
                        {detail.action === 'created' ? (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[9px] font-semibold">
                            Created
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[9px] font-semibold">
                            Updated
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {detail.countryNote || 'Worldwide'} • Total now: {detail.totalInRange.toLocaleString()} MSISDNs
                      </div>
                    </div>
                    <div className="text-right font-mono text-emerald-400 font-bold text-xs shrink-0">
                      +{detail.added.toLocaleString()} added
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer action */}
            <div className="pt-2 flex justify-end border-t border-slate-800">
              <button
                type="button"
                onClick={() => setMultiImportSummaryModal(null)}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                Done / View Ranges
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
