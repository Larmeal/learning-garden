import { useState } from 'react';
import { Legend, Lines } from '../iceberg/ib';
import type { Lang } from '../spark/stepper';
import { NOW, SECRET, claims, expectedSig, signHs256 } from './jwt.ts';
import { b64url, utf8 } from './sha256.ts';

// Shows:      a real HS256 token in its three parts, an attacker's edit of the payload, and what two verifiers do with it: a careful one (a fixed list of
//             algorithms, then the signature, then the expiry) and a naive one (it believes the alg written in the token, and never reads exp).
// Because:    "the payload is readable but cannot be changed" and "never trust the alg in the token" are claims about bytes, and the signature really is
//             recomputed in the browser on every click.
// Control:    the role in the payload (user, admin), the signature the attacker attaches (the old one, a fresh one signed with the secret, none with alg none),
//             how old the token is (fresh, expired) and the verifier (careful, naive). Each change recomputes the token and the verdict.
// Conclusion: editing the payload without the key breaks the signature; a naive verifier can be talked into skipping the check with alg none or an
//             old token; a careful one refuses both.
//
// The token of the default setting is the one exercises/06_jwt.py prints (checked byte for byte by verify_jwt.mts). The refusal messages are those of jwtlib.py.

type Sig = 'old' | 'fresh' | 'none';
type Ver = 'careful' | 'naive';

const TEXT: Record<Lang, {
  title: string; role: string; sig: string; sigs: Record<Sig, string>; age: string; ages: [string, string]; ver: string; vers: Record<Ver, string>;
  header: string; payload: string; signature: string; legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[]; expected: string; given: string; same: string; diff: string; accepted: string; refused: string;
  who: (r: string) => string; shouldNot: string; readable: string; reasons: Record<string, string>; caption: string; none: string;
}> = {
  th: {
    title: 'แก้ Payload ของ Token แล้วเลือกลายเซ็นที่ผู้โจมตีแนบ และชนิดของตัวตรวจ ดูว่า Server รับหรือปฏิเสธ (ลายเซ็นคำนวณจริงในหน้านี้)',
    role: 'role ใน Payload', sig: 'ลายเซ็นที่แนบ', sigs: { old: 'ใช้ของเดิม (ไม่มี Key)', fresh: 'เซ็นใหม่ด้วย Secret', none: 'ไม่มี (alg: none)' }, age: 'อายุของ Token', ages: ['ยังสด', 'หมดอายุแล้ว'],
    ver: 'ตัวตรวจ', vers: { careful: 'รัดกุม', naive: 'เชื่อ Token' },
    header: 'Header', payload: 'Payload (ใครก็อ่านได้)', signature: 'Signature', legend: [{ kind: 'new', text: 'Server รับ' }, { kind: 'use', text: 'ส่วนของ Token' }],
    expected: 'ที่ Server คำนวณ', given: 'ที่ Token ให้มา', same: 'ตรงกัน', diff: 'ไม่ตรง', accepted: 'รับ Token', refused: 'ปฏิเสธ Token',
    who: (r) => `Server จะเห็น role = ${r}`, shouldNot: 'Token นี้ไม่ควรถูกรับ ตัวตรวจแบบเชื่อ Token พลาดไปแล้ว', readable: 'อ่าน Payload ได้โดยไม่ต้องมี Key แต่แก้แล้วลายเซ็นไม่ตรง',
    reasons: { ok: 'ลายเซ็นถูก และ Token ยังไม่หมดอายุ', 'bad signature': 'ลายเซ็นไม่ตรง (bad signature)', "algorithm 'none' is not allowed": "ตัวตรวจรัดกุมไม่ยอมรับ alg none เพราะไม่อยู่ในรายการที่ Server ตั้งไว้", 'token expired': 'ลายเซ็นถูก แต่ Token หมดอายุ (token expired)', naiveNone: 'ตัวตรวจแบบเชื่อ Token เห็น alg none แล้วข้ามการตรวจลายเซ็นไปเลย', naiveOld: 'ตัวตรวจแบบเชื่อ Token ไม่อ่าน exp จึงรับ Token ที่หมดอายุแล้ว' },
    caption: 'Token ตอนตั้งค่าเริ่มต้นเท่ากับที่แบบฝึก 06 พิมพ์ทุกไบต์ (ตรวจใน verify_jwt.mts) ข้อความปฏิเสธมาจาก jwtlib.py ส่วน alg confusion ด้วย Public Key ของ RSA รันใน Python ไม่ได้ทำซ้ำในแล็บนี้',
    none: '(ว่าง)',
  },
  en: {
    title: 'Edit the payload of a token, pick the signature the attacker attaches and the kind of verifier, and see whether the server accepts it (the signature is computed for real on this page)',
    role: 'role in the payload', sig: 'signature attached', sigs: { old: 'the old one (no key)', fresh: 'signed fresh with the secret', none: 'none (alg: none)' }, age: 'age of the token', ages: ['fresh', 'expired'],
    ver: 'verifier', vers: { careful: 'careful', naive: 'trusting the token' },
    header: 'Header', payload: 'Payload (anyone can read it)', signature: 'Signature', legend: [{ kind: 'new', text: 'the server accepts' }, { kind: 'use', text: 'a part of the token' }],
    expected: 'the server computes', given: 'the token gives', same: 'equal', diff: 'different', accepted: 'token accepted', refused: 'token refused',
    who: (r) => `The server will see role = ${r}`, shouldNot: 'This token should not have been accepted. The trusting verifier was fooled.', readable: 'The payload can be read without a key, but once it is changed the signature no longer matches',
    reasons: { ok: 'the signature is right and the token has not expired', 'bad signature': 'the signature does not match (bad signature)', "algorithm 'none' is not allowed": "the careful verifier refuses alg none, because it is not on the server's own list", 'token expired': 'the signature is right but the token has expired (token expired)', naiveNone: 'the trusting verifier sees alg none and skips the signature check altogether', naiveOld: 'the trusting verifier never reads exp, so it accepts an expired token' },
    caption: 'With the default setting the token equals, byte for byte, the one exercise 06 prints (checked in verify_jwt.mts). The refusal messages come from jwtlib.py. The algorithm confusion with an RSA public key ran in Python and is not repeated in this lab.',
    none: '(empty)',
  },
};

export default function JwtLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [sig, setSig] = useState<Sig>('old');
  const [expired, setExpired] = useState(false);
  const [ver, setVer] = useState<Ver>('careful');

  const header = sig === 'none' ? { alg: 'none', typ: 'JWT' } : { alg: 'HS256', typ: 'JWT' };
  const cur = signHs256(claims(role), SECRET, header);
  const orig = signHs256(claims('user'), SECRET);
  const head = cur.head, body = cur.body;
  const given = sig === 'none' ? '' : sig === 'old' ? orig.sig : cur.sig;
  const expected = expectedSig(head, body, SECRET);
  const match = given === expected;
  const nowT = NOW + (expired ? 901 : 10);

  let ok = false, reason = '';
  if (ver === 'careful') {
    if (header.alg !== 'HS256') reason = "algorithm 'none' is not allowed";
    else if (!match) reason = 'bad signature';
    else if (nowT >= NOW + 900) reason = 'token expired';
    else { ok = true; reason = 'ok'; }
  } else if (header.alg === 'none') { ok = true; reason = 'naiveNone'; }
  else if (!match) reason = 'bad signature';
  else { ok = true; reason = expired ? 'naiveOld' : 'ok'; }

  const bad = ok && reason.startsWith('naive');
  const short = (s: string) => (s.length > 34 ? s.slice(0, 34) + '…' : s || T.none);
  const seg = (x: number, w: number, title: string, text: string, cls: string) => (
    <g>
      <text x={x} y={34} className="ib-n" style={{ fontWeight: 700 }}>{title}</text>
      <rect className={cls} x={x} y={46} width={w} height={74} rx={9} />
      <text x={x + 10} y={78} className="ib-m" style={{ fontSize: 14 }}>{text.slice(0, 26)}</text>
      <text x={x + 10} y={100} className="ib-m" style={{ fontSize: 14 }}>{text.slice(26, 52)}{text.length > 52 ? '…' : ''}</text>
    </g>
  );
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls" style={{ flexWrap: 'wrap' }}>
        <span className="ib-lbl">{T.role}</span>
        <span className="seg" role="group" aria-label={T.role}>
          {(['user', 'admin'] as const).map((r) => <button key={r} type="button" aria-pressed={role === r} onClick={() => setRole(r)}>{r}</button>)}
        </span>
        <span className="ib-lbl">{T.sig}</span>
        <span className="seg" role="group" aria-label={T.sig} style={{ flexWrap: 'wrap' }}>
          {(['old', 'fresh', 'none'] as Sig[]).map((r) => <button key={r} type="button" aria-pressed={sig === r} onClick={() => setSig(r)}>{T.sigs[r]}</button>)}
        </span>
      </div>
      <div className="ib-controls" style={{ flexWrap: 'wrap' }}>
        <span className="ib-lbl">{T.age}</span>
        <span className="seg" role="group" aria-label={T.age}>
          {[false, true].map((e) => <button key={String(e)} type="button" aria-pressed={expired === e} onClick={() => setExpired(e)}>{T.ages[e ? 1 : 0]}</button>)}
        </span>
        <span className="ib-lbl">{T.ver}</span>
        <span className="seg" role="group" aria-label={T.ver}>
          {(['careful', 'naive'] as Ver[]).map((r) => <button key={r} type="button" aria-pressed={ver === r} onClick={() => setVer(r)}>{T.vers[r]}</button>)}
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 430" role="img" aria-label={T.title}>
          {seg(14, 270, T.header, head, 'ib-use')}
          {seg(300, 330, T.payload, body, 'ib-use')}
          {seg(646, 220, T.signature, given || '', 'ib-use')}
          <text x={300} y={144} className="ib-s">{`${JSON.stringify({ role })}  ·  exp = iat + 900`}</text>
          {/* the check */}
          <rect className="ib-zone" x={14} y={160} width={852} height={96} rx={12} />
          <text x={30} y={190} className="ib-s">{`HMAC-SHA256(secret, header.payload) → ${T.expected}`}</text>
          <text x={30} y={216} className="ib-m" style={{ fontSize: 15 }}>{short(expected)}</text>
          <text x={30} y={242} className="ib-s">{`${T.given}`}</text>
          <text x={190} y={242} className="ib-m" style={{ fontSize: 15 }}>{short(given)}</text>
          <text x={560} y={216} className={match ? 'ib-ok ib-n' : 'ib-bad ib-n'} style={{ fontWeight: 700, fontSize: 20 }}>{match ? `✓ ${T.same}` : `✗ ${T.diff}`}</text>
          {/* the verdict */}
          <rect className={ok && !bad ? 'ib-new' : 'ib-node'} x={14} y={276} width={852} height={138} rx={12} style={ok && !bad ? undefined : { stroke: 'var(--ib-bad)', strokeWidth: 3 }} />
          <text x={32} y={310} className={ok && !bad ? 'ib-ok ib-n' : 'ib-bad ib-n'} style={{ fontWeight: 700, fontSize: 22 }}>{`${ok && !bad ? '✓' : '✗'} ${ok ? T.accepted : T.refused}   (${T.vers[ver]})`}</text>
          <Lines x={32} y={342} text={T.reasons[reason]} max={lang === 'th' ? 78 : 94} className="ib-n" />
          <text x={32} y={392} className="ib-s">{bad ? T.shouldNot : ok ? T.who(role) : T.readable}</text>
        </svg>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
