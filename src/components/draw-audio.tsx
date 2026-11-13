'use client';

import { useEffect, useRef, useState } from 'react';
import type { PublicDraw } from '@/lib/types';

async function loadClip(context: AudioContext, path: string) {
  const response = await fetch(path);
  if (!response.ok) throw new Error('Rekaman tidak tersedia');
  return context.decodeAudioData(await response.arrayBuffer());
}

function playClip(context: AudioContext, buffer: AudioBuffer, loop: boolean) {
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = loop;
  source.connect(context.destination);
  source.addEventListener('ended', () => source.disconnect(), { once: true });
  source.start();
  return source;
}

export function DrawAudio({ draws, now }: { draws?: PublicDraw[]; now: number }) {
  const audio = useRef<AudioContext | null>(null);
  const clips = useRef<{ drum: AudioBuffer; brass: AudioBuffer } | null>(null);
  const drum = useRef<AudioBufferSourceNode | null>(null);
  const brass = useRef<AudioBufferSourceNode | null>(null);
  const seenResults = useRef(new Set<string>());
  const receivedSnapshot = useRef(false);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!draws) return;
    const canPlayNewReveal = receivedSnapshot.current;
    receivedSnapshot.current = true;
    const context = audio.current;
    const ready = enabled && context?.state === 'running' && clips.current;
    let announce = false;
    for (const draw of draws) {
      if (draw.revealAt > now || seenResults.current.has(draw.id)) continue;
      seenResults.current.add(draw.id);
      if (canPlayNewReveal && now - draw.revealAt < 750) announce = true;
    }
    if (!ready) return;

    if (announce) {
      drum.current?.stop();
      drum.current = null;
      brass.current?.stop();
      const cue = playClip(context, ready.brass, false);
      brass.current = cue;
      cue.addEventListener('ended', () => {
        if (brass.current === cue) brass.current = null;
      }, { once: true });
    }

    const rolling = draws.some(draw => draw.revealAt > now);
    if (rolling && !brass.current) {
      drum.current ??= playClip(context, ready.drum, true);
    } else {
      drum.current?.stop();
      drum.current = null;
    }
  }, [draws, enabled, now]);

  useEffect(() => () => { void audio.current?.close(); }, []);

  async function toggle() {
    setError('');
    setLoading(true);
    try {
      if (enabled) {
        drum.current?.stop();
        brass.current?.stop();
        drum.current = null;
        brass.current = null;
        setEnabled(false);
        await audio.current?.suspend();
      } else {
        const context = audio.current ??= new AudioContext();
        const [buffers] = await Promise.all([
          clips.current ?? Promise.all([
            loadClip(context, '/audio/snare-roll.mp3'),
            loadClip(context, '/audio/brass-reveal.mp3'),
          ]).then(([drum, brass]) => ({ drum, brass })),
          context.resume(),
        ]);
        clips.current = buffers;
        setEnabled(true);
      }
    } catch {
      setError('Suara belum aktif. Coba tekan tombol lagi.');
    } finally {
      setLoading(false);
    }
  }

  return <div className="draw-audio">
    <button type="button" className="button button-secondary button-small" disabled={loading} onClick={() => void toggle()}>
      {loading ? 'Menyiapkan suara…' : enabled ? 'Bisukan suara' : 'Aktifkan suara'}
    </button>
    {error && <small role="status">{error}</small>}
  </div>;
}
