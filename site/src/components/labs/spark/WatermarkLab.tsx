import { motion, useReducedMotion } from 'motion/react';
import { StepControls, useStepper, type StepInfo, type Lang } from './stepper';

// The watermark demo of subjects/spark/code/exercises/09_streaming.py (Spark 4.2.0, append mode, UTC):
//   withWatermark("ts", "10 minutes").groupBy(window("ts", "5 minutes")).count()
// Four files arrive one by one: {12:00:01, 12:03:00}, {12:06:00}, {12:20:00}, and a late {12:01:00}.
// Spark logged batches 0 to 6: after every data batch whose watermark moved it runs one batch with no new data
// to apply the new watermark (numInputRows = 0 in the progress table). Minutes are counted from 11:50.

const T0 = 11 * 60 + 50; // axis start in minutes
const SPAN = 40; // minutes shown
const X0 = 60;
const W = 780;
const px = (min: number) => X0 + ((min - T0) / SPAN) * W;
const m = (h: number, mm: number) => h * 60 + mm;
const label = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;

interface Ev {
  t: number;
  late?: boolean;
  batch: number;
}
const EVENTS: Ev[] = [
  { t: m(12, 0) + 0.02, batch: 0 },
  { t: m(12, 3), batch: 0 },
  { t: m(12, 6), batch: 2 },
  { t: m(12, 20), batch: 4 },
  { t: m(12, 1), batch: 6, late: true },
];

interface Win {
  s: number;
  e: number;
  count: number;
  from: number; // first batch where the window exists in state
  emitted: number; // batch where it is written to the sink
}
const WINDOWS: Win[] = [
  { s: m(12, 0), e: m(12, 5), count: 2, from: 0, emitted: 5 },
  { s: m(12, 5), e: m(12, 10), count: 1, from: 2, emitted: 5 },
  { s: m(12, 20), e: m(12, 25), count: 1, from: 4, emitted: 99 },
];

// watermark applied while running each batch (from the progress table)
const WM = [null, m(11, 53), m(11, 53), m(11, 56), m(11, 56), m(12, 10), m(12, 10)];

const STEPS: Record<Lang, StepInfo[]> = {
  th: [
    { name: 'Batch 0', title: 'Batch 0: ไฟล์แรก (12:00:01 และ 12:03:00)', text: 'Event สองตัวเข้า Window 12:00 ถึง 12:05 นับได้ 2 ตอนนี้ยังไม่มี Watermark (เริ่มจากศูนย์) พออ่านจบ Spark จะคำนวณ Watermark ใหม่ = เวลา Event ที่ใหม่สุด (12:03) ลบ 10 นาที = 11:53 เพื่อใช้ใน Batch ถัดไป' },
    { name: 'Batch 1', title: 'Batch 1: ไม่มีข้อมูลใหม่ แต่ยังรัน', text: 'Watermark เปลี่ยนจาก 0 เป็น 11:53 Spark เลยรัน Batch ที่ numInputRows = 0 เพื่อนำค่าไปใช้ (spark.sql.streaming.noDataMicroBatches.enabled เป็น true) และเพราะยังไม่มี Window ไหนจบก่อน 11:53 จึงไม่ส่งอะไรออก' },
    { name: 'Batch 2', title: 'Batch 2: ไฟล์ที่สอง (12:06:00)', text: 'Event เข้า Window 12:05 ถึง 12:10 ตอนนี้ State มีสอง Window ในโหมด Append ผลของ Window ยังไม่ถูกเขียนออก เพราะอาจมี Event ที่มาช้าเข้ามาเพิ่มได้ Watermark ถัดไป = 12:06 ลบ 10 = 11:56' },
    { name: 'Batch 3', title: 'Batch 3: รันเพื่อนำ Watermark 11:56 ไปใช้', text: 'ยังไม่มี Window ที่ปลายช่วงเกิน 11:56 จึงยังไม่ส่งอะไรออก (วัดจริง: ผลลัพธ์ของ memory sink ยังว่างหลังไฟล์ที่ 1 และ 2)' },
    { name: 'Batch 4', title: 'Batch 4: ไฟล์ที่สาม (12:20:00)', text: 'Event ที่ใหม่มากเข้ามา สร้าง Window 12:20 ถึง 12:25 และเลื่อนเวลา Event ที่ใหม่สุดเป็น 12:20 Watermark ถัดไป = 12:20 ลบ 10 = 12:10' },
    { name: 'Batch 5', title: 'Batch 5: Watermark 12:10 ปิด Window และส่งผลออก', text: 'Window ที่ปลายช่วงไม่เกิน 12:10 ถือว่าจบ ได้แก่ 12:00 ถึง 12:05 (2) และ 12:05 ถึง 12:10 (1) ซึ่งถูกเขียนลง Sink และลบออกจาก State (วัดจริง: numRowsRemoved = 2) นี่คือครั้งแรกที่ Append Mode ปล่อยผลออกมา' },
    { name: 'Batch 6', title: 'Batch 6: Event ที่มาช้า (12:01:00) ถูกทิ้ง', text: 'Event นี้เก่ากว่า Watermark 12:10 และ Spark จะไม่เปิด Window เก่ากลับมา จึงทิ้งทันที (วัดจริง: numRowsDroppedByWatermark อย่างน้อย 1) ผลที่ส่งไปแล้วไม่เปลี่ยน' },
  ],
  en: [
    { name: 'batch 0', title: 'batch 0: the first file (12:00:01 and 12:03:00)', text: 'Two events fall into the window 12:00 to 12:05, so the count is 2. There is no watermark yet (it starts at zero). When the read ends, Spark computes the new watermark = the newest event time (12:03) minus 10 minutes = 11:53, to use in the next batch.' },
    { name: 'batch 1', title: 'batch 1: no new data, but it still runs', text: 'The watermark changed from 0 to 11:53, so Spark runs a batch with numInputRows = 0 to apply the value (spark.sql.streaming.noDataMicroBatches.enabled is true). No window ends before 11:53, so nothing is sent out.' },
    { name: 'batch 2', title: 'batch 2: the second file (12:06:00)', text: 'The event falls into the window 12:05 to 12:10. Now the state holds two windows. In append mode the result of a window is not written yet, because a late event could still arrive and change it. The next watermark = 12:06 minus 10 = 11:56.' },
    { name: 'batch 3', title: 'batch 3: runs to apply the watermark 11:56', text: 'No window ends after 11:56 yet, so nothing is sent out (measured: the memory sink result is still empty after files 1 and 2).' },
    { name: 'batch 4', title: 'batch 4: the third file (12:20:00)', text: 'A much newer event arrives. It creates the window 12:20 to 12:25 and moves the newest event time to 12:20. The next watermark = 12:20 minus 10 = 12:10.' },
    { name: 'batch 5', title: 'batch 5: watermark 12:10 closes windows and sends the results out', text: 'Windows that end at or before 12:10 are finished: 12:00 to 12:05 (2) and 12:05 to 12:10 (1) are written to the sink and removed from the state (measured: numRowsRemoved = 2). This is the first time append mode releases a result.' },
    { name: 'batch 6', title: 'batch 6: the late event (12:01:00) is dropped', text: 'This event is older than the watermark 12:10. Spark does not reopen an old window, so it drops the event at once (measured: numRowsDroppedByWatermark is at least 1). Results already sent do not change.' },
  ],
};

const TEXT = {
  th: {
    title: 'Watermark: Spark รู้ได้อย่างไรว่า Window ไหนปิดแล้ว',
    aria: (n: number, title: string) => `ขั้นที่ ${n}: ${title}`,
    axis: 'เวลาของ Event (Event Time)',
    to: 'ถึง',
    emitted: (n: number) => `ส่งออกแล้ว (${n})`,
    inState: (n: number) => `ใน State: ${n}`,
    dropped: 'ทิ้ง (ช้าเกิน)',
    rule: 'Watermark = Event Time ที่ใหม่สุดที่เคยเห็น ลบ 10 นาที (ใช้ใน Batch ถัดไป)',
    sink: 'ผลที่ Sink ได้รับ (Append)',
    nothing: 'ยังไม่มีอะไร',
    checkpoint: 'Checkpoint ตอนนี้',
    stateWindows: (n: number) => `state: ${n} window`,
    caption: 'ทุก Batch และเลข Watermark มาจาก recentProgress ของการรันจริงใน exercises/09_streaming.py โดยใช้ Window ขนาด 5 นาที Watermark 10 นาที และโหมด Append',
  },
  en: {
    title: 'Watermark: how Spark knows which window is closed',
    aria: (n: number, title: string) => `Step ${n}: ${title}`,
    axis: 'Event time',
    to: 'to',
    emitted: (n: number) => `emitted (${n})`,
    inState: (n: number) => `in state: ${n}`,
    dropped: 'dropped (too late)',
    rule: 'watermark = the newest event time seen, minus 10 minutes (used in the next batch)',
    sink: 'Result the sink received (append)',
    nothing: 'Nothing yet',
    checkpoint: 'Checkpoint now',
    stateWindows: (n: number) => `state: ${n} ${n === 1 ? 'window' : 'windows'}`,
    caption: 'Every batch and watermark value comes from recentProgress of the real run in exercises/09_streaming.py. Window size is 5 minutes, watermark is 10 minutes, append mode.',
  },
};

export default function WatermarkLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const steps = STEPS[lang];
  const { step, go, playing, toggle } = useStepper(steps.length, 4200);
  const reduce = useReducedMotion();
  const t = reduce ? { duration: 0 } : { duration: 0.7, ease: 'easeInOut' as const };
  const wm = WM[step];
  const ticks = [11 * 60 + 50, 12 * 60, 12 * 60 + 10, 12 * 60 + 20, 12 * 60 + 30];
  const emittedRows = WINDOWS.filter((w) => w.emitted <= step);
  return (
    <figure className="viz">
      <div className="viz-title">{T.title}</div>
      <div className="viz-box">
        <svg viewBox="0 0 880 360" role="img" aria-label={T.aria(step + 1, steps[step].title)}>
          <rect className="band" x="10" y="10" width="860" height="340" rx="12" />
          <text className="b" x="28" y="36">{T.axis}</text>

          {/* axis */}
          <line className="ln" x1={X0} x2={X0 + W} y1={150} y2={150} />
          {ticks.map((tk) => (
            <g key={tk}>
              <line className="ln" x1={px(tk)} x2={px(tk)} y1={146} y2={154} />
              <text className="s m" x={px(tk)} y={170} textAnchor="middle">{label(tk)}</text>
            </g>
          ))}

          {/* windows in state */}
          {WINDOWS.map((w, i) => {
            const inState = w.from <= step && w.emitted > step;
            const done = w.emitted <= step;
            return (
              <motion.g key={i} initial={false} animate={{ opacity: w.from <= step ? 1 : 0 }} transition={t}>
                <rect
                  className={done ? 'box' : 'box on'}
                  x={px(w.s)}
                  y={60}
                  width={px(w.e) - px(w.s) - 4}
                  height={52}
                  rx="6"
                  strokeDasharray={done ? '5 4' : undefined}
                />
                <text className="s b" x={px(w.s) + 8} y={80}>{label(w.s)} {T.to} {label(w.e)}</text>
                <text className="m s" x={px(w.s) + 8} y={100}>{done ? T.emitted(w.count) : inState ? T.inState(w.count) : ''}</text>
              </motion.g>
            );
          })}

          {/* events */}
          {EVENTS.map((e, i) => {
            const seen = e.batch <= step;
            return (
              <motion.g key={i} initial={false} animate={{ opacity: seen ? 1 : 0, y: seen ? 0 : -10 }} transition={t}>
                <circle cx={px(e.t)} cy={128} r="8" className={e.late ? 'k2' : 'k1'} />
                {e.late && step >= 6 && (
                  <>
                    <line x1={px(e.t) - 7} y1={121} x2={px(e.t) + 7} y2={135} stroke="var(--accent)" strokeWidth="2.5" />
                    <line x1={px(e.t) - 7} y1={135} x2={px(e.t) + 7} y2={121} stroke="var(--accent)" strokeWidth="2.5" />
                    <text className="s b acc" x={px(e.t) + 12} y={142}>{T.dropped}</text>
                  </>
                )}
              </motion.g>
            );
          })}

          {/* watermark */}
          <motion.g initial={false} animate={{ x: wm == null ? 0 : px(wm) }} transition={t}>
            <motion.line x1={0} x2={0} y1={50} y2={186} stroke="var(--accent)" strokeWidth="2.5" strokeDasharray="7 5" initial={false} animate={{ opacity: wm == null ? 0 : 1 }} transition={t} />
            <motion.text className="s b acc" x={4} y={196} initial={false} animate={{ opacity: wm == null ? 0 : 1 }} transition={t}>
              watermark {wm == null ? '' : label(wm)}
            </motion.text>
          </motion.g>
          <text className="s" x={X0} y={216}>{T.rule}</text>

          {/* output table */}
          <rect className="box" x="40" y="232" width="360" height="102" rx="8" />
          <text className="b" x="56" y="254">{T.sink}</text>
          {emittedRows.length === 0 && <text className="s" x="56" y="282">{T.nothing}</text>}
          {emittedRows.map((w, i) => (
            <text key={i} className="m s" x="56" y={278 + i * 20}>{label(w.s)} {T.to} {label(w.e)}   count = {w.count}</text>
          ))}
          <rect className="box" x="430" y="232" width="410" height="102" rx="8" />
          <text className="b" x="446" y="254">{T.checkpoint}</text>
          <text className="m s" x="446" y="278">offsets/0 {T.to} offsets/{step}   commits/0 {T.to} commits/{step}</text>
          <text className="m s" x="446" y="300">{T.stateWindows(WINDOWS.filter((w) => w.from <= step && w.emitted > step).length)}</text>
        </svg>
      </div>
      <StepControls steps={steps} step={step} playing={playing} go={go} toggle={toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
