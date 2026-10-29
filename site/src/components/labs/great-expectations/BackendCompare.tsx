import { useState } from 'react';
import matrix from './metricMatrix.json';

interface Rec {
  rounds: number[][];
  sql: number;
  sqlFirst: string[];
}
const data = matrix as unknown as { version: string; formats: string[]; records: Record<string, Rec> };

const PRESETS: { id: string; label: string; sel: number[]; note: string }[] = [
  { id: 'few', label: 'not null 2 ข้อ', sel: [0, 1], note: 'ตรวจ null ของ id และ age' },
  { id: 'agg', label: 'ค่าสถิติ 3 ข้อ', sel: [4, 5, 6], note: 'max, mean และจำนวนแถว (aggregate ทั้งหมด)' },
  { id: 'mix', label: 'ผสม 5 ข้อ', sel: [0, 1, 2, 4, 6], note: 'null, ช่วงค่า, max และจำนวนแถว' },
  { id: 'all', label: 'ครบ 7 ข้อ', sel: [0, 1, 2, 3, 4, 5, 6], note: 'ทุก expectation ในตัวอย่าง' },
];

const total = (r: Rec) => r.rounds.reduce((n, x) => n + x.length, 0);

export default function BackendCompare() {
  const [pid, setPid] = useState('mix');
  const [fmt, setFmt] = useState('BOOLEAN_ONLY');
  const preset = PRESETS.find((p) => p.id === pid)!;
  const rec = data.records[`${preset.sel.join('-')}|${fmt}`];
  const metrics = total(rec);
  const max = Math.max(metrics, rec.sql, 1);

  return (
    <figure className="viz">
      <div className="viz-title">suite เดียวกัน บน pandas และบน SQL ทำงานไม่เหมือนกัน</div>
      <div className="lab-controls">
        <div>
          <div className="lab-label">suite</div>
          <div className="seg" role="group" aria-label="suite">
            {PRESETS.map((p) => (
              <button key={p.id} type="button" aria-pressed={pid === p.id} onClick={() => setPid(p.id)}>{p.label}</button>
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
          <span className="mono">{metrics} metric ใน {rec.rounds.filter((r) => r.length).length} รอบ (คำนวณในหน่วยความจำ ทีละ metric)</span>
        </div>
        <div className="gx-bar-row">
          <span className="lbl">SQL (SQLite)</span>
          <div className="skew-track"><div className="skew-bar hot" style={{ width: `${(rec.sql / max) * 100}%` }} /></div>
          <span className="mono">{rec.sql} คำสั่ง SELECT ส่งไปที่ database</span>
        </div>
        <div className="gx-bar-row">
          <span className="lbl">Spark</span>
          <div className="skew-track" style={{ borderStyle: 'dotted' }} />
          <span className="mono">ยังไม่ได้วัด: ตามซอร์ส aggregate ใน domain เดียวกันรวมเป็น df.agg(...).collect() หนึ่งครั้ง</span>
        </div>
      </div>

      <pre className="codeline">{rec.sqlFirst.join('\n')}</pre>

      <p className="viz-caption">
        {preset.note}. จำนวน metric เท่ากันทุก backend แต่ SQL รวม metric แบบ aggregate (เช่น <code>avg</code> กับ <code>max</code>) ไว้ใน SELECT เดียว ทำให้จำนวนครั้งที่ไปถึงข้อมูลน้อยกว่าจำนวน metric
        ข้อมูลวัดจาก GX {data.version}
      </p>
    </figure>
  );
}
