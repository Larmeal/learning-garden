import { useState } from 'react';
import matrix from './metricMatrix.json';

interface Rec {
  rounds: number[][];
  sql: number;
  sqlFirst: string[];
}
const data = matrix as unknown as { version: string; formats: string[]; records: Record<string, Rec> };

type Lang = 'th' | 'en';

const PRESETS: { id: string; sel: number[] }[] = [
  { id: 'few', sel: [0, 1] },
  { id: 'agg', sel: [4, 5, 6] },
  { id: 'mix', sel: [0, 1, 2, 4, 6] },
  { id: 'all', sel: [0, 1, 2, 3, 4, 5, 6] },
];

const TEXT: Record<
  Lang,
  {
    title: string;
    presets: Record<string, { label: string; note: string }>;
    rounds: (metrics: number, rounds: number) => string;
    selects: (n: number) => string;
    spark: string;
    caption1: string;
    caption2: string;
    caption3: (version: string) => string;
  }
> = {
  th: {
    title: 'suite เดียวกัน บน pandas และบน SQL ทำงานไม่เหมือนกัน',
    presets: {
      few: { label: 'not null 2 ข้อ', note: 'ตรวจ null ของ id และ age' },
      agg: { label: 'ค่าสถิติ 3 ข้อ', note: 'max, mean และจำนวนแถว (aggregate ทั้งหมด)' },
      mix: { label: 'ผสม 5 ข้อ', note: 'null, ช่วงค่า, max และจำนวนแถว' },
      all: { label: 'ครบ 7 ข้อ', note: 'ทุก expectation ในตัวอย่าง' },
    },
    rounds: (m, r) => `${m} metric ใน ${r} รอบ (คำนวณในหน่วยความจำ ทีละ metric)`,
    selects: (n) => `${n} คำสั่ง SELECT ส่งไปที่ database`,
    spark: 'ยังไม่ได้วัด: ตามซอร์ส aggregate ใน domain เดียวกันรวมเป็น df.agg(...).collect() หนึ่งครั้ง',
    caption1: '. จำนวน metric เท่ากันทุก backend แต่ SQL รวม metric แบบ aggregate (เช่น ',
    caption2: ' กับ ',
    caption3: (v) => `) ไว้ใน SELECT เดียว ทำให้จำนวนครั้งที่ไปถึงข้อมูลน้อยกว่าจำนวน metric ข้อมูลวัดจาก GX ${v}`,
  },
  en: {
    title: 'The same suite runs differently on pandas and on SQL',
    presets: {
      few: { label: '2 not null', note: 'Check null in id and age' },
      agg: { label: '3 statistics', note: 'max, mean and row count (all aggregates)' },
      mix: { label: '5 mixed', note: 'null, value range, max and row count' },
      all: { label: 'All 7', note: 'Every expectation in the example' },
    },
    rounds: (m, r) => `${m} metrics in ${r} rounds (computed in memory, one metric at a time)`,
    selects: (n) => `${n} SELECT statements sent to the database`,
    spark: 'Not measured. According to the source, aggregates in the same domain are combined into one df.agg(...).collect().',
    caption1: '. The number of metrics is the same on every backend, but SQL puts the aggregate metrics (such as ',
    caption2: ' and ',
    caption3: (v) => ') into one SELECT, so it reaches the data fewer times than the number of metrics. Measured with GX ' + v,
  },
};

const total = (r: Rec) => r.rounds.reduce((n, x) => n + x.length, 0);

export default function BackendCompare({ lang = 'th' }: { lang?: Lang }) {
  const t = TEXT[lang];
  const [pid, setPid] = useState('mix');
  const [fmt, setFmt] = useState('BOOLEAN_ONLY');
  const preset = PRESETS.find((p) => p.id === pid)!;
  const rec = data.records[`${preset.sel.join('-')}|${fmt}`];
  const metrics = total(rec);
  const max = Math.max(metrics, rec.sql, 1);

  return (
    <figure className="viz">
      <div className="viz-title">{t.title}</div>
      <div className="lab-controls">
        <div>
          <div className="lab-label">suite</div>
          <div className="seg" role="group" aria-label="suite">
            {PRESETS.map((p) => (
              <button key={p.id} type="button" aria-pressed={pid === p.id} onClick={() => setPid(p.id)}>{t.presets[p.id].label}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="lab-label">result_format</div>
          <div className="seg" role="group" aria-label="result_format">
            {data.formats.map((f) => (
              <button key={f} type="button" aria-pressed={fmt === f} onClick={() => setFmt(f)}>{f}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="gx-bars">
        <div className="gx-bar-row">
          <span className="lbl">pandas</span>
          <div className="skew-track"><div className="skew-bar" style={{ width: `${(metrics / max) * 100}%` }} /></div>
          <span className="mono">{t.rounds(metrics, rec.rounds.filter((r) => r.length).length)}</span>
        </div>
        <div className="gx-bar-row">
          <span className="lbl">SQL (SQLite)</span>
          <div className="skew-track"><div className="skew-bar hot" style={{ width: `${(rec.sql / max) * 100}%` }} /></div>
          <span className="mono">{t.selects(rec.sql)}</span>
        </div>
        <div className="gx-bar-row">
          <span className="lbl">Spark</span>
          <div className="skew-track" style={{ borderStyle: 'dotted' }} />
          <span className="mono">{t.spark}</span>
        </div>
      </div>

      <pre className="codeline">{rec.sqlFirst.join('\n')}</pre>

      <p className="viz-caption">
        {t.presets[preset.id].note}
        {t.caption1}
        <code>avg</code>
        {t.caption2}
        <code>max</code>
        {t.caption3(data.version)}
      </p>
    </figure>
  );
}
