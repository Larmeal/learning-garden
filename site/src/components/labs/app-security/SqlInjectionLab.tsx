import { useState } from 'react';
import { Key } from '../data-security/ds';
import type { Lang } from '../spark/stepper';
import data from './injection.json';

// Shows:      the same typed text sent to a login form or a search box, built into a query by joining strings (left) and sent as a parameter (right). Every character of the query is drawn
//             as data (inside quotes, pale), as SQL (plain), or as the user's own text (inside quotes: accent, but outside quotes: red, because it has become SQL). A comment is struck out.
//             Under each query come the rows that really came back from SQLite.
// Because:    "the data became code" is a claim about where a quote character ends up. The typed text turning from accent into red, and the rest of the real query going pale and struck out, is
//             the whole attack. On the right the text travels in a separate box and cannot change colour.
// Control:    the form (login or search) and the input (an honest one and the attacks). Both sides change at once so they can be compared.
// Conclusion: when the input is joined into the text of the query it can end the string and add SQL. When it travels as a parameter it stays a value, the same input finds nothing, and the
//             honest input still works.
//
// The queries and rows are those printed by exercises/08_injection.py --write (injection.json), run on a real SQLite database in memory. Which character is data and which is SQL is
// worked out here by walking the query and counting quotes, the way a SQL parser starts.

type Form = 'login' | 'search';
type Row = (string | number)[];

const TEXT: Record<Lang, {
  title: string; form: string; forms: Record<Form, string>; input: string; naive: string; safe: string; rows: string; none: string; legend: { color: string; text: string; ring?: boolean }[];
  verdictBad: (n: number) => string; verdictOk: string; verdictNone: string; param: string; inputs: Record<string, string>; caption: string; honest: string; attack: string; attack2: string;
  broke: string; stayed: string; box: string; typed: string; seenAs: string; commentNote: string;
}> = {
  th: {
    title: 'เลือกฟอร์มและสิ่งที่พิมพ์ลงไป ดูว่าตัวอักษรของ Query แต่ละตัวเป็นข้อมูลหรือเป็นคำสั่ง SQL และได้แถวอะไรกลับมา ทั้งแบบต่อสตริงกับแบบส่งเป็น Parameter',
    form: 'ฟอร์ม', forms: { login: 'ล็อกอิน', search: 'ค้นหา' }, input: 'สิ่งที่พิมพ์', naive: 'ต่อสตริงเข้าไปใน Query', safe: 'ส่งเป็น Parameter', rows: 'แถวที่ได้', none: '(ไม่มีแถว)',
    legend: [{ color: 'var(--accent)', text: 'ข้อความของผู้ใช้ ที่ยังเป็นข้อมูล' }, { color: 'var(--ib-bad)', text: 'ข้อความของผู้ใช้ ที่กลายเป็นคำสั่ง SQL' }, { color: 'var(--accent-soft)', text: 'ข้อมูลในเครื่องหมายคำพูด', ring: true }],
    verdictBad: (n) => `เสร็จแล้ว ได้ ${n} แถวที่ไม่ควรได้`, verdictOk: 'ทำงานตามปกติ', verdictNone: 'ไม่พบอะไร ข้อความที่พิมพ์ถูกมองเป็นแค่ค่า', param: 'ค่าที่ส่งแยก',
    inputs: { honest: 'ปกติ', attack: "' OR '1'='1", attack2: "admin' --", search: 'pen', union: "zzz' UNION SELECT name, password FROM users --" },
    honest: 'ปกติ', attack: 'แทรก SQL', attack2: 'ตัดการเช็ก Password',
    broke: 'เครื่องหมาย \' ที่พิมพ์ไปปิดสตริงก่อนเวลา ส่วนที่เหลือจึงถูกอ่านเป็นคำสั่ง SQL (ตัวสีแดง) และส่วนที่ถูกคอมเมนต์ทิ้งจะถูกขีดฆ่า', stayed: 'ข้อความทั้งก้อนอยู่ในเครื่องหมายคำพูดตลอด Database เห็นมันเป็นแค่ข้อมูล',
    box: 'ส่งแยกเป็นกล่อง ไม่ผ่านการอ่านเป็นคำสั่ง', typed: 'ข้อความที่ผู้ใช้พิมพ์', seenAs: 'Database เห็นเป็น', commentNote: 'ถูกคอมเมนต์ทิ้ง',
    caption: 'Query และแถวที่เห็นมาจากการรันจริงบน SQLite ใน Memory ในแบบฝึก 08 (injection.json) การแบ่งว่าตัวไหนเป็นข้อมูลหรือคำสั่งคำนวณในหน้านี้ด้วยการนับเครื่องหมายคำพูดแบบที่ SQL Parser เริ่มต้นทำ ข้อมูลทั้งหมดเป็นข้อมูลปลอมของร้านจำลอง',
  },
  en: {
    title: 'Pick a form and what is typed into it, and see which characters of the query are data and which are SQL, and which rows come back, with string joining against a parameter',
    form: 'Form', forms: { login: 'login', search: 'search' }, input: 'what is typed', naive: 'joined into the query as text', safe: 'sent as a parameter', rows: 'rows returned', none: '(no rows)',
    legend: [{ color: 'var(--accent)', text: "the user's text, still data" }, { color: 'var(--ib-bad)', text: "the user's text, now SQL" }, { color: 'var(--accent-soft)', text: 'data inside quotes', ring: true }],
    verdictBad: (n) => `Done: ${n} rows that should not have come back`, verdictOk: 'works as expected', verdictNone: 'nothing found: the typed text was treated as a plain value', param: 'value sent separately',
    inputs: { honest: 'honest', attack: "' OR '1'='1", attack2: "admin' --", search: 'pen', union: "zzz' UNION SELECT name, password FROM users --" },
    honest: 'honest', attack: 'inject SQL', attack2: 'cut off the password check',
    broke: "The ' that was typed closes the string too early, so the rest is read as SQL (the red characters), and whatever is commented out is struck through.", stayed: 'The whole text stays inside the quotes, so the database sees it as plain data.',
    box: 'sent in a separate box, never read as a command', typed: 'what the user typed', seenAs: 'the database sees', commentNote: 'commented out',
    caption: 'The queries and rows come from a real run on in-memory SQLite in exercise 08 (injection.json). Which character is data and which is SQL is worked out on this page by counting quotes, the way a SQL parser starts. All the data is fake data of a toy shop.',
  },
};

const LOGIN_PARTS = (name: string, pw: string) => [["SELECT name, role FROM users WHERE name = '", false], [name, true], ["' AND password = '", false], [pw, true], ["'", false]] as [string, boolean][];
const SEARCH_PARTS = (term: string) => [["SELECT name, price FROM products WHERE name LIKE '%", false], [term, true], ["%'", false]] as [string, boolean][];

type Ch = { c: string; user: boolean; kind: 'sql' | 'data' | 'comment' };
// walk the query: inside a quote it is data, a -- outside a quote starts a comment, and a doubled quote inside a string is an escaped quote
function classify(parts: [string, boolean][]): Ch[] {
  const chars: { c: string; user: boolean }[] = [];
  parts.forEach(([s, u]) => s.split('').forEach((c) => chars.push({ c, user: u })));
  const out: Ch[] = [];
  let inStr = false, comment = false;
  for (let i = 0; i < chars.length; i++) {
    const { c, user } = chars[i];
    if (comment) { out.push({ c, user, kind: 'comment' }); continue; }
    if (c === "'") {
      if (inStr && chars[i + 1]?.c === "'") { out.push({ c, user, kind: 'data' }); out.push({ c: chars[i + 1].c, user: chars[i + 1].user, kind: 'data' }); i++; continue; }
      inStr = !inStr;
      out.push({ c, user, kind: 'sql' });
      continue;
    }
    if (!inStr && c === '-' && chars[i + 1]?.c === '-') { comment = true; out.push({ c, user, kind: 'comment' }); continue; }
    out.push({ c, user, kind: inStr ? 'data' : 'sql' });
  }
  return out;
}

export default function SqlInjectionLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [form, setForm] = useState<Form>('login');
  const [i, setI] = useState(0);
  const cases = form === 'login' ? data.logins : data.searches;
  const idx = Math.min(i, cases.length - 1);
  const c: any = cases[idx];
  const parts = form === 'login' ? LOGIN_PARTS(c.name, c.pw) : SEARCH_PARTS(c.term);
  const chars = classify(parts);
  const broke = chars.some((x) => x.user && x.kind !== 'data');
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
  const mono = { fontFamily: 'var(--mono, monospace)', fontSize: 15, lineHeight: 1.9, wordBreak: 'break-all' } as const;
  const chStyle = (x: Ch): React.CSSProperties => {
    if (x.kind === 'comment') return { opacity: 0.45, textDecoration: 'line-through', background: x.user ? 'color-mix(in srgb, var(--ib-bad) 30%, transparent)' : undefined };
    if (x.user) return x.kind === 'data' ? { background: 'var(--accent)', color: 'var(--on-key, #fff)' } : { background: 'var(--ib-bad)', color: '#fff', fontWeight: 700 };
    if (x.kind === 'data') return { background: 'var(--accent-soft)' };
    return { fontWeight: 700 };
  };
  const card = (title: string, body: React.ReactNode, rows: Row[], verdict: string, bad: boolean, note: string) => (
    <div style={{ flex: '1 1 340px', minWidth: 0, border: `3px solid ${bad ? 'var(--ib-bad)' : 'var(--line-strong)'}`, borderRadius: 12, padding: 14, background: 'var(--surface)' }}>
      <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 17 }}>{title}</div>
      <div style={mono}>{body}</div>
      <div style={{ fontSize: 14, margin: '8px 0 10px', color: 'var(--muted)' }}>{note}</div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>{T.rows}</div>
      {rowsTable(rows)}
      <div style={{ marginTop: 8, fontWeight: 700, color: bad ? 'var(--ib-bad)' : undefined }}>{bad ? '✗ ' : '✓ '}{verdict}</div>
    </div>
  );
  const typedVals: string[] = form === 'login' ? [c.name, c.pw] : [c.term];
  const placeholders = form === 'login' ? ['?', '?'] : ['?'];
  const safeSql: string = form === 'login' ? "SELECT name, role FROM users WHERE name = ? AND password = ?" : c.safeSql;
  const sqlPieces = safeSql.split('?');
  return (
    <figure className="viz ib-fig lg">
      <div className="viz-title">{T.title}</div>
      <Key items={T.legend} />
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
        {card(T.naive, chars.map((x, k) => <span key={k} style={chStyle(x)}>{x.c}</span>), naiveRows, naiveBad ? T.verdictBad(naiveRows.length) : T.verdictOk, naiveBad, broke ? T.broke : T.stayed)}
        {card(T.safe,
          <>
            {sqlPieces.map((p, k) => (
              <span key={k}><span style={{ fontWeight: 700 }}>{p}</span>{k < placeholders.length ? <span style={{ background: 'var(--accent-soft)', border: '2px dashed var(--accent)', borderRadius: 6, padding: '0 6px' }}>?</span> : null}</span>
            ))}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8, fontFamily: 'var(--mono, monospace)' }}>
              {typedVals.map((v, k) => (
                <span key={k} style={{ border: '2px solid var(--accent)', borderRadius: 8, padding: '2px 10px', background: 'var(--accent)', color: 'var(--on-key, #fff)', wordBreak: 'break-all' }}>{`📦 ${v}`}</span>
              ))}
            </div>
          </>,
          safeRows, safeRows.length === 0 && idx > 0 ? T.verdictNone : T.verdictOk, false, T.box)}
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
