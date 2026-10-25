import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { SiteSettings, UserRole, UserSession } from '../types';
import { soundManager } from '../utils/sound';

interface AuthContextType {
  session: UserSession | null;
  settings: SiteSettings | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ 
    success: boolean; 
    error?: string;
    isLocked?: boolean;
    lockedUntil?: number;
    isInactive3Days?: boolean;
    deactivatedReason?: string;
  }>;
  logout: (reason?: string) => Promise<void>;
  updateSettings: (newSettings: Partial<SiteSettings>) => Promise<boolean>;
  refreshMe: () => Promise<void>;
  timeRemaining: number; // in seconds
  formattedTimeRemaining: string;
  isExpiringSoon: boolean;
  logoutReason: string | null;
  clearLogoutReason: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'kbmax_auth_token';
const SETTINGS_KEY = 'kbmax_site_settings';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<UserSession | null>(null);
  const [settings, setSettings] = useState<SiteSettings | null>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  // Instant load: If no token in storage, do NOT show spinner, show login screen immediately!
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    try {
      return !!localStorage.getItem(TOKEN_KEY);
    } catch {
      return false;
    }
  });
  const [timeRemaining, setTimeRemaining] = useState<number>(300);
  const [logoutReason, setLogoutReason] = useState<string | null>(null);
  const [warningPlayed, setWarningPlayed] = useState<boolean>(false);

  const clearLogoutReason = () => setLogoutReason(null);

  const saveSettingsLocally = (newSet: SiteSettings) => {
    setSettings(newSet);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSet));
    } catch {
      // Ignore
    }
  };

  const fetchSettings = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch('/api/settings', { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          saveSettingsLocally(data.settings);
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  const logout = useCallback(async (reason?: string) => {
    const currentToken = localStorage.getItem(TOKEN_KEY);
    if (currentToken) {
      try {
        fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
        }).catch(() => {});
      } catch {
        // Ignore
      }
    }

    localStorage.removeItem(TOKEN_KEY);
    setSession(null);
    setWarningPlayed(false);
    if (reason) {
      setLogoutReason(reason);
    }
  }, []);

  const refreshMe = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        setSession(data.session);
        if (data.settings) {
          saveSettingsLocally(data.settings);
        }
      } else if (res.status === 401 || res.status === 403) {
        const errData = await res.json().catch(() => ({}));
        if (errData.error === 'SESSION_EXPIRED') {
          logout('Your session has expired. Please log in again.');
        } else {
          logout('Your session is no longer valid or your account was revoked.');
        }
      }
    } catch {
      // Network hiccup / timeout / VPN reconnecting - do NOT log out the user, keep active session in memory
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    fetchSettings();
    refreshMe();
  }, [fetchSettings, refreshMe]);

  // Handle countdown timer for client role (strictly obeys configured duration, immune to client/server clock skew)
  useEffect(() => {
    if (!session || session.role !== 'client') return;

    const configuredMinutes = settings?.clientSessionMinutes || 5;
    const fallbackSec = session.durationSeconds && session.durationSeconds > 0 
      ? session.durationSeconds 
      : (configuredMinutes * 60);

    const updateTimer = () => {
      let remainingSec = 0;
      if (session.expiresAt && session.expiresAt > 0) {
        remainingSec = Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000));
      } else {
        remainingSec = fallbackSec;
      }

      setTimeRemaining(remainingSec);

      if (remainingSec <= 0) {
        logout('Your session time limit has ended. For security reasons, you have been logged out.');
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [session, logout, settings?.clientSessionMinutes]);

  const login = async (username: string, password: string) => {
    try {
      setLogoutReason(null);
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { 
          success: false, 
          error: data.error || 'Login failed',
          isLocked: !!data.isLocked,
          lockedUntil: data.lockedUntil as number | undefined,
          isInactive3Days: !!data.isInactive3Days,
          deactivatedReason: data.deactivatedReason as string | undefined,
        };
      }

      localStorage.setItem(TOKEN_KEY, data.session.token);
      setSession(data.session);
      if (data.settings) {
        saveSettingsLocally(data.settings);
      }
      setWarningPlayed(false);
      return { success: true };
    } catch {
      return { success: false, error: 'Network error connecting to VPS Gateway' };
    }
  };

  const updateSettings = async (newSettings: Partial<SiteSettings>): Promise<boolean> => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return false;

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newSettings),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          saveSettingsLocally(data.settings);
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const formattedTimeRemaining = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const isExpiringSoon = session?.role === 'client' && timeRemaining <= 60;

  return (
    <AuthContext.Provider
      value={{
        session,
        settings,
        isLoading,
        login,
        logout,
        updateSettings,
        refreshMe,
        timeRemaining,
        formattedTimeRemaining,
        isExpiringSoon,
        logoutReason,
        clearLogoutReason,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
