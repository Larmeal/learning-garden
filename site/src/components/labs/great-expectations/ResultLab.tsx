import { useState } from 'react';

type Row = { id: number | null; age: number | null; name: string | null };

interface Scenario {
  id: string;
  label: string;
  rows: Row[];
  note: string;
}

const SCENARIOS: Scenario[] = [
  { id: 'ok', label: 'ข้อมูลปกติ', rows: [{ id: 1, age: 10, name: 'a' }, { id: 2, age: 25, name: 'b' }, { id: 3, age: 30, name: 'c' }, { id: 4, age: 41, name: 'd' }], note: 'ไม่มีอะไรผิด ทุกข้อควรผ่าน' },
  { id: 'null', label: 'มี null', rows: [{ id: 1, age: 10, name: 'a' }, { id: 2, age: null, name: 'b' }, { id: 3, age: 30, name: null }, { id: 4, age: 41, name: 'd' }], note: 'age และ name มี null อย่างละหนึ่งแถว' },
  { id: 'range', label: 'ค่านอกช่วง', rows: [{ id: 1, age: 10, name: 'a' }, { id: 2, age: 25, name: 'b' }, { id: 3, age: 30, name: 'c' }, { id: 4, age: 400, name: 'd' }], note: 'age = 400 อยู่นอก 0 ถึง 120' },
  { id: 'empty', label: 'ตารางว่าง', rows: [], note: 'ไม่มีแถวเลย' },
  { id: 'allnull', label: 'age เป็น null ทั้งหมด', rows: [{ id: 1, age: null, name: 'a' }, { id: 2, age: null, name: 'b' }, { id: 3, age: null, name: 'c' }], note: 'ทุกแถวมี age เป็น null' },
];

interface Exp {
  id: string;
  label: string;
  kind: 'map' | 'table';
  run: (rows: Row[]) => { success: boolean; detail: string };
}

// Column-map semantics, as read from ColumnMapExpectation._validate and checked by running GX:
// nulls are "missing" and are not counted as unexpected; with no rows to consider, the result is vacuously true.
const mapResult = (rows: Row[], col: 'age' | 'name' | 'id', bad: (v: any) => boolean, mostly = 1) => {
  const considered = rows.filter((r) => r[col] !== null);
  const unexpected = considered.filter((r) => bad(r[col])).length;
  if (rows.length === 0 || considered.length === 0) {
    return { success: true, detail: `ไม่มีแถวให้พิจารณา (element_count=${rows.length}) จึงผ่านโดยปริยาย` };
  }
  const ratio = (considered.length - unexpected) / considered.length;
  return {
    success: ratio >= mostly,
    detail: `พิจารณา ${considered.length} แถว ผิด ${unexpected} แถว`,
  };
};

const EXPS: Exp[] = [
  {
    id: 'nn-age',
    label: 'ExpectColumnValuesToNotBeNull(column="age")',
    kind: 'map',
    run: (rows) => {
      if (rows.length === 0) return { success: true, detail: 'ไม่มีแถว (element_count=0) จึงผ่านโดยปริยาย' };
      const nulls = rows.filter((r) => r.age === null).length;
      return { success: nulls === 0, detail: `null ${nulls} จาก ${rows.length} แถว` };
    },
  },
  {
    id: 'between',
    label: 'ExpectColumnValuesToBeBetween(column="age", 0..120)',
    kind: 'map',
    run: (rows) => mapResult(rows, 'age', (v) => v < 0 || v > 120),
  },
  {
    id: 'rows',
    label: 'ExpectTableRowCountToBeBetween(min_value=1)',
    kind: 'table',
    run: (rows) => ({ success: rows.length >= 1, detail: `มี ${rows.length} แถว` }),
  },
];

export default function ResultLab({ initial = 'ok', withRowCount = true }: { initial?: string; withRowCount?: boolean }) {
  const [sid, setSid] = useState(initial);
  const [useRows, setUseRows] = useState(withRowCount);
  const sc = SCENARIOS.find((s) => s.id === sid) ?? SCENARIOS[0];
  const exps = EXPS.filter((e) => useRows || e.id !== 'rows');
  const results = exps.map((e) => ({ e, r: e.run(sc.rows) }));
  const allOk = results.every((x) => x.r.success);

  return (
    <figure className="viz">
      <div className="viz-title">เปลี่ยนข้อมูลแล้วดูว่า expectation แต่ละข้อตัดสินอย่างไร</div>
      <div className="lab-controls">
        <div>
          <div className="lab-label">ข้อมูลที่ตรวจ</div>
          <div className="seg" role="group" aria-label="ข้อมูลที่ตรวจ">
            {SCENARIOS.map((s) => (
              <button key={s.id} type="button" aria-pressed={sid === s.id} onClick={() => setSid(s.id)}>{s.label}</button>
            ))}
          </div>
        </div>
        <label className="check">
          <input type="checkbox" checked={useRows} onChange={(e) => setUseRows(e.target.checked)} />
          เพิ่ม expectation จำนวนแถว
        </label>
      </div>

      <div className="gx-split">
        <div className="gx-pane">
          <div className="lab-label">{sc.note}</div>
          <div className="tbl-wrap">
            <table className="mini-tbl">
              <thead><tr><th>id</th><th>age</th><th>name</th></tr></thead>
              <tbody>
                {sc.rows.length === 0 ? (
                  <tr><td colSpan={3} className="is-null">(ไม่มีแถว)</td></tr>
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
                <span className="gx-badge">{r.success ? 'ผ่าน' : 'ไม่ผ่าน'}</span>
                <div>
                  <code>{e.label}</code>
                  <div className="gx-detail">{r.detail}</div>
                </div>
              </li>
            ))}
          </ul>
          <div className="readout">
            <span>success ของทั้ง suite: <b>{allOk ? 'True' : 'False'}</b></span>
          </div>
        </div>
      </div>

      <p className="viz-caption">
        ลองเลือก "ตารางว่าง": สองข้อแรกผ่านโดยไม่มีข้อมูลให้ตรวจเลย ติ๊ก "เพิ่ม expectation จำนวนแถว" จึงจะล้ม ส่วน "age เป็น null ทั้งหมด": ข้อ between ผ่านเพราะ null
        ไม่ถูกนับว่าผิด มีแต่ <code>ExpectColumnValuesToNotBeNull</code> ที่จับได้ (ตรวจทุกกรณีกับ GX 1.24.1 จริง)
      </p>
    </figure>
  );
}
