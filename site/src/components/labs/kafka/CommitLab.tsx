import { useState } from 'react';
import type { Lang } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import { Cell, Flag } from './kf';
import { commitOutcome, type CommitMode } from './models';

// Shows:      ten records read in two batches, a bookmark (the committed offset) and a crash after some records were processed, then a new consumer that starts at the bookmark.
// Because:    loss and repeats are both about where the bookmark stands compared with the work that was done. Cells that are never processed, or processed twice, show it at a glance.
// Control:    when the commit happens (before processing, after each batch, after each record) and after how many records the consumer crashes.
// Conclusion: commit before processing can lose records, commit after processing can repeat them, and the only way to be exact is to make the processing safe to repeat (or to commit in the same transaction).
//
// Exercise 04 ran "process 8 records, commit after 6, crash": the new consumer read task-6 and task-7 twice. Exercise 08 ran "commit 6, crash before processing": job-0 to job-5 were never processed.

const MODES: CommitMode[] = ['before', 'after-batch', 'after-each'];
const CRASHES = [0, 3, 8];

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; mode: string; modes: Record<CommitMode, string>; crash: string; crashes: (n: number) => string;
  lost: string; once: string; twice: string; bookmark: string; batch: string; readout: (lost: number, twice: number, committed: number) => string; caption: string;
}> = {
  th: {
    title: 'เลือกว่าจะ Commit Offset ตอนไหน และ Consumer ล้มหลังประมวลผลไปกี่ Record แล้วดูว่า Record ไหนหายหรือถูกประมวลผลสองครั้ง',
    legend: [{ kind: 'use', text: 'ประมวลผลครั้งเดียว' }, { kind: 'new', text: 'ประมวลผลสองครั้ง' }],
    mode: 'Commit', modes: { before: 'ก่อนประมวลผล (ทีละ Batch)', 'after-batch': 'หลังประมวลผลครบ Batch', 'after-each': 'หลังประมวลผลทุก Record' },
    crash: 'ล้มหลังประมวลผล', crashes: (n) => `${n} Record`, lost: 'หาย', once: '1 ครั้ง', twice: '2 ครั้ง', bookmark: 'ที่คั่นหนังสือ (committed offset)', batch: 'Batch',
    readout: (lost, twice, committed) => `ตอนล้ม ที่คั่นหนังสืออยู่ที่ ${committed} Consumer ตัวใหม่เริ่มอ่านจากตรงนั้น ผลคือ Record หาย ${lost} ตัว และถูกประมวลผลซ้ำ ${twice} ตัว`,
    caption: 'แบบฝึก 04 รัน "ประมวลผล 8 Record, Commit หลัง 6, แล้วล้ม" ได้ task-6 กับ task-7 ซ้ำ ส่วนแบบฝึก 08 รัน "Commit 6 แล้วล้มก่อนประมวลผล" ได้ job-0 ถึง job-5 หายไป ในรูป Batch มีขนาด 6 Record',
  },
  en: {
    title: 'Choose when to commit the offset and after how many records the consumer crashes, then see which records are lost or processed twice',
    legend: [{ kind: 'use', text: 'processed once' }, { kind: 'new', text: 'processed twice' }],
    mode: 'commit', modes: { before: 'before processing (per batch)', 'after-batch': 'after the whole batch', 'after-each': 'after every record' },
    crash: 'crash after processing', crashes: (n) => `${n} records`, lost: 'lost', once: 'once', twice: 'twice', bookmark: 'bookmark (committed offset)', batch: 'batch',
    readout: (lost, twice, committed) => `At the crash the bookmark stood at ${committed}, and the new consumer starts there. The result: ${lost} records lost, ${twice} processed twice`,
    caption: 'Exercise 04 ran "process 8 records, commit after 6, crash" and task-6 and task-7 came twice. Exercise 08 ran "commit 6, crash before processing" and job-0 to job-5 were never processed. A batch is 6 records in the picture.',
  },
};

export default function CommitLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [mode, setMode] = useState<CommitMode>('after-batch');
  const [crash, setCrash] = useState(8);
  const { times, committed } = commitOutcome(mode, crash);
  const lost = times.filter((t) => t === 0).length;
  const twice = times.filter((t) => t >= 2).length;
  const X = (i: number) => 40 + i * 80;
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.mode}</span>
        <span className="seg" role="group" aria-label={T.mode}>
          {MODES.map((m) => (<button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>{T.modes[m]}</button>))}
        </span>
        <span className="ib-lbl">{T.crash}</span>
        <span className="seg" role="group" aria-label={T.crash}>
          {CRASHES.map((n) => (<button key={n} type="button" aria-pressed={crash === n} onClick={() => setCrash(n)}>{T.crashes(n)}</button>))}
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 290" role="img" aria-label={T.title}>
          <rect className="ib-zone" x={34} y={34} width={6 * 80 - 8} height={20} rx={6} />
          <text x={44} y={50} className="ib-s">{`${T.batch} 1`}</text>
          <rect className="ib-zone" x={34 + 480} y={34} width={4 * 80 - 8} height={20} rx={6} />
          <text x={44 + 480} y={50} className="ib-s">{`${T.batch} 2`}</text>
          {times.map((t, i) => (
            <Cell key={i} x={X(i)} y={92} w={64} h={56} offset={i} text={`r${i}`} state={t === 0 ? 'bad' : t >= 2 ? 'new' : 'use'} sub={t === 0 ? T.lost : t >= 2 ? T.twice : T.once} />
          ))}
          <Flag x={X(committed < 10 ? committed : 9) + (committed < 10 ? 32 : 70)} y={196} label={`${T.bookmark}: ${committed}`} anchor={committed > 6 ? 'end' : 'start'} />
          {crash > 0 && crash <= 10 && <text x={X(crash) - 8} y={134} textAnchor="middle" className="ib-bad" style={{ fontSize: 34 }}>⚡</text>}
          {crash === 0 && <text x={30} y={134} textAnchor="middle" className="ib-bad" style={{ fontSize: 34 }}>⚡</text>}
        </svg>
      </div>
      <div className="readout" aria-live="polite"><div>{T.readout(lost, twice, committed)}</div></div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
