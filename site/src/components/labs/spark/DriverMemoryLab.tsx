import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

// Where a driver heap goes (lesson 1, in depth). Measured (exercise 01): spark.driver.memory = 1 GiB gives a Spark
// managed memory of 455,501,414 bytes = (1,073,741,824 - 314,572,800) x 0.6. The reserved 300 MiB and the 0.6 fraction
// (spark.memory.fraction) are the constants of that formula; the other heap sizes are the same formula applied, not run.

const RESERVED = 314572800;
const FRACTION = 0.6;
const GIB = 1073741824;
const MIB = 1048576;
const HEAPS = [1, 2, 4, 8];
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

type Lang = 'th' | 'en';

const TEXT: Record<Lang, {
  title: string;
  defaultTag: string;
  aria: (heap: number) => string;
  segs: { reservedSub: string; userSub: string; managed: string; managedSub: string };
  rows: { total: string; minus: string; managed: string; user: string; rest: string };
  checked: string;
  computed: string;
  caption: string;
}> = {
  th: {
    title: 'Heap ของ Driver ไม่ได้เป็นของข้อมูลทั้งก้อน',
    defaultTag: ' (ค่าเริ่มต้น, วัดจริง)',
    aria: (heap) => `Heap ${heap} GiB แบ่งเป็น Reserved, User Memory และส่วนที่ Spark จัดการ`,
    segs: { reservedSub: '300 MiB ที่ Spark กันไว้', userSub: 'Object อื่นของโปรแกรม', managed: 'Spark จัดการ', managedSub: 'Storage + Execution (บทที่ 13)' },
    rows: { total: 'Heap ทั้งหมด', minus: 'หัก Reserved', managed: 'ส่วนที่ Spark จัดการ', user: 'User Memory', rest: 'ที่เหลือ' },
    checked: 'ค่า 455,501,414 B ตรงกับที่ UI รายงานออกมาจริง (ตรวจแล้ว)',
    computed: 'ขนาดนี้คำนวณด้วยสูตรเดียวกัน แต่ยังไม่ได้รันด้วยการตั้งค่านี้',
    caption: 'เราตรวจสูตร (heap - reserved) x 0.6 กับ Heap ขนาด 1 GiB แล้วได้ 455,501,414 ไบต์เป๊ะ (exercises/01_architecture.py) ส่วนขนาดอื่นเป็นการแทนค่าลงในสูตรเดียวกัน ซึ่งในบทที่ 13 จะอธิบายต่อว่าส่วนที่ Spark จัดการแบ่งเป็น Storage กับ Execution อย่างไร',
  },
  en: {
    title: 'The driver heap is not all for your data',
    defaultTag: ' (default, measured)',
    aria: (heap) => `A heap of ${heap} GiB is split into reserved, user memory and the part that Spark manages`,
    segs: { reservedSub: '300 MiB kept by Spark', userSub: 'other objects of the program', managed: 'Spark managed', managedSub: 'storage + execution (lesson 13)' },
    rows: { total: 'whole heap', minus: 'minus reserved', managed: 'Spark managed part', user: 'user memory', rest: 'what is left' },
    checked: 'The value 455,501,414 B matches what the UI really reports (checked)',
    computed: 'This size is computed with the same formula. This setting was not run.',
    caption: 'The formula (heap - reserved) x 0.6 was checked with a 1 GiB heap and gave exactly 455,501,414 bytes (exercises/01_architecture.py). The other sizes are the same formula with other values. Lesson 13 goes on to explain how the part that Spark manages is split into storage and execution.',
  },
};

export default function DriverMemoryLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [heap, setHeap] = useState(1);
  const reduce = useReducedMotion();
  const total = heap * GIB;
  const usable = total - RESERVED;
  const managed = usable * FRACTION;
  const user = usable - managed;
  const W = 760;
  const w = (n: number) => (n / total) * W;
  const t = reduce ? { duration: 0 } : { duration: 0.7, ease: 'easeInOut' as const };

  const segs = [
    { key: 'reserved', label: 'reserved', sub: T.segs.reservedSub, bytes: RESERVED, cls: 'fx-file' },
    { key: 'user', label: 'user memory', sub: T.segs.userSub, bytes: user, cls: 'box' },
    { key: 'managed', label: T.segs.managed, sub: T.segs.managedSub, bytes: managed, cls: 'fx-hot' },
  ];
  let x = 0;
  const placed = segs.map((s) => {
    const r = { ...s, x, w: w(s.bytes) };
    x += r.w;
    return r;
  });

  return (
    <figure className="viz lg">
      <div className="viz-title">{T.title}</div>
      <div className="viz-steps" role="group" aria-label="spark.driver.memory">
        {HEAPS.map((h) => (
          <button key={h} type="button" aria-pressed={heap === h} onClick={() => setHeap(h)}>spark.driver.memory = {h} GiB{h === 1 ? T.defaultTag : ''}</button>
        ))}
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 350" role="img" aria-label={T.aria(heap)}>
          <rect className="band" x="10" y="10" width="860" height="330" rx="12" />
          <text className="b" x="40" y="42">heap {fmt(total)} B ({heap} GiB)</text>
          <g transform="translate(60 64)">
            {placed.map((s) => (
              <g key={s.key}>
                <motion.rect className={s.cls} initial={false} animate={{ x: s.x, width: Math.max(0, s.w) }} transition={t} y="0" height="64" rx="4" />
              </g>
            ))}
            <text className="s b" x="0" y="-8">reserved {Math.round((RESERVED / total) * 1000) / 10}% (300 MiB)</text>
            {placed.map((s) => (
              <motion.g key={`l${s.key}`} initial={false} animate={{ x: s.x + s.w / 2 }} transition={t}>
                {s.w > 70 && s.key !== 'reserved' && (
                  <>
                    <text className="b" y="28" textAnchor="middle" style={{ fontSize: 13 }}>{s.label}</text>
                    <text className="s m" y="46" textAnchor="middle">{Math.round((s.bytes / total) * 100)}%</text>
                  </>
                )}
              </motion.g>
            ))}
          </g>

          <g transform="translate(40 156)">
            {[
              { name: T.rows.total, v: total, note: 'spark.driver.memory' },
              { name: T.rows.minus, v: usable, note: `- 314,572,800 B (300 MiB)` },
              { name: T.rows.managed, v: managed, note: `x ${FRACTION} (spark.memory.fraction)`, hot: true },
              { name: T.rows.user, v: user, note: T.rows.rest },
            ].map((r, i) => (
              <g key={r.name} transform={`translate(0 ${i * 38})`}>
                <rect className={r.hot ? 'fx-hot' : 'box'} width="800" height="30" rx="7" />
                <text className="b" x="12" y="20" style={{ fontSize: 13 }}>{r.name}</text>
                <text className="m num" x="330" y="20" textAnchor="end" style={{ fontSize: 13 }}>{fmt(r.v)} B</text>
                <text className="s m" x="350" y="20">{(r.v / MIB).toFixed(1)} MiB</text>
                <text className="s" x="520" y="20">{r.note}</text>
              </g>
            ))}
          </g>
          <text className="s" x="40" y="330">{heap === 1 ? T.checked : T.computed}</text>
        </svg>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
