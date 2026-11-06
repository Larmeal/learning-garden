import { useState } from 'react';
import type { Lang } from '../../../i18n';

type Row = { id: number | null; age: number | null; name: string | null };

interface Scenario {
  id: string;
  rows: Row[];
}

// Rows are data and are the same in both languages. Labels and notes are in TEXT.
const SCENARIOS: Scenario[] = [
  { id: 'ok', rows: [{ id: 1, age: 10, name: 'a' }, { id: 2, age: 25, name: 'b' }, { id: 3, age: 30, name: 'c' }, { id: 4, age: 41, name: 'd' }] },
  { id: 'null', rows: [{ id: 1, age: 10, name: 'a' }, { id: 2, age: null, name: 'b' }, { id: 3, age: 30, name: null }, { id: 4, age: 41, name: 'd' }] },
  { id: 'range', rows: [{ id: 1, age: 10, name: 'a' }, { id: 2, age: 25, name: 'b' }, { id: 3, age: 30, name: 'c' }, { id: 4, age: 400, name: 'd' }] },
  { id: 'empty', rows: [] },
  { id: 'allnull', rows: [{ id: 1, age: null, name: 'a' }, { id: 2, age: null, name: 'b' }, { id: 3, age: null, name: 'c' }] },
];

const TEXT: Record<Lang, {
  scenarios: Record<string, { label: string; note: string }>;
  vacuous: (n: number) => string;
  considered: (c: number, u: number) => string;
  noRowsVacuous: string;
  nulls: (n: number, total: number) => string;
  hasRows: (n: number) => string;
  title: string;
  dataLabel: string;
  addRowCount: string;
  noRows: string;
  pass: string;
  fail: string;
  suiteSuccess: string;
}> = {
  th: {
    scenarios: {
      ok: { label: 'ข้อมูลปกติ', note: 'ไม่มีอะไรผิด ทุกข้อควรผ่าน' },
      null: { label: 'มี null', note: 'age และ name มี null อย่างละหนึ่งแถว' },
      range: { label: 'ค่านอกช่วง', note: 'age = 400 อยู่นอก 0 ถึง 120' },
      empty: { label: 'ตารางว่าง', note: 'ไม่มีแถวเลย' },
      allnull: { label: 'age เป็น null ทั้งหมด', note: 'ทุกแถวมี age เป็น null' },
    },
    vacuous: (n) => `ไม่มีแถวให้พิจารณา (element_count=${n}) จึงผ่านโดยปริยาย`,
    considered: (c, u) => `พิจารณา ${c} แถว ผิด ${u} แถว`,
    noRowsVacuous: 'ไม่มีแถว (element_count=0) จึงผ่านโดยปริยาย',
    nulls: (n, total) => `null ${n} จาก ${total} แถว`,
    hasRows: (n) => `มี ${n} แถว`,
    title: 'เปลี่ยนข้อมูลแล้วดูว่า expectation แต่ละข้อตัดสินอย่างไร',
    dataLabel: 'ข้อมูลที่ตรวจ',
    addRowCount: 'เพิ่ม expectation จำนวนแถว',
    noRows: '(ไม่มีแถว)',
    pass: 'ผ่าน',
    fail: 'ไม่ผ่าน',
    suiteSuccess: 'success ของทั้ง suite:',
  },
  en: {
    scenarios: {
      ok: { label: 'Normal data', note: 'Nothing is wrong. Every expectation should pass' },
      null: { label: 'Has null', note: 'age and name each have one null row' },
      range: { label: 'Out of range', note: 'age = 400 is outside 0 to 120' },
      empty: { label: 'Empty table', note: 'There are no rows at all' },
      allnull: { label: 'age all null', note: 'age is null in every row' },
    },
    vacuous: (n) => `No rows to consider (element_count=${n}), so it passes by default`,
    considered: (c, u) => `Considered ${c} rows, ${u} unexpected`,
    noRowsVacuous: 'No rows (element_count=0), so it passes by default',
    nulls: (n, total) => `${n} null in ${total} rows`,
    hasRows: (n) => `${n} rows`,
    title: 'Change the data and see how each expectation decides',
    dataLabel: 'Data being checked',
    addRowCount: 'Add a row count expectation',
    noRows: '(no rows)',
    pass: 'Pass',
    fail: 'Fail',
    suiteSuccess: 'success of the whole suite:',
  },
};

type T = (typeof TEXT)[Lang];

interface Exp {
  id: string;
  label: string;
  kind: 'map' | 'table';
  run: (rows: Row[], t: T) => { success: boolean; detail: string };
}

// Column-map semantics, as read from ColumnMapExpectation._validate and checked by running GX:
// nulls are "missing" and are not counted as unexpected; with no rows to consider, the result is vacuously true.
const mapResult = (rows: Row[], t: T, col: 'age' | 'name' | 'id', bad: (v: any) => boolean, mostly = 1) => {
  const considered = rows.filter((r) => r[col] !== null);
  const unexpected = considered.filter((r) => bad(r[col])).length;
  if (rows.length === 0 || considered.length === 0) {
    return { success: true, detail: t.vacuous(rows.length) };
  }
  const ratio = (considered.length - unexpected) / considered.length;
  return {
    success: ratio >= mostly,
    detail: t.considered(considered.length, unexpected),
  };
};

const EXPS: Exp[] = [
  {
    id: 'nn-age',
    label: 'ExpectColumnValuesToNotBeNull(column="age")',
    kind: 'map',
    run: (rows, t) => {
      if (rows.length === 0) return { success: true, detail: t.noRowsVacuous };
      const nulls = rows.filter((r) => r.age === null).length;
      return { success: nulls === 0, detail: t.nulls(nulls, rows.length) };
    },
  },
  {
    id: 'between',
    label: 'ExpectColumnValuesToBeBetween(column="age", 0..120)',
    kind: 'map',
    run: (rows, t) => mapResult(rows, t, 'age', (v) => v < 0 || v > 120),
  },
  {
    id: 'rows',
    label: 'ExpectTableRowCountToBeBetween(min_value=1)',
    kind: 'table',
    run: (rows, t) => ({ success: rows.length >= 1, detail: t.hasRows(rows.length) }),
  },
];

export default function ResultLab({ initial = 'ok', withRowCount = true, lang = 'th' }: { initial?: string; withRowCount?: boolean; lang?: Lang }) {
  const t = TEXT[lang];
  const [sid, setSid] = useState(initial);
  const [useRows, setUseRows] = useState(withRowCount);
  const sc = SCENARIOS.find((s) => s.id === sid) ?? SCENARIOS[0];
  const exps = EXPS.filter((e) => useRows || e.id !== 'rows');
  const results = exps.map((e) => ({ e, r: e.run(sc.rows, t) }));
  const allOk = results.every((x) => x.r.success);

  return (
    <figure className="viz">
      <div className="viz-title">{t.title}</div>
      <div className="lab-controls">
        <div>
          <div className="lab-label">{t.dataLabel}</div>
          <div className="seg" role="group" aria-label={t.dataLabel}>
            {SCENARIOS.map((s) => (
              <button key={s.id} type="button" aria-pressed={sid === s.id} onClick={() => setSid(s.id)}>{t.scenarios[s.id].label}</button>
            ))}
          </div>
        </div>
        <label className="check">
          <input type="checkbox" checked={useRows} onChange={(e) => setUseRows(e.target.checked)} />
          {t.addRowCount}
        </label>
      </div>

      <div className="gx-split">
        <div className="gx-pane">
          <div className="lab-label">{t.scenarios[sc.id].note}</div>
          <div className="tbl-wrap">
            <table className="mini-tbl">
              <thead><tr><th>id</th><th>age</th><th>name</th></tr></thead>
              <tbody>
                {sc.rows.length === 0 ? (
                  <tr><td colSpan={3} className="is-null">{t.noRows}</td></tr>
                ) : (
                  sc.rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.id}</td>
                      <td className={r.age === null ? 'is-null' : undefined}>{r.age === null ? 'null' : r.age}</td>
                      <td className={r.name === null ? 'is-null' : undefined}>{r.name === null ? 'null' : r.name}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="gx-pane gx-grow">
          <ul className="gx-results" aria-live="polite">
            {results.map(({ e, r }) => (
              <li key={e.id} data-ok={r.success}>
                <span className="gx-badge">{r.success ? t.pass : t.fail}</span>
                <div>
                  <code>{e.label}</code>
                  <div className="gx-detail">{r.detail}</div>
                </div>
              </li>
            ))}
          </ul>
          <div className="readout">
            <span>{t.suiteSuccess} <b>{allOk ? 'True' : 'False'}</b></span>
          </div>
        </div>
      </div>

      <p className="viz-caption">
        {lang === 'en' ? (
          <>
            Pick "{TEXT.en.scenarios.empty.label}": the first two pass although there is no data to check. Tick "{TEXT.en.addRowCount}" and it fails. Now pick
            "{TEXT.en.scenarios.allnull.label}": the between expectation passes because a null is not counted as unexpected. Only{' '}
            <code>ExpectColumnValuesToNotBeNull</code> catches it (every case was checked against the real GX 1.24.1).
          </>
        ) : (
          <>
            ลองเลือก "ตารางว่าง": สองข้อแรกผ่านโดยไม่มีข้อมูลให้ตรวจเลย ติ๊ก "เพิ่ม expectation จำนวนแถว" จึงจะล้ม ส่วน "age เป็น null ทั้งหมด": ข้อ between ผ่านเพราะ null
            ไม่ถูกนับว่าผิด มีแต่ <code>ExpectColumnValuesToNotBeNull</code> ที่จับได้ (ตรวจทุกกรณีกับ GX 1.24.1 จริง)
          </>
        )}
      </p>
    </figure>
  );
}
