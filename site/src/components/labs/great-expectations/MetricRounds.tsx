import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import matrix from './metricMatrix.json';

interface Rec {
  rounds: number[][];
  sql: number;
  sqlFirst: string[];
}
const data = matrix as unknown as {
  version: string;
  expectations: { id: string; label: string }[];
  formats: string[];
  metricNames: string[];
  records: Record<string, Rec>;
};

const FORMAT_HINT: Record<string, string> = {
  BOOLEAN_ONLY: 'ได้แค่ผ่าน/ไม่ผ่าน',
  BASIC: 'เพิ่มค่าที่ผิดบางส่วน',
  SUMMARY: 'ค่าเริ่มต้นของ ValidationDefinition.run',
  COMPLETE: 'ผลละเอียดสุด',
};

// Colour the chip by what the metric is for, so the rounds read as layers.
function kind(name: string): 'table' | 'cond' | 'result' | 'agg' {
  if (name.startsWith('table.')) return 'table';
  if (name.endsWith('.condition')) return 'cond';
  if (name.includes('.unexpected_') || name.includes('.missing') || name.includes('.count')) return 'result';
  return 'agg';
}

const key = (sel: number[], fmt: string) => `${[...sel].sort((a, b) => a - b).join('-')}|${fmt}`;
const total = (r?: Rec) => (r ? r.rounds.reduce((n, round) => n + round.length, 0) : 0);

export default function MetricRounds() {
  const [sel, setSel] = useState<number[]>([0, 1, 2, 5]);
  const [fmt, setFmt] = useState('SUMMARY');
  const [shown, setShown] = useState(99);
  const [playing, setPlaying] = useState(false);
  const reduce = useReducedMotion();

  const rec = sel.length ? data.records[key(sel, fmt)] : undefined;
  const alone = useMemo(
    () => sel.map((i) => data.records[key([i], fmt)]),
    [sel, fmt],
  );
  const aloneMetrics = alone.reduce((n, r) => n + total(r), 0);
  const aloneSql = alone.reduce((n, r) => n + (r?.sql ?? 0), 0);
  const rounds = rec ? rec.rounds.filter((r) => r.length > 0) : [];

  useEffect(() => {
    if (!playing) return;
    if (shown >= rounds.length) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setShown((s) => s + 1), reduce ? 0 : 900);
    return () => clearTimeout(t);
  }, [playing, shown, rounds.length, reduce]);

  const toggle = (i: number) => {
    setPlaying(false);
    setShown(99);
    setSel((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
  };
  const play = () => {
    setShown(0);
    setPlaying(true);
  };

  return (
    <figure className="viz">
      <div className="viz-title">เลือก expectation แล้วดูว่า GX คำนวณ metric อะไรบ้าง ในกี่รอบ</div>

      <div className="gx-split">
        <div className="gx-pane">
          <div className="lab-label">expectation ใน suite</div>
          <div className="gx-checks">
            {data.expectations.map((e, i) => (
              <label key={e.id} className="check gx-check">
                <input type="checkbox" checked={sel.includes(i)} onChange={() => toggle(i)} />
                <code>{e.label}</code>
              </label>
            ))}
          </div>
          <div className="lab-label" style={{ marginTop: 14 }}>result_format</div>
          <div className="seg" role="group" aria-label="result_format">
            {data.formats.map((f) => (
              <button key={f} type="button" aria-pressed={fmt === f} onClick={() => { setFmt(f); setShown(99); setPlaying(false); }}>
                {f}
              </button>
            ))}
          </div>
          <p className="gx-hint">{FORMAT_HINT[fmt]}</p>
        </div>

        <div className="gx-pane gx-grow">
          {!rec ? (
            <p className="gx-empty">เลือก expectation อย่างน้อยหนึ่งข้อ</p>
          ) : (
            <>
              <div className="viz-controls">
                <button type="button" className="btn primary sm" onClick={play}>เล่นทีละรอบ</button>
                <button type="button" className="btn sm" onClick={() => { setPlaying(false); setShown(99); }}>แสดงทั้งหมด</button>
              </div>
              <div className="gx-rounds">
                {rounds.map((round, ri) => {
                  const grouped = new Map<string, number>();
                  round.forEach((m) => grouped.set(data.metricNames[m], (grouped.get(data.metricNames[m]) ?? 0) + 1));
                  const visible = ri < shown;
                  return (
                    <motion.div
                      key={`${key(sel, fmt)}-${ri}`}
                      className="gx-round"
                      initial={reduce ? false : { opacity: 0, y: 10 }}
                      animate={{ opacity: visible ? 1 : 0.12, y: 0 }}
                      transition={{ duration: 0.35 }}
                    >
                      <div className="gx-round-h">รอบที่ {ri + 1} <span>{round.length} metric</span></div>
                      <div className="gx-chips">
                        {[...grouped.entries()].map(([name, n]) => (
                          <span key={name} className="gx-chip" data-kind={kind(name)}>
                            {name}{n > 1 ? <b> ×{n}</b> : null}
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              <div className="readout">
                <span>รวม <b>{total(rec)}</b> metric ใน <b>{rounds.length}</b> รอบ</span>
                <span>ถ้ารันทีละ expectation แยกกัน: <b>{aloneMetrics}</b> metric</span>
                <span>ประหยัดเพราะใช้ร่วมกัน: <b>{aloneMetrics - total(rec)}</b></span>
              </div>
              <div className="gx-sql">
                <div className="lab-label">ถ้ารันกับ SQL (SQLite) suite เดียวกัน</div>
                <div className="readout">
                  <span>ส่ง <b>{rec.sql}</b> คำสั่ง SQL</span>
                  <span>ถ้าแยกรัน: <b>{aloneSql}</b> คำสั่ง</span>
                </div>
                <pre className="codeline">{rec.sqlFirst.join('\n') || '(ไม่มี)'}</pre>
              </div>
            </>
          )}
        </div>
      </div>

      <p className="viz-caption">
        ตัวเลขทั้งหมดมาจากการรัน GX {data.version} จริงกับตารางตัวอย่างสี่แถว ไม่ใช่การจำลอง metric ที่ขึ้นกับคอลัมน์เดียวกันถูกนับครั้งเดียว
        (เช่นเลือกสอง expectation ที่ถาม <code>id</code> ทั้งคู่) ส่วน metric ของคนละคอลัมน์นับแยก ลองเลือก BOOLEAN_ONLY แล้วสลับเป็น SUMMARY
        จะเห็นรอบสุดท้ายหนักขึ้นมาก
      </p>
    </figure>
  );
}
