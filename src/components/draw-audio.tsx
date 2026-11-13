'use client';

import { useEffect, useRef, useState } from 'react';
import type { PublicDraw } from '@/lib/types';

const EVENT_AUDIO = process.env.NEXT_PUBLIC_EVENT_AUDIO === 'true';
const ANTHEM = '/audio/event/champions-anthem.mp3';
const DRUM = EVENT_AUDIO ? '/audio/event/drum-roll.mp3' : '/audio/snare-roll.mp3';
const BRASS = EVENT_AUDIO ? '/audio/event/brass-reveal.mp3' : '/audio/brass-reveal.mp3';

async function loadClip(context: AudioContext, path: string) {
  const response = await fetch(path);
  if (!response.ok) throw new Error('Rekaman tidak tersedia');
  return context.decodeAudioData(await response.arrayBuffer());
}

function playClip(context: AudioContext, buffer: AudioBuffer, destination: AudioNode, loop: boolean) {
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = loop;
  source.connect(destination);
  source.addEventListener('ended', () => source.disconnect(), { once: true });
  source.start();
  return source;
}

export function DrawAudio({ draws, now, muted }: { draws?: PublicDraw[]; now: number; muted: boolean }) {
  const audio = useRef<AudioContext | null>(null);
  const mixer = useRef<{ master: GainNode; music: GainNode; snare: GainNode; musicLevel: number } | null>(null);
  const clips = useRef<{ drum: AudioBuffer; brass: AudioBuffer } | null>(null);
  const drum = useRef<AudioBufferSourceNode | null>(null);
  const brass = useRef<AudioBufferSourceNode | null>(null);
  const seenResults = useRef(new Set<string>());
  const receivedSnapshot = useRef(false);
  const [ready, setReady] = useState(false);
  const hasSnapshot = draws !== undefined;
  const rolling = draws?.some(draw => draw.revealAt > now) ?? false;

  useEffect(() => {
    const context = new AudioContext();
    const master = context.createGain();
    const music = context.createGain();
    const snare = context.createGain();
    master.gain.value = 0;
    music.gain.value = 0.7;
    snare.gain.value = 0.9;
    master.connect(context.destination);
    music.connect(master);
    snare.connect(master);
    const track = EVENT_AUDIO ? new Audio(ANTHEM) : null;
    if (track) {
      track.loop = true;
      context.createMediaElementSource(track).connect(music);
    }
    audio.current = context;
    mixer.current = { master, music, snare, musicLevel: 0.7 };

    const resume = () => {
      if (track?.paused) void track.play().catch(() => {});
      if (context.state === 'suspended') void context.resume().catch(() => {});
    };
    resume();
    // Fullscreen, or any first interaction on this screen, also unlocks audio when autoplay is blocked.
    window.addEventListener('click', resume);
    window.addEventListener('keydown', resume);

    let mounted = true;
    void Promise.all([loadClip(context, DRUM), loadClip(context, BRASS)]).then(([drum, brass]) => {
      if (!mounted) return;
      clips.current = { drum, brass };
      setReady(true);
    }).catch(error => { if (mounted) console.error(error); });
    return () => {
      mounted = false;
      window.removeEventListener('click', resume);
      window.removeEventListener('keydown', resume);
      track?.pause();
      void context.close();
    };
  }, []);

  useEffect(() => {
    const context = audio.current;
    if (!context || !mixer.current || !hasSnapshot) return;
    mixer.current.master.gain.setTargetAtTime(muted ? 0 : 1, context.currentTime, 0.025);
  }, [hasSnapshot, muted]);

  useEffect(() => {
    if (!draws) return;
    const canPlayNewReveal = receivedSnapshot.current;
    receivedSnapshot.current = true;
    const context = audio.current;
    const mix = mixer.current;
    const buffers = clips.current;
    let announce = false;
    for (const draw of draws) {
      if (draw.revealAt > now || seenResults.current.has(draw.id)) continue;
      seenResults.current.add(draw.id);
      if (canPlayNewReveal && now - draw.revealAt < 750) announce = true;
    }
    if (!ready || !context || !mix || !buffers) return;

    if (announce && !muted && context.state === 'running') {
      drum.current?.stop();
      drum.current = null;
      brass.current?.stop();
      const cue = playClip(context, buffers.brass, mix.master, false);
      brass.current = cue;
      cue.addEventListener('ended', () => {
        if (brass.current === cue) brass.current = null;
      }, { once: true });
    }

    if (rolling && !muted && !brass.current && context.state === 'running') {
      drum.current ??= playClip(context, buffers.drum, mix.snare, true);
    } else if (drum.current) {
      drum.current.stop();
      drum.current = null;
    }
    if (muted && brass.current) {
      brass.current.stop();
      brass.current = null;
    }

    const musicLevel = rolling || brass.current ? 0.35 : 0.7;
    if (mix.musicLevel !== musicLevel) {
      mix.musicLevel = musicLevel;
      mix.music.gain.setTargetAtTime(musicLevel, context.currentTime, 0.12);
    }
  }, [draws, muted, now, ready, rolling]);

  return null;
}
