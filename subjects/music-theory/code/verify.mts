// Checks the music facts that the lessons on the site state, against the library that the site's labs use
// (site/src/lib/music.ts). Expected values are written by hand here, so a bug in the library shows up as a failure.
//
// Run from the repo root (Node 22.18 or newer runs .mts directly):
//   node subjects/music-theory/code/verify.mts

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as m from '../../../site/src/lib/music.ts';
import { LESSONS, TERMS } from '../../../site/src/components/labs/guitar/glossaryData.ts';

const N = m.parseNote;
const names = (root: string, scale: keyof typeof m.SCALES) => m.build(N(root), m.SCALES[scale].pattern).map(m.nameOf).join(' ');
let checks = 0;
const eq = (actual: unknown, expected: unknown, what: string) => {
  assert.deepEqual(actual, expected, what);
  checks++;
};

// ---- scales are spelled with every letter once (site: major-scale-keys, minor-modes)
eq(names('C', 'major'), 'C D E F G A B', 'C major');
eq(names('D', 'major'), 'D E F♯ G A B C♯', 'D major');
eq(names('B♭', 'major'), 'B♭ C D E♭ F G A', 'B♭ major');
eq(names('F♯', 'major'), 'F♯ G♯ A♯ B C♯ D♯ E♯', 'F♯ major');
eq(names('D♭', 'major'), 'D♭ E♭ F G♭ A♭ B♭ C', 'D♭ major');
eq(names('A', 'minor'), 'A B C D E F G', 'A natural minor');
eq(names('A', 'harmonicMinor'), 'A B C D E F G♯', 'A harmonic minor');
eq(names('A', 'melodicMinor'), 'A B C D E F♯ G♯', 'A melodic minor');
eq(names('D', 'dorian'), 'D E F G A B C', 'D Dorian');
eq(names('D', 'minor'), 'D E F G A B♭ C', 'D natural minor (differs from Dorian only at the 6th)');
eq(names('G', 'lydian'), 'G A B C♯ D E F♯', 'G Lydian');
eq(names('D', 'mixolydian'), 'D E F♯ G A B C', 'D Mixolydian');
eq(names('A', 'minorPent'), 'A C D E G', 'A minor pentatonic');
eq(names('C', 'majorPent'), 'C D E G A', 'C major pentatonic');
eq(names('A', 'blues'), 'A C D E♭ E G', 'A blues');

// A minor pentatonic and C major pentatonic are the same five pitch classes (guitar: scales)
eq([...m.build(N('A'), m.SCALES.minorPent.pattern).map(m.pcOf)].sort((a, b) => a - b), [...m.build(N('C'), m.SCALES.majorPent.pattern).map(m.pcOf)].sort((a, b) => a - b), 'relative pentatonics');

// ---- key signatures (site: major-scale-keys)
const sig = (k: string) => m.signatureOf(k);
eq([sig('C').count, sig('G').count, sig('D').count, sig('A').count, sig('E').count, sig('B').count, sig('F♯').count], [0, 1, 2, 3, 4, 5, 6], 'sharps up the circle');
eq([sig('F').count, sig('B♭').count, sig('E♭').count, sig('A♭').count, sig('D♭').count], [1, 2, 3, 4, 5], 'flats down the circle');
eq(sig('D').accidentals, ['F♯', 'C♯'], 'D major signature');
eq(sig('E♭').accidentals.sort(), ['A♭', 'B♭', 'E♭'], 'E♭ major signature');

// ---- diatonic chords (site: diatonic-harmony)
const chordsOf = (k: string, scale: keyof typeof m.SCALES, size: 3 | 4) => {
  const s = m.build(N(k), m.SCALES[scale].pattern);
  return s.map((_, i) => { const c = m.diatonicChord(s, i, size); return m.chordName(c.root, c.quality); }).join(' ');
};
eq(chordsOf('C', 'major', 3), 'C Dm Em F G Am Bdim', 'C major triads');
eq(chordsOf('G', 'major', 3), 'G Am Bm C D Em F♯dim', 'G major triads');
eq(chordsOf('E', 'major', 3), 'E F♯m G♯m A B C♯m D♯dim', 'E major triads');
eq(chordsOf('C', 'major', 4), 'Cmaj7 Dm7 Em7 Fmaj7 G7 Am7 Bm7♭5', 'C major sevenths');
eq(chordsOf('A', 'minor', 3), 'Am Bdim C Dm Em F G', 'A natural minor triads');
eq(chordsOf('A', 'harmonicMinor', 3).split(' ')[4], 'E', 'harmonic minor makes V major');
eq(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'].join(' '), m.build(N('C'), m.SCALES.major.pattern).map((_, i) => m.roman(i, m.diatonicChord(m.build(N('C'), m.SCALES.major.pattern), i, 3).quality)).join(' '), 'roman numerals');

// I-V-vi-IV in several keys (site: diatonic-harmony)
const ivvi = (k: string) => { const s = m.build(N(k), m.SCALES.major.pattern); return [0, 4, 5, 3].map((i) => { const c = m.diatonicChord(s, i, 3); return m.chordName(c.root, c.quality); }).join(' '); };
eq(ivvi('C'), 'C G Am F', 'I-V-vi-IV in C');
eq(ivvi('E'), 'E B C♯m A', 'I-V-vi-IV in E');
eq(ivvi('B♭'), 'B♭ F Gm E♭', 'I-V-vi-IV in B♭');

// ---- secondary dominants in C (site: beyond-diatonic): a P5 above each target
const cMajor = m.build(N('C'), m.SCALES.major.pattern);
const p5 = m.INTERVALS.find((i) => i.short === 'P5')!;
eq([1, 2, 3, 4, 5].map((i) => m.chordName(m.above(cMajor[i], p5), 'dom7')), ['A7', 'B7', 'C7', 'D7', 'E7'], 'V7/ii V7/iii V7/IV V7/V V7/vi');
const gMajor = m.build(N('G'), m.SCALES.major.pattern);
eq([1, 4, 5].map((i) => m.chordName(m.above(gMajor[i], p5), 'dom7')), ['E7', 'A7', 'B7'], 'V7/ii V7/V V7/vi in G');

// ---- chord spelling (site: chords)
const spell = (root: string, q: keyof typeof m.CHORDS) => m.build(N(root), m.CHORDS[q].pattern).map(m.nameOf).join(' ');
eq(spell('C', 'dom7'), 'C E G B♭', 'C7');
eq(spell('G', 'dom7'), 'G B D F', 'G7');
eq(spell('C', 'm7b5'), 'C E♭ G♭ B♭', 'Cm7♭5');
eq(spell('C', 'dim7'), 'C E♭ G♭ B𝄫', 'Cdim7 spells its 7th as B double flat');
eq(spell('C', 'add9'), 'C E G D', 'Cadd9');
eq(spell('F', 'minor'), 'F A♭ C', 'Fm');

// ---- intervals (site: intervals)
const up = (root: string, short: string) => m.nameOf(m.above(N(root), m.INTERVALS.find((i) => i.short === short)!));
eq([up('A', 'P5'), up('C', 'M3'), up('C', 'm3'), up('F♯', 'M7'), up('C', 'M6')], ['E', 'E', 'E♭', 'E♯', 'A'], 'interval spelling');
eq(m.INTERVALS.map((i) => i.semis), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'interval semitones');
eq(m.INTERVALS.find((i) => i.short === 'M3')!.semis + m.INTERVALS.find((i) => i.short === 'm6')!.semis, 12, 'M3 inverts to m6');

// ---- pitch (site: pitch-notation)
eq(m.freq(69), 440, 'A4');
eq(m.freq(81), 880, 'A5');
eq(m.freq(60).toFixed(2), '261.63', 'middle C');
eq(m.TUNING.map(m.noteNameOfMidi).join(' '), 'E A D G B E', 'standard tuning');
eq(m.TUNING.map((t) => m.noteNameOfMidi(t) + m.octaveOfMidi(t)).join(' '), 'E2 A2 D3 G3 B3 E4', 'tuning with octaves');

// ---- fretboard (site: guitar fretboard, chords, barre-caged, scales)
const at = (s: number, f: number) => m.noteNameOfMidi(m.pitchAt(s, f));
eq([0, 1, 3, 5, 7, 8, 10, 12].map((f) => at(0, f)).join(' '), 'E F G A B C D E', 'natural notes on string 6');
eq([2, 3, 5, 7, 8, 10, 12].map((f) => at(1, f)).join(' '), 'B C D E F G A', 'natural notes on string 5');
eq(m.pitchAt(0, 5), m.pitchAt(1, 0), 'string 6 fret 5 = open string 5');
eq(m.pitchAt(2, 5), m.pitchAt(3, 0), 'string 4 fret 5 = open string 3');
eq(m.pitchAt(3, 4), m.pitchAt(4, 0), 'string 3 fret 4 = open string 2 (the G-B exception)');
eq(m.pitchAt(0, 3) + 12, m.pitchAt(2, 5), 'octave shape +2 frets (string 6 to string 4)');
eq(m.pitchAt(1, 3) + 12, m.pitchAt(3, 5), 'octave shape +2 frets (string 5 to string 3)');
eq(m.pitchAt(2, 5) + 12, m.pitchAt(4, 8), 'octave shape +3 frets when crossing G-B (string 4 to string 2)');

// A minor pentatonic box 1 sits on frets 5-8 (guitar: scales)
const aPent = m.build(N('A'), m.SCALES.minorPent.pattern);
const box = m.scalePositions(aPent, 2).find((p) => p.lo === 5 && p.hi === 8);
assert.ok(box, 'box 1 exists at frets 5-8');
const perString = (s: number) => box!.marks.filter((x) => x.string === s).map((x) => x.fret).join('/');
eq([0, 1, 2, 3, 4, 5].map(perString), ['5/8', '5/7', '5/7', '5/7', '5/8', '5/8'], 'A minor pentatonic box 1');

// CAGED: the five shapes make the same chord (guitar: barre-caged)
for (const root of ['C', 'G', 'A', 'E', 'D', 'F', 'B♭']) {
  const pc = m.pcOf(N(root));
  const want = new Set([pc, (pc + 4) % 12, (pc + 7) % 12]);
  for (const shape of ['C', 'A', 'G', 'E', 'D'] as const) {
    const got = new Set(m.cagedAt(shape, pc).frets.flatMap((f, s) => (f < 0 ? [] : [m.mod12(m.pitchAt(s, f))])));
    eq([...got].sort().join(), [...want].sort().join(), `${shape} shape for ${root}`);
  }
}
eq(m.cagedAt('E', m.pcOf(N('F'))).frets, [1, 3, 3, 2, 1, 1], 'F barre chord = E shape at fret 1');
eq(m.cagedAt('A', m.pcOf(N('B'))).frets, [-1, 2, 4, 4, 4, 2], 'B barre chord = A shape at fret 2');

// ---- every chord box printed in a lesson (name + frets) really holds that chord, with the root in the bass
const lessons = join(import.meta.dirname, '../../../site/src/content/lessons');
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.mdx') ? [p] : []; });
const suffixes = Object.entries(m.CHORDS).map(([key, v]) => [v.suffix, key] as const).sort((a, b) => b[0].length - a[0].length);
let shapes = 0;
for (const file of walk(lessons)) {
  for (const hit of readFileSync(file, 'utf8').matchAll(/name:\s*'([^']+)',\s*frets:\s*\[([^\]]+)\]/g)) {
    const [, name, raw] = hit;
    const frets = raw.split(',').map(Number);
    const parts = name.match(/^([A-G][♯♭]?)(.*)$/)!;
    const quality = suffixes.find(([suffix]) => suffix === parts[2])?.[1];
    assert.ok(quality, `${file}: unknown chord suffix in ${name}`);
    const notes = m.build(N(parts[1]), m.CHORDS[quality].pattern);
    const want = new Set(notes.map(m.pcOf));
    const got = new Set(frets.flatMap((f, s) => (f < 0 ? [] : [m.mod12(m.pitchAt(s, f))])));
    assert.deepEqual([...got].sort(), [...want].sort(), `${file}: ${name} ${frets.join(' ')} has the wrong notes`);
    const lowest = frets.findIndex((f) => f >= 0);
    assert.equal(m.mod12(m.pitchAt(lowest, frets[lowest])), m.pcOf(notes[0]), `${file}: ${name} has no root in the bass`);
    shapes++;
    checks++;
  }
}

// ---- numbers in the guitar introduction (site: guitar/introduction)
const fretFromNut = (scale: number, n: number) => scale * (1 - 2 ** (-n / 12));
eq([1, 5, 7, 12, 19].map((n) => fretFromNut(25.5, n).toFixed(2)), ['1.43', '6.40', '8.48', '12.75', '16.99'], 'fret distances, 25.5 in scale');
eq([1, 5, 7, 12, 19].map((n) => fretFromNut(24.75, n).toFixed(2)), ['1.39', '6.21', '8.23', '12.38', '16.49'], 'fret distances, 24.75 in scale');
eq(fretFromNut(650, 12), 325, 'the 12th fret halves the string');
// T = mu * (2 L f)^2 for a .010 in plain steel string at E4 on a 25.5 in scale (steel 7850 kg/m3)
{
  const d = 0.010 * 0.0254;
  const mu = 7850 * Math.PI * (d / 2) ** 2;
  const T = mu * (2 * 25.5 * 0.0254 * m.freq(64)) ** 2;
  assert.ok(T > 70 && T < 76, 'string tension about 73 N, got ' + T);
  checks++;
}

// ---- harmonics (site: guitar/introduction/harmonics)
const alive = (fret: number) => m.harmonicsAt(fret).filter((x) => x.alive).map((x) => x.k);
eq([alive(12), alive(7), alive(19), alive(5), alive(24), alive(9), alive(4)], [[2, 4, 6], [3, 6], [3, 6], [4], [4], [5], [5]], 'harmonics that survive a touch at each fret');
eq([3, 6, 8, 10].map(alive), [[], [], [], []], 'no harmonic at frets 3, 6, 8, 10');
eq(alive(0), [1, 2, 3, 4, 5, 6], 'without a finger every pattern survives');
eq(m.fretFraction(12), 0.5, 'fret 12 is the middle of the string');
eq([7, 5].map((n) => m.fretFraction(n).toFixed(4)), ['0.3326', '0.2508'], 'fret 7 is near 1/3 and fret 5 is near 1/4');
assert.ok(Math.abs(4 * m.freq(40) - 3 * m.freq(45)) < 0.5, 'string 6 fret 5 harmonic and string 5 fret 7 harmonic are the same pitch within 0.5 Hz');
checks++;

// ---- glossary: no duplicate terms, every lesson link is real and titled as the lesson says (site: guitar/introduction/glossary)
eq(new Set(TERMS.map((t) => t.term.toLowerCase())).size, TERMS.length, 'glossary terms are unique');
for (const [key, title] of Object.entries(LESSONS)) {
  const file = join(lessons, key, 'index.mdx');
  const front = readFileSync(file, 'utf8').match(/^title:\s*"?(.+?)"?\s*$/m)?.[1];
  eq(front, title, 'glossary LESSONS title for ' + key);
}
for (const t of TERMS) if (t.see) assert.ok(t.see in LESSONS, 'glossary term ' + t.term + ' points to unknown lesson ' + t.see);
checks += TERMS.filter((t) => t.see).length;

console.log(`${checks} checks passed (${shapes} chord boxes from the lessons)`);
