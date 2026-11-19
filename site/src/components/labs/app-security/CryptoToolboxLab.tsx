import { useState } from 'react';
import { Key } from '../data-security/ds';
import type { Lang } from '../spark/stepper';
import { Figure, Seal } from './bits';
import { hex, hmacSha256, sha256, utf8 } from './sha256';

// Shows:      one message sent from Alice to Bob as a parcel, four ways (a plain hash, an HMAC, AES-GCM, a signature), and Mallory in the middle doing one of three things to it
//             (reading it, changing it, forging a new one). The parcel Bob receives is drawn as it arrives, and Bob's check puts two seals side by side: the one he works out himself and
//             the one stuck on the parcel. Equal seals are accepted, different seals are refused.
// Because:    "hash, HMAC, encryption and signature" are four words for four promises. Seeing the same parcel with the same Mallory under four tools, and the seals that match or do not,
//             is what makes the table of twelve cells something you can remember. The twelve cells are computed by the same code as the picture, so they cannot disagree with it.
// Control:    the tool (4) and Mallory's move (3). Every part of the picture is recomputed from the two choices.
// Conclusion: only encryption hides the content. HMAC and a signature let Bob see a change and a forgery. A plain hash lets Mallory do all three without Bob noticing.
//
// The hash is a real SHA-256 and the HMAC a real HMAC-SHA256 (sha256.ts, checked against Node in verify_labs.mts), computed on this page with a made-up shared key. The AES-GCM ciphertext and the
// signature are stand-ins that behave the same way (they change when anything changes and Mallory cannot make a good one); the real AES-GCM and Ed25519 ran in exercises/02_crypto_basics.py.

type Tool = 'hash' | 'hmac' | 'aes' | 'sig';
type Move = 'read' | 'change' | 'forge';
const TOOLS: Tool[] = ['hash', 'hmac', 'aes', 'sig'];
const MOVES: Move[] = ['read', 'change', 'forge'];
const KEY = utf8('alice-bob-shared-key');
const h = (s: string) => hex(sha256(utf8(s)));

// what Alice (or whoever has the right to) attaches to a message under each tool
function stamp(tool: Tool, msg: string): string {
  if (tool === 'hash') return h(msg);
  if (tool === 'hmac') return hex(hmacSha256(KEY, utf8(msg)));
  if (tool === 'sig') return h(`ed25519-alice|${msg}`);
  return h(`aes-gcm|${msg}`);
}

const MSG: Record<Tool, { orig: string; changed: string; forged: string }> = {
  hash: { orig: 'pay bob 100', changed: 'pay bob 900', forged: 'pay mallory 1000' },
  hmac: { orig: 'pay bob 100', changed: 'pay bob 900', forged: 'pay mallory 1000' },
  aes: { orig: 'pay bob 100', changed: 'pay bob 100', forged: 'pay mallory 1000' },
  sig: { orig: 'release 1.4.2', changed: 'release 1.4.3', forged: 'release 6.6.6' },
};

function scenario(tool: Tool, move: Move) {
  const m = MSG[tool];
  const sent = { msg: m.orig, st: stamp(tool, m.orig) };
  let got = sent;
  if (move === 'change') {
    // a plain hash can be worked out again by Mallory; with a key he can only keep the old stamp (or, for encryption, flip a bit)
    const st = tool === 'hash' ? stamp('hash', m.changed) : tool === 'aes' ? h(`flipped|${sent.st}`) : sent.st;
    got = { msg: tool === 'aes' ? m.orig : m.changed, st };
  } else if (move === 'forge') {
    got = { msg: m.forged, st: tool === 'hash' ? stamp('hash', m.forged) : h(`guess|${m.forged}`) };
  }
  const expected = stamp(tool, got.msg);
  const accepted = expected === got.st;
  // does the promise hold? reading: only encryption hides the text. changing or forging: it holds when Bob refuses
  const holds = move === 'read' ? tool === 'aes' : !accepted;
  return { sent, got, expected, accepted, holds };
}

const TEXT: Record<Lang, {
  title: string; tool: string; move: string; tools: Record<Tool, [string, string]>; moves: Record<Move, string>; alice: string; bob: string; mallory: string;
  sends: string; receives: string; legend: { color: string; text: string; ring?: boolean }[]; outcome: Record<Tool, Record<Move, string>>; yes: string; no: string; table: string; caption: string;
  stickers: Record<Tool, string>; sees: string; cipher: string; unreadable: string; theSame: string; bobWorks: string; onParcel: string; equal: string; differ: string; accepted: string; refused: string; note: Record<Move, string>;
}> = {
  th: {
    title: 'เลือกเครื่องมือหนึ่งอย่างและสิ่งที่ Mallory ทำกับพัสดุของ Alice แล้วดูว่า Bob ที่รับของตรวจเจอไหม ตรามุมกล่องที่เหมือนกันคือผ่าน ที่ต่างกันคือถูกปฏิเสธ',
    tool: 'เครื่องมือ', move: 'Mallory ทำ',
    tools: { hash: ['Hash', 'SHA-256'], hmac: ['HMAC', 'ใช้ Key ร่วม'], aes: ['AES-GCM', 'เข้ารหัส'], sig: ['Signature', 'Ed25519'] },
    moves: { read: 'อ่านข้อความ', change: 'แก้ข้อความ', forge: 'ปลอมข้อความใหม่' },
    alice: 'Alice', bob: 'Bob', mallory: 'Mallory', sends: 'พัสดุที่ Alice ส่ง', receives: 'พัสดุที่ Bob ได้',
    legend: [{ color: 'var(--accent)', text: 'ป้องกันได้' }, { color: 'var(--ib-bad)', text: 'ไม่ได้ป้องกัน' }],
    stickers: { hash: 'Hash ติดมากับพัสดุ', hmac: 'Tag ติดมากับพัสดุ', aes: 'กล่องที่ล็อกแล้ว (Ciphertext)', sig: 'ลายเซ็นติดมากับพัสดุ' },
    sees: 'Mallory เห็น', cipher: 'ตัวอักษรมั่ว ๆ', unreadable: 'อ่านไม่ออก', theSame: 'พัสดุถึงมือ Bob ตามเดิม',
    bobWorks: 'Bob คำนวณเอง', onParcel: 'ที่ติดมากับพัสดุ', equal: 'ตรงกัน', differ: 'ไม่ตรง', accepted: 'Bob รับ', refused: 'Bob ปฏิเสธ',
    note: { read: 'Mallory แค่แอบดู ไม่ได้แตะพัสดุ', change: 'Mallory เปลี่ยนข้อความ แล้วส่งต่อ', forge: 'Mallory ทำพัสดุของตัวเองขึ้นมาใหม่' },
    outcome: {
      hash: {
        read: 'Mallory อ่านข้อความได้เต็ม ๆ เพราะ Hash ไม่ได้ซ่อนอะไร',
        change: 'Mallory แก้เป็น pay bob 900 แล้วคำนวณ Hash ใหม่เองได้ Bob ตรวจแล้วตรงกัน จึงไม่รู้ว่าถูกแก้',
        forge: 'ใครก็คำนวณ Hash ของข้อความตัวเองได้ Bob จึงแยกไม่ออกว่ามาจาก Alice จริงไหม',
      },
      hmac: {
        read: 'ข้อความอ่านได้ เพราะ HMAC ไม่ได้เข้ารหัส มันแค่ติด Tag ไว้',
        change: 'Mallory แก้ข้อความแล้วไม่มี Key จึงทำ Tag ใหม่ไม่ได้ Tag เดิมไม่ตรงกับข้อความใหม่ Bob จึงปฏิเสธ',
        forge: 'ไม่มี Key ก็ทำ Tag ที่ถูกต้องไม่ได้ ข้อความที่ปลอมมาจึงถูกปฏิเสธ',
      },
      aes: {
        read: 'Mallory เห็นแต่ตัวอักษรมั่ว ๆ (Ciphertext) อ่านไม่ออกถ้าไม่มี Key',
        change: 'บิตเดียวที่ถูกพลิกทำให้ถอดรหัสไม่ผ่าน (InvalidTag) Bob รู้ทันทีว่ามีการแก้',
        forge: 'ต้องใช้ Key จึงจะสร้างกล่องที่ผ่านการตรวจได้ Mallory จึงสร้างเองไม่ได้',
      },
      sig: {
        read: 'ข้อความอ่านได้ เพราะ Signature ไม่ได้เข้ารหัส มันแค่พิสูจน์ว่าใครเซ็น',
        change: 'ลายเซ็นเดิมบนข้อความที่ถูกแก้ ตรวจกับ Public Key แล้วไม่ผ่าน (InvalidSignature)',
        forge: 'ต้องมี Private Key จึงเซ็นได้ ใครมี Public Key ก็ตรวจได้ แต่เซ็นแทนไม่ได้',
      },
    },
    yes: '✓ ป้องกันได้', no: '✗ ไม่ได้ป้องกัน', table: 'ตารางทั้งสิบสองช่อง (คำนวณด้วยโค้ดเดียวกับภาพ)',
    caption: 'Hash กับ HMAC คำนวณจริงในหน้านี้ (HMAC ใช้ Key สมมติ) ส่วน Ciphertext และลายเซ็นในภาพเป็นตัวแทนที่ทำตัวเหมือนของจริง คือเปลี่ยนเมื่อมีอะไรเปลี่ยนและ Mallory ทำของถูกไม่ได้ AES-GCM กับ Ed25519 ตัวจริงรันในแบบฝึก 02 ช่องที่เป็น ✗ ไม่ได้แปลว่าเครื่องมือเสีย แต่แปลว่ามันไม่ได้สัญญาเรื่องนั้นไว้ตั้งแต่แรก',
  },
  en: {
    title: "Pick a tool and what Mallory does to Alice's parcel, and see whether Bob notices. Seals that look the same mean the parcel is accepted, seals that differ mean it is refused",
    tool: 'Tool', move: 'Mallory does',
    tools: { hash: ['Hash', 'SHA-256'], hmac: ['HMAC', 'shared key'], aes: ['AES-GCM', 'encryption'], sig: ['Signature', 'Ed25519'] },
    moves: { read: 'reads the message', change: 'changes the message', forge: 'forges a new one' },
    alice: 'Alice', bob: 'Bob', mallory: 'Mallory', sends: 'the parcel Alice sends', receives: 'the parcel Bob gets',
    legend: [{ color: 'var(--accent)', text: 'protected' }, { color: 'var(--ib-bad)', text: 'not protected' }],
    stickers: { hash: 'hash stuck on the parcel', hmac: 'tag stuck on the parcel', aes: 'the locked box (ciphertext)', sig: 'signature stuck on the parcel' },
    sees: 'Mallory sees', cipher: 'random looking bytes', unreadable: 'unreadable', theSame: 'the parcel reaches Bob unchanged',
    bobWorks: 'Bob works out', onParcel: 'on the parcel', equal: 'equal', differ: 'different', accepted: 'Bob accepts', refused: 'Bob refuses',
    note: { read: 'Mallory only looks, he does not touch the parcel', change: 'Mallory changes the message and passes it on', forge: 'Mallory makes a parcel of his own' },
    outcome: {
      hash: {
        read: 'Mallory reads the whole message, because a hash hides nothing',
        change: 'Mallory changes it to pay bob 900 and works out a new hash himself. Bob checks it, it matches, and he never knows',
        forge: 'Anyone can hash a message of their own, so Bob cannot tell whether it really came from Alice',
      },
      hmac: {
        read: 'The message is readable, because HMAC does not encrypt. It only adds a tag',
        change: 'Mallory changes the message and has no key, so he cannot make a new tag. The old tag does not fit the new message, so Bob refuses it',
        forge: 'Without the key a valid tag cannot be made, so a forged message is refused',
      },
      aes: {
        read: 'Mallory sees only random looking bytes (ciphertext) and cannot read them without the key',
        change: 'One flipped bit makes decryption fail (InvalidTag), so Bob knows at once that it was changed',
        forge: 'A box that passes the check needs the key, so Mallory cannot make one',
      },
      sig: {
        read: 'The message is readable, because a signature does not encrypt. It only proves who signed',
        change: 'The old signature on a changed message fails the check with the public key (InvalidSignature)',
        forge: 'Signing needs the private key. Anyone with the public key can check, but nobody can sign for Alice',
      },
    },
    yes: '✓ protected', no: '✗ not protected', table: 'all twelve cells (computed by the same code as the picture)',
    caption: 'The hash and the HMAC are computed for real on this page (the HMAC with a made up key). The ciphertext and the signature in the picture are stand-ins that behave the same way: they change when anything changes, and Mallory cannot make a good one. The real AES-GCM and Ed25519 ran in exercise 02. A ✗ does not mean the tool is broken. It means the tool never promised that.',
  },
};

const CW = 232;

export default function CryptoToolboxLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [tool, setTool] = useState<Tool>('hmac');
  const [move, setMove] = useState<Move>('change');
  const s = scenario(tool, move);
  const bad = 'var(--ib-bad)', acc = 'var(--accent)';
  const aes = tool === 'aes';
  const changedMsg = s.got.msg !== s.sent.msg;
  // a parcel: the message (or a locked box) with its seal on the corner
  const parcel = (x: number, p: { msg: string; st: string }, title: string, tone: 'plain' | 'bad', diffFrom?: string) => (
    <g>
      <rect x={x} y={70} width={CW} height={150} rx={12} fill="var(--surface)" stroke={tone === 'bad' ? bad : 'var(--line-strong)'} strokeWidth={tone === 'bad' ? 3 : 2} />
      <text x={x + 14} y={94} className="ib-s" style={{ fontSize: 13.5 }}>{title}</text>
      {aes ? (
        <g>
          <text x={x + 14} y={134} style={{ fontSize: 30 }}>🔒</text>
          <text x={x + 56} y={132} className="ib-m" style={{ fontSize: 15 }}>{p.st.slice(0, 8)}</text>
          <text x={x + 56} y={152} className="ib-m" style={{ fontSize: 15 }}>{p.st.slice(8, 16)}…</text>
        </g>
      ) : (
        <text x={x + 14} y={134} className="ib-m" style={{ fontSize: 17, fontWeight: 700 }}>
          {p.msg.split('').map((ch, i) => <tspan key={i} style={diffFrom && ch !== diffFrom[i] ? { fill: bad } : undefined}>{ch}</tspan>)}
        </text>
      )}
      <text x={x + 14} y={192} className="ib-s" style={{ fontSize: 13 }}>{T.stickers[tool]}</text>
      <Seal x={x + CW - 14 - 44} y={158} hex={p.st} cell={11} />
      <text x={x + 14} y={210} className="ib-m" style={{ fontSize: 13 }}>{p.st.slice(0, 8)}…</text>
    </g>
  );
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Key items={T.legend} />
      <div className="ib-controls" style={{ flexWrap: 'wrap' }}>
        <span className="ib-lbl">{T.tool}</span>
        <span className="seg" role="group" aria-label={T.tool}>
          {TOOLS.map((k) => <button key={k} type="button" aria-pressed={tool === k} onClick={() => setTool(k)}>{T.tools[k][0]}</button>)}
        </span>
        <span className="ib-lbl">{T.move}</span>
        <span className="seg" role="group" aria-label={T.move}>
          {MOVES.map((k) => <button key={k} type="button" aria-pressed={move === k} onClick={() => setMove(k)}>{T.moves[k]}</button>)}
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 640" role="img" aria-label={T.title}>
          {/* the three people */}
          <Figure cx={30} cy={26} r={11} />
          <text x={52} y={34} className="ib-n" style={{ fontWeight: 700, fontSize: 17 }}>{`${T.alice}  ·  ${T.tools[tool][0]} (${T.tools[tool][1]})`}</text>
          <Figure cx={440} cy={26} r={11} fill={bad} />
          <text x={462} y={34} className="ib-n" style={{ fontWeight: 700, fontSize: 17, fill: bad }}>{T.mallory}</text>
          <Figure cx={654} cy={26} r={11} />
          <text x={676} y={34} className="ib-n" style={{ fontWeight: 700, fontSize: 17 }}>{T.bob}</text>
          {/* Alice's parcel -> Mallory -> Bob's parcel */}
          {parcel(14, s.sent, T.sends, 'plain')}
          <line x1={14 + CW} y1={145} x2={334} y2={145} stroke="var(--line-strong)" strokeWidth={4} />
          <path d="M334,145 l-12,-8 l0,16 z" fill="var(--line-strong)" />
          <rect x={334} y={70} width={212} height={150} rx={12} fill="color-mix(in srgb, var(--ib-bad) 10%, var(--surface))" stroke={bad} strokeWidth={3} />
          <text x={348} y={94} className="ib-s" style={{ fontSize: 13.5 }}>{T.note[move]}</text>
          {move === 'read' ? (
            <g>
              <text x={348} y={130} className="ib-s" style={{ fontSize: 14 }}>{`👁 ${T.sees}`}</text>
              <text x={348} y={160} className="ib-m" style={{ fontSize: 16, fontWeight: 700, fill: aes ? 'var(--muted)' : bad }}>{aes ? `${s.sent.st.slice(0, 8)}…` : s.sent.msg}</text>
              <text x={348} y={188} className="ib-n" style={{ fontSize: 14.5, fontWeight: 700, fill: aes ? 'var(--accent)' : bad }}>{aes ? `${T.cipher} (${T.unreadable})` : '✗'}</text>
            </g>
          ) : (
            <g>
              <text x={348} y={134} className="ib-m" style={{ fontSize: 16, fontWeight: 700, fill: bad }}>{aes && move === 'change' ? `🔒 ${lang === 'th' ? 'พลิก 1 บิต' : 'flips 1 bit'}` : s.got.msg}</text>
              <Seal x={348} y={152} hex={s.got.st} cell={11} />
              <text x={348} y={206} className="ib-s" style={{ fontSize: 13 }}>{move === 'forge' ? (tool === 'hash' ? (lang === 'th' ? 'คำนวณ Hash เอง' : 'hashes it himself') : (lang === 'th' ? 'เดาตราขึ้นมา' : 'guesses a seal')) : (tool === 'hash' ? (lang === 'th' ? 'คำนวณ Hash ใหม่เอง' : 'works out a new hash') : aes ? '' : (lang === 'th' ? 'ใช้ตราเดิมต่อ' : 'keeps the old seal'))}</text>
            </g>
          )}
          <line x1={546} y1={145} x2={634 - 0} y2={145} stroke="var(--line-strong)" strokeWidth={4} />
          <path d="M634,145 l-12,-8 l0,16 z" fill="var(--line-strong)" />
          {parcel(634, s.got, move === 'read' ? T.theSame : T.receives, changedMsg || move !== 'read' ? 'bad' : 'plain', move === 'change' ? s.sent.msg : undefined)}
          {/* Bob's check: two seals side by side */}
          <rect x={14} y={246} width={852} height={112} rx={12} fill="var(--surface)" stroke="var(--line-strong)" strokeWidth={2} />
          <text x={30} y={274} className="ib-n" style={{ fontWeight: 700, fontSize: 16 }}>{`${T.bob}:`}</text>
          <text x={30} y={300} className="ib-s" style={{ fontSize: 14 }}>{T.bobWorks}</text>
          <Seal x={30} y={310} hex={s.expected} cell={13} />
          <text x={92} y={332} className="ib-m" style={{ fontSize: 14 }}>{s.expected.slice(0, 8)}…</text>
          <text x={330} y={316} textAnchor="middle" style={{ fontSize: 40, fontWeight: 700, fill: s.accepted ? acc : bad }}>{s.accepted ? '=' : '≠'}</text>
          <text x={330} y={344} textAnchor="middle" className="ib-s" style={{ fontSize: 13.5 }}>{s.accepted ? T.equal : T.differ}</text>
          <text x={470} y={300} className="ib-s" style={{ fontSize: 14 }}>{T.onParcel}</text>
          <Seal x={470} y={310} hex={s.got.st} cell={13} />
          <text x={532} y={332} className="ib-m" style={{ fontSize: 14 }}>{s.got.st.slice(0, 8)}…</text>
          <rect x={680} y={262} width={170} height={80} rx={12} fill={s.accepted ? 'color-mix(in srgb, var(--accent) 12%, var(--surface))' : 'color-mix(in srgb, var(--ib-bad) 12%, var(--surface))'} stroke={s.accepted ? acc : bad} strokeWidth={3} />
          <text x={765} y={310} textAnchor="middle" style={{ fontSize: 19, fontWeight: 700, fill: s.accepted ? acc : bad }}>{`${s.accepted ? '✓' : '✗'} ${s.accepted ? T.accepted : T.refused}`}</text>
          {/* the verdict, in words */}
          <rect x={14} y={374} width={852} height={86} rx={12} fill={s.holds ? 'color-mix(in srgb, var(--accent) 10%, var(--surface))' : 'color-mix(in srgb, var(--ib-bad) 10%, var(--surface))'} stroke={s.holds ? acc : bad} strokeWidth={3} />
          <text x={32} y={404} style={{ fontSize: 19, fontWeight: 700, fill: s.holds ? acc : bad }}>{s.holds ? T.yes : T.no}</text>
          <foreignObject x={26} y={410} width={828} height={48}><div style={{ fontSize: 15.5, lineHeight: 1.4 }}>{T.outcome[tool][move]}</div></foreignObject>
          {/* the twelve cells, computed by the same code */}
          <text x={14} y={490} className="ib-s" style={{ fontSize: 14 }}>{T.table}</text>
          {MOVES.map((m, j) => <text key={m} x={316 + j * 190} y={512} textAnchor="middle" className="ib-s" style={{ fontSize: 14 }}>{T.moves[m]}</text>)}
          {TOOLS.map((k, i) => (
            <g key={k}>
              <text x={14} y={540 + i * 26} className="ib-n" style={{ fontWeight: tool === k ? 700 : 400, fontSize: 15 }}>{T.tools[k][0]}</text>
              {MOVES.map((m, j) => {
                const ok = scenario(k, m).holds;
                const sel = tool === k && move === m;
                return (
                  <g key={m}>
                    <rect x={236 + j * 190} y={524 + i * 26} width={160} height={22} rx={6} fill={ok ? 'var(--accent-soft)' : 'color-mix(in srgb, var(--ib-bad) 12%, var(--surface))'} stroke={sel ? 'var(--fg)' : ok ? acc : bad} strokeWidth={sel ? 3 : 1.5} />
                    <text x={316 + j * 190} y={541 + i * 26} textAnchor="middle" style={{ fontSize: 15, fontWeight: 700, fill: ok ? acc : bad }}>{ok ? '✓' : '✗'}</text>
                  </g>
                );
              })}
            </g>
          ))}
        </svg>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
