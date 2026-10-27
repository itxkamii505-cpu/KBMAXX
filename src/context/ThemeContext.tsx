import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getPakistanAutoTheme } from '../utils/pakistanTime';

export type ThemeMode = 'dark' | 'light';

const MANUAL_THEME_STORAGE_KEY = 'kbmax_manual_theme_mode';

interface ThemeContextType {
  themeMode: ThemeMode;
  isDark: boolean;
  isLight: boolean;
  toggleThemeMode: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  resetToAuto: () => void;
  isManual: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem(MANUAL_THEME_STORAGE_KEY);
      if (stored === 'dark' || stored === 'light') {
        return stored;
      }
    } catch {
      // Ignore localStorage issues
    }
    return getPakistanAutoTheme();
  });

  const [isManual, setIsManual] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(MANUAL_THEME_STORAGE_KEY);
      return stored === 'dark' || stored === 'light';
    } catch {
      return false;
    }
  });

  const applyTheme = useCallback((mode: ThemeMode) => {
    const root = document.documentElement;
    if (mode === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }
  }, []);

  // Initialize theme class on mount
  useEffect(() => {
    applyTheme(themeMode);
  }, [themeMode, applyTheme]);

  // Sync automatic theme based on Pakistan Standard Time if no manual override is active
  useEffect(() => {
    const syncPktTheme = () => {
      try {
        const stored = localStorage.getItem(MANUAL_THEME_STORAGE_KEY);
        if (stored === 'dark' || stored === 'light') {
          return; // User set manual theme; keep their preference!
        }
      } catch {}
      const pktMode = getPakistanAutoTheme();
      setThemeModeState(pktMode);
      applyTheme(pktMode);
    };

    const interval = setInterval(syncPktTheme, 30000);
    return () => clearInterval(interval);
  }, [applyTheme]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    try {
      localStorage.setItem(MANUAL_THEME_STORAGE_KEY, mode);
    } catch {}
    setIsManual(true);
    setThemeModeState(mode);
    applyTheme(mode);
  }, [applyTheme]);

  const toggleThemeMode = useCallback(() => {
    setThemeModeState((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(MANUAL_THEME_STORAGE_KEY, next);
      } catch {}
      setIsManual(true);
      applyTheme(next);
      return next;
    });
  }, [applyTheme]);

  const resetToAuto = useCallback(() => {
    try {
      localStorage.removeItem(MANUAL_THEME_STORAGE_KEY);
    } catch {}
    setIsManual(false);
    const pktMode = getPakistanAutoTheme();
    setThemeModeState(pktMode);
    applyTheme(pktMode);
  }, [applyTheme]);

  const isDark = themeMode === 'dark';
  const isLight = themeMode === 'light';

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        isDark,
        isLight,
        toggleThemeMode,
        setThemeMode,
        resetToAuto,
        isManual,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
