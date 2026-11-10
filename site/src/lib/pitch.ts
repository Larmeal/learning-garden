// Pitch detection for the microphone lab: the McLeod pitch method (normalised square difference, then the first strong
// peak, refined by a parabola). Pure maths, so Node can test it against the synthesized voice (verify.mts).

export interface PitchResult {
  /** Hz, or null when nothing clear was heard */
  freq: number | null;
  /** 0..1, how periodic the frame is (1 = a clean tone) */
  clarity: number;
  /** loudness of the frame (rms) */
  rms: number;
}

export function detectPitch(buf: ArrayLike<number>, sr: number, minHz = 70, maxHz = 1100, minRms = 0.008): PitchResult {
  const n = buf.length;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += buf[i] * buf[i];
  const rms = Math.sqrt(sum / n);
  if (rms < minRms) return { freq: null, clarity: 0, rms };

  const minLag = Math.max(2, Math.floor(sr / maxHz));
  const maxLag = Math.min(n - 2, Math.ceil(sr / minHz));
  const nsdf = new Float64Array(maxLag + 2);
  for (let tau = 0; tau <= maxLag + 1 && tau < n; tau++) {
    let r = 0;
    let m = 0;
    for (let i = 0; i + tau < n; i++) {
      r += buf[i] * buf[i + tau];
      m += buf[i] * buf[i] + buf[i + tau] * buf[i + tau];
    }
    nsdf[tau] = m > 0 ? (2 * r) / m : 0;
  }

  // key maxima: the highest point between a rising and a falling zero crossing
  const peaks: number[] = [];
  let tau = 1;
  while (tau < maxLag && nsdf[tau] > 0) tau++; // skip the first positive lobe (the one around lag 0)
  while (tau < maxLag) {
    while (tau < maxLag && nsdf[tau] <= 0) tau++;
    let best = -1;
    while (tau < maxLag && nsdf[tau] > 0) {
      if (best < 0 || nsdf[tau] > nsdf[best]) best = tau;
      tau++;
    }
    if (best >= minLag) peaks.push(best);
  }
  if (!peaks.length) return { freq: null, clarity: 0, rms };
  const top = Math.max(...peaks.map((p) => nsdf[p]));
  const pick = peaks.find((p) => nsdf[p] >= 0.9 * top) ?? peaks[0];

  // parabolic refinement
  const a = nsdf[pick - 1];
  const b = nsdf[pick];
  const c = nsdf[pick + 1];
  const shift = a - 2 * b + c !== 0 ? (0.5 * (a - c)) / (a - 2 * b + c) : 0;
  const lag = pick + shift;
  const clarity = b - 0.25 * (a - c) * shift;
  return { freq: sr / lag, clarity: Math.min(1, Math.max(0, clarity)), rms };
}

export interface TracePoint {
  /** seconds */
  t: number;
  /** cents above the reference (any steady reference) */
  cents: number;
}

/**
 * Rate (Hz) and extent (cents, top to bottom) of a vibrato in a pitch trace. Looks at the last `window` seconds,
 * removes the slow movement of the note with a moving average, then counts the oscillations.
 * Returns null when there are fewer than two full waves. frameSec is the length of the detector frame, used to undo the
 * smoothing that the frame itself does (0 = no correction).
 */
export function analyzeVibrato(trace: TracePoint[], frameSec = 0, window = 1.6): { rate: number; extent: number } | null {
  if (trace.length < 8) return null;
  const end = trace[trace.length - 1].t;
  const pts = trace.filter((p) => p.t >= end - window);
  if (pts.length < 8) return null;
  const span = 0.6; // seconds: several waves of any vibrato above 5 Hz, so the average hardly follows the vibrato itself
  const detr = pts.map((p, i) => {
    let s = 0;
    let c = 0;
    for (let j = 0; j < pts.length; j++) if (Math.abs(pts[j].t - p.t) <= span / 2) { s += pts[j].cents; c++; }
    void i;
    return { t: p.t, v: p.cents - s / c };
  });
  const ups: number[] = [];
  for (let i = 1; i < detr.length; i++) {
    if (detr[i - 1].v < 0 && detr[i].v >= 0) {
      const f = -detr[i - 1].v / (detr[i].v - detr[i - 1].v);
      ups.push(detr[i - 1].t + f * (detr[i].t - detr[i - 1].t));
    }
  }
  if (ups.length < 3) return null;
  const rate = (ups.length - 1) / (ups[ups.length - 1] - ups[0]);
  const vals = detr.filter((p) => p.t >= ups[0] && p.t <= ups[ups.length - 1]).map((p) => p.v);
  const hi = Math.max(...vals);
  const lo = Math.min(...vals);
  // one frame of the detector averages the pitch over frameSec, which shrinks a wave of this rate by sinc(rate * frameSec)
  const x = Math.PI * rate * frameSec;
  const shrink = frameSec > 0 && x > 1e-6 ? Math.sin(x) / x : 1;
  return { rate, extent: (hi - lo) / shrink };
}
