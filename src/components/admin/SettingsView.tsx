import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings as SettingsIcon, 
  User, 
  Lock, 
  Palette, 
  Image as ImageIcon, 
  Server, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  Clock, 
  Terminal, 
  Globe, 
  RefreshCw,
  Sparkles,
  Layers,
  KeyRound,
  Radio,
  SlidersHorizontal,
  HardDrive,
  Film,
  Play,
  Upload,
  Video
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { THEMES } from '../../utils/theme';
import type { ThemePreset, SiteSettings } from '../../types';

export const SettingsView: React.FC = () => {
  const { session, settings, updateSettings, logout } = useAuth();
  const currentTheme = settings?.theme ? THEMES[settings.theme] : THEMES.emerald;

  const [activeTab, setActiveTab] = useState<'security' | 'retention' | 'login_bg' | 'branding' | 'theme' | 'sms_style' | 'vps'>('retention');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Live SMS Retention Limit
  const [maxSmsRetention, setMaxSmsRetention] = useState<number>(settings?.maxSmsRetention || 2000);
  // Universal Client OTP Box Capacity (Uniformly fixed by Admin for all clients)
  const [clientMaxRetention, setClientMaxRetention] = useState<number>(settings?.clientMaxRetention || 500);

  // Login Background Settings (Admin can add Picture or Video looping on Login Page)
  const [loginBgType, setLoginBgType] = useState<'cosmic' | 'galaxy' | 'video' | 'image'>(
    settings?.loginBgType || 'cosmic'
  );
  const [loginBgMediaUrl, setLoginBgMediaUrl] = useState<string>(settings?.loginBgMediaUrl || '');
  const [loginBgVideoLoop, setLoginBgVideoLoop] = useState<boolean>(settings?.loginBgVideoLoop ?? true);
  const [loginBgOpacity, setLoginBgOpacity] = useState<number>(
    typeof settings?.loginBgOpacity === 'number' ? settings.loginBgOpacity : 65
  );
  const [mediaFileName, setMediaFileName] = useState<string>('');

  // Live SMS Table & Font Color Styling
  const [smsTableBgColor, setSmsTableBgColor] = useState<string>(settings?.smsTableBgColor || '#090d16');
  const [smsTextColor, setSmsTextColor] = useState<string>(settings?.smsTextColor || '#f8fafc');
  const [smsBorderColor, setSmsBorderColor] = useState<string>(settings?.smsBorderColor || '#1e293b');
  const [smsFontSize, setSmsFontSize] = useState<'compact' | 'normal' | 'large'>(settings?.smsFontSize || 'normal');
  const [smsPresetTheme, setSmsPresetTheme] = useState<'default' | 'oled' | 'matrix' | 'navy' | 'light' | 'gold' | 'custom'>(
    settings?.smsPresetTheme || 'default'
  );

  // Admin credentials form
  const [adminUsername, setAdminUsername] = useState('ITXKAMII');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityPin, setSecurityPin] = useState('');

  // Branding Form
  const [siteName, setSiteName] = useState(settings?.siteName || 'KB MAX');
  const [tagline, setTagline] = useState(settings?.tagline || 'Live SMS Relay & Gateway Portal');
  const [logoType, setLogoType] = useState<'icon' | 'custom_url'>(settings?.logoType || 'icon');
  const [customLogoUrl, setCustomLogoUrl] = useState(settings?.customLogoUrl || '');
  const [logoFileName, setLogoFileName] = useState<string>('');
  const [publicServerUrl, setPublicServerUrl] = useState<string>(settings?.publicServerUrl || '');

  // Handle Logo File Upload (PNG, JPG, SVG, WebP)
  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setNotice({ type: 'error', message: 'Logo image file size must be under 2MB.' });
      return;
    }

    setLogoFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setCustomLogoUrl(result);
        setLogoType('custom_url');
        setNotice({ type: 'success', message: `Logo "${file.name}" loaded! Click "Save Branding Changes" to apply.` });
      }
    };
    reader.readAsDataURL(file);
  };

  // Theme Form
  const [selectedTheme, setSelectedTheme] = useState<ThemePreset>(settings?.theme || 'emerald');
  const [clientSessionMinutes, setClientSessionMinutes] = useState(settings?.clientSessionMinutes || 5);

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    if (newPassword && newPassword !== confirmPassword) {
      setNotice({ type: 'error', message: 'New password and confirmation do not match.' });
      return;
    }

    if (newPassword && !securityPin) {
      setNotice({ type: 'error', message: 'Security Master PIN is required to change admin password.' });
      return;
    }

    setIsSaving(true);
    setNotice(null);

    try {
      const res = await fetch('/api/admin/credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          username: adminUsername,
          oldPassword: oldPassword || undefined,
          newPassword: newPassword || undefined,
          securityPin: securityPin || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setNotice({ type: 'success', message: 'Admin login credentials updated successfully!' });
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setSecurityPin('');
      } else {
        setNotice({ type: 'error', message: data.error || 'Failed to update credentials' });
      }
    } catch {
      setNotice({ type: 'error', message: 'Network error updating credentials' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBrandingAndTheme = async () => {
    setIsSaving(true);
    setNotice(null);

    const success = await updateSettings({
      siteName,
      tagline,
      logoType,
      customLogoUrl,
      theme: selectedTheme,
      clientSessionMinutes: Number(clientSessionMinutes) || 5,
      maxSmsRetention: Number(maxSmsRetention) || 2000,
      publicServerUrl: publicServerUrl.trim().replace(/\/+$/, ''),
    });

    setIsSaving(false);
    if (success) {
      setNotice({ type: 'success', message: 'Branding and theme customized successfully!' });
    } else {
      setNotice({ type: 'error', message: 'Failed to update settings' });
    }
  };

  const handleSaveVpsDomain = async () => {
    setIsSaving(true);
    setNotice(null);
    const cleanUrl = publicServerUrl.trim().replace(/\/+$/, '');
    const success = await updateSettings({
      publicServerUrl: cleanUrl,
    });
    setIsSaving(false);
    if (success) {
      setNotice({ 
        type: 'success', 
        message: cleanUrl 
          ? `VPS Host URL updated to "${cleanUrl}"! All Login links and Webhook URLs now use this clean address without :3000.` 
          : 'VPS Host URL reset to auto-detect browser origin.' 
      });
    } else {
      setNotice({ type: 'error', message: 'Failed to update VPS Host URL' });
    }
  };

  const handleSaveRetention = async () => {
    setIsSaving(true);
    setNotice(null);

    const targetLimit = Number(maxSmsRetention) || 2000;
    const targetClientBox = Number(clientMaxRetention) || 500;
    if (targetLimit < 100 || targetLimit > 100000) {
      setNotice({ type: 'error', message: 'Live SMS retention limit must be between 100 and 100,000.' });
      setIsSaving(false);
      return;
    }
    if (targetClientBox < 100 || targetClientBox > 50000) {
      setNotice({ type: 'error', message: 'Client box capacity must be between 100 and 50,000.' });
      setIsSaving(false);
      return;
    }

    const success = await updateSettings({
      maxSmsRetention: targetLimit,
      clientMaxRetention: targetClientBox,
    });

    setIsSaving(false);
    if (success) {
      setNotice({ 
        type: 'success', 
        message: `Live SMS memory buffer limit set to ${targetLimit.toLocaleString()} SMS and Universal Client OTP Box Capacity set to ${targetClientBox.toLocaleString()} SMS for all clients! Records remain safely preserved.` 
      });
    } else {
      setNotice({ type: 'error', message: 'Failed to update retention and client box settings.' });
    }
  };

  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  const handleMediaFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      setNotice({ 
        type: 'error', 
        message: 'File size must be under 50MB. For larger video files, paste a direct video MP4 URL.' 
      });
      return;
    }

    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    setMediaFileName(file.name);
    const isVideo = file.type.startsWith('video/') || file.name.endsWith('.mp4') || file.name.endsWith('.webm');
    if (isVideo) {
      setLoginBgType('video');
    } else {
      setLoginBgType('image');
    }

    setIsUploadingMedia(true);
    setNotice({
      type: 'success',
      message: `Uploading ${isVideo ? 'video' : 'picture'} "${file.name}" (${sizeMb} MB)... Please wait.`,
    });

    try {
      if (session) {
        // Direct stream upload up to 50MB to server media storage
        const res = await fetch(`/api/upload/media?filename=${encodeURIComponent(file.name)}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.token}`,
            'Content-Type': file.type || 'application/octet-stream',
          },
          body: file,
        });

        if (res.ok) {
          const data = await res.json();
          if (data.url) {
            setLoginBgMediaUrl(data.url);
            setNotice({
              type: 'success',
              message: `Successfully uploaded ${isVideo ? 'video' : 'picture'} "${file.name}" (${sizeMb} MB)! Click "Save Login Background Settings" to activate live on login screen.`,
            });
            setIsUploadingMedia(false);
            return;
          }
        }
      }

      // Local fallback
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          setLoginBgMediaUrl(result);
          setNotice({
            type: 'success',
            message: `Loaded ${isVideo ? 'video' : 'picture'} "${file.name}" (${sizeMb} MB)! Click "Save Login Background Settings" to activate.`,
          });
        }
        setIsUploadingMedia(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setNotice({ type: 'error', message: 'Failed to upload media file. Please check connection and retry.' });
      setIsUploadingMedia(false);
    }
  };

  const handleSaveLoginBackground = async () => {
    setIsSaving(true);
    setNotice(null);

    const success = await updateSettings({
      loginBgType,
      loginBgMediaUrl,
      loginBgVideoLoop,
      loginBgOpacity: Number(loginBgOpacity) || 65,
    });

    setIsSaving(false);
    if (success) {
      setNotice({ 
        type: 'success', 
        message: 'Login screen background updated successfully! Live loop and media are now active on the sign in page.' 
      });
    } else {
      setNotice({ type: 'error', message: 'Failed to update login background settings.' });
    }
  };

  const applySmsPreset = (preset: 'default' | 'oled' | 'matrix' | 'navy' | 'light' | 'gold') => {
    setSmsPresetTheme(preset);
    if (preset === 'default') {
      setSmsTableBgColor('#090d16');
      setSmsTextColor('#f8fafc');
      setSmsBorderColor('#1e293b');
    } else if (preset === 'oled') {
      setSmsTableBgColor('#000000');
      setSmsTextColor('#ffffff');
      setSmsBorderColor('#27272a');
    } else if (preset === 'matrix') {
      setSmsTableBgColor('#05100a');
      setSmsTextColor('#4ade80');
      setSmsBorderColor('#166534');
    } else if (preset === 'navy') {
      setSmsTableBgColor('#081028');
      setSmsTextColor('#f1f5f9');
      setSmsBorderColor('#1e3a8a');
    } else if (preset === 'light') {
      setSmsTableBgColor('#ffffff');
      setSmsTextColor('#0f172a');
      setSmsBorderColor('#cbd5e1');
    } else if (preset === 'gold') {
      setSmsTableBgColor('#13100a');
      setSmsTextColor('#fef08a');
      setSmsBorderColor('#854d0e');
    }
  };

  const handleSaveSmsColors = async () => {
    setIsSaving(true);
    setNotice(null);

    const success = await updateSettings({
      smsTableBgColor,
      smsTextColor,
      smsBorderColor,
      smsFontSize,
      smsPresetTheme,
    });

    setIsSaving(false);
    if (success) {
      setNotice({
        type: 'success',
        message: 'Live SMS Table and Font colors saved! Both Admin and Client Live SMS views are now updated with your custom colors.',
      });
    } else {
      setNotice({ type: 'error', message: 'Failed to save custom Live SMS styling.' });
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
  const directLoginUrl = `${currentHost}/ints/login`;

  const nginxRemovePortCommands = `# 1. Install Nginx if not already installed
sudo apt update && sudo apt install -y nginx

# 2. Configure Nginx Reverse Proxy to strip Port 3000
# Direct VPS IP or domain will automatically open KB MAX Login Screen!
sudo tee /etc/nginx/sites-available/default > /dev/null <<'EOF'
server {
    listen 80 default_server;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# 3. Test and restart Nginx
sudo nginx -t && sudo systemctl restart nginx

# 4. Now open your VPS IP in browser (e.g. http://your-vps-ip/ints/login) directly without :3000!`;

  const directPort80Commands = `# 1. Grant Node.js permission to bind to privileged Port 80 without root
sudo setcap 'cap_net_bind_service=+ep' $(which node)

# 2. Start KB MAX on Port 80 directly
PORT=80 pm2 start server.ts --name "kbmax" --interpreter tsx -- --port 80
pm2 save`;

  const vpsSetupCommands = `# 1. Update VPS server & install Node.js 20+ and PM2
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git
sudo npm install -g pm2 tsx

# 2. Upload / Clone KB MAX project to /var/www/kbmax
cd /var/www
# git clone <your-repo> kbmax
cd kbmax
npm install
npm run build

# 3. Start KB MAX using PM2 (Runs 24/7 persistently in background)
pm2 start server.ts --name "kbmax" --interpreter tsx
pm2 startup
pm2 save

# 4. Check status & logs anytime
pm2 status
pm2 logs kbmax`;

  return (
    <div className="space-y-6" id="admin-settings-view">
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30 text-xs font-mono font-bold">
            SYSTEM PREFERENCES & BRANDING
          </span>
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
          Settings
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
          Customize admin credentials, add custom logos, change theme colors, configure client session timers, and view VPS deployment instructions.
        </p>

        {/* Tab Selector */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('retention')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'retention'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Live SMS Limit & Buffer</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'security'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Admin Credentials</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('login_bg')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'login_bg'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Film className="w-3.5 h-3.5 text-sky-400" />
            <span>Login Background (Video / Pic)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('branding')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'branding'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Logo & Site Title</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('theme')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'theme'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Theme & Timers</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sms_style')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'sms_style'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Live SMS Colors & Fonts</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('vps')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'vps'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>VPS Deployment Guide</span>
          </button>
        </div>
      </div>

      {/* Notice Banner */}
      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-2xl text-xs flex items-center gap-2.5 font-medium ${
              notice.type === 'success'
                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
            }`}
          >
            {notice.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            <span>{notice.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab 1: Security / Admin Credentials */}
      {activeTab === 'security' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Lock className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Change Admin Password</h3>
          </div>

          <form onSubmit={handleSaveCredentials} className="space-y-4 max-w-lg text-xs">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Admin Username (fixed)</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  readOnly
                  disabled
                  value={adminUsername}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Current Password (Leave blank if not changing password)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                New Password (Optional)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                />
              </div>
            </div>

            {newPassword && (
              <>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                    />
                  </div>
                </div>

                <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
                    <label className="block font-bold text-amber-300">
                      Master Authorization Security PIN (Required)
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Admin password change requires verification of the authorized Master Security PIN.
                  </p>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={securityPin}
                      onChange={(e) => setSecurityPin(e.target.value)}
                      placeholder="Enter authorized master PIN"
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-amber-500/40 focus:border-amber-400 rounded-xl text-white font-mono tracking-widest text-sm"
                    />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              {isSaving ? 'Updating...' : 'Save Credentials'}
            </button>
          </form>
        </div>
      )}

      {/* Tab: Live SMS Retention Limit & Memory Buffer */}
      {activeTab === 'retention' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  Live SMS Memory Retention Limit
                  <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/30 font-mono">
                    Buffer Control
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Control how many live SMS messages stay in memory before older messages get trimmed.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            {/* Guidance */}
            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
              <p className="text-slate-300 font-medium">
                Admin can configure the number of SMS messages retained in the live gateway feed buffer up to <strong className="text-emerald-400">50,000 SMS</strong>.
              </p>
            </div>

            {/* Quick Presets */}
            <div>
              <label className="block font-semibold text-slate-300 mb-2">
                Quick Preset Buffer Capacities
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { count: 500, label: '500 SMS', note: 'Standard' },
                  { count: 1000, label: '1,000 SMS', note: 'Medium' },
                  { count: 2000, label: '2,000 SMS', note: 'Recommended' },
                  { count: 5000, label: '5,000 SMS', note: 'High Volume' },
                  { count: 10000, label: '10,000 SMS', note: 'Enterprise' },
                  { count: 20000, label: '20,000 SMS', note: 'Heavy Archive' },
                  { count: 35000, label: '35,000 SMS', note: 'Ultra Deep' },
                  { count: 50000, label: '50,000 SMS', note: 'Maximum Limit' },
                ].map((preset) => {
                  const isSelected = Number(maxSmsRetention) === preset.count;
                  return (
                    <button
                      key={preset.count}
                      type="button"
                      onClick={() => setMaxSmsRetention(preset.count)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/20'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      <div className="font-mono font-bold text-xs">{preset.label}</div>
                      <div className="text-[10px] text-slate-500">{preset.note}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Numeric Input */}
            <div className="border-t border-slate-800 pt-3">
              <label className="block font-semibold text-slate-300 mb-1.5">
                Or Enter Custom SMS Retention Capacity (100 - 50,000)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={100}
                  max={50000}
                  step={100}
                  value={maxSmsRetention}
                  onChange={(e) => setMaxSmsRetention(Number(e.target.value))}
                  className="w-48 px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono font-bold text-sm focus:outline-none focus:border-emerald-500"
                />
                <span className="text-xs text-slate-400 font-mono">
                  Current Setting: <strong className="text-emerald-400">{Number(maxSmsRetention).toLocaleString()}</strong> messages
                </span>
              </div>
            </div>

            {/* Universal Client OTP Box Capacity Section */}
            <div className="border-t border-slate-800 pt-4 space-y-3">
              <div>
                <label className="block font-semibold text-white mb-1 flex items-center gap-1.5 text-xs">
                  <span>📦 Universal Client OTP Box Capacity</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-400 border border-amber-500/30 font-mono">
                    Fixed for All Clients
                  </span>
                </label>
                <p className="text-[11px] text-slate-400">
                  Strictly fixes the OTP inbox capacity uniformly for every client. No individual client can expand or customize their own box limit.
                </p>
              </div>

              {/* Box Quick Presets */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { count: 500, label: '500 OTP Box', note: 'Standard Universal' },
                  { count: 1000, label: '1,000 OTP Box', note: 'Medium Universal' },
                  { count: 2000, label: '2,000 OTP Box', note: 'Expanded' },
                  { count: 5000, label: '5,000 OTP Box', note: 'High Volume' },
                ].map((preset) => {
                  const isSelected = Number(clientMaxRetention) === preset.count;
                  return (
                    <button
                      key={preset.count}
                      type="button"
                      onClick={() => setClientMaxRetention(preset.count)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-950/80 border-amber-500 text-amber-300 ring-2 ring-amber-500/20'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      <div className="font-mono font-bold text-xs">{preset.label}</div>
                      <div className="text-[10px] text-slate-500">{preset.note}</div>
                    </button>
                  );
                })}
              </div>

              {/* Custom Numeric Client Box */}
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="number"
                  min={100}
                  max={50000}
                  step={100}
                  value={clientMaxRetention}
                  onChange={(e) => setClientMaxRetention(Number(e.target.value))}
                  className="w-48 px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono font-bold text-sm focus:outline-none focus:border-amber-500"
                />
                <span className="text-xs text-slate-400 font-mono">
                  Fixed Client Box: <strong className="text-amber-400">{Number(clientMaxRetention).toLocaleString()}</strong> OTPs
                </span>
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleSaveRetention}
                disabled={isSaving}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-emerald-950/40 active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Updating Settings...' : 'Save Buffer & Universal Box Settings'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Login Page Live Background (Video Loop or Picture) */}
      {activeTab === 'login_bg' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-6" id="login-background-settings-panel">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center">
                <Film className="w-4 h-4 text-sky-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Login Screen Live Background Settings</span>
                  <span className="px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/30 text-[10px] font-mono">
                    LIVE PREVIEW
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Select a live looping video (silent, no sound), upload your own photo/picture, or use cosmic & galaxy wallpapers for the login screen.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveLoginBackground}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-emerald-950/40 active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? 'Saving Changes...' : 'Save Login Background'}</span>
            </button>
          </div>

          {/* Mode Selector Cards (Video, Picture, Celestial Mountain, Galaxy) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-200 block">
              Choose Login Screen Background Type
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  id: 'video',
                  title: 'Live Video Wallpaper',
                  desc: 'Continuous loop video (MP4/WebM), silent with 0 sound',
                  badge: 'Live Video Loop',
                  icon: <Video className="w-4 h-4 text-sky-400" />,
                  activeBorder: 'border-sky-500 ring-2 ring-sky-500/30 bg-sky-950/30 text-white',
                },
                {
                  id: 'image',
                  title: 'Custom Picture / Image',
                  desc: 'High-resolution photo or graphic with ambient live drift',
                  badge: 'Live Picture',
                  icon: <ImageIcon className="w-4 h-4 text-emerald-400" />,
                  activeBorder: 'border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-950/30 text-white',
                },
                {
                  id: 'cosmic',
                  title: 'Celestial Mountain',
                  desc: 'Original celestial mountains with comets & shooting stars',
                  badge: 'Default Live Canvas',
                  icon: <Sparkles className="w-4 h-4 text-purple-400" />,
                  activeBorder: 'border-purple-500 ring-2 ring-purple-500/30 bg-purple-950/30 text-white',
                },
                {
                  id: 'galaxy',
                  title: 'Spiral Galaxy Swirl',
                  desc: 'Dynamic 3D spiral arms, cosmic dust and glowing core',
                  badge: 'Galaxy Canvas',
                  icon: <Globe className="w-4 h-4 text-blue-400" />,
                  activeBorder: 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-950/30 text-white',
                },
              ].map((card) => {
                const isSelected = loginBgType === card.id;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => {
                      setLoginBgType(card.id as any);
                      // If switching to video and URL is empty, give a clean default
                      if (card.id === 'video' && !loginBgMediaUrl) {
                        setLoginBgMediaUrl('https://assets.mixkit.co/videos/preview/mixkit-space-odyssey-with-a-nebula-in-space-42618-large.mp4');
                      }
                    }}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group flex flex-col justify-between ${
                      isSelected
                        ? card.activeBorder
                        : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {card.icon}
                          <span className="text-xs font-bold text-white">{card.title}</span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-emerald-400" />}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                        {card.desc}
                      </p>
                    </div>
                    <span className="self-start text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300">
                      {card.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Media Input & File Upload (when Video or Image is selected) */}
          {(loginBgType === 'video' || loginBgType === 'image') && (
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-sky-400" />
                  <span>{loginBgType === 'video' ? 'Video Media Source (MP4 / WebM)' : 'Picture Media Source (PNG / JPG / WebP)'}</span>
                </label>
                <span className="text-[11px] text-slate-500 font-mono">
                  {loginBgType === 'video' ? 'Direct link or local video file' : 'Direct link or local image file'}
                </span>
              </div>

              {/* URL Input */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Direct Media URL ({loginBgType === 'video' ? 'Paste direct .mp4 or .webm link' : 'Paste direct image URL'})
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={loginBgMediaUrl}
                    onChange={(e) => setLoginBgMediaUrl(e.target.value)}
                    placeholder={
                      loginBgType === 'video'
                        ? 'https://example.com/live-galaxy-wallpaper.mp4'
                        : 'https://example.com/wallpaper.jpg'
                    }
                    className="flex-1 px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-sky-500"
                  />
                  {loginBgMediaUrl && (
                    <button
                      type="button"
                      onClick={() => setLoginBgMediaUrl('')}
                      className="px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-xs font-bold"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Local File Upload Button (Supports up to 50MB) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold text-slate-400">
                    Or Upload Directly from Your Computer / Phone:
                  </label>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    Storage: Up to 50MB
                  </span>
                </div>
                <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-5 cursor-pointer transition-all group ${
                  isUploadingMedia 
                    ? 'border-sky-500 bg-sky-950/30 pointer-events-none' 
                    : 'border-slate-700 hover:border-sky-500 bg-slate-900/60 hover:bg-slate-900'
                }`}>
                  {isUploadingMedia ? (
                    <RefreshCw className="w-7 h-7 text-sky-400 animate-spin mb-1.5" />
                  ) : (
                    <Upload className="w-7 h-7 text-slate-500 group-hover:text-sky-400 transition-colors mb-1.5" />
                  )}
                  <span className="text-xs font-bold text-slate-200 group-hover:text-white">
                    {isUploadingMedia 
                      ? 'Uploading to server media storage (up to 50MB)... Please wait' 
                      : `Click to browse ${loginBgType === 'video' ? 'Video File (MP4, WebM)' : 'Picture (PNG, JPG, WebP)'}`}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5">
                    {mediaFileName ? `Selected: ${mediaFileName}` : 'High-capacity storage: Accepts media files up to 50MB'}
                  </span>
                  <input
                    type="file"
                    disabled={isUploadingMedia}
                    accept={loginBgType === 'video' ? 'video/mp4, video/webm, video/*' : 'image/*'}
                    onChange={handleMediaFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Curated 1-Click Presets */}
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Recommended 1-Click {loginBgType === 'video' ? 'Video' : 'Picture'} Presets</span>
                  </label>
                  <span className="text-[10px] text-slate-500">Instant Live Preview</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {loginBgType === 'video' ? (
                    [
                      {
                        label: 'Deep Space Nebula',
                        url: 'https://assets.mixkit.co/videos/preview/mixkit-space-odyssey-with-a-nebula-in-space-42618-large.mp4',
                        desc: 'Vibrant interstellar cosmic dust',
                      },
                      {
                        label: 'Starry Sky & Aurora',
                        url: 'https://assets.mixkit.co/videos/preview/mixkit-starry-sky-with-flying-stars-and-aurora-borealis-42517-large.mp4',
                        desc: 'Northern lights with shooting stars',
                      },
                      {
                        label: 'Futuristic Neon Tunnel',
                        url: 'https://assets.mixkit.co/videos/preview/mixkit-tunnel-of-futuristic-neon-lights-42526-large.mp4',
                        desc: 'Cyber high-speed geometric grid',
                      },
                    ].map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setLoginBgMediaUrl(p.url);
                          setLoginBgType('video');
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          loginBgMediaUrl === p.url
                            ? 'bg-sky-950/60 border-sky-500 text-sky-200 font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="text-xs font-bold text-slate-200">{p.label}</div>
                        <div className="text-[10px] text-slate-500 truncate">{p.desc}</div>
                      </button>
                    ))
                  ) : (
                    [
                      {
                        label: 'Cosmic Mountain HD',
                        url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1920&q=80',
                        desc: 'Atmospheric alpine twilight',
                      },
                      {
                        label: 'Deep Galactic Core',
                        url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1920&q=80',
                        desc: 'High-tech illuminated globe & stars',
                      },
                      {
                        label: 'Cyber Emerald Horizon',
                        url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1920&q=80',
                        desc: 'Deep cosmic green neon expanse',
                      },
                    ].map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setLoginBgMediaUrl(p.url);
                          setLoginBgType('image');
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          loginBgMediaUrl === p.url
                            ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200 font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="text-xs font-bold text-slate-200">{p.label}</div>
                        <div className="text-[10px] text-slate-500 truncate">{p.desc}</div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Video Options & Overlay Darkness Slider */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Control 1: Video Loop Setting */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2 flex flex-col justify-between">
              <div>
                <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <Play className="w-3.5 h-3.5 text-sky-400" />
                  <span>Continuous Video Loop (Live Wallpaper)</span>
                </label>
                <p className="text-[11px] text-slate-400 mt-1">
                  When enabled, video automatically replays seamlessly in an infinite loop with zero gaps and muted sound.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setLoginBgVideoLoop(!loginBgVideoLoop)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    loginBgVideoLoop ? 'bg-sky-500' : 'bg-slate-800'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-200 ease-in-out ${
                      loginBgVideoLoop ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className="text-xs font-semibold text-slate-300">
                  {loginBgVideoLoop ? 'Looping Live (Enabled)' : 'Play Once (Disabled)'}
                </span>
              </div>
            </div>

            {/* Control 2: Darkening Scrim Opacity Slider */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Background Darkening Contrast</span>
                </label>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  {loginBgOpacity}%
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Adjust the dark overlay scrim so the login card and credentials text always pop out with crisp clarity.
              </p>
              <div className="pt-2">
                <input
                  type="range"
                  min="0"
                  max="95"
                  step="5"
                  value={loginBgOpacity}
                  onChange={(e) => setLoginBgOpacity(Number(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                  <span>Transparent (0%)</span>
                  <span>Recommended (65%)</span>
                  <span>Deep Dark (95%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Miniature Live Preview Card */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5 text-sky-400" />
                <span>Live Interactive Screen Preview (Real-Time Mockup)</span>
              </label>
              <span className="text-[11px] text-slate-400 font-mono">
                Shows exact wallpaper & overlay rendering
              </span>
            </div>

            <div className="relative w-full h-64 sm:h-80 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl bg-black flex items-center justify-center">
              {/* Media Preview Layer */}
              {loginBgType === 'video' && loginBgMediaUrl ? (
                <video
                  src={loginBgMediaUrl}
                  autoPlay
                  loop={loginBgVideoLoop}
                  muted
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none filter brightness-95"
                />
              ) : loginBgType === 'image' && loginBgMediaUrl ? (
                <img
                  src={loginBgMediaUrl}
                  alt="Preview"
                  className="absolute inset-0 w-full h-full object-cover filter brightness-95"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex items-center justify-center">
                  <div className="text-center p-4">
                    <Sparkles className="w-8 h-8 text-sky-400 mx-auto mb-2 animate-pulse" />
                    <p className="text-xs font-bold text-slate-300">
                      {loginBgType === 'galaxy' ? 'Cosmic Spiral Galaxy Canvas' : 'Celestial Mountain & Comets Canvas'}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Rendered dynamically via GPU canvas on login page</p>
                  </div>
                </div>
              )}

              {/* Scrim Overlay */}
              <div
                className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/70 pointer-events-none"
                style={{ opacity: loginBgOpacity / 100 }}
              />

              {/* Floating Mini Login Card */}
              <div className="relative z-10 w-64 bg-slate-900/85 border border-blue-500/30 rounded-2xl p-4 shadow-2xl ring-1 ring-white/10 text-center space-y-2 pointer-events-none scale-90 sm:scale-100">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 mx-auto flex items-center justify-center">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white">Sign In Preview</h4>
                  <div className="h-0.5 w-12 mx-auto bg-gradient-to-r from-emerald-400 via-white to-blue-500 rounded-full mt-1" />
                </div>
                <div className="space-y-1.5 pt-1 text-left">
                  <div className="h-6 rounded-lg bg-slate-950/80 border border-slate-800 px-2 flex items-center text-[9px] text-slate-400 font-mono">
                    Username
                  </div>
                  <div className="h-6 rounded-lg bg-slate-950/80 border border-slate-800 px-2 flex items-center text-[9px] text-slate-400 font-mono">
                    ••••••••
                  </div>
                  <div className="h-6 rounded-lg bg-emerald-500 text-slate-950 text-[9px] font-bold flex items-center justify-center shadow-md">
                    Sign In
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-2 flex items-center justify-end">
            <button
              type="button"
              onClick={handleSaveLoginBackground}
              disabled={isSaving}
              className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-emerald-950/40 active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? 'Updating Settings...' : 'Save Login Background Settings'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Branding & Logo */}
      {activeTab === 'branding' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <ImageIcon className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Website Title, Tagline & Logo Customization</h3>
          </div>

          <div className="space-y-4 max-w-lg text-xs">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Website Name</label>
              <input
                type="text"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="KB MAX"
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Tagline</label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Live SMS Relay & Gateway Portal"
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Logo Configuration</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setLogoType('icon')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    logoType === 'icon'
                      ? 'bg-slate-800 border-emerald-500 text-white font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <span className="block text-xs font-bold text-white">Default Icon</span>
                  <span className="text-[10px] text-slate-400">Animated high-tech live radar</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLogoType('custom_url')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    logoType === 'custom_url'
                      ? 'bg-slate-800 border-emerald-500 text-white font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <span className="block text-xs font-bold text-white">Custom Picture / File</span>
                  <span className="text-[10px] text-slate-400">Upload image from phone/PC</span>
                </button>
              </div>

              {logoType === 'custom_url' && (
                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
                  {/* File Upload Selector */}
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                      <span>Upload Logo File (PNG, JPG, SVG, WebP)</span>
                      <span className="text-[10px] text-emerald-400 font-mono">Max 2MB</span>
                    </label>
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-xl p-4 cursor-pointer bg-slate-900/50 hover:bg-slate-900 transition-all group">
                      <ImageIcon className="w-8 h-8 text-slate-500 group-hover:text-emerald-400 transition-colors mb-1.5" />
                      <span className="text-xs font-bold text-slate-200 group-hover:text-white">
                        Click here to select file from device
                      </span>
                      <span className="text-[10px] text-slate-500 mt-0.5">
                        Opens file explorer / gallery to choose your logo
                      </span>
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                        onChange={handleLogoFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Image Preview Box */}
                  {customLogoUrl && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="flex items-center gap-3">
                        <img
                          src={customLogoUrl}
                          alt="Logo Preview"
                          className="w-12 h-12 object-contain rounded-lg border border-slate-700 bg-slate-950 p-1"
                        />
                        <div>
                          <p className="text-xs font-bold text-white">
                            {logoFileName || 'Custom Logo Active'}
                          </p>
                          <p className="text-[10px] text-emerald-400 font-mono">Ready to save</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomLogoUrl('');
                          setLogoFileName('');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[11px] font-semibold transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  )}

                  {/* Or Direct Image URL */}
                  <div className="pt-2 border-t border-slate-800/80">
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Or paste an online Image URL:
                    </label>
                    <input
                      type="url"
                      value={customLogoUrl}
                      onChange={(e) => setCustomLogoUrl(e.target.value)}
                      placeholder="https://example.com/logo.png"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* VPS Host / Custom Domain URL */}
            <div className="pt-3 border-t border-slate-800">
              <label className="block font-semibold text-slate-300 mb-1">
                VPS Host / Custom Domain (Without Port 3000)
              </label>
              <input
                type="text"
                value={publicServerUrl}
                onChange={(e) => setPublicServerUrl(e.target.value)}
                placeholder="e.g. http://your-vps-ip or https://sms.yourdomain.com"
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-xs placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Optional: Enter your clean VPS IP or domain without :3000. All direct Login links and API snippets will use this address. Leave empty to auto-detect from browser.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSaveBrandingAndTheme}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
            >
              {isSaving ? 'Saving...' : 'Save Branding Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: Theme Presets & Client Session Timer */}
      {activeTab === 'theme' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Palette className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Color Themes & Session Timer Settings</h3>
          </div>

          <div className="space-y-4">
            <div>
              <span className="block text-xs font-semibold text-slate-300 mb-2">
                Select Theme Palette
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(Object.keys(THEMES) as ThemePreset[]).map((tKey) => {
                  const t = THEMES[tKey];
                  const isSelected = selectedTheme === tKey;
                  return (
                    <button
                      key={tKey}
                      type="button"
                      onClick={() => setSelectedTheme(tKey)}
                      className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden ${
                        isSelected
                          ? 'bg-slate-800 border-emerald-500 ring-2 ring-emerald-500/30'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-white">{t.name}</span>
                        {isSelected && <Check className="w-4 h-4 text-emerald-400" />}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-4 h-4 rounded-full ${t.primaryBg.split(' ')[0]}`} />
                        <span className="text-[10px] text-slate-400 uppercase font-mono">{tKey}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Client Session Duration Setting */}
            <div className="border-t border-slate-800 pt-4 max-w-lg">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-emerald-400" />
                <label className="font-semibold text-slate-200 text-xs">
                  Fixed Client Session Duration (Minutes)
                </label>
              </div>
              <p className="text-[11px] text-slate-400 mb-2">
                Uniformly fixed by Admin for all clients. Every client session will strictly adhere to this exact duration.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={clientSessionMinutes}
                  onChange={(e) => setClientSessionMinutes(Math.max(1, Math.min(1440, Number(e.target.value) || 1)))}
                  className="w-32 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-sm font-bold focus:outline-none focus:border-emerald-500"
                />
                <span className="text-xs text-slate-300 font-medium">Minutes</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveBrandingAndTheme}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md active:scale-95"
            >
              {isSaving ? 'Saving...' : 'Apply Theme & Timers'}
            </button>
          </div>
        </div>
      )}

      {/* Tab: Live SMS Table & Font Color Studio */}
      {activeTab === 'sms_style' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <div>
                <h3 className="text-sm font-bold text-white">Live SMS Table & Font Color Studio</h3>
                <p className="text-xs text-slate-400 font-mono">
                  Personalize exact background colors, font colors, and border styles for Live SMS
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSaveSmsColors}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Live SMS Colors'}</span>
            </button>
          </div>

          {/* Quick 1-Click Color Presets */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
                1-Click Recommended Color Palettes
              </label>
              <span className="text-[11px] text-slate-500 font-mono">Click to preview instantly</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {[
                { id: 'default', label: 'Default Cyber', bg: '#090d16', text: '#f8fafc', border: '#1e293b' },
                { id: 'oled', label: 'OLED Pure Black', bg: '#000000', text: '#ffffff', border: '#27272a' },
                { id: 'matrix', label: 'Hacker Matrix', bg: '#05100a', text: '#4ade80', border: '#166534' },
                { id: 'navy', label: 'Midnight Navy', bg: '#081028', text: '#f1f5f9', border: '#1e3a8a' },
                { id: 'light', label: 'Crisp White Light', bg: '#ffffff', text: '#0f172a', border: '#cbd5e1' },
                { id: 'gold', label: 'Luxury Gold', bg: '#13100a', text: '#fef08a', border: '#854d0e' },
              ].map((p) => {
                const isActive = smsTableBgColor === p.bg && smsTextColor === p.text;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applySmsPreset(p.id as any)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                      isActive
                        ? 'border-emerald-500 ring-2 ring-emerald-500/40 bg-slate-800'
                        : 'border-slate-800 bg-slate-950/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">
                        {p.label}
                      </span>
                      {isActive && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-4 h-4 rounded-md border border-slate-700 shadow-sm"
                        style={{ backgroundColor: p.bg }}
                        title="Background"
                      />
                      <span
                        className="w-4 h-4 rounded-md border border-slate-700 shadow-sm flex items-center justify-center text-[9px] font-bold"
                        style={{ backgroundColor: p.bg, color: p.text }}
                        title="Font Color"
                      >
                        A
                      </span>
                      <span
                        className="w-3.5 h-3.5 rounded-full"
                        style={{ backgroundColor: p.border }}
                        title="Border Color"
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Granular Custom Color Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-800">
            {/* Control 1: Table & Box Background Color */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
              <label className="text-xs font-bold text-slate-300 block">
                Table & Box Background Color
              </label>
              <p className="text-[11px] text-slate-500">
                Primary canvas color for SMS cards and table rows
              </p>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="color"
                  value={smsTableBgColor.length === 7 ? smsTableBgColor : '#090d16'}
                  onChange={(e) => {
                    setSmsTableBgColor(e.target.value);
                    setSmsPresetTheme('custom');
                  }}
                  className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border border-slate-700 p-0.5"
                />
                <input
                  type="text"
                  value={smsTableBgColor}
                  onChange={(e) => {
                    setSmsTableBgColor(e.target.value);
                    setSmsPresetTheme('custom');
                  }}
                  placeholder="#090d16"
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono text-xs font-bold"
                />
              </div>
            </div>

            {/* Control 2: Font & Text Color */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
              <label className="text-xs font-bold text-slate-300 block">
                SMS Text & Font Color
              </label>
              <p className="text-[11px] text-slate-500">
                Color for the SMS message text and numbers
              </p>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="color"
                  value={smsTextColor.length === 7 ? smsTextColor : '#f8fafc'}
                  onChange={(e) => {
                    setSmsTextColor(e.target.value);
                    setSmsPresetTheme('custom');
                  }}
                  className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border border-slate-700 p-0.5"
                />
                <input
                  type="text"
                  value={smsTextColor}
                  onChange={(e) => {
                    setSmsTextColor(e.target.value);
                    setSmsPresetTheme('custom');
                  }}
                  placeholder="#f8fafc"
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono text-xs font-bold"
                />
              </div>
            </div>

            {/* Control 3: Card Border Color */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
              <label className="text-xs font-bold text-slate-300 block">
                Card & Box Border Color
              </label>
              <p className="text-[11px] text-slate-500">
                Accent border line around each SMS block
              </p>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="color"
                  value={smsBorderColor.length === 7 ? smsBorderColor : '#1e293b'}
                  onChange={(e) => {
                    setSmsBorderColor(e.target.value);
                    setSmsPresetTheme('custom');
                  }}
                  className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border border-slate-700 p-0.5"
                />
                <input
                  type="text"
                  value={smsBorderColor}
                  onChange={(e) => {
                    setSmsBorderColor(e.target.value);
                    setSmsPresetTheme('custom');
                  }}
                  placeholder="#1e293b"
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono text-xs font-bold"
                />
              </div>
            </div>
          </div>

          {/* Font Size Selection */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <div>
              <span className="text-xs font-bold text-slate-300 block">SMS Message Font Size</span>
              <span className="text-[11px] text-slate-500">Adjust reading size for message content</span>
            </div>
            <div className="flex items-center gap-2">
              {(['compact', 'normal', 'large'] as const).map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setSmsFontSize(size)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                    smsFontSize === size
                      ? 'bg-emerald-500 text-slate-950 shadow-md'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* LIVE REAL-TIME PREVIEW */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-emerald-400" />
                Live Real-Time Visual Preview
              </span>
              <span className="text-[10.5px] font-mono text-emerald-400">Updates live as you adjust colors</span>
            </div>

            {/* Render Preview of Pro Box with Selected Custom Colors */}
            <div
              className="rounded-2xl p-4 shadow-2xl transition-all border"
              style={{
                backgroundColor: smsTableBgColor,
                borderColor: smsBorderColor,
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-stretch">
                {/* Box 1: CLI & Phone */}
                <div
                  className="md:col-span-3 p-3 rounded-xl border flex flex-col justify-between space-y-2 shadow-inner"
                  style={{
                    backgroundColor: smsTableBgColor === '#ffffff' ? '#f8fafc' : 'rgba(0,0,0,0.3)',
                    borderColor: smsBorderColor,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold uppercase text-sky-400">
                      CLI SENDER
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold border border-sky-500/40">
                      WhatsApp
                    </span>
                  </div>
                  <div>
                    <div className="text-[9.5px] font-mono text-slate-400 uppercase">Target Phone:</div>
                    <div
                      className="font-mono font-black text-sm tracking-wide"
                      style={{ color: smsTextColor }}
                    >
                      +44 7700 900077
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-700/50">
                    Live Status: Connected
                  </div>
                </div>

                {/* Box 2: Country */}
                <div
                  className="md:col-span-3 p-3 rounded-xl border flex flex-col justify-between space-y-2 shadow-inner"
                  style={{
                    backgroundColor: smsTableBgColor === '#ffffff' ? '#f8fafc' : 'rgba(0,0,0,0.3)',
                    borderColor: smsBorderColor,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold uppercase text-emerald-400">
                      DESTINATION
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                      United Kingdom
                    </span>
                  </div>
                  <div>
                    <div className="text-[9.5px] font-mono text-slate-400 uppercase">Service Route:</div>
                    <div
                      className="font-mono font-bold text-xs"
                      style={{ color: smsTextColor }}
                    >
                      Premium OTP Gateway #1
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-700/50">
                    Priority: High Speed
                  </div>
                </div>

                {/* Box 3: Message & OTP */}
                <div
                  className="md:col-span-4 p-3 rounded-xl border flex flex-col justify-between space-y-2 shadow-inner"
                  style={{
                    backgroundColor: smsTableBgColor === '#ffffff' ? '#f1f5f9' : 'rgba(0,0,0,0.4)',
                    borderColor: smsBorderColor,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold uppercase text-indigo-400">
                      SMS MESSAGE CONTENT
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">
                      OTP: 839201
                    </span>
                  </div>
                  <p
                    className={`leading-relaxed font-sans ${
                      smsFontSize === 'large'
                        ? 'text-sm'
                        : smsFontSize === 'compact'
                        ? 'text-[11px]'
                        : 'text-xs'
                    }`}
                    style={{ color: smsTextColor }}
                  >
                    Your WhatsApp verification code is <strong>839201</strong>. Do not share this code with anyone. Valid for 10 minutes.
                  </p>
                  <div className="text-[9.5px] font-mono text-slate-400 pt-1 border-t border-slate-700/50">
                    Length: 98 chars | Format: GSM-7
                  </div>
                </div>

                {/* Box 4: Timestamp */}
                <div
                  className="md:col-span-2 p-3 rounded-xl border flex flex-col justify-between space-y-2 shadow-inner"
                  style={{
                    backgroundColor: smsTableBgColor === '#ffffff' ? '#f8fafc' : 'rgba(0,0,0,0.3)',
                    borderColor: smsBorderColor,
                  }}
                >
                  <span className="text-[10px] font-mono font-bold uppercase text-purple-400">
                    TIMESTAMP
                  </span>
                  <div>
                    <div
                      className="font-mono font-bold text-xs"
                      style={{ color: smsTextColor }}
                    >
                      Just now
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      2026-09-13 20:00:15
                    </div>
                  </div>
                  <div className="text-[9.5px] font-mono text-emerald-400 font-bold pt-1 border-t border-slate-700/50">
                    Stream: Active
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Save Action */}
          <div className="pt-2 flex items-center justify-end">
            <button
              type="button"
              onClick={handleSaveSmsColors}
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? 'Saving Colors...' : 'Save Live SMS Colors'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab 4: VPS Setup Guide & Port 3000 Configuration */}
      {activeTab === 'vps' && (
        <div className="space-y-6" id="vps-settings-container">
          {/* Active Login URL Card */}
          <div className="bg-slate-900/90 border border-blue-500/30 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                      Live Portal Login URL
                    </h3>
                    <span className={`text-[9.5px] font-mono px-2 py-0.5 rounded font-bold border ${
                      !directLoginUrl.includes(':3000')
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                    }`}>
                      {!directLoginUrl.includes(':3000') ? 'Direct VPS (Port 3000 Removed)' : 'Port 3000 Active'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    This is the direct URL clients and admins use to sign in
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleCopy(directLoginUrl, 'active-login-url')}
                className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shrink-0"
              >
                {copiedKey === 'active-login-url' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copy Login URL</span>
                  </>
                )}
              </button>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
              <span className="font-mono text-xs text-emerald-300 font-semibold select-all break-all">
                {directLoginUrl}
              </span>
            </div>
          </div>

          {/* VPS Host / Custom Domain URL Configuration */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Server className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">VPS Host / Custom Domain Setting</h3>
            </div>

            <div className="max-w-xl space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">
                  VPS Server URL (Clean without :3000)
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={publicServerUrl}
                    onChange={(e) => setPublicServerUrl(e.target.value)}
                    placeholder="e.g. http://your-vps-ip or https://sms.yourdomain.com"
                    className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-xs placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSaveVpsDomain}
                    disabled={isSaving}
                    className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {isSaving ? 'Saving...' : 'Save Host URL'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                  Enter your VPS IP address or domain (e.g. <code className="text-emerald-400 font-mono font-bold">http://123.45.67.89</code> or <code className="text-emerald-400 font-mono font-bold">https://sms.example.com</code>). 
                  If you run behind Nginx or on Port 80, do NOT include :3000. All direct Login links, client share text, and webhook URLs will automatically use this clean address!
                </p>
              </div>
            </div>
          </div>

          {/* Remove Port 3000 Guide via Nginx */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold border border-emerald-500/30">
                    RECOMMENDED
                  </span>
                  <h3 className="text-sm font-bold text-white">Method 1: Remove Port 3000 via Nginx (Direct VPS Root)</h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Allows users to open <code className="text-emerald-300 font-mono font-bold">http://your-vps-ip/ints/login</code> directly without typing :3000
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(nginxRemovePortCommands, 'nginx-script')}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
              >
                {copiedKey === 'nginx-script' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-blue-400" />}
                <span>{copiedKey === 'nginx-script' ? 'Copied' : 'Copy Nginx Commands'}</span>
              </button>
            </div>

            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-emerald-400 text-[11px] overflow-x-auto select-all leading-relaxed">
              {nginxRemovePortCommands}
            </pre>
          </div>

          {/* Method 2: Direct Port 80 Run */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Method 2: Run KB MAX Directly on Port 80 (No Nginx)</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Start Node.js directly on port 80 using PM2 without Nginx reverse proxy
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(directPort80Commands, 'port80-script')}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
              >
                {copiedKey === 'port80-script' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-blue-400" />}
                <span>{copiedKey === 'port80-script' ? 'Copied' : 'Copy Port 80 Commands'}</span>
              </button>
            </div>

            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-emerald-400 text-[11px] overflow-x-auto select-all leading-relaxed">
              {directPort80Commands}
            </pre>
          </div>

          {/* Method 3: Standard PM2 24/7 Setup */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Standard PM2 Installation & 24/7 Background Process</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Initial Node.js, PM2, and dependencies setup on Ubuntu/Debian
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(vpsSetupCommands, 'vps-script')}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
              >
                {copiedKey === 'vps-script' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-blue-400" />}
                <span>{copiedKey === 'vps-script' ? 'Copied' : 'Copy PM2 Commands'}</span>
              </button>
            </div>

            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-emerald-400 text-[11px] overflow-x-auto select-all leading-relaxed">
              {vpsSetupCommands}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
