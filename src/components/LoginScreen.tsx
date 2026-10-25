import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lock, 
  User, 
  ShieldCheck, 
  Radio, 
  AlertCircle, 
  ArrowRight,
  Eye,
  EyeOff,
  Clock,
  Server,
  KeyRound
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BrandLogo } from './common/BrandLogo';
import { ThemeToggle } from './common/ThemeToggle';
import { LoginLiveBackground } from './common/LoginLiveBackground';
import { THEMES } from '../utils/theme';

export const LoginScreen: React.FC = () => {
  const { login, logoutReason, clearLogoutReason, settings } = useAuth();
  const theme = settings?.theme ? THEMES[settings.theme] : THEMES.emerald;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [remainingLockSec, setRemainingLockSec] = useState<number>(0);
  const [inactiveModalOpen, setInactiveModalOpen] = useState(false);
  const [deactivatedUser, setDeactivatedUser] = useState('');

  // Live countdown ticker for 15-minute lock duration
  useEffect(() => {
    if (!lockedUntil) {
      setRemainingLockSec(0);
      return;
    }

    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setRemainingLockSec(remaining);
      if (remaining <= 0) {
        setLockedUntil(null);
        setError(null);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      setError('Please enter both username and password.');
      return;
    }

    if (lockedUntil && Date.now() < lockedUntil) {
      setError('This Client ID is temporarily locked. Please wait until the lockout timer expires.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const result = await login(cleanUser, cleanPass);
    if (!result.success) {
      if (result.isLocked && result.lockedUntil) {
        setLockedUntil(result.lockedUntil);
      }
      if (result.isInactive3Days) {
        setDeactivatedUser(cleanUser);
        setInactiveModalOpen(true);
      }
      setError(result.error || 'Incorrect username or password. Please check your credentials.');
      setIsSubmitting(false);
    } else {
      // Ensure Dashboard is strictly the first view upon login
      window.history.replaceState(null, '', '/admin/dashboard');
    }
  };

  const lockMinutes = Math.floor(remainingLockSec / 60);
  const lockSeconds = remainingLockSec % 60;

  return (
    <div className="min-h-screen w-full bg-[#030712] flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans selection:bg-emerald-600 selection:text-white">
      {/* Live Background Wallpaper: Custom Video in continuous loop, Custom Image, Celestial Mountain, or Galaxy */}
      <LoginLiveBackground settings={settings} />

      <div className="relative z-10 w-full max-w-md flex flex-col items-center">
        {/* Main Brand Logo Header (Large, Prominent & Distinct) */}
        <div className="mb-8 flex flex-col items-center justify-center scale-105 sm:scale-110 transition-transform">
          <BrandLogo size="2xl" layout="vertical" />
        </div>

        {/* Clean Login Card with Green, White, and Blue Theme */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="w-full bg-slate-900/85 border border-blue-500/25 rounded-3xl shadow-[0_20px_50px_rgba(3,7,18,0.9),0_0_35px_rgba(37,99,235,0.18),0_0_35px_rgba(16,185,129,0.14)] backdrop-blur-2xl p-7 sm:p-9 ring-1 ring-white/10"
          id="login-card-container"
        >
          {/* Header Title with Green-White-Blue Accent Bar */}
          <div className="text-center space-y-1.5 mb-6">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Sign In
            </h1>
            <div className="h-1.5 w-24 mx-auto rounded-full bg-gradient-to-r from-emerald-400 via-white to-blue-500 shadow-md shadow-blue-500/30" />
            <p className="text-xs text-slate-300 font-medium pt-1">
              Enter your credentials to access the secure portal
            </p>
          </div>

          {/* Session Terminated / Logout Reason Banner */}
          <AnimatePresence>
            {logoutReason && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-5 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5"
              >
                <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-amber-300">Session Ended</p>
                  <p className="mt-0.5 text-slate-300">{logoutReason}</p>
                </div>
                <button
                  type="button"
                  onClick={clearLogoutReason}
                  className="text-amber-400 hover:text-amber-200 text-xs font-bold px-1 cursor-pointer"
                >
                  ✕
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 15-Minute Concurrency Violation Lockout Banner */}
          <AnimatePresence>
            {lockedUntil && remainingLockSec > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -8 }}
                className="mb-5 p-4 rounded-2xl bg-rose-950/90 border-2 border-rose-500/60 shadow-xl shadow-rose-950/50 text-rose-100 text-xs space-y-2.5"
                id="lockout-timer-banner"
              >
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-lg bg-rose-500/20 text-rose-400">
                    <Lock className="w-4 h-4 animate-bounce" />
                  </span>
                  <div className="flex-1">
                    <span className="font-bold text-rose-300 block text-xs tracking-wide uppercase">
                      Client ID Locked (15 Minutes)
                    </span>
                    <span className="text-[11px] text-rose-200/90 leading-tight block">
                      Max 3 users allowed. 4th user access attempt triggered security lockout.
                    </span>
                  </div>
                </div>

                <div className="bg-slate-950/90 border border-rose-500/30 rounded-xl p-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-slate-300 font-medium text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-rose-400" />
                    <span>Auto-Unlock In:</span>
                  </div>
                  <div className="font-mono font-black text-rose-300 text-sm tracking-widest px-2.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/30">
                    {String(lockMinutes).padStart(2, '0')}:{String(lockSeconds).padStart(2, '0')}
                  </div>
                </div>

                <p className="text-[10px] text-rose-300/80 italic text-center">
                  Notice: This Client ID cannot be accessed during lockout. Please wait for the cooldown timer to expire.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Instant Authentication Error Banner */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key={error}
                initial={{ opacity: 0, scale: 0.95, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -6 }}
                transition={{ duration: 0.2 }}
                className="mb-5 p-3.5 rounded-2xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2.5 shadow-lg shadow-rose-950/30"
                id="login-error-notice"
              >
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 animate-pulse" />
                <p className="font-semibold flex-1 leading-snug">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4" id="login-form">
            <div>
              <label 
                className="block text-xs font-bold text-white uppercase tracking-wider mb-1.5" 
                htmlFor="username-input"
              >
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="username-input"
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Enter username"
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/85 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30 transition-all font-mono shadow-inner"
                />
              </div>
            </div>

            <div>
              <label 
                className="block text-xs font-bold text-white uppercase tracking-wider mb-1.5" 
                htmlFor="password-input"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-blue-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Enter password"
                  className="w-full pl-10 pr-10 py-3 bg-slate-950/85 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 transition-all font-mono shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Gradient Button from Emerald Green via Royal Blue to Sky Blue */}
            <button
              id="login-submit-btn"
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-blue-600 to-sky-500 hover:from-emerald-500 hover:via-blue-500 hover:to-sky-400 text-white font-black shadow-xl shadow-blue-950/40 border border-white/20 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed mt-5 cursor-pointer active:scale-[0.98]"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>

      {/* 3-Day Inactivity Account Deactivation Modal */}
      <AnimatePresence>
        {inactiveModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="w-full max-w-md bg-slate-900 border-2 border-blue-500/60 rounded-3xl p-6 sm:p-8 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_35px_rgba(37,99,235,0.25)] space-y-5 text-slate-100 ring-1 ring-white/10"
            >
              <div className="flex items-start gap-4">
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-emerald-500/25 to-blue-500/25 border-2 border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0 shadow-xl">
                  <AlertCircle className="w-7 h-7" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-mono font-bold tracking-wider text-emerald-400 uppercase block">
                    Security Policy Notice
                  </span>
                  <h3 className="text-xl font-black text-white tracking-tight mt-0.5">
                    Account Deactivated
                  </h3>
                  <div className="h-0.5 w-14 rounded-full bg-gradient-to-r from-emerald-400 via-white to-blue-500 mt-1.5" />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/95 border border-slate-800 space-y-3 text-xs text-slate-300 leading-relaxed shadow-inner">
                <p className="font-semibold text-white">
                  Notice for Client Account: <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">"{deactivatedUser || username}"</span>
                </p>
                <p>
                  Your client account has been automatically deactivated because you did not open or access the portal within the required <span className="font-bold text-amber-300">3-day activity window</span>.
                </p>
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-100 space-y-1.5">
                  <div className="font-bold text-emerald-300 flex items-center gap-1.5 text-xs">
                    <KeyRound className="w-4 h-4 text-emerald-400" />
                    <span>How to Reactivate Your Account:</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-normal">
                    Please contact your System Administrator to request account reactivation. Once reactivated by the administrator, you will be able to log in immediately.
                  </p>
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setInactiveModalOpen(false)}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-blue-600 to-sky-500 hover:from-emerald-500 hover:via-blue-500 hover:to-sky-400 text-white font-black text-xs transition-all shadow-lg shadow-blue-950/40 cursor-pointer text-center active:scale-[0.98] border border-white/20"
                >
                  Understood & Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
