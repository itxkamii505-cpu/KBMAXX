import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileSpreadsheet, 
  Clock, 
  LogOut, 
  ShieldAlert, 
  User,
  Zap
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { BrandLogo } from '../common/BrandLogo';
import { SMSReportsView } from '../reports/SMSReportsView';
import { WhiteNoisePortalView } from '../whitenoise/WhiteNoisePortalView';

export const ClientPortalLayout: React.FC = () => {
  const { session, logout, formattedTimeRemaining, timeRemaining, isExpiringSoon } = useAuth();
  const hasApi2Access = Boolean(session?.whiteNoiseConfig?.enabled);

  // Tab state: 'reports' | 'whitenoise'
  const [activeTab, setActiveTab] = React.useState<'reports' | 'whitenoise'>('reports');

  // Ping client activity / panel open on mount
  useEffect(() => {
    if (!session) return;
    fetch('/api/client/activity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
    }).then(res => {
      if (res.status === 401 || res.status === 403) {
        logout('Your client account has been deactivated due to 3 days of inactivity. Please contact your Administrator to reactivate your access.');
      }
    }).catch(() => {});
  }, [session, logout]);

  // Sync browser URL with client active tab route
  useEffect(() => {
    const targetPath = activeTab === 'whitenoise' ? '/client/whitenoise' : '/client/sms-reports';
    if (window.location.pathname !== targetPath) {
      window.history.replaceState(null, '', targetPath);
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-[#edf2f7] text-slate-800 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Header Navigation for Member Portal - White + Green + Blue theme */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Logo & Section Tabs */}
          <div className="flex items-center gap-3 sm:gap-4">
            <BrandLogo size="md" showTagline={false} />

            <div className="h-6 w-px bg-slate-200 hidden sm:block" />

            {/* Navigation Tabs (Sidebar 2 appears when Admin grants WhiteNoise access!) */}
            {hasApi2Access ? (
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveTab('reports')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
                    activeTab === 'reports'
                      ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                  <span>{session?.panelType === 'reports2' ? 'SMS Reports 2 (Team)' : 'SMS Reports'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('whitenoise')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
                    activeTab === 'whitenoise'
                      ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-xs'
                      : 'text-indigo-600 hover:text-indigo-800'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 text-amber-300" />
                  <span>WhiteNoise SMS (API-2)</span>
                </button>
              </div>
            ) : (
              /* Allowed Page Indicator Badge when standard access only */
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold font-mono">
                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                <span>{session?.panelType === 'reports2' ? 'SMS Reports 2 (Team View)' : 'SMS Reports'}</span>
              </div>
            )}
          </div>

          {/* User Session, Timer & Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* User badge */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
              <div className="w-5 h-5 rounded-md bg-gradient-to-br from-blue-500 to-emerald-500 text-white flex items-center justify-center font-bold text-[10px]">
                <User className="w-3 h-3" />
              </div>
              <span className="font-bold text-slate-900 truncate max-w-[120px]">{session?.username}</span>
              <span className="text-[10px] text-emerald-600 font-mono font-bold">Client</span>
            </div>

            {/* Countdown Session Timer */}
            <div
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition-colors ${
                isExpiringSoon
                  ? 'bg-rose-50 border-rose-300 text-rose-700 animate-pulse'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
              title={`Automatic session auto-logout countdown (${formattedTimeRemaining} remaining)`}
            >
              <Clock className={`w-3.5 h-3.5 ${isExpiringSoon ? 'text-rose-500' : 'text-blue-600'}`} />
              <span className="hidden xs:inline text-slate-500 font-sans font-normal text-[11px]">Session:</span>
              <span className="text-slate-900 font-mono font-bold">{formattedTimeRemaining}</span>
            </div>

            {/* Logout Button */}
            <button
              id="btn-client-logout"
              type="button"
              onClick={() => logout('Logged out successfully.')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
              title="Logout from Member Console"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* Security Warning Bar when <= 60 seconds left */}
        <AnimatePresence>
          {isExpiringSoon && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-rose-600 text-white text-xs px-4 py-1 text-center font-medium flex items-center justify-center gap-2"
            >
              <ShieldAlert className="w-3.5 h-3.5 animate-bounce" />
              <span>Security notice: Your session is expiring in {timeRemaining} seconds!</span>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Member Viewport */}
      <main className="flex-1 w-full mx-auto">
        {activeTab === 'whitenoise' && hasApi2Access ? (
          <div className="p-4 sm:p-6 bg-slate-950 min-h-[calc(100vh-4rem)] text-slate-100">
            <WhiteNoisePortalView isAdmin={false} />
          </div>
        ) : (
          <SMSReportsView 
            embeddedInClient={true} 
            reportType={session?.panelType === 'reports2' ? 'reports2' : 'primary'} 
          />
        )}
      </main>
    </div>
  );
};

export default ClientPortalLayout;
