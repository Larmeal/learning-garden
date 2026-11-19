import { useState } from 'react';
import { Key } from '../data-security/ds';
import { Figure, Seal } from './bits';
import { Lines } from '../iceberg/ib';
import type { Lang } from '../spark/stepper';
import { NOW, SECRET, claims, expectedSig, signHs256 } from './jwt.ts';
import { hex, sha256, utf8 } from './sha256.ts';

// Shows:      a real HS256 token as a ticket with three panels (header, payload decoded so that it can be read, signature as a seal), an attacker who edits the payload, and a clerk at the
//             server's desk who works out the seal himself and puts it beside the one on the ticket. Under the desk, the three questions the verifier asks (is the algorithm on our list, does the
//             seal match, has it expired) light up one by one, and a careful verifier and a naive one (it believes the alg written in the token and never reads exp) can be compared.
// Because:    "the payload is readable but cannot be changed" and "never trust the alg in the token" are claims about bytes. Two seals that either look the same or do not, and a question that
//             the naive verifier simply never asks, make the claims visible. The signature is really recomputed in the browser on every click.
// Control:    the role in the payload (user, admin), the signature the attacker attaches (the old one, a fresh one signed with the secret, none with alg none), how old the token is (fresh,
//             expired) and the verifier (careful, naive). Each change recomputes the token and the verdict.
// Conclusion: editing the payload without the key breaks the seal; a naive verifier can be talked into skipping the check with alg none or an old token; a careful one refuses both.
//
// The token of the default setting is the one exercises/06_jwt.py prints (checked byte for byte by verify_jwt.mts). The refusal messages are those of jwtlib.py. The seal is a drawing of the
// first bytes of the signature.

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

const NEW: Record<Lang, { attacker: string; edits: (r: string) => string; ticket: string; readable: string; desk: string; works: string; onTicket: string; eq: string; ne: string; q: [string, string, string]; skipped: string; sealNone: string }> = {
  th: { attacker: 'ผู้โจมตี', edits: (r) => `แก้ Role เป็น ${r}`, ticket: 'Token ที่ถูกส่งมา', readable: 'ใครก็อ่านได้ ไม่ต้องใช้ Key', desk: 'โต๊ะตรวจของ Server', works: 'Server คำนวณตราเอง', onTicket: 'ตราบน Token', eq: 'ตรงกัน', ne: 'ไม่ตรง',
    q: ['Alg อยู่ในรายการที่ Server ตั้งไว้?', 'ตราตรงกับที่คำนวณเอง?', 'ยังไม่หมดอายุ?'], skipped: 'ไม่ได้ถาม', sealNone: '(ไม่มีตรา)' },
  en: { attacker: 'Attacker', edits: (r) => `changes role to ${r}`, ticket: 'the token that arrives', readable: 'anyone can read it, no key needed', desk: "the server's desk", works: 'the server works out the seal', onTicket: 'the seal on the token', eq: 'equal', ne: 'different',
    q: ["is the alg on the server's own list?", 'does the seal match the one worked out?', 'has it not expired?'], skipped: 'not asked', sealNone: '(no seal)' },
};

export default function JwtLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const N = NEW[lang];
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
  const algOk = header.alg === 'HS256';
  const expOk = nowT < NOW + 900;

  // the three questions of the verifier: 'yes' (passes), 'no' (stops here), 'skip' (never asked)
  type St = 'yes' | 'no' | 'skip';
  let q: [St, St, St];
  let ok = false, reason = '';
  if (ver === 'careful') {
    if (!algOk) { q = ['no', 'skip', 'skip']; reason = "algorithm 'none' is not allowed"; }
    else if (!match) { q = ['yes', 'no', 'skip']; reason = 'bad signature'; }
    else if (!expOk) { q = ['yes', 'yes', 'no']; reason = 'token expired'; }
    else { q = ['yes', 'yes', 'yes']; ok = true; reason = 'ok'; }
  } else if (header.alg === 'none') { q = ['skip', 'skip', 'skip']; ok = true; reason = 'naiveNone'; }
  else if (!match) { q = ['skip', 'no', 'skip']; reason = 'bad signature'; }
  else { q = ['skip', 'yes', 'skip']; ok = true; reason = expired ? 'naiveOld' : 'ok'; }
  const bad = ok && reason.startsWith('naive');
  const R = 'var(--ib-bad)', A = 'var(--accent)';
  const seal = (x: string) => (x ? hex(sha256(utf8(x))) : '');
  const hexOf = (x: string) => seal(x).slice(0, 10);
  const tone = (st: St) => (st === 'no' ? R : st === 'yes' ? A : 'var(--line)');
  const doing = [role === 'admin' ? N.edits(role) : '', sig === 'fresh' ? T.sigs.fresh : sig === 'none' ? T.sigs.none : ''].filter(Boolean).join('  ·  ');
  return (
    <figure className="viz ib-fig lg">
      <div className="viz-title">{T.title}</div>
      <Key items={[{ color: A, text: T.legend[0].text }, { color: R, text: lang === 'th' ? 'ตรวจไม่ผ่าน หรือพลาดไป' : 'fails, or was fooled' }]} />
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
        <svg viewBox="0 0 880 650" role="img" aria-label={T.title}>
          {/* the attacker and the ticket */}
          <Figure cx={24} cy={20} r={9} fill={R} />
          <text x={48} y={34} className="ib-n" style={{ fontWeight: 700, fontSize: 16, fill: R }}>{doing ? `${N.attacker}: ${doing}` : N.attacker}</text>
          <rect x={10} y={48} width={860} height={176} rx={14} fill="var(--surface)" stroke="var(--line-strong)" strokeWidth={2.5} />
          <text x={858} y={70} textAnchor="end" className="ib-s" style={{ fontSize: 13.5 }}>{`🎫 ${N.ticket}`}</text>
          {/* header */}
          <rect x={22} y={80} width={250} height={132} rx={10} fill="var(--accent-soft)" stroke="var(--line-strong)" strokeWidth={1.5} />
          <text x={34} y={102} className="ib-s" style={{ fontSize: 13.5 }}>{T.header}</text>
          <text x={34} y={132} className="ib-m" style={{ fontSize: 16, fontWeight: 700, fill: header.alg === 'none' ? R : 'var(--fg)' }}>{`alg: ${header.alg}`}</text>
          <text x={34} y={158} className="ib-m" style={{ fontSize: 16 }}>{'typ: JWT'}</text>
          <text x={34} y={196} className="ib-m" style={{ fontSize: 12, fill: 'var(--muted)' }}>{head.slice(0, 26)}…</text>
          {/* payload */}
          <rect x={284} y={80} width={330} height={132} rx={10} fill="var(--accent-soft)" stroke={role === 'admin' ? R : 'var(--line-strong)'} strokeWidth={role === 'admin' ? 3 : 1.5} />
          <text x={296} y={102} className="ib-s" style={{ fontSize: 13.5 }}>{`${T.payload.split(' (')[0]}  ·  ${N.readable}`}</text>
          <text x={296} y={130} className="ib-m" style={{ fontSize: 16 }}>sub: ann</text>
          <text x={296} y={154} className="ib-m" style={{ fontSize: 16, fontWeight: 700, fill: role === 'admin' ? R : 'var(--fg)' }}>{`role: ${role}`}</text>
          <text x={296} y={178} className="ib-m" style={{ fontSize: 16 }}>{'exp: iat + 900 s'}</text>
          <text x={296} y={202} className="ib-m" style={{ fontSize: 12, fill: 'var(--muted)' }}>{body.slice(0, 40)}…</text>
          {/* signature */}
          <rect x={626} y={80} width={232} height={132} rx={10} fill="var(--accent-soft)" stroke="var(--line-strong)" strokeWidth={1.5} />
          <text x={638} y={102} className="ib-s" style={{ fontSize: 13.5 }}>{T.signature}</text>
          {given ? (
            <g>
              <Seal x={640} y={118} hex={seal(given)} cell={22} />
              <text x={640} y={202} className="ib-m" style={{ fontSize: 13 }}>{`${hexOf(given)}…`}</text>
            </g>
          ) : (
            <g>
              <rect x={640} y={118} width={88} height={44} rx={6} fill="none" stroke="var(--muted)" strokeWidth={2} strokeDasharray="6 5" />
              <text x={640} y={190} className="ib-s" style={{ fontSize: 14 }}>{N.sealNone}</text>
            </g>
          )}
          {/* the clerk's desk: two seals side by side */}
          <rect x={10} y={242} width={860} height={118} rx={14} fill="var(--surface)" stroke="var(--line-strong)" strokeWidth={2.5} />
          <Figure cx={40} cy={270} r={11} />
          <text x={62} y={278} className="ib-n" style={{ fontWeight: 700, fontSize: 16 }}>{N.desk}</text>
          <text x={34} y={316} className="ib-s" style={{ fontSize: 13.5 }}>{N.works}</text>
          <text x={34} y={338} className="ib-m" style={{ fontSize: 12, fill: 'var(--muted)' }}>HMAC-SHA256(secret, header.payload)</text>
          <Seal x={330} y={296} hex={seal(expected)} cell={18} />
          <text x={330} y={350} className="ib-m" style={{ fontSize: 13 }}>{`${hexOf(expected)}…`}</text>
          <text x={470} y={316} textAnchor="middle" style={{ fontSize: 34, fontWeight: 700, fill: match ? A : R }}>{match ? '=' : '≠'}</text>
          <text x={470} y={348} textAnchor="middle" className="ib-s" style={{ fontSize: 13.5 }}>{match ? N.eq : N.ne}</text>
          <text x={560} y={290} className="ib-s" style={{ fontSize: 13.5 }}>{N.onTicket}</text>
          {given ? (
            <g>
              <Seal x={560} y={296} hex={seal(given)} cell={18} />
              <text x={560} y={350} className="ib-m" style={{ fontSize: 13 }}>{`${hexOf(given)}…`}</text>
            </g>
          ) : <text x={560} y={330} className="ib-s" style={{ fontSize: 14 }}>{N.sealNone}</text>}
          {/* the three questions */}
          {N.q.map((text, i) => {
            const st = q[i];
            const x = 10 + i * 292;
            return (
              <g key={i} opacity={st === 'skip' ? 0.55 : 1}>
                <rect x={x} y={376} width={276} height={92} rx={12} fill="var(--surface)" stroke={tone(st)} strokeWidth={st === 'skip' ? 2 : 3.5} strokeDasharray={st === 'skip' ? '7 5' : undefined} />
                <circle cx={x + 26} cy={402} r={14} fill={tone(st)} />
                <text x={x + 26} y={408} textAnchor="middle" style={{ fontSize: 15, fontWeight: 700, fill: '#fff' }}>{i + 1}</text>
                <foreignObject x={x + 48} y={386} width={218} height={50}><div style={{ fontSize: 14, lineHeight: 1.3 }}>{text}</div></foreignObject>
                <text x={x + 14} y={456} style={{ fontSize: 15, fontWeight: 700, fill: st === 'no' ? R : st === 'yes' ? A : 'var(--muted)' }}>{st === 'yes' ? '✓' : st === 'no' ? '✗' : `– ${N.skipped}`}</text>
              </g>
            );
          })}
          {/* the door */}
          <rect x={10} y={484} width={860} height={152} rx={14} fill={ok && !bad ? 'color-mix(in srgb, var(--accent) 10%, var(--surface))' : 'color-mix(in srgb, var(--ib-bad) 10%, var(--surface))'} stroke={ok && !bad ? A : R} strokeWidth={3.5} />
          <text x={32} y={522} style={{ fontSize: 22, fontWeight: 700, fill: ok && !bad ? A : R }}>{`${ok && !bad ? '✓' : '✗'} ${ok ? T.accepted : T.refused}   (${T.vers[ver]})`}</text>
          <Lines x={32} y={554} text={T.reasons[reason]} max={lang === 'th' ? 78 : 94} className="ib-n" />
          <text x={32} y={614} className="ib-s" style={{ fontSize: 15 }}>{bad ? T.shouldNot : ok ? T.who(role) : T.readable}</text>
        </svg>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
