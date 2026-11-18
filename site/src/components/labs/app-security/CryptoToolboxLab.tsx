import { useState } from 'react';
import { Legend, Lines } from '../iceberg/ib';
import type { Lang } from '../spark/stepper';

// Shows:      the same message sent from Alice to Bob four ways (plain hash, HMAC, AES-GCM, signature), with Mallory in the middle doing one of
//             three things (read it, change it, forge a new one). The envelope shows what is on the wire and the banner says what Bob's check does.
// Because:    "hash, HMAC, encryption and signature" are four words for four different promises, and a table of 12 cells is easier to remember
//             once you have seen each cell happen. The picture changes with both controls.
// Control:    the tool (4) and Mallory's move (3). Each pair is one cell of the table under the picture, which is highlighted.
// Conclusion: only encryption hides the content; HMAC and signature let Bob see a change and a forgery; a plain hash lets Mallory do all three unseen.
//
// The wire values (digests, tag, ciphertext, signature) are the ones exercises/02_crypto_basics.py prints. The results (accepted, InvalidTag,
// InvalidSignature, "bad tag") are what that exercise asserted.

type Tool = 'hash' | 'hmac' | 'aes' | 'sig';
type Move = 'read' | 'change' | 'forge';
const TOOLS: Tool[] = ['hash', 'hmac', 'aes', 'sig'];
const MOVES: Move[] = ['read', 'change', 'forge'];

// true = the promise holds (Mallory is stopped or sees nothing useful)
const HOLDS: Record<Tool, Record<Move, boolean>> = {
  hash: { read: false, change: false, forge: false },
  hmac: { read: false, change: true, forge: true },
  aes: { read: true, change: true, forge: true },
  sig: { read: false, change: true, forge: true },
};

const WIRE: Record<Tool, { msg: string; extra: string }> = {
  hash: { msg: 'pay bob 100', extra: 'aa843d83…' },
  hmac: { msg: 'pay bob 100', extra: 'e1b2db25…' },
  aes: { msg: '2463a47fe5d1f32a…', extra: '' },
  sig: { msg: 'release 1.4.2', extra: 'fec562e2…' },
};

const TEXT: Record<Lang, {
  title: string; tool: string; move: string; tools: Record<Tool, [string, string]>; moves: Record<Move, string>;
  alice: string; bob: string; mallory: string; wire: string; legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[];
  outcome: Record<Tool, Record<Move, string>>; yes: string; no: string; table: string; caption: string; promise: string;
}> = {
  th: {
    title: 'เลือกเครื่องมือหนึ่งอย่างและสิ่งที่ Mallory ทำ แล้วดูว่า Bob ตรวจเจอไหม และตารางข้างล่างเป็นอย่างไร',
    tool: 'เครื่องมือ', move: 'Mallory ทำ',
    tools: { hash: ['Hash', 'SHA-256'], hmac: ['HMAC', 'ใช้ Key ร่วม'], aes: ['AES-GCM', 'เข้ารหัส'], sig: ['Signature', 'Ed25519'] },
    moves: { read: 'อ่านข้อความ', change: 'แก้ข้อความ', forge: 'ปลอมข้อความใหม่' },
    alice: 'Alice', bob: 'Bob', mallory: 'Mallory', wire: 'สิ่งที่วิ่งอยู่บนสาย',
    legend: [{ kind: 'new', text: 'ป้องกันได้' }, { kind: 'use', text: 'ไม่ได้สัญญาไว้' }],
    outcome: {
      hash: {
        read: 'Mallory อ่านข้อความได้เต็ม ๆ เพราะ Hash ไม่ได้ซ่อนอะไร',
        change: 'Mallory แก้เป็น pay bob 900 แล้วคำนวณ Hash ใหม่เอง Bob ตรวจแล้วตรงกัน จึงไม่รู้ว่าถูกแก้',
        forge: 'ใครก็คำนวณ Hash ของข้อความตัวเองได้ Bob จึงแยกไม่ออกว่ามาจาก Alice จริงไหม',
      },
      hmac: {
        read: 'ข้อความอ่านได้ เพราะ HMAC ไม่ได้เข้ารหัส มันแค่ติด Tag ไว้',
        change: 'Mallory แก้ข้อความแล้วไม่มี Key จึงทำ Tag ใหม่ไม่ได้ Bob ตรวจแล้วไม่ตรงและปฏิเสธ',
        forge: 'ไม่มี Key ก็ทำ Tag ที่ถูกต้องไม่ได้ ข้อความที่ปลอมมาจึงถูกปฏิเสธ',
      },
      aes: {
        read: 'Mallory เห็นแต่ตัวอักษรมั่ว ๆ (Ciphertext) อ่านไม่ออกถ้าไม่มี Key',
        change: 'บิตเดียวที่ถูกพลิกทำให้ถอดรหัสไม่ผ่าน (InvalidTag) Bob รู้ทันทีว่ามีการแก้',
        forge: 'ต้องใช้ Key จึงจะสร้างก้อนที่ผ่านการตรวจได้ Mallory จึงสร้างเองไม่ได้',
      },
      sig: {
        read: 'ข้อความอ่านได้ เพราะ Signature ไม่ได้เข้ารหัส มันแค่พิสูจน์ว่าใครเซ็น',
        change: 'ลายเซ็นเดิมบนข้อความที่ถูกแก้ ตรวจกับ Public Key แล้วไม่ผ่าน (InvalidSignature)',
        forge: 'ต้องมี Private Key จึงเซ็นได้ ใครมี Public Key ก็ตรวจได้ แต่เซ็นแทนไม่ได้',
      },
    },
    yes: '✓ ป้องกันได้', no: '✗ ไม่ได้ป้องกัน', table: 'ตารางทั้งสิบสองช่อง',
    promise: 'สัญญาของเครื่องมือนี้',
    caption: 'ค่าบนสาย (Hash, Tag, Ciphertext, Signature) และผลของการตรวจมาจากแบบฝึก 02 ช่องที่เป็น ✗ ไม่ได้แปลว่าเครื่องมือเสีย แต่แปลว่ามันไม่ได้สัญญาเรื่องนั้นไว้ตั้งแต่แรก',
  },
  en: {
    title: 'Pick a tool and what Mallory does, and see whether Bob notices. The table below fills in as you go',
    tool: 'Tool', move: 'Mallory does',
    tools: { hash: ['Hash', 'SHA-256'], hmac: ['HMAC', 'shared key'], aes: ['AES-GCM', 'encryption'], sig: ['Signature', 'Ed25519'] },
    moves: { read: 'reads the message', change: 'changes the message', forge: 'forges a new one' },
    alice: 'Alice', bob: 'Bob', mallory: 'Mallory', wire: 'what is on the wire',
    legend: [{ kind: 'new', text: 'protected' }, { kind: 'use', text: 'never promised' }],
    outcome: {
      hash: {
        read: 'Mallory reads the whole message, because a hash hides nothing',
        change: 'Mallory changes it to pay bob 900 and works out a new hash himself. Bob checks it, it matches, and he never knows',
        forge: 'Anyone can hash a message of their own, so Bob cannot tell whether it really came from Alice',
      },
      hmac: {
        read: 'The message is readable, because HMAC does not encrypt. It only adds a tag',
        change: 'Mallory changes the message and has no key, so he cannot make a new tag. Bob checks, it does not match, and he refuses it',
        forge: 'Without the key a valid tag cannot be made, so a forged message is refused',
      },
      aes: {
        read: 'Mallory sees only random looking bytes (ciphertext) and cannot read them without the key',
        change: 'One flipped bit makes decryption fail (InvalidTag), so Bob knows at once that it was changed',
        forge: 'A block that passes the check needs the key, so Mallory cannot make one',
      },
      sig: {
        read: 'The message is readable, because a signature does not encrypt. It only proves who signed',
        change: 'The old signature on a changed message fails the check with the public key (InvalidSignature)',
        forge: 'Signing needs the private key. Anyone with the public key can check, but nobody can sign for Alice',
      },
    },
    yes: '✓ protected', no: '✗ not protected', table: 'all twelve cells',
    promise: 'What this tool promises',
    caption: 'The values on the wire (hash, tag, ciphertext, signature) and the results of the checks come from exercise 02. A ✗ does not mean the tool is broken. It means the tool never promised that.',
  },
};

export default function CryptoToolboxLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [tool, setTool] = useState<Tool>('hmac');
  const [move, setMove] = useState<Move>('change');
  const holds = HOLDS[tool][move];
  const w = WIRE[tool];
  const bad = !holds;
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
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
        <svg viewBox="0 0 880 470" role="img" aria-label={T.title}>
          {/* Alice -> wire -> Bob */}
          <rect className="ib-use" x={16} y={50} width={150} height={80} rx={10} />
          <text x={91} y={86} textAnchor="middle" className="ib-n" style={{ fontWeight: 700, fontSize: 18 }}>{T.alice}</text>
          <text x={91} y={110} textAnchor="middle" className="ib-s">{`${T.tools[tool][0]} · ${T.tools[tool][1]}`}</text>
          <rect className="ib-use" x={714} y={50} width={150} height={80} rx={10} />
          <text x={789} y={86} textAnchor="middle" className="ib-n" style={{ fontWeight: 700, fontSize: 18 }}>{T.bob}</text>
          <text x={789} y={110} textAnchor="middle" className="ib-s">{T.tools[tool][0]}</text>
          <line x1={166} y1={90} x2={714} y2={90} className="ib-line" style={{ strokeWidth: 3 }} />
          <rect className={bad ? 'ib-node' : 'ib-new'} x={250} y={58} width={380} height={64} rx={10} style={bad ? { stroke: 'var(--ib-bad)', strokeWidth: 3 } : undefined} />
          <text x={440} y={80} textAnchor="middle" className="ib-s">{T.wire}</text>
          <text x={440} y={106} textAnchor="middle" className="ib-m" style={{ fontSize: 16 }}>{w.extra ? `${w.msg}  +  ${w.extra}` : w.msg}</text>
          {/* Mallory under the wire */}
          <path d="M440,150 L440,126" stroke="var(--ib-bad)" strokeWidth={3.5} fill="none" />
          <rect x={360} y={150} width={160} height={40} rx={9} style={{ fill: 'var(--ib-bad)' }} />
          <text x={440} y={177} textAnchor="middle" className="ib-white" style={{ fontSize: 17 }}>{`${T.mallory}: ${T.moves[move]}`}</text>
          {/* verdict */}
          <rect className={bad ? 'ib-node' : 'ib-new'} x={16} y={212} width={848} height={92} rx={12} style={bad ? { stroke: 'var(--ib-bad)', strokeWidth: 3 } : undefined} />
          <text x={34} y={244} className={bad ? 'ib-bad ib-n' : 'ib-ok ib-n'} style={{ fontWeight: 700, fontSize: 20 }}>{holds ? T.yes : T.no}</text>
          <Lines x={34} y={274} text={T.outcome[tool][move]} max={lang === 'th' ? 74 : 92} className="ib-n" />
          {/* the 12 cell table */}
          <text x={16} y={336} className="ib-s">{T.table}</text>
          {MOVES.map((m, j) => (
            <text key={m} x={240 + j * 205} y={336} textAnchor="middle" className="ib-s">{T.moves[m]}</text>
          ))}
          {TOOLS.map((k, i) => (
            <g key={k}>
              <text x={16} y={370 + i * 26} className="ib-n" style={{ fontWeight: tool === k ? 700 : 400 }}>{T.tools[k][0]}</text>
              {MOVES.map((m, j) => {
                const sel = tool === k && move === m;
                return (
                  <g key={m}>
                    <rect x={160 + j * 205} y={352 + i * 26} width={160} height={22} rx={6} className={HOLDS[k][m] ? 'ib-new' : 'ib-node'} style={sel ? { stroke: 'var(--fg)', strokeWidth: 3 } : undefined} />
                    <text x={240 + j * 205} y={369 + i * 26} textAnchor="middle" className={HOLDS[k][m] ? 'ib-n' : 'ib-bad ib-n'}>{HOLDS[k][m] ? '✓' : '✗'}</text>
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
