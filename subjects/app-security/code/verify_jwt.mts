// Checks that jwt.ts (the token the JWT lab signs in the browser) gives byte for byte the token that exercises/06_jwt.py prints.
// Run from the repo root: node subjects/app-security/code/verify_jwt.mts

import { NOW, SECRET, claims, expectedSig, signHs256 } from '../../../site/src/components/labs/app-security/jwt.ts';

let ok = 0;
function check(message: string, cond: boolean) {
  if (!cond) { console.log('  FAIL ' + message); process.exit(1); }
  console.log('  ok   ' + message);
  ok++;
}

const tok = signHs256(claims('user'), SECRET);
check('the HS256 token equals the one 06_jwt.py prints', tok.token === 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhbm4iLCJyb2xlIjoidXNlciIsImlzcyI6Imh0dHBzOi8vc2hvcC50ZXN0IiwiYXVkIjoic2hvcC1hcGkiLCJpYXQiOjE4MDAwMDAwMDAsImV4cCI6MTgwMDAwMDkwMH0.fGWuPPx8hhpc8xR-j366npMM-StFwDk3DAWq-6NYVeM');
check('a payload with role admin does not match the old signature', expectedSig(tok.head, signHs256(claims('admin'), SECRET).body, SECRET) !== tok.sig);
check('the clock of the exercise is 1,800,000,000', NOW === 1_800_000_000);
console.log('\n' + ok + ' checks\nok');
