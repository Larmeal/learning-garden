import { useMemo, useState } from 'react';
import { Legend } from '../iceberg/ib';
import type { Lang } from '../spark/stepper';
import { hex, sha256, utf8 } from './sha256';

// Shows:      the table of five users that leaks, with and without a salt, and what a lookup table built from a list of 1,000 common passwords does to it.
// Because:    "a salt makes equal passwords look different and makes a prebuilt table useless" is about two rows of hex that either match or do not.
// Control:    the salt switch (and a switch for how long the attacker's list is) change every hash in the picture and which rows get cracked.
// Conclusion: without a salt one lookup table cracks every user whose password is on the list at once, and equal passwords are visible. With a salt, the
//             lookup table finds nothing, and the attacker must hash the whole list again for every user (1,000 times 5 = 5,000 hashes).
//
// The users, the 1,000 word list and the salt rule (the first 16 bytes of sha256 of the user name, fixed only so the numbers repeat) are those of
// exercises/04_passwords.py. There it cracked ann, bob, dan and eve without a salt and nobody with one. The hash is the TypeScript one of sha256.ts.

const COMMON = ['123456', 'password', 'qwerty', '111111', 'iloveyou', 'dragon', 'monkey', 'letmein', 'football', 'sunshine', 'master', 'welcome', 'shadow', 'superman', 'michael', 'abc123', 'trustno1', 'batman', 'login', 'admin'];
const WORDS = [...COMMON, ...Array.from({ length: 980 }, (_, n) => `pass${String(n).padStart(4, '0')}`)];
const USERS: [string, string][] = [['ann', 'iloveyou'], ['bob', 'iloveyou'], ['cat', 'Tr0ub4dor&3'], ['dan', 'letmein'], ['eve', 'qwerty']];

const TEXT: Record<Lang, {
  title: string; salt: string; on: string; off: string; list: string; user: string; hash: string; found: string; legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[];
  cracked: string; safe: string; same: string; work: (n: number) => string; table: string; summary: (c: number, salted: boolean) => string; caption: string; len: string;
}> = {
  th: {
    title: 'เปิดหรือปิด Salt แล้วดูตารางที่หลุดออกไป ว่าแถวไหนถูกถอดเป็น Password และ Hash ของสองคนที่ตั้งรหัสเหมือนกันยังเหมือนกันอยู่ไหม',
    salt: 'Salt ต่อผู้ใช้', on: 'เปิด', off: 'ปิด', list: 'รายการคำที่ผู้โจมตีมี', user: 'ผู้ใช้', hash: 'ค่าที่เก็บในตาราง (SHA-256, 16 ตัวแรก)', found: 'ผลของการเทียบกับตาราง',
    legend: [{ kind: 'new', text: 'ถูกถอดได้' }, { kind: 'use', text: 'ปลอดภัยจากรายการนี้' }],
    cracked: 'ถอดได้:', safe: 'ถอดไม่ได้', same: 'Hash เหมือนกัน', work: (n) => `งานของผู้โจมตี: ${n.toLocaleString('en-US')} ครั้งของการ Hash`,
    table: 'ตารางสำเร็จรูปสร้างครั้งเดียว ใช้ได้กับทุกคน', summary: (c, s) => s ? `ถอดไม่ได้ ${5 - c} จาก 5 คน ผู้โจมตีต้อง Hash รายการใหม่สำหรับผู้ใช้แต่ละคน` : `ถอดได้ ${c} จาก 5 คน ด้วยตารางเดียว`,
    caption: 'ผู้ใช้ รายการคำ 1,000 คำ และกฎของ Salt ตามแบบฝึก 04 (Salt ในแบบฝึกกำหนดจากชื่อผู้ใช้เพื่อให้ตัวเลขซ้ำได้ ของจริงต้องสุ่ม 16 ไบต์) SHA-256 ในแล็บเขียนเองด้วย TypeScript',
    len: 'คำ',
  },
  en: {
    title: 'Switch the salt on and off and see which rows of the leaked table are cracked, and whether two users with the same password still look the same',
    salt: 'Salt per user', on: 'on', off: 'off', list: "The attacker's word list", user: 'user', hash: 'what the table stores (SHA-256, first 16 characters)', found: 'result of matching against the table',
    legend: [{ kind: 'new', text: 'cracked' }, { kind: 'use', text: 'safe from this list' }],
    cracked: 'cracked:', safe: 'not cracked', same: 'identical hashes', work: (n) => `the attacker's work: ${n.toLocaleString('en-US')} hashes`,
    table: 'a ready made table, built once and good for everybody', summary: (c, s) => s ? `${5 - c} of 5 not cracked. The attacker has to hash the list again for every user` : `${c} of 5 cracked with one table`,
    caption: 'The users, the 1,000 word list and the salt rule come from exercise 04. (There the salt comes from the user name so the numbers repeat. A real salt is 16 random bytes.) The SHA-256 in the lab is written in TypeScript.',
    len: 'words',
  },
};

export default function SaltLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [salted, setSalted] = useState(false);
  const table = useMemo(() => new Map(WORDS.map((w) => [hex(sha256(utf8(w))), w])), []);
  const rows = USERS.map(([u, pw]) => {
    const salt = sha256(utf8(u)).slice(0, 16);
    const h = salted ? hex(sha256(new Uint8Array([...salt, ...utf8(pw)]))) : hex(sha256(utf8(pw)));
    const hit = table.get(h) ?? null;
    return { u, h, hit };
  });
  const cracked = rows.filter((r) => r.hit).length;
  const sameHash = rows[0].h === rows[1].h;
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.salt}</span>
        <span className="seg" role="group" aria-label={T.salt}>
          <button type="button" aria-pressed={!salted} onClick={() => setSalted(false)}>{T.off}</button>
          <button type="button" aria-pressed={salted} onClick={() => setSalted(true)}>{T.on}</button>
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 420" role="img" aria-label={T.title}>
          <text x={24} y={30} className="ib-s">{T.user}</text>
          <text x={110} y={30} className="ib-s">{T.hash}</text>
          <text x={560} y={30} className="ib-s">{T.found}</text>
          {rows.map((r, i) => {
            const y = 44 + i * 56;
            const bad = !!r.hit;
            return (
              <g key={r.u}>
                <rect className={bad ? 'ib-new' : 'ib-use'} x={14} y={y} width={852} height={46} rx={9} style={bad ? { stroke: 'var(--ib-bad)', strokeWidth: 2.5 } : undefined} />
                <text x={28} y={y + 30} className="ib-n" style={{ fontWeight: 700, fontSize: 17 }}>{r.u}</text>
                <text x={110} y={y + 30} className="ib-m" style={{ fontSize: 17 }}>{r.h.slice(0, 16)}…</text>
                <text x={560} y={y + 30} className={bad ? 'ib-bad ib-n' : 'ib-ok ib-n'} style={{ fontWeight: 700 }}>{bad ? `✗ ${T.cracked} ${r.hit}` : `✓ ${T.safe}`}</text>
              </g>
            );
          })}
          {sameHash && (
            <g>
              <path d="M340,66 C372,66 372,122 340,122" stroke="var(--ib-bad)" strokeWidth={3} fill="none" />
              <text x={384} y={100} className="ib-bad ib-n">{T.same}</text>
            </g>
          )}
          <rect className="ib-banner" x={14} y={330} width={852} height={76} rx={10} />
          <text x={30} y={358} className="ib-n" style={{ fontWeight: 700 }}>{T.summary(cracked, salted)}</text>
          <text x={30} y={386} className="ib-s">{salted ? T.work(WORDS.length * USERS.length) : `${T.table} (${WORDS.length.toLocaleString('en-US')} ${T.len}, ${T.work(WORDS.length)})`}</text>
        </svg>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
