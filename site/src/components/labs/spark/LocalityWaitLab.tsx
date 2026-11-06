import { useState } from 'react';
import { ClockControls, prog, useClock, type Lang, type Mark } from './timeline';

// Delay scheduling (TaskSetManager.getAllowedLocalityLevel, lines 621-682; getLocalityWait, 1339-1354; TaskLocality.scala:25):
// a task whose data sits in executor A first waits for a slot at PROCESS_LOCAL, and only after spark.locality.wait
// (3 seconds by default; .process, .node and .rack fall back to it) is it allowed NODE_LOCAL, then RACK_LOCAL, then ANY.
// NO_PREF and ANY have no wait. Read from the source only: local mode has one executor and no HDFS, so none of this was
// run on the owner's machine (the lesson says so). The cluster and the free slot of each case are made up.

type Free = 'a' | 'b' | 'c' | 'd';
const CASES: { id: Free; level: string; at: number }[] = [
  { id: 'a', level: 'PROCESS_LOCAL', at: 1.8 },
  { id: 'b', level: 'NODE_LOCAL', at: 3 },
  { id: 'c', level: 'RACK_LOCAL', at: 6 },
  { id: 'd', level: 'ANY', at: 9 },
];
interface Txt {
  labels: Record<Free, string>;
  wait: { name: string; title: string; text: string };
  drop: { name: string; title: string; text: string };
  run: (c: { id: Free; level: string }) => { name: string; title: string; text: string };
  title: string; pick: string; svgAria: string; running: string; free: string; busy: string; data: string;
  waiting: (launched: boolean, level: string, allowed: string) => string;
  waitSec: (s: number) => string; noWait: string; caption: string;
}

const TEXT: Record<Lang, Txt> = {
  th: {
    labels: {
      a: 'executor A ว่างหลัง 1.8 วินาที',
      b: 'มีแต่ executor B ว่าง (node เดียวกับ A)',
      c: 'มีแต่ executor C ว่าง (rack เดียวกัน)',
      d: 'มีแต่ executor D ว่าง (rack อื่น)',
    },
    wait: { name: 'task รอ', title: 'task อยากรันที่ executor A ที่ถือข้อมูลอยู่ แต่ A ไม่ว่าง', text: 'scheduler ไม่ได้ส่ง task ไปที่ว่างทันที มันรอ slot ที่ดีที่สุดก่อน (delay scheduling) ข้อมูลของ task อยู่ใน process ของ executor A' },
    drop: { name: 'ลดระดับ', title: 'ครบ 3 วินาที (spark.locality.wait) ยอมลดจาก PROCESS_LOCAL เป็น NODE_LOCAL', text: 'ระดับเรียงจากดีไปแย่: PROCESS_LOCAL, NODE_LOCAL, NO_PREF, RACK_LOCAL, ANY แต่ละระดับรอ 3 วินาทีก่อนยอมลง ระดับที่ไม่มีเวลารอ (NO_PREF, ANY) คืน 0' },
    run: (c) => ({ name: 'รัน', title: `task เริ่มที่ระดับ ${c.level}`, text: c.id === 'a' ? 'A ว่างก่อนครบเวลารอ task จึงได้ระดับดีที่สุดโดยไม่ต้องเสียข้อมูลข้ามที่ไหน' : 'ได้ slot ทันทีที่ระดับของมันถูกอนุญาต ยิ่งไกลยิ่งรอนาน: งานที่ทำได้ไว แต่ข้อมูลต้องข้าม node หรือ rack ไปหา executor นี้ (trade-off ที่ปรับด้วย spark.locality.wait)' }),
    title: 'Data locality: scheduler ยอมรอ slot ที่ดีกว่าก่อนลดระดับ',
    pick: 'executor ที่ว่าง',
    svgAria: 'task รอ slot ตามระดับ locality',
    running: 'task รันที่นี่',
    free: 'ว่าง',
    busy: 'ไม่ว่าง',
    data: 'ข้อมูล',
    waiting: (launched, level, allowed) => `task ที่รออยู่ (${launched ? `เริ่มแล้วที่ ${level}` : `ยอมรับได้ถึง ${allowed}`})`,
    waitSec: (s) => ` (รอ ${s}s)`,
    noWait: ' (ไม่รอ)',
    caption: 'ลำดับระดับและกติกา delay scheduling อ่านจาก TaskSetManager และ TaskLocality (Spark 4.2.0) ค่าเริ่มต้น spark.locality.wait คือ 3 วินาที ส่วนนี้ไม่ได้รันบนเครื่องนี้เพราะ local mode มี executor เดียวและไม่มี HDFS จึงยังไม่ยืนยันพฤติกรรมบน cluster จริง ผังของ cluster และ executor ที่ว่างเป็นตัวอย่าง',
  },
  en: {
    labels: {
      a: 'executor A is free after 1.8 seconds',
      b: 'only executor B is free (same node as A)',
      c: 'only executor C is free (same rack)',
      d: 'only executor D is free (other rack)',
    },
    wait: { name: 'Task waits', title: 'The task wants to run on executor A, which holds its data, but A is not free', text: 'The scheduler does not send the task to whatever is free right away. It first waits for the best slot (delay scheduling). The data of the task is in the process of executor A.' },
    drop: { name: 'Lower level', title: 'After 3 seconds (spark.locality.wait) it accepts NODE_LOCAL instead of PROCESS_LOCAL', text: 'The levels go from best to worst: PROCESS_LOCAL, NODE_LOCAL, NO_PREF, RACK_LOCAL, ANY. Each level waits 3 seconds before it gives way. The levels with no wait time (NO_PREF, ANY) return 0.' },
    run: (c) => ({ name: 'Run', title: `The task starts at level ${c.level}`, text: c.id === 'a' ? 'A became free before the wait time ran out, so the task gets the best level and its data does not have to cross anything.' : 'It gets a slot as soon as its level is allowed. The farther the slot, the longer the wait: the work can start sooner, but the data has to cross a node or a rack to reach this executor (a trade-off set by spark.locality.wait).' }),
    title: 'Data locality: the scheduler waits for a better slot before it lowers the level',
    pick: 'Which executor is free',
    svgAria: 'A task waits for a slot, level by level of locality',
    running: 'task runs here',
    free: 'free',
    busy: 'busy',
    data: 'data',
    waiting: (launched, level, allowed) => `Waiting task (${launched ? `started at ${level}` : `accepts up to ${allowed}`})`,
    waitSec: (s) => ` (wait ${s}s)`,
    noWait: ' (no wait)',
    caption: 'The order of the levels and the rules of delay scheduling are read from TaskSetManager and TaskLocality (Spark 4.2.0). The default spark.locality.wait is 3 seconds. This was not run on this machine, because local mode has one executor and no HDFS, so the behavior on a real cluster is not confirmed. The cluster layout and the free executor are examples.',
  },
};

const WAIT = 3;
const LEVELS = ['PROCESS_LOCAL', 'NODE_LOCAL', 'RACK_LOCAL', 'ANY'];
const DURATION = 12;

const EX: Record<Free, { x: number; y: number; label: string }> = {
  a: { x: 40, y: 88, label: 'executor A' },
  b: { x: 40, y: 168, label: 'executor B' },
  c: { x: 272, y: 88, label: 'executor C' },
  d: { x: 506, y: 88, label: 'executor D' },
};

export default function LocalityWaitLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [free, setFree] = useState<Free>('b');
  const clock = useClock(DURATION);
  const { t } = clock;
  const c = CASES.find((x) => x.id === free)!;
  const launched = t >= c.at;
  const allowed = launched ? LEVELS.indexOf(c.level) : Math.min(3, Math.floor(t / WAIT));
  const target = launched ? free : null;

  const marks: Mark[] = [
    { at: 0, ...T.wait },
    { at: WAIT, ...T.drop },
    { at: c.at + 0.05, ...T.run(c) },
  ].filter((m, i, a) => i === 0 || m.at > a[i - 1].at + 0.05);

  return (
    <figure className="viz lg">
      <div className="viz-title">{T.title}</div>
      <div className="viz-steps" role="group" aria-label={T.pick}>
        {CASES.map((x) => <button key={x.id} type="button" aria-pressed={free === x.id} onClick={() => { setFree(x.id); clock.restart(); }}>{T.labels[x.id]}</button>)}
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 396" role="img" aria-label={T.svgAria}>
          <rect className="band" x="10" y="10" width="860" height="376" rx="12" />

          {/* racks and nodes */}
          <rect x="24" y="44" width="450" height="226" rx="12" fill="none" stroke="var(--line-strong)" strokeDasharray="6 5" />
          <text className="s b" x="34" y="64">rack 1</text>
          <rect x="30" y="72" width="226" height="190" rx="10" fill="none" stroke="var(--line)" />
          <text className="s" x="40" y="90">node X</text>
          <rect x="262" y="72" width="204" height="108" rx="10" fill="none" stroke="var(--line)" />
          <text className="s" x="272" y="90">node Y</text>
          <rect x="490" y="44" width="360" height="226" rx="12" fill="none" stroke="var(--line-strong)" strokeDasharray="6 5" />
          <text className="s b" x="500" y="64">rack 2</text>
          <rect x="496" y="72" width="204" height="108" rx="10" fill="none" stroke="var(--line)" />
          <text className="s" x="506" y="90">node Z</text>

          {(Object.keys(EX) as Free[]).map((k) => {
            const e = EX[k];
            const isFree = k === free && (k !== 'a' || t >= CASES[0].at) ? true : false;
            const isTarget = target === k;
            return (
              <g key={k} transform={`translate(${e.x} ${e.y + 12})`}>
                <rect width="170" height="52" rx="8" className={isTarget ? 'fx-hot' : 'box'} stroke={isFree ? 'var(--k2)' : undefined} strokeWidth={isFree ? 3 : undefined} />
                <text className="b" x="10" y="22" style={{ fontSize: 13 }}>{e.label}</text>
                <text className="s" x="10" y="40" style={{ fill: isFree ? 'var(--k2)' : 'var(--muted)' }}>{isTarget ? T.running : isFree ? T.free : T.busy}</text>
                {k === 'a' && (
                  <g transform="translate(112 16)">
                    <circle cx="10" cy="10" r="8" className="k1" />
                    <text className="s" x="22" y="14">{T.data}</text>
                  </g>
                )}
              </g>
            );
          })}

          {/* the waiting task */}
          <g transform="translate(60 286)">
            <rect className="box" width="40" height="40" rx="8" />
            <circle cx="20" cy="20" r="11" className="k1" />
          </g>
          <text className="b" x="112" y="311" style={{ fontSize: 13 }}>{T.waiting(launched, c.level, LEVELS[allowed])}</text>

          {/* timeline of the levels */}
          <g transform="translate(40 338)">
            {LEVELS.map((lv, i) => {
              const x = i * 200;
              const from = i * WAIT;
              const fill = launched ? Math.min(1, Math.max(0, (c.at - from) / WAIT)) : prog(t, from, from + WAIT);
              return (
                <g key={lv} transform={`translate(${x} 0)`}>
                  <rect width="190" height="26" rx="6" className="box" />
                  <rect width={190 * (i === 3 ? (launched && c.at >= 9 ? 1 : 0) : fill)} height="26" rx="6" className={launched && LEVELS.indexOf(c.level) === i ? 'fx-hot' : 'k1'} opacity={i === 3 ? 1 : 0.55} />
                  <text className="s m b" x="8" y="18" style={{ fontSize: 11.5 }}>{lv}{i < 3 ? T.waitSec(WAIT) : T.noWait}</text>
                </g>
              );
            })}
            <line x1={Math.min(t, 9) / 9 * 790} x2={Math.min(t, 9) / 9 * 790} y1="-6" y2="32" stroke="var(--accent)" strokeWidth="2.5" />
          </g>
        </svg>
      </div>
      <ClockControls clock={clock} marks={marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
