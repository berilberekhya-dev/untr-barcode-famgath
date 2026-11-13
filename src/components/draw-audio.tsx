'use client';

import { useEffect, useRef, useState } from 'react';
import type { ProjectorVolumes, PublicDraw } from '@/lib/types';

const EVENT_AUDIO = process.env.NEXT_PUBLIC_EVENT_AUDIO === 'true';
const ANTHEM = '/audio/event/champions-anthem.mp3';
const DRUM = EVENT_AUDIO ? '/audio/event/drum-roll.mp3' : '/audio/snare-roll.mp3';
const BRASS = EVENT_AUDIO ? '/audio/event/brass-reveal-6-9.mp3' : '/audio/brass-reveal.mp3';
const DEFAULT_VOLUMES: ProjectorVolumes = { standby: 50, rolling: 10, drum: 90, brass: 100 };

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

export function DrawAudio({ draws, now, muted, volumes = DEFAULT_VOLUMES }: { draws?: PublicDraw[]; now: number; muted: boolean; volumes?: ProjectorVolumes }) {
  const audio = useRef<AudioContext | null>(null);
  const mixer = useRef<{ master: GainNode; music: GainNode; snare: GainNode; fanfare: GainNode; musicLevel: number } | null>(null);
  const clips = useRef<{ drum: AudioBuffer; brass: AudioBuffer } | null>(null);
  const drum = useRef<AudioBufferSourceNode | null>(null);
  const announcements = useRef(new Set<AudioBufferSourceNode>());
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
    const fanfare = context.createGain();
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    master.gain.value = 0;
    music.gain.value = 0;
    master.connect(limiter).connect(context.destination);
    music.connect(master);
    snare.connect(master);
    fanfare.connect(master);
    const track = EVENT_AUDIO ? new Audio(ANTHEM) : null;
    if (track) {
      track.loop = true;
      context.createMediaElementSource(track).connect(music);
    }
    audio.current = context;
    mixer.current = { master, music, snare, fanfare, musicLevel: 0 };

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
    const context = audio.current;
    const mix = mixer.current;
    if (!context || !mix) return;
    mix.snare.gain.setTargetAtTime(volumes.drum / 100, context.currentTime, 0.025);
    mix.fanfare.gain.setTargetAtTime(volumes.brass / 100, context.currentTime, 0.025);
  }, [volumes.drum, volumes.brass]);

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
    if (!context || !mix) return;
    const canPlay = ready && buffers && !muted && context.state === 'running';

    if (announce && canPlay) {
      const cue = playClip(context, buffers.brass, mix.fanfare, false);
      announcements.current.add(cue);
      cue.addEventListener('ended', () => announcements.current.delete(cue), { once: true });
    }

    if (rolling && canPlay) {
      drum.current ??= playClip(context, buffers.drum, mix.snare, true);
    } else if (drum.current) {
      drum.current.stop();
      drum.current = null;
    }
    if (muted) {
      for (const cue of announcements.current) cue.stop();
      announcements.current.clear();
    }

    const musicLevel = (rolling || announcements.current.size > 0 ? volumes.rolling : volumes.standby) / 100;
    if (mix.musicLevel !== musicLevel) {
      mix.musicLevel = musicLevel;
      mix.music.gain.setTargetAtTime(musicLevel, context.currentTime, 0.12);
    }
  }, [draws, muted, now, ready, rolling, volumes.standby, volumes.rolling]);

  return null;
}
