import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

// Three-valued logic of SQL. Asserted by subjects/spark/code/exercises/03_dataframe_sql.py:
//   NULL = NULL -> NULL, NULL <=> NULL -> true, 1 = NULL -> NULL, NULL AND false -> false,
//   NULL OR true -> true, NOT NULL -> NULL.

type V = 'TRUE' | 'FALSE' | 'NULL';
const VALUES: V[] = ['TRUE', 'FALSE', 'NULL'];
type Op = 'AND' | 'OR' | '=' | '<=>';
const OPS: { id: Op; note: string }[] = [
  { id: 'AND', note: 'FALSE ชนะ: ถ้ามี FALSE ผลคือ FALSE ต่อให้อีกฝั่งเป็น NULL' },
  { id: 'OR', note: 'TRUE ชนะ: ถ้ามี TRUE ผลคือ TRUE ต่อให้อีกฝั่งเป็น NULL' },
  { id: '=', note: 'ถ้าฝั่งใดเป็น NULL ผลเป็น NULL เสมอ แม้ NULL = NULL' },
  { id: '<=>', note: 'null-safe equal: NULL <=> NULL เป็น TRUE และ NULL กับค่าอื่นเป็น FALSE ไม่เคยเป็น NULL' },
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

const WHERE: Record<V, string> = {
  TRUE: 'WHERE เก็บแถวนี้',
  FALSE: 'WHERE ทิ้งแถวนี้',
  NULL: 'WHERE ทิ้งแถวนี้ (NULL ไม่ใช่ TRUE) และ NOT ของมันก็ยังเป็น NULL จึงไม่ถูกเก็บด้วย',
};

export default function NullLogicLab() {
  const [op, setOp] = useState<Op>('AND');
  const [a, setA] = useState<V>('NULL');
  const [b, setB] = useState<V>('FALSE');
  const reduce = useReducedMotion();
  const result = compute(op, a, b);
  const note = OPS.find((o) => o.id === op)!.note;
  return (
    <figure className="viz">
      <div className="viz-title">NULL ไม่ใช่ค่า: ลองทายผลของตาราง truth table สามค่า</div>
      <div className="viz-steps" role="group" aria-label="เลือก operator">
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
          <span>{WHERE[result]}</span>
        </div>
      </div>
      <div className="viz-now">
        <strong>กฎของ operator นี้</strong>
        <span>{note}</span>
      </div>
    </figure>
  );
}
