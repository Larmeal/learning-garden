import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { Lang } from './stepper';

// Three-valued logic of SQL. Asserted by subjects/spark/code/exercises/03_dataframe_sql.py:
//   NULL = NULL -> NULL, NULL <=> NULL -> true, 1 = NULL -> NULL, NULL AND false -> false,
//   NULL OR true -> true, NOT NULL -> NULL.

type V = 'TRUE' | 'FALSE' | 'NULL';
const VALUES: V[] = ['TRUE', 'FALSE', 'NULL'];
type Op = 'AND' | 'OR' | '=' | '<=>';
const OPS: { id: Op }[] = [
  { id: 'AND' },
  { id: 'OR' },
  { id: '=' },
  { id: '<=>' },
];

function compute(op: Op, a: V, b: V): V {
  const isNull = a === 'NULL' || b === 'NULL';
  switch (op) {
    case 'AND':
      if (a === 'FALSE' || b === 'FALSE') return 'FALSE';
      return isNull ? 'NULL' : 'TRUE';
    case 'OR':
      if (a === 'TRUE' || b === 'TRUE') return 'TRUE';
      return isNull ? 'NULL' : 'FALSE';
    case '=':
      if (isNull) return 'NULL';
      return a === b ? 'TRUE' : 'FALSE';
    case '<=>':
      return a === b ? 'TRUE' : 'FALSE';
  }
}

const TEXT: Record<Lang, {
  title: string; pick: string; rule: string; notes: Record<string, string>; where: Record<V, string>;
}> = {
  th: {
    title: 'NULL ไม่ใช่ค่า ลองทายผลของ Truth Table สามค่าดู',
    pick: 'เลือก Operator',
    rule: 'กฎของ Operator นี้',
    notes: {
      'AND': 'FALSE ชนะ ถ้ามี FALSE อยู่ฝั่งใดฝั่งหนึ่ง ผลก็เป็น FALSE ต่อให้อีกฝั่งเป็น NULL',
      'OR': 'TRUE ชนะ ถ้ามี TRUE อยู่ฝั่งใดฝั่งหนึ่ง ผลก็เป็น TRUE ต่อให้อีกฝั่งเป็น NULL',
      '=': 'ถ้าฝั่งใดฝั่งหนึ่งเป็น NULL ผลจะเป็น NULL เสมอ แม้แต่ NULL = NULL ก็ตาม',
      '<=>': 'Null-safe Equal ถ้า NULL <=> NULL จะได้ TRUE และถ้า NULL เทียบกับค่าอื่นจะได้ FALSE โดยผลไม่เคยเป็น NULL',
    },
    where: {
      TRUE: 'WHERE เก็บแถวนี้',
      FALSE: 'WHERE ทิ้งแถวนี้',
      NULL: 'WHERE ทิ้งแถวนี้ (เพราะ NULL ไม่ใช่ TRUE) และ NOT ของมันก็ยังเป็น NULL อยู่ดี จึงไม่ถูกเก็บไว้เหมือนกัน',
    },
  },
  en: {
    title: 'NULL is not a value: guess the result in a three-valued truth table',
    pick: 'Choose an operator',
    rule: 'Rule of this operator',
    notes: {
      'AND': 'FALSE wins: if one side is FALSE the result is FALSE, even when the other side is NULL',
      'OR': 'TRUE wins: if one side is TRUE the result is TRUE, even when the other side is NULL',
      '=': 'If either side is NULL the result is always NULL, even NULL = NULL',
      '<=>': 'null-safe equal: NULL <=> NULL is TRUE and NULL against any other value is FALSE, it is never NULL',
    },
    where: {
      TRUE: 'WHERE keeps this row',
      FALSE: 'WHERE drops this row',
      NULL: 'WHERE drops this row (NULL is not TRUE), and NOT of it is still NULL, so it is not kept either',
    },
  },
};

export default function NullLogicLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [op, setOp] = useState<Op>('AND');
  const [a, setA] = useState<V>('NULL');
  const [b, setB] = useState<V>('FALSE');
  const reduce = useReducedMotion();
  const result = compute(op, a, b);
  const note = T.notes[op];
  return (
    <figure className="viz">
      <div className="viz-title">{T.title}</div>
      <div className="viz-steps" role="group" aria-label={T.pick}>
        {OPS.map((o) => (
          <button key={o.id} type="button" aria-pressed={op === o.id} onClick={() => setOp(o.id)}>
            A {o.id} B
          </button>
        ))}
      </div>
      <div className="viz-box nl-wrap">
        <table className="nl-table">
          <thead>
            <tr>
              <th>A / B</th>
              {VALUES.map((v) => (
                <th key={v}>{v}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {VALUES.map((va) => (
              <tr key={va}>
                <th>{va}</th>
                {VALUES.map((vb) => {
                  const r = compute(op, va, vb);
                  const on = va === a && vb === b;
                  return (
                    <td key={vb}>
                      <button
                        type="button"
                        className="nl-cell"
                        data-on={on ? '' : undefined}
                        data-null={r === 'NULL' ? '' : undefined}
                        onClick={() => {
                          setA(va);
                          setB(vb);
                        }}
                      >
                        {r}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="nl-result" aria-live="polite">
          <code>
            SELECT {a} {op} {b}
          </code>
          <motion.strong key={`${op}-${a}-${b}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0 : 0.25 }} data-null={result === 'NULL' ? '' : undefined}>
            {result}
          </motion.strong>
          <span>{T.where[result]}</span>
        </div>
      </div>
      <div className="viz-now">
        <strong>{T.rule}</strong>
        <span>{note}</span>
      </div>
    </figure>
  );
}
