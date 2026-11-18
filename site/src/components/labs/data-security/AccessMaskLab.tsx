import { useState } from 'react';
import { Legend } from '../iceberg/ib';
import type { Lang } from '../spark/stepper';
import { Card, Row, mono, num } from './ds';
import data from './access.json';

// Shows:      the same table of 600 customers seen by three roles through three views: the admin sees every column and row, support sees masked e-mail and phone and only the rows of its
//             region, the analyst sees a token instead of the person, a zip area, a birth year, a salary band and the diagnosis. A button tries to read the base table directly.
// Because:    "who may see what" is a table of columns and rows that changes with the role, and the refusal of the direct read is the part that makes it enforcement and not a convention.
// Control:    the role (3) and the "read the base table" button. Both change the table, the row count and the verdict.
// Conclusion: access is decided by the view the role is given, the base table is closed to the others, and masking keeps a shape but loses the value.
//
// The columns, the first five rows of each view, and the row counts are those printed by exercises/08_access_masking.py (access.json), read through real SQLite views and its authorizer.

type Role = 'admin' | 'support' | 'analyst';
type V = { columns: string[]; rows: string[][]; count: number };
const V_ = data as unknown as Record<Role, V> & { heldBack: number; dlpHits: number };

const TEXT: Record<Lang, {
  title: string; role: string; roles: Record<Role, string>; legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[]; rows: string; cols: string; first: string; direct: string; allowed: string; denied: string;
  note: Record<Role, string>; caption: string; held: (n: number) => string;
}> = {
  th: {
    title: 'เลือกบทบาทแล้วดูว่าตารางเดียวกันเห็นต่างกันอย่างไร และลองอ่านตารางจริงตรง ๆ ว่าถูกปฏิเสธไหม',
    role: 'บทบาท', roles: { admin: 'Admin', support: 'Support', analyst: 'Analyst' },
    legend: [{ kind: 'new', text: 'ค่าที่ถูกปิดหรือแทนที่' }, { kind: 'use', text: 'ค่าที่เห็นจริง' }],
    rows: 'แถวที่เห็น', cols: 'คอลัมน์ที่เห็น', first: 'ห้าแถวแรก', direct: 'อ่านตารางจริง (customers) ตรง ๆ', allowed: 'อนุญาต เพราะ Admin ได้รับสิทธิ์โดยตรง', denied: 'ปฏิเสธ (not authorized) บทบาทนี้อ่านได้เฉพาะ View ของตัวเอง',
    note: { admin: 'เห็นทุกคอลัมน์และทุกแถว รวมช่อง notes ที่มีเบอร์โทรกับอีเมลซ่อนอยู่', support: 'เห็นอีเมลกับเบอร์แบบปิดบางส่วน และเฉพาะแถวของสาม Zip Area (กรองระดับแถว)', analyst: 'ไม่เห็นชื่อ อีเมล หรือเบอร์ มีแค่ Token ของคน Zip สามหลัก ปีเกิด ช่วงเงินเดือน และผลวินิจฉัย' },
    held: (n) => `Analyst ที่ Group ตาม Zip ปีเกิดและผลวินิจฉัยจะมี ${n} กลุ่มที่เล็กกว่า 5 คนซึ่งถูกกันไว้ไม่แสดง`,
    caption: 'คอลัมน์ ห้าแถวแรก และจำนวนแถวมาจากแบบฝึก 08 ที่อ่านผ่าน View จริงของ SQLite โดยมี Authorizer คอยตรวจ ตัวอย่างในภาพเป็นข้อมูลสมมติ',
  },
  en: {
    title: 'Choose a role and see how the same table looks, then try reading the real table directly to see whether it is refused',
    role: 'Role', roles: { admin: 'Admin', support: 'Support', analyst: 'Analyst' },
    legend: [{ kind: 'new', text: 'a value that is hidden or replaced' }, { kind: 'use', text: 'a value as it really is' }],
    rows: 'rows seen', cols: 'columns seen', first: 'first five rows', direct: 'read the real table (customers) directly', allowed: 'allowed, because the admin is granted it directly', denied: 'refused (not authorized): this role may read only its own view',
    note: { admin: 'Sees every column and row, including the notes column that hides phone numbers and e-mails.', support: 'Sees e-mail and phone partly masked, and only the rows of three zip areas (a row level filter).', analyst: 'Sees no name, e-mail or phone: a token, a 3 digit zip, a birth year, a salary band and the diagnosis.' },
    held: (n) => `For an analyst who groups by zip, birth year and diagnosis, ${n} groups of fewer than 5 people are held back.`,
    caption: 'The columns, the first five rows and the row counts come from exercise 08, read through real SQLite views with an authorizer. The sample data in the picture is made up.',
  },
};

const MASKED = (col: string, role: Role) => role === 'admin' ? false : role === 'support' ? col === 'email' || col === 'phone' : col === 'person' || col === 'salary_band';

export default function AccessMaskLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [role, setRole] = useState<Role>('support');
  const [tried, setTried] = useState(false);
  const v = V_[role];
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls" style={{ flexWrap: 'wrap' }}>
        <span className="ib-lbl">{T.role}</span>
        <span className="seg" role="group" aria-label={T.role}>
          {(['admin', 'support', 'analyst'] as Role[]).map((r) => <button key={r} type="button" aria-pressed={role === r} onClick={() => { setRole(r); setTried(false); }}>{T.roles[r]}</button>)}
        </span>
        <button type="button" className="btn sm" onClick={() => setTried(true)}>{T.direct}</button>
      </div>
      <Row>
        <Card style={{ flex: '3 1 420px', overflowX: 'auto' }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>{`${T.first}  ·  ${T.rows}: ${num(v.count)}  ·  ${T.cols}: ${v.columns.length}`}</div>
          <table className="mini-tbl" style={{ fontSize: 13 }}>
            <thead><tr>{v.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {v.rows.map((r, i) => (
                <tr key={i}>{r.map((cell, j) => <td key={j} style={{ ...mono, fontSize: 13, ...(MASKED(v.columns[j], role) ? { color: 'var(--ib-bad)', fontWeight: 700 } : {}) }}>{cell.length > 26 ? `${cell.slice(0, 26)}…` : cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 14, marginTop: 8 }}>{T.note[role]}</div>
          {role === 'analyst' && <div style={{ fontSize: 14, marginTop: 4, color: 'var(--muted)' }}>{T.held(V_.heldBack)}</div>}
        </Card>
        <Card bad={tried && role !== 'admin'} good={tried && role === 'admin'} style={{ flex: '1 1 240px' }}>
          <div style={{ fontFamily: 'var(--mono, monospace)', fontSize: 14 }}>SELECT * FROM customers</div>
          {tried ? <div style={{ fontWeight: 700, marginTop: 8, color: role === 'admin' ? undefined : 'var(--ib-bad)' }}>{role === 'admin' ? `✓ ${T.allowed}` : `✗ ${T.denied}`}</div> : <div style={{ color: 'var(--muted)', marginTop: 8, fontSize: 14 }}>{T.direct}…</div>}
        </Card>
      </Row>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
