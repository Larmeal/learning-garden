import { useState } from 'react';
import { Key } from '../data-security/ds';
import type { Lang } from '../spark/stepper';
import data from './capstone.json';

// Shows:      the toy shop with ten planted flaws as ten rows, each drawn as three things in a line: what the attacker does, the wall of the shop, and what he reaches inside. With the fix off the wall has
//             a gap and a red arrow goes through to the object (the users table, Bob's order, the AWS key); switching the fix on puts a patch in the gap, the arrow stops, and the object turns
//             safe. At the bottom, an honest customer walks in by the front door, and is shown to work only when all ten fixes are on. A counter says how many of the ten are closed.
// Because:    a review is a list, and the list shows what the lesson says last: every fix closes exactly one hole, so none of them can be skipped, and no fix breaks the honest use.
// Control:    ten fix buttons, plus "all" and "none". Each one changes its own row and the counter.
// Conclusion: ten flaws need ten fixes. Closing nine leaves an exploit that works, and the first one to close is the one that gives away the most.
//
// The table of which exploit works with which fix on is the real one from exercises/13_capstone.py --write (capstone.json): all ten work with no fix, none works with all ten, and each fix
// blocks only its own exploit (90 of the 90 other cells stay open).

type Fix = (typeof data.fixes)[number];
const FIXES = data.fixes as Fix[];
const TABLE = data.table as Record<string, Record<string, boolean>>;

const TEXT: Record<Lang, {
  title: string; all: string; none: string; legend: { color: string; text: string; ring?: boolean }[]; works: string; blocked: string; counter: (n: number) => string; honest: string; honestOn: string; honestOff: string;
  rows: Record<string, { flaw: string; exploit: string; fix: string }>; caption: string; fixLabel: string; lesson: Record<string, string>;
}> = {
  th: {
    title: 'เปิดวิธีแก้ทีละข้อ แล้วดูว่าการโจมตีที่ใช้ได้กับร้านจำลองถูกปิดทีละช่อง ปิดครบสิบช่องแล้วจึงไม่มีอะไรใช้ได้',
    all: 'เปิดทุกข้อ', none: 'ปิดทุกข้อ', legend: [{ color: 'var(--accent)', text: 'ปะแล้ว โจมตีไม่ได้' }, { color: 'var(--ib-bad)', text: 'ยังมีรูรั่ว โจมตีได้' }], works: 'โจมตีได้', blocked: 'ปิดแล้ว', counter: (n) => `ปิดได้ ${n} จาก 10 ช่อง`,
    honest: 'การใช้งานปกติ (ล็อกอิน, อ่าน Order ตัวเอง, แก้อีเมล, รีวิว, ค้นหา)', honestOn: 'ทำงานได้ครบเมื่อเปิดทุกวิธีแก้', honestOff: 'ยังไม่ได้ตรวจกับชุดนี้ (แบบฝึกตรวจเฉพาะตอนเปิดครบ)', fixLabel: 'วิธีแก้',
    rows: {
      sqli: { flaw: 'ช่องค้นหาต่อสตริงเข้า SQL', exploit: 'UNION ดึงชื่อกับ Hash ของผู้ใช้ออกมา', fix: 'Parameterized Query' },
      password_hash: { flaw: 'เก็บ Password เป็น SHA-256 ธรรมดา', exploit: 'ถอด Hash ของ Ann ด้วยตารางค้นหา', fix: 'Scrypt พร้อม Salt' },
      session_id: { flaw: 'Session ID เป็นเลขเรียงกัน', exploit: 'เดา ID ถัดไปแล้วเป็น Bob', fix: 'token_urlsafe(32)' },
      idor: { flaw: 'อ่าน Order โดยไม่เช็กเจ้าของ', exploit: 'Ann เปลี่ยนเลขเป็น 102', fix: 'เช็กเจ้าของใน Endpoint' },
      mass_assignment: { flaw: 'อัปเดตโปรไฟล์ด้วยทุกฟิลด์ที่ส่งมา', exploit: 'Ann ส่ง Role เป็น Admin', fix: 'Allow List ของฟิลด์' },
      xss: { flaw: 'แสดงรีวิวโดยไม่ Encode', exploit: 'ฝัง Script ในรีวิว', fix: 'html.escape ตอนแสดง' },
      csrf: { flaw: 'เปลี่ยนอีเมลด้วย Cookie อย่างเดียว', exploit: 'evil.test สั่งเปลี่ยนอีเมล', fix: 'CSRF Token และตรวจ Origin' },
      error_detail: { flaw: 'Error บอกคำสั่ง SQL', exploit: 'ส่ง ID ที่ผิดแล้วอ่านข้อความ Error', fix: 'ตอบข้อความทั่วไป' },
      rate_limit: { flaw: 'ล็อกอินผิดกี่ครั้งก็ได้', exploit: 'เดา 20 ครั้งติดกันไม่ถูกหยุด', fix: 'Rate Limit ต่อบัญชี' },
      secret_in_code: { flaw: 'Key เขียนอยู่ในซอร์ส', exploit: 'ตัวสแกนเจอ AKIA...', fix: 'ย้ายไป Environment' },
    },
    lesson: {},
    caption: 'ตารางว่าการโจมตีไหนใช้ได้เมื่อเปิดวิธีแก้ข้อไหน มาจากแบบฝึก 13 (capstone.json) ซึ่งรันทั้งสิบข้อโจมตีกับร้านจำลองในโปรเซสเดียวกัน แต่ละวิธีแก้ปิดการโจมตีของตัวเองเท่านั้น (ช่องอื่นอีก 90 ช่องยังเปิด)',
  },
  en: {
    title: 'Turn the fixes on one at a time, and see the exploits that work against the toy shop close one by one. With all ten on, nothing works',
    all: 'turn all on', none: 'turn all off', legend: [{ color: 'var(--accent)', text: 'patched, cannot be exploited' }, { color: 'var(--ib-bad)', text: 'still a hole, can be exploited' }], works: 'exploitable', blocked: 'closed', counter: (n) => `${n} of 10 holes closed`,
    honest: 'Honest use (log in, read your own order, change the e-mail, review, search)', honestOn: 'all work when every fix is on', honestOff: 'not checked with this combination (the exercise checks only with all on)', fixLabel: 'fix',
    rows: {
      sqli: { flaw: 'the search box joins strings into SQL', exploit: 'UNION pulls out names and hashes of users', fix: 'parameterised query' },
      password_hash: { flaw: 'passwords stored as plain SHA-256', exploit: "crack Ann's hash with a lookup table", fix: 'scrypt with a salt' },
      session_id: { flaw: 'session ids are consecutive numbers', exploit: 'guess the next id and be Bob', fix: 'token_urlsafe(32)' },
      idor: { flaw: 'an order is read without an owner check', exploit: 'Ann changes the number to 102', fix: 'check the owner in the endpoint' },
      mass_assignment: { flaw: 'the profile update writes every field sent', exploit: 'Ann sends role admin', fix: 'allow list of fields' },
      xss: { flaw: 'reviews shown without encoding', exploit: 'plant a script in a review', fix: 'html.escape on output' },
      csrf: { flaw: 'the e-mail changes on a cookie alone', exploit: 'evil.test changes the e-mail', fix: 'CSRF token and an Origin check' },
      error_detail: { flaw: 'the error shows the SQL', exploit: 'send a bad id and read the error', fix: 'a generic message' },
      rate_limit: { flaw: 'any number of wrong logins', exploit: '20 guesses in a row are not stopped', fix: 'rate limit per account' },
      secret_in_code: { flaw: 'a key written in the source', exploit: 'a scanner finds AKIA...', fix: 'move it to the environment' },
    },
    lesson: {},
    caption: 'The table of which exploit works with which fix on comes from exercise 13 (capstone.json), which runs all ten exploits against the toy shop in one process. Each fix closes only its own exploit (the other 90 cells stay open).',
  },
};

const EXPOSED: Record<Lang, Record<string, string>> = {
  th: { sqli: 'ตาราง Users (ชื่อกับ Hash)', password_hash: 'รหัสผ่านของ Ann', session_id: 'บัญชีของ Bob', idor: 'Order 102 ของ Bob', mass_assignment: 'สิทธิ์ Admin', xss: 'Cookie ของคนที่เปิดรีวิว', csrf: 'อีเมลของผู้ใช้', error_detail: 'คำสั่ง SQL ภายในของร้าน', rate_limit: 'บัญชีที่ถูกเดารหัสจนได้', secret_in_code: 'Key ของ AWS' },
  en: { sqli: 'the users table (names and hashes)', password_hash: "Ann's password", session_id: "Bob's account", idor: "Bob's order 102", mass_assignment: 'admin rights', xss: "the cookie of whoever opens the review", csrf: "the user's e-mail", error_detail: "the shop's internal SQL", rate_limit: 'an account whose password is guessed', secret_in_code: 'the AWS key' },
};
const NEWC: Record<Lang, { attacker: string; shop: string; open: string; closed: string; honestWho: string; honestGets: string; wall: string }> = {
  th: { attacker: 'ผู้โจมตีทำ', shop: 'สิ่งที่อยู่ในร้าน', open: 'รูรั่ว', closed: 'ปะแล้ว', honestWho: 'ลูกค้าปกติ', honestGets: 'ล็อกอิน อ่าน Order ของตัวเอง แก้อีเมล รีวิว ค้นหา', wall: 'ผนังร้าน' },
  en: { attacker: 'the attacker does', shop: 'what is inside the shop', open: 'hole', closed: 'patched', honestWho: 'an honest customer', honestGets: 'logs in, reads their own order, changes the e-mail, reviews, searches', wall: 'the shop wall' },
};

export default function CapstoneLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const N = NEWC[lang];
  const EX = EXPOSED[lang];
  const [on, setOn] = useState<Record<string, boolean>>({});
  const open = (name: string) => {
    // an exploit works unless its own fix is on (the real table says no other fix touches it)
    const fixed = Object.keys(on).filter((k) => on[k]);
    return fixed.every((f) => TABLE[f][name]);
  };
  const closed = FIXES.filter((f) => !open(f)).length;
  const allOn = FIXES.every((f) => on[f]);
  const set = (all: boolean) => setOn(Object.fromEntries(FIXES.map((f) => [f, all])));
  const bad = 'var(--ib-bad)', acc = 'var(--accent)';
  // the wall between an exploit and what it reaches: a gap with an arrow going through, or a solid patch where the arrow stops
  const wall = (works: boolean) => (
    <svg viewBox="0 0 150 46" width="100%" height="46" role="img" aria-label={works ? T.works : T.blocked} style={{ display: 'block' }}>
      <rect x={66} y={0} width={18} height={works ? 14 : 46} fill={works ? 'var(--line)' : 'var(--accent)'} stroke="var(--line-strong)" strokeWidth={1.5} />
      {works ? <rect x={66} y={32} width={18} height={14} fill="var(--line)" stroke="var(--line-strong)" strokeWidth={1.5} /> : null}
      {works ? (
        <g>
          <line x1={4} y1={23} x2={140} y2={23} stroke={bad} strokeWidth={4} />
          <path d="M146,23 l-14,-8 l0,16 z" fill={bad} />
        </g>
      ) : (
        <g>
          <line x1={4} y1={23} x2={58} y2={23} stroke="var(--muted)" strokeWidth={4} strokeDasharray="7 5" />
          <path d="M60,23 l-4,-9 M60,23 l-4,9" stroke="var(--muted)" strokeWidth={3} />
        </g>
      )}
    </svg>
  );
  return (
    <figure className="viz ib-fig lg">
      <style>{`.cap-row{display:grid;grid-template-columns:minmax(0,1fr) 150px minmax(0,1fr);gap:10px;align-items:center}@media (max-width:700px){.cap-row{grid-template-columns:1fr}}`}</style>
      <div className="viz-title">{T.title}</div>
      <Key items={[{ color: bad, text: T.legend[1].text }, { color: acc, text: T.legend[0].text }]} />
      <div className="ib-controls" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="btn sm" onClick={() => set(true)}>{T.all}</button>
        <button type="button" className="btn sm" onClick={() => set(false)}>{T.none}</button>
        <strong style={{ marginLeft: 8 }}>{T.counter(closed)}</strong>
      </div>
      <div style={{ display: 'flex', gap: 10, fontSize: 13.5, color: 'var(--muted)', margin: '2px 0 6px' }}>
        <span style={{ flex: 1 }}>{N.attacker}</span><span style={{ width: 150, textAlign: 'center' }}>{N.wall}</span><span style={{ flex: 1 }}>{N.shop}</span>
      </div>
      <div style={{ display: 'grid', gap: 8, marginBottom: 8 }}>
        {FIXES.map((f) => {
          const works = open(f);
          const r = T.rows[f];
          return (
            <div key={f} className="cap-row" style={{ border: `2px solid ${works ? bad : 'var(--line-strong)'}`, borderRadius: 12, padding: '8px 10px', background: 'var(--surface)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{r.flaw}</div>
                <div style={{ fontSize: 14, color: 'var(--muted)' }}>{`🗡️ ${r.exploit}`}</div>
              </div>
              <div style={{ minWidth: 0 }}>
                {wall(works)}
                <button type="button" className={`btn sm${on[f] ? ' primary' : ''}`} aria-pressed={!!on[f]} onClick={() => setOn({ ...on, [f]: !on[f] })} style={{ width: '100%', whiteSpace: 'normal', fontSize: 13 }}>{`${T.fixLabel}: ${r.fix}`}</button>
              </div>
              <div style={{ minWidth: 0, border: `2px solid ${works ? bad : 'var(--line)'}`, borderRadius: 10, padding: '8px 10px', background: works ? 'color-mix(in srgb, var(--ib-bad) 10%, var(--surface))' : 'var(--accent-soft)' }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, color: works ? bad : undefined }}>{`${works ? '🔓' : '🔒'} ${EX[f]}`}</div>
                <div style={{ fontSize: 13, color: works ? bad : 'var(--muted)' }}>{works ? `✗ ${T.works}` : `✓ ${T.blocked}`}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="cap-row" style={{ border: `3px solid ${allOn ? acc : 'var(--line-strong)'}`, borderRadius: 12, padding: '8px 10px', background: 'var(--surface)', marginBottom: 6 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{`🙂 ${N.honestWho}`}</div>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>{N.honestGets}</div>
        </div>
        <svg viewBox="0 0 150 46" width="100%" height="46" aria-hidden="true" style={{ display: 'block' }}>
          <line x1={4} y1={23} x2={140} y2={23} stroke={allOn ? acc : 'var(--line-strong)'} strokeWidth={4} />
          <path d="M146,23 l-14,-8 l0,16 z" fill={allOn ? acc : 'var(--line-strong)'} />
        </svg>
        <div style={{ fontWeight: 700, fontSize: 14.5, color: allOn ? acc : 'var(--muted)' }}>{allOn ? `✓ ${T.honestOn}` : T.honestOff}</div>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
