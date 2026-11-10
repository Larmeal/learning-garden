// A small singing-voice synthesizer for the singing labs: pure maths, no DOM, so Node can test it
// (subjects/singing/code/verify.mts).
//
// It follows the source-filter picture of the voice:
//   1. SOURCE: the vocal folds make a train of airflow pulses (Rosenberg-type pulse). How firmly the folds close
//      sets the open quotient, the length of the closing phase and the noise, and so the number of strong harmonics.
//   2. FILTER: the vocal tract is a cascade of resonators (formants F1 to F5) plus an optional "ring" peak
//      (singer's formant) and an optional nasal pole.
//   3. RADIATION: the lips act as a first difference (about +6 dB per octave).
// This is a teaching model. It is not a recording of a person and it is not a full physical model of the folds.

export const SR = 32000;

// ---------------------------------------------------------------------------------------------------------------
// Vowels
// ---------------------------------------------------------------------------------------------------------------

export type Sex = 'male' | 'female';
export interface VowelInfo {
  /** what the lessons print, an IPA symbol */
  ipa: string;
  /** an English word that has the vowel, and a Thai vowel that is close */
  word: string;
  thai: string;
  male: [number, number, number];
  female: [number, number, number];
}

// F1, F2, F3 in Hz. i, ɪ, ɛ, æ, ɑ, ɔ, ʊ, u, ʌ are the averages of Peterson and Barney (1952) for American English
// (men, women). e, o and ə are not in that table: e and o lie between the neighbours, ə for men is the uniform tube
// 17.5 cm (500, 1500, 2500 Hz, Titze p.159) and for women the same tube scaled by 0.85 (about 15 cm).
export const VOWELS: Record<string, VowelInfo> = {
  i: { ipa: 'i', word: 'need', thai: 'อี', male: [270, 2290, 3010], female: [310, 2790, 3310] },
  ɪ: { ipa: 'ɪ', word: 'hid', thai: 'อิ', male: [390, 1990, 2550], female: [430, 2480, 3070] },
  e: { ipa: 'e', word: 'gate', thai: 'เอ', male: [440, 1950, 2550], female: [500, 2400, 3030] },
  ɛ: { ipa: 'ɛ', word: 'met', thai: 'แอ (สั้น)', male: [530, 1840, 2480], female: [610, 2330, 2990] },
  æ: { ipa: 'æ', word: 'cat', thai: 'แอ', male: [660, 1720, 2410], female: [860, 2050, 2850] },
  ɑ: { ipa: 'ɑ', word: 'father', thai: 'อา', male: [730, 1090, 2440], female: [850, 1220, 2810] },
  ɔ: { ipa: 'ɔ', word: 'ought', thai: 'ออ', male: [570, 840, 2410], female: [590, 920, 2710] },
  o: { ipa: 'o', word: 'go', thai: 'โอ', male: [460, 900, 2400], female: [500, 1000, 2700] },
  ʊ: { ipa: 'ʊ', word: 'book', thai: 'อุ', male: [440, 1020, 2240], female: [470, 1160, 2680] },
  u: { ipa: 'u', word: 'choose', thai: 'อู', male: [300, 870, 2240], female: [370, 950, 2670] },
  ʌ: { ipa: 'ʌ', word: 'love', thai: 'อะ (เสียงกลาง)', male: [640, 1190, 2390], female: [760, 1400, 2780] },
  ə: { ipa: 'ə', word: 'pencil (last syllable)', thai: 'เออ (เบา)', male: [500, 1500, 2500], female: [585, 1755, 2925] },
};

/** the five cardinal vowels of the book's "Vowel Spectrum", from the brightest to the darkest */
export const CARDINAL = ['i', 'e', 'ɑ', 'o', 'u'] as const;

/** F4 and F5 are not tied to the vowel (Titze p.159 gives 3500 Hz for a 17.5 cm tube); a little higher for women */
const UPPER: Record<Sex, [number, number]> = { male: [3500, 4500], female: [4200, 5000] };

export function formantsOf(vowel: string, sex: Sex = 'male'): number[] {
  const v = VOWELS[vowel] ?? VOWELS.ɑ;
  return [...v[sex], ...UPPER[sex]];
}

export const BANDWIDTHS = [80, 90, 130, 200, 250];

// ---------------------------------------------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------------------------------------------

interface Res { a: number; b: number; c: number; y1: number; y2: number }

/** Klatt digital resonator: unit gain at 0 Hz, peak at f, bandwidth bw (Hz) */
function resonator(f: number, bw: number, sr: number): Res {
  const c = -Math.exp((-2 * Math.PI * bw) / sr);
  const b = 2 * Math.exp((-Math.PI * bw) / sr) * Math.cos((2 * Math.PI * f) / sr);
  return { a: 1 - b - c, b, c, y1: 0, y2: 0 };
}
const stepRes = (r: Res, x: number) => {
  const y = r.a * x + r.b * r.y1 + r.c * r.y2;
  r.y2 = r.y1;
  r.y1 = y;
  return y;
};
function resMag(f: number, fc: number, bw: number, sr: number): number {
  const r = resonator(fc, bw, sr);
  const w = (2 * Math.PI * f) / sr;
  const re = 1 - r.b * Math.cos(w) - r.c * Math.cos(2 * w);
  const im = r.b * Math.sin(w) + r.c * Math.sin(2 * w);
  return r.a / Math.hypot(re, im);
}

interface Peak { b0: number; b1: number; b2: number; a1: number; a2: number; x1: number; x2: number; y1: number; y2: number }
/** RBJ peaking filter (a smooth bump of `db` decibels at f) */
function peaking(f: number, db: number, q: number, sr: number): Peak {
  const A = 10 ** (db / 40);
  const w0 = (2 * Math.PI * f) / sr;
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha / A;
  return {
    b0: (1 + alpha * A) / a0,
    b1: (-2 * Math.cos(w0)) / a0,
    b2: (1 - alpha * A) / a0,
    a1: (-2 * Math.cos(w0)) / a0,
    a2: (1 - alpha / A) / a0,
    x1: 0, x2: 0, y1: 0, y2: 0,
  };
}
const stepPeak = (p: Peak, x: number) => {
  const y = p.b0 * x + p.b1 * p.x1 + p.b2 * p.x2 - p.a1 * p.y1 - p.a2 * p.y2;
  p.x2 = p.x1;
  p.x1 = x;
  p.y2 = p.y1;
  p.y1 = y;
  return y;
};
function peakMag(f: number, fc: number, db: number, q: number, sr: number): number {
  const p = peaking(fc, db, q, sr);
  const w = (2 * Math.PI * f) / sr;
  // |B(e^jw)| / |A(e^jw)|
  const nr = p.b0 + p.b1 * Math.cos(w) + p.b2 * Math.cos(2 * w);
  const ni = -(p.b1 * Math.sin(w) + p.b2 * Math.sin(2 * w));
  const dr = 1 + p.a1 * Math.cos(w) + p.a2 * Math.cos(2 * w);
  const di = -(p.a1 * Math.sin(w) + p.a2 * Math.sin(2 * w));
  return Math.hypot(nr, ni) / Math.hypot(dr, di);
}

// ---------------------------------------------------------------------------------------------------------------
// Source: firmness of closure, register
// ---------------------------------------------------------------------------------------------------------------

export interface PulseShape {
  /** open quotient: share of one period in which the glottis is open (0.3 firm to 0.98 breathy) */
  oq: number;
  /** share of one period used by the closing phase (small = the folds snap shut = many harmonics) */
  fall: number;
  /** noise (aspiration) mixed in, relative to the size of the flow pulse */
  noise: number;
}

// Davids and LaTour, Table 3.1: the firmness of glottal closure from 1 (very relaxed, breathy) to 7 (very firm, heavy belt),
// 4 is "classical/legit" (flow phonation). The numbers below are this model's own choices that make the harmonics behave the
// way the book describes (firmer closure: more and stronger harmonics, less noise); they are not measurements.
const LEVELS: PulseShape[] = [
  { oq: 0.98, fall: 0.3, noise: 0.28 },
  { oq: 0.86, fall: 0.24, noise: 0.1 },
  { oq: 0.72, fall: 0.18, noise: 0.04 },
  { oq: 0.6, fall: 0.12, noise: 0.01 },
  { oq: 0.52, fall: 0.09, noise: 0 },
  { oq: 0.45, fall: 0.065, noise: 0 },
  { oq: 0.38, fall: 0.045, noise: 0 },
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const smooth = (t: number) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

/**
 * Pulse shape for a closure level 1..7 (decimals allowed) and a register.
 * register: 0 = chest (thick folds, long contact), 1 = head (thin folds, shorter contact). falsetto: folds are stretched thin and
 * touch only partly, so the pulse is almost a sine wave with some air leaking.
 */
export function pulseShape(level: number, register = 0.5, falsetto = false): PulseShape {
  const x = clamp(level, 1, 7) - 1;
  const i = Math.min(5, Math.floor(x));
  const f = x - i;
  let s: PulseShape = {
    oq: lerp(LEVELS[i].oq, LEVELS[i + 1].oq, f),
    fall: lerp(LEVELS[i].fall, LEVELS[i + 1].fall, f),
    noise: lerp(LEVELS[i].noise, LEVELS[i + 1].noise, f),
  };
  // chest voice keeps the folds together longer than head voice
  s = { oq: clamp(s.oq * (0.88 + 0.3 * register), 0.3, 0.97), fall: clamp(s.fall * (0.8 + 0.5 * register), 0.03, 0.35), noise: s.noise };
  if (falsetto) s = { oq: Math.max(s.oq, 0.93), fall: Math.max(s.fall, 0.34), noise: s.noise + 0.06 };
  return s;
}

/** Flow of one glottal pulse at phase p in [0,1): rises, falls, then stays shut. Peak value 1. */
export function pulseAt(p: number, s: PulseShape): number {
  const rise = Math.max(s.oq - s.fall, 0.25 * s.oq);
  const fall = s.oq - rise;
  if (p < rise) return 0.5 * (1 - Math.cos((Math.PI * p) / rise));
  if (p < s.oq) return Math.cos((Math.PI / 2) * ((p - rise) / fall));
  return 0;
}

/** Amplitude of harmonics 1..n of one pulse period (the first value is H1), straight DFT of the sampled pulse. */
export function pulseHarmonics(s: PulseShape, n: number): number[] {
  const N = 2048;
  const out: number[] = [];
  const x = new Float64Array(N);
  for (let i = 0; i < N; i++) x[i] = pulseAt(i / N, s);
  for (let k = 1; k <= n; k++) {
    let re = 0;
    let im = 0;
    for (let i = 0; i < N; i++) {
      const a = (2 * Math.PI * k * i) / N;
      re += x[i] * Math.cos(a);
      im -= x[i] * Math.sin(a);
    }
    out.push((2 * Math.hypot(re, im)) / N);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Onsets (how a note starts), vibrato
// ---------------------------------------------------------------------------------------------------------------

export type OnsetKind = 'coordinated' | 'breathy' | 'glottal';

export interface OnsetState {
  /** 0..1, how much voiced sound is let through */
  voiced: number;
  /** 0..1, how much noise (air) is let through */
  air: number;
  /** closure level to use at this time (1..7) */
  closure: number;
  /** pitch error in semitones (negative = flat); the glottal onset starts flat and scoops up */
  pitch: number;
  /** a one-off click at the start (hard attack) */
  click: number;
}

/**
 * How the three onsets of Davids and LaTour (chapter 3) behave in this model, as a function of time since the start.
 * breathy: air first, then the folds come together late. coordinated: air and closure arrive together.
 * glottal: the folds are shut and pressed, then burst open (a click, a flat start, firm closure for a moment).
 */
export function onsetState(kind: OnsetKind, t: number, target: number): OnsetState {
  if (kind === 'breathy') {
    const air = smooth(t / 0.05) * (1 - 0.7 * smooth((t - 0.2) / 0.25));
    return { voiced: smooth((t - 0.12) / 0.25), air, closure: lerp(1.2, target, smooth((t - 0.12) / 0.35)), pitch: 0, click: 0 };
  }
  if (kind === 'glottal') {
    const t0 = 0.06; // the silence while the folds are pressed shut
    if (t < t0) return { voiced: 0, air: 0, closure: 7, pitch: -1.5, click: 0 };
    const u = t - t0;
    return { voiced: 1, air: 0, closure: lerp(7, target, smooth(u / 0.12)), pitch: -1.5 * (1 - smooth(u / 0.07)), click: u < 0.002 ? 1 : 0 };
  }
  return { voiced: smooth(t / 0.04), air: 0.1 * smooth(t / 0.04) * (1 - smooth(t / 0.08)), closure: target, pitch: 0, click: 0 };
}

/** Pitch change from vibrato in cents at time t. extent is the whole swing (top to bottom) in cents. */
export function vibratoCents(t: number, dur: number, v: { rate: number; extent: number; terminal?: boolean }): number {
  const ramp = v.terminal ? smooth((t - 0.45 * dur) / (0.45 * dur)) : smooth(t / 0.3);
  return (v.extent / 2) * Math.sin(2 * Math.PI * v.rate * t) * ramp;
}

// ---------------------------------------------------------------------------------------------------------------
// The voice
// ---------------------------------------------------------------------------------------------------------------

export interface VoiceSpec {
  seconds: number;
  /** false: no fade at the ends (used inside loops) */
  fade?: boolean;
  /** Hz (a number, or a function of time) before vibrato */
  f0: number | ((t: number) => number);
  /** F1..F5 in Hz */
  formants?: number[] | ((t: number) => number[]);
  bandwidths?: number[];
  /** firmness of closure 1..7 */
  closure?: number | ((t: number) => number);
  /** 0 chest .. 1 head */
  register?: number;
  falsetto?: boolean;
  /** vocal fry: very low, irregular pulses with a long closed phase */
  fry?: boolean;
  vibrato?: { rate: number; extent: number; terminal?: boolean };
  /** 0..1, soft palate lowered */
  nasal?: number;
  /** a bump near the singer's formant (extra decibels, centre Hz) */
  ring?: { db: number; hz: number };
  onset?: OnsetKind;
  /** make the output this loud (rms). Leave out to keep the natural level of the model. */
  rms?: number;
  /** linear gain applied before the limiter when rms is not set */
  level?: number;
  sr?: number;
  seed?: number;
  /** relative random change of each period (0.003 = 0.3 percent) */
  jitter?: number;
  /**
   * Make a buffer that can be looped without a click: a whole number of periods (the pitch is moved by far less than a cent
   * to make that so), no fade, and the start-up of the filters cut off. Needs a steady f0 and no vibrato or onset.
   */
  loop?: boolean;
}

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const at = <T,>(v: T | ((t: number) => T), t: number): T => (typeof v === 'function' ? (v as (t: number) => T)(t) : v);

/** Active formants for a spec at time t, with the nasal pole and wider F1 when the soft palate is lowered */
function filterBank(formants: number[], bws: number[], nasal: number, sr: number): Res[] {
  const out: Res[] = [];
  formants.forEach((f, i) => {
    if (f < sr * 0.46) out.push(resonator(f, bws[i] * (i === 0 ? 1 + 1.6 * nasal : 1), sr));
  });
  if (nasal > 0) {
    const r = resonator(260, 90, sr);
    r.a *= 0.6 * nasal;
    out.push(r); // a parallel nasal murmur, mixed in below
  }
  return out;
}

/** pitch and length for a buffer that holds a whole number of periods: [exact f0, samples] */
export function loopLength(f0: number, seconds: number, sr = SR): [number, number] {
  let best: [number, number, number] | null = null;
  for (let k = Math.max(1, Math.ceil(0.9 * seconds * f0)); k <= Math.ceil(2.4 * seconds * f0); k++) {
    const n = Math.round((k * sr) / f0);
    const err = Math.abs(n - (k * sr) / f0) / n;
    if (!best || err < best[2] * 0.999) best = [k, n, err];
  }
  const [k, n] = best!;
  return [(k * sr) / n, n];
}

export function renderVoice(spec: VoiceSpec): Float32Array {
  if (spec.loop && typeof spec.f0 === 'number') {
    const sr = spec.sr ?? SR;
    const [f, n] = loopLength(spec.f0, spec.seconds, sr);
    const warm = Math.round(0.2 * sr);
    const full = renderVoice({ ...spec, loop: false, f0: f, seconds: (n + warm) / sr, fade: false });
    return full.slice(warm);
  }
  const sr = spec.sr ?? SR;
  const n = Math.round(spec.seconds * sr);
  const rand = mulberry32(spec.seed ?? 1);
  const out = new Float32Array(n);
  const bws = spec.bandwidths ?? BANDWIDTHS;
  const nasal = spec.nasal ?? 0;
  const jit = spec.jitter ?? (spec.fry ? 0.18 : 0.002);
  const staticFormants = typeof spec.formants !== 'function';
  let formants = at(spec.formants ?? formantsOf('ɑ'), 0);
  let bank = filterBank(formants, bws, nasal, sr);
  const ring = spec.ring ? peaking(spec.ring.hz, spec.ring.db, 1.6, sr) : null;
  const radiation = { prev: 0 };

  let phase = 0;
  let shape: PulseShape = pulseShape(4);
  let periodScale = 1;
  let sumSq = 0;

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const ons = spec.onset ? onsetState(spec.onset, t, at(spec.closure ?? 4, t)) : null;
    if (!staticFormants && i % 32 === 0) {
      formants = at(spec.formants!, t);
      bank = filterBank(formants, bws, nasal, sr);
    }
    // pitch: base, vibrato, onset scoop, jitter
    let cents = 0;
    if (spec.vibrato) cents += vibratoCents(t, spec.seconds, spec.vibrato);
    if (ons) cents += ons.pitch * 100;
    let f = at(spec.f0, t) * 2 ** (cents / 1200) * periodScale;
    if (spec.fry) f = Math.min(f, 70);
    phase += f / sr;
    if (phase >= 1) {
      phase -= 1;
      periodScale = 1 + (rand() - 0.5) * 2 * jit;
      const level = ons ? ons.closure : at(spec.closure ?? 4, t);
      shape = pulseShape(spec.fry ? Math.max(level, 5.5) : level, spec.register ?? 0.5, spec.falsetto);
      if (spec.fry) shape = { ...shape, oq: 0.28, fall: 0.06 };
    }
    const voiced = ons ? ons.voiced : 1;
    const flow = pulseAt(phase, shape) * voiced;
    const air = (shape.noise * (0.25 + flow) + (ons ? ons.air : 0)) * (rand() * 2 - 1);
    const src = flow + air + (ons && ons.click ? 3 : 0);
    let y = src;
    // formants in cascade; the nasal murmur is added in parallel
    const cascade = bank.length - (nasal > 0 ? 1 : 0);
    for (let k = 0; k < cascade; k++) y = stepRes(bank[k], y);
    if (nasal > 0) y = y * (1 - 0.35 * nasal) + stepRes(bank[bank.length - 1], src) * 6;
    if (ring) y = stepPeak(ring, y);
    // lip radiation: first difference
    const rad = y - radiation.prev;
    radiation.prev = y;
    out[i] = rad;
  }

  // envelope: short fade in and out so nothing clicks
  const fade = spec.fade === false ? 0 : Math.min(Math.round(0.02 * sr), n >> 1);
  for (let i = 0; i < fade; i++) {
    const g = i / fade;
    out[i] *= g;
    out[n - 1 - i] *= g;
  }
  for (let i = 0; i < n; i++) sumSq += out[i] * out[i];
  const rms = Math.sqrt(sumSq / Math.max(1, n));
  const scale = spec.rms ? (rms > 0 ? spec.rms / rms : 0) : (spec.level ?? 1);
  for (let i = 0; i < n; i++) out[i] = Math.tanh(out[i] * scale);
  return out;
}

export const rmsOf = (x: ArrayLike<number>) => {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i] * x[i];
  return Math.sqrt(s / Math.max(1, x.length));
};

// ---------------------------------------------------------------------------------------------------------------
// Analysis (what the labs draw, and what verify.mts compares against the rendered sound)
// ---------------------------------------------------------------------------------------------------------------

export interface FilterSpec {
  formants: number[];
  bandwidths?: number[];
  nasal?: number;
  ring?: { db: number; hz: number };
  sr?: number;
}

/** The filter plus lip radiation, in dB, at frequency f (no nasal murmur). 0 dB means a gain of 1. */
export function filterDb(f: number, spec: FilterSpec): number {
  const sr = spec.sr ?? SR;
  const bws = spec.bandwidths ?? BANDWIDTHS;
  const nasal = spec.nasal ?? 0;
  let g = 1;
  spec.formants.forEach((fc, i) => {
    if (fc < sr * 0.46) g *= resMag(f, fc, bws[i] * (i === 0 ? 1 + 1.6 * nasal : 1), sr);
  });
  if (nasal > 0) {
    // cascade part scaled, murmur added in parallel (magnitude sum is an approximation of the complex sum)
    g *= 1 - 0.35 * nasal;
    g += 6 * 0.6 * nasal * resMag(f, 260, 90, sr);
  }
  if (spec.ring) g *= peakMag(f, spec.ring.hz, spec.ring.db, 1.6, sr);
  g *= 2 * Math.abs(Math.sin((Math.PI * f) / sr)); // first difference
  return 20 * Math.log10(Math.max(g, 1e-9));
}

export interface HarmonicLevel {
  k: number;
  hz: number;
  source: number;
  filter: number;
  out: number;
}

/** Harmonics of a steady note: level of the source pulse, of the filter and of the product, all in dB (source of H1 = 0). */
export function harmonicLevels(f0: number, level: number, register: number, falsetto: boolean, filter: FilterSpec, fMax = 5000): HarmonicLevel[] {
  const n = Math.max(1, Math.floor(fMax / f0));
  const s = pulseShape(level, register, falsetto);
  const h = pulseHarmonics(s, n);
  const out: HarmonicLevel[] = [];
  for (let k = 1; k <= n; k++) {
    const source = 20 * Math.log10(Math.max(h[k - 1] / h[0], 1e-9));
    const fl = filterDb(k * f0, filter);
    out.push({ k, hz: k * f0, source, filter: fl, out: source + fl });
  }
  return out;
}

/** Spectral tilt of the source: dB lost per octave between H1 and the harmonic nearest 4 * f0 (H4), 8 * f0 (H8) */
export function sourceSlope(s: PulseShape): number {
  const h = pulseHarmonics(s, 8);
  return (20 * Math.log10(h[7] / h[0])) / 3;
}

// ---------------------------------------------------------------------------------------------------------------
// FFT (radix-2), used to look at rendered sound
// ---------------------------------------------------------------------------------------------------------------

export function fftMagnitude(x: ArrayLike<number>, nfft: number): Float64Array {
  const re = new Float64Array(nfft);
  const im = new Float64Array(nfft);
  const n = Math.min(x.length, nfft);
  for (let i = 0; i < n; i++) re[i] = x[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))); // Hann window
  for (let i = 1, j = 0; i < nfft; i++) {
    let bit = nfft >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= nfft; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < nfft; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
  const mag = new Float64Array(nfft / 2);
  for (let i = 0; i < nfft / 2; i++) mag[i] = Math.hypot(re[i], im[i]);
  return mag;
}

/** Level (dB, relative) of the strongest bin within +-halfWidth Hz of f */
export function peakDb(mag: Float64Array, f: number, sr: number, nfft: number, halfWidth = 8): number {
  const lo = Math.max(0, Math.floor(((f - halfWidth) * nfft) / sr));
  const hi = Math.min(mag.length - 1, Math.ceil(((f + halfWidth) * nfft) / sr));
  let m = 0;
  for (let i = lo; i <= hi; i++) m = Math.max(m, mag[i]);
  return 20 * Math.log10(Math.max(m, 1e-12));
}

// ---------------------------------------------------------------------------------------------------------------
// Tubes (Titze, chapter 6): a vocal tract of one width is a pipe closed at the glottis and open at the lips
// ---------------------------------------------------------------------------------------------------------------

export const SOUND_SPEED = 35000; // cm/s, warm moist air (the value Titze uses)

/** Formants n = 1, 2, ... of a closed-open tube of length L cm: (2n - 1) c / 4L */
export const quarterWave = (lengthCm: number, n: number, c = SOUND_SPEED) => ((2 * n - 1) * c) / (4 * lengthCm);
/** Formants of an open-open tube (lips and glottis both open, or both closed): n c / 2L */
export const halfWave = (lengthCm: number, n: number, c = SOUND_SPEED) => (n * c) / (2 * lengthCm);

/** |volume velocity at the lips / volume velocity at the glottis| of a lossy closed-open tube, in dB */
export function tubeGainDb(f: number, lengthCm: number, loss = 0.03, c = SOUND_SPEED): number {
  const k = (2 * Math.PI * f) / c;
  const kl = k * lengthCm;
  // cos(kL (1 - j loss)) magnitude
  const re = Math.cos(kl) * Math.cosh(kl * loss);
  const im = Math.sin(kl) * Math.sinh(kl * loss);
  return -20 * Math.log10(Math.max(Math.hypot(re, im), 1e-6));
}

// ---------------------------------------------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------------------------------------------

export const midiToHz = (m: number) => 440 * 2 ** ((m - 69) / 12);
export const hzToMidi = (f: number) => 69 + 12 * Math.log2(f / 440);
const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
/** "A4", "C♯3" for a midi number (rounded) */
export const noteName = (m: number) => {
  const r = Math.round(m);
  return NAMES[((r % 12) + 12) % 12] + (Math.floor(r / 12) - 1);
};
/** cents between f and the nearest equal-tempered note, plus that note */
export function nearestNote(f: number): { midi: number; cents: number; name: string } {
  const m = hzToMidi(f);
  const r = Math.round(m);
  return { midi: r, cents: (m - r) * 100, name: noteName(r) };
}
