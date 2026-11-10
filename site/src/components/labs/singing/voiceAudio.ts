// Plays buffers made by lib/voice.ts. Safe to call on the server: does nothing there.
import { audio } from '../../music/audio';
import { SR } from '../../../lib/voice';

let current: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
let listeners: Array<() => void> = [];

export function onVoiceEnd(fn: () => void) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((f) => f !== fn);
  };
}

export function stopVoice() {
  if (!current) return;
  try {
    current.gain.gain.setTargetAtTime(0, current.gain.context.currentTime, 0.015);
    current.src.stop(current.gain.context.currentTime + 0.08);
  } catch {
    /* already stopped */
  }
  current = null;
}

/** Plays one buffer. loop = repeat until stopVoice(). Returns false when sound is not available. */
export function playVoice(samples: Float32Array, opts: { loop?: boolean; sr?: number; gain?: number } = {}): boolean {
  const c = audio();
  if (!c) return false;
  stopVoice();
  const buf = c.createBuffer(1, samples.length, opts.sr ?? SR);
  buf.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
  const src = c.createBufferSource();
  const gain = c.createGain();
  gain.gain.value = opts.gain ?? 0.5;
  src.buffer = buf;
  src.loop = !!opts.loop;
  src.connect(gain);
  gain.connect(c.destination);
  src.onended = () => {
    if (current?.src === src) current = null;
    listeners.forEach((f) => f());
  };
  src.start();
  current = { src, gain };
  return true;
}

export const isVoicePlaying = () => current !== null;
