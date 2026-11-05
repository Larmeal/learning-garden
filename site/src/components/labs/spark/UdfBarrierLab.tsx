import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

// Optimized plans printed by explain() for df.withColumn("u", plus1("id")) style queries, Spark 4.2.0
// (asserted by subjects/spark/code/exercises/08_udf.py). Expression ids are removed.

interface N {
  id: string;
  text: string;
  udf?: boolean;
  hot?: boolean;
}
interface Case {
  id: string;
  label: string;
  code: string;
  nodes: N[];
  verdict: string;
  good: boolean;
}

const CASES: Case[] = [
  {
    id: 'other',
    label: 'filter คอลัมน์อื่น',
    code: 'df.withColumn("u", plus1("id")).filter(col("v") > 4)',
    nodes: [
      { id: 'p', text: 'Project [id, (id * 2) AS v, pythonUDF0 AS u]' },
      { id: 'u1', text: 'ArrowEvalPython [plus1(id)], [pythonUDF0], 101', udf: true },
      { id: 'f', text: 'Filter ((id * 2) > 4)', hot: true },
      { id: 'r', text: 'Range (0, 10, step=1, splits=16)' },
    ],
    verdict: 'Filter ลงไปอยู่ใต้ UDF ได้ เพราะไม่เกี่ยวกับผลของ UDF และ UDF เป็น deterministic แถวที่ถูกกรองออกไม่ต้องส่งไป Python เลย',
    good: true,
  },
  {
    id: 'output',
    label: 'filter ผลของ UDF',
    code: 'df.withColumn("u", plus1("id")).filter(col("u") > 4)',
    nodes: [
      { id: 'p', text: 'Project [id, (id * 2) AS v, pythonUDF0 AS u]' },
      { id: 'u2', text: 'ArrowEvalPython [plus1(id)], [pythonUDF0], 101', udf: true, hot: true },
      { id: 'p2', text: 'Project [id]' },
      { id: 'f', text: 'Filter (pythonUDF0 > 4)' },
      { id: 'u1', text: 'ArrowEvalPython [plus1(id)], [pythonUDF0], 101', udf: true, hot: true },
      { id: 'r', text: 'Range (0, 10, step=1, splits=16)' },
    ],
    verdict: 'Filter ที่ใช้ผลของ UDF ต้องอยู่เหนือ UDF และแผนมี ArrowEvalPython สองตัว: UDF ถูกคำนวณสองรอบ (หนึ่งรอบเพื่อ filter อีกรอบเพื่อ column u) ดูคำเตือนเรื่องการเรียกซ้ำใน docstring ของ udf',
    good: false,
  },
  {
    id: 'inside',
    label: 'UDF อยู่ในเงื่อนไข filter',
    code: 'df.filter(plus1("id") > 4)',
    nodes: [
      { id: 'p', text: 'Project [id, (id * 2) AS v]' },
      { id: 'p2', text: 'Project [id]' },
      { id: 'f', text: 'Filter (pythonUDF0 > 4)' },
      { id: 'u1', text: 'ArrowEvalPython [plus1(id)], [pythonUDF0], 101', udf: true, hot: true },
      { id: 'r', text: 'Range (0, 10, step=1, splits=16)' },
    ],
    verdict: 'UDF ต้องรันกับทุกแถวก่อน แล้วค่อย filter ไม่มีทางเลี่ยงด้วยแผน ถ้าเงื่อนไขอื่นกรองได้ก่อน ให้เขียนไว้ก่อนและให้ UDF ตามหลัง',
    good: false,
  },
  {
    id: 'nondet',
    label: 'UDF แบบ non-deterministic',
    code: 'df.withColumn("u", rnd("id")).filter(col("v") > 4)  # rnd.asNondeterministic()',
    nodes: [
      { id: 'p', text: 'Project [id, (id * 2) AS v, pythonUDF0 AS u]' },
      { id: 'f', text: 'Filter ((id * 2) > 4)', hot: true },
      { id: 'u1', text: 'ArrowEvalPython [rnd(id)], [pythonUDF0], 101', udf: true },
      { id: 'r', text: 'Range (0, 10, step=1, splits=16)' },
    ],
    verdict: 'ถ้าประกาศว่า UDF ไม่ deterministic Spark ไม่ย้าย filter ลงไปใต้มัน เพราะการกรองก่อนอาจเปลี่ยนผลของฟังก์ชัน (เช่นที่ใช้ตัวสุ่มหรือสถานะ)',
    good: false,
  },
];

export default function UdfBarrierLab() {
  const [cur, setCur] = useState('other');
  const reduce = useReducedMotion();
  const c = CASES.find((x) => x.id === cur)!;
  const t = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 260, damping: 30 };
  return (
    <figure className="viz">
      <div className="viz-title">Filter อยู่ตรงไหนของ UDF: ดูแผนที่ Optimizer เขียนให้</div>
      <div className="viz-steps" role="group" aria-label="เลือกกรณี">
        {CASES.map((x) => (
          <button key={x.id} type="button" aria-pressed={cur === x.id} onClick={() => setCur(x.id)}>
            {x.label}
          </button>
        ))}
      </div>
      <div className="viz-box plan-box">
        <code className="udf-code">{c.code}</code>
        <div className="plan-tree">
          <AnimatePresence initial={false} mode="popLayout">
            {c.nodes.map((n, i) => (
              <motion.div
                key={n.id}
                layout
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={t}
                className={`plan-node${n.udf ? ' plan-udf' : ''}`}
                data-changed={n.hot ? '' : undefined}
                style={{ marginLeft: i * 18 }}
              >
                <span className="plan-arrow" aria-hidden="true">{i === 0 ? '' : '+- '}</span>
                <code>{n.text}</code>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
      <div className="viz-now" data-bad={c.good ? undefined : ''} aria-live="polite">
        <strong>{c.good ? 'Optimizer ช่วยได้' : 'ตรงนี้คือ barrier'}</strong>
        <span>{c.verdict}</span>
      </div>
    </figure>
  );
}
