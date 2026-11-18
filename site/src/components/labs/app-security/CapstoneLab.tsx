import { useState } from 'react';
import { Legend } from '../iceberg/ib';
import type { Lang } from '../spark/stepper';
import data from './capstone.json';

// Shows:      the toy shop with ten planted flaws as a list of ten rows. Each row has the exploit that works against that flaw and a switch for its fix. Turn fixes on and the rows turn from
//             "the exploit works" to "blocked". The counter says how many of the ten are closed, and the honest flows are listed as working only when all ten fixes are on.
// Because:    a review is a list, and the list shows the thing the lesson says last: every fix closes exactly one hole, so none of them can be skipped, and no fix breaks the honest use.
// Control:    ten switches, plus "all" and "none". Each one changes its own row and the counter.
// Conclusion: ten flaws need ten fixes. Closing nine leaves an exploit that works, and the first one to close is the one that gives away the most.
//
// The table of which exploit works with which fix on is the real one from exercises/13_capstone.py --write (capstone.json): all ten work with no fix, none works with all ten, and each fix
// blocks only its own exploit (90 of the 90 other cells stay open).

type Fix = (typeof data.fixes)[number];
const FIXES = data.fixes as Fix[];
const TABLE = data.table as Record<string, Record<string, boolean>>;

const TEXT: Record<Lang, {
  title: string; all: string; none: string; legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[]; works: string; blocked: string; counter: (n: number) => string; honest: string; honestOn: string; honestOff: string;
  rows: Record<string, { flaw: string; exploit: string; fix: string }>; caption: string; fixLabel: string; lesson: Record<string, string>;
}> = {
  th: {
    title: 'เปิดวิธีแก้ทีละข้อ แล้วดูว่าการโจมตีที่ใช้ได้กับร้านจำลองถูกปิดทีละช่อง ปิดครบสิบช่องแล้วจึงไม่มีอะไรใช้ได้',
    all: 'เปิดทุกข้อ', none: 'ปิดทุกข้อ', legend: [{ kind: 'new', text: 'ปิดแล้ว' }, { kind: 'use', text: 'ยังโจมตีได้' }], works: 'โจมตีได้', blocked: 'ปิดแล้ว', counter: (n) => `ปิดได้ ${n} จาก 10 ช่อง`,
    honest: 'การใช้งานปกติ (ล็อกอิน, อ่าน Order ตัวเอง, แก้อีเมล, รีวิว, ค้นหา)', honestOn: 'ทำงานได้ครบเมื่อเปิดทุกวิธีแก้', honestOff: 'ยังไม่ได้ตรวจกับชุดนี้ (แบบฝึกตรวจเฉพาะตอนเปิดครบ)', fixLabel: 'วิธีแก้',
    rows: {
      sqli: { flaw: 'ช่องค้นหาต่อสตริงเข้า SQL', exploit: 'UNION ดึงชื่อกับ Hash ของผู้ใช้ออกมา', fix: 'Parameterized Query' },
      password_hash: { flaw: 'เก็บ Password เป็น SHA-256 ธรรมดา', exploit: 'ถอด Hash ของ Ann ด้วยตารางค้นหา', fix: 'scrypt พร้อม Salt' },
      session_id: { flaw: 'Session ID เป็นเลขเรียงกัน', exploit: 'เดา ID ถัดไปแล้วเป็น Bob', fix: 'token_urlsafe(32)' },
      idor: { flaw: 'อ่าน Order โดยไม่เช็กเจ้าของ', exploit: 'Ann เปลี่ยนเลขเป็น 102', fix: 'เช็กเจ้าของใน Endpoint' },
      mass_assignment: { flaw: 'อัปเดตโปรไฟล์ด้วยทุกฟิลด์ที่ส่งมา', exploit: 'Ann ส่ง role เป็น admin', fix: 'Allow List ของฟิลด์' },
      xss: { flaw: 'แสดงรีวิวโดยไม่ Encode', exploit: 'ฝัง script ในรีวิว', fix: 'html.escape ตอนแสดง' },
      csrf: { flaw: 'เปลี่ยนอีเมลด้วย Cookie อย่างเดียว', exploit: 'evil.test สั่งเปลี่ยนอีเมล', fix: 'CSRF Token และตรวจ Origin' },
      error_detail: { flaw: 'Error บอกคำสั่ง SQL', exploit: 'ส่ง id ที่ผิดแล้วอ่านข้อความ Error', fix: 'ตอบข้อความทั่วไป' },
      rate_limit: { flaw: 'ล็อกอินผิดกี่ครั้งก็ได้', exploit: 'เดา 20 ครั้งติดกันไม่ถูกหยุด', fix: 'Rate Limit ต่อบัญชี' },
      secret_in_code: { flaw: 'Key เขียนอยู่ในซอร์ส', exploit: 'ตัวสแกนเจอ AKIA...', fix: 'ย้ายไป Environment' },
    },
    lesson: {},
    caption: 'ตารางว่าการโจมตีไหนใช้ได้เมื่อเปิดวิธีแก้ข้อไหน มาจากแบบฝึก 13 (capstone.json) ซึ่งรันทั้งสิบข้อโจมตีกับร้านจำลองในโปรเซสเดียวกัน แต่ละวิธีแก้ปิดการโจมตีของตัวเองเท่านั้น (ช่องอื่นอีก 90 ช่องยังเปิด)',
  },
  en: {
    title: 'Turn the fixes on one at a time, and see the exploits that work against the toy shop close one by one. With all ten on, nothing works',
    all: 'turn all on', none: 'turn all off', legend: [{ kind: 'new', text: 'closed' }, { kind: 'use', text: 'still exploitable' }], works: 'exploitable', blocked: 'closed', counter: (n) => `${n} of 10 holes closed`,
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

export default function CapstoneLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [on, setOn] = useState<Record<string, boolean>>({});
  const open = (name: string) => {
    // an exploit works unless its own fix is on (the real table says no other fix touches it)
    const fixed = Object.keys(on).filter((k) => on[k]);
    return fixed.every((f) => TABLE[f][name]);
  };
  const closed = FIXES.filter((f) => !open(f)).length;
  const allOn = FIXES.every((f) => on[f]);
  const set = (all: boolean) => setOn(Object.fromEntries(FIXES.map((f) => [f, all])));
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="btn sm" onClick={() => set(true)}>{T.all}</button>
        <button type="button" className="btn sm" onClick={() => set(false)}>{T.none}</button>
        <strong style={{ marginLeft: 8 }}>{T.counter(closed)}</strong>
      </div>
      <div style={{ display: 'grid', gap: 8, marginBottom: 8 }}>
        {FIXES.map((f) => {
          const works = open(f);
          const r = T.rows[f];
          return (
            <div key={f} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', border: `2px solid ${works ? 'var(--ib-bad)' : 'var(--line-strong)'}`, borderRadius: 10, padding: '8px 12px', background: 'var(--surface)' }}>
              <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{r.flaw}</div>
                <div style={{ fontSize: 14, color: 'var(--muted)' }}>{r.exploit}</div>
              </div>
              <div style={{ flex: '0 0 auto', fontWeight: 700, minWidth: 120, color: works ? 'var(--ib-bad)' : undefined }}>{works ? `✗ ${T.works}` : `✓ ${T.blocked}`}</div>
              <button type="button" className={`btn sm${on[f] ? ' primary' : ''}`} aria-pressed={!!on[f]} onClick={() => setOn({ ...on, [f]: !on[f] })}>{`${T.fixLabel}: ${r.fix}`}</button>
            </div>
          );
        })}
      </div>
      <div style={{ border: `2px solid ${allOn ? 'var(--accent)' : 'var(--line-strong)'}`, borderRadius: 10, padding: '8px 12px', background: 'var(--surface)', marginBottom: 6 }}>
        <div style={{ fontWeight: 700 }}>{T.honest}</div>
        <div style={{ fontSize: 14, color: 'var(--muted)' }}>{allOn ? `✓ ${T.honestOn}` : T.honestOff}</div>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
