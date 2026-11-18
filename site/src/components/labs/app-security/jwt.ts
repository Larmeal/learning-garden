import { b64url, hmacSha256, utf8 } from './sha256.ts';

// The same HS256 token as subjects/app-security/code/jwtlib.py, in TypeScript, so the JWT lab signs and checks for real in the browser.
// verify_jwt.mts checks that signHs256 gives byte for byte the token that exercises/06_jwt.py prints.

export const SECRET = 'a-long-random-secret-of-at-least-32-bytes!!';
export const NOW = 1_800_000_000;

export type Claims = { sub: string; role: string; iss: string; aud: string; iat: number; exp: number };
export const claims = (role: string): Claims => ({ sub: 'ann', role, iss: 'https://shop.test', aud: 'shop-api', iat: NOW, exp: NOW + 900 });

const enc = (o: object) => b64url(utf8(JSON.stringify(o)));

export function signHs256(payload: object, secret: string, header: object = { alg: 'HS256', typ: 'JWT' }) {
  const head = enc(header);
  const body = enc(payload);
  const sig = b64url(hmacSha256(utf8(secret), utf8(`${head}.${body}`)));
  return { head, body, sig, token: `${head}.${body}.${sig}` };
}

export const expectedSig = (head: string, body: string, secret: string) => b64url(hmacSha256(utf8(secret), utf8(`${head}.${body}`)));
