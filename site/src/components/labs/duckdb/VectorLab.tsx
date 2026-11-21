import { useEffect, useState } from 'react';
import { ClockControls, mix, prog, useClock, type Lang, type Mark } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import data from './execution.json';

// Shows:      a queue of row groups (morsels), threads that each take the next one, and vectors of rows that run through scan, projection and aggregate in each thread.
// Because:    "a thread takes a whole row group" and "a table with one row group has nothing to hand to a second thread" are about who waits for whom over time.
// Control:    the number of threads (1 or 3) and the table (1 row group or 9). Changing either restarts the clock and changes how many lanes work and how long it takes.
// Conclusion: the time needed is the number of row groups divided by the threads that have one to take, so a table with one row group gains nothing from more threads.
//
// One unit of time in the picture is one row group per thread (an illustration, not milliseconds). The measured times are in the table under the picture
// (exercises/08_execution.py --write: execution.json, wall time of the heavy query on tables of 1, 3 and 9 row groups at 1, 4 and 8 threads).

const OPS = ['SEQ_SCAN', 'PROJECTION', 'AGGREGATE'];
const OPX = [330, 500, 670];
const T = {
  th: {
    title: 'เลือกจำนวน Thread และตาราง แล้วกดเล่น ดู Row group ถูกหยิบไปทีละกลุ่มและ Vector วิ่งผ่านแต่ละ Operator',
    legend: [{ kind: 'new' as const, text: 'Vector กำลังวิ่ง' }, { kind: 'use' as const, text: 'Row group ที่เสร็จแล้ว' }, { kind: 'skip' as const, text: 'Thread ที่ไม่มีงานให้ทำ' }],
    threads: 'Thread', table: 'ตาราง', t1: '1 Row group', t9: '9 Row group', queue: 'คิวงาน', lane: 'Thread', idle: 'ว่าง (ไม่มี Row group เหลือให้หยิบ)', done: 'เสร็จแล้ว', unit: 'หน่วยเวลาในภาพ',
    measured: 'เวลาจริงที่วัดได้ (ms) ของ Query หนักบนตารางที่มี 1 Row group และ 9 Row group', th1: '1 Thread', th4: '4 Thread', th8: '8 Thread',
    marks: [
      { name: 'เริ่ม', title: 'Thread หยิบงาน', text: 'ทุก Thread ที่ว่างหยิบ Row group ถัดไปจากคิว' },
      { name: 'ทำงาน', title: 'Vector วิ่งผ่านท่อ', text: 'ในแต่ละ Thread Vector ละ 2,048 แถววิ่งจาก Scan ไป Projection แล้วเข้า Aggregate' },
      { name: 'จบ', title: 'ทุกกลุ่มเสร็จ', text: 'เวลาที่ใช้เท่ากับจำนวน Row group หารด้วยจำนวน Thread ที่มีงานให้ทำ' },
    ],
    caption: 'หน่วยเวลาในภาพเป็นภาพประกอบ ไม่ใช่มิลลิวินาที เวลาจริงอยู่ในตารางด้านล่างซึ่งมาจากแบบฝึก 08 (Query หนักเดียวกันบนตารางที่มี 1 และ 9 Row group)',
  },
  en: {
    title: 'Choose the number of threads and the table, then press play and watch row groups being taken one by one and vectors run through each operator',
    legend: [{ kind: 'new' as const, text: 'a vector is running' }, { kind: 'use' as const, text: 'row group done' }, { kind: 'skip' as const, text: 'a thread with no work' }],
    threads: 'threads', table: 'table', t1: '1 row group', t9: '9 row groups', queue: 'work queue', lane: 'Thread', idle: 'idle (no row group left to take)', done: 'done', unit: 'time units in the picture',
    measured: 'Measured wall time (ms) of the heavy query on tables of 1 and 9 row groups', th1: '1 thread', th4: '4 threads', th8: '8 threads',
    marks: [
      { name: 'Start', title: 'Threads take work', text: 'Every free thread takes the next row group from the queue.' },
      { name: 'Work', title: 'Vectors run through the pipe', text: 'In each thread, vectors of 2,048 rows run from the scan to the projection and into the aggregate.' },
      { name: 'End', title: 'All groups done', text: 'The time taken is the number of row groups divided by the threads that have work to take.' },
    ],
    caption: 'The time units in the picture are an illustration, not milliseconds. The measured times are in the table below, from exercise 08 (the same heavy query on tables of 1 and 9 row groups).',
  },
} as const;

export default function VectorLab({ lang = 'th' }: { lang?: Lang }) {
  const L = T[lang];
  const [threads, setThreads] = useState(3);
  const [groups, setGroups] = useState(9);
  const rounds = Math.ceil(groups / threads);
  const clock = useClock(rounds + 0.4);
  useEffect(() => { clock.restart(); }, [threads, groups]); // eslint-disable-line react-hooks/exhaustive-deps
  const t = clock.t;
  const marks: Mark[] = L.marks.map((m, i) => ({ ...m, at: [0, 0.5, rounds + 0.4][i] }));
  const lanes = Math.min(threads, 3);
  const doneN = Array.from({ length: groups }, (_, m) => Math.floor(m / threads) + 1 <= t).filter(Boolean).length;
  const meas = (name: string, th: number) => data.threads.find((x) => x.table === name && x.threads === th)!.wallMs;
  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{L.title}</div>
      <Legend items={L.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{L.threads}</span>
        <span className="seg" role="group" aria-label={L.threads}>
          {[1, 3].map((n) => <button key={n} type="button" aria-pressed={threads === n} onClick={() => setThreads(n)}>{n}</button>)}
        </span>
        <span className="ib-lbl">{L.table}</span>
        <span className="seg" role="group" aria-label={L.table}>
          <button type="button" aria-pressed={groups === 1} onClick={() => setGroups(1)}>{L.t1}</button>
          <button type="button" aria-pressed={groups === 9} onClick={() => setGroups(9)}>{L.t9}</button>
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 380" role="img" aria-label={L.title}>
          <text x={14} y={26} className="ib-n">{L.queue}</text>
          {Array.from({ length: groups }, (_, m) => {
            const taken = Math.floor(m / threads) + 0.15 <= t;
            const fin = Math.floor(m / threads) + 1 <= t;
            return <rect key={m} className={fin ? 'ib-use' : taken ? 'ib-new' : 'ib-node'} x={14 + (m % 3) * 40} y={40 + Math.floor(m / 3) * 40} width={32} height={32} rx={6} />;
          })}
          {OPS.map((o, i) => <text key={o} x={OPX[i] + 70} y={26} textAnchor="middle" className="ib-m">{o}</text>)}
          {Array.from({ length: lanes }, (_, lane) => {
            const y = 60 + lane * 100;
            const m0 = lane;
            const has = m0 < groups;
            const round = Math.min(Math.floor(t), rounds - 1);
            const m = lane + threads * round;
            const active = has && m < groups && t < rounds;
            const local = t - round;
            return (
              <g key={lane}>
                <text x={170} y={y + 26} className="ib-s">{`${L.lane} ${lane + 1}`}</text>
                {OPX.map((x, i) => <rect key={i} className={has ? 'ib-node' : 'ib-skip'} x={x} y={y} width={140} height={52} rx={9} />)}
                {!has && <text x={340} y={y + 31} className="ib-s">{L.idle}</text>}
                {active && [0, 1, 2].map((v) => {
                  const a = 0.1 + v * 0.15;
                  if (local < a) return null;
                  const q = prog(local, a, a + 0.7) * 3;
                  const seg = Math.min(2, Math.floor(q));
                  const pts = [240, OPX[0] + 70, OPX[1] + 70, OPX[2] + 70];
                  const x = mix(pts[seg], pts[seg + 1], q - seg);
                  return <rect key={v} className="ib-new" x={x - 12} y={y + 14} width={24} height={24} rx={5} />;
                })}
              </g>
            );
          })}
          <text x={14} y={330} className="ib-n">{`${L.done}: ${doneN} / ${groups}`}</text>
          <text x={866} y={330} textAnchor="end" className="ib-s">{`${L.unit}: ${rounds}`}</text>
        </svg>
      </div>
      <ClockControls clock={clock} marks={marks} lang={lang} />
      <div className="tbl-wrap">
        <table className="mini-tbl">
          <thead><tr><th>{L.measured}</th><th>{L.th1}</th><th>{L.th4}</th><th>{L.th8}</th></tr></thead>
          <tbody>
            <tr><td>{L.t1}</td><td>{meas('small', 1)}</td><td>{meas('small', 4)}</td><td>{meas('small', 8)}</td></tr>
            <tr><td>{L.t9}</td><td>{meas('big', 1)}</td><td>{meas('big', 4)}</td><td>{meas('big', 8)}</td></tr>
          </tbody>
        </table>
      </div>
      <figcaption className="viz-caption">{L.caption}</figcaption>
    </figure>
  );
}
