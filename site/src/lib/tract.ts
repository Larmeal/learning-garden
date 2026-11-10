// From the shape of the mouth and throat to formants, for the vocal tract lab. This is a simple model made for teaching:
// it is NOT an acoustic model of the tube. It puts the vowels on the plane of tongue height and tongue frontness (the vowel
// chart), then applies the effects that Davids and LaTour (chapter 4) and Titze (chapter 6) describe:
//   - a lower jaw raises F1, a tongue that is forward and high raises F2 and F3;
//   - a longer tract (low larynx, rounded protruding lips) lowers every formant, a shorter tract (high larynx, spread lips) raises them;
//   - a narrow epilarynx adds a peak near 3 kHz (the singer's formant, or "ring"); a lowered soft palate widens F1 and adds a nasal murmur.
// verify.mts checks that the five cardinal vowel poses land near the Peterson and Barney averages.

import type { Sex } from './voice';

export interface Pose {
  /** 0 closed .. 1 wide open */
  jaw: number;
  /** highest point of the tongue: 0 low .. 1 near the palate */
  height: number;
  /** 0 back of the mouth .. 1 front of the mouth */
  front: number;
  /** -1 lips spread (smile) .. 0 natural .. +1 rounded and pushed forward */
  lip: number;
  /** -1 low larynx (yawn) .. 0 neutral .. +1 high larynx (swallow) */
  larynx: number;
  /** 0 soft palate raised (nose closed) .. 1 lowered (air goes through the nose) */
  velum: number;
  /** 0 wide epilarynx tube .. 1 narrow (gives the singer's formant) */
  epi: number;
}

export const NEUTRAL: Pose = { jaw: 0.4, height: 0.5, front: 0.5, lip: 0, larynx: 0, velum: 0, epi: 0 };

// the four corner vowels i (high front), æ (low front), ɑ (low back), u (high back): F1, F2, F3 (Peterson and Barney men / women)
const CORNERS: Record<Sex, Record<'i' | 'ae' | 'a' | 'u', [number, number, number]>> = {
  male: { i: [270, 2290, 3010], ae: [660, 1720, 2410], a: [730, 1090, 2440], u: [300, 870, 2240] },
  female: { i: [310, 2790, 3310], ae: [860, 2050, 2850], a: [850, 1220, 2810], u: [370, 950, 2670] },
};

/** the jaw that goes with a tongue height when nothing else is asked for (a low tongue goes with an open jaw) */
export const jawFor = (height: number) => 0.12 + 0.7 * (1 - height);

/** tract length in cm: 17.5 is the uniform tube of Titze (men); a low larynx adds up to 1 cm, protruding lips up to 0.8 cm */
export const tractLength = (p: Pose, sex: Sex = 'male') => (sex === 'male' ? 17.5 : 14.8) * (1 - 0.057 * p.larynx + 0.045 * p.lip);

export function tractFormants(p: Pose, sex: Sex = 'male'): number[] {
  const c = CORNERS[sex];
  const { height: h, front: f } = p;
  const mix = (k: 0 | 1 | 2) => (1 - h) * (1 - f) * c.a[k] + (1 - h) * f * c.ae[k] + h * f * c.i[k] + h * (1 - f) * c.u[k];
  let f1 = mix(0);
  let f2 = mix(1);
  let f3 = mix(2);
  // a jaw that is more open (or less) than usual for this tongue height moves F1 the same way
  f1 *= 1 + 0.3 * (p.jaw - jawFor(h));
  // rounding lowers F2 most, spreading raises it
  f1 *= 1 - 0.08 * p.lip;
  f2 *= 1 - 0.2 * p.lip;
  f3 *= 1 - 0.08 * p.lip;
  const base = sex === 'male' ? 17.5 : 14.8;
  const scale = base / tractLength(p, sex);
  const upper = sex === 'male' ? [3500, 4500] : [4200, 5000];
  return [f1, f2, f3, ...upper].map((x) => x * scale);
}

/** the ring (singer's formant) that a narrow epilarynx adds: a bump of up to 14 dB near 2.8 kHz (men) or 3.3 kHz (women) */
export function tractRing(p: Pose, sex: Sex = 'male'): { db: number; hz: number } | undefined {
  return p.epi > 0.02 ? { db: 14 * p.epi, hz: sex === 'male' ? 2800 : 3300 } : undefined;
}

/** how rounded (+) or spread (-) the lips look for a pose: the lip control plus what the vowel itself asks for (u rounds, i spreads) */
export const lipShape = (p: Pose) => Math.max(-1, Math.min(1, p.lip + (1 - p.front) * (0.15 + 0.55 * p.height) - 0.5 * p.front * p.height));

// Poses for the five cardinal vowels of the book (found by searching the model for the closest match to the table; verify.mts checks them).
export const POSE_OF: Record<string, Pose> = {
  i: { ...NEUTRAL, jaw: 0.15, height: 1, front: 1 },
  e: { ...NEUTRAL, jaw: 0.44, height: 0.55, front: 0.95, lip: 0.1 },
  ɑ: { ...NEUTRAL, jaw: 0.82, height: 0, front: 0 },
  o: { ...NEUTRAL, jaw: 0.4, height: 0.6, front: 0, lip: 0.2 },
  u: { ...NEUTRAL, jaw: 0.12, height: 1, front: 0 },
};
