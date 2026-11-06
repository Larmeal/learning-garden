import { useState } from 'react';
import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { Lang } from './stepper';

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

const TEXT: Record<Lang, {
  title: string;
  fmtAria: string;
  csv: string;
  parquet: string;
  colAria: string;
  seen: string;
  disk: string;
  readout: (n: number, total: number) => ReactNode;
  equiv: string;
  capCsv: string;
  capParquet: string;
}> = {
  th: {
    title: 'ลองเลือกคอลัมน์ แล้วดูว่า Spark ต้องอ่านอะไรจาก disk',
    fmtAria: 'รูปแบบไฟล์',
    csv: 'CSV (เก็บทีละแถว)',
    parquet: 'Parquet (เก็บทีละคอลัมน์)',
    colAria: 'คอลัมน์ที่ต้องการ',
    seen: 'ตารางที่คุณเห็น',
    disk: 'ลำดับที่เก็บบน disk (สีเดียวกัน = คอลัมน์เดียวกัน)',
    readout: (n, total) => <>อ่านจาก disk <b>{n}</b> จาก {total} ช่อง</>,
    equiv: 'คำสั่งที่เทียบเท่า',
    capCsv: 'CSV เก็บข้อมูลแถวละบรรทัด ช่องของแต่ละแถวติดกัน การอ่านคอลัมน์เดียวจึงต้องอ่านทั้งบรรทัดของทุกแถวแล้วตัดทิ้ง',
    capParquet: 'Parquet เก็บข้อมูลของคอลัมน์เดียวกันไว้ติดกัน อ่านเฉพาะคอลัมน์ที่ต้องใช้ได้เลย ยิ่งตารางกว้าง ผลต่างยิ่งมาก',
  },
  en: {
    title: 'Pick a column and see what Spark has to read from disk',
    fmtAria: 'File format',
    csv: 'CSV (stored row by row)',
    parquet: 'Parquet (stored column by column)',
    colAria: 'Column you need',
    seen: 'The table you see',
    disk: 'Order stored on disk (same color = same column)',
    readout: (n, total) => <>Read <b>{n}</b> of {total} cells from disk</>,
    equiv: 'Equivalent command',
    capCsv: 'CSV stores one row per line, with the cells of each row next to each other. To read one column, Spark must read the whole line of every row and then throw most of it away.',
    capParquet: 'Parquet stores the values of one column next to each other. It can read only the column it needs. The wider the table, the bigger the difference.',
  },
};

type Fmt = 'csv' | 'parquet';

export default function FormatLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
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
      <div className="viz-title">{T.title}</div>

      <div className="lab-controls">
        <div className="seg" role="group" aria-label={T.fmtAria}>
          <button type="button" aria-pressed={fmt === 'csv'} onClick={() => setFmt('csv')}>{T.csv}</button>
          <button type="button" aria-pressed={fmt === 'parquet'} onClick={() => setFmt('parquet')}>{T.parquet}</button>
        </div>
        <div className="seg" role="group" aria-label={T.colAria}>
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
            <div className="lab-label">{T.seen}</div>
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
            <div className="lab-label">{T.disk}</div>
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
        <span>{T.readout(readCount, TOTAL)}</span>
        <span>{T.equiv} <code>df.select("{COLS[col]}")</code></span>
      </div>
      <p className="viz-caption">
        {fmt === 'csv'
          ? T.capCsv
          : T.capParquet}
      </p>
    </figure>
  );
}
