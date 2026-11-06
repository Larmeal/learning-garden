import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import matrix from './metricMatrix.json';
import type { Lang } from '../../../i18n';

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

const FORMAT_HINT: Record<Lang, Record<string, string>> = {
  th: {
    BOOLEAN_ONLY: 'ได้แค่ผ่าน/ไม่ผ่าน',
    BASIC: 'เพิ่มค่าที่ผิดบางส่วน',
    SUMMARY: 'ค่าเริ่มต้นของ ValidationDefinition.run',
    COMPLETE: 'ผลละเอียดสุด',
  },
  en: {
    BOOLEAN_ONLY: 'Only pass or fail',
    BASIC: 'Adds some of the unexpected values',
    SUMMARY: 'The default of ValidationDefinition.run',
    COMPLETE: 'The most detailed result',
  },
};

const TEXT: Record<Lang, {
  title: string;
  suiteLabel: string;
  pickOne: string;
  playRounds: string;
  showAll: string;
  round: string;
  metricUnit: string;
  totalPre: string;
  totalMid: string;
  totalPost: string;
  alone: string;
  saved: string;
  sqlTitle: string;
  sqlSent: string;
  sqlCommands: string;
  sqlAlone: string;
  sqlUnit: string;
  none: string;
}> = {
  th: {
    title: 'เลือก expectation แล้วดูว่า GX คำนวณ metric อะไรบ้าง ในกี่รอบ',
    suiteLabel: 'expectation ใน suite',
    pickOne: 'เลือก expectation อย่างน้อยหนึ่งข้อ',
    playRounds: 'เล่นทีละรอบ',
    showAll: 'แสดงทั้งหมด',
    round: 'รอบที่',
    metricUnit: 'metric',
    totalPre: 'รวม',
    totalMid: 'metric ใน',
    totalPost: 'รอบ',
    alone: 'ถ้ารันทีละ expectation แยกกัน:',
    saved: 'ประหยัดเพราะใช้ร่วมกัน:',
    sqlTitle: 'ถ้ารันกับ SQL (SQLite) suite เดียวกัน',
    sqlSent: 'ส่ง',
    sqlCommands: 'คำสั่ง SQL',
    sqlAlone: 'ถ้าแยกรัน:',
    sqlUnit: 'คำสั่ง',
    none: '(ไม่มี)',
  },
  en: {
    title: 'Pick expectations and see which metrics GX computes, and in how many rounds',
    suiteLabel: 'Expectations in the suite',
    pickOne: 'Pick at least one expectation',
    playRounds: 'Play round by round',
    showAll: 'Show all',
    round: 'Round',
    metricUnit: 'metrics',
    totalPre: 'Total',
    totalMid: 'metrics in',
    totalPost: 'rounds',
    alone: 'If each expectation runs alone:',
    saved: 'Saved by sharing:',
    sqlTitle: 'The same suite run against SQL (SQLite)',
    sqlSent: 'Sends',
    sqlCommands: 'SQL statements',
    sqlAlone: 'If run separately:',
    sqlUnit: 'statements',
    none: '(none)',
  },
};

// Color the chip by what the metric is for, so the rounds read as layers.
function kind(name: string): 'table' | 'cond' | 'result' | 'agg' {
  if (name.startsWith('table.')) return 'table';
  if (name.endsWith('.condition')) return 'cond';
  if (name.includes('.unexpected_') || name.includes('.missing') || name.includes('.count')) return 'result';
  return 'agg';
}

const key = (sel: number[], fmt: string) => `${[...sel].sort((a, b) => a - b).join('-')}|${fmt}`;
const total = (r?: Rec) => (r ? r.rounds.reduce((n, round) => n + round.length, 0) : 0);

export default function MetricRounds({ lang = 'th' }: { lang?: Lang }) {
  const t = TEXT[lang];
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
      <div className="viz-title">{t.title}</div>

      <div className="gx-split">
        <div className="gx-pane">
          <div className="lab-label">{t.suiteLabel}</div>
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
          <p className="gx-hint">{FORMAT_HINT[lang][fmt]}</p>
        </div>

        <div className="gx-pane gx-grow">
          {!rec ? (
            <p className="gx-empty">{t.pickOne}</p>
          ) : (
            <>
              <div className="viz-controls">
                <button type="button" className="btn primary sm" onClick={play}>{t.playRounds}</button>
                <button type="button" className="btn sm" onClick={() => { setPlaying(false); setShown(99); }}>{t.showAll}</button>
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
                      <div className="gx-round-h">{t.round} {ri + 1} <span>{round.length} {t.metricUnit}</span></div>
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
                <span>{t.totalPre} <b>{total(rec)}</b> {t.totalMid} <b>{rounds.length}</b> {t.totalPost}</span>
                <span>{t.alone} <b>{aloneMetrics}</b> {t.metricUnit}</span>
                <span>{t.saved} <b>{aloneMetrics - total(rec)}</b></span>
              </div>
              <div className="gx-sql">
                <div className="lab-label">{t.sqlTitle}</div>
                <div className="readout">
                  <span>{t.sqlSent} <b>{rec.sql}</b> {t.sqlCommands}</span>
                  <span>{t.sqlAlone} <b>{aloneSql}</b> {t.sqlUnit}</span>
                </div>
                <pre className="codeline">{rec.sqlFirst.join('\n') || t.none}</pre>
              </div>
            </>
          )}
        </div>
      </div>

      <p className="viz-caption">
        {lang === 'en' ? (
          <>
            All numbers come from really running GX {data.version} on a sample table of four rows. They are not a simulation. Metrics that depend on the same
            column are counted once (for example when you pick two expectations that both ask about <code>id</code>). Metrics of different columns are counted
            separately. Pick BOOLEAN_ONLY, then switch to SUMMARY, and you will see the last round get much heavier.
          </>
        ) : (
          <>
            ตัวเลขทั้งหมดมาจากการรัน GX {data.version} จริงกับตารางตัวอย่างสี่แถว ไม่ใช่การจำลอง metric ที่ขึ้นกับคอลัมน์เดียวกันถูกนับครั้งเดียว
            (เช่นเลือกสอง expectation ที่ถาม <code>id</code> ทั้งคู่) ส่วน metric ของคนละคอลัมน์นับแยก ลองเลือก BOOLEAN_ONLY แล้วสลับเป็น SUMMARY
            จะเห็นรอบสุดท้ายหนักขึ้นมาก
          </>
        )}
      </p>
    </figure>
  );
}
