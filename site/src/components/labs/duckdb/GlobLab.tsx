import { useState } from 'react';
import type { Lang } from '../spark/timeline';
import { Legend, Node } from '../iceberg/ib';
import data from './files.json';

// Shows:      twelve files of a Hive-style folder (y=2025/m=1 ... m=12) and which of them DuckDB opens for the filter we pick.
// Because:    "a filter can skip a whole file" is true only for columns that are in the folder name, and that difference is easy to miss in a table of numbers.
// Control:    the filter (six choices). Each choice changes which of the twelve boxes are opened or skipped, and the rows the scan returns.
// Conclusion: a filter on a column that is in the folder name (m, y) opens only the matching files, and a filter on a column inside the files opens all twelve.
//
// The number of files opened and the rows returned come from exercises/02_query_files.py --write (files.json): the engine's own profile. Which months are opened
// follows from the filter text (m = 3 means month 3) and the lab checks it against the count of the profile.

const CASES = data.cases;
const ALL = Array.from({ length: 12 }, (_, i) => i + 1);
const OPEN: number[][] = [ALL, [3], [3, 4], [], ALL, ALL];
const INSIDE = [false, false, false, false, true, true];

const TEXT: Record<Lang, { title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; pick: string; labels: string[]; readout: (open: number, rows: number, inside: boolean, folder: boolean) => string; opened: string; skipped: string; rows: string; caption: string }> = {
  th: {
    title: 'เลือก Filter แล้วดูว่า DuckDB เปิดไฟล์ไหนบ้างจากทั้งหมด 12 ไฟล์',
    legend: [{ kind: 'new', text: 'ไฟล์ที่ถูกเปิด' }, { kind: 'skip', text: 'ไฟล์ที่ถูกข้าม' }],
    pick: 'Filter',
    labels: ['ไม่มี Filter', 'm = 3', 'm in (3, 4)', 'y = 2024', 'order_ts >= 2025-12-01', "status = 'refunded'"],
    readout: (open, rows, inside) => (inside
      ? `เปิด ${open} จาก 12 ไฟล์ เพราะคอลัมน์ที่กรองอยู่ข้างในไฟล์ ไม่ได้อยู่ในชื่อโฟลเดอร์ จึงต้องเปิดทุกไฟล์แล้วค่อยตัดแถว Scan คืน ${rows.toLocaleString()} แถว`
      : open === 0 ? 'ไม่มีโฟลเดอร์ y=2024 เลย จึงไม่ต้องเปิดไฟล์ไหน' : open === 12 ? `เปิด 12 จาก 12 ไฟล์ เพราะไม่มี Filter Scan คืน ${rows.toLocaleString()} แถว` : `เปิด ${open} จาก 12 ไฟล์ ดูจากชื่อโฟลเดอร์ก็รู้แล้ว ไม่ต้องเปิดไฟล์อื่น Scan คืน ${rows.toLocaleString()} แถว`),
    opened: 'เปิด', skipped: 'ข้าม', rows: 'แถว',
    caption: 'จำนวนไฟล์ที่เปิดและจำนวนแถวที่ Scan คืนมาจากแบบฝึก 02 (Profile ที่ Engine เขียนเอง กับ Order หนึ่งล้านแถวที่เขียนเป็น Parquet แยกเดือน) ส่วนไฟล์ที่ถูกเปิดคือเดือนที่ตรงกับ Filter',
  },
  en: {
    title: 'Pick a filter and see which of the 12 files DuckDB opens',
    legend: [{ kind: 'new', text: 'file that is opened' }, { kind: 'skip', text: 'file that is skipped' }],
    pick: 'filter',
    labels: ['no filter', 'm = 3', 'm in (3, 4)', 'y = 2024', 'order_ts >= 2025-12-01', "status = 'refunded'"],
    readout: (open, rows, inside) => (inside
      ? `${open} of 12 files are opened, because the filtered column is inside the files and not in the folder names, so every file is opened and the rows are cut afterwards. The scan returns ${rows.toLocaleString()} rows`
      : open === 0 ? 'There is no folder y=2024, so no file has to be opened' : open === 12 ? `${open} of 12 files are opened, because there is no filter. The scan returns ${rows.toLocaleString()} rows` : `${open} of 12 files are opened. The folder names alone are enough, so the other files are never touched. The scan returns ${rows.toLocaleString()} rows`),
    opened: 'opened', skipped: 'skipped', rows: 'rows',
    caption: 'The number of files opened and the rows the scan returned come from exercise 02 (the profile that the engine writes itself, with one million orders written as Parquet split by month). The files that are opened are the months that match the filter.',
  },
};

export default function GlobLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [k, setK] = useState(1);
  const c = CASES[k];
  const open = OPEN[k];
  const folder = !INSIDE[k];
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.pick}</span>
        <span className="seg" role="group" aria-label={T.pick}>
          {T.labels.map((l, i) => (
            <button key={l} type="button" aria-pressed={k === i} onClick={() => setK(i)}>{l}</button>
          ))}
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 300" role="img" aria-label={T.title}>
          <text x={14} y={26} className="ib-m">y=2025/</text>
          {data.files.map((f, i) => {
            const col = i % 6;
            const row = Math.floor(i / 6);
            const x = 14 + col * 144;
            const y = 44 + row * 108;
            const isOpen = open.includes(f.month);
            return (
              <g key={f.month}>
                <Node x={x} y={y} w={132} h={84} title={`m=${f.month}`} sub={`${f.rows.toLocaleString()} ${T.rows}`} state={isOpen ? 'new' : 'skip'} tag={isOpen ? T.opened : T.skipped} mono={false} />
              </g>
            );
          })}
          <text x={14} y={284} className="ib-n">{T.labels[k]}</text>
          <text x={866} y={284} className="ib-big" textAnchor="end" style={{ fontSize: 30 }}>{`${c.files} / 12`}</text>
        </svg>
      </div>
      <div className="readout" aria-live="polite"><div>{T.readout(c.files, c.rows, INSIDE[k], folder)}</div></div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
