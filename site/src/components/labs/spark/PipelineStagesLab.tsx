import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

// Build a chain of operations and see where Spark cuts it into stages.
// The number of Exchange nodes per operation and the stage counts were measured by
// subjects/spark/code/exercises/05_execution_model.py (Spark 4.2.0, AQE off, sort-merge joins):
// stages = Exchange nodes + 1, except orderBy, which runs one more stage first (sampling for range boundaries).

interface Op {
  id: string;
  label: string;
  code: string;
  exchanges: number; // Exchange nodes the operation adds
  extra: number; // extra stages that are not an Exchange
  note?: string;
}

const OPS: Op[] = [
  { id: 'filter', label: 'filter', code: 'filter("v > 10")', exchanges: 0, extra: 0 },
  { id: 'select', label: 'select', code: 'select("k", "v")', exchanges: 0, extra: 0 },
  { id: 'with', label: 'withColumn', code: 'withColumn("w", v + 1)', exchanges: 0, extra: 0 },
  { id: 'union', label: 'union', code: 'union(other)', exchanges: 0, extra: 0 },
  { id: 'coalesce', label: 'coalesce(4)', code: 'coalesce(4)', exchanges: 0, extra: 0, note: 'ไม่ shuffle แค่รวม partition ติดกัน' },
  { id: 'limit', label: 'limit(5)', code: 'limit(5)', exchanges: 0, extra: 0, note: 'ถ้าเป็นขั้นสุดท้ายคือ CollectLimit ไม่มี Exchange (วัดเฉพาะกรณีนี้ ส่วน limit กลางโซ่ไม่ได้วัด)' },
  { id: 'group', label: 'groupBy.count', code: 'groupBy("k").count()', exchanges: 1, extra: 0, note: 'Exchange hashpartitioning' },
  { id: 'distinct', label: 'distinct', code: 'distinct()', exchanges: 1, extra: 0, note: 'Exchange hashpartitioning' },
  { id: 'window', label: 'window', code: 'row_number().over(partitionBy("k"))', exchanges: 1, extra: 0, note: 'Exchange hashpartitioning' },
  { id: 'repart', label: 'repartition(8)', code: 'repartition(8)', exchanges: 1, extra: 0, note: 'Exchange RoundRobinPartitioning' },
  { id: 'agg', label: 'agg(sum)', code: 'agg(sum("v"))', exchanges: 1, extra: 0, note: 'Exchange SinglePartition' },
  { id: 'order', label: 'orderBy', code: 'orderBy("v")', exchanges: 1, extra: 1, note: 'Exchange rangepartitioning และต้องสุ่มข้อมูลหาขอบเขตก่อน (stage เพิ่ม)' },
  { id: 'join', label: 'join (sort-merge)', code: 'join(other, ...)', exchanges: 2, extra: 0, note: 'Exchange ทั้งสองฝั่ง' },
];

const PRESETS: { label: string; ops: string[] }[] = [
  { label: 'filter → groupBy', ops: ['filter', 'select', 'group'] },
  { label: 'groupBy → orderBy', ops: ['filter', 'group', 'order'] },
  { label: 'join → groupBy → limit', ops: ['filter', 'join', 'group', 'limit'] },
];

export default function PipelineStagesLab() {
  const [chain, setChain] = useState<string[]>(['filter', 'select', 'group']);
  const reduce = useReducedMotion();
  const t = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 300, damping: 30 };
  const ops = chain.map((id) => OPS.find((o) => o.id === id)!);
  const exchanges = ops.reduce((a, o) => a + o.exchanges, 0);
  const stages = exchanges + 1 + ops.reduce((a, o) => a + o.extra, 0);
  const add = (id: string) => setChain((c) => (c.length >= 8 ? c : [...c, id]));

  return (
    <figure className="viz">
      <div className="viz-title">ต่อคำสั่งเอง แล้วดูว่า Spark ตัดเป็นกี่ stage</div>
      <div className="viz-steps" role="group" aria-label="เลือกคำสั่งเพิ่ม">
        {OPS.map((o) => (
          <button key={o.id} type="button" aria-pressed={false} onClick={() => add(o.id)} title={o.note}>
            + {o.label}
          </button>
        ))}
      </div>
      <div className="viz-controls">
        <button type="button" className="btn" onClick={() => setChain((c) => c.slice(0, -1))} disabled={chain.length === 0}>ลบอันสุดท้าย</button>
        <button type="button" className="btn" onClick={() => setChain([])} disabled={chain.length === 0}>ล้าง</button>
        <span className="ps-presets">ตัวอย่าง:</span>
        {PRESETS.map((p) => (
          <button key={p.label} type="button" className="btn" onClick={() => setChain(p.ops)}>{p.label}</button>
        ))}
      </div>

      <div className="viz-box ps-wrap">
        <div className="ps-chain" role="list" aria-label="โซ่ของคำสั่ง">
          <motion.div layout className="ps-start" transition={t}><code>spark.range(...)</code></motion.div>
          <AnimatePresence initial={false}>
            {ops.map((o, i) => (
              <motion.div key={`${i}-${o.id}`} layout initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={t} className="ps-op" data-wide={o.exchanges > 0 ? '' : undefined} role="listitem">
                {o.exchanges > 0 && (
                  <span className="ps-cut" aria-label={`shuffle ${o.exchanges} ครั้ง`}>
                    {o.extra ? 'SAMPLE + ' : ''}SHUFFLE{o.exchanges > 1 ? ` x${o.exchanges}` : ''}
                  </span>
                )}
                <code>.{o.code}</code>
              </motion.div>
            ))}
          </AnimatePresence>
          <motion.div layout className="ps-end" transition={t}><code>.collect()</code></motion.div>
        </div>
      </div>

      <div className="viz-now" aria-live="polite">
        <strong>{stages} stage ({exchanges} Exchange{exchanges === 1 ? '' : 's'}{ops.some((o) => o.extra) ? ' + 1 stage สุ่มข้อมูล' : ''})</strong>
        <span>
          กฎที่วัดได้: จำนวน stage = จำนวน Exchange + 1 ทุก Exchange คือขอบเขตของ stage (บทที่ 5) ยกเว้น orderBy ที่ต้องมี stage สุ่มข้อมูลก่อน
          กรณีที่ join สองตารางที่ถูกจัด partition ด้วย key เดียวกันไว้แล้ว (เช่น groupBy สองตัวที่ key เดียวกัน) Spark ไม่เพิ่ม Exchange ให้ join (วัดจริง: [4, 4, 200] ได้ 3 stage ไม่ใช่ 5) ภาพนี้ไม่คิดกรณีนั้น
        </span>
      </div>
    </figure>
  );
}
