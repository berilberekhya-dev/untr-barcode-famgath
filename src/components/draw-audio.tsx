'use client';

import { useEffect, useRef, useState } from 'react';
import type { PublicDraw } from '@/lib/types';

function playSnare(context: AudioContext, at: number, noise: AudioBuffer) {
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = noise;
  filter.type = 'bandpass';
  filter.frequency.value = 1850;
  gain.gain.setValueAtTime(0.17, at);
  gain.gain.exponentialRampToValueAtTime(0.001, at + 0.08);
  source.connect(filter).connect(gain).connect(context.destination);
  source.start(at);
  source.stop(at + 0.085);
}

function playFanfare(context: AudioContext) {
  [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
    const at = context.currentTime + index * 0.095;
    const tone = context.createOscillator();
    const gain = context.createGain();
    tone.type = 'triangle';
    tone.frequency.value = frequency;
    gain.gain.setValueAtTime(0.001, at);
    gain.gain.linearRampToValueAtTime(0.16, at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.36);
    tone.connect(gain).connect(context.destination);
    tone.start(at);
    tone.stop(at + 0.37);
  });
}

export function DrawAudio({ draws, now }: { draws: PublicDraw[]; now: number }) {
  const audio = useRef<AudioContext | null>(null);
  const noise = useRef<AudioBuffer | null>(null);
  const heard = useRef(new Set<string>());
  const lastTick = useRef(0);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState('');
  const rolling = draws.some(draw => now < draw.revealAt);
  const newest = draws.filter(draw => now >= draw.revealAt).sort((a, b) => b.revealAt - a.revealAt)[0];

  useEffect(() => {
    if (!newest || heard.current.has(newest.id)) return;
    heard.current.add(newest.id);
    if (enabled && audio.current?.state === 'running' && now - newest.revealAt < 750) {
      playFanfare(audio.current);
    }
  }, [newest?.id, enabled, now]);

  const gapAfterReveal = Boolean(newest && now - newest.revealAt < 650);
  useEffect(() => {
    if (!enabled || !rolling || gapAfterReveal) return;
    const timer = window.setInterval(() => {
      const context = audio.current;
      if (!context || context.state !== 'running' || !noise.current) return;
      if (context.currentTime - lastTick.current < 0.085) return;
      lastTick.current = context.currentTime;
      playSnare(context, context.currentTime, noise.current);
    }, 95);
    return () => window.clearInterval(timer);
  }, [enabled, rolling, gapAfterReveal]);

  useEffect(() => () => { void audio.current?.close(); }, []);

  async function toggle() {
    setError('');
    try {
      if (enabled) {
        setEnabled(false);
        await audio.current?.suspend();
        return;
      }
      if (!audio.current) {
        audio.current = new AudioContext();
        noise.current = audio.current.createBuffer(1, Math.ceil(audio.current.sampleRate * 0.09), audio.current.sampleRate);
        const samples = noise.current.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      }
      await audio.current.resume();
      setEnabled(true);
    } catch {
      setError('Suara belum aktif. Coba tekan tombol lagi.');
    }
  }

  return <div className="draw-audio">
    <button type="button" className="button button-secondary button-small" onClick={() => void toggle()}>
      {enabled ? 'Bisukan suara' : 'Aktifkan suara'}
    </button>
    {error && <small role="status">{error}</small>}
  </div>;
}
