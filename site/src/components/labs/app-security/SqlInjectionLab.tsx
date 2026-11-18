import { useState } from 'react';
import { Legend } from '../iceberg/ib';
import type { Lang } from '../spark/stepper';
import data from './injection.json';

// Shows:      the same input sent to a login form or a search box, built into a query by string joining (left) and by a parameter (right). The part that came from
//             the user is highlighted inside the query, with the rows that really came back from SQLite.
// Because:    "the data became code" is a claim about where a quote character ends up. The highlighted part going from inside a string to outside it is the whole attack.
// Control:    the form (login or search) and the input (an honest one and the attack). Both sides change at once so they can be compared.
// Conclusion: when the input is joined into the text of the query it can end the string and add SQL. When it travels as a parameter it stays a value, the same
//             input finds nothing, and the honest input still works.
//
// The queries and rows are those printed by exercises/08_injection.py --write (injection.json), run on a real SQLite database in memory.

type Form = 'login' | 'search';
type Row = (string | number)[];

const TEXT: Record<Lang, {
  title: string; form: string; forms: Record<Form, string>; input: string; naive: string; safe: string; rows: string; none: string; legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[];
  verdictBad: (n: number) => string; verdictOk: string; verdictNone: string; param: string; inputs: Record<string, string>; caption: string; honest: string; attack: string; attack2: string;
}> = {
  th: {
    title: 'เลือกฟอร์มและสิ่งที่พิมพ์ลงไป ดูว่าข้อความที่ผู้ใช้พิมพ์ไปอยู่ตรงไหนของ Query และได้แถวอะไรกลับมา ทั้งแบบต่อสตริงกับแบบส่งเป็น Parameter',
    form: 'ฟอร์ม', forms: { login: 'ล็อกอิน', search: 'ค้นหา' }, input: 'สิ่งที่พิมพ์', naive: 'ต่อสตริงเข้าไปใน Query', safe: 'ส่งเป็น Parameter', rows: 'แถวที่ได้', none: '(ไม่มีแถว)',
    legend: [{ kind: 'new', text: 'ส่วนที่มาจากผู้ใช้' }, { kind: 'use', text: 'ส่วนที่นักพัฒนาเขียน' }],
    verdictBad: (n) => `เสร็จแล้ว ได้ ${n} แถวที่ไม่ควรได้`, verdictOk: 'ทำงานตามปกติ', verdictNone: 'ไม่พบอะไร ข้อความที่พิมพ์ถูกมองเป็นแค่ค่า', param: 'ค่าที่ส่งแยก',
    inputs: { honest: 'ปกติ', attack: "' OR '1'='1", attack2: "admin' --", search: 'pen', union: "zzz' UNION SELECT name, password FROM users --" },
    honest: 'ปกติ', attack: 'แทรก SQL', attack2: 'ตัดการเช็ก Password',
    caption: 'Query และแถวที่เห็นมาจากการรันจริงบน SQLite ใน Memory ในแบบฝึก 08 (injection.json) ข้อมูลทั้งหมดเป็นข้อมูลปลอมของร้านจำลอง',
  },
  en: {
    title: 'Pick a form and what is typed into it, and see where the typed text lands in the query and which rows come back, with string joining against a parameter',
    form: 'Form', forms: { login: 'login', search: 'search' }, input: 'what is typed', naive: 'joined into the query as text', safe: 'sent as a parameter', rows: 'rows returned', none: '(no rows)',
    legend: [{ kind: 'new', text: 'the part that came from the user' }, { kind: 'use', text: 'the part the developer wrote' }],
    verdictBad: (n) => `Done: ${n} rows that should not have come back`, verdictOk: 'works as expected', verdictNone: 'nothing found: the typed text was treated as a plain value', param: 'value sent separately',
    inputs: { honest: 'honest', attack: "' OR '1'='1", attack2: "admin' --", search: 'pen', union: "zzz' UNION SELECT name, password FROM users --" },
    honest: 'honest', attack: 'inject SQL', attack2: 'cut off the password check',
    caption: 'The queries and rows come from a real run on in-memory SQLite in exercise 08 (injection.json). All the data is fake data of a toy shop.',
  },
};

const LOGIN_PARTS = (name: string, pw: string) => [["SELECT name, role FROM users WHERE name = '", false], [name, true], ["' AND password = '", false], [pw, true], ["'", false]] as [string, boolean][];
const SEARCH_PARTS = (term: string) => [["SELECT name, price FROM products WHERE name LIKE '%", false], [term, true], ["%'", false]] as [string, boolean][];

export default function SqlInjectionLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [form, setForm] = useState<Form>('login');
  const [i, setI] = useState(0);
  const cases = form === 'login' ? data.logins : data.searches;
  const idx = Math.min(i, cases.length - 1);
  const c: any = cases[idx];
  const parts = form === 'login' ? LOGIN_PARTS(c.name, c.pw) : SEARCH_PARTS(c.term);
  const naiveRows: Row[] = c.naiveRows;
  const safeRows: Row[] = c.safeRows;
  const honestRows = form === 'login' ? 1 : data.searches[0].naiveRows.length;
  const labels = form === 'login' ? [T.honest, T.attack, T.attack2] : [T.inputs.search, 'UNION'];
  const rowsTable = (rows: Row[]) => (
    <div className="tbl-wrap"><table className="mini-tbl"><tbody>
      {rows.length === 0 ? <tr><td>{T.none}</td></tr> : rows.map((r, k) => <tr key={k}>{r.map((v, j) => <td key={j}>{String(v)}</td>)}</tr>)}
    </tbody></table></div>
  );
  const naiveBad = naiveRows.length > honestRows || (form === 'login' && idx > 0 && naiveRows.length > 0);
  const card = (title: string, body: React.ReactNode, rows: Row[], verdict: string, bad: boolean) => (
    <div style={{ flex: '1 1 320px', minWidth: 0, border: `2px solid ${bad ? 'var(--ib-bad)' : 'var(--line-strong)'}`, borderRadius: 12, padding: 12, background: 'var(--surface)' }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div style={{ fontFamily: 'var(--mono, monospace)', fontSize: 14, lineHeight: 1.6, wordBreak: 'break-word', marginBottom: 10 }}>{body}</div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>{T.rows}</div>
      {rowsTable(rows)}
      <div style={{ marginTop: 8, fontWeight: 700, color: bad ? 'var(--ib-bad)' : undefined }}>{bad ? '✗ ' : '✓ '}{verdict}</div>
    </div>
  );
  const hi = { background: 'var(--accent)', color: 'var(--on-key, #fff)', borderRadius: 4, padding: '0 3px' } as const;
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls" style={{ flexWrap: 'wrap' }}>
        <span className="ib-lbl">{T.form}</span>
        <span className="seg" role="group" aria-label={T.form}>
          {(['login', 'search'] as Form[]).map((f) => <button key={f} type="button" aria-pressed={form === f} onClick={() => { setForm(f); setI(0); }}>{T.forms[f]}</button>)}
        </span>
        <span className="ib-lbl">{T.input}</span>
        <span className="seg" role="group" aria-label={T.input} style={{ flexWrap: 'wrap' }}>
          {labels.map((l, k) => <button key={l} type="button" aria-pressed={idx === k} onClick={() => setI(k)}>{l}</button>)}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'stretch', marginBottom: 6 }}>
        {card(T.naive, parts.map(([s, user], k) => <span key={k} style={user ? hi : undefined}>{s}</span>), naiveRows, naiveBad ? T.verdictBad(naiveRows.length) : T.verdictOk, naiveBad)}
        {card(T.safe, form === 'login'
          ? <><span>SELECT name, role FROM users WHERE name = </span><span style={hi}>?</span><span> AND password = </span><span style={hi}>?</span><br /><span style={{ color: 'var(--muted)' }}>{T.param}: </span><span style={hi}>{JSON.stringify([c.name, c.pw])}</span></>
          : <><span>{c.safeSql.replace('?', '')}</span><span style={hi}>?</span><br /><span style={{ color: 'var(--muted)' }}>{T.param}: </span><span style={hi}>{JSON.stringify(c.safeParam)}</span></>,
        safeRows, safeRows.length === 0 && idx > 0 ? T.verdictNone : T.verdictOk, false)}
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
