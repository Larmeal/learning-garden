// Tiny Web Audio helpers for the music labs. Everything is created on first use (browsers only allow sound after a
// click), and all functions are safe to call on the server: they do nothing there.

import { freq } from '../../lib/music';

let ctx: AudioContext | null = null;

export function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** A plucked-string sound: two detuned triangles through a low-pass filter that closes as the note dies. */
export function pluck(midi: number, when = 0, dur = 1.4, gain = 0.22) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + when;
  const out = c.createGain();
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(3600, t);
  lp.frequency.exponentialRampToValueAtTime(700, t + dur * 0.8);
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  for (const detune of [-4, 4]) {
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq(midi);
    o.detune.value = detune;
    o.connect(lp);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  lp.connect(out);
  out.connect(c.destination);
}

/** Several notes together. `spread` seconds between notes makes a strum (down = low to high, up = high to low). */
export function chord(midis: number[], opts: { when?: number; spread?: number; dir?: 'down' | 'up'; dur?: number; gain?: number } = {}) {
  const { when = 0, spread = 0, dir = 'down', dur = 1.6, gain = 0.16 } = opts;
  const list = dir === 'down' ? midis : [...midis].reverse();
  list.forEach((m, i) => pluck(m, when + i * spread, dur, gain));
}

/** A short click for the metronome. Accent = higher and louder. */
export function click(when = 0, accent = false, gain = 0.25) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + when;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'square';
  o.frequency.value = accent ? 1760 : 1180;
  g.gain.setValueAtTime(gain * (accent ? 1 : 0.6), t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  o.connect(g);
  g.connect(c.destination);
  o.start(t);
  o.stop(t + 0.06);
}

/** A pitched tone that holds (for hearing an interval or a drone). */
export function tone(midi: number, when = 0, dur = 1, gain = 0.18) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + when;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.value = freq(midi);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
  g.gain.setValueAtTime(gain, t + dur - 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/** A sum of sine partials (k times the base frequency) with the weight 1/k each, for hearing a harmonic. */
export function partials(baseMidi: number, ks: number[], dur = 2.2, gain = 0.22) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  out.connect(c.destination);
  for (const k of ks) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = freq(baseMidi) * k;
    g.gain.value = 1 / k;
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}
