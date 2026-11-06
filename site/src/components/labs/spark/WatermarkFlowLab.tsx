import { useMemo, useState } from 'react';
import { ClockControls, mix, prog, smooth, useClock, type Lang, type Mark } from './timeline';

// Watermark drawn as events that fall onto the event-time axis. The same four files as exercises/09_streaming.py
// (append mode, 5 minute windows): {12:00:01, 12:03:00}, {12:06:00}, {12:20:00} and a late {12:01:00}. With a 10 minute
// delay this was run on Spark 4.2.0 (batches 0 to 6, the late row is dropped, both windows leave at the third file).
// The 0 and 20 minute choices are computed with the same rules and were not run:
//   watermark = newest event time seen minus the delay (applied from the next batch on)
//   a window is written out (append mode) when watermark >= its end
//   a row is dropped when its window already ended at or before the watermark.

const TEXT: Record<Lang, {
  title: string;
  delayGroup: string;
  delayBtn: (d: number, real: boolean) => string;
  svgLabel: string;
  axisTitle: string;
  counted: (n: number) => string;
  dropped: string;
  lateTag: string;
  fileArrives: (k: number) => string;
  wmLabel: string;
  wmNote: (delay: number) => string;
  sinkTitle: string;
  nothingYet: string;
  windowRow: (s: string, e: string, count: number) => string;
  droppedCount: (n: number) => string;
  caption: string;
  startName: string;
  startTitle: (delay: number) => string;
  startText: string;
  f1Name: string;
  f1Title: string;
  f1Text: string;
  f2Name: string;
  f2Title: string;
  f2Text: string;
  f3Name: string;
  f3Title: string;
  f3Text20: string;
  f3TextOther: string;
  f4Name: string;
  f4TitleDropped: string;
  f4TitleKept: string;
  f4TextDropped: string;
  f4TextKept: (wm: string, count: number) => string;
  sumName: string;
  sumTitle: Record<number, string>;
  sumText: string;
}> = {
  th: {
    title: 'Watermark: event ตกลงบนแกนเวลา แล้ว Spark ตัดสินว่า window ไหนปิด',
    delayGroup: 'ค่า watermark delay',
    delayBtn: (d, real) => `delay ${d} นาที${real ? ' (รันจริง)' : ''}`,
    svgLabel: 'event ตกลงบนแกนเวลา เส้น watermark เลื่อนไป window ที่ปิดถูกส่งไป sink',
    axisTitle: 'ไฟล์ที่เข้ามาตามลำดับ (เวลาที่มาถึง) ตกลงบนแกนเวลาของ event',
    counted: (n) => `นับได้ ${n}`,
    dropped: 'ทิ้ง (เก่ากว่า watermark)',
    lateTag: 'ไฟล์ที่ 4 (มาช้า)',
    fileArrives: (k) => `ไฟล์ที่ ${k} เข้ามา`,
    wmLabel: 'watermark',
    wmNote: (delay) => `watermark = event ที่ใหม่สุดที่เคยเห็น ลบ ${delay} นาที (พื้นสีชมพูคือเขตที่ถือว่า "ช้าเกินไป")`,
    sinkTitle: 'ผลที่ sink ได้รับ (append mode)',
    nothingYet: 'ยังไม่มีอะไร',
    windowRow: (s, en, count) => `${s} ถึง ${en}   count = ${count}`,
    droppedCount: (n) => `แถวที่ถูกทิ้ง: ${n}`,
    caption: 'ที่ delay 10 นาทีคือ exercises/09_streaming.py (Spark 4.2.0) ที่ 0 และ 20 นาทีใช้กฎเดียวกันคำนวณในภาพ ยังไม่ได้รันกับ Spark เวลาที่ไฟล์มาถึงในภาพเป็นภาพประกอบ',
    startName: 'ตั้งต้น',
    startTitle: (delay) => `watermark delay = ${delay} นาที`,
    startText: 'จุดแต่ละจุดคือ event ที่ตกลงบนแกนเวลาของ event (ไม่ใช่เวลาที่มันมาถึง) เส้นประแดงคือ watermark: ทุกอย่างทางซ้ายของเส้นนี้ถือว่าเก่าเกินไปแล้ว',
    f1Name: 'ไฟล์ 1',
    f1Title: 'ไฟล์แรก: 12:00:01 และ 12:03:00 เข้า window 12:00 ถึง 12:05',
    f1Text: 'เปิด window ใน state นับได้ 2 watermark ใหม่ = event ที่ใหม่สุด (12:03) ลบ delay จะใช้ตั้งแต่ batch ถัดไป ในโหมด append ยังไม่ส่งอะไรออก เพราะอาจมี event มาเพิ่มได้',
    f2Name: 'ไฟล์ 2',
    f2Title: 'ไฟล์ที่สอง: 12:06:00 เข้า window 12:05 ถึง 12:10',
    f2Text: 'event ใหม่สุดขยับเป็น 12:06 เส้น watermark ขยับตามไปทางขวา',
    f3Name: 'ไฟล์ 3',
    f3Title: 'ไฟล์ที่สาม: 12:20:00 ดันเวลาไปไกล',
    f3Text20: 'watermark = 12:20 ลบ 20 = 12:00 ยังไม่ผ่านปลาย window ไหนเลย จึงยังไม่ส่งผลออกสักแถว',
    f3TextOther: 'เส้น watermark กระโดดไปข้างหน้า window ที่ปลายอยู่ซ้ายของเส้นถือว่าปิด ถูกเขียนลง sink และลบจาก state',
    f4Name: 'ไฟล์ 4 (มาช้า)',
    f4TitleDropped: 'ไฟล์สุดท้าย: 12:01:00 มาช้าเกินไป ถูกทิ้ง',
    f4TitleKept: 'ไฟล์สุดท้าย: 12:01:00 มาช้า แต่ยังทัน',
    f4TextDropped: 'window ของมันปิดไปแล้ว Spark ไม่เปิดกลับ ผลที่ส่งไปแล้วไม่เปลี่ยน (วัดจริงที่ delay 10 นาที: numRowsDroppedByWatermark อย่างน้อย 1)',
    f4TextKept: (wm, count) => `watermark ยังอยู่ที่ ${wm} window 12:00 ถึง 12:05 ยังเปิดอยู่ event จึงถูกนับเพิ่ม (เป็น ${count}) แต่ต้องรอนานกว่าจะได้ผล`,
    sumName: 'สรุป',
    sumTitle: { 0: 'delay 0: ผลออกเร็วที่สุด แต่ทิ้งข้อมูลที่มาช้าแม้นิดเดียว', 10: 'delay 10: ผลออกหลังเห็น event ที่เก่ากว่า 10 นาทีผ่านไป', 20: 'delay 20: รับข้อมูลที่มาช้าได้มาก แต่ผลออกช้า และ state ต้องเก็บ window ไว้นานขึ้น' },
    sumText: 'delay คือราคาที่จ่ายระหว่างความครบของข้อมูลกับความเร็วของผลลัพธ์ ที่ 10 นาทีรันจริงแล้ว ส่วน 0 และ 20 นาทีคำนวณด้วยกฎเดียวกัน',
  },
  en: {
    title: 'Watermark: events fall onto the time axis, and Spark decides which window is closed',
    delayGroup: 'Watermark delay',
    delayBtn: (d, real) => `delay ${d} min${real ? ' (real run)' : ''}`,
    svgLabel: 'Events fall onto the time axis, the watermark line moves, closed windows go to the sink',
    axisTitle: 'Files arrive in order (arrival time) and fall onto the event-time axis',
    counted: (n) => `count ${n}`,
    dropped: 'dropped (older than watermark)',
    lateTag: 'file 4 (late)',
    fileArrives: (k) => `File ${k} arrives`,
    wmLabel: 'watermark',
    wmNote: (delay) => `watermark = newest event time seen minus ${delay} min (the pink area is "too late")`,
    sinkTitle: 'What the sink receives (append mode)',
    nothingYet: 'Nothing yet',
    windowRow: (s, en, count) => `${s} to ${en}   count = ${count}`,
    droppedCount: (n) => `Rows dropped: ${n}`,
    caption: 'The 10 minute delay is exercises/09_streaming.py (Spark 4.2.0). The 0 and 20 minute delays are computed in the picture with the same rules and were not run on Spark. The arrival times of the files in the picture are only for illustration.',
    startName: 'start',
    startTitle: (delay) => `watermark delay = ${delay} min`,
    startText: 'Each dot is an event that falls onto the event-time axis (not the time it arrived). The dashed red line is the watermark: everything to the left of it is considered too old.',
    f1Name: 'file 1',
    f1Title: 'First file: 12:00:01 and 12:03:00 go into window 12:00 to 12:05',
    f1Text: 'The window opens in the state and counts 2. The new watermark = newest event time (12:03) minus the delay, and it applies from the next batch. In append mode nothing is written out yet, because more events may still come.',
    f2Name: 'file 2',
    f2Title: 'Second file: 12:06:00 goes into window 12:05 to 12:10',
    f2Text: 'The newest event time moves to 12:06. The watermark line moves to the right with it.',
    f3Name: 'file 3',
    f3Title: 'Third file: 12:20:00 pushes time far ahead',
    f3Text20: 'watermark = 12:20 minus 20 = 12:00. It has not passed the end of any window, so not one row is written out yet.',
    f3TextOther: 'The watermark line jumps ahead. A window whose end is left of the line is closed: it is written to the sink and removed from the state.',
    f4Name: 'file 4 (late)',
    f4TitleDropped: 'Last file: 12:01:00 is too late and is dropped',
    f4TitleKept: 'Last file: 12:01:00 is late, but still in time',
    f4TextDropped: 'Its window is already closed. Spark does not reopen it, and results already sent do not change (measured at delay 10 min: numRowsDroppedByWatermark is at least 1).',
    f4TextKept: (wm, count) => `The watermark is still at ${wm}. Window 12:00 to 12:05 is still open, so the event is counted (the count becomes ${count}), but the result takes longer to come out.`,
    sumName: 'summary',
    sumTitle: { 0: 'delay 0: results come out fastest, but even slightly late data is dropped', 10: 'delay 10: a result comes out after an event more than 10 minutes newer has been seen', 20: 'delay 20: accepts much late data, but results come out late and the state keeps windows longer' },
    sumText: 'The delay is the price you pay between completeness of the data and speed of the result. The 10 minute case was run. The 0 and 20 minute cases are computed with the same rules.',
  },
};

const T0 = 11 * 60 + 50;
const SPAN = 40;
const X0 = 50;
const W = 790;
const px = (min: number) => X0 + ((min - T0) / SPAN) * W;
const clockLabel = (min: number) => `${Math.floor(min / 60)}:${String(Math.floor(min) % 60).padStart(2, '0')}`;
const DURATION = 13;
const FILE_AT = [1, 3.6, 6.2, 8.8];
const FILES: { t: number; late?: boolean }[][] = [
  [{ t: 720 + 1 / 60 }, { t: 723 }],
  [{ t: 726 }],
  [{ t: 740 }],
  [{ t: 721, late: true }],
];

interface Win { s: number; e: number; count: number; opened: number; emitted: number | null }
interface Sim {
  events: { t: number; file: number; dropped: boolean; late?: boolean; win: number }[];
  wins: Win[];
  wm: { at: number; v: number }[];
  dropped: number;
}

function simulate(delay: number): Sim {
  const events: Sim['events'] = [];
  const wins: Win[] = [];
  const wm: Sim['wm'] = [];
  let newest = -Infinity;
  let wmNow = -Infinity;
  let dropped = 0;
  FILES.forEach((rows, file) => {
    const arrive = FILE_AT[file];
    rows.forEach((r) => {
      const s = Math.floor(r.t / 5) * 5;
      const e = s + 5;
      let wi = wins.findIndex((w) => w.s === s);
      if (e <= wmNow) {
        dropped++;
        events.push({ t: r.t, file, dropped: true, late: r.late, win: -1 });
        return;
      }
      if (wi < 0) {
        wins.push({ s, e, count: 0, opened: arrive, emitted: null });
        wi = wins.length - 1;
      }
      wins[wi].count++;
      events.push({ t: r.t, file, dropped: false, late: r.late, win: wi });
      newest = Math.max(newest, r.t);
    });
    // after the batch: new watermark for the next batch, and windows that it closes leave at once
    const next = newest - delay;
    if (next > wmNow) {
      wmNow = next;
      wm.push({ at: arrive + 1.1, v: wmNow });
      wins.forEach((w) => {
        if (w.emitted == null && w.e <= wmNow) w.emitted = arrive + 2.1;
      });
    }
  });
  return { events, wins, wm, dropped };
}

const DELAYS = [0, 10, 20];

export default function WatermarkFlowLab({ lang = 'th' }: { lang?: Lang }) {
  const L = TEXT[lang];
  const [delay, setDelay] = useState(10);
  const clock = useClock(DURATION);
  const { t } = clock;
  const sim = useMemo(() => simulate(delay), [delay]);

  let wmVal: number | null = null;
  let wmFrom: number | null = null;
  let wmProg = 1;
  sim.wm.forEach((w) => {
    if (t >= w.at) {
      wmFrom = wmVal;
      wmVal = w.v;
      wmProg = smooth(prog(t, w.at, w.at + 0.8));
    }
  });
  const wmX = wmVal == null ? null : px(wmFrom == null ? (wmVal as number) : mix(wmFrom as number, wmVal as number, wmProg));

  const late = sim.events.find((e) => e.late)!;
  const emitted = sim.wins.filter((w) => w.emitted != null && t >= (w.emitted as number) + 0.6);

  const marks: Mark[] = [
    { at: 0, name: L.startName, title: L.startTitle(delay), text: L.startText },
    { at: FILE_AT[0], name: L.f1Name, title: L.f1Title, text: L.f1Text },
    { at: FILE_AT[1], name: L.f2Name, title: L.f2Title, text: L.f2Text },
    { at: FILE_AT[2], name: L.f3Name, title: L.f3Title, text: delay === 20 ? L.f3Text20 : L.f3TextOther },
    {
      at: FILE_AT[3],
      name: L.f4Name,
      title: late.dropped ? L.f4TitleDropped : L.f4TitleKept,
      text: late.dropped ? L.f4TextDropped : L.f4TextKept(clockLabel(sim.wm[sim.wm.length - 1].v), sim.wins[0].count),
    },
    { at: 11.4, name: L.sumName, title: L.sumTitle[delay], text: L.sumText },
  ];

  const sinkY = 292;

  return (
    <figure className="viz lg">
      <div className="viz-title">{L.title}</div>
      <div className="viz-steps" role="group" aria-label={L.delayGroup}>
        {DELAYS.map((d) => (
          <button key={d} type="button" aria-pressed={delay === d} onClick={() => { setDelay(d); clock.restart(); }}>
            {L.delayBtn(d, d === 10)}
          </button>
        ))}
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 420" role="img" aria-label={L.svgLabel}>
          <rect className="band" x="10" y="10" width="860" height="400" rx="12" />
          <text className="b" x="28" y="34">{L.axisTitle}</text>

          {/* too-late zone */}
          {wmX != null && <rect x={X0} y="50" width={Math.max(0, wmX - X0)} height="184" fill="var(--wrong-soft)" opacity="0.8" />}

          {/* axis */}
          <line className="ln" x1={X0} x2={X0 + W} y1={170} y2={170} />
          {[0, 10, 20, 30, 40].map((m) => (
            <g key={m}>
              <line className="ln" x1={px(T0 + m)} x2={px(T0 + m)} y1={166} y2={174} />
              <text className="s m" x={px(T0 + m)} y={188} textAnchor="middle">{clockLabel(T0 + m)}</text>
            </g>
          ))}
          {[0, 5, 10, 15, 20, 25].map((m) => (
            <line key={m} x1={px(720 + m)} x2={px(720 + m)} y1={150} y2={170} stroke="var(--line)" />
          ))}

          {/* windows */}
          {sim.wins.map((w, i) => {
            if (t < w.opened + 0.8) return null;
            const leaving = w.emitted != null ? smooth(prog(t, w.emitted, w.emitted + 0.6)) : 0;
            const y = mix(198, sinkY - 8, leaving);
            return (
              <g key={i} opacity={1 - leaving} transform={`translate(0 ${y - 198})`}>
                <rect className={leaving > 0 ? 'box' : 'fx-hot'} x={px(w.s)} y={198} width={px(w.e) - px(w.s) - 3} height="40" rx="6" />
                <text className="s b m" x={px(w.s) + 6} y={214} style={{ fontSize: 11.5 }}>{clockLabel(w.s)}-{clockLabel(w.e)}</text>
                <text className="s m" x={px(w.s) + 6} y={230}>{L.counted(sim.events.filter((e) => e.win === i && t >= FILE_AT[e.file] + 0.8).length)}</text>
              </g>
            );
          })}

          {/* events */}
          {sim.events.map((e, i) => {
            const start = FILE_AT[e.file] + (i % 2) * 0.12;
            if (t < start) return null;
            const f = smooth(prog(t, start, start + 0.8));
            const y = mix(52, 150, f);
            const bad = e.dropped && f >= 1;
            return (
              <g key={i} transform={`translate(${px(e.t)} ${y})`}>
                <circle r="8.5" className={e.late ? 'k2' : 'k1'} />
                {bad && (
                  <>
                    <line x1="-6" y1="-6" x2="6" y2="6" stroke="var(--accent)" strokeWidth="2.5" />
                    <line x1="-6" y1="6" x2="6" y2="-6" stroke="var(--accent)" strokeWidth="2.5" />
                    <text className="s b acc" x="12" y="-10">{L.dropped}</text>
                  </>
                )}
                {e.late && !bad && f > 0.2 && <text className="s b" x="12" y="-10">{L.lateTag}</text>}
              </g>
            );
          })}

          {/* file arrival banner */}
          {FILE_AT.map((a, k) => {
            const on = t >= a && t < a + 1.6;
            return on ? <text key={k} className="b acc" x={X0+ W} y="34" textAnchor="end">{L.fileArrives(k + 1)}</text> : null;
          })}

          {/* watermark line */}
          {wmX != null && (
            <g>
              <line x1={wmX} x2={wmX} y1={46} y2={238} stroke="var(--accent)" strokeWidth="3" strokeDasharray="8 5" />
              <text className="s b acc m" x={wmX} y={252} textAnchor="middle">{L.wmLabel} {clockLabel(wmVal as number)}</text>
            </g>
          )}
          <text className="s" x={X0} y={268}>{L.wmNote(delay)}</text>

          {/* sink */}
          <rect className="box" x="40" y={sinkY} width="800" height="104" rx="8" />
          <text className="b" x="56" y={sinkY + 22}>{L.sinkTitle}</text>
          {emitted.length === 0 && <text className="s" x="56" y={sinkY + 48}>{L.nothingYet}</text>}
          {emitted.map((w, i) => (
            <text key={i} className="m s" x="56" y={sinkY + 46 + i * 18}>{L.windowRow(clockLabel(w.s), clockLabel(w.e), w.count)}</text>
          ))}
          <text className="s m" x="830" y={sinkY + 22} textAnchor="end">
            {L.droppedCount(sim.events.filter((e) => e.dropped && t >= FILE_AT[e.file] + 0.8).length)}
          </text>
        </svg>
      </div>
      <ClockControls clock={clock} marks={marks} lang={lang} />
      <figcaption className="viz-caption">{L.caption}</figcaption>
    </figure>
  );
}
