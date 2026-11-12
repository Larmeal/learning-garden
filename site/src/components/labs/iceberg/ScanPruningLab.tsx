import { useState } from 'react';
import type { Lang } from '../spark/stepper';
import { Legend, Node } from './ib';

// Shows:      which manifests and data files a query opens, for six filters, on a table of 8 files in 8 manifests, with the number opened.
// Because:    skipping happens on two levels with different information (partition ranges of a manifest, min/max of a file) and a table of
//             "8, 2, 1, 1, 8, 0" does not show which level skipped what, or why customer = 'cu1' skips nothing.
// Control:    the filter picker changes which rows are skipped and how; the layout switch re-sorts the data between the files and changes
//             how many files a filter on order_id can skip.
// Conclusion: skipping by statistics works only when the values of a column are kept together in files.
//
// "Sorted" follows exercises/05_reads_scan_planning.py (ran: 8, 2, 1, 1, 8, 0 files). "Mixed" is NOT a measurement: it is the same rule
// (a file is skipped when the value is outside its min/max) applied to a layout where every file holds ids from the whole range.

interface F { i: number; day: number; idMin: number; idMax: number; amtMin: number; amtMax: number }

function files(layout: 'sorted' | 'mixed'): F[] {
  return Array.from({ length: 8 }, (_, i) => {
    const ids = layout === 'sorted' ? [1, 2, 3, 4, 5].map((k) => 5 * i + k) : [0, 1, 2, 3, 4].map((k) => 8 * k + i + 1);
    return { i, day: Math.floor(i / 2) + 1, idMin: Math.min(...ids), idMax: Math.max(...ids), amtMin: Math.min(...ids) * 10, amtMax: Math.max(...ids) * 10 };
  });
}

type Key = 'none' | 'day' | 'id7' | 'idgt' | 'cust' | 'neg';
const KEYS: Key[] = ['none', 'day', 'id7', 'idgt', 'cust', 'neg'];

const TEXT: Record<Lang, {
  title: string; filter: string; layout: string; sorted: string; mixed: string; names: Record<Key, string>;
  man: string; file: string; day: string; skipM: string; skipF: string; open: string; notOpened: string;
  legend: [string, string, string]; manLeft: string; fileLeft: string;
  readout: (m: number, f: number) => string; why: Record<Key, string>; caption: string;
}> = {
  th: {
    title: 'เลือก Filter แล้วลองดูว่า Query ต้องเปิด Manifest และ Data File กี่ไฟล์ จากทั้งหมดอย่างละ 8',
    filter: 'Filter', layout: 'ข้อมูลในไฟล์', sorted: 'เรียงตาม order_id', mixed: 'order_id สลับปนทุกไฟล์',
    names: { none: 'ไม่มี Filter', day: 'ordered_at ของวันที่ 2', id7: 'order_id = 7', idgt: 'order_id > 35', cust: "customer = 'cu1'", neg: 'amount < 0' },
    man: 'Manifest', file: 'Data File', day: 'วัน', skipM: 'ข้ามทั้ง Manifest', skipF: 'ข้ามด้วย Min/Max', open: 'เปิดอ่าน', notOpened: 'ไม่ได้เปิด',
    legend: ['เปิดอ่าน', 'ข้ามได้ ไม่เคยเปิด', 'ยังไม่ตัดสิน'], manLeft: 'Manifest (ช่วงวัน)', fileLeft: 'Data File (ช่วง order_id | amount)',
    readout: (m, f) => `เปิด Manifest ${m} จาก 8 ไฟล์ และเปิด Data File ${f} จาก 8 ไฟล์`,
    why: {
      none: 'ไม่มีเงื่อนไขอะไรเลย จึงต้องเปิดทุกไฟล์',
      day: 'ช่วงวันใน Manifest List บอกได้เลยว่า Manifest ไหนไม่มีวันที่ 2 จึงข้ามได้โดยไม่ต้องเปิด',
      id7: 'ต้องเปิดทุก Manifest เพราะ Manifest List ไม่มีสถิติของ order_id แต่พอเปิดแล้ว Min/Max ของแต่ละไฟล์ก็ตัดไฟล์ที่ไม่มีทางมี 7 ออกได้',
      idgt: 'เหมือนกับข้อก่อน คือต้องเปิดทุก Manifest แล้วดู Max ของแต่ละไฟล์',
      cust: "ทุกไฟล์มี customer ตั้งแต่ cu0 ถึง cu2 ช่วง Min/Max จึงครอบคลุม 'cu1' ไว้หมด ข้ามไม่ได้สักไฟล์",
      neg: 'Min ของ amount ทุกไฟล์มากกว่า 0 จึงไม่มีไฟล์ไหนมี Row ที่ตรงเลย แต่เราก็ต้องเปิด Manifest ทุกไฟล์เพื่อดู Min/Max ก่อน',
    },
    caption: 'แบบ "เรียงตาม order_id" วัดจริงในแบบฝึก 05 (ได้ 8, 2, 1, 1, 8, 0 ไฟล์ตามลำดับ) ส่วน "สลับปนทุกไฟล์" เราไม่ได้วัด แต่ใช้กฎเดียวกัน (ข้ามเมื่อค่าอยู่นอก Min/Max) กับการจัดข้อมูลอีกแบบหนึ่ง',
  },
  en: {
    title: 'Pick a filter and see how many manifests and data files a query opens, out of 8 of each',
    filter: 'Filter', layout: 'Data in the files', sorted: 'sorted by order_id', mixed: 'order_id mixed into every file',
    names: { none: 'no filter', day: 'ordered_at on day 2', id7: 'order_id = 7', idgt: 'order_id > 35', cust: "customer = 'cu1'", neg: 'amount < 0' },
    man: 'Manifest', file: 'Data file', day: 'day', skipM: 'whole manifest skipped', skipF: 'skipped by min/max', open: 'opened', notOpened: 'not opened',
    legend: ['opened', 'skipped, never opened', 'not decided'], manLeft: 'Manifest (day range)', fileLeft: 'Data file (order_id range | amount)',
    readout: (m, f) => `Opens ${m} of 8 manifests and ${f} of 8 data files`,
    why: {
      none: 'No condition, so every file is opened.',
      day: 'The day range in the manifest list says which manifests hold no day 2, so they are skipped without being opened.',
      id7: 'Every manifest must be opened because the manifest list has no order_id statistics, but each file’s min/max rules out the files that cannot hold 7.',
      idgt: 'The same: every manifest is opened, then the max of each file is checked.',
      cust: "Every file holds customers cu0 to cu2, so every min/max range covers 'cu1'. Not one file can be skipped.",
      neg: 'The min of amount in every file is above 0, so no file can hold a matching row, but every manifest still has to be opened to see the min/max.',
    },
    caption: 'The layout "sorted by order_id" was measured in exercise 05 (8, 2, 1, 1, 8 and 0 files in that order). "Mixed into every file" was not measured: it applies the same rule (skip when the value is outside min/max) to another arrangement of the data.',
  },
};

export default function ScanPruningLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [key, setKey] = useState<Key>('id7');
  const [layout, setLayout] = useState<'sorted' | 'mixed'>('sorted');
  const fs = files(layout);

  const st = fs.map((f) => {
    const manifestSkip = key === 'day' && f.day !== 2;
    let fileSkip = false;
    if (key === 'id7') fileSkip = !(f.idMin <= 7 && 7 <= f.idMax);
    if (key === 'idgt') fileSkip = !(f.idMax > 35);
    if (key === 'neg') fileSkip = !(f.amtMin < 0);
    return { f, manifestSkip, fileSkip };
  });
  const mOpen = st.filter((s) => !s.manifestSkip).length;
  const fOpen = st.filter((s) => !s.manifestSkip && !s.fileSkip).length;
  const Y0 = 56;
  const RH = 48;

  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={[{ kind: 'new', text: T.legend[0] }, { kind: 'skip', text: T.legend[1] }, { kind: 'node', text: T.legend[2] }]} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.filter}</span>
        <span className="seg" role="group" aria-label={T.filter}>
          {KEYS.map((k) => (
            <button key={k} type="button" aria-pressed={key === k} onClick={() => setKey(k)}>{T.names[k]}</button>
          ))}
        </span>
      </div>
      <div className="ib-controls">
        <span className="ib-lbl">{T.layout}</span>
        <span className="seg" role="group" aria-label={T.layout}>
          <button type="button" aria-pressed={layout === 'sorted'} onClick={() => setLayout('sorted')}>{T.sorted}</button>
          <button type="button" aria-pressed={layout === 'mixed'} onClick={() => setLayout('mixed')}>{T.mixed}</button>
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 460" role="img" aria-label={T.title}>
          <text x={16} y={32} className="ib-n">{T.manLeft}</text>
          <text x={286} y={32} className="ib-n">{T.fileLeft}</text>
          {st.map(({ f, manifestSkip, fileSkip }) => {
            const y = Y0 + f.i * RH;
            const fileOpen = !manifestSkip && !fileSkip;
            return (
              <g key={f.i}>
                <Node x={16} y={y} w={240} h={40} title={`m${f.i + 1} · ${T.day} ${f.day}`} state={manifestSkip ? 'skip' : 'new'} mono={false} />
                <text x={246} y={y + 26} textAnchor="end" className="ib-s">{manifestSkip ? T.skipM : T.open}</text>
                <path className="ib-line" d={`M256,${y + 20} L286,${y + 20}`} style={manifestSkip ? { opacity: 0.25 } : { stroke: 'var(--accent)', strokeWidth: 3 }} />
                <Node x={286} y={y} w={400} h={40} title={`d${f.i + 1} · ${f.idMin}–${f.idMax} | ${f.amtMin}–${f.amtMax}`} state={fileOpen ? 'new' : 'skip'} mono={false} />
                <text x={676} y={y + 26} textAnchor="end" className="ib-s">{manifestSkip ? T.notOpened : fileSkip ? T.skipF : T.open}</text>
              </g>
            );
          })}
          <rect className="ib-zone" x={712} y={44} width={158} height={398} rx={12} />
          <text x={791} y={118} textAnchor="middle" className="ib-big ib-acc">{fOpen}</text>
          <text x={791} y={146} textAnchor="middle" className="ib-s">/ 8 {T.file}</text>
          <text x={791} y={252} textAnchor="middle" className="ib-big">{mOpen}</text>
          <text x={791} y={280} textAnchor="middle" className="ib-s">/ 8 {T.man}</text>
        </svg>
      </div>
      <div className="readout" aria-live="polite">
        <div><strong>{T.names[key]}</strong>: {T.readout(mOpen, fOpen)}</div>
        <div>{T.why[key]}</div>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
