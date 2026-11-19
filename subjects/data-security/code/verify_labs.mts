// Checks that the TypeScript used by the Data Security labs (peopleLib.ts and the hashes of PseudonymLab) gives the same numbers that the Python exercises assert.
// Run from the repo root: node subjects/data-security/code/verify_labs.mts   (Node 22.18 or newer, it strips the types itself)

import { createHash, createHmac } from 'node:crypto';
import { hex, hmacSha256, sha256, utf8 } from '../../../site/src/components/labs/app-security/sha256.ts';
import { DIA, N, ROWS, aloneAt, candidates, kGroups, link } from '../../../site/src/components/labs/data-security/peopleLib.ts';

let ok = 0;
function check(message: string, cond: boolean) {
  if (!cond) { console.log(`  FAIL ${message}`); process.exit(1); }
  console.log(`  ok   ${message}`);
  ok++;
}

check('the lab data holds 2,000 people and 1,413 of them are on the voter list (exercise 03)', N === 2000 && ROWS.filter((r) => r[6] === 1).length === 1413);

// lesson 1: people alone in their group after sex, zip, birth year, month, day (exercise 01)
check('people alone after 1 to 5 facts: 0, 0, 450, 1,757, 1,992 (exercise 01)', [1, 2, 3, 4, 5].map(aloneAt).join() === '0,0,450,1757,1992');

// lesson 3: the join with the voter list (exercise 03)
const exact = link('day', 5);
check('exact values: 1,410 rows named, 1,409 of them right (exercise 03)', exact.named === 1410 && exact.right === 1409);
check('month and year 1,294; year only 502; year and a 3 digit zip 273; year and a 2 digit zip 0 (exercise 03)', [link('month', 5).right, link('year', 5).right, link('year', 3).right, link('year', 2).right].join() === '1294,502,273,0');
check('year only names 711 rows, 502 of them right (exercise 03)', link('year', 5).named === 711);
check('2 digit zip with the full birth date still names 1,363 rows correctly (exercise 03)', link('day', 2).right === 1363);
check('a voter is always among his own candidates, and with no key at all every voter is a candidate (1,413)', ROWS.slice(0, 300).every((r, i) => !r[6] || candidates(i, 'day', 5).includes(i)) && candidates(0, 'none', 0, false).length === 1413);

// lesson 4: k-anonymity groups (exercise 04)
const cut = (band: number, zd: number, k: number) => kGroups(band, zd).filter((g) => g.members.length < k).reduce((s, g) => s + g.members.length, 0);
check('exact year and a 5 digit zip: 1,037 groups, 1,872 people in groups smaller than 5 (exercise 04)', kGroups(1, 5).length === 1037 && cut(1, 5, 5) === 1872);
check('5 year bands and a 3 digit zip: 38 people must be cut to reach k = 5 (exercise 04)', cut(5, 3, 5) === 38);
check('10 year bands and a 3 digit zip: 10 people cut, 1,990 kept (exercise 04)', cut(10, 3, 5) === 10);
const kept = kGroups(10, 3).filter((g) => g.members.length >= 5);
const same = kept.filter((g) => g.homogeneous);
check('10 year bands, 3 digit zip, k = 5: 5 groups where everybody has one diagnosis, 62 people (exercise 04)', same.length === 5 && same.reduce((s, g) => s + g.members.length, 0) === 62);
check('the groups cover every person exactly once', kGroups(10, 3).reduce((s, g) => s + g.members.length, 0) === N && ROWS.every((r) => r[DIA] >= 0));

// lesson 2: the hashes that PseudonymLab shows are real SHA-256 and HMAC (here against Node's own crypto)
const email = 'ann.stone1@mail.test';
check('PseudonymLab plain hash equals node:crypto sha256', hex(sha256(utf8(email))) === createHash('sha256').update(email).digest('hex'));
check('PseudonymLab HMAC equals node:crypto hmac', hex(hmacSha256(utf8('the-teams-secret-key'), utf8(email))) === createHmac('sha256', 'the-teams-secret-key').update(email).digest('hex'));

console.log(`\n${ok} checks`);
