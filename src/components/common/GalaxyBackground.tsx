import React, { useEffect, useRef } from 'react';

interface GalaxyStar {
  x: number;
  y: number;
  z: number;
  baseSize: number;
  color: string;
  twinklePhase: number;
  twinkleSpeed: number;
  radius: number;
  angle: number;
  speed: number;
  armIndex: number;
}

interface Meteor {
  x: number;
  y: number;
  length: number;
  speed: number;
  vx: number;
  vy: number;
  alpha: number;
  life: number;
  maxLife: number;
  width: number;
}

interface TouchPoint {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
}

export const GalaxyBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const touch: TouchPoint = {
      x: width / 2,
      y: height / 2,
      targetX: width / 2,
      targetY: height / 2,
    };

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initGalaxy();
    };

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0]?.clientX ?? width / 2 : e.clientX;
      const clientY = 'touches' in e ? e.touches[0]?.clientY ?? height / 2 : e.clientY;
      touch.targetX = clientX;
      touch.targetY = clientY;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handlePointerMove, { passive: true });
    window.addEventListener('touchmove', handlePointerMove, { passive: true });

    // Palette of galactic star colors (Azure Blue, Emerald, Pure Diamond White, Cyan)
    const starColors = [
      '#ffffff',
      '#f0fdf4',
      '#e0f2fe',
      '#bae6fd',
      '#7dd3fc',
      '#38bdf8',
      '#60a5fa',
      '#6ee7b7',
      '#34d399',
      '#10b981',
      '#ffffff',
    ];

    let stars: GalaxyStar[] = [];
    let backgroundStars: { x: number; y: number; size: number; alpha: number; speed: number }[] = [];
    let meteors: Meteor[] = [];

    const initGalaxy = () => {
      stars = [];
      backgroundStars = [];
      meteors = [];

      // 1. Deep Field Background Stars (static twinkling field)
      const bgCount = Math.min(260, Math.floor((width * height) / 4500));
      for (let i = 0; i < bgCount; i++) {
        backgroundStars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: Math.random() < 0.85 ? Math.random() * 1.2 + 0.3 : Math.random() * 2 + 1.2,
          alpha: Math.random() * 0.7 + 0.3,
          speed: Math.random() * 0.03 + 0.01,
        });
      }

      // 2. Spiral Galaxy Stars (Swirling Logarithmic Arms)
      const numArms = 3;
      const spiralStarCount = Math.min(380, Math.floor((width * height) / 3200));
      const maxRadius = Math.max(width, height) * 0.55;

      for (let i = 0; i < spiralStarCount; i++) {
        const armIndex = i % numArms;
        // Distance from center: higher density towards galactic core
        const normDist = Math.pow(Math.random(), 1.8);
        const radius = 20 + normDist * maxRadius;
        // Spiral angle formula: theta = arm_offset + b * ln(r)
        const spiralOffset = (armIndex * (2 * Math.PI)) / numArms;
        const spread = (Math.random() - 0.5) * 0.5 * (1 + normDist);
        const angle = spiralOffset + 2.8 * Math.log(radius / 20 + 1) + spread;
        const speed = (0.0004 + (1 - normDist) * 0.0008) * (Math.random() * 0.4 + 0.8);

        stars.push({
          x: 0,
          y: 0,
          z: Math.random() * 2 + 0.5,
          baseSize: Math.random() < 0.7 ? Math.random() * 1.6 + 0.6 : Math.random() * 2.8 + 1.4,
          color: starColors[Math.floor(Math.random() * starColors.length)],
          twinklePhase: Math.random() * Math.PI * 2,
          twinkleSpeed: Math.random() * 0.04 + 0.01,
          radius,
          angle,
          speed,
          armIndex,
        });
      }
    };

    initGalaxy();

    const spawnMeteor = () => {
      if (Math.random() < 0.025 && meteors.length < 3) {
        const startX = Math.random() * width * 1.1;
        const startY = Math.random() * height * 0.4;
        const angle = Math.PI / 4 + (Math.random() - 0.5) * 0.3; // ~45 deg downward streak
        const speed = Math.random() * 10 + 12;
        meteors.push({
          x: startX,
          y: startY,
          length: Math.random() * 120 + 80,
          speed,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1,
          life: 0,
          maxLife: Math.floor(Math.random() * 35 + 25),
          width: Math.random() * 1.5 + 1.2,
        });
      }
    };

    let tick = 0;

    const render = () => {
      tick++;

      // Smooth pointer parallax damping
      touch.x += (touch.targetX - touch.x) * 0.04;
      touch.y += (touch.targetY - touch.y) * 0.04;
      const offsetX = (touch.x - width / 2) * 0.05;
      const offsetY = (touch.y - height / 2) * 0.05;

      const centerX = width * 0.5 + offsetX;
      const centerY = height * 0.46 + offsetY;

      // 1. Deep Space Void Base
      ctx.fillStyle = '#040711';
      ctx.fillRect(0, 0, width, height);

      // 2. Cosmic Nebula Clouds (Emerald Green, Azure Blue, and Celestial Indigo)
      // Large Azure Sapphire Nebula
      const nebBlue = ctx.createRadialGradient(
        centerX - width * 0.15,
        centerY - height * 0.1,
        20,
        centerX - width * 0.15,
        centerY - height * 0.1,
        Math.max(width, height) * 0.65
      );
      nebBlue.addColorStop(0, 'rgba(29, 78, 216, 0.28)'); // Royal Azure
      nebBlue.addColorStop(0.35, 'rgba(37, 99, 235, 0.16)');
      nebBlue.addColorStop(0.7, 'rgba(14, 165, 233, 0.06)');
      nebBlue.addColorStop(1, 'transparent');
      ctx.fillStyle = nebBlue;
      ctx.fillRect(0, 0, width, height);

      // Vibrant Emerald Nebula Cloud
      const nebGreen = ctx.createRadialGradient(
        centerX + width * 0.2,
        centerY + height * 0.15,
        15,
        centerX + width * 0.2,
        centerY + height * 0.15,
        Math.max(width, height) * 0.55
      );
      nebGreen.addColorStop(0, 'rgba(16, 185, 129, 0.22)'); // Emerald Green
      nebGreen.addColorStop(0.4, 'rgba(5, 150, 105, 0.11)');
      nebGreen.addColorStop(0.8, 'rgba(4, 120, 87, 0.03)');
      nebGreen.addColorStop(1, 'transparent');
      ctx.fillStyle = nebGreen;
      ctx.fillRect(0, 0, width, height);

      // Radiant Core Center Glow (White-Cyan-Blue Fusion)
      const coreGlow = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        Math.min(width, height) * 0.42
      );
      const pulse = 0.95 + Math.sin(tick * 0.02) * 0.05;
      coreGlow.addColorStop(0, `rgba(255, 255, 255, ${0.18 * pulse})`);
      coreGlow.addColorStop(0.2, `rgba(56, 189, 248, ${0.15 * pulse})`);
      coreGlow.addColorStop(0.5, `rgba(37, 99, 235, ${0.08 * pulse})`);
      coreGlow.addColorStop(0.8, `rgba(16, 185, 129, ${0.04 * pulse})`);
      coreGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = coreGlow;
      ctx.fillRect(0, 0, width, height);

      // 3. Deep Field Twinkling Background Stars
      for (let i = 0; i < backgroundStars.length; i++) {
        const s = backgroundStars[i];
        const alpha = Math.max(0.15, Math.min(1, s.alpha + Math.sin(tick * s.speed + i) * 0.3));
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // 4. Spiral Galaxy Stars (Swirling with Depth)
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];

        // Orbit around galactic nucleus
        s.angle += s.speed;

        // Elliptical perspective compression for realistic galaxy tilt
        const cosAngle = Math.cos(s.angle);
        const sinAngle = Math.sin(s.angle);
        const tilt = 0.58; // tilted galaxy plane view

        const starX = centerX + s.radius * cosAngle;
        const starY = centerY + s.radius * sinAngle * tilt;

        // Twinkle calculation
        const twinkle = Math.sin(tick * s.twinkleSpeed + s.twinklePhase);
        const alpha = Math.max(0.2, Math.min(1, 0.65 + twinkle * 0.35));

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = s.color;

        // Bright stars get a halo bloom
        if (s.baseSize > 2.0) {
          ctx.shadowColor = s.color;
          ctx.shadowBlur = 10;
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.beginPath();
        ctx.arc(starX, starY, s.baseSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 5. Meteors / Shooting Stars with Glowing Plasma Tails
      spawnMeteor();
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        m.x += m.vx;
        m.y += m.vy;
        m.life++;

        const progress = m.life / m.maxLife;
        const fade = Math.sin(progress * Math.PI); // Smooth fade-in and fade-out

        if (progress >= 1) {
          meteors.splice(i, 1);
          continue;
        }

        const tailX = m.x - (m.vx / m.speed) * m.length;
        const tailY = m.y - (m.vy / m.speed) * m.length;

        const grad = ctx.createLinearGradient(tailX, tailY, m.x, m.y);
        grad.addColorStop(0, 'rgba(56, 189, 248, 0)');
        grad.addColorStop(0.6, `rgba(59, 130, 246, ${fade * 0.6})`);
        grad.addColorStop(0.85, `rgba(110, 231, 183, ${fade * 0.85})`);
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
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.width * 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('touchmove', handlePointerMove);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-0 w-full h-full block"
      style={{ filter: 'contrast(105%)' }}
    />
  );
};
