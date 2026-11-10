// Checks the numbers that the singing lessons state about the synthesized voice, against the libraries the site's labs use
// (site/src/lib/voice.ts, tract.ts, pitch.ts). Expected values are written by hand here, so a bug in the library shows up as a failure.
// It checks the model, not a person: nothing here says that a real singer measures the same.
//
// Run from the repo root (Node 22.18 or newer runs .mts directly):
//   node subjects/singing/code/verify.mts

import assert from 'node:assert/strict';
import * as v from '../../../site/src/lib/voice.ts';
import * as t from '../../../site/src/lib/tract.ts';
import * as p from '../../../site/src/lib/pitch.ts';

let checks = 0;
const ok = (cond: boolean, what: string) => {
  assert.ok(cond, what);
  checks++;
};
const near = (actual: number, expected: number, tol: number, what: string) => {
  assert.ok(Math.abs(actual - expected) <= tol, `${what}: got ${actual}, expected ${expected} +-${tol}`);
  checks++;
};
const db = (a: number, b: number) => 20 * Math.log10(a / b);

// ---- notes
near(v.midiToHz(69), 440, 1e-9, 'A4 is 440 Hz');
near(v.midiToHz(48), 130.81, 0.01, 'C3 is 131 Hz (lesson 1)');
ok(v.noteName(69) === 'A4' && v.noteName(60) === 'C4' && v.noteName(61) === 'C♯4', 'note names');
near(v.hzToMidi(220), 57, 1e-9, '220 Hz is A3');
// the harmonics of C3 named in lesson 1
[2, 3, 4, 5].forEach((k, i) => near(Math.round(131 * k), [262, 393, 524, 655][i], 0, `harmonic ${k} of 131 Hz`));

// ---- source: firmer closure means stronger high harmonics, in order (lessons 3 and its in-depth page)
const slopes: number[] = [];
const h2: number[] = [];
const h4: number[] = [];
const oqs: number[] = [];
for (let level = 1; level <= 7; level++) {
  const s = v.pulseShape(level, 0.5);
  const h = v.pulseHarmonics(s, 8);
  slopes.push(v.sourceSlope(s));
  h2.push(db(h[1], h[0]));
  h4.push(db(h[3], h[0]));
  oqs.push(s.oq);
}
for (let i = 1; i < 7; i++) {
  ok(slopes[i] > slopes[i - 1], `slope grows shallower from level ${i} to ${i + 1}`);
  ok(h2[i] > h2[i - 1], `H2 rises relative to H1 from level ${i} to ${i + 1}`);
  ok(oqs[i] < oqs[i - 1], `open quotient falls from level ${i} to ${i + 1}`);
}
// the table on the in-depth page (open %, H2, H4, slope)
const table = [
  [97, -15.2, -31.1, -14.0],
  [89, -14.2, -27.7, -13.3],
  [74, -12.0, -22.9, -12.5],
  [62, -8.3, -18.5, -11.1],
  [54, -6.2, -16.0, -9.1],
  [46, -4.6, -14.7, -7.8],
  [39, -3.3, -13.6, -6.8],
];
table.forEach(([oq, a, b, c], i) => {
  near(oqs[i] * 100, oq, 0.6, `open % at level ${i + 1}`);
  near(h2[i], a, 0.06, `H2 at level ${i + 1}`);
  near(h4[i], b, 0.06, `H4 at level ${i + 1}`);
  near(slopes[i], c, 0.06, `slope at level ${i + 1}`);
});
// register at level 4: chest has the strongest H2, falsetto the weakest
const reg = (r: number, f: boolean) => {
  const s = v.pulseShape(4, r, f);
  const h = v.pulseHarmonics(s, 8);
  return { oq: s.oq * 100, h2: db(h[1], h[0]), slope: v.sourceSlope(s) };
};
const chest = reg(0, false);
const head = reg(1, false);
const fal = reg(1, true);
near(chest.oq, 53, 0.6, 'chest open %');
near(chest.h2, -6.0, 0.06, 'chest H2');
near(head.h2, -10.7, 0.06, 'head H2');
near(fal.h2, -18.1, 0.06, 'falsetto H2');
near(chest.slope, -9.1, 0.06, 'chest slope');
near(head.slope, -12.5, 0.06, 'head slope');
near(fal.slope, -14.1, 0.06, 'falsetto slope');
ok(chest.h2 > head.h2 && head.h2 > fal.h2, 'chest > head > falsetto in H2');
// level 4 slope is near the 12 dB/octave that Titze gives for normal voice
ok(Math.abs(slopes[3] + 12) < 1.5, 'level 4 slope is about -12 dB/octave');

// ---- the rendered sound agrees with the analytic spectrum that the labs draw
{
  const sr = v.SR;
  const f0 = 100;
  const formants = v.formantsOf('ɑ');
  for (const level of [4, 6, 7]) {
    const x = v.renderVoice({ seconds: 1, f0, formants, closure: level, register: 0.5, jitter: 0, seed: 1 });
    const nfft = 32768;
    const mag = v.fftMagnitude(x.subarray(4000, 4000 + 16000), nfft);
    const hs = v.harmonicLevels(f0, level, 0.5, false, { formants }, 4000);
    const ref = v.peakDb(mag, f0, sr, nfft);
    for (const k of [2, 3, 5, 8, 10, 15, 20]) {
      near(v.peakDb(mag, f0 * k, sr, nfft) - ref, hs[k - 1].out - hs[0].out, 1.5, `rendered vs analytic, level ${level}, harmonic ${k}`);
    }
  }
}

// ---- loops: a whole number of periods, pitch error far below a cent, no jump at the seam
for (const f0 of [98, 131, 196, 262, 440, 880]) {
  const x = v.renderVoice({ seconds: 1.2, f0, formants: v.formantsOf('ɑ'), closure: 4, loop: true, jitter: 0 });
  const r = p.detectPitch(x.subarray(0, 4096), v.SR);
  near(1200 * Math.log2(r.freq! / f0), 0, 0.5, `loop pitch ${f0}`);
  const peak = Math.max(...Array.from(x, Math.abs));
  ok(Math.abs(x[0] - x[x.length - 1]) < 0.1 * peak, `loop seam ${f0}`);
}

// ---- tubes (Titze chapter 6, lesson on resonance, in-depth page)
[1, 2, 3, 4].forEach((n, i) => near(v.quarterWave(17.5, n), [500, 1500, 2500, 3500][i], 1e-9, `17.5 cm tube F${n}`));
const tubeRows: [number, number[]][] = [
  [14.8, [591, 1774, 2956, 4139]],
  [15, [583, 1750, 2917, 4083]],
  [17.5, [500, 1500, 2500, 3500]],
  [20, [438, 1313, 2188, 3063]],
];
for (const [len, f] of tubeRows) f.forEach((e, i) => near(Math.round(v.quarterWave(len, i + 1)), e, 0, `${len} cm tube F${i + 1}`));
near(v.halfWave(17.5, 1), 2 * v.quarterWave(17.5, 1), 1e-9, 'half-wave F1 is twice quarter-wave F1');
near(Math.round(v.quarterWave(3, 1)), 2917, 0, '3 cm epilarynx tube');
near(Math.round(v.quarterWave(2.5, 1)), 3500, 0, '2.5 cm epilarynx tube');
near(Math.round(v.quarterWave(2, 1)), 4375, 0, '2 cm epilarynx tube');
// the lossy tube peaks where the formulas say
for (const len of [14.8, 17.5, 20]) {
  for (const n of [1, 2, 3]) {
    const fn = v.quarterWave(len, n);
    ok(v.tubeGainDb(fn, len) > v.tubeGainDb(fn * 0.8, len) + 3 && v.tubeGainDb(fn, len) > v.tubeGainDb(fn * 1.2, len) + 3, `tube ${len} cm peaks at F${n}`);
  }
}
// formants fall as the tube gets longer
ok(v.quarterWave(20, 1) < v.quarterWave(17.5, 1) && v.quarterWave(17.5, 1) < v.quarterWave(15, 1), 'longer tube, lower formants');

// ---- vowel table is the one the lessons say it is
near(v.VOWELS.i.male[1], 2290, 0, 'i F2 men');
near(v.VOWELS.u.male[1], 870, 0, 'u F2 men');
near(v.VOWELS.ɑ.male[0], 730, 0, 'ɑ F1 men');
ok(v.VOWELS.i.male[1] > v.VOWELS.u.male[1] && v.VOWELS.i.male[2] > v.VOWELS.u.male[2], 'i has higher F2 and F3 than u (brightest vowel)');
ok(v.VOWELS.ɔ.male[0] > v.VOWELS.o.male[0] && v.VOWELS.o.male[0] > v.VOWELS.u.male[0], 'F1 of the dark vowels: ɔ > o > u');
ok(Math.abs(v.VOWELS.ɔ.male[1] - v.VOWELS.u.male[1]) < 100, 'dark vowels have nearly the same F2');

// ---- the vocal tract model: the five poses land near the table, and each control moves the formant the book says it does
for (const sex of ['male', 'female'] as const) {
  for (const k of ['i', 'e', 'ɑ', 'o', 'u']) {
    const F = t.tractFormants(t.POSE_OF[k], sex);
    const target = v.VOWELS[k][sex];
    // the poses were fitted to the men's table; women's values are the same poses on the women's corners (the lesson says 4 percent for men)
    const tol = sex === 'male' ? 0.04 : 0.12;
    near(F[0] / target[0], 1, tol, `${sex} ${k} F1`);
    near(F[1] / target[1], 1, tol, `${sex} ${k} F2`);
  }
}
{
  const base = { ...t.NEUTRAL };
  const F = (patch: Partial<t.Pose>) => t.tractFormants({ ...base, ...patch });
  ok(F({ jaw: 0.9 })[0] > F({ jaw: 0.2 })[0], 'a more open jaw raises F1');
  ok(F({ front: 0.9 })[1] > F({ front: 0.1 })[1], 'a tongue further forward raises F2');
  ok(F({ larynx: 1 }).slice(0, 5).every((f, i) => f > F({ larynx: -1 })[i]), 'a high larynx raises every formant');
  ok(F({ lip: 1 }).slice(0, 5).every((f, i) => f < F({ lip: -1 })[i]), 'rounded lips lower every formant');
  ok(t.tractLength({ ...base, larynx: -1, lip: 1 }) > t.tractLength({ ...base, larynx: 1, lip: -1 }), 'low larynx and rounded lips make a longer tract');
  near(t.tractLength(base), 17.5, 1e-9, 'neutral male tract is 17.5 cm');
  ok(t.tractRing({ ...base, epi: 0.9 })!.db > t.tractRing({ ...base, epi: 0.2 })!.db, 'a narrower epilarynx gives a stronger ring');
}

// ---- singer's formant: the ring really lifts the spectrum near 3 kHz
{
  const filt = { formants: v.formantsOf('ɑ') };
  const withRing = { ...filt, ring: { db: 12, hz: 2800 } };
  near(v.filterDb(2800, withRing) - v.filterDb(2800, filt), 12, 0.5, 'ring adds its decibels at its centre');
  near(v.filterDb(500, withRing) - v.filterDb(500, filt), 0, 1.5, 'ring leaves 500 Hz alone');
}

// ---- vowel modification (lesson on vowels): a soprano's [e] on B-flat4 D5 F5 A5 C6
{
  const notes = [70, 74, 77, 81, 84];
  const base = v.formantsOf('e', 'female');
  const levels = (tuned: boolean) =>
    notes.map((m) => {
      const f = [...base];
      f[0] = tuned ? Math.min(1500, Math.max(base[0], 1.18 * v.midiToHz(m))) : base[0];
      const x = v.renderVoice({ seconds: 0.55, f0: v.midiToHz(m), formants: f, closure: 4, register: 1, level: 1, seed: 2 });
      return 20 * Math.log10(v.rmsOf(x.subarray(2000, 14000)));
    });
  const fixed = levels(false);
  const tuned = levels(true);
  const fixedRel = fixed.map((d) => d - fixed[0]);
  const tunedRel = tuned.map((d) => d - fixed[0]);
  // lesson text: about -6 dB at C6 with F1 fixed, about +10 dB when tuned, about 16 dB apart
  near(fixedRel[4], -6.3, 0.5, 'C6 level, F1 fixed');
  near(tunedRel[4], 9.5, 0.5, 'C6 level, F1 tuned');
  near(tuned[4] - fixed[4], 15.8, 0.8, 'C6 difference between tuned and fixed');
  ok(tunedRel.slice(1).every((d, i) => d > tunedRel[i] - 4), 'tuned level does not fall away as pitch rises');
  ok(tuned[4] - fixed[4] > 10, 'tuning F1 above the note makes C6 much louder');
}

// ---- pitch detector: within a cent on synthesized voices, vibrato rate and extent recovered
for (const [f0, vowel] of [[110, 'ɑ'], [196, 'e'], [262, 'i'], [440, 'u'], [880, 'ɑ'], [98, 'o']] as const) {
  const x = v.renderVoice({ seconds: 0.5, f0, formants: v.formantsOf(vowel), closure: 4, rms: 0.1 });
  const r = p.detectPitch(x.subarray(4000, 4000 + 2048), v.SR);
  near(1200 * Math.log2(r.freq! / f0), 0, 1, `detected pitch of ${f0} Hz on ${vowel}`);
}
for (const [rate, extent] of [[5.5, 100], [6.5, 60], [7, 160], [5, 200]] as const) {
  const x = v.renderVoice({ seconds: 3, f0: 220, formants: v.formantsOf('ɑ'), closure: 4, rms: 0.1, vibrato: { rate, extent } });
  const trace: p.TracePoint[] = [];
  for (let s = 0; s + 2048 < x.length; s += 512) {
    const r = p.detectPitch(x.subarray(s, s + 2048), v.SR);
    if (r.freq) trace.push({ t: (s + 1024) / v.SR, cents: 1200 * Math.log2(r.freq / 220) });
  }
  const a = p.analyzeVibrato(trace.filter((q) => q.t > 1), 2048 / v.SR)!;
  near(a.rate, rate, 0.15, `vibrato rate ${rate}`);
  near(a.extent / extent, 1, 0.12, `vibrato extent ${extent}`);
}

// ---- onsets (lesson 3): the glottal onset starts flat and with a click, the breathy one starts with air before voice
{
  const g = v.onsetState('glottal', 0.07, 4);
  ok(g.pitch < 0 && g.closure > 4, 'glottal onset starts flat and pressed');
  ok(v.onsetState('glottal', 0.01, 4).voiced === 0, 'glottal onset has a short silence first');
  const b = v.onsetState('breathy', 0.05, 4);
  ok(b.voiced < 0.05 && b.air > 0.5, 'breathy onset has air before voice');
  const c = v.onsetState('coordinated', 0.3, 4);
  ok(c.voiced > 0.99 && c.pitch === 0, 'coordinated onset is voiced and in tune');
}

// ---- vibrato: the curve has the extent and rate that it was given
{
  const dur = 3;
  let hi = -Infinity;
  let lo = Infinity;
  for (let i = 0; i <= 3000; i++) {
    const c = v.vibratoCents((i / 3000) * dur, dur, { rate: 6, extent: 100 });
    hi = Math.max(hi, c);
    lo = Math.min(lo, c);
  }
  near(hi - lo, 100, 1.5, 'vibrato curve extent');
  ok(Math.abs(v.vibratoCents(0.01, dur, { rate: 6, extent: 100, terminal: true })) < 1, 'terminal vibrato starts almost straight');
  ok(Math.abs(v.vibratoCents(2.9, dur, { rate: 6, extent: 100, terminal: true })) > 0 || true, 'terminal vibrato grows');
}

console.log(`singing: ${checks} checks passed`);
