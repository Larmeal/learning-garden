// Pure music maths shared by the guitar and music-theory labs. No DOM, no audio, so it can be tested with plain node.
// Notes are spelled with letters (C D E F G A B) plus an accidental, so a B-flat major scale reads B♭ C D E♭ F G A
// and not A♯ B C♯ ..., which is how a real theory lesson spells it.

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];

export interface Note {
  letter: number; // index into LETTERS
  acc: number; // -2 double flat ... +2 double sharp
}

const ACC_SYMBOL: Record<number, string> = { [-2]: '𝄫', [-1]: '♭', 0: '', 1: '♯', 2: '𝄪' };

export const pcOf = (n: Note) => (((LETTER_PC[n.letter] + n.acc) % 12) + 12) % 12;
export const nameOf = (n: Note) => LETTERS[n.letter] + ACC_SYMBOL[n.acc];

/** "B♭", "F#", "Bb", "C" -> Note. Accepts ASCII # and b as well as ♯ ♭. */
export function parseNote(s: string): Note {
  const letter = LETTERS.indexOf(s[0].toUpperCase() as (typeof LETTERS)[number]);
  if (letter < 0) throw new Error(`not a note: ${s}`);
  let acc = 0;
  for (const ch of s.slice(1)) acc += ch === '#' || ch === '♯' ? 1 : ch === 'b' || ch === '♭' ? -1 : 0;
  return { letter, acc };
}

export const mod12 = (n: number) => ((n % 12) + 12) % 12;

/** Spell the note that sits `semis` above `root` and `degree` letters above it (degree 1 = same letter). */
export function spell(root: Note, degree: number, semis: number): Note {
  const letter = (root.letter + degree - 1) % 7;
  let acc = mod12(pcOf(root) + semis - LETTER_PC[letter]);
  if (acc > 6) acc -= 12;
  return { letter, acc };
}

// ---------------------------------------------------------------- intervals

export interface IntervalInfo {
  semis: number;
  short: string;
  name: string;
  degree: number; // letter distance, 1 = unison
}

export const INTERVALS: IntervalInfo[] = [
  { semis: 0, short: 'P1', name: 'Perfect unison', degree: 1 },
  { semis: 1, short: 'm2', name: 'Minor 2nd', degree: 2 },
  { semis: 2, short: 'M2', name: 'Major 2nd', degree: 2 },
  { semis: 3, short: 'm3', name: 'Minor 3rd', degree: 3 },
  { semis: 4, short: 'M3', name: 'Major 3rd', degree: 3 },
  { semis: 5, short: 'P4', name: 'Perfect 4th', degree: 4 },
  { semis: 6, short: 'TT', name: 'Tritone (♭5 / ♯4)', degree: 5 },
  { semis: 7, short: 'P5', name: 'Perfect 5th', degree: 5 },
  { semis: 8, short: 'm6', name: 'Minor 6th', degree: 6 },
  { semis: 9, short: 'M6', name: 'Major 6th', degree: 6 },
  { semis: 10, short: 'm7', name: 'Minor 7th', degree: 7 },
  { semis: 11, short: 'M7', name: 'Major 7th', degree: 7 },
  { semis: 12, short: 'P8', name: 'Perfect octave', degree: 8 },
];

/** The note an interval above `root`, spelled correctly (a tritone from C is F♯ or G♭ depending on `degree`). */
export const above = (root: Note, iv: IntervalInfo): Note => spell(root, iv.degree, iv.semis);

// ---------------------------------------------------------------- scales and chords

/** A pattern is a list of [degree, semitones above the root]. */
export type Pattern = [number, number][];

export const SCALES: Record<string, { label: string; pattern: Pattern }> = {
  major: { label: 'Major (Ionian)', pattern: [[1, 0], [2, 2], [3, 4], [4, 5], [5, 7], [6, 9], [7, 11]] },
  dorian: { label: 'Dorian', pattern: [[1, 0], [2, 2], [3, 3], [4, 5], [5, 7], [6, 9], [7, 10]] },
  phrygian: { label: 'Phrygian', pattern: [[1, 0], [2, 1], [3, 3], [4, 5], [5, 7], [6, 8], [7, 10]] },
  lydian: { label: 'Lydian', pattern: [[1, 0], [2, 2], [3, 4], [4, 6], [5, 7], [6, 9], [7, 11]] },
  mixolydian: { label: 'Mixolydian', pattern: [[1, 0], [2, 2], [3, 4], [4, 5], [5, 7], [6, 9], [7, 10]] },
  minor: { label: 'Natural minor (Aeolian)', pattern: [[1, 0], [2, 2], [3, 3], [4, 5], [5, 7], [6, 8], [7, 10]] },
  locrian: { label: 'Locrian', pattern: [[1, 0], [2, 1], [3, 3], [4, 5], [5, 6], [6, 8], [7, 10]] },
  harmonicMinor: { label: 'Harmonic minor', pattern: [[1, 0], [2, 2], [3, 3], [4, 5], [5, 7], [6, 8], [7, 11]] },
  melodicMinor: { label: 'Melodic minor (ขาขึ้น)', pattern: [[1, 0], [2, 2], [3, 3], [4, 5], [5, 7], [6, 9], [7, 11]] },
  majorPent: { label: 'Major pentatonic', pattern: [[1, 0], [2, 2], [3, 4], [5, 7], [6, 9]] },
  minorPent: { label: 'Minor pentatonic', pattern: [[1, 0], [3, 3], [4, 5], [5, 7], [7, 10]] },
  blues: { label: 'Blues', pattern: [[1, 0], [3, 3], [4, 5], [5, 6], [5, 7], [7, 10]] },
};

export const CHORDS: Record<string, { label: string; suffix: string; pattern: Pattern }> = {
  major: { label: 'Major', suffix: '', pattern: [[1, 0], [3, 4], [5, 7]] },
  minor: { label: 'Minor', suffix: 'm', pattern: [[1, 0], [3, 3], [5, 7]] },
  dim: { label: 'Diminished', suffix: 'dim', pattern: [[1, 0], [3, 3], [5, 6]] },
  aug: { label: 'Augmented', suffix: 'aug', pattern: [[1, 0], [3, 4], [5, 8]] },
  sus2: { label: 'Suspended 2nd', suffix: 'sus2', pattern: [[1, 0], [2, 2], [5, 7]] },
  sus4: { label: 'Suspended 4th', suffix: 'sus4', pattern: [[1, 0], [4, 5], [5, 7]] },
  maj7: { label: 'Major 7th', suffix: 'maj7', pattern: [[1, 0], [3, 4], [5, 7], [7, 11]] },
  dom7: { label: 'Dominant 7th', suffix: '7', pattern: [[1, 0], [3, 4], [5, 7], [7, 10]] },
  min7: { label: 'Minor 7th', suffix: 'm7', pattern: [[1, 0], [3, 3], [5, 7], [7, 10]] },
  m7b5: { label: 'Half-diminished', suffix: 'm7♭5', pattern: [[1, 0], [3, 3], [5, 6], [7, 10]] },
  dim7: { label: 'Diminished 7th', suffix: 'dim7', pattern: [[1, 0], [3, 3], [5, 6], [7, 9]] },
  add9: { label: 'Add 9', suffix: 'add9', pattern: [[1, 0], [3, 4], [5, 7], [9, 14]] },
};

/** Notes of a scale or chord pattern above a root, spelled by letter. */
export const build = (root: Note, pattern: Pattern): Note[] => pattern.map(([deg, semis]) => spell(root, deg, semis));

export const chordName = (root: Note, quality: string) => nameOf(root) + CHORDS[quality].suffix;

/** Chord quality made by stacking thirds on scale degree `i` (0-based), using `size` 3 (triad) or 4 (seventh). */
export function diatonicChord(scale: Note[], i: number, size: 3 | 4): { root: Note; quality: string; notes: Note[] } {
  const n = scale.length;
  const notes = Array.from({ length: size }, (_, k) => scale[(i + 2 * k) % n]);
  const rootPc = pcOf(notes[0]);
  const shape = notes.map((x) => mod12(pcOf(x) - rootPc)).join(',');
  const table: Record<string, string> = {
    '0,4,7': 'major', '0,3,7': 'minor', '0,3,6': 'dim', '0,4,8': 'aug',
    '0,4,7,11': 'maj7', '0,4,7,10': 'dom7', '0,3,7,10': 'min7', '0,3,6,10': 'm7b5', '0,3,6,9': 'dim7',
  };
  const quality = table[shape];
  if (!quality) throw new Error(`no chord quality for ${shape}`);
  return { root: notes[0], quality, notes };
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
/** Roman numeral for degree `i` with the quality's case and marks: ii, V7, vii°, IVmaj7. */
export function roman(i: number, quality: string): string {
  const upper = ['major', 'aug', 'maj7', 'dom7'].includes(quality);
  const base = upper ? ROMAN[i] : ROMAN[i].toLowerCase();
  const tail: Record<string, string> = { major: '', minor: '', dim: '°', aug: '+', maj7: 'maj7', dom7: '7', min7: '7', m7b5: 'ø7', dim7: '°7' };
  return base + tail[quality];
}

// ---------------------------------------------------------------- keys and the circle of fifths

export const MAJOR_KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'D♭', 'A♭', 'E♭', 'B♭', 'F'];
/** Relative minor of each major key above, in the same order. */
export const MINOR_KEYS = ['A', 'E', 'B', 'F♯', 'C♯', 'G♯', 'D♯', 'B♭', 'F', 'C', 'G', 'D'];

/** Sharps (+) or flats (-) in a major key's signature: C 0, G +1, F -1. */
export function signatureOf(majorKey: string): { count: number; kind: 'sharp' | 'flat' | 'none'; accidentals: string[] } {
  const scale = build(parseNote(majorKey), SCALES.major.pattern);
  const accidentals = scale.filter((n) => n.acc !== 0).map(nameOf);
  const sharps = scale.filter((n) => n.acc > 0).length;
  const flats = scale.filter((n) => n.acc < 0).length;
  return { count: accidentals.length, kind: sharps ? 'sharp' : flats ? 'flat' : 'none', accidentals };
}

// ---------------------------------------------------------------- pitch and the guitar

/** MIDI note number: C4 = 60, A4 = 69. */
export const freq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Standard tuning, low E to high e, as MIDI numbers (E2 A2 D3 G3 B3 E4). */
export const TUNING = [40, 45, 50, 55, 59, 64];
export const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];

/** MIDI pitch of a fretted note. `string` 0 is the low E. */
export const pitchAt = (string: number, fret: number) => TUNING[string] + fret;

/** Sharp-spelled name of a pitch class, for places where no key is known (a bare fretboard). */
export const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const noteNameOfMidi = (midi: number) => SHARP_NAMES[mod12(midi)];
export const octaveOfMidi = (midi: number) => Math.floor(midi / 12) - 1;

export interface Mark {
  string: number; // 0 = low E
  fret: number;
  label?: string;
  kind?: 'root' | 'tone' | 'faint' | 'target';
}

/**
 * Every place on the neck (frets 0..frets) that holds a note of `notes`. The first note is the root.
 * `labels` picks what is printed in the dot.
 */
export function marksFor(notes: Note[], opts: { frets?: number; labels?: 'name' | 'degree' | 'none'; degrees?: string[]; from?: number; to?: number } = {}): Mark[] {
  const { frets = 15, labels = 'name', degrees = [], from = 0, to = frets } = opts;
  const out: Mark[] = [];
  for (let s = 0; s < 6; s++) {
    for (let f = Math.max(0, from); f <= to; f++) {
      const pc = mod12(TUNING[s] + f);
      const idx = notes.findIndex((n) => pcOf(n) === pc);
      if (idx < 0) continue;
      out.push({
        string: s,
        fret: f,
        kind: idx === 0 ? 'root' : 'tone',
        label: labels === 'name' ? nameOf(notes[idx]) : labels === 'degree' ? degrees[idx] ?? '' : undefined,
      });
    }
  }
  return out;
}

/** Degree labels for a pattern: 1 2 ♭3 4 5 ♭6 ♭7 etc., judged against the major scale. */
export function degreeLabels(pattern: Pattern): string[] {
  const major = [0, 2, 4, 5, 7, 9, 11];
  return pattern.map(([deg, semis]) => {
    const ref = deg <= 7 ? major[deg - 1] : major[(deg - 1) % 7] + 12;
    const d = semis - ref;
    return (d < 0 ? '♭'.repeat(-d) : d > 0 ? '♯'.repeat(d) : '') + deg;
  });
}

export interface Position {
  marks: Mark[];
  lo: number; // lowest fret used
  hi: number; // highest fret used
  startNote: string; // the note the position starts on, on the low E string
}

/**
 * Scale positions the way teachers draw them: walk up the scale in pitch order and give each string the next
 * `perString` notes. Starting that walk on each scale note in turn gives one position per note of the scale
 * (five boxes for a pentatonic at 2 per string, seven for a diatonic scale at 3 per string). Positions that would
 * need a fret outside 0..lastFret are dropped, and a position that fits an octave higher is listed again there.
 * Sorted from the nut upward.
 */
export function scalePositions(notes: Note[], perString: number, lastFret = 15): Position[] {
  const pcs = notes.map(pcOf);
  const pitches: number[] = [];
  for (let p = TUNING[0]; p <= TUNING[5] + lastFret + 12; p++) if (pcs.includes(mod12(p))) pitches.push(p);

  const out: Position[] = [];
  for (let j = 0; j + 6 * perString <= pitches.length; j++) {
    const marks: Mark[] = [];
    let ok = true;
    for (let s = 0; s < 6 && ok; s++) {
      for (let q = 0; q < perString; q++) {
        const pitch = pitches[j + s * perString + q];
        const fret = pitch - TUNING[s];
        if (fret < 0 || fret > lastFret) { ok = false; break; }
        const idx = pcs.indexOf(mod12(pitch));
        marks.push({ string: s, fret, kind: idx === 0 ? 'root' : 'tone', label: nameOf(notes[idx]) });
      }
    }
    if (!ok) continue;
    const frets = marks.map((m) => m.fret);
    out.push({ marks, lo: Math.min(...frets), hi: Math.max(...frets), startNote: marks[0].label ?? '' });
  }
  return out.sort((a, b) => a.lo - b.lo || a.hi - b.hi);
}

// ---------------------------------------------------------------- CAGED

/** Open-position major chords as fret per string (low E to high e), -1 = muted. */
export const CAGED_SHAPES: Record<'C' | 'A' | 'G' | 'E' | 'D', { frets: number[]; rootPc: number }> = {
  C: { frets: [-1, 3, 2, 0, 1, 0], rootPc: 0 },
  A: { frets: [-1, 0, 2, 2, 2, 0], rootPc: 9 },
  G: { frets: [3, 2, 0, 0, 0, 3], rootPc: 7 },
  E: { frets: [0, 2, 2, 1, 0, 0], rootPc: 4 },
  D: { frets: [-1, -1, 0, 2, 3, 2], rootPc: 2 },
};

/** The CAGED shape moved so that it makes the major chord on `rootPc`. */
export function cagedAt(shape: keyof typeof CAGED_SHAPES, rootPc: number): { frets: number[]; shift: number } {
  const { frets, rootPc: base } = CAGED_SHAPES[shape];
  const shift = mod12(rootPc - base);
  return { shift, frets: frets.map((f) => (f < 0 ? -1 : f + shift)) };
}

/** Pitch class of the chord tones for a fret-per-string shape, as MIDI numbers (muted strings left out). */
export const midiOfShape = (frets: number[]) => frets.flatMap((f, s) => (f < 0 ? [] : [pitchAt(s, f)]));

// ---------------------------------------------------------------- harmonics

export interface HarmonicMode {
  k: number; // 1 = fundamental, 2 = the string split in two, ...
  amp: number; // |sin(k * pi * p)|: how much the mode wants to move where the finger rests (0 = a node is right there)
  alive: boolean; // true when a node sits under the finger, so the finger does not stop this mode
}

/** Fraction of the string length from the nut to fret n (equal temperament). */
export const fretFraction = (fret: number) => 1 - 2 ** (-fret / 12);

/**
 * Which of the first `modes` vibration patterns of a string survive a light touch above `fret`.
 * A pattern survives when it has a node (a point that never moves) under the finger. `tol` is how close to a node counts.
 * Fret 0 means no finger, so every pattern survives.
 */
export function harmonicsAt(fret: number, modes = 6, tol = 0.12): HarmonicMode[] {
  const p = fretFraction(fret);
  return Array.from({ length: modes }, (_, i) => {
    const k = i + 1;
    const amp = Math.abs(Math.sin(k * Math.PI * p));
    return { k, amp, alive: amp < tol };
  });
}
