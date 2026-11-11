import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { Lang } from './stepper';

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
  code: string;
  nodes: N[];
  good: boolean;
}

const CASES: Case[] = [
  {
    id: 'other',
    code: 'df.withColumn("u", plus1("id")).filter(col("v") > 4)',
    nodes: [
      { id: 'p', text: 'Project [id, (id * 2) AS v, pythonUDF0 AS u]' },
      { id: 'u1', text: 'ArrowEvalPython [plus1(id)], [pythonUDF0], 101', udf: true },
      { id: 'f', text: 'Filter ((id * 2) > 4)', hot: true },
      { id: 'r', text: 'Range (0, 10, step=1, splits=16)' },
    ],
    good: true,
  },
  {
    id: 'output',
    code: 'df.withColumn("u", plus1("id")).filter(col("u") > 4)',
    nodes: [
      { id: 'p', text: 'Project [id, (id * 2) AS v, pythonUDF0 AS u]' },
      { id: 'u2', text: 'ArrowEvalPython [plus1(id)], [pythonUDF0], 101', udf: true, hot: true },
      { id: 'p2', text: 'Project [id]' },
      { id: 'f', text: 'Filter (pythonUDF0 > 4)' },
      { id: 'u1', text: 'ArrowEvalPython [plus1(id)], [pythonUDF0], 101', udf: true, hot: true },
      { id: 'r', text: 'Range (0, 10, step=1, splits=16)' },
    ],
    good: false,
  },
  {
    id: 'inside',
    code: 'df.filter(plus1("id") > 4)',
    nodes: [
      { id: 'p', text: 'Project [id, (id * 2) AS v]' },
      { id: 'p2', text: 'Project [id]' },
      { id: 'f', text: 'Filter (pythonUDF0 > 4)' },
      { id: 'u1', text: 'ArrowEvalPython [plus1(id)], [pythonUDF0], 101', udf: true, hot: true },
      { id: 'r', text: 'Range (0, 10, step=1, splits=16)' },
    ],
    good: false,
  },
  {
    id: 'nondet',
    code: 'df.withColumn("u", rnd("id")).filter(col("v") > 4)  # rnd.asNondeterministic()',
    nodes: [
      { id: 'p', text: 'Project [id, (id * 2) AS v, pythonUDF0 AS u]' },
      { id: 'f', text: 'Filter ((id * 2) > 4)', hot: true },
      { id: 'u1', text: 'ArrowEvalPython [rnd(id)], [pythonUDF0], 101', udf: true },
      { id: 'r', text: 'Range (0, 10, step=1, splits=16)' },
    ],
    good: false,
  },
];

const TEXT: Record<Lang, {
  title: string; pick: string; good: string; bad: string; cases: Record<string, { label: string; verdict: string }>;
}> = {
  th: {
    title: 'Filter อยู่ตรงไหนของ UDF: ดูแผนที่ Optimizer เขียนให้',
    pick: 'เลือกกรณี',
    good: 'Optimizer ช่วยได้',
    bad: 'ตรงนี้คือ barrier',
    cases: {
      other: { label: 'Filter คอลัมน์อื่น', verdict: 'Filter ลงไปอยู่ใต้ UDF ได้ เพราะไม่เกี่ยวกับผลของ UDF และ UDF เป็น Deterministic ทำให้แถวที่ถูกกรองออกไปไม่ต้องส่งไป Python เลย' },
      output: { label: 'Filter ผลของ UDF', verdict: 'Filter ที่ใช้ผลของ UDF ต้องอยู่เหนือ UDF และแผนจะมี ArrowEvalPython สองตัว ซึ่งหมายความว่า UDF ถูกคำนวณสองรอบ (หนึ่งรอบเพื่อ Filter อีกรอบเพื่อ Column u) ดูคำเตือนเรื่องการเรียกซ้ำได้ใน docstring ของ udf' },
      inside: { label: 'UDF อยู่ในเงื่อนไข Filter', verdict: 'UDF ต้องรันกับทุกแถวก่อน แล้วค่อย Filter ซึ่งไม่มีทางเลี่ยงด้วยแผน ถ้ามีเงื่อนไขอื่นที่กรองได้ก่อน ให้เขียนไว้ก่อนและให้ UDF ตามหลัง' },
      nondet: { label: 'UDF แบบ Non-deterministic', verdict: 'ถ้าประกาศว่า UDF ไม่ Deterministic Spark จะไม่ย้าย Filter ลงไปใต้มัน เพราะการกรองก่อนอาจเปลี่ยนผลของฟังก์ชัน (เช่นฟังก์ชันที่ใช้ตัวสุ่มหรือสถานะ)' },
    },
  },
  en: {
    title: 'Where the Filter sits relative to the UDF: look at the plan the Optimizer writes',
    pick: 'Choose a case',
    good: 'The Optimizer helps',
    bad: 'This is a barrier',
    cases: {
      other: { label: 'filter on another column', verdict: 'The Filter can move below the UDF, because it does not depend on the result of the UDF and the UDF is deterministic. The rows that are filtered out never have to be sent to Python.' },
      output: { label: 'filter on the UDF result', verdict: 'A Filter that uses the result of the UDF must stay above the UDF, and the plan has two ArrowEvalPython nodes: the UDF is computed twice (once for the filter and once for the column u). See the warning about repeated calls in the docstring of udf.' },
      inside: { label: 'UDF inside the filter condition', verdict: 'The UDF must run on every row first, and only then the filter runs. The plan cannot avoid this. If another condition can filter first, write it first and let the UDF come after.' },
      nondet: { label: 'non-deterministic UDF', verdict: 'If you declare the UDF as non-deterministic, Spark does not move the filter below it, because filtering first could change the result of the function (for example when it uses a random number or state).' },
    },
  },
};

export default function UdfBarrierLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [cur, setCur] = useState('other');
  const reduce = useReducedMotion();
  const c = CASES.find((x) => x.id === cur)!;
  const t = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 260, damping: 30 };
  return (
    <figure className="viz">
      <div className="viz-title">{T.title}</div>
      <div className="viz-steps" role="group" aria-label={T.pick}>
        {CASES.map((x) => (
          <button key={x.id} type="button" aria-pressed={cur === x.id} onClick={() => setCur(x.id)}>
            {T.cases[x.id].label}
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
        <strong>{c.good ? T.good : T.bad}</strong>
        <span>{T.cases[c.id].verdict}</span>
      </div>
    </figure>
  );
}
