import React from 'react';
import { Radio, ShieldCheck, Zap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { THEMES } from '../../utils/theme';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showTagline?: boolean;
  layout?: 'horizontal' | 'vertical';
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ 
  size = 'md', 
  showTagline = true,
  layout = 'horizontal' 
}) => {
  const { settings } = useAuth();
  const theme = settings?.theme ? THEMES[settings.theme] : THEMES.emerald;
  const siteName = settings?.siteName || 'KB MAX';
  const tagline = settings?.tagline || 'Live SMS Relay & Gateway';
  const [imgError, setImgError] = React.useState(false);

  // Reset img error if logo url changes
  React.useEffect(() => {
    setImgError(false);
  }, [settings?.customLogoUrl]);

  const iconSizes = {
    sm: 'w-9 h-9',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-20 h-20',
    '2xl': 'w-28 h-28 sm:w-36 sm:h-36',
  };

  const textSizes = {
    sm: 'text-lg font-black tracking-wider',
    md: 'text-2xl font-black tracking-wider',
    lg: 'text-3xl font-black tracking-wider',
    xl: 'text-4xl font-black tracking-widest',
    '2xl': 'text-4xl sm:text-5xl font-black tracking-widest',
  };

  const hasCustomLogo = settings?.logoType === 'custom_url' && settings.customLogoUrl && !imgError;
  const isVertical = layout === 'vertical' || size === '2xl';

  return (
    <div className={`flex ${isVertical ? 'flex-col items-center text-center gap-4 sm:gap-5' : 'items-center gap-3.5'} select-none`}>
      {hasCustomLogo ? (
        <div className="relative shrink-0 flex items-center justify-center">
          <img
            src={settings.customLogoUrl}
            alt={siteName}
            onError={() => setImgError(true)}
            className={`${
              size === '2xl' 
                ? 'max-h-36 sm:max-h-44 max-w-[340px] p-3 shadow-2xl' 
                : size === 'xl' 
                ? 'max-h-28 max-w-[260px] p-2 shadow-xl' 
                : size === 'lg'
                ? 'max-h-20 max-w-[220px] p-1.5 shadow-lg'
                : 'max-h-14 max-w-[180px] p-1 shadow-md'
            } w-auto object-contain rounded-2xl border-2 border-emerald-500/40 bg-slate-950/90 shadow-emerald-950/50`}
          />
          <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-emerald-500 shadow-md ring-2 ring-white/50" />
        </div>
      ) : (
        <div className="relative shrink-0 flex items-center justify-center">
          {/* Dual-color Green & Red flag palette emblem */}
          <div
            className={`${iconSizes[size]} rounded-3xl relative overflow-hidden flex items-center justify-center shadow-2xl shadow-emerald-950/60 border-2 border-white/20 p-1 group`}
          >
            {/* Top/Left emerald green half */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-emerald-700 to-transparent z-0" />
            {/* Bottom/Right ruby red half */}
            <div className="absolute inset-0 bg-gradient-to-tl from-red-600 via-red-700 to-transparent opacity-90 z-0" />
            
            {/* Fine metallic diagonal divider & aura */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.18),transparent_70%)] z-0" />
            
            {/* Central icon */}
            <Radio 
              className={`${
                size === 'sm' 
                  ? 'w-5 h-5' 
                  : size === 'lg' 
                  ? 'w-8 h-8' 
                  : size === 'xl' 
                  ? 'w-10 h-10' 
                  : size === '2xl' 
                  ? 'w-14 h-14 sm:w-18 sm:h-18' 
                  : 'w-6 h-6'
              } text-white relative z-10 animate-pulse drop-shadow-[0_0_14px_rgba(255,255,255,0.8)]`} 
            />
          </div>
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 shadow-md ring-2 ring-white/60" />
        </div>
      )}

      <div className={`flex flex-col min-w-0 ${isVertical ? 'items-center text-center' : ''}`}>
        <div className="flex items-center justify-center gap-2.5">
          <span className={`${textSizes[size]} uppercase font-black font-sans bg-gradient-to-r from-emerald-400 via-white to-red-500 bg-clip-text text-transparent drop-shadow-md truncate`}>
            {siteName}
          </span>
          <span className="px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider bg-gradient-to-r from-emerald-500/20 to-red-500/20 text-emerald-300 border border-emerald-400/40 shrink-0 shadow-xs">
            LIVE
          </span>
        </div>
        {showTagline && (
          <span className={`${size === '2xl' ? 'text-sm sm:text-base mt-1.5' : 'text-xs'} text-slate-300 font-semibold tracking-wide truncate`}>
            {tagline}
          </span>
        )}
      </div>
    </div>
  );
};
