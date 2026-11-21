import { useState } from 'react';
import type { Lang } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import data from './rowgroups.json';

// Shows:      the 10 row groups of a Parquet file as ten bars, each stretching from the smallest to the largest order_id it holds, and a vertical
//             line for the filter order_id > X that the reader drags. A group whose largest id is below the line cannot hold an answer and is skipped.
// Because:    "the statistics let a scan skip data" depends on whether the ranges overlap, and only a picture of the ranges shows when they do not.
// Control:    the slider (the value X) and the two files (rows written in order, rows shuffled). Dragging the line changes how many bars are skipped;
//             for the shuffled file every bar spans the whole axis, so none is ever skipped.
// Conclusion: a filter can skip a row group only when its min and max rule the filter out, which a file sorted on that column makes possible.
//
// The min and max of each group are read from the real files with pyarrow (exercises/07_reading_and_writing.py --write).

type File = 'sorted' | 'unsorted';
const X0 = 150;
const X1 = 850;
const sx = (v: number) => X0 + (v / data.rows) * (X1 - X0);
const Y0 = 70;
const RH = 30;

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; file: string; files: Record<File, string>; thr: string;
  read: (n: number, of: number) => string; group: string; skipTag: string; readTag: string; caption: string; means: (f: File, n: number, of: number) => string; axis: string;
}> = {
  th: {
    title: 'Row Group 10 ก้อนของไฟล์ Parquet ลากเส้นเงื่อนไข order_id > X แล้วดูว่าก้อนไหนข้ามได้',
    legend: [{ kind: 'new', text: 'ต้องเปิดอ่าน (อาจมีคำตอบ)' }, { kind: 'skip', text: 'ข้ามได้ (Max ไม่ถึงเส้น)' }],
    file: 'ไฟล์', files: { sorted: 'แถวเรียงตาม order_id', unsorted: 'แถวสลับลำดับ' },
    thr: 'ค่า X', group: 'ก้อน', skipTag: 'ข้าม', readTag: 'อ่าน', axis: 'order_id',
    read: (n, of) => `ต้องเปิด ${n} จาก ${of} ก้อน`,
    means: (f, n, of) => f === 'sorted'
      ? `ไฟล์ที่เรียงแล้ว แต่ละก้อนมีช่วงของตัวเอง จึงข้ามได้ ${of - n} ก้อน`
      : 'ไฟล์ที่สลับแถว ทุกก้อนมีทั้งค่าน้อยและมาก ช่วงของทุกก้อนยาวเกือบทั้งแกน จึงข้ามไม่ได้เลย',
    caption: 'ค่า Min และ Max ของแต่ละก้อนอ่านจากไฟล์จริง 1,000,000 แถวด้วย pyarrow (แบบฝึก 07) ก้อนละ 100,000 แถว ภาพนี้แสดงเฉพาะเหตุผลของการข้าม ไม่ได้วัดเวลาที่เร็วขึ้น',
  },
  en: {
    title: 'The 10 row groups of a Parquet file. Drag the filter line order_id > X and see which groups can be skipped',
    legend: [{ kind: 'new', text: 'must be opened (may hold an answer)' }, { kind: 'skip', text: 'can be skipped (max is below the line)' }],
    file: 'File', files: { sorted: 'rows sorted by order_id', unsorted: 'rows shuffled' },
    thr: 'value X', group: 'group', skipTag: 'skip', readTag: 'read', axis: 'order_id',
    read: (n, of) => `${n} of ${of} groups must be opened`,
    means: (f, n, of) => f === 'sorted'
      ? `A sorted file: every group has its own range, so ${of - n} group${of - n === 1 ? '' : 's'} can be skipped`
      : 'A shuffled file: every group holds small and large values, each range spans almost the whole axis, so nothing can be skipped',
    caption: 'The min and max of every group are read from a real 1,000,000-row file with pyarrow (exercise 07), 100,000 rows per group. The picture shows the reason for skipping, not the time saved.',
  },
};

export default function RowGroupLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [file, setFile] = useState<File>('sorted');
  const [x, setX] = useState(250_000);
  const groups = data[file] as number[][];
  const n = groups.filter(([, mx]) => mx > x).length;

  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.file}</span>
        <div className="seg" role="group" aria-label={T.file}>
          {(['sorted', 'unsorted'] as File[]).map((f) => (
            <button key={f} type="button" aria-pressed={file === f} onClick={() => setFile(f)}>{T.files[f]}</button>
          ))}
        </div>
      </div>
      <div className="ib-controls">
        <label className="ib-lbl" htmlFor="rg-x">{T.thr}: order_id &gt; <b style={{ fontFamily: 'var(--mono)' }}>{x.toLocaleString('en-US')}</b></label>
        <input id="rg-x" type="range" min={0} max={data.rows} step={10_000} value={x} onChange={(e) => setX(Number(e.target.value))} style={{ flex: '1 1 260px', minWidth: 200 }} />
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 476" role="img" aria-label={T.title}>
          {[0, 250_000, 500_000, 750_000, 1_000_000].map((v) => (
            <g key={v}>
              <path className="ib-line" d={`M${sx(v)},${Y0 - 6} L${sx(v)},${Y0 + groups.length * RH}`} style={{ opacity: 0.4, strokeDasharray: '2 4' }} />
              <text x={sx(v)} y={Y0 - 16} textAnchor={v === 0 ? 'start' : v === data.rows ? 'end' : 'middle'} className="ib-m">{v === 0 ? '0' : v === data.rows ? '1,000,000' : v.toLocaleString('en-US')}</text>
            </g>
          ))}
          {groups.map(([mn, mx], i) => {
            const skip = mx <= x;
            return (
              <g key={i} style={{ opacity: skip ? 0.6 : 1 }}>
                <text x={20} y={Y0 + i * RH + 18} className="ib-n">{T.group} {i + 1}</text>
                <text x={X0 - 12} y={Y0 + i * RH + 18} textAnchor="end" className="ib-m" style={{ fontSize: 13, fill: skip ? 'var(--ib-bad)' : 'var(--muted)' }}>{skip ? `✗ ${T.skipTag}` : `✓ ${T.readTag}`}</text>
                <rect className={skip ? 'ib-skip' : 'ib-new'} x={sx(mn)} y={Y0 + i * RH + 2} width={Math.max(6, sx(mx) - sx(mn))} height={RH - 8} rx={6} />
              </g>
            );
          })}
          <path d={`M${sx(x)},${Y0 - 4} L${sx(x)},${Y0 + groups.length * RH + 6}`} style={{ stroke: 'var(--ib-bad)', strokeWidth: 3 }} fill="none" />
          <text x={sx(x)} y={Y0 + groups.length * RH + 28} textAnchor="middle" className="ib-n" style={{ fill: 'var(--ib-bad)' }}>{T.axis} &gt; {x.toLocaleString('en-US')}</text>
          <g>
            <rect className="ib-banner" x={12} y={428} width={856} height={40} rx={10} />
            <text x={26} y={453} className="ib-n">{T.means(file, n, groups.length)}</text>
          </g>
        </svg>
      </div>
      <div className="readout"><span>{T.read(n, groups.length)}</span></div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
