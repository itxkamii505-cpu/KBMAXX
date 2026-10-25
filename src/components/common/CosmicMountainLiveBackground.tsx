import React, { useEffect, useRef } from 'react';
import portraitBg from '../../assets/images/cosmic_mountain_bg_1792136391854.webp';
import landscapeBg from '../../assets/images/cosmic_mountain_wide_1792136413824.webp';

interface Meteor {
  x: number;
  y: number;
  length: number;
  speed: number;
  vx: number;
  vy: number;
  color: string;
  glowColor: string;
  width: number;
  alpha: number;
  life: number;
  maxLife: number;
}

interface TwinkleStar {
  x: number;
  y: number;
  size: number;
  alpha: number;
  speed: number;
}

export const CosmicMountainLiveBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initStars();
    };

    window.addEventListener('resize', handleResize);

    let meteors: Meteor[] = [];
    let stars: TwinkleStar[] = [];

    const initStars = () => {
      stars = [];
      // Concentrate stars in the top 60% (the sky portion above mountains)
      const count = Math.min(180, Math.floor((width * height) / 5000));
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * width,
          y: Math.random() * (height * 0.65),
          size: Math.random() < 0.8 ? Math.random() * 1.4 + 0.4 : Math.random() * 2.2 + 1.2,
          alpha: Math.random() * 0.7 + 0.3,
          speed: Math.random() * 0.04 + 0.015,
        });
      }
    };

    initStars();

    const spawnMeteor = () => {
      // Periodic neon cyan and white comets matching the uploaded reference image
      if (Math.random() < 0.035 && meteors.length < 4) {
        const isCyanAuroraStreak = Math.random() < 0.65;
        const startX = width * 0.4 + Math.random() * (width * 0.6);
        const startY = Math.random() * (height * 0.35);
        // Angle ~ 40-50 degrees down and right
        const angle = Math.PI * 0.28 + (Math.random() - 0.5) * 0.2;
        const speed = Math.random() * 9 + 11;

        meteors.push({
          x: startX,
          y: startY,
          length: Math.random() * 140 + 90,
          speed,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: isCyanAuroraStreak ? '#22d3ee' : '#ffffff',
          glowColor: isCyanAuroraStreak ? '#06b6d4' : '#60a5fa',
          width: isCyanAuroraStreak ? 2.2 : 1.6,
          alpha: 1,
          life: 0,
          maxLife: Math.floor(Math.random() * 32 + 25),
        });
      }
    };

    let tick = 0;

    const render = () => {
      tick++;
      ctx.clearRect(0, 0, width, height);

      // 1. Live Twinkling Stars in Sky
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const alpha = Math.max(0.15, Math.min(1, s.alpha + Math.sin(tick * s.speed + i) * 0.4));
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Animated Aurora Glow Ribbon Pulses (Cyan and Magenta)
      const auroraPulse = 0.5 + Math.sin(tick * 0.02) * 0.3;
      const auroraGrad = ctx.createRadialGradient(
        width * 0.72,
        height * 0.18,
        30,
        width * 0.72,
        height * 0.18,
        Math.max(width, height) * 0.45
      );
      auroraGrad.addColorStop(0, `rgba(34, 211, 238, ${0.18 * auroraPulse})`);
      auroraGrad.addColorStop(0.5, `rgba(6, 182, 212, ${0.08 * auroraPulse})`);
      auroraGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = auroraGrad;
      ctx.fillRect(0, 0, width, height);

      // Magenta Peak Horizon Glow Pulse
      const peakPulse = 0.6 + Math.sin(tick * 0.025 + 1) * 0.25;
      const peakGrad = ctx.createRadialGradient(
        width * 0.5,
        height * 0.62,
        20,
        width * 0.5,
        height * 0.62,
        Math.max(width, height) * 0.35
      );
      peakGrad.addColorStop(0, `rgba(244, 63, 94, ${0.16 * peakPulse})`);
      peakGrad.addColorStop(0.6, `rgba(225, 29, 72, ${0.05 * peakPulse})`);
      peakGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = peakGrad;
      ctx.fillRect(0, 0, width, height);

      // 3. Realistic Shooting Stars with Plasma Tails
      spawnMeteor();
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        m.x += m.vx;
        m.y += m.vy;
        m.life++;

        const progress = m.life / m.maxLife;
        const fade = Math.sin(progress * Math.PI);

        if (progress >= 1) {
          meteors.splice(i, 1);
          continue;
        }

        const tailX = m.x - (m.vx / m.speed) * m.length;
        const tailY = m.y - (m.vy / m.speed) * m.length;

        const grad = ctx.createLinearGradient(tailX, tailY, m.x, m.y);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(0.5, `rgba(34, 211, 238, ${fade * 0.4})`);
        grad.addColorStop(0.85, `rgba(255, 255, 255, ${fade * 0.85})`);
        grad.addColorStop(1, `rgba(255, 255, 255, ${fade})`);

        ctx.save();
        ctx.strokeStyle = grad;
        ctx.lineWidth = m.width;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(m.x, m.y);
        ctx.stroke();

        // Glowing Starhead
        ctx.fillStyle = `rgba(255, 255, 255, ${fade})`;
        ctx.shadowColor = m.glowColor;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.width * 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none">
      {/* 
        High-Resolution Responsive Celestial Mountain Wallpaper 
        Uses Portrait orientation image on mobile, Widescreen on desktop
        Features subtle slow live breathing / Ken Burns camera motion 
      */}
      <div 
        className="absolute inset-0 w-full h-full transform scale-105 animate-[kenburns_18s_ease-in-out_infinite_alternate]"
        style={{
          willChange: 'transform',
        }}
      >
        <picture>
          <source media="(min-width: 768px)" srcSet={landscapeBg} />
          <img
            src={portraitBg}
            alt="Cosmic Mountain Live Wallpaper"
            className="w-full h-full object-cover object-center filter brightness-95 contrast-105"
            loading="eager"
          />
        </picture>
      </div>

      {/* Real-time Dynamic Meteors, Shooting Stars & Aurora Canvas (No sound, fully silent) */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block pointer-events-none z-10"
      />

      {/* Vignette Scrim for High-Contrast Login Card Readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/60 pointer-events-none z-20" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.15),rgba(0,0,0,0.75))] pointer-events-none z-20" />
    </div>
  );
};
