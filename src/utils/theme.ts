import type { ThemePreset } from '../types';

export interface ThemeConfig {
  name: string;
  badgeClass: string;
  primaryBg: string;
  primaryHover: string;
  primaryText: string;
  accentBorder: string;
  glowClass: string;
  ringClass: string;
  cardActiveBorder: string;
  gradientText: string;
}

export const THEMES: Record<ThemePreset, ThemeConfig> = {
  emerald: {
    name: 'White • Green • Blue Pro (Default)',
    badgeClass: 'bg-blue-500/10 text-emerald-400 border-blue-500/30 ring-1 ring-emerald-500/20',
    primaryBg: 'bg-gradient-to-r from-blue-600 via-blue-500 to-emerald-600 hover:from-blue-500 hover:via-blue-600 hover:to-emerald-500 text-white font-bold border border-white/10',
    primaryHover: 'hover:from-blue-500 hover:to-emerald-500',
    primaryText: 'text-emerald-400',
    accentBorder: 'border-blue-500/30',
    glowClass: 'shadow-[0_0_25px_rgba(37,99,235,0.20)]',
    ringClass: 'focus:ring-blue-500',
    cardActiveBorder: 'border-blue-500',
    gradientText: 'from-white via-emerald-300 to-blue-400',
  },
  cyan: {
    name: 'Electric Cyan',
    badgeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    primaryBg: 'bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-semibold',
    primaryHover: 'hover:bg-cyan-600',
    primaryText: 'text-cyan-400',
    accentBorder: 'border-cyan-500/30',
    glowClass: 'shadow-[0_0_20px_rgba(6,182,212,0.15)]',
    ringClass: 'focus:ring-cyan-500',
    cardActiveBorder: 'border-cyan-500',
    gradientText: 'from-cyan-400 to-blue-200',
  },
  sapphire: {
    name: 'Royal Sapphire',
    badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    primaryBg: 'bg-blue-600 hover:bg-blue-700 text-white font-semibold',
    primaryHover: 'hover:bg-blue-700',
    primaryText: 'text-blue-400',
    accentBorder: 'border-blue-500/30',
    glowClass: 'shadow-[0_0_20px_rgba(59,130,246,0.15)]',
    ringClass: 'focus:ring-blue-500',
    cardActiveBorder: 'border-blue-500',
    gradientText: 'from-blue-400 to-indigo-200',
  },
  violet: {
    name: 'Neon Violet',
    badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    primaryBg: 'bg-purple-600 hover:bg-purple-700 text-white font-semibold',
    primaryHover: 'hover:bg-purple-700',
    primaryText: 'text-purple-400',
    accentBorder: 'border-purple-500/30',
    glowClass: 'shadow-[0_0_20px_rgba(168,85,247,0.15)]',
    ringClass: 'focus:ring-purple-500',
    cardActiveBorder: 'border-purple-500',
    gradientText: 'from-purple-400 to-pink-200',
  },
  amber: {
    name: 'Golden Amber',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    primaryBg: 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold',
    primaryHover: 'hover:bg-amber-600',
    primaryText: 'text-amber-400',
    accentBorder: 'border-amber-500/30',
    glowClass: 'shadow-[0_0_20px_rgba(245,158,11,0.15)]',
    ringClass: 'focus:ring-amber-500',
    cardActiveBorder: 'border-amber-500',
    gradientText: 'from-amber-400 to-yellow-200',
  },
  crimson: {
    name: 'Ruby Crimson',
    badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    primaryBg: 'bg-rose-600 hover:bg-rose-700 text-white font-semibold',
    primaryHover: 'hover:bg-rose-700',
    primaryText: 'text-rose-400',
    accentBorder: 'border-rose-500/30',
    glowClass: 'shadow-[0_0_20px_rgba(244,63,94,0.15)]',
    ringClass: 'focus:ring-rose-500',
    cardActiveBorder: 'border-rose-500',
    gradientText: 'from-rose-400 to-red-200',
  },
};
