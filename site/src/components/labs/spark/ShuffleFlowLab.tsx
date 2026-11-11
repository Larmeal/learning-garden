import { useMemo, useState, type ReactNode } from 'react';
import { ClockControls, mix, prog, smooth, useClock, type Lang, type Mark } from './timeline';

// groupBy("key").count() drawn as moving rows. Each map task holds 8 rows, the keys are A, B and C, and key k goes to
// reduce task k (hash partitioning). A map task writes ONE .data file that holds every reduce partition one after the
// other plus an .index file with the offsets, as measured by exercises/13_internals.py (8 maps -> 24 files = 8 x
// .data, .index, .checksum). The reduce side then fetches one segment (block) from every map task: maps x 3 blocks.

const KEYS = ['A', 'B', 'C'];
const ROWS = 8;
const DURATION = 12;

const MARKS_TH: Mark[] = [
  { at: 0, name: 'แถวตั้งต้น', title: 'แต่ละ Map Task ถือแถวของ Partition ตัวเอง', text: 'Key เดียวกันกระจายอยู่ในทุก Partition เช่น Key A ก็อยู่ในทุก Map Task ตอนนี้ยังไม่มีใครรู้ว่าแถวไหนต้องไปรวมกับแถวไหน' },
  { at: 1.5, name: 'แบ่งตาม Key', title: 'Map Task คำนวณว่าแถวนี้ต้องไป Reduce Task ไหน', text: 'Map Task จะใช้ Hash ของ Key (ในภาพ A ไป Task 1, B ไป Task 2, C ไป Task 3) แล้วจัดแถวเข้าช่องของ Reduce Task นั้นในหน่วยความจำของ Map Task เอง ตอนนี้ยังไม่มีอะไรข้ามไปยังคอมพิวเตอร์เครื่องอื่นเลย' },
  { at: 4.5, name: 'เขียนไฟล์', title: 'เขียนลง Disk เป็น .data ไฟล์เดียวต่อ Map Task', text: 'ทุกช่องจะต่อเรียงกันอยู่ในไฟล์เดียว (shuffle_0_m_0.data) พร้อม .index ที่จดไว้ว่าช่องของ Reduce Task แต่ละตัวเริ่มและจบตรงไหน Stage แรกจบลงตรงนี้ โดยผลลัพธ์อยู่บน Disk ของ Executor' },
  { at: 6, name: 'Fetch', title: 'Reduce Task ไปดึงเฉพาะช่องของตัวเองจากทุก Map Task', text: 'ตรงนี้คือ Shuffle ที่ข้อมูลข้ามจากคอมพิวเตอร์เครื่องหนึ่งไปอีกเครื่องผ่านเครือข่าย โดย Reduce Task แต่ละตัวจะส่ง Fetch ไปหา Map Task ทุกตัว (จำนวนช่องที่ดึง = Map Task x 3) และ Stage ที่สองจะเริ่มไม่ได้จนกว่า Stage แรกจะเขียนเสร็จทุกตัว' },
  { at: 9.2, name: 'รวมผล', title: 'แต่ละ Reduce Task เห็น Key ของตัวเองครบทุกแถวแล้ว', text: 'จึงนับเพื่อให้ได้ผลสุดท้ายได้เลย ถ้า Key หนึ่งมีแถวมากกว่าที่อื่นมาก Reduce Task ตัวนั้นก็จะหนักกว่าตัวอื่น (บทที่ 5 และ 7 เรื่อง Skew)' },
];

const MARKS_EN: Mark[] = [
  { at: 0, name: 'Starting rows', title: 'Each map task holds the rows of its own partition', text: 'The same key is spread over every partition. For example key A is in every map task. Right now nobody knows which rows must be combined with which rows.' },
  { at: 1.5, name: 'Split by key', title: 'A map task works out which reduce task each row must go to', text: 'It uses the hash of the key (in the picture A goes to task 1, B to task 2, C to task 3) and puts the row in the slot of that reduce task, in the memory of the map task itself. Nothing has crossed machines yet.' },
  { at: 4.5, name: 'Write file', title: 'Write to disk as one .data file per map task', text: 'All the slots are joined one after the other in a single file (shuffle_0_m_0.data), with an .index that records where the slot of each reduce task starts and ends. The first stage ends here. The result sits on the disk of the executor.' },
  { at: 6, name: 'fetch', title: 'Each reduce task fetches only its own slot from every map task', text: 'This is the shuffle: data crosses machines over the network. Each reduce task sends a fetch to every map task (number of slots fetched = map tasks x 3). The second stage cannot start until every task of the first stage has finished writing.' },
  { at: 9.2, name: 'Combine', title: 'Each reduce task now sees every row of its own key', text: 'So it can count and get the final result straight away. If one key has many more rows than the others, that reduce task is heavier than the rest (lessons 5 and 7 cover skew).' },
];
const MARKS: Record<Lang, Mark[]> = { th: MARKS_TH, en: MARKS_EN };

const TEXT: Record<Lang, {
  title: ReactNode; groupLabel: string; mapBtn: (n: number) => string; svgLabel: string; stage1: string; stage1Sub: string; stage2: string; stage2Sub: string;
  mapLine: (m: number) => string; inMemory: string; reduceLine: (k: number, key: string) => string;
  dotsHelp: string; files: (M: number, blocks: number) => string; result: string; caption: string;
}> = {
  th: {
    title: <>Shuffle ดูทีละแถว <code>df.groupBy("key").count()</code></>, groupLabel: 'จำนวน Map Task', mapBtn: (n) => `${n} Map Task`,
    svgLabel: 'ภาพเคลื่อนไหวของ Shuffle ที่แถวถูกจัดเข้าช่อง เขียนเป็นไฟล์ แล้วถูกดึงไปหา Reduce Task',
    stage1: 'Stage 1: Map Task', stage1Sub: 'อ่านแถวและจัดเข้าช่อง', stage2: 'Stage 2: Reduce Task', stage2Sub: 'รวมผลต่อ Key',
    mapLine: (m) => `map ${m}: partition ${m}`, inMemory: 'ช่องใน Memory', reduceLine: (k, key) => `reduce ${k} (key ${key})`,
    dotsHelp: 'ทุกจุดคือหนึ่งแถว สีและตัวอักษรคือ Key',
    files: (M, blocks) => `ไฟล์ที่ Map เขียน: ${M} x (.data, .index, .checksum) = ${M * 3} ไฟล์   ช่องที่ Reduce ต้องดึง: ${M} x 3 = ${blocks} ช่อง`,
    result: 'ผลลัพธ์: ',
    caption: 'แต่ละ Map Task ถือ 8 แถว (ของจริงมีเป็นล้าน) และตำแหน่งของแถวเป็นภาพประกอบ ส่วนรูปแบบไฟล์ (.data หนึ่งไฟล์ต่อ Map Task ที่ต่อทุก Reduce Partition พร้อม .index) และจำนวน 24 ไฟล์ของ 8 Map Task มาจากการรันใน exercises/13_internals.py',
  },
  en: {
    title: <>Shuffle row by row: <code>df.groupBy("key").count()</code></>, groupLabel: 'Number of map tasks', mapBtn: (n) => `${n} map tasks`,
    svgLabel: 'Animation of a shuffle: rows are put into slots, written to files, then fetched by the reduce tasks',
    stage1: 'Stage 1: map task', stage1Sub: 'Read rows, put into slots', stage2: 'Stage 2: reduce task', stage2Sub: 'Combine per key',
    mapLine: (m) => `map ${m}: partition ${m}`, inMemory: 'slots in memory', reduceLine: (k, key) => `reduce ${k} (key ${key})`,
    dotsHelp: 'Each dot is one row. The color and letter are the key.',
    files: (M, blocks) => `Files written by the maps: ${M} x (.data, .index, .checksum) = ${M * 3} files   Slots the reduces must fetch: ${M} x 3 = ${blocks} slots`,
    result: 'Result: ',
    caption: 'Each map task holds 8 rows (the real thing has millions). The positions of the rows are an illustration. The file layout (one .data file per map task that joins all the reduce partitions, with an .index) and the 24 files for 8 map tasks come from a run in exercises/13_internals.py.',
  },
};

interface Dot {
  id: number;
  m: number;
  key: number;
  p0: [number, number];
  p1: [number, number];
  p2: [number, number];
  order: number;
}

function layout(M: number): Dot[] {
  const top = 70;
  const slot = (320 - 8 * (M - 1)) / M;
  const dots: Dot[] = [];
  const perReduce = [0, 0, 0];
  const raw: { m: number; i: number; key: number }[] = [];
  for (let m = 0; m < M; m++) for (let i = 0; i < ROWS; i++) raw.push({ m, i, key: (i * 5 + m * 2 + Math.floor(i / 3)) % 3 });
  const inBucket: number[][] = Array.from({ length: M }, () => [0, 0, 0]);
  raw.forEach((r, id) => {
    const y0 = top + r.m * (slot + 8);
    const gx = 40 + (r.i % 4) * 19;
    const gy = y0 + slot / 2 - 9 + Math.floor(r.i / 4) * 20;
    const s = inBucket[r.m][r.key]++;
    const bx = 222 + r.key * 56;
    const by = y0 + 22;
    const p1: [number, number] = [bx + 12 + (s % 3) * 15, by + 14 + Math.floor(s / 3) * 15];
    const rs = perReduce[r.key]++;
    const p2: [number, number] = [676 + (rs % 8) * 20, top + 52 + r.key * 112 + Math.floor(rs / 8) * 20];
    dots.push({ id, m: r.m, key: r.key, p0: [gx, gy], p1, p2, order: id, });
  });
  return dots;
}

function bezier(a: [number, number], b: [number, number], x: number): [number, number] {
  const c1 = [a[0] + 150, a[1]];
  const c2 = [b[0] - 150, b[1]];
  const u = 1 - x;
  return [
    u ** 3 * a[0] + 3 * u * u * x * c1[0] + 3 * u * x * x * c2[0] + x ** 3 * b[0],
    u ** 3 * a[1] + 3 * u * u * x * c1[1] + 3 * u * x * x * c2[1] + x ** 3 * b[1],
  ];
}

export default function ShuffleFlowLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [M, setM] = useState(3);
  const clock = useClock(DURATION);
  const { t } = clock;
  const dots = useMemo(() => layout(M), [M]);
  const top = 70;
  const slot = (320 - 8 * (M - 1)) / M;
  const toBuckets = (d: Dot) => smooth(prog(t, 1.6 + d.order * 0.06, 3.4 + d.order * 0.06));
  const fetchP = (d: Dot) => smooth(prog(t, 6.2 + d.key * 0.5 + (d.order % 6) * 0.1, 8.6 + d.key * 0.5 + (d.order % 6) * 0.1));
  const filesOn = prog(t, 4.5, 5.2);
  const fetchOn = prog(t, 5.8, 6.3);
  const reduceOn = prog(t, 9.2, 10);
  const blocks = M * 3;
  const counts = [0, 1, 2].map((k) => dots.filter((d) => d.key === k).length);

  return (
    <figure className="viz lg">
      <div className="viz-title">{T.title}</div>
      <div className="viz-steps" role="group" aria-label={T.groupLabel}>
        {[2, 3, 4].map((n) => (
          <button key={n} type="button" aria-pressed={M === n} onClick={() => { setM(n); clock.restart(); }}>{T.mapBtn(n)}</button>
        ))}
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 430" role="img" aria-label={T.svgLabel}>
          <rect className="band" x="10" y="10" width="860" height="410" rx="12" />
          <text className="b" x="28" y="38">{T.stage1}</text>
          <text className="s" x="28" y="56">{T.stage1Sub}</text>
          <text className="b" x="676" y="38">{T.stage2}</text>
          <text className="s" x="676" y="56">{T.stage2Sub}</text>

          {/* map tasks */}
          {Array.from({ length: M }, (_, m) => {
            const y0 = top + m * (slot + 8);
            const fileOn = filesOn;
            return (
              <g key={m}>
                <rect className="box" x="26" y={y0} width="170" height={slot} rx="8" />
                <text className="s" x="34" y={y0 + 13}>{T.mapLine(m + 1)}</text>
                <rect className={fileOn > 0.5 ? 'fx-hot' : 'box'} x="212" y={y0 + 4} width="176" height={slot - 8} rx="8" opacity={fileOn > 0.5 ? 0.9 : 1} />
                <text className="s" x="218" y={y0 + 16}>{fileOn > 0.5 ? `shuffle_0_${m}_0.data` : T.inMemory}</text>
                {[0, 1, 2].map((k) => (
                  <g key={k}>
                    <rect className="box" x={222 + k * 56} y={y0 + 22} width="50" height={slot - 36} rx="4" strokeDasharray={fileOn > 0.5 ? undefined : '3 3'} />
                    <text className="s m" x={222 + k * 56 + 25} y={y0 + slot - 8} textAnchor="middle">{`→${k + 1}`}</text>
                  </g>
                ))}
                {fileOn > 0.5 && <text className="s m acc" x="394" y={y0 + slot / 2 + 4}>.index</text>}
              </g>
            );
          })}

          {/* fetch lines */}
          {Array.from({ length: M }, (_, m) =>
            [0, 1, 2].map((k) => {
              const y0 = top + m * (slot + 8) + slot / 2;
              const y1 = top + 52 + k * 112 - 18 + m * (36 / Math.max(1, M - 1));
              return (
                <path
                  key={`${m}-${k}`}
                  d={`M388 ${y0} C520 ${y0} 520 ${y1} 668 ${y1}`}
                  className={`path s${k + 1}`}
                  opacity={fetchOn * 0.4}
                  strokeDasharray="4 5"
                />
              );
            }),
          )}

          {/* reduce tasks */}
          {[0, 1, 2].map((k) => (
            <g key={k}>
              <rect className={reduceOn > 0.5 ? 'fx-hot' : 'box'} x="664" y={top + k * 112} width="194" height="100" rx="8" />
              <text className="s" x="672" y={top + k * 112 + 14}>{T.reduceLine(k + 1, KEYS[k])}</text>
              {reduceOn > 0 && (
                <g opacity={reduceOn}>
                  <text className="b num acc" x="672" y={top + k * 112 + 92} style={{ fontSize: 15 }}>{KEYS[k]} = {counts[k]}</text>
                </g>
              )}
            </g>
          ))}

          {/* the rows */}
          {dots.map((d) => {
            const a = toBuckets(d);
            const f = fetchP(d);
            let x = mix(d.p0[0], d.p1[0], a);
            let y = mix(d.p0[1], d.p1[1], a);
            if (f > 0) [x, y] = bezier(d.p1, d.p2, f);
            return (
              <g key={d.id} transform={`translate(${x} ${y})`}>
                <circle r="7.5" className={`k${d.key + 1}`} />
                <text className="dl" y="4">{KEYS[d.key]}</text>
              </g>
            );
          })}

          <text className="s" x="28" y="412">
            {t < 4.5
              ? T.dotsHelp
              : t < 9.2
                ? T.files(M, blocks)
                : T.result + counts.map((c, k) => `${KEYS[k]} = ${c}`).join('   ')}
          </text>
        </svg>
      </div>
      <ClockControls clock={clock} marks={MARKS[lang]} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
