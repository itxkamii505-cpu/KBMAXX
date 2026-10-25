import React, { useState, useEffect, useRef } from 'react';
import { CosmicMountainLiveBackground } from './CosmicMountainLiveBackground';
import { GalaxyBackground } from './GalaxyBackground';
import type { SiteSettings } from '../../types';

interface LoginLiveBackgroundProps {
  settings?: Partial<SiteSettings> | null;
}

export const LoginLiveBackground: React.FC<LoginLiveBackgroundProps> = ({ settings }) => {
  const bgType = settings?.loginBgType || 'cosmic';
  const mediaUrl = settings?.loginBgMediaUrl || '';
  const isLoop = settings?.loginBgVideoLoop ?? true;
  const opacityVal = typeof settings?.loginBgOpacity === 'number' ? settings.loginBgOpacity : 65;

  const [hasMediaError, setHasMediaError] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Reset error state when media URL or type changes
  useEffect(() => {
    setHasMediaError(false);
  }, [mediaUrl, bgType]);

  // Ensure video autoPlays smoothly in loop without sound
  useEffect(() => {
    if (bgType === 'video' && videoRef.current && mediaUrl && !hasMediaError) {
      const vid = videoRef.current;
      vid.muted = true;
      vid.defaultMuted = true;
      vid.loop = isLoop;
      vid.play().catch(() => {
        // Autoplay policy or video error
      });
    }
  }, [bgType, mediaUrl, isLoop, hasMediaError]);

  const overlayOpacity = Math.max(0, Math.min(100, opacityVal)) / 100;

  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none bg-[#030712]">
      {/* 1. Custom Video Background on Live Loop (Silent, No Sound, PlaysInline) */}
      {bgType === 'video' && mediaUrl && !hasMediaError ? (
        <div className="absolute inset-0 w-full h-full">
          <video
            ref={videoRef}
            src={mediaUrl}
            autoPlay
            loop={isLoop}
            muted
            playsInline
            preload="auto"
            onError={() => setHasMediaError(true)}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none filter brightness-95 contrast-105"
          />
        </div>
      ) : null}

      {/* 2. Custom High-Resolution Image / Live Picture Background */}
      {bgType === 'image' && mediaUrl && !hasMediaError ? (
        <div className="absolute inset-0 w-full h-full overflow-hidden">
          <img
            src={mediaUrl}
            alt="Custom Login Background"
            onError={() => setHasMediaError(true)}
            className="w-full h-full object-cover object-center filter brightness-95 contrast-105 animate-[kenburns_24s_ease-in-out_infinite_alternate]"
            style={{ willChange: 'transform' }}
          />
        </div>
      ) : null}

      {/* 3. Cosmic Galaxy Live Animated Canvas Wallpaper */}
      {bgType === 'galaxy' && (!mediaUrl || hasMediaError) ? (
        <GalaxyBackground />
      ) : null}

      {/* 4. Default / Celestial Mountain Live Background (with shooting stars & comets) */}
      {(bgType === 'cosmic' || hasMediaError || (!mediaUrl && (bgType === 'video' || bgType === 'image'))) && bgType !== 'galaxy' ? (
        <CosmicMountainLiveBackground />
      ) : null}

      {/* Ambient Depth Scrim Overlays to guarantee 100% login card contrast and typography clarity */}
      <div 
        className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/70 pointer-events-none z-10 transition-opacity duration-300"
        style={{ opacity: overlayOpacity }}
      />
      <div 
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.1),rgba(0,0,0,0.8))] pointer-events-none z-10" 
        style={{ opacity: overlayOpacity }}
      />
    </div>
  );
};
