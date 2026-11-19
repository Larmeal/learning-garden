import { useState } from 'react';
import { ClockControls, useClock, prog, type Lang, type Mark } from '../spark/timeline';
import { Key } from './ds';
import { hex, hmacSha256, sha256, utf8 } from '../app-security/sha256';

// Shows:      a customer table whose e-mails were replaced (four ways to do it), and an attacker who tries a list of guessed e-mails one by one: each guess is hashed in front of you
//             (a real SHA-256 or HMAC, computed in the browser) and compared with the released values. A row that matches is cracked and shows the real e-mail. Under it, the same
//             customer in a second table: do the two released values still match, so that an analyst can join them?
// Because:    "we hashed it, so it is anonymous" is an argument about what an attacker can compute, and you only believe it when you watch the guesses hit or miss.
// Control:    the method (plain hash, hash with a salt, HMAC with a key, random token) and what the attacker holds (nothing, a list of guessed e-mails, the secret key).
// Conclusion: a plain hash falls to a list of guesses. A salt or a random token stops that and also stops the join. HMAC keeps the join and is only as safe as its key.
//
// The hashes are real: sha256.ts and hmacSha256 of the Application Security labs. Which attacker undoes which method, and the join results, are those asserted in
// exercises/02_pseudonymization.py (salt per row and random tokens: no join, 0 of 2,000; HMAC: full join; a dictionary of 600,000 guesses found every e-mail on the guessed domain).
// The four customers and the guesses are small made-up examples: the attacker guesses three of the four customers and misses the fourth on purpose.

type M = 'hash' | 'salted' | 'hmac' | 'token';
type A = 'none' | 'dict' | 'key';
const TABLE = ['ann.stone1@mail.test', 'bob.reed2@post.test', 'cat.park3@inbox.test', 'dan.cole4@mail.test'];
const GUESS = ['zoe.hale@mail.test', 'bob.reed2@post.test', 'max.lane@post.test', 'ann.stone1@mail.test', 'eve.moss@inbox.test', 'cat.park3@inbox.test'];
const KEY = 'the-teams-secret-key';
const SALT = [['k3', 'p9', 'm1', 'x6'], ['q8', 'd2', 'v5', 'h7']]; // a different random salt on every row, and in every table
const TOKEN = [['9c41e0a7b2d3', 'f27a6b0d4c18', '3b8e51c9a0f6', 'a04d7e2b9c51'], ['5e19c3a8d702', 'b6f40d91e3a7', '82c7a5e0f1b4', 'd93b0a6c4e28']];
const h12 = (b: Uint8Array) => hex(b).slice(0, 12);

function released(m: M, email: string, table: number, row: number): string {
  if (m === 'hash') return h12(sha256(utf8(email)));
  if (m === 'salted') return h12(sha256(utf8(SALT[table][row] + email)));
  if (m === 'hmac') return h12(hmacSha256(utf8(KEY), utf8(email)));
  return TOKEN[table][row];
}
// what the attacker can compute for a guessed e-mail
function attackerValues(a: A, guess: string): string[] {
  if (a === 'none') return [];
  const plain = h12(sha256(utf8(guess)));
  return a === 'dict' ? [plain] : [plain, h12(hmacSha256(utf8(KEY), utf8(guess)))];
}

const STEP = 1.1, T0 = 0.6, DUR = T0 + STEP * GUESS.length + 1.2;
const mono = { fontFamily: 'var(--mono, monospace)' } as const;

const TEXT: Record<Lang, {
  title: string; method: string; methods: Record<M, string>; attacker: string; attackers: Record<A, string>;
  table: string; real: string; releasedCol: string; knows: string; unknown: string; private: string;
  tries: string; noTries: string; match: string; joinTitle: string; orders: string; tickets: string; sameYes: string; sameNo: string; joinYes: string; joinNo: string;
  cracked: (n: number) => string; key: { cracked: string; safe: string; join: string }; how: Record<M, string>; caption: string; marks: (m: M, a: A, n: number) => Mark[];
}> = {
  th: {
    title: 'เลือกวิธีแทนที่อีเมล กับสิ่งที่ผู้โจมตีถืออยู่ แล้วเล่นดูว่าเขาถอดอีเมลกลับมาได้ไหม และนักวิเคราะห์ยัง Join ข้ามตารางได้หรือเปล่า',
    method: 'วิธีแทนที่', methods: { hash: 'Hash ธรรมดา', salted: 'Hash + Salt ต่อแถว', hmac: 'HMAC (มี Key)', token: 'Token สุ่ม' },
    attacker: 'ผู้โจมตีถืออยู่', attackers: { none: 'ไม่มีอะไร', dict: 'รายการอีเมลที่เดา', key: 'Key ลับ (หลุด)' },
    table: 'ตารางลูกค้าที่ปล่อยออกไป', real: 'อีเมลจริง', releasedCol: 'ค่าที่ปล่อย', knows: 'ผู้โจมตีรู้ว่าเป็นของ', unknown: '?', private: '(ผู้โจมตีไม่เห็นคอลัมน์นี้)',
    tries: 'ผู้โจมตีลองทีละอีเมล', noTries: 'ไม่มีรายการเดา และไม่มี Key ผู้โจมตีเห็นได้แค่ค่าที่ปล่อยออกไป', match: 'ตรงกับแถวที่',
    joinTitle: 'ลูกค้าคนเดียวกัน (Ann) ในอีกตารางหนึ่ง', orders: 'ตาราง Orders', tickets: 'ตาราง Tickets', sameYes: 'ค่าเท่ากัน', sameNo: 'ค่าไม่เท่ากัน', joinYes: 'Join และนับคนที่ต่างกันได้', joinNo: 'Join ไม่ได้ เพราะไม่รู้ว่าเป็นคนเดียวกัน',
    cracked: (n) => `ถอดอีเมลกลับมาได้ ${n} จาก 4 แถว`,
    key: { cracked: 'ถูกถอดกลับ', safe: 'ยังปลอดภัย', join: 'Join ได้' },
    how: { hash: 'ค่าที่เก็บคือ SHA-256 ของอีเมลตรง ๆ ใครก็คำนวณได้', hmac: 'ค่าที่เก็บคือ HMAC ของอีเมลด้วย Key ลับของทีม', salted: 'ค่าที่เก็บคือ SHA-256 ของ (Salt สุ่มของแถวนั้น + อีเมล) ผู้โจมตีไม่รู้ Salt', token: 'ค่าที่เก็บคือเลขสุ่มที่ไม่มีทางคำนวณจากอีเมล ตารางจับคู่อยู่ใน Vault' },
    caption: 'Hash ในภาพคำนวณจริงในเบราว์เซอร์ ว่าผู้โจมตีถอดวิธีไหนได้ และ Join ได้เมื่อไร มาจากแบบฝึก 02 (พจนานุกรม 600,000 ค่าเดาอีเมลได้ครบ, Salt ต่อแถวและ Token สุ่ม Join ไม่ได้ 0 จาก 2,000, HMAC Join ได้ครบ) ลูกค้า 4 คนกับรายการเดาเป็นตัวอย่างเล็ก ๆ ที่ตั้งใจให้เดาถูก 3 คนและพลาด Dan',
    marks: (m, a, n) => [
      { at: 0, name: 'ตาราง', title: 'ตารางที่ปล่อยออกไปมีแต่ค่าที่ถูกแทนที่', text: 'ลูกค้าแต่ละคนมีอีเมลจริงอยู่ในระบบของเรา (คอลัมน์จาง) ส่วนที่ปล่อยให้คนอื่นเห็นมีแต่ค่าตรงกลาง' },
      { at: T0, name: 'ลองเดา', title: a === 'none' ? 'ผู้โจมตีไม่มีอะไรให้ลอง' : 'ผู้โจมตีลองทีละอีเมล', text: a === 'none' ? 'เขามีแค่ค่าที่ปล่อยออกไป และไม่มีทางย้อนค่าเหล่านั้นกลับไปเป็นอีเมล' : 'เขาคำนวณค่าของอีเมลที่เดาด้วยวิธีเดียวกับเรา แล้วดูว่ามีแถวไหนตรง ถ้าตรง แถวนั้นก็คืออีเมลนั้น' },
      { at: DUR - 1.1, name: 'ผลลัพธ์', title: n > 0 ? `ถอดกลับได้ ${n} แถว` : 'ถอดกลับไม่ได้เลย', text: n > 0 ? (m === 'hash' ? 'Hash ธรรมดาไม่มีความลับอะไรเลย คนที่เดาอีเมลถูกก็ได้แถวนั้นไป' : 'ผู้โจมตีถือ Key ลับอยู่ จึงคำนวณค่าของอีเมลที่เดาได้เหมือนเราทุกอย่าง') : 'สิ่งที่ผู้โจมตีคำนวณได้ ไม่เท่ากับสิ่งที่เราเก็บไว้ในแถวไหนเลย' },
    ],
  },
  en: {
    title: 'Choose how the e-mail is replaced and what the attacker holds, then play it and see whether the attacker gets the e-mails back and whether an analyst can still join two tables',
    method: 'Replaced with', methods: { hash: 'Plain hash', salted: 'Hash + salt per row', hmac: 'HMAC (a key)', token: 'Random token' },
    attacker: 'Attacker holds', attackers: { none: 'nothing', dict: 'a list of guessed e-mails', key: 'the secret key (leaked)' },
    table: 'the customer table that was released', real: 'real e-mail', releasedCol: 'released value', knows: 'attacker knows it is', unknown: '?', private: '(the attacker does not see this column)',
    tries: 'the attacker tries one e-mail at a time', noTries: 'No list of guesses and no key: the attacker only sees the released values', match: 'matches row',
    joinTitle: 'the same customer (Ann) in a second table', orders: 'Orders table', tickets: 'Tickets table', sameYes: 'same value', sameNo: 'different values', joinYes: 'can join, can count distinct people', joinNo: 'cannot join: nothing says it is the same person',
    cracked: (n) => `${n} of 4 e-mails got back`,
    key: { cracked: 'cracked', safe: 'still safe', join: 'joins' },
    how: { hash: 'The stored value is the SHA-256 of the e-mail itself. Anyone can compute it.', hmac: 'The stored value is the HMAC of the e-mail with the team\'s secret key.', salted: 'The stored value is the SHA-256 of (a random salt of that row + the e-mail). The attacker does not know the salt.', token: 'The stored value is a random number that cannot be computed from the e-mail. The mapping sits in a vault.' },
    caption: 'The hashes are computed for real in the browser. Which attacker undoes which method, and when a join works, come from exercise 02 (a dictionary of 600,000 guesses found every e-mail, a salt per row and random tokens do not join, 0 of 2,000, HMAC joins fully). The four customers and the guess list are a small example, built so that three guesses hit and Dan is missed.',
    marks: (m, a, n) => [
      { at: 0, name: 'table', title: 'The released table only holds replaced values', text: 'Every customer has a real e-mail in our own system (the faded column). Only the middle column is handed to other people.' },
      { at: T0, name: 'guessing', title: a === 'none' ? 'The attacker has nothing to try' : 'The attacker tries one e-mail at a time', text: a === 'none' ? 'He only has the released values, and no way to turn them back into e-mails.' : 'He computes the value of each guessed e-mail the way we did, and looks for a row that matches. If one does, that row is that e-mail.' },
      { at: DUR - 1.1, name: 'result', title: n > 0 ? `${n} rows got back` : 'Nothing got back', text: n > 0 ? (m === 'hash' ? 'A plain hash has no secret in it. Whoever guesses the e-mail gets the row.' : 'The attacker holds the secret key, so he can compute the value of a guessed e-mail exactly as we do.') : 'What the attacker can compute never equals what we stored in any row.' },
    ],
  },
};

export default function PseudonymLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [m, setM] = useState<M>('hash');
  const [a, setA] = useState<A>('dict');
  const clock = useClock(DUR);
  const { t } = clock;
  const stored = TABLE.map((e, r) => released(m, e, 0, r));
  // for every guess: the row it cracks (or -1)
  const hit = GUESS.map((g) => { const vals = attackerValues(a, g); return stored.findIndex((s) => vals.includes(s)); });
  const gi = t < T0 ? -1 : Math.min(GUESS.length - 1, Math.floor((t - T0) / STEP));
  const doneTries = t < T0 ? 0 : Math.min(GUESS.length, Math.floor((t - T0) / STEP) + (prog(t, T0 + STEP * gi, T0 + STEP * (gi + 1)) > 0.55 ? 1 : 0));
  const crackedRows = new Map<number, string>();
  hit.forEach((row, g) => { if (row >= 0 && g < doneTries) crackedRows.set(row, GUESS[g]); });
  const total = new Set(hit.filter((r) => r >= 0)).size;
  const ordersAnn = released(m, TABLE[0], 0, 0), ticketsAnn = released(m, TABLE[0], 1, 0);
  const joins = ordersAnn === ticketsAnn;
  const marks = T.marks(m, a, total);
  const rowY = (r: number) => 84 + r * 44;
  return (
    <figure className="viz ib-fig lg">
      <div className="viz-title">{T.title}</div>
      <div className="ib-controls" style={{ flexWrap: 'wrap' }}>
        <span className="ib-lbl">{T.method}</span>
        <span className="seg" role="group" aria-label={T.method} style={{ flexWrap: 'wrap' }}>
          {(Object.keys(T.methods) as M[]).map((k) => <button key={k} type="button" aria-pressed={m === k} onClick={() => { setM(k); clock.restart(); }}>{T.methods[k]}</button>)}
        </span>
      </div>
      <div className="ib-controls" style={{ flexWrap: 'wrap' }}>
        <span className="ib-lbl">{T.attacker}</span>
        <span className="seg" role="group" aria-label={T.attacker} style={{ flexWrap: 'wrap' }}>
          {(Object.keys(T.attackers) as A[]).map((k) => <button key={k} type="button" aria-pressed={a === k} onClick={() => { setA(k); clock.restart(); }}>{T.attackers[k]}</button>)}
        </span>
      </div>
      <Key items={[{ color: 'var(--ib-bad)', text: T.key.cracked }, { color: 'var(--accent)', text: T.key.join }]} />
      <div className="viz-box">
        <svg viewBox="0 0 880 500" role="img" aria-label={T.title}>
          {/* the released table */}
          <rect x={6} y={6} width={560} height={256} rx={14} fill="var(--surface)" stroke="var(--line-strong)" strokeWidth={2} />
          <text x={22} y={32} className="ib-n" style={{ fontWeight: 700, fontSize: 17 }}>{T.table}</text>
          <text x={22} y={62} className="ib-s" style={{ fontSize: 14 }}>{T.real}</text>
          <text x={262} y={62} className="ib-s" style={{ fontSize: 14 }}>{T.releasedCol}</text>
          <text x={402} y={62} className="ib-s" style={{ fontSize: 14 }}>{T.knows}</text>
          {TABLE.map((e, r) => {
            const got = crackedRows.get(r);
            const flash = got !== undefined && gi >= 0 && hit[gi] === r && prog(t, T0 + STEP * gi, T0 + STEP * (gi + 1)) < 0.9;
            return (
              <g key={e}>
                <rect x={14} y={rowY(r) - 22} width={544} height={38} rx={8} fill={got ? 'color-mix(in srgb, var(--ib-bad) 14%, var(--surface))' : 'var(--surface)'} stroke={got ? 'var(--ib-bad)' : 'var(--line)'} strokeWidth={got ? 3 : 1.5} style={{ transition: 'fill .3s' }} />
                <text x={22} y={rowY(r) + 2} style={{ ...mono, fontSize: 14, fill: 'var(--muted)', opacity: 0.8 }}>{e}</text>
                <text x={242} y={rowY(r) + 2} style={{ fontSize: 16, fill: 'var(--muted)' }}>→</text>
                <text x={262} y={rowY(r) + 3} style={{ ...mono, fontSize: 15, fontWeight: 700 }}>{stored[r]}</text>
                <text x={402} y={rowY(r) + 2} style={{ ...mono, fontSize: 14, fontWeight: got ? 700 : 400, fill: got ? 'var(--ib-bad)' : 'var(--muted)' }}>{got ? `✗ ${got}` : T.unknown}</text>
                {flash ? <rect x={14} y={rowY(r) - 22} width={544} height={38} rx={8} fill="none" stroke="var(--ib-bad)" strokeWidth={5} opacity={0.6} /> : null}
              </g>
            );
          })}
          <text x={22} y={rowY(3) + 36} className="ib-s" style={{ fontSize: 13 }}>{T.private}</text>
          {/* the attacker */}
          <rect x={580} y={6} width={294} height={256} rx={14} fill="var(--surface)" stroke={a === 'none' ? 'var(--line-strong)' : 'var(--ib-bad)'} strokeWidth={2} strokeDasharray={a === 'none' ? '8 6' : undefined} />
          <text x={596} y={32} className="ib-n" style={{ fontWeight: 700, fontSize: 17 }}>{T.attackers[a]}</text>
          {a === 'none' ? (
            <foreignObject x={594} y={46} width={268} height={200}><div style={{ fontSize: 15, color: 'var(--muted)', lineHeight: 1.45 }}>{T.noTries}</div></foreignObject>
          ) : (
            <>
              <text x={596} y={56} className="ib-s" style={{ fontSize: 14 }}>{T.tries}</text>
              {GUESS.map((g, i) => {
                const y = 80 + i * 29;
                const active = i === gi && t < DUR - 1.1;
                const tried = i < doneTries;
                const ok = hit[i] >= 0;
                return (
                  <g key={g} opacity={tried || active ? 1 : 0.5}>
                    <rect x={590} y={y - 17} width={278} height={25} rx={6} fill={active ? 'var(--accent-soft)' : 'none'} stroke={active ? 'var(--accent)' : 'none'} strokeWidth={2} />
                    <text x={598} y={y + 1} style={{ ...mono, fontSize: 13.5 }}>{g}</text>
                    {tried ? <text x={862} y={y + 1} textAnchor="end" style={{ fontSize: 15, fontWeight: 700, fill: ok ? 'var(--ib-bad)' : 'var(--muted)' }}>{ok ? `✓ ${T.match} ${hit[i] + 1}` : '✗'}</text> : null}
                  </g>
                );
              })}
            </>
          )}
          {/* the second table */}
          <rect x={6} y={276} width={560} height={150} rx={14} fill="var(--surface)" stroke="var(--line-strong)" strokeWidth={2} />
          <text x={22} y={302} className="ib-n" style={{ fontWeight: 700, fontSize: 17 }}>{T.joinTitle}</text>
          {[[T.orders, ordersAnn, 22], [T.tickets, ticketsAnn, 306]].map(([name, v, x]) => (
            <g key={String(name)}>
              <rect x={Number(x)} y={316} width={236} height={64} rx={10} fill="var(--surface)" stroke="var(--line-strong)" strokeWidth={1.5} />
              <text x={Number(x) + 12} y={338} className="ib-s" style={{ fontSize: 14 }}>{String(name)}</text>
              <text x={Number(x) + 12} y={366} style={{ ...mono, fontSize: 16, fontWeight: 700 }}>{String(v)}</text>
            </g>
          ))}
          <text x={279} y={353} textAnchor="middle" style={{ fontSize: 26, fontWeight: 700, fill: joins ? 'var(--accent)' : 'var(--ib-bad)' }}>{joins ? '=' : '≠'}</text>
          <text x={22} y={408} style={{ fontSize: 15.5, fontWeight: 700, fill: joins ? 'var(--accent)' : 'var(--ib-bad)' }}>{joins ? `✓ ${T.sameYes}: ${T.joinYes}` : `✗ ${T.sameNo}: ${T.joinNo}`}</text>
          {/* result of the attack and how the value was made */}
          <rect x={580} y={276} width={294} height={150} rx={14} fill="var(--surface)" stroke={total > 0 ? 'var(--ib-bad)' : 'var(--line-strong)'} strokeWidth={2} />
          <text x={596} y={306} style={{ fontSize: 17, fontWeight: 700, fill: total > 0 ? 'var(--ib-bad)' : 'var(--accent)' }}>{total > 0 ? '✗ ' : '✓ '}{T.cracked(total)}</text>
          <foreignObject x={594} y={318} width={268} height={104}><div style={{ fontSize: 14.5, color: 'var(--muted)', lineHeight: 1.4 }}>{T.how[m]}</div></foreignObject>
          <rect x={6} y={440} width={868} height={50} rx={10} className="ib-banner" />
          <text x={22} y={471} className="ib-n" style={{ fontWeight: 700, fontSize: 16 }}>{`${T.methods[m]}  +  ${T.attackers[a]}:  ${T.cracked(total)},  ${joins ? T.joinYes : T.joinNo}`}</text>
        </svg>
      </div>
      <ClockControls clock={clock} marks={marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
