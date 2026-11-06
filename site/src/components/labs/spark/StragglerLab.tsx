import { useMemo, useState } from 'react';
import { ClockControls, prog, useClock, type Lang, type Mark } from './timeline';

// Why one big partition makes the whole stage slow. 8 tasks run on 4 cores; a task takes 1 second per 100,000 rows
// (a scale for the picture, not a measured speed). Row counts per partition:
//   skewed and salted: measured by exercises/07_performance_tuning.py (2,000,000 rows, 90% with k = 1,
//   repartition(8, "k") versus repartition(8, "k", "salt") with 64 salts);
//   even: 8 x 250,000 rows, drawn for comparison.

const CORES = 4;
const SCALE = 100000;
const DURATION = 20;

type Scenario = 'even' | 'skew' | 'salt';
const ROWS: Record<Scenario, number[]> = {
  even: [250000, 250000, 250000, 250000, 250000, 250000, 250000, 250000],
  skew: [22936, 29112, 25328, 28713, 22726, 1821935, 22334, 26916],
  salt: [305609, 194015, 193281, 194019, 221389, 306847, 362896, 221944],
};

const TEXT: Record<Lang, {
  labels: Record<Scenario, string>; title: string; groupLabel: string; svgLabel: (label: string) => string; head: string; sub: string; axis: string;
  core: (n: number) => string; end: (wall: string, util: number) => string; caption: string;
  start: { name: string; title: string; text: string };
  idle: { name: string; skewTitle: string; otherTitle: string; skewText: string; otherText: string };
  done: { name: string; title: (wall: string) => string; text: (util: number, sc: Scenario) => string };
}> = {
  th: {
    labels: { even: 'กระจายเท่ากัน', skew: 'key skew (วัดจริง)', salt: 'หลังเติม salt (วัดจริง)' },
    title: 'ทำไม partition เดียวที่ใหญ่เกินไปทำให้ทั้ง stage ช้า', groupLabel: 'ลักษณะของข้อมูล',
    svgLabel: (label) => `แกนเวลาของ 8 task บน 4 core: ${label}`, head: 'core ทั้ง 4 ตัวกับ task ของ stage เดียว',
    sub: 'ความกว้างของแท่ง = จำนวนแถวใน partition นั้น (1 หน่วยเวลา = 100,000 แถว)', axis: 'เวลา (หน่วยเทียบกับจำนวนแถว ไม่ใช่วินาทีจริง)',
    core: (n) => `core ${n}`, end: (wall, util) => `stage จบที่ ${wall} · ใช้ core จริง ${util}%`,
    caption: 'จำนวนแถวต่อ partition ของแบบ skew และแบบ salt วัดจริงจาก exercises/07_performance_tuning.py ส่วนเวลาในภาพคิดจากจำนวนแถวโดยสมมติว่าทุกแถวใช้เวลาเท่ากัน จึงบอกสัดส่วนไม่ได้บอกวินาทีจริง',
    start: { name: 'แจกงาน', title: '8 task เข้าคิว 4 core', text: 'task ที่ใช้เวลาเท่ากับจำนวนแถวใน partition ของมัน core ที่ว่างก่อนจะหยิบ task ถัดไปในคิว' },
    idle: {
      name: 'core แรกว่าง',
      skewTitle: 'core ส่วนใหญ่ทำงานเสร็จแล้ว แต่ stage ยังไม่จบ', otherTitle: 'มี core แรกที่ไม่มีงานเหลือ',
      skewText: 'ลายขีดคือเวลาที่ core นั่งรอ stage ถัดไปเริ่มไม่ได้จนกว่า task สุดท้ายจะเสร็จ ใน partition ที่ 6 มี 1,821,935 แถว ส่วนที่เหลือมีไม่เกิน 29,112',
      otherText: 'task สุดท้ายที่ยังรันอยู่กำหนดเวลาจบของทั้ง stage ลายขีดคือเวลาที่ core ว่างระหว่างรอ',
    },
    done: {
      name: 'stage จบ',
      title: (wall) => `stage จบเมื่อ task ที่ช้าที่สุดจบ: ${wall} หน่วยเวลา`,
      text: (util, sc) => `core ถูกใช้งานจริง ${util}% ของเวลาที่จองไว้ ${sc === 'skew' ? 'เพิ่ม core ก็ไม่ช่วย เพราะ task ใหญ่ยังเป็น task เดียว วิธีแก้คือทำให้ partition เล็กลง (เช่น salt หรือให้ AQE แบ่ง partition ที่ skew ในการ join)' : sc === 'salt' ? 'แถวของ key ใหญ่ถูกกระจายไปหลาย partition ตัวที่ใหญ่สุดเหลือ 362,896 แถว (จาก 1,821,935)' : 'ทุก task ขนาดใกล้กัน core จึงว่างพร้อมกัน นี่คือสภาพที่ต้องการ'}`,
    },
  },
  en: {
    labels: { even: 'Evenly spread', skew: 'Key skew (measured)', salt: 'After adding salt (measured)' },
    title: 'Why one partition that is too big makes the whole stage slow', groupLabel: 'Shape of the data',
    svgLabel: (label) => `Timeline of 8 tasks on 4 cores: ${label}`, head: 'The 4 cores and the tasks of a single stage',
    sub: 'Bar width = number of rows in that partition (1 time unit = 100,000 rows)', axis: 'Time (units tied to the row count, not real seconds)',
    core: (n) => `core ${n}`, end: (wall, util) => `stage ends at ${wall} · cores really used ${util}%`,
    caption: 'The row counts per partition for the skew and salt cases were measured in exercises/07_performance_tuning.py. The times in the picture are computed from the row counts and assume that every row takes the same time, so they show proportions, not real seconds.',
    start: { name: 'Hand out', title: '8 tasks join the queue for 4 cores', text: 'A task takes as long as the number of rows in its partition. The core that frees up first takes the next task in the queue.' },
    idle: {
      name: 'First idle core',
      skewTitle: 'Most cores have finished, but the stage has not', otherTitle: 'The first core has no work left',
      skewText: 'The stripes show the time that a core sits and waits. The next stage cannot start until the last task finishes. Partition 6 has 1,821,935 rows, and all the others have at most 29,112.',
      otherText: 'The last task that is still running decides when the whole stage ends. The stripes show the time that a core is idle while it waits.',
    },
    done: {
      name: 'Stage ends',
      title: (wall) => `The stage ends when the slowest task ends: ${wall} time units`,
      text: (util, sc) => `The cores were really used ${util}% of the time reserved. ${sc === 'skew' ? 'Adding cores does not help, because the big task is still a single task. The fix is to make the partitions smaller (for example salt, or let AQE split the skewed partition in a join).' : sc === 'salt' ? 'The rows of the big key are spread over many partitions. The biggest one is down to 362,896 rows (from 1,821,935).' : 'All tasks have a similar size, so the cores become idle at the same time. This is the state we want.'}`,
    },
  },
};

interface Bar {
  task: number;
  core: number;
  start: number;
  end: number;
  rows: number;
}

// Each task goes to the core that frees up first, in partition order (what a task scheduler does with a queue).
function schedule(rows: number[]): { bars: Bar[]; free: number[]; wall: number } {
  const free = Array(CORES).fill(0);
  const bars = rows.map((r, task) => {
    let core = 0;
    for (let c = 1; c < CORES; c++) if (free[c] < free[core]) core = c;
    const start = free[core];
    const end = start + r / SCALE;
    free[core] = end;
    return { task, core, start, end, rows: r };
  });
  return { bars, free: [...free], wall: Math.max(...free) };
}

const X0 = 96;
const W = 740;
const px = (s: number) => X0 + (s / DURATION) * W;
const fmt = (n: number) => n.toLocaleString('en-US');

export default function StragglerLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [sc, setSc] = useState<Scenario>('skew');
  const clock = useClock(DURATION);
  const { t } = clock;
  const sim = useMemo(() => schedule(ROWS[sc]), [sc]);
  const work = ROWS[sc].reduce((a, b) => a + b, 0) / SCALE;
  const util = work / (CORES * sim.wall);
  const firstIdle = Math.min(...sim.free);

  const wallS = sim.wall.toFixed(1);
  const utilP = Math.round(util * 100);
  const marks: Mark[] = [
    { at: 0, ...T.start },
    {
      at: firstIdle,
      name: T.idle.name,
      title: sc === 'skew' ? T.idle.skewTitle : T.idle.otherTitle,
      text: sc === 'skew' ? T.idle.skewText : T.idle.otherText,
    },
    {
      at: sim.wall,
      name: T.done.name,
      title: T.done.title(wallS),
      text: T.done.text(utilP, sc),
    },
  ];
  // The second and third mark can be the same time (even data): keep the list strictly increasing.
  const shown = marks.filter((m, i) => i === 0 || m.at > marks[i - 1].at + 0.05);

  const laneY = (c: number) => 96 + c * 58;
  const running = Math.min(t, sim.wall);

  return (
    <figure className="viz lg">
      <div className="viz-title">{T.title}</div>
      <div className="viz-steps" role="group" aria-label={T.groupLabel}>
        {(Object.keys(ROWS) as Scenario[]).map((s) => (
          <button key={s} type="button" aria-pressed={sc === s} onClick={() => { setSc(s); clock.restart(); }}>{T.labels[s]}</button>
        ))}
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 400" role="img" aria-label={T.svgLabel(T.labels[sc])}>
          <defs>
            <pattern id="strag-idle" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="8" stroke="var(--line-strong)" strokeWidth="2" />
            </pattern>
          </defs>
          <rect className="band" x="10" y="10" width="860" height="380" rx="12" />
          <text className="b" x="28" y="38">{T.head}</text>
          <text className="s" x="28" y="56">{T.sub}</text>

          {/* time axis */}
          {[0, 5, 10, 15, 20].map((s) => (
            <g key={s}>
              <line className="ln" x1={px(s)} x2={px(s)} y1={80} y2={322} opacity="0.35" />
              <text className="s m" x={px(s)} y={340} textAnchor="middle">{s}</text>
            </g>
          ))}
          <text className="s" x={X0 + W / 2} y={358} textAnchor="middle">{T.axis}</text>

          {Array.from({ length: CORES }, (_, c) => {
            const done = t >= sim.free[c];
            return (
              <g key={c}>
                <text className="s b" x="28" y={laneY(c) + 26}>{T.core(c + 1)}</text>
                <rect x={X0} y={laneY(c)} width={W} height="44" rx="6" fill="none" stroke="var(--line)" strokeWidth="1" />
                {done && sim.free[c] < sim.wall && (
                  <rect x={px(sim.free[c])} y={laneY(c)} width={Math.max(0, px(Math.min(t, sim.wall)) - px(sim.free[c]))} height="44" rx="4" fill="url(#strag-idle)" opacity="0.8" />
                )}
              </g>
            );
          })}

          {sim.bars.map((b) => {
            if (t < b.start) return null;
            const p = prog(t, b.start, b.end);
            const big = b.rows >= 1000000;
            const x = px(b.start);
            const w = px(b.end) - px(b.start);
            return (
              <g key={b.task}>
                <rect x={x} y={laneY(b.core) + 2} width={w} height="40" rx="5" className="box" stroke={big ? 'var(--accent)' : undefined} strokeWidth={big ? 2.5 : undefined} />
                <rect x={x} y={laneY(b.core) + 2} width={w * p} height="40" rx="5" className={big ? 'fx-hot' : 'k1'} opacity={big ? 1 : 0.85} />
                {w > 34 && (
                  <text className="b m" x={x + w / 2} y={laneY(b.core) + 20} textAnchor="middle" style={{ fontSize: 12, fill: big ? 'var(--fg)' : 'var(--on-key)' }}>p{b.task + 1}</text>
                )}
                {w > 70 && (
                  <text className="m" x={x + w / 2} y={laneY(b.core) + 35} textAnchor="middle" style={{ fontSize: 11, fill: big ? 'var(--fg)' : 'var(--on-key)' }}>{fmt(b.rows)}</text>
                )}
              </g>
            );
          })}

          {/* clock needle */}
          <line x1={px(Math.min(t, DURATION))} x2={px(Math.min(t, DURATION))} y1={80} y2={326} stroke="var(--accent)" strokeWidth="2" />
          <text className="s b acc m" x={px(Math.min(t, DURATION))} y={77} textAnchor="middle">{running.toFixed(1)}</text>

          {t >= sim.wall && (
            <g>
              <line x1={px(sim.wall)} x2={px(sim.wall)} y1={74} y2={326} stroke="var(--fg)" strokeWidth="2.5" strokeDasharray="6 4" />
              <text className="b m" x={px(sim.wall) + (sim.wall > 15 ? -8 : 8)} y={382} textAnchor={sim.wall > 15 ? 'end' : 'start'}>
                {T.end(wallS, utilP)}
              </text>
            </g>
          )}
        </svg>
      </div>
      <ClockControls clock={clock} marks={shown} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
