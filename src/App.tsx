import React, { lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LoginScreen } from './components/LoginScreen';
import { AdminLayout } from './components/admin/AdminLayout';
import { ClientPortalLayout } from './components/client/ClientPortalLayout';
import { Radio } from 'lucide-react';

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 gap-3">
      <div className="relative">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
          <Radio className="w-6 h-6 text-emerald-400 animate-pulse" />
        </div>
        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
      </div>
      <span className="text-xs font-mono text-emerald-400 tracking-wider font-semibold uppercase">
        KB MAX • Initializing Gateway...
      </span>
    </div>
  );
}

function AppContent() {
  const { session, isLoading } = useAuth();

  // Clean URL handling for /ints/login (VPS URL standard)
  React.useEffect(() => {
    if (!isLoading) {
      const p = window.location.pathname;
      if (!session) {
        // When not logged in, ensure browser URL is cleanly set to /ints/login
        if (p !== '/ints/login') {
          window.history.replaceState(null, '', '/ints/login');
        }
      } else {
        // When logged in, if on login/root paths, transition to active role dashboard
        if (p === '/ints/login' || p === '/login' || p === '/' || p === '/ints' || p === '/ints/') {
          if (session.role === 'admin') {
            window.history.replaceState(null, '', '/admin/dashboard');
          } else {
            window.history.replaceState(null, '', '/client/sms-reports');
          }
        }
      }
    }
  }, [session, isLoading]);

  if (isLoading) {
    return <LoadingFallback />;
  }

  // Not logged in -> Show Role-based Login
  if (!session) {
    return <LoginScreen />;
  }

  // Admin Role -> Full Admin Panel (SMS Reports, Live SMS Relay, Dashboard, API Providers, Clients, Settings, Logout)
  if (session.role === 'admin') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <AdminLayout />
      </Suspense>
    );
  }

  // Client / Member Role -> Allowed SMS Reports Portal ONLY (Live Access is restricted to Admin)
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ClientPortalLayout />
    </Suspense>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
