import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getPakistanAutoTheme } from '../utils/pakistanTime';

export type ThemeMode = 'dark' | 'light';

interface ThemeContextType {
  themeMode: ThemeMode;
  isDark: boolean;
  isLight: boolean;
  toggleThemeMode: () => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => getPakistanAutoTheme());

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

  // Sync automatic theme based on Pakistan Standard Time (06:00 to 19:00 = day/light, 19:00 to 06:00 = black/dark)
  useEffect(() => {
    const syncPktTheme = () => {
      const pktMode = getPakistanAutoTheme();
      setThemeModeState(pktMode);
      applyTheme(pktMode);
    };

    syncPktTheme();
    // Re-check every 30 seconds
    const interval = setInterval(syncPktTheme, 30000);
    return () => clearInterval(interval);
  }, [applyTheme]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    applyTheme(mode);
  }, [applyTheme]);

  const toggleThemeMode = useCallback(() => {
    setThemeModeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      return next;
    });
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
