import { useState } from 'react';
import type { Lang } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import data from './segments.json';

// Shows:      48 records of four keys (twelve updates of each) as a grid, and what the log cleaner leaves of them: the last record of every key, at its old offset, and a tombstone that deletes k3 and later disappears.
// Because:    compaction is about which cells of a grid survive. The gaps between the surviving offsets (44, 45, 47, 48) are the point and are invisible in a sentence.
// Control:    three stages: before the cleaner, after the cleaner, after delete.retention.ms.
// Conclusion: a compacted topic keeps the latest value of every key (a table of current state), offsets stay where they were, and a null value deletes a key.
//
// Real data from exercise 05: the survivors (offsets 44, 45, 47 and the tombstone at 48) are read from segments.json, and the log was read with kafka-dump-log.sh.

const KEYS = ['k1', 'k2', 'k3', 'k4'];
const ROUNDS = 12;
const STAGES = ['before', 'after', 'later'] as const;
type Stage = (typeof STAGES)[number];
const SURVIVORS = new Set(data.compaction.after.map((a) => a.offset));

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; stage: string; stages: Record<Stage, string>; removed: string;
  readout: (s: Stage, n: number) => string; caption: string;
}> = {
  th: {
    title: 'กดสลับสามช่วงเวลาเพื่อดูว่า Log Cleaner เก็บ Record ไหนไว้ในแต่ละ Key และ k3 ที่ถูกลบด้วย Tombstone หายไปอย่างไร',
    legend: [{ kind: 'use', text: 'Record ที่ยังอยู่' }, { kind: 'new', text: 'Tombstone (value เป็น null)' }, { kind: 'skip', text: 'ที่ที่ Record ถูกลบไปแล้ว (offset ยังเป็นของเดิม)' }],
    stage: 'ช่วงเวลา', stages: { before: 'ก่อน Cleaner ทำงาน', after: 'หลัง Cleaner ทำงาน', later: 'หลังเลย delete.retention.ms' }, removed: 'ลบแล้ว',
    readout: (s, n) => s === 'before' ? `Log มี Record ของ k1 ถึง k4 อย่างละ 12 ครั้ง บวก Tombstone ของ k3 อีก 1 ตัว รวม ${n} ตัว (ยังไม่นับ Record ของ Key อื่นที่ต่อท้ายอีก 40 ตัว)` : s === 'after' ? `เหลือ ${n} ตัว คือค่าล่าสุดของ k1, k2, k4 ที่ offset 44, 45, 47 และ Tombstone ของ k3 ที่ offset 48 ส่วนค่าเก่าของ k3 ทั้ง 12 ตัวหายหมดแล้ว` : `เหลือ ${n} ตัว Tombstone ของ k3 ถูกเก็บกวาดหลังพ้น delete.retention.ms แล้ว k3 ไม่เหลือร่องรอยใน Log เลย`,
    caption: 'ตัวเลขทั้งหมดมาจากแบบฝึก 05: ส่ง k1 ถึง k4 วนรอบละ 4 ตัวสิบสองรอบ ส่ง Tombstone ของ k3 แล้วอ่านไฟล์ .log ด้วย kafka-dump-log.sh ก่อนและหลังที่ Cleaner ทำงาน (ตั้ง min.compaction.lag.ms ไว้ 1 ชั่วโมงเพื่อให้เห็นก่อนแล้วค่อยปรับเป็น 0)',
  },
  en: {
    title: 'Switch between three moments to see which record the log cleaner keeps for each key, and how k3, deleted by a tombstone, disappears',
    legend: [{ kind: 'use', text: 'record that is still there' }, { kind: 'new', text: 'tombstone (value is null)' }, { kind: 'skip', text: 'where a record was removed (the offsets stay as they were)' }],
    stage: 'moment', stages: { before: 'before the cleaner', after: 'after the cleaner', later: 'after delete.retention.ms' }, removed: 'removed',
    readout: (s, n) => s === 'before' ? `The log holds twelve records each of k1 to k4 plus one tombstone for k3, ${n} in all (not counting 40 records of other keys that follow)` : s === 'after' ? `${n} are left: the latest values of k1, k2 and k4 at offsets 44, 45 and 47, and the tombstone of k3 at offset 48. All twelve old values of k3 are gone.` : `${n} are left. The tombstone of k3 was swept after delete.retention.ms, and k3 leaves no trace in the log.`,
    caption: 'Every number comes from exercise 05: k1 to k4 sent in rounds of four, twelve rounds, a tombstone for k3, and the .log files read with kafka-dump-log.sh before and after the cleaner ran (min.compaction.lag.ms was an hour to see the "before", then set to 0).',
  },
};

export default function CompactionLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [stage, setStage] = useState<Stage>('after');
  const X = (r: number) => 82 + r * 59;
  const Y = (k: number) => 50 + k * 66;
  const present = (off: number) => stage === 'before' || (stage === 'after' ? SURVIVORS.has(off) : SURVIVORS.has(off) && off !== 48);
  const count = (stage === 'before' ? 49 : stage === 'after' ? 4 : 3);
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.stage}</span>
        <span className="seg" role="group" aria-label={T.stage}>
          {STAGES.map((s) => (<button key={s} type="button" aria-pressed={stage === s} onClick={() => setStage(s)}>{T.stages[s]}</button>))}
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 330" role="img" aria-label={T.title}>
          {KEYS.map((k, ki) => (
            <g key={k}>
              <text x={22} y={Y(ki) + 30} className="ib-n">{k}</text>
              {Array.from({ length: ROUNDS }, (_, r) => {
                const off = r * 4 + ki;
                const keep = present(off);
                return (
                  <g key={r}>
                    <rect className={keep ? 'ib-use' : 'ib-skip'} x={X(r)} y={Y(ki)} width={54} height={44} rx={7} style={!keep ? { opacity: 0.45 } : undefined} />
                    {keep && <text x={X(r) + 27} y={Y(ki) + 28} textAnchor="middle" className="ib-n" style={{ fontSize: 14 }}>{`v${r}`}</text>}
                    {(ki === 0 || keep) && <text x={X(r) + 27} y={Y(ki) - 6} textAnchor="middle" className="ib-s" style={{ fontSize: 12 }}>{off}</text>}
                  </g>
                );
              })}
              {ki === 2 && (
                <g>
                  <rect className={stage === 'later' ? 'ib-skip' : 'ib-new'} x={X(ROUNDS) + 4} y={Y(2)} width={54} height={44} rx={7} style={stage === 'later' ? { opacity: 0.45 } : undefined} />
                  {stage !== 'later' && <text x={X(ROUNDS) + 31} y={Y(2) + 28} textAnchor="middle" className="ib-n" style={{ fontSize: 14 }}>null</text>}
                  <text x={X(ROUNDS) + 31} y={Y(2) - 6} textAnchor="middle" className="ib-s" style={{ fontSize: 12 }}>48</text>
                </g>
              )}
            </g>
          ))}
          <text x={22} y={318} className="ib-s">offset ↑ · v0 … v11 = {lang === 'th' ? 'ค่าที่ส่งในรอบที่ 0 ถึง 11' : 'the value sent in rounds 0 to 11'}</text>
        </svg>
      </div>
      <div className="readout" aria-live="polite"><div>{T.readout(stage, count)}</div></div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
