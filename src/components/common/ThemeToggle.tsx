import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { triggerHapticFeedback } from '../../utils/haptics';

export interface ThemeToggleProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'button' | 'pill';
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = '',
  size = 'md',
  variant = 'button',
  showLabel = false,
}) => {
  const { isDark, toggleThemeMode, setThemeMode } = useTheme();

  const handleToggle = () => {
    triggerHapticFeedback(15);
    toggleThemeMode();
  };

  const handleSelect = (mode: 'light' | 'dark') => {
    triggerHapticFeedback(15);
    setThemeMode(mode);
  };

  // Segmented Pill Variant: Both Day (Sun) and Night (Moon) options visible
  if (variant === 'pill') {
    return (
      <div
        className={`inline-flex items-center p-1 rounded-2xl border transition-all duration-300 shadow-2xs select-none ${
          isDark
            ? 'bg-slate-900/90 border-slate-700/80 text-slate-400'
            : 'bg-slate-100/90 border-slate-200 text-slate-600'
        } ${className}`}
        role="group"
        aria-label="Theme mode selector"
      >
        {/* Day / Light Button */}
        <button
          type="button"
          onClick={() => handleSelect('light')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
            !isDark
              ? 'bg-white text-amber-600 shadow-xs border border-amber-200/60 font-bold scale-[1.02]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
          title="Day Mode (Light)"
        >
          <Sun className={`w-3.5 h-3.5 ${!isDark ? 'text-amber-500 fill-amber-400/30' : 'text-slate-400'}`} />
          {showLabel && <span>Day</span>}
        </button>

        {/* Night / Moon Button */}
        <button
          type="button"
          onClick={() => handleSelect('dark')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
            isDark
              ? 'bg-slate-800 text-sky-300 shadow-xs border border-sky-400/30 font-bold scale-[1.02]'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/60'
          }`}
          title="Night Mode (Dark)"
        >
          <Moon className={`w-3.5 h-3.5 ${isDark ? 'text-sky-300 fill-sky-300/30' : 'text-slate-400'}`} />
          {showLabel && <span>Night</span>}
        </button>
      </div>
    );
  }

  // Interactive Single Toggle Button Variant with Moon/Day icon
  const iconSizeClasses = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  }[size];

  const buttonPaddingClasses = {
    sm: 'p-1.5 text-xs',
    md: 'p-2 text-xs',
    lg: 'p-2.5 text-sm',
  }[size];

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`group relative flex items-center gap-2 rounded-xl border font-semibold transition-all duration-200 active:scale-95 cursor-pointer shadow-2xs select-none ${buttonPaddingClasses} ${
        isDark
          ? 'bg-slate-900/90 hover:bg-slate-800 border-slate-700/80 text-amber-300 hover:border-amber-400/40 shadow-slate-950/40'
          : 'bg-white hover:bg-amber-50/60 border-slate-200 text-slate-700 hover:text-amber-600 hover:border-amber-300 shadow-slate-200/50'
      } ${className}`}
      title={isDark ? 'Switch to Day Mode (Light)' : 'Switch to Night Mode (Moon/Dark)'}
      aria-label={isDark ? 'Switch to Day Mode' : 'Switch to Night Mode'}
      id="theme-toggle-manual-btn"
    >
      <div className="relative flex items-center justify-center">
        {isDark ? (
          <Moon
            className={`${iconSizeClasses} text-sky-300 fill-sky-300/20 transition-transform duration-300 group-hover:-rotate-12`}
          />
        ) : (
          <Sun
            className={`${iconSizeClasses} text-amber-500 fill-amber-400/20 transition-transform duration-300 group-hover:rotate-45`}
          />
        )}
      </div>

      {showLabel && (
        <span className="tracking-wide text-[11px] font-mono">
          {isDark ? 'Night' : 'Day'}
        </span>
      )}
    </button>
  );
};

export default ThemeToggle;
