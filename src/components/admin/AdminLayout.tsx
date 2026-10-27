import React, { useState, useEffect, lazy, Suspense } from 'react';
import { 
  LayoutDashboard, 
  Server, 
  Users, 
  Radio, 
  Settings as SettingsIcon, 
  LogOut, 
  Menu, 
  X,
  ShieldCheck,
  ShieldAlert,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronLeft,
  ChevronRight,
  UploadCloud,
  FileSpreadsheet,
  Zap
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { BrandLogo } from '../common/BrandLogo';
import { ThemeToggle } from '../common/ThemeToggle';
import { DashboardView } from './DashboardView';
import { ApiProvidersView } from './ApiProvidersView';
import { ClientsView } from './ClientsView';
import { LiveSMSView } from './LiveSMSView';
import { SettingsView } from './SettingsView';
import { ClientFilterView } from './ClientFilterView';
import { BulkNumbersView } from './BulkNumbersView';
import { SMSReportsView } from '../reports/SMSReportsView';
import { WhiteNoisePortalView } from '../whitenoise/WhiteNoisePortalView';
import { THEMES } from '../../utils/theme';
import { triggerHapticFeedback } from '../../utils/haptics';

type AdminTab = 'dashboard' | 'providers' | 'clients' | 'sms' | 'sms-reports' | 'sms-reports-2' | 'client-filters' | 'settings' | 'bulk-numbers' | 'whitenoise';

const TAB_TO_PATH: Record<AdminTab, string> = {
  'dashboard': '/admin/dashboard',
  'sms-reports': '/admin/sms-reports',
  'sms-reports-2': '/admin/sms-reports-2',
  'sms': '/admin/sms',
  'whitenoise': '/admin/whitenoise',
  'client-filters': '/admin/client-filters',
  'providers': '/admin/providers',
  'clients': '/admin/clients',
  'settings': '/admin/settings',
  'bulk-numbers': '/admin/bulk-numbers',
};

const PATH_TO_TAB: Record<string, AdminTab> = {
  '/admin': 'dashboard',
  '/admin/': 'dashboard',
  '/': 'dashboard',
  '/admin/dashboard': 'dashboard',
  '/admin/sms-reports': 'sms-reports',
  '/admin/reports': 'sms-reports',
  '/admin/sms-reports-2': 'sms-reports-2',
  '/admin/team-reports': 'sms-reports-2',
  '/admin/sms': 'sms',
  '/admin/live-sms': 'sms',
  '/admin/whitenoise': 'whitenoise',
  '/admin/client-filters': 'client-filters',
  '/admin/providers': 'providers',
  '/admin/clients': 'clients',
  '/admin/settings': 'settings',
  '/admin/bulk-numbers': 'bulk-numbers',
};

export const AdminLayout: React.FC = () => {
  const { session, logout, settings } = useAuth();
  const theme = settings?.theme ? THEMES[settings.theme] : THEMES.emerald;

  // Sync active tab with browser URL - strictly defaults to 'dashboard' upon login
  const [activeTab, setActiveTabState] = useState<AdminTab>(() => {
    const currentPath = window.location.pathname;
    if (PATH_TO_TAB[currentPath]) {
      return PATH_TO_TAB[currentPath];
    }
    return 'dashboard';
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const navigateToTab = (tab: string) => {
    triggerHapticFeedback(12);
    const resolvedTab: AdminTab = tab === 'reports' ? 'sms-reports' : (tab as AdminTab);
    setActiveTabState(resolvedTab);
    const targetPath = TAB_TO_PATH[resolvedTab] || '/admin/dashboard';
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
  };

  // Listen to browser Back/Forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (PATH_TO_TAB[path]) {
        setActiveTabState(PATH_TO_TAB[path]);
      }
    };
    window.addEventListener('popstate', handlePopState);
    
    // Ensure initial URL matches active tab (strictly defaults to /admin/dashboard)
    const initialPath = TAB_TO_PATH[activeTab] || '/admin/dashboard';
    if (!PATH_TO_TAB[window.location.pathname] || window.location.pathname === '/login') {
      window.history.replaceState(null, '', initialPath);
    } else if (window.location.pathname === '/admin' || window.location.pathname === '/admin/' || window.location.pathname === '/') {
      window.history.replaceState(null, '', '/admin/dashboard');
    }

    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeTab]);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'sms-reports', label: 'SMS Reports', icon: FileSpreadsheet },
    { id: 'sms-reports-2', label: 'SMS Reports 2 (Team)', icon: ShieldCheck },
    { id: 'sms', label: 'Live SMS Relay', icon: Radio },
    { id: 'whitenoise', label: 'WhiteNoise SMS (API-2)', icon: Zap },
    { id: 'client-filters', label: 'Clients CLI Filter', icon: ShieldAlert },
    { id: 'providers', label: 'API Provider', icon: Server },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
    { id: 'bulk-numbers', label: 'Add Bulk Numbers', icon: UploadCloud },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row font-sans selection:bg-blue-600 selection:text-white">
      {/* Mobile Top Header with Menu Toggle */}
      <div className="md:hidden bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-3.5 py-2.5 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white flex items-center gap-1.5 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
            aria-label="Toggle Sidebar Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-emerald-400" /> : <Menu className="w-5 h-5 text-emerald-400" />}
            <span className="text-[11px] uppercase tracking-wider">{mobileMenuOpen ? 'Close' : 'Menu'}</span>
          </button>
          <BrandLogo size="sm" showTagline={false} />
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle size="sm" />
          <button
            type="button"
            onClick={() => logout('Admin logged out safely.')}
            className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 hover:bg-rose-500/20 cursor-pointer"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Drawer Backdrop (Click outside to close) */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 md:hidden transition-opacity"
        />
      )}

      {/* Sidebar (Desktop & Mobile Drawer with Collapse support) */}
      <aside
        className={`fixed md:sticky top-0 z-50 md:z-20 h-screen bg-slate-900/95 md:bg-slate-900/90 backdrop-blur-xl border-r border-slate-800 flex flex-col justify-between p-3.5 transition-all duration-300 ${
          mobileMenuOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'
        } ${sidebarCollapsed ? 'md:w-20' : 'md:w-64'}`}
        id="admin-sidebar"
      >
        <div className="space-y-4">
          {/* Logo & Desktop Collapse Toggle Button */}
          <div className="px-1 pt-1 flex items-center justify-between">
            {!sidebarCollapsed ? (
              <div className="overflow-hidden">
                <BrandLogo size="md" />
              </div>
            ) : (
              <div className="mx-auto text-emerald-400 font-black text-lg font-mono">
                KB
              </div>
            )}

            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Desktop Collapse / Expand Toggle Button */}
            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden md:flex items-center justify-center p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all ml-auto cursor-pointer"
              title={sidebarCollapsed ? 'Expand Sidebar' : 'Hide / Collapse Sidebar'}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4 text-emerald-400" /> : <PanelLeftClose className="w-4 h-4 text-slate-400" />}
            </button>
          </div>

          {/* Quick Toggle Button on Desktop */}
          <div className="hidden md:block">
            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={`w-full py-1.5 px-2 rounded-lg bg-slate-950/60 hover:bg-slate-800 border border-slate-800/80 text-[11px] font-medium text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                sidebarCollapsed ? 'px-1' : ''
              }`}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <>
                  <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
                  <span>Hide Sidebar</span>
                </>
              )}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5" id="admin-nav">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`admin-nav-${item.id}`}
                  type="button"
                  onClick={() => {
                    navigateToTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  title={item.label}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    sidebarCollapsed ? 'justify-center px-2' : ''
                  } ${
                    isActive
                      ? `${theme.primaryBg} shadow-lg shadow-blue-500/20 scale-[1.02]`
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  {!sidebarCollapsed && (
                    <div className="flex items-center justify-between flex-1 overflow-hidden">
                      <span className="tracking-wide truncate">{item.label}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom User & Logout Section */}
        <div className="pt-3 border-t border-slate-800 space-y-2.5">
          {!sidebarCollapsed ? (
            <div className="flex items-center justify-between px-1 text-xs">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-7 h-7 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <span className="font-bold text-white block truncate">{session?.username}</span>
                  <span className="text-[10px] text-emerald-400 font-mono">Admin Role</span>
                </div>
              </div>
            </div>
          ) : null}

          {/* Theme Selector (Day / Moon) */}
          <div className="flex items-center justify-center">
            {!sidebarCollapsed ? (
              <ThemeToggle variant="pill" showLabel className="w-full justify-around" />
            ) : (
              <ThemeToggle size="sm" />
            )}
          </div>

          {/* Logout Button */}
          <button
            id="admin-logout-btn"
            type="button"
            onClick={() => logout('Admin logged out safely.')}
            title="Logout"
            className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 hover:border-rose-500/40 text-xs font-bold transition-all cursor-pointer ${
              sidebarCollapsed ? 'p-2' : ''
            }`}
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar for Desktop with Section Title & Theme Toggle */}
        <div className="hidden md:flex items-center justify-between px-6 py-2.5 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
              {navItems.find(i => i.id === activeTab)?.label || 'Admin Panel'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle size="sm" showLabel />
          </div>
        </div>

        <main className="flex-1 p-2 sm:p-3.5 md:p-5 lg:p-6 xl:p-8 max-w-[1600px] w-full mx-auto">
          <Suspense fallback={<div className="py-16 text-center text-xs font-mono text-emerald-400 animate-pulse">Loading...</div>}>
          {activeTab === 'sms-reports' && <SMSReportsView reportType="primary" />}
          {activeTab === 'sms-reports-2' && <SMSReportsView reportType="reports2" />}
          {activeTab === 'dashboard' && <DashboardView onNavigate={(t) => navigateToTab(t as any)} />}
          {activeTab === 'providers' && <ApiProvidersView />}
          {activeTab === 'clients' && <ClientsView />}
          {activeTab === 'sms' && <LiveSMSView />}
          {activeTab === 'whitenoise' && <WhiteNoisePortalView isAdmin={true} />}
          {activeTab === 'client-filters' && <ClientFilterView />}
          {activeTab === 'settings' && <SettingsView />}
          {activeTab === 'bulk-numbers' && <BulkNumbersView token={session?.token || ''} />}
          </Suspense>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
