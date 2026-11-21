import { useState } from 'react';
import type { Lang } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import { Cell } from './kf';
import data from './segments.json';

// Shows:      the segment files of one partition, the offset you ask for, and the three hops a broker makes to find it: the file by its name, an entry of the sparse index, then a scan. A switch lets retention delete the old files.
// Because:    "the file name is the first offset" and "the index is sparse" are about positions in a strip. A drawing shows how little is scanned, and which offsets disappear when a file goes.
// Control:    a slider for the offset to read (0 to 64) and a button that lets retention run.
// Conclusion: finding an offset costs one choice among file names, one choice among index entries and a short scan, and retention deletes whole files, so the log start offset jumps.
//
// Real data from exercise 05: five segments of 13 records (every record its own batch of 156 bytes), the index of segment 26 dumped with kafka-dump-log.sh (entries at offsets 30, 34, 38 for bytes 624, 1248, 1872),
// and what retention left (only the file 52). The index of the other segments is drawn with the same rhythm (every fourth batch) and was not dumped.

const SEGS = data.segments.map((s) => s.base);
const PER = 13;
const END = data.retention.end;
const ENTRY_EVERY = 4;

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; offset: string; retention: string; back: string;
  file: string; bytes: string; entry: string; scan: string; gone: string; readout: (o: number, base: number, entry: number, hops: number, gone: boolean, start: number) => string; caption: string;
}> = {
  th: {
    title: 'เลื่อนเลือก offset ที่ Consumer ขอ แล้วดูว่า Broker หาไฟล์ ชื่อไฟล์ จนถึง index แล้วสแกนไปหา Record นั้นอย่างไร กด Retention ดูว่าไฟล์เก่าหายไปแล้วเกิดอะไรขึ้น',
    legend: [{ kind: 'new', text: 'Record ที่ต้องการ' }, { kind: 'use', text: 'ไฟล์หรือ Batch ที่เปิดอ่าน' }, { kind: 'skip', text: 'ไฟล์ที่ Retention ลบแล้ว' }],
    offset: 'offset ที่ขอ', retention: 'ให้ Retention ทำงาน', back: 'ย้อนกลับ', file: 'ไฟล์ .log', bytes: 'ไบต์', entry: 'รายการใน index', scan: 'สแกนต่อ', gone: 'ถูกลบแล้ว',
    readout: (o, base, entry, hops, gone, start) => gone ? `offset ${o} อยู่ในไฟล์ที่ถูกลบไปแล้ว Log เริ่มที่ offset ${start} Consumer ที่ขอ offset นี้จะได้ OffsetOutOfRange แล้วต้องเลือกว่าจะกระโดดไปต้นหรือท้าย Log` : `ไฟล์ที่ชื่อ ${String(base).padStart(20, '0')}.log (ชื่อที่ใหญ่ที่สุดที่ไม่เกิน ${o}) แล้วรายการ index ที่ ${entry} แล้วสแกนต่ออีก ${hops} Batch จึงเจอ offset ${o}`,
    caption: 'ไฟล์ทั้ง 5 ไฟล์ ขนาด Batch และรายการ index ของไฟล์ 26 (offset 30, 34, 38 ที่ไบต์ 624, 1248, 1872) มาจาก kafka-dump-log.sh ในแบบฝึก 05 ส่วน index ของไฟล์อื่นวาดตามจังหวะเดียวกัน (ทุก 4 Batch) และไม่ได้ dump',
  },
  en: {
    title: 'Slide the offset a consumer asks for and see how the broker finds it: the file by its name, then the index, then a scan. Press retention to delete the old files and see what happens',
    legend: [{ kind: 'new', text: 'the record we want' }, { kind: 'use', text: 'file or batch that is opened' }, { kind: 'skip', text: 'file that retention deleted' }],
    offset: 'offset asked for', retention: 'let retention run', back: 'undo', file: '.log file', bytes: 'bytes', entry: 'index entry', scan: 'scan on', gone: 'deleted',
    readout: (o, base, entry, hops, gone, start) => gone ? `Offset ${o} was in a file that is deleted. The log starts at offset ${start}, so a consumer asking for this offset gets OffsetOutOfRange and has to jump to the start or the end of the log.` : `The file ${String(base).padStart(20, '0')}.log (the biggest name that is not above ${o}), then the index entry at ${entry}, then ${hops} more batches of scanning to reach offset ${o}`,
    caption: 'The five files, the batch size and the index entries of file 26 (offsets 30, 34, 38 at bytes 624, 1248, 1872) come from kafka-dump-log.sh in exercise 05. The index of the other files is drawn with the same rhythm (every 4 batches) and was not dumped.',
  },
};

export default function SegmentLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [o, setO] = useState(30);
  const [ran, setRan] = useState(false);
  const base = Math.max(...SEGS.filter((b) => b <= o));
  const k = o - base; // position of the record inside its file
  const entryAt = Math.floor(k / ENTRY_EVERY) * ENTRY_EVERY;
  const entryOffset = base + entryAt;
  const hops = k - entryAt;
  const gone = ran && base < data.retention.start;
  const sw = 836 / SEGS.length;
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <label className="ib-lbl">{T.offset}: <b>{o}</b>{' '}
          <input type="range" min={0} max={END - 1} value={o} onChange={(e) => setO(Number(e.target.value))} style={{ width: 260, verticalAlign: 'middle' }} />
        </label>
        <button type="button" className="btn sm" disabled={ran} onClick={() => setRan(true)}>{T.retention}</button>
        <button type="button" className="btn sm" disabled={!ran} onClick={() => setRan(false)}>{T.back}</button>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 330" role="img" aria-label={T.title}>
          {SEGS.map((b, i) => {
            const del = ran && b < data.retention.start;
            const hit = b === base;
            const size = data.segments[i].bytes;
            return (
              <g key={b} style={del ? { opacity: 0.7 } : undefined}>
                <rect className={del ? 'ib-skip' : hit ? 'ib-use' : 'ib-node'} x={22 + i * sw + 4} y={16} width={sw - 8} height={96} rx={10} style={hit && !del ? { strokeWidth: 5 } : undefined} />
                <text x={22 + i * sw + 14} y={44} className="ib-m" style={{ fill: 'var(--fg)', fontSize: 13 }}>{`…${String(b).padStart(3, '0')}.log`}</text>
                <text x={22 + i * sw + 14} y={68} className="ib-s">{`offset ${b} - ${Math.min(b + PER - 1, END - 1)}`}</text>
                <text x={22 + i * sw + 14} y={92} className="ib-s">{del ? T.gone : `${size} ${T.bytes}`}</text>
              </g>
            );
          })}
          {!gone && (
            <g>
              <text x={22} y={146} className="ib-n">{`${T.file} ${String(base).padStart(3, '0')}`}</text>
              {Array.from({ length: PER }, (_, j) => {
                const off = base + j;
                if (off >= END) return null;
                const x = 22 + j * 64;
                const isEntry = j % ENTRY_EVERY === 0 && j > 0;
                const scanned = j >= entryAt && j <= k;
                return (
                  <g key={j}>
                    <Cell x={x} y={196} w={56} h={46} offset={off} text="" state={j === k ? 'new' : scanned ? 'use' : 'plain'} />
                    {isEntry && <polygon points={`${x + 28},170 ${x + 18},152 ${x + 38},152`} style={{ fill: j === entryAt ? 'var(--accent)' : 'var(--muted)' }} />}
                    <text x={x + 28} y={226} textAnchor="middle" className="ib-s" style={{ fontSize: 12 }}>{j * 156}</text>
                  </g>
                );
              })}
              <text x={22} y={278} className="ib-s">{`▼ ${T.entry} (${ENTRY_EVERY} Batch)   ·   ${T.bytes} ↓`}</text>
              <text x={22} y={306} className="ib-n" style={{ fill: 'var(--accent)' }}>{`${T.entry}: ${entryOffset} → ${entryAt * 156} ${T.bytes}   ·   ${T.scan} ${hops}`}</text>
            </g>
          )}
          {gone && <text x={440} y={220} textAnchor="middle" className="ib-bad" style={{ fontSize: 48 }}>✗</text>}
        </svg>
      </div>
      <div className="readout" aria-live="polite"><div>{T.readout(o, base, entryOffset, hops, gone, data.retention.start)}</div></div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
