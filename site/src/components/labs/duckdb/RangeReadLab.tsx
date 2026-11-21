import { useState } from 'react';
import type { Lang } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import data from './ranges.json';

// Shows:      a Parquet file drawn as a grid (nine row groups, seven columns, and the footer at the end), and which cells a query has to ask the web server for.
// Because:    "ask for only what the query needs" is the difference between a few highlighted cells and the whole grid, and the bytes are the measure of it.
// Control:    the query (five choices). Each one lights a different set of cells and changes the number of requests and the bytes the server really sent.
// Conclusion: count(*) needs the footer, a sum needs one column of every row group, a filter on a sorted column cuts that to the groups that can match, and select * needs the lot.
//
// The requests and the bytes sent are measured by exercises/11_extensions.py --write (ranges.json): a small web server on this computer counted what it sent.
// Which cells are lit follows from what the query needs (its columns, and the row groups whose min and max can match). The exact byte ranges per cell were not recorded.

const COLS = ['order_id', 'customer_id', 'product_id', 'qty', 'unit_price', 'status', 'order_ts'];
const need = (q: number): { footer: boolean; cols: number[]; groups: number[] } => {
  const all = Array.from({ length: 9 }, (_, i) => i);
  switch (q) {
    case 0: return { footer: true, cols: [], groups: [] };
    case 1: return { footer: true, cols: [3], groups: all };
    case 2: return { footer: true, cols: [3, 6], groups: [8] };
    case 3: return { footer: true, cols: [3, 4], groups: all };
    default: return { footer: true, cols: [0, 1, 2, 3, 4, 5, 6], groups: all };
  }
};

const TEXT: Record<Lang, { title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; pick: string; labels: string[]; group: string; footer: string; req: string; bytes: string; ofFile: string; readout: (n: number, b: number, share: number) => string; caption: string }> = {
  th: {
    title: 'เลือก Query แล้วดูว่า DuckDB ขอส่วนไหนของไฟล์ Parquet จาก Web Server และ Server ส่ง Byte ออกไปเท่าไร',
    legend: [{ kind: 'new', text: 'ส่วนที่ Query ต้องขอ' }, { kind: 'skip', text: 'ส่วนที่ไม่ได้ขอ' }],
    pick: 'Query', labels: ['count(*)', 'sum(qty)', 'sum(qty) ท้ายปี', 'sum(qty), sum(unit_price)', 'select *'], group: 'กลุ่ม', footer: 'Footer', req: 'คำขอ', bytes: 'Byte ที่ Server ส่ง', ofFile: 'ของไฟล์',
    readout: (n, b, share) => `${n} คำขอ ส่ง ${b.toLocaleString()} Byte คิดเป็น ${(share * 100).toFixed(1)}% ของไฟล์ 16,911,937 Byte`,
    caption: 'จำนวนคำขอและ Byte ที่ส่งวัดจาก Web Server เล็ก ๆ บนคอมพิวเตอร์เครื่องนี้ (แบบฝึก 11) ส่วนช่องที่ติดสีเป็นสิ่งที่ Query ต้องใช้ (คอลัมน์ที่อ่านกับ Row group ที่ min max ยังอาจตรง) ไม่ได้บันทึกช่วง Byte ของแต่ละช่อง และไฟล์ระยะไกลไม่ใช่ S3',
  },
  en: {
    title: 'Pick a query and see which parts of the Parquet file DuckDB asks the web server for, and how many bytes the server sent',
    legend: [{ kind: 'new', text: 'part the query has to ask for' }, { kind: 'skip', text: 'part not asked for' }],
    pick: 'query', labels: ['count(*)', 'sum(qty)', 'sum(qty) at year end', 'sum(qty), sum(unit_price)', 'select *'], group: 'group', footer: 'footer', req: 'requests', bytes: 'bytes the server sent', ofFile: 'of the file',
    readout: (n, b, share) => `${n} requests sent ${b.toLocaleString()} bytes, which is ${(share * 100).toFixed(1)}% of the file of 16,911,937 bytes.`,
    caption: 'The requests and the bytes sent were measured on a small web server on this computer (exercise 11). The lit cells are what the query needs (the columns it reads and the row groups whose min and max may still match). The byte range of each cell was not recorded, and the remote file is not S3.',
  },
};

export default function RangeReadLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [q, setQ] = useState(1);
  const c = data.cases[q];
  const n = need(q);
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.pick}</span>
        <span className="seg" role="group" aria-label={T.pick}>
          {T.labels.map((l, i) => <button key={l} type="button" aria-pressed={q === i} onClick={() => setQ(i)}>{l}</button>)}
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 400" role="img" aria-label={T.title}>
          {COLS.map((col, j) => <text key={col} x={110 + j * 90 + 40} y={22} textAnchor="middle" className="ib-m" style={{ fontSize: 13 }}>{col}</text>)}
          {Array.from({ length: 9 }, (_, g) => (
            <g key={g}>
              <text x={14} y={52 + g * 30} className="ib-s">{`${T.group} ${g}`}</text>
              {COLS.map((_, j) => {
                const on = n.groups.includes(g) && n.cols.includes(j);
                return <rect key={j} className={on ? 'ib-new' : 'ib-skip'} x={110 + j * 90} y={32 + g * 30} width={80} height={24} rx={5} />;
              })}
            </g>
          ))}
          <rect className={n.footer ? 'ib-new' : 'ib-skip'} x={110} y={314} width={710} height={26} rx={6} />
          <text x={465} y={332} textAnchor="middle" className="ib-n">{T.footer}</text>
          <text x={14} y={372} className="ib-n">{`${T.req}: ${c.requests}`}</text>
          <text x={866} y={370} textAnchor="end" className="ib-big" style={{ fontSize: 30 }}>{`${c.bytes.toLocaleString()} B`}</text>
          <text x={866} y={394} textAnchor="end" className="ib-s">{`${(c.share * 100).toFixed(1)}% ${T.ofFile}`}</text>
          <rect className="ib-skip" x={14} y={382} width={420} height={12} rx={6} />
          <rect className="ib-new" x={14} y={382} width={Math.max(5, 420 * c.share)} height={12} rx={6} />
        </svg>
      </div>
      <div className="readout" aria-live="polite"><div>{T.readout(c.requests, c.bytes, c.share)}</div></div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
