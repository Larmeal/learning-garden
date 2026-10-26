import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

const COLS = ['id', 'country', 'city', 'sales'];
const ROWS: (string | number | null)[][] = [
  [1, 'th', 'bkk', 120],
  [2, 'th', 'cnx', 80],
  [3, 'jp', 'tyo', 200],
  [4, 'jp', 'osa', null],
  [5, 'sg', 'sin', 90],
];
const COLOR = ['var(--k1)', 'var(--k2)', 'var(--k3)', 'var(--accent)'];
const TOTAL = ROWS.length * COLS.length;

type Fmt = 'csv' | 'parquet';

export default function FormatLab() {
  const [fmt, setFmt] = useState<Fmt>('csv');
  const [col, setCol] = useState(3);
  const reduce = useReducedMotion();

  // Cells in the order they sit on disk: CSV keeps a row together, Parquet keeps a column together.
  const order: { r: number; c: number }[] = [];
  if (fmt === 'csv') ROWS.forEach((_, r) => COLS.forEach((__, c) => order.push({ r, c })));
  else COLS.forEach((_, c) => ROWS.forEach((__, r) => order.push({ r, c })));

  const isRead = (c: number) => fmt === 'csv' || c === col;
  const readCount = fmt === 'csv' ? TOTAL : ROWS.length;

  return (
    <figure className="viz">
      <div className="viz-title">ลองเลือกคอลัมน์ แล้วดูว่า Spark ต้องอ่านอะไรจาก disk</div>

      <div className="lab-controls">
        <div className="seg" role="group" aria-label="รูปแบบไฟล์">
          <button type="button" aria-pressed={fmt === 'csv'} onClick={() => setFmt('csv')}>CSV (เก็บทีละแถว)</button>
          <button type="button" aria-pressed={fmt === 'parquet'} onClick={() => setFmt('parquet')}>Parquet (เก็บทีละคอลัมน์)</button>
        </div>
        <div className="seg" role="group" aria-label="คอลัมน์ที่ต้องการ">
          {COLS.map((c, i) => (
            <button key={c} type="button" aria-pressed={i === col} onClick={() => setCol(i)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="viz-box" style={{ padding: 16 }}>
        <div className="stack" style={{ gap: 18 }}>
          <div>
            <div className="lab-label">ตารางที่คุณเห็น</div>
            <div className="tbl-wrap">
              <table className="mini-tbl">
                <thead>
                  <tr>
                    {COLS.map((c, i) => (
                      <th key={c} data-sel={i === col || undefined}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row, r) => (
                    <tr key={r}>
                      {row.map((v, c) => (
                        <td key={c} data-read={isRead(c) || undefined} className={v === null ? 'is-null' : undefined}>
                          {v === null ? 'NULL' : v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="lab-label">ลำดับที่เก็บบน disk (สีเดียวกัน = คอลัมน์เดียวกัน)</div>
            <div className="strip" aria-hidden="true">
              {order.map(({ r, c }) => (
                <motion.span
                  key={`${r}-${c}`}
                  layout={!reduce}
                  transition={{ duration: reduce ? 0 : 0.5, ease: 'easeInOut' }}
                  animate={{ opacity: isRead(c) ? 1 : 0.16, scale: isRead(c) ? 1 : 0.82 }}
                  style={{ background: COLOR[c] }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="readout" aria-live="polite">
        <span>อ่านจาก disk <b>{readCount}</b> จาก {TOTAL} ช่อง</span>
        <span>คำสั่งที่เทียบเท่า <code>df.select("{COLS[col]}")</code></span>
      </div>
      <p className="viz-caption">
        {fmt === 'csv'
          ? 'CSV เก็บข้อมูลแถวละบรรทัด ช่องของแต่ละแถวติดกัน การอ่านคอลัมน์เดียวจึงต้องอ่านทั้งบรรทัดของทุกแถวแล้วตัดทิ้ง'
          : 'Parquet เก็บข้อมูลของคอลัมน์เดียวกันไว้ติดกัน อ่านเฉพาะคอลัมน์ที่ต้องใช้ได้เลย ยิ่งตารางกว้าง ผลต่างยิ่งมาก'}
      </p>
    </figure>
  );
}
