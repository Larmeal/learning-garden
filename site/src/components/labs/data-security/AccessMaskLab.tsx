import { useState } from 'react';
import type { Lang } from '../spark/stepper';
import { Key, num } from './ds';
import data from './access.json';

// Shows:      the same three customers, seen by three roles. Every column of the table is drawn as it looks to the chosen role: shown as it is, masked, made coarser, replaced by a token, or hidden.
//             Under the table, the queries that the role tried and what the database answered (allowed, or refused by the authorizer).
// Because:    "who sees what" is a decision made column by column and row by row. Seeing the same row change as you switch the role is faster to read than three tables, and the refusals
//             show that the rule is enforced by the database and not only agreed between people.
// Control:    the role (admin, support, analyst). The columns, the values, the row count and the list of attempts all change with it.
// Conclusion: the support role gets a masked e-mail and phone and only three zip areas, the analyst gets no name, a token, a coarse zip and a salary band, and neither can reach the base table.
//
// The values are the real rows of exercise 08 (access.json): the same three customers in the admin, support and analyst views. The row counts (600, 307, 600) and the attempts that were allowed
// or denied are those asserted there (the authorizer refuses the base table, a sub query, another role's view and the audit table; the purpose check refuses 'marketing').

type Role = 'admin' | 'support' | 'analyst';
type Kind = 'show' | 'mask' | 'coarse' | 'token' | 'hide';
const ROLES: Role[] = ['admin', 'support', 'analyst'];
const COLS = ['name', 'email', 'phone', 'zip', 'birth', 'salary', 'diagnosis'] as const;
const admin = data.admin.rows as string[][], support = data.support.rows as string[][], analyst = data.analyst.rows as string[][];
const COUNT: Record<Role, number> = { admin: data.admin.count, support: data.support.count, analyst: data.analyst.count };
const SHOW = 3;

const KIND: Record<Role, Kind[]> = {
  admin: ['show', 'show', 'show', 'show', 'show', 'show', 'show'],
  support: ['show', 'mask', 'mask', 'show', 'hide', 'hide', 'hide'],
  analyst: ['hide', 'token', 'hide', 'coarse', 'coarse', 'coarse', 'show'],
};
function cell(role: Role, c: number, r: number): string {
  if (KIND[role][c] === 'hide') return '';
  if (role === 'admin') return admin[r][c + 1];
  if (role === 'support') return support[r][c + 1];
  // analyst: person, zip3, birth_year, salary_band, diagnosis
  return [null, analyst[r][0], null, analyst[r][1], analyst[r][2], analyst[r][3], analyst[r][4]][c] ?? '';
}

const TEXT: Record<Lang, {
  title: string; role: string; roles: Record<Role, string>; cols: string[]; kinds: Record<Kind, string>; key: { show: string; change: string; hide: string }; rowsSeen: (n: number, t: number) => string; sample: string;
  tried: string; allowed: string; refused: string; attempts: Record<Role, { sql: string; ok: boolean; note: string }[]>; why: Record<Role, string>; caption: string;
}> = {
  th: {
    title: 'เลือกบทบาท แล้วดูว่าลูกค้าสามคนเดิมหน้าตาเปลี่ยนไปอย่างไรสำหรับแต่ละคน และคำสั่งที่เขาลองถูกอนุญาตหรือปฏิเสธ',
    role: 'บทบาท', roles: { admin: 'Admin', support: 'Support', analyst: 'Analyst' },
    cols: ['ชื่อ', 'อีเมล', 'เบอร์โทร', 'Zip', 'วันเกิด', 'เงินเดือน', 'โรค'],
    kinds: { show: 'ตามจริง', mask: 'บังบางส่วน', coarse: 'ทำให้หยาบ', token: 'Token', hide: 'ซ่อน' },
    key: { show: 'เห็นตามจริง', change: 'เห็นแบบที่ถูกบัง ทำให้หยาบ หรือแทนที่', hide: 'มองไม่เห็นเลย' },
    rowsSeen: (n, t) => `เห็น ${num(n)} แถว จาก ${num(t)}`, sample: 'ตัวอย่างสามแถวแรก',
    tried: 'คำสั่งที่บทบาทนี้ลอง', allowed: 'ผ่าน', refused: 'ถูกปฏิเสธ',
    attempts: {
      admin: [{ sql: 'SELECT * FROM customers', ok: true, note: 'ได้ 9 คอลัมน์ 600 แถว' }, { sql: 'SELECT count(*) FROM audit', ok: true, note: 'อ่านบันทึกการใช้งานได้' }],
      support: [{ sql: 'SELECT * FROM v_support', ok: true, note: 'ได้ 5 คอลัมน์ 307 แถว ของสามพื้นที่ Zip' }, { sql: 'SELECT * FROM v_analyst', ok: false, note: 'View ของบทบาทอื่น Authorizer ปฏิเสธ' }, { sql: 'SELECT * FROM audit', ok: false, note: 'มีแต่ Admin ที่อ่านตารางบันทึกได้' }],
      analyst: [{ sql: 'SELECT * FROM v_analyst', ok: true, note: 'ได้ 5 คอลัมน์ 600 แถว ไม่มีชื่อ' }, { sql: 'SELECT * FROM customers', ok: false, note: 'ตารางจริง Authorizer ปฏิเสธ' }, { sql: 'SELECT name FROM (SELECT * FROM customers)', ok: false, note: 'ซ่อนไว้ใน Sub Query ก็ถูกปฏิเสธ' }, { sql: "purpose = 'marketing'", ok: false, note: 'วัตถุประสงค์ไม่ตรงสิทธิ์ ถูกปฏิเสธก่อนรันคำสั่ง' }],
    },
    why: { admin: 'Admin เห็นทุกอย่าง จึงต้องมีไม่กี่คน และทุกคำสั่งของเขาถูกบันทึก', support: 'Support ต้องโทรหาลูกค้า จึงเห็นชื่อกับ Zip แต่อีเมลและเบอร์ถูกบัง และเห็นแค่ลูกค้าสามพื้นที่', analyst: 'Analyst ต้องการแนวโน้ม ไม่ต้องรู้ว่าเป็นใคร จึงไม่มีชื่อ มี Token ที่ใช้ตามคนเดียวกันข้ามตารางได้ และค่าที่หยาบลง' },
    caption: 'ค่าในตารางเป็นลูกค้าสามคนแรกของแบบฝึก 08 ใน View ของแต่ละบทบาท จำนวนแถว (600, 307, 600) และคำสั่งที่ผ่านหรือถูกปฏิเสธ ล้วนเป็นที่แบบฝึกตรวจไว้ (Authorizer ของ SQLite ปฏิเสธตารางจริง Sub Query View ของบทบาทอื่น และตารางบันทึก)',
  },
  en: {
    title: 'Choose a role and see how the same three customers look to each one, and which queries that role tried were allowed or refused',
    role: 'role', roles: { admin: 'Admin', support: 'Support', analyst: 'Analyst' },
    cols: ['name', 'e-mail', 'phone', 'zip', 'birth date', 'salary', 'diagnosis'],
    kinds: { show: 'as it is', mask: 'partly masked', coarse: 'made coarser', token: 'a token', hide: 'hidden' },
    key: { show: 'seen as it is', change: 'seen masked, coarser or replaced', hide: 'not visible at all' },
    rowsSeen: (n, t) => `sees ${num(n)} of ${num(t)} rows`, sample: 'the first three rows',
    tried: 'queries this role tried', allowed: 'allowed', refused: 'refused',
    attempts: {
      admin: [{ sql: 'SELECT * FROM customers', ok: true, note: '9 columns, 600 rows' }, { sql: 'SELECT count(*) FROM audit', ok: true, note: 'can read the audit log' }],
      support: [{ sql: 'SELECT * FROM v_support', ok: true, note: '5 columns, 307 rows of three zip areas' }, { sql: 'SELECT * FROM v_analyst', ok: false, note: 'another role\'s view, refused by the authorizer' }, { sql: 'SELECT * FROM audit', ok: false, note: 'only the admin reads the audit table' }],
      analyst: [{ sql: 'SELECT * FROM v_analyst', ok: true, note: '5 columns, 600 rows, no name' }, { sql: 'SELECT * FROM customers', ok: false, note: 'the base table, refused by the authorizer' }, { sql: 'SELECT name FROM (SELECT * FROM customers)', ok: false, note: 'hiding it in a sub query is refused too' }, { sql: "purpose = 'marketing'", ok: false, note: 'the purpose does not match the role, refused before any query runs' }],
    },
    why: { admin: 'The admin sees everything, so there should be few of them, and every query is logged.', support: 'Support has to phone customers, so it sees name and zip, but e-mail and phone are masked and only three zip areas are visible.', analyst: 'The analyst needs trends, not who anyone is. No name, a token that follows the same person across tables, and coarser values.' },
    caption: 'The values are the first three customers of exercise 08 in the view of each role. The row counts (600, 307, 600) and which queries pass or are refused are all asserted there (SQLite\'s authorizer refuses the base table, a sub query, another role\'s view and the audit table).',
  },
};

export default function AccessMaskLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [role, setRole] = useState<Role>('support');
  const colW = 124, x0 = 6;
  const kinds = KIND[role];
  const tone = (k: Kind) => (k === 'show' ? { fill: 'var(--surface)', stroke: 'var(--line-strong)' } : k === 'hide' ? { fill: 'none', stroke: 'var(--line)' } : { fill: 'var(--accent-soft)', stroke: 'var(--accent)' });
  const seen = COUNT[role];
  const att = T.attempts[role];
  return (
    <figure className="viz ib-fig lg">
      <div className="viz-title">{T.title}</div>
      <div className="ib-controls">
        <span className="ib-lbl">{T.role}</span>
        <span className="seg" role="group" aria-label={T.role}>{ROLES.map((r) => <button key={r} type="button" aria-pressed={role === r} onClick={() => setRole(r)}>{T.roles[r]}</button>)}</span>
      </div>
      <Key items={[{ color: 'var(--line-strong)', text: T.key.show }, { color: 'var(--accent)', text: T.key.change }, { color: 'var(--line)', text: T.key.hide, ring: true }]} />
      <div className="viz-box">
        <svg viewBox="0 0 880 650" role="img" aria-label={T.title}>
          <text x={x0 + 4} y={24} className="ib-s" style={{ fontSize: 14 }}>{T.sample}</text>
          {COLS.map((c, i) => {
            const k = kinds[i];
            const tn = tone(k);
            const x = x0 + i * colW;
            return (
              <g key={c}>
                <text x={x + 59} y={52} textAnchor="middle" className="ib-n" style={{ fontWeight: 700, fontSize: 15.5, opacity: k === 'hide' ? 0.45 : 1, textDecoration: k === 'hide' ? 'line-through' : undefined }}>{T.cols[i]}</text>
                <rect x={x} y={62} width={colW - 6} height={26} rx={13} fill={tn.fill} stroke={tn.stroke} strokeWidth={k === 'show' ? 1.5 : 2} strokeDasharray={k === 'hide' ? '5 4' : undefined} style={{ transition: 'fill .3s' }} />
                <text x={x + 59} y={80} textAnchor="middle" style={{ fontSize: 13.5, fill: k === 'hide' ? 'var(--muted)' : 'var(--fg)', fontWeight: k === 'show' ? 400 : 700 }}>{T.kinds[k]}</text>
                {Array.from({ length: SHOW }, (_, r) => {
                  const y = 104 + r * 50;
                  const v = cell(role, i, r);
                  return (
                    <g key={r}>
                      <rect x={x} y={y} width={colW - 6} height={42} rx={8} fill={tn.fill} stroke={tn.stroke} strokeWidth={k === 'show' ? 1.5 : 2} strokeDasharray={k === 'hide' ? '5 4' : undefined} style={{ transition: 'fill .3s' }} />
                      <text x={x + 59} y={y + 26} textAnchor="middle" style={{ fontFamily: 'var(--mono, monospace)', fontSize: v.length > 15 ? 11.5 : v.length > 11 ? 12.5 : 14, fill: k === 'hide' ? 'var(--muted)' : 'var(--fg)', fontWeight: k === 'show' || !v ? 400 : 700 }}>{k === 'hide' ? '—' : v}</text>
                    </g>
                  );
                })}
              </g>
            );
          })}
          {/* the rows the role sees */}
          <text x={x0 + 4} y={284} className="ib-n" style={{ fontWeight: 700, fontSize: 16 }}>{T.rowsSeen(seen, 600)}</text>
          <rect x={x0 + 300} y={270} width={520} height={14} rx={7} fill="var(--accent-soft)" stroke="var(--line-strong)" />
          <rect x={x0 + 300} y={270} width={Math.max(6, (520 * seen) / 600)} height={14} rx={7} fill="var(--accent)" style={{ transition: 'width .4s' }} />
          {/* what it tried */}
          <rect x={6} y={304} width={868} height={60 + att.length * 50 + 64} rx={14} fill="var(--surface)" stroke="var(--line-strong)" strokeWidth={2} />
          <text x={22} y={332} className="ib-n" style={{ fontWeight: 700, fontSize: 16.5 }}>{`${T.roles[role]} · ${T.tried}`}</text>
          {att.map((a, i) => (
            <g key={a.sql}>
              <rect x={20} y={346 + i * 50} width={30} height={30} rx={15} style={{ fill: a.ok ? 'var(--accent)' : 'var(--ib-bad)' }} />
              <text x={35} y={367 + i * 50} textAnchor="middle" style={{ fill: 'var(--on-key, #fff)', fontSize: 16, fontWeight: 700 }}>{a.ok ? '✓' : '✗'}</text>
              <text x={62} y={360 + i * 50} style={{ fontFamily: 'var(--mono, monospace)', fontSize: 14.5, fontWeight: 700 }}>{a.sql}</text>
              <text x={62} y={380 + i * 50} style={{ fontSize: 14, fill: a.ok ? 'var(--muted)' : 'var(--ib-bad)' }}>{`${a.ok ? T.allowed : T.refused}: ${a.note}`}</text>
            </g>
          ))}
          <foreignObject x={20} y={346 + att.length * 50 + 4} width={840} height={56}><div style={{ fontSize: 15, color: 'var(--fg)', lineHeight: 1.4 }}>{T.why[role]}</div></foreignObject>
        </svg>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
