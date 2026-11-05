import { motion, useReducedMotion } from 'motion/react';
import { StepControls, useStepper, type StepInfo } from './stepper';

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

const STEPS: StepInfo[] = [
  { name: 'batch 0', title: 'batch 0: ไฟล์แรก (12:00:01 และ 12:03:00)', text: 'สอง event เข้า window 12:00 ถึง 12:05 นับได้ 2 ตอนนี้ยังไม่มี watermark (เริ่มจากศูนย์) พออ่านจบ Spark คำนวณ watermark ใหม่ = เวลา event ที่ใหม่สุด (12:03) ลบ 10 นาที = 11:53 เพื่อใช้ใน batch ถัดไป' },
  { name: 'batch 1', title: 'batch 1: ไม่มีข้อมูลใหม่ แต่ยังรัน', text: 'watermark เปลี่ยนจาก 0 เป็น 11:53 Spark เลยรัน batch ที่ numInputRows = 0 เพื่อนำค่าไปใช้ (spark.sql.streaming.noDataMicroBatches.enabled เป็น true) ยังไม่มี window ไหนจบก่อน 11:53 จึงไม่ส่งอะไรออก' },
  { name: 'batch 2', title: 'batch 2: ไฟล์ที่สอง (12:06:00)', text: 'event เข้า window 12:05 ถึง 12:10 ตอนนี้ state มีสอง window ในโหมด append ผลของ window ยังไม่ถูกเขียนออก เพราะอาจมี event ที่มาช้าเข้ามาเพิ่มได้ watermark ถัดไป = 12:06 ลบ 10 = 11:56' },
  { name: 'batch 3', title: 'batch 3: รันเพื่อนำ watermark 11:56 ไปใช้', text: 'ยังไม่มี window ที่ปลายช่วงเกิน 11:56 จึงยังไม่ส่งอะไรออก (วัดจริง: ผลลัพธ์ของ memory sink ยังว่างหลังไฟล์ที่ 1 และ 2)' },
  { name: 'batch 4', title: 'batch 4: ไฟล์ที่สาม (12:20:00)', text: 'event ที่ใหม่มากเข้ามา สร้าง window 12:20 ถึง 12:25 และเลื่อนเวลา event ที่ใหม่สุดเป็น 12:20 watermark ถัดไป = 12:20 ลบ 10 = 12:10' },
  { name: 'batch 5', title: 'batch 5: watermark 12:10 ปิด window และส่งผลออก', text: 'window ที่ปลายช่วงไม่เกิน 12:10 ถือว่าจบ: 12:00 ถึง 12:05 (2) และ 12:05 ถึง 12:10 (1) ถูกเขียนลง sink และลบออกจาก state (วัดจริง: numRowsRemoved = 2) นี่คือครั้งแรกที่ append mode ปล่อยผลออกมา' },
  { name: 'batch 6', title: 'batch 6: event ที่มาช้า (12:01:00) ถูกทิ้ง', text: 'event นี้เก่ากว่า watermark 12:10 Spark ไม่เปิด window เก่ากลับมา จึงทิ้งทันที (วัดจริง: numRowsDroppedByWatermark อย่างน้อย 1) ผลที่ส่งไปแล้วไม่เปลี่ยน' },
];

export default function WatermarkLab() {
  const { step, go, playing, toggle } = useStepper(STEPS.length, 4200);
  const reduce = useReducedMotion();
  const t = reduce ? { duration: 0 } : { duration: 0.7, ease: 'easeInOut' as const };
  const wm = WM[step];
  const ticks = [11 * 60 + 50, 12 * 60, 12 * 60 + 10, 12 * 60 + 20, 12 * 60 + 30];
  const emittedRows = WINDOWS.filter((w) => w.emitted <= step);
  return (
    <figure className="viz">
      <div className="viz-title">Watermark: Spark รู้ได้อย่างไรว่า window ไหนปิดแล้ว</div>
      <div className="viz-box">
        <svg viewBox="0 0 880 360" role="img" aria-label={`ขั้นที่ ${step + 1}: ${STEPS[step].title}`}>
          <rect className="band" x="10" y="10" width="860" height="340" rx="12" />
          <text className="b" x="28" y="36">เวลาของ event (event time)</text>

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
                <text className="s b" x={px(w.s) + 8} y={80}>{label(w.s)} ถึง {label(w.e)}</text>
                <text className="m s" x={px(w.s) + 8} y={100}>{done ? `ส่งออกแล้ว (${w.count})` : inState ? `ใน state: ${w.count}` : ''}</text>
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
                    <text className="s b acc" x={px(e.t) + 12} y={142}>ทิ้ง (ช้าเกิน)</text>
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
          <text className="s" x={X0} y={216}>watermark = event time ที่ใหม่สุดที่เคยเห็น ลบ 10 นาที (ใช้ใน batch ถัดไป)</text>

          {/* output table */}
          <rect className="box" x="40" y="232" width="360" height="102" rx="8" />
          <text className="b" x="56" y="254">ผลที่ sink ได้รับ (append)</text>
          {emittedRows.length === 0 && <text className="s" x="56" y="282">ยังไม่มีอะไร</text>}
          {emittedRows.map((w, i) => (
            <text key={i} className="m s" x="56" y={278 + i * 20}>{label(w.s)} ถึง {label(w.e)}   count = {w.count}</text>
          ))}
          <rect className="box" x="430" y="232" width="410" height="102" rx="8" />
          <text className="b" x="446" y="254">checkpoint ตอนนี้</text>
          <text className="m s" x="446" y="278">offsets/0 ถึง offsets/{step}   commits/0 ถึง commits/{step}</text>
          <text className="m s" x="446" y="300">state: {WINDOWS.filter((w) => w.from <= step && w.emitted > step).length} window</text>
        </svg>
      </div>
      <StepControls steps={STEPS} step={step} playing={playing} go={go} toggle={toggle} />
      <figcaption className="viz-caption">ทุก batch และเลข watermark มาจาก recentProgress ของการรันจริงใน exercises/09_streaming.py ขนาด window 5 นาที watermark 10 นาที โหมด append</figcaption>
    </figure>
  );
}
