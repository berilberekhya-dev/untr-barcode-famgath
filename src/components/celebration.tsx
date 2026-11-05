'use client';
import { useEffect, useRef, useState } from 'react';
import type { PublicDraw } from '@/lib/types';

const COLORS = ['#FFC928', '#70E0CF', '#B6A4FF', '#85BCFF'];
const CHANNEL = 'ut-doorprize-fireworks';

export function notifyNextDraw(drawId: string | null, paused = true) {
  try { const channel = new BroadcastChannel(CHANNEL); channel.postMessage({ drawId: drawId || 'all', paused }); channel.close(); } catch { /* Server polling also synchronizes separate devices. */ }
}

function StaticFirework({ index }: { index: number }) {
  return <svg className={`firework-static firework-static-${index}`} viewBox="0 0 100 100" fill="none" aria-hidden="true">
    {Array.from({ length: 16 }, (_, i) => {
      const angle = i * Math.PI / 8;
      return <g key={i} stroke={COLORS[index % COLORS.length]} strokeLinecap="round"><path d={`M${50 + Math.cos(angle) * 15} ${50 + Math.sin(angle) * 15}L${50 + Math.cos(angle) * 34} ${50 + Math.sin(angle) * 34}`} strokeWidth="1.5" /><circle cx={50 + Math.cos(angle) * 42} cy={50 + Math.sin(angle) * 42} r="1" /></g>;
    })}
  </svg>;
}

/** Fireworks follow the saved result's clock and continue until it is replaced or forfeited. */
export function Celebration({ draw, now, lite = false, paused = false }: { draw?: PublicDraw | null; now: number; lite?: boolean; paused?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [pausedDrawId, setPausedDrawId] = useState<string | null>(null);
  const displayedId = useRef(draw?.id); displayedId.current = draw?.id;
  const serverNow = useRef(now); serverNow.current = now;
  const visible = Boolean(draw && draw.status === 'confirmed' && now >= draw.revealAt && !paused && pausedDrawId !== draw.id);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = event => {
      const message = event.data;
      if (typeof message?.drawId === 'string' && typeof message.paused === 'boolean') {
        setPausedDrawId(message.paused ? displayedId.current || message.drawId : null);
      }
    };
    return () => channel.close();
  }, []);

  useEffect(() => {
    if (!visible || !draw || !canvas.current) return;
    const element = canvas.current;
    const ctx = element.getContext('2d');
    if (!ctx) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const offset = serverNow.current - Date.now();
    const seed = Array.from(draw.id).reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 7);
    const random = (value: number) => { const n = Math.sin(value * 127.1 + seed * .001) * 43758.5453; return n - Math.floor(n); };
    let frame = 0, lastPaint = 0, width = 0, height = 0;
    const resize = () => {
      const bounds = element.getBoundingClientRect(); width = bounds.width; height = bounds.height;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      element.width = Math.round(width * ratio); element.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.lineCap = 'round';
    };
    const render = (timestamp: number) => {
      if (document.hidden || reduced.matches) return;
      frame = requestAnimationFrame(render);
      if (timestamp - lastPaint < 1000 / 30) return;
      lastPaint = timestamp;
      const t = Math.max(0, (Date.now() + offset - draw.revealAt) / 1000);
      const interval = lite || width < 760 ? 1.05 : .75;
      const shot = Math.floor(t / interval);
      const radius = Math.min(width, height) * (lite ? .23 : .17);
      const particles = lite || width < 760 ? 38 : 66;
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';
      for (let launch = Math.max(0, shot - 5); launch <= shot; launch++) {
        const age = t - launch * interval;
        const ascent = .72;
        const life = 2.4;
        if (age > ascent + life) continue;
        // Keep most bursts around the top and sides so the winning name stays readable.
        const targetX = width * ((launch % 2 ? .72 : .12) + random(launch + 1) * .15);
        const targetY = height * (.13 + random(launch + 2) * .2);
        const originX = targetX + (random(launch + 3) - .5) * width * .18;
        const originY = height + 12;
        const color = COLORS[launch % COLORS.length];
        ctx.strokeStyle = color; ctx.fillStyle = color;
        if (age < ascent) {
          const progress = 1 - Math.pow(1 - age / ascent, 2);
          const before = 1 - Math.pow(1 - Math.max(0, age - .07) / ascent, 2);
          const x = originX + (targetX - originX) * progress;
          const y = originY + (targetY - originY) * progress;
          ctx.globalAlpha = .65; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(originX + (targetX - originX) * before, originY + (targetY - originY) * before); ctx.lineTo(x, y); ctx.stroke();
          ctx.globalAlpha = .95; ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
          continue;
        }
        const explosion = age - ascent;
        const drag = (1 - Math.exp(-1.7 * explosion)) / 1.7;
        const beforeAge = Math.max(0, explosion - .055);
        const beforeDrag = (1 - Math.exp(-1.7 * beforeAge)) / 1.7;
        const fade = Math.pow(1 - explosion / life, 1.3);
        for (let i = 0; i < particles; i++) {
          const angle = i / particles * Math.PI * 2 + random(launch + 4) * .3;
          const speed = radius * (1.7 + random(i + launch * 100) * .9);
          const vx = Math.cos(angle) * speed, vy = Math.sin(angle) * speed;
          const x = targetX + vx * drag, y = targetY + vy * drag + 28 * explosion * explosion;
          ctx.globalAlpha = fade * .6; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(targetX + vx * beforeDrag, targetY + vy * beforeDrag + 28 * beforeAge * beforeAge); ctx.lineTo(x, y); ctx.stroke();
          ctx.globalAlpha = fade * .9; ctx.beginPath(); ctx.arc(x, y, i % 4 ? 1.3 : 1.8, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    };
    const resume = () => { cancelAnimationFrame(frame); if (!document.hidden && !reduced.matches) { resize(); frame = requestAnimationFrame(render); } };
    resize(); resume();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', resume);
    reduced.addEventListener('change', resume);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', resume); reduced.removeEventListener('change', resume); };
  }, [visible, draw?.id, draw?.revealAt, lite]);

  if (!visible) return null;
  return <div className={`celebration ${lite ? 'celebration-lite' : ''}`} data-testid="winner-celebration" aria-hidden="true"><canvas ref={canvas} /><div className="celebration-static">{Array.from({ length: 4 }, (_, i) => <StaticFirework key={i} index={i} />)}</div></div>;
}
