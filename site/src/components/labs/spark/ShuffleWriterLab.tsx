import { useState } from 'react';
import { ClockControls, mix, prog, smooth, useClock, type Lang, type Mark } from './timeline';

// Which shuffle writer does a map task use? SortShuffleManager.registerShuffle (SortShuffleManager.scala:90-109),
// SortShuffleWriter.shouldBypassMergeSort (118-126) and canUseSerializedShuffle (227-246), lesson 7 in depth:
//   1 Bypass: no map-side combine and numPartitions <= spark.shuffle.sort.bypassMergeThreshold (200)
//   2 Serialized (unsafe): the serializer can relocate serialized records, no map-side combine, partitions <= 16,777,216
//   3 otherwise the general SortShuffleWriter (ExternalSorter, deserialized objects)
// Measured (exercises/07_performance_tuning.py): SQL shuffles with 8 and 200 partitions get Bypass, 201 gets Serialized;
// SQL partial aggregation is a HashAggregate operator, so mapSideCombine is False for SQL. The RDD cases and the picture
// of what each writer does with the records are from the source, not run. Twelve records stand for millions.

type Source = 'sql' | 'combine' | 'java';
const SOURCE_IDS: Source[] = ['sql', 'combine', 'java'];
type Writer = 'bypass' | 'serialized' | 'sort';
const NAME: Record<Writer, string> = { bypass: 'BypassMergeSortShuffleWriter', serialized: 'UnsafeShuffleWriter (serialized)', sort: 'SortShuffleWriter (ExternalSorter)' };

function choose(src: Source, P: number, L: Text): { w: Writer; why: string; q: number } {
  const combine = src === 'combine';
  if (!combine && P <= 200) return { w: 'bypass', q: 1, why: L.why1(P) };
  if (src === 'sql' && P <= 16777216) return { w: 'serialized', q: 2, why: L.why2(P) };
  return { w: 'sort', q: 3, why: combine ? L.why3Combine : L.why3Other };
}

interface Text {
  sources: Record<Source, string>;
  why1: (P: number) => string;
  why2: (P: number) => string;
  why3Combine: string;
  why3Other: string;
  marks: Mark[];
  title: string;
  jobKind: string;
  partitionsGroup: string;
  measured: string;
  svgLabel: (name: string) => string;
  checksTitle: string;
  rows: { n: number; label: string; cond: string }[];
  useThis: string;
  failed: string;
  whatDoes: (name: string) => string;
  mapHolds: string;
  bypassFiles: (pd: number, P: number) => string;
  bypassConcat: string;
  bypassOpen: (P: number) => string;
  bypassNote: string;
  serBytes: string;
  serPointers: string;
  serWrite: string;
  sortHold: string;
  sortCombine: string;
  sortSorted: string;
  sortSpill: string;
  sortSpillLabel: string;
  sortMerge: string;
  caption: string;
}
const TEXT: Record<Lang, Text> = {
  th: {
    sources: { sql: 'DataFrame / SQL (UnsafeRowSerializer)', combine: 'RDD ที่มี map-side combine (เช่น reduceByKey)', java: 'RDD ไม่มี combine, serializer ย้ายไม่ได้' },
    why1: (P) => `ไม่มี map-side combine และ ${P} <= 200 (bypassMergeThreshold)`,
    why2: (P) => `ไม่เข้าข้อ 1 (${P} > 200) แต่ UnsafeRowSerializer ย้ายข้อมูลที่ serialize แล้วได้ และไม่มี combine`,
    why3Combine: 'มี map-side combine จึงใช้ข้อ 1 และ 2 ไม่ได้',
    why3Other: 'serializer ย้ายข้อมูลที่ serialize แล้วไม่ได้ และ partition เกิน 200',
    marks: [
      { at: 0, name: 'ตั้งต้น', title: 'map task ถือแถว แต่ละแถวต้องไป reduce partition ของมัน', text: 'จุดสีคือ reduce partition ปลายทางของแต่ละแถว (12 จุดแทนแถวหลายล้าน) writer สามแบบต่างกันที่วิธีจัดแถวลงไฟล์ shuffle ของ map task นี้' },
      { at: 1.2, name: 'จัดแถว', title: 'จัดแถวตาม partition ปลายทาง', text: 'bypass เขียนไฟล์แยกต่อ partition, serialized แปลงแถวเป็น bytes แล้วเรียงแค่ pointer, sort เก็บ object ใน memory แล้วเรียงตาม partition (spill ลง disk เมื่อ memory ตึง)' },
      { at: 7.2, name: 'ไฟล์สุดท้าย', title: 'ทุกแบบจบด้วยไฟล์ .data หนึ่งไฟล์ต่อ map task พร้อม .index', text: 'ต่างกันที่ราคาระหว่างทาง: จำนวน file handle ที่เปิดพร้อมกัน, การแปลงไป-กลับระหว่าง object กับ bytes และการเรียงข้อมูล' },
    ],
    title: 'Shuffle writer ของ map task: bypass, serialized หรือ sort',
    jobKind: 'ชนิดของงาน',
    partitionsGroup: 'จำนวน partition ปลายทาง',
    measured: ' (วัดจริง)',
    svgLabel: (name) => `ผลการเลือก writer: ${name}`,
    checksTitle: 'SortShuffleManager ตรวจตามลำดับ',
    rows: [
      { n: 1, label: 'Bypass', cond: 'ไม่มี combine และ partition <= 200' },
      { n: 2, label: 'Serialized', cond: 'serializer ย้าย bytes ได้, ไม่มี combine' },
      { n: 3, label: 'Sort', cond: 'ที่เหลือทั้งหมด' },
    ],
    useThis: 'ใช้ข้อนี้',
    failed: 'ไม่ผ่าน',
    whatDoes: (name) => `${name} ทำอะไรกับแถว`,
    mapHolds: 'map task ถือแถว (จุด) เลขในจุดคือ reduce partition',
    bypassFiles: (pd, P) => `ไฟล์ชั่วคราวหนึ่งไฟล์ต่อ partition (วาด ${pd} จาก ${P})`,
    bypassConcat: 'ต่อทุกไฟล์เป็น shuffle_X.data (+ .index)',
    bypassOpen: (P) => `เปิดไฟล์พร้อมกัน ${P} ไฟล์ (มี buffer ต่อไฟล์)`,
    bypassNote: 'ถูกเมื่อ partition น้อย แต่ handle และ buffer โตตามจำนวน partition',
    serBytes: 'แถวถูกแปลงเป็น bytes ใน page (ไม่ deserialize อีก)',
    serPointers: 'pointer array: (partition id, ที่อยู่ของ record) เรียงเฉพาะ pointer',
    serWrite: 'เขียน bytes ตามลำดับ pointer ลง .data (+ .index)',
    sortHold: 'ExternalSorter: เก็บ object ใน memory (deserialized)',
    sortCombine: 'รวมค่าของ key ซ้ำทันที (map-side combine)',
    sortSorted: 'เรียงตาม partition id',
    sortSpill: 'memory ตึง: spill เป็นไฟล์ แล้ว merge ทีหลัง',
    sortSpillLabel: 'spill',
    sortMerge: 'merge เป็น .data ไฟล์เดียว (+ .index)',
    caption: 'ลำดับการเลือกและเงื่อนไขอ่านจาก SortShuffleManager (Spark 4.2.0) วัดจริงจาก handle ของ Exchange: 8 และ 200 partition ได้ Bypass, 201 ได้ Serialized (exercises/07_performance_tuning.py) กรณี RDD และภาพว่าแต่ละ writer จัดแถวอย่างไรอ่านจากซอร์ส ยังไม่ได้รัน 12 จุดแทนแถวจำนวนมาก',
  },
  en: {
    sources: { sql: 'DataFrame / SQL (UnsafeRowSerializer)', combine: 'RDD with map-side combine (e.g. reduceByKey)', java: 'RDD without combine, serializer cannot relocate' },
    why1: (P) => `No map-side combine and ${P} <= 200 (bypassMergeThreshold)`,
    why2: (P) => `Check 1 fails (${P} > 200), but UnsafeRowSerializer can relocate serialized data and there is no combine`,
    why3Combine: 'There is a map-side combine, so checks 1 and 2 cannot be used',
    why3Other: 'The serializer cannot relocate serialized data and there are more than 200 partitions',
    marks: [
      { at: 0, name: 'start', title: 'The map task holds rows, and each row must go to its reduce partition', text: 'The colored dot is the destination reduce partition of each row (12 dots stand for millions of rows). The three writers differ in how they lay the rows out in the shuffle file of this map task.' },
      { at: 1.2, name: 'arrange', title: 'Arrange rows by destination partition', text: 'bypass writes one file per partition. serialized turns rows into bytes and sorts only the pointers. sort keeps objects in memory and sorts them by partition (it spills to disk when memory is tight).' },
      { at: 7.2, name: 'final file', title: 'Every kind ends with one .data file per map task plus an .index', text: 'The difference is the cost on the way: how many file handles are open at once, the conversion back and forth between objects and bytes, and the sorting.' },
    ],
    title: 'Shuffle writer of a map task: bypass, serialized or sort',
    jobKind: 'Kind of job',
    partitionsGroup: 'Number of destination partitions',
    measured: ' (measured)',
    svgLabel: (name) => `Writer chosen: ${name}`,
    checksTitle: 'SortShuffleManager checks in order',
    rows: [
      { n: 1, label: 'Bypass', cond: 'no combine and partitions <= 200' },
      { n: 2, label: 'Serialized', cond: 'serializer can move bytes, no combine' },
      { n: 3, label: 'Sort', cond: 'everything else' },
    ],
    useThis: 'use this',
    failed: 'fails',
    whatDoes: (name) => `What ${name} does with the rows`,
    mapHolds: 'Rows (dots) of the map task; number = reduce partition',
    bypassFiles: (pd, P) => `One temporary file per partition (${pd} of ${P} drawn)`,
    bypassConcat: 'Concatenate all files into shuffle_X.data (+ .index)',
    bypassOpen: (P) => `${P} files open at once (one buffer per file)`,
    bypassNote: 'Cheap when partitions are few, but handles and buffers grow with partitions',
    serBytes: 'Rows become bytes in a page (no deserialize again)',
    serPointers: 'pointer array: (partition id, record address), only pointers are sorted',
    serWrite: 'Write bytes in pointer order into .data (+ .index)',
    sortHold: 'ExternalSorter: keeps objects in memory (deserialized)',
    sortCombine: 'Merges values of the same key at once (map-side combine)',
    sortSorted: 'Sorts by partition id',
    sortSpill: 'Memory tight: spill to a file, merge later',
    sortSpillLabel: 'spill',
    sortMerge: 'Merge into one .data file (+ .index)',
    caption: 'The order of the checks and the conditions are read from SortShuffleManager (Spark 4.2.0). Measured from the Exchange handle: 8 and 200 partitions get Bypass, 201 gets Serialized (exercises/07_performance_tuning.py). The RDD cases and the picture of how each writer arranges rows are read from the source and were not run. 12 dots stand for many rows.',
  },
};

const DURATION = 11;
const N = 12;

export default function ShuffleWriterLab({ lang = 'th' }: { lang?: Lang }) {
  const L = TEXT[lang];
  const [src, setSrc] = useState<Source>('sql');
  const [P, setP] = useState(200);
  const clock = useClock(DURATION);
  const { t } = clock;
  const ch = choose(src, P, L);
  const restart = () => clock.restart();

  const pd = Math.min(P, 12); // partitions drawn
  const recs = Array.from({ length: N }, (_, i) => ({ i, p: (i * 5 + 2) % pd, k: ((i * 5 + 2) % pd) % 3 }));
  const sorted = [...recs].sort((a, b) => a.p - b.p || a.i - b.i);
  const move = (i: number) => smooth(prog(t, 1.2 + i * 0.12, 2.6 + i * 0.12));
  const merge = smooth(prog(t, 5.5, 7));

  const Dot = ({ x, y, k, p }: { x: number; y: number; k: number; p: number }) => (
    <g transform={`translate(${x} ${y})`}>
      <circle r="8" className={`k${k + 1}`} />
      <text className="dl" y="4" style={{ fontSize: 10 }}>{p + 1}</text>
    </g>
  );

  return (
    <figure className="viz lg">
      <div className="viz-title">{L.title}</div>
      <div className="viz-steps" role="group" aria-label={L.jobKind}>
        {SOURCE_IDS.map((id) => <button key={id} type="button" aria-pressed={src === id} onClick={() => { setSrc(id); restart(); }}>{L.sources[id]}</button>)}
      </div>
      <div className="viz-steps" role="group" aria-label={L.partitionsGroup}>
        {[8, 200, 201, 1000].map((n) => <button key={n} type="button" aria-pressed={P === n} onClick={() => { setP(n); restart(); }}>{n} partition{lang === 'en' ? 's' : ''}{n === 8 || n === 200 || n === 201 ? L.measured : ''}</button>)}
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 440" role="img" aria-label={L.svgLabel(NAME[ch.w])}>
          <rect className="band" x="10" y="10" width="860" height="420" rx="12" />

          {/* the three checks */}
          <g transform="translate(24 30)">
            <text className="b">{L.checksTitle}</text>
            {L.rows.map((r, i) => {
              const on = ch.q === r.n;
              const passed = ch.q > r.n;
              return (
                <g key={r.n} transform={`translate(0 ${14 + i * 70})`}>
                  <rect className={on ? 'fx-hot' : 'box'} width="300" height="60" rx="9" opacity={passed ? 0.5 : 1} />
                  <text className="b" x="12" y="24" style={{ fontSize: 13 }}>{r.n}. {r.label}</text>
                  <text className="s" x="12" y="45">{r.cond}</text>
                  <text className="s b" x="288" y="24" textAnchor="end" style={{ fill: on ? 'var(--accent)' : 'var(--muted)' }}>{on ? L.useThis : passed ? L.failed : ''}</text>
                </g>
              );
            })}
            <text className="s b acc" y="240">{NAME[ch.w]}</text>
            <foreignObject x="0" y="248" width="300" height="70"><div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.4 }}>{ch.why}</div></foreignObject>
          </g>

          {/* what the writer does */}
          <g transform="translate(360 30)">
            <text className="b">{L.whatDoes(NAME[ch.w])}</text>
            <text className="s m" y="18">{L.mapHolds}</text>
            {ch.w === 'bypass' && (
              <g>
                <text className="s b" y="116">{L.bypassFiles(pd, P)}</text>
                {Array.from({ length: pd }, (_, p) => (
                  <g key={p} transform={`translate(${20 + (p % 6) * 78} ${130 + Math.floor(p / 6) * 74})`}>
                    <rect width="56" height="56" rx="6" className="fx-file" />
                    <text className="s m" x="28" y="48" textAnchor="middle">p{p + 1}</text>
                  </g>
                ))}
                <g transform={`translate(0 288)`} opacity={merge}>
                  <rect className="fx-hot" x="10" width="440" height="40" rx="8" />
                  <text className="s b" x="22" y="25">{L.bypassConcat}</text>
                </g>
                <text className="s b acc" y="352">{L.bypassOpen(P)}</text>
                <text className="s" y="370">{L.bypassNote}</text>
              </g>
            )}
            {ch.w === 'serialized' && (
              <g>
                <text className="s b" y="116">{L.serBytes}</text>
                <rect x="14" y="128" width="300" height="76" rx="8" className="fx-file" />
                {recs.map((r) => {
                  const on = prog(t, 2.2 + r.i * 0.12, 2.6 + r.i * 0.12);
                  return on > 0 ? <rect key={`b${r.i}`} x={22 + (r.i % 6) * 48} y={138 + Math.floor(r.i / 6) * 28} width="40" height="18" rx="3" className={`k${r.k + 1}`} opacity="0.85" /> : null;
                })}
                <text className="s b" x="14" y="228">{L.serPointers}</text>
                {Array.from({ length: N }, (_, i) => {
                  const sortP = smooth(prog(t, 3.8, 5.4));
                  const idx = sorted.findIndex((s) => s.i === i);
                  const r = recs[i];
                  return (
                    <g key={i} transform={`translate(${14 + mix(i, idx, sortP) * 36} 242)`}>
                      <rect width="30" height="30" rx="5" className={`k${r.k + 1}`} opacity={prog(t, 2.4, 3) > 0 ? 1 : 0} />
                      <text className="dl" x="15" y="20" style={{ fontSize: 10 }}>{r.p + 1}</text>
                    </g>
                  );
                })}
                <g opacity={merge}>
                  <rect className="fx-hot" x="10" y="296" width="440" height="40" rx="8" />
                  <text className="s b" x="22" y="321">{L.serWrite}</text>
                </g>
              </g>
            )}
            {ch.w === 'sort' && (
              <g>
                <text className="s b" y="116">{L.sortHold}</text>
                <rect x="14" y="128" width="290" height="76" rx="8" className="fx-file" />
                <text className="s" x="14" y="226">{src === 'combine' ? L.sortCombine : L.sortSorted}</text>
                <text className="s" x="14" y="246">{L.sortSpill}</text>
                {t > 5.6 && (
                  <g transform="translate(14 258)" opacity={merge}>
                    <rect width="64" height="30" rx="6" className="box" strokeDasharray="4 3" />
                    <text className="s m" x="32" y="20" textAnchor="middle">{L.sortSpillLabel}</text>
                  </g>
                )}
                <g opacity={merge}>
                  <rect className="fx-hot" x="10" y="304" width="440" height="40" rx="8" />
                  <text className="s b" x="22" y="329">{L.sortMerge}</text>
                </g>
              </g>
            )}
            {recs.map((r) => {
              const hx = 14 + r.i * 36;
              const hy = 54;
              if (ch.w === 'bypass') {
                const fx = 20 + (r.p % 6) * 78;
                const fy = 150 + Math.floor(r.p / 6) * 74;
                const m = move(r.i);
                return <g key={r.i}><Dot x={mix(hx, fx + 28, m)} y={mix(hy, fy + 30 + ((r.i >> 1) % 2) * 0, m)} k={r.k} p={r.p} /></g>;
              }
              if (ch.w === 'serialized') {
                const m = move(r.i);
                const col = r.i % 6;
                const row = Math.floor(r.i / 6);
                return <g key={r.i} opacity={m < 0.5 ? 1 : 0}><Dot x={mix(hx, 34 + col * 44, m)} y={mix(hy, 150 + row * 28, m)} k={r.k} p={r.p} /></g>;
              }
              const m = move(r.i);
              const idx = sorted.findIndex((s) => s.i === r.i);
              const sortP = smooth(prog(t, 3.6, 5.2));
              const col = r.i % 6;
              const row = Math.floor(r.i / 6);
              const ux = 34 + col * 44;
              const uy = 150 + row * 28;
              const sx = 34 + (idx % 6) * 44;
              const sy = 150 + Math.floor(idx / 6) * 28;
              return <g key={r.i}><Dot x={mix(hx, mix(ux, sx, sortP), m)} y={mix(hy, mix(uy, sy, sortP), m)} k={r.k} p={r.p} /></g>;
            })}

          </g>
        </svg>
      </div>
      <ClockControls clock={clock} marks={L.marks} lang={lang} />
      <figcaption className="viz-caption">{L.caption}</figcaption>
    </figure>
  );
}
