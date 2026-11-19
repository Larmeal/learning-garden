import { useMemo, useState } from 'react';
import { Key } from '../data-security/ds';
import type { Lang } from '../spark/stepper';
import { Seal } from './bits';
import { hex, sha256, utf8 } from './sha256';

// Shows:      the leaked table of five users (a name and the hash stored for it) beside the attacker's lookup book (a thousand common passwords, each next to its hash). Where a stored hash is
//             the same as a hash in the book, a line joins them and the password is read off the book. Switch the salt on and every stored hash changes, the lines vanish, and the one book is no
//             longer enough: the attacker needs a new book for each user.
// Because:    "a salt makes equal passwords look different and makes a prebuilt table useless" is about two seals that either match or do not, and about one book against five.
// Control:    the salt switch. Every hash in the picture is recomputed (real SHA-256 in the browser), and so is which rows get joined to the book.
// Conclusion: without a salt one lookup book cracks every user whose password is on the list, and two users with the same password show the same hash. With a salt, the book finds nothing,
//             and the attacker must hash the whole list again for every user (1,000 times 5 = 5,000 hashes).
//
// The users, the 1,000 word list and the salt rule (the first 16 bytes of sha256 of the user name, fixed only so the numbers repeat) are those of exercises/04_passwords.py. There it cracked ann,
// bob, dan and eve without a salt and nobody with one. The hash is the TypeScript one of sha256.ts. The seals are a drawing of the first bytes of each hash.

const COMMON = ['123456', 'password', 'qwerty', '111111', 'iloveyou', 'dragon', 'monkey', 'letmein', 'football', 'sunshine', 'master', 'welcome', 'shadow', 'superman', 'michael', 'abc123', 'trustno1', 'batman', 'login', 'admin'];
const WORDS = [...COMMON, ...Array.from({ length: 980 }, (_, n) => `pass${String(n).padStart(4, '0')}`)];
const USERS: [string, string][] = [['ann', 'iloveyou'], ['bob', 'iloveyou'], ['cat', 'Tr0ub4dor&3'], ['dan', 'letmein'], ['eve', 'qwerty']];

const TEXT: Record<Lang, {
  title: string; salt: string; on: string; off: string; table: string; book: string; bookSub: string; entries: string; same: string; foundIt: string; none: string; cracked: string; safe: string;
  legend: { color: string; text: string; ring?: boolean }[]; summaryOff: (c: number) => string; summaryOn: string; saltOf: string; work: (n: number, b: number) => string; needBook: string; caption: string; noBook: string;
}> = {
  th: {
    title: 'เปิดหรือปิด Salt แล้วดูตารางที่หลุดออกไปเทียบกับสมุดคำตอบของผู้โจมตี แถวไหนมีเส้นไปหาสมุดคือถูกถอดเป็น Password และคนที่ตั้งรหัสเหมือนกันยังมี Hash เหมือนกันอยู่ไหม',
    salt: 'Salt ต่อผู้ใช้', on: 'เปิด', off: 'ปิด', table: 'ตารางที่หลุดออกไป', book: 'สมุดคำตอบของผู้โจมตี', bookSub: 'ทำไว้ล่วงหน้า ใช้ได้กับทุกคน', entries: 'รายการ', same: 'Hash เหมือนกัน', foundIt: 'เจอในสมุด', none: 'ไม่มีในสมุด',
    cracked: 'ถอดได้', safe: 'ถอดไม่ได้',
    legend: [{ color: 'var(--ib-bad)', text: 'ถอดเป็น Password ได้' }, { color: 'var(--accent)', text: 'ปลอดภัยจากสมุดเล่มนี้' }],
    summaryOff: (c) => `สมุดเล่มเดียวถอดได้ ${c} จาก 5 คน`, summaryOn: 'สมุดเล่มเดียวถอดไม่ได้เลย ผู้โจมตีต้องทำสมุดใหม่ให้ผู้ใช้แต่ละคน', saltOf: 'Salt ของ', work: (n, b) => `${b} เล่ม × ${(n / b).toLocaleString('en-US')} รายการ = ${n.toLocaleString('en-US')} ครั้งของการ Hash`, needBook: 'ต้องทำสมุดเฉพาะของคนนี้', noBook: 'ยังไม่มีสมุดของคนนี้',
    caption: 'ผู้ใช้ รายการคำ 1,000 คำ และกฎของ Salt ตามแบบฝึก 04 (Salt ในแบบฝึกกำหนดจากชื่อผู้ใช้เพื่อให้ตัวเลขซ้ำได้ ของจริงต้องสุ่ม 16 ไบต์) SHA-256 ในแล็บเขียนเองด้วย TypeScript ตรารูปสี่เหลี่ยมคือหน้าตาของ Hash ตัวหน้า ๆ Hash ที่เท่ากันได้ตราเหมือนกัน',
  },
  en: {
    title: "Switch the salt on and off and compare the leaked table with the attacker's lookup book. A row with a line to the book is cracked into a password. Do two users with the same password still show the same hash?",
    salt: 'Salt per user', on: 'on', off: 'off', table: 'the leaked table', book: "the attacker's lookup book", bookSub: 'made in advance, good for everybody', entries: 'entries', same: 'identical hashes', foundIt: 'found in the book', none: 'not in the book',
    cracked: 'cracked', safe: 'not cracked',
    legend: [{ color: 'var(--ib-bad)', text: 'cracked into a password' }, { color: 'var(--accent)', text: 'safe from this book' }],
    summaryOff: (c) => `One book cracks ${c} of 5 users`, summaryOn: 'One book cracks nobody. The attacker has to make a new book for every user', saltOf: 'salt of', work: (n, b) => `${b} ${b === 1 ? 'book' : 'books'} × ${(n / b).toLocaleString('en-US')} entries = ${n.toLocaleString('en-US')} hashes`, needBook: "needs this user's own book", noBook: 'no book for this user yet',
    caption: 'The users, the 1,000 word list and the salt rule come from exercise 04. (There the salt comes from the user name so the numbers repeat. A real salt is 16 random bytes.) The SHA-256 in the lab is written in TypeScript. A square seal is the look of the first bytes of a hash: equal hashes get equal seals.',
  },
};

const ROW = 74;

export default function SaltLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [salted, setSalted] = useState(false);
  const table = useMemo(() => new Map(WORDS.map((w) => [hex(sha256(utf8(w))), w])), []);
  const rows = USERS.map(([u, pw]) => {
    const salt = sha256(utf8(u)).slice(0, 16);
    const h = salted ? hex(sha256(new Uint8Array([...salt, ...utf8(pw)]))) : hex(sha256(utf8(pw)));
    const hit = table.get(h) ?? null;
    return { u, h, hit, salt: hex(salt).slice(0, 6) };
  });
  const cracked = rows.filter((r) => r.hit).length;
  const sameHash = rows[0].h === rows[1].h;
  const bad = 'var(--ib-bad)', acc = 'var(--accent)';
  const books = salted ? USERS.length : 1;
  return (
    <figure className="viz ib-fig lg">
      <div className="viz-title">{T.title}</div>
      <Key items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.salt}</span>
        <span className="seg" role="group" aria-label={T.salt}>
          <button type="button" aria-pressed={!salted} onClick={() => setSalted(false)}>{T.off}</button>
          <button type="button" aria-pressed={salted} onClick={() => setSalted(true)}>{T.on}</button>
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 650" role="img" aria-label={T.title}>
          <text x={14} y={26} className="ib-n" style={{ fontWeight: 700, fontSize: 17 }}>{T.table}</text>
          <text x={604} y={26} className="ib-n" style={{ fontWeight: 700, fontSize: 17 }}>{`📖 ${T.book}`}</text>
          <text x={604} y={46} className="ib-s" style={{ fontSize: 13.5 }}>{`${T.bookSub} (${WORDS.length.toLocaleString('en-US')} ${T.entries})`}</text>
          {rows.map((r, i) => {
            const y = 62 + i * ROW;
            const hit = !!r.hit;
            return (
              <g key={r.u}>
                <rect x={10} y={y} width={290} height={ROW - 12} rx={10} fill="var(--surface)" stroke={hit ? bad : acc} strokeWidth={hit ? 3 : 2} />
                <text x={24} y={y + 26} className="ib-n" style={{ fontWeight: 700, fontSize: 18 }}>{r.u}</text>
                {salted ? <text x={24} y={y + 46} className="ib-s" style={{ fontSize: 13 }}>{`🧂 ${r.salt.slice(0, 4)}…`}</text> : null}
                <Seal x={92} y={y + 12} hex={r.h} cell={14} />
                <text x={158} y={y + 38} className="ib-m" style={{ fontSize: 15 }}>{r.h.slice(0, 12)}…</text>
                {/* the line to the book */}
                {hit ? (
                  <g>
                    <line x1={300} y1={y + (ROW - 12) / 2} x2={604} y2={y + (ROW - 12) / 2} stroke={bad} strokeWidth={4} />
                    <path d={`M604,${y + (ROW - 12) / 2} l-13,-8 l0,16 z`} fill={bad} />
                    <text x={452} y={y + 20} textAnchor="middle" className="ib-n" style={{ fontWeight: 700, fontSize: 14, fill: bad }}>{T.foundIt}</text>
                  </g>
                ) : null}
                {/* the book entry */}
                <rect x={608} y={y} width={258} height={ROW - 12} rx={10} fill={hit ? 'color-mix(in srgb, var(--ib-bad) 10%, var(--surface))' : 'var(--surface)'} stroke={hit ? bad : 'var(--line)'} strokeWidth={hit ? 3 : 1.5} strokeDasharray={hit ? undefined : '6 5'} />
                {hit ? (
                  <g>
                    <Seal x={622} y={y + 12} hex={r.h} cell={14} />
                    <text x={690} y={y + 26} className="ib-s" style={{ fontSize: 13 }}>{`${T.cracked}:`}</text>
                    <text x={690} y={y + 46} className="ib-n" style={{ fontWeight: 700, fontSize: 17, fill: bad }}>{r.hit}</text>
                  </g>
                ) : (
                  <text x={622} y={y + 36} className="ib-s" style={{ fontSize: 14 }}>{salted ? T.noBook : T.none}</text>
                )}
              </g>
            );
          })}
          {/* the same hash for the same password */}
          {sameHash ? (
            <g>
              <path d={`M314,${62 + 22} C340,${62 + 22} 340,${62 + ROW + 22} 314,${62 + ROW + 22}`} stroke={bad} strokeWidth={3} fill="none" />
              <text x={326} y={62 + ROW + 6} className="ib-n" style={{ fontSize: 13.5, fontWeight: 700, fill: bad }}>{T.same}</text>
            </g>
          ) : null}
          {/* books and what the attacker has to do */}
          <rect className="ib-banner" x={10} y={446} width={856} height={190} rx={12} />
          <text x={26} y={476} className="ib-n" style={{ fontWeight: 700, fontSize: 18, fill: salted ? acc : bad }}>{salted ? T.summaryOn : T.summaryOff(cracked)}</text>
          {Array.from({ length: books }, (_, k) => {
            const w = salted ? 142 : 200;
            const x = 26 + k * (w + 12);
            return (
              <g key={k}>
                <rect x={x} y={494} width={w} height={86} rx={8} fill="var(--surface)" stroke="var(--line-strong)" strokeWidth={2.5} />
                <line x1={x + 12} y1={494} x2={x + 12} y2={580} stroke="var(--line-strong)" strokeWidth={2.5} />
                <text x={x + 24} y={522} className="ib-n" style={{ fontWeight: 700, fontSize: 15 }}>{salted ? USERS[k][0] : '📖'}</text>
                <text x={x + 24} y={548} className="ib-s" style={{ fontSize: 13 }}>{`${WORDS.length.toLocaleString('en-US')} ${T.entries}`}</text>
                {salted ? <text x={x + 24} y={568} className="ib-s" style={{ fontSize: 12 }}>{T.needBook.length > 22 ? '' : T.needBook}</text> : null}
              </g>
            );
          })}
          <text x={26} y={614} className="ib-n" style={{ fontSize: 15 }}>{T.work(WORDS.length * books, books)}</text>
        </svg>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
