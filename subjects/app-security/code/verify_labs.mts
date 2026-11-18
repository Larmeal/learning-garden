// Checks that the TypeScript used by the labs (sha256.ts, the JWT lab) gives the same answers as the Python exercises.
// Run from the repo root: node subjects/app-security/code/verify_labs.mts   (Node 22.18 or newer, it strips the types itself)

import { createHash, createHmac } from 'node:crypto';
import { bitDiff, hex, hmacSha256, sha256, utf8 } from '../../../site/src/components/labs/app-security/sha256.ts';

let ok = 0;
function check(message: string, cond: boolean) {
  if (!cond) { console.log(`  FAIL ${message}`); process.exit(1); }
  console.log(`  ok   ${message}`);
  ok++;
}

// the digests that 02_crypto_basics.py prints
check('sha256("") starts e3b0c442', hex(sha256(utf8(''))).startsWith('e3b0c44298fc1c14'));
check('sha256("hello") starts 2cf24dba', hex(sha256(utf8('hello'))).startsWith('2cf24dba5fb0a30e'));
check('sha256("pay bob 100") is aa843d83...', hex(sha256(utf8('pay bob 100'))) === 'aa843d8373c66e261809019ea8bc71ba2e951e1c378b4bf570e34679efac5f16');
check('sha256("pay bob 900") is 70ef8a24...', hex(sha256(utf8('pay bob 900'))) === '70ef8a2487a6d4838ab93b2842806ccf0b89cf56b209312e0761632e4899ea20');
check('the two differ in 133 of 256 bits (the number of the Python exercise)', bitDiff(sha256(utf8('pay bob 100')), sha256(utf8('pay bob 900'))) === 133);

// the HMAC of the exercise: key = 32 times "k"
const key = utf8('k'.repeat(32));
check('hmac-sha256 matches the Python tag e1b2db25...', hex(hmacSha256(key, utf8('pay bob 100'))) === 'e1b2db255689e506cbd5cbe3fd1fb6c4fb1537236abfcea5000d11586eb05104');

// and against Node's own implementation on odd lengths (padding edge cases at 55, 56, 63, 64 bytes)
for (const n of [0, 1, 55, 56, 63, 64, 65, 119, 120, 1000]) {
  const msg = 'x'.repeat(n);
  check(`sha256 of ${n} bytes equals Node's`, hex(sha256(utf8(msg))) === createHash('sha256').update(msg).digest('hex'));
}
check('hmac with a key longer than 64 bytes equals Node\'s', hex(hmacSha256(utf8('K'.repeat(100)), utf8('m'))) === createHmac('sha256', 'K'.repeat(100)).update('m').digest('hex'));
console.log(`\n${ok} checks\nok`);
