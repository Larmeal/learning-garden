// The 2,000 synthetic people of the Data Security exercises (labPeople.json, written by exercises/12_lab_people.py) and the pure functions that group them.
// The labs of lessons 1, 3, 4 and 11 use these, so what a reader sees is the real table. `verify_labs.mts` runs the same functions in Node and checks the numbers
// that exercises 01, 03 and 04 assert. No DOM here.

import raw from './labPeople.json' with { type: 'json' };

export const N: number = raw.n;
export const ROWS = raw.rows as number[][];
export const NAMES = raw.names as string[];
export const ZIPS = raw.zips as string[];
export const DIAG = raw.diagnoses as string[];
export const FEATURED = raw.featured as number[];

// column positions in a row
export const SEX = 0, ZIP = 1, YEAR = 2, MONTH = 3, DAY = 4, DIA = 5, VOTER = 6;

// Facts are added in this order: sex, zip, birth year, birth month, birth day. `depth` is how many of them are known (0 to 5).
export const factKey = (r: number[], depth: number) => r.slice(0, depth).join('/');

export function groupSizes(depth: number): number[] {
  const count = new Map<string, number>();
  for (const r of ROWS) { const k = factKey(r, depth); count.set(k, (count.get(k) ?? 0) + 1); }
  return ROWS.map((r) => count.get(factKey(r, depth)) as number);
}

export const aloneAt = (depth: number) => groupSizes(depth).filter((s) => s === 1).length;

// The join of lesson 3: the attacker holds the voter list (people with VOTER = 1) and the table without names. A person is named when exactly one voter shares the keys.
export type Birth = 'day' | 'month' | 'year' | 'none';
const linkKey = (r: number[], birth: Birth, zipDigits: number, useSex: boolean) =>
  [zipDigits ? ZIPS[r[ZIP]].slice(0, zipDigits) : '', birth === 'day' ? `${r[YEAR]}-${r[MONTH]}-${r[DAY]}` : birth === 'month' ? `${r[YEAR]}-${r[MONTH]}` : birth === 'year' ? r[YEAR] : '', useSex ? r[SEX] : ''].join('|');

export interface LinkResult { named: number; right: number; status: Uint8Array } // status per person: 0 not named (no voter, or many), 1 named correctly, 2 named wrongly
export function link(birth: Birth, zipDigits: number, useSex = true): LinkResult {
  const voters = new Map<string, number[]>();
  ROWS.forEach((r, i) => { if (r[VOTER]) { const k = linkKey(r, birth, zipDigits, useSex); (voters.get(k) ?? voters.set(k, []).get(k)!).push(i); } });
  const status = new Uint8Array(N);
  let named = 0, right = 0;
  ROWS.forEach((r, i) => {
    const c = voters.get(linkKey(r, birth, zipDigits, useSex)) ?? [];
    if (c.length === 1) { named++; if (NAMES[c[0]] === NAMES[i]) { right++; status[i] = 1; } else status[i] = 2; }
  });
  return { named, right, status };
}

// The voters who share the join keys with person i (the people the attacker cannot tell apart from them).
export function candidates(i: number, birth: Birth, zipDigits: number, useSex = true): number[] {
  const k = linkKey(ROWS[i], birth, zipDigits, useSex);
  const out: number[] = [];
  ROWS.forEach((r, j) => { if (r[VOTER] && linkKey(r, birth, zipDigits, useSex) === k) out.push(j); });
  return out;
}

// The groups of lesson 4: people with the same (zip prefix, birth year band, sex) look the same to a reader of the released table.
export interface Group { key: string; members: number[]; homogeneous: boolean }
export function kGroups(band: number, zipDigits: number): Group[] {
  const g = new Map<string, number[]>();
  ROWS.forEach((r, i) => { const k = `${ZIPS[r[ZIP]].slice(0, zipDigits)}|${Math.floor(r[YEAR] / band) * band}|${r[SEX]}`; (g.get(k) ?? g.set(k, []).get(k)!).push(i); });
  return [...g.entries()].map(([key, members]) => ({ key, members, homogeneous: members.length > 1 && members.every((i) => ROWS[i][DIA] === ROWS[members[0]][DIA]) }));
}

// Pack the groups into blocks of squares, like a treemap: the biggest group first, each block as square as it can be, blocks laid in rows of a given width.
export interface Placed { g: Group; x: number; y: number; w: number; h: number; cols: number }
export function packGroups(groups: Group[], cell: number, gap: number, width: number): { placed: Placed[]; height: number } {
  const order = [...groups].sort((a, b) => b.members.length - a.members.length);
  const placed: Placed[] = [];
  let x = 0, y = 0, rowH = 0;
  for (const g of order) {
    const n = g.members.length;
    const cols = Math.max(1, Math.min(n, Math.ceil(Math.sqrt(n))));
    const rowsN = Math.ceil(n / cols);
    const w = cols * cell, h = rowsN * cell;
    if (x > 0 && x + w > width) { x = 0; y += rowH + gap; rowH = 0; }
    placed.push({ g, x, y, w, h, cols });
    x += w + gap;
    rowH = Math.max(rowH, h);
  }
  return { placed, height: y + rowH };
}
