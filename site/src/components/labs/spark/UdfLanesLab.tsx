import { ClockControls, mix, prog, smooth, useClock, type Lang, type Mark } from './timeline';

// Three ways to apply a function to the same 24 rows, side by side. A batch of 8 rows keeps the picture small (real
// defaults: 100 rows per pickle batch, 10,000 per Arrow batch). What the picture counts comes from the source and from
// exercises/08_udf.py: a built-in function runs inside the JVM; an Arrow-optimized Python UDF sends Arrow batches to the
// Python worker but the worker calls your function once per row; a pandas_udf calls it once per batch. Times in the
// picture are drawn in proportion to the number of calls, they are not measured seconds.

const ROWS = 24;
const BATCH = 8;
const NB = ROWS / BATCH;
const DURATION = 11;
const LANE_H = 116;
const TOP = 52;
const CALL = 0.19; // seconds the picture spends on one function call
const HOP = 0.8; // seconds to cross the socket

type Lane = 'builtin' | 'udf' | 'pandas';
const LANES: Record<Lang, { id: Lane; title: string; sub: string }[]> = {
  th: [
    { id: 'builtin', title: 'ฟังก์ชันของ Spark (upper, +, ...)', sub: 'รันใน JVM ด้วย Code ที่ Generate ไว้' },
    { id: 'udf', title: '@udf (Python UDF แบบ Arrow, ค่าเริ่มต้นของ 4.2)', sub: 'ส่งเป็น Batch แต่เรียกฟังก์ชันทีละแถว' },
    { id: 'pandas', title: '@pandas_udf', sub: 'ส่งเป็น Batch และเรียกฟังก์ชันครั้งเดียวต่อ Batch' },
  ],
  en: [
    { id: 'builtin', title: 'Spark function (upper, +, ...)', sub: 'runs in the JVM as generated code' },
    { id: 'udf', title: '@udf (Arrow Python UDF, default in 4.2)', sub: 'sent as a batch, function called per row' },
    { id: 'pandas', title: '@pandas_udf', sub: 'sent as a batch, function called once per batch' },
  ],
};

const sendAt = (lane: Lane, b: number) => 0.8 + b * (lane === 'pandas' ? 1.6 : BATCH * CALL + 1.2);
const procAt = (lane: Lane, b: number) => sendAt(lane, b) + HOP;
const procLen = (lane: Lane) => (lane === 'udf' ? BATCH * CALL : 0.25);
const backAt = (lane: Lane, b: number) => procAt(lane, b) + procLen(lane) + 0.1;
const endAt = (lane: Lane) => backAt(lane, NB - 1) + HOP;

const jvmPos = (b: number, i: number, y0: number): [number, number] => [34 + b * 104 + (i % 4) * 22, y0 + 52 + Math.floor(i / 4) * 24];
const pyPos = (i: number, y0: number): [number, number] => [606 + (i % 4) * 24, y0 + 52 + Math.floor(i / 4) * 24];

const MARKS: Record<Lang, Mark[]> = {
  th: [
    { at: 0, name: 'ตั้งต้น', title: '24 แถวเท่ากัน ใช้ฟังก์ชันเดียวกัน แต่เดินทางไม่เหมือนกัน', text: 'เส้นประกลางภาพคือขอบระหว่าง JVM ของ Executor กับ Python Worker ซึ่งเป็น Process แยกกัน และทุกครั้งที่แถวต้องข้ามเส้นนี้จะมีต้นทุน ทั้งการแปลงรูปแบบข้อมูล การส่งผ่าน Socket และการแปลงกลับ' },
    { at: 1, name: 'ข้าม socket', title: 'แถวถูกจัดเป็น Batch แล้วส่งไปที่ Python Worker', text: 'ฟังก์ชันของ Spark ไม่ต้องข้ามเลย (แถวสีน้ำเงินกลายเป็นสีเขียวใน JVM ทันที) ส่วน Python UDF กับ pandas_udf จะส่งครั้งละ 8 แถวในภาพ' },
    { at: 2.2, name: 'เรียกฟังก์ชัน', title: 'ใน Python: ทีละแถว หรือทีละ Batch', text: 'Arrow-optimized UDF จะแปลง Column เป็นแถวแล้ววนเรียก f ทีละแถว (ตัวนับซ้ายล่างเดินทีละ 1) ส่วน pandas_udf จะส่ง Batch ทั้งก้อนเป็น Series ให้ f ครั้งเดียว (ตัวนับกระโดดทีละก้อน)' },
    { at: 7, name: 'สรุป', title: 'ความต่างอยู่ที่จำนวนครั้งที่ข้ามเส้น และจำนวนครั้งที่เรียก Python', text: 'ฟังก์ชันของ Spark ไม่ข้ามเลย @udf ข้าม 6 ครั้ง (ไปกลับ 3 Batch) และเรียก 24 ครั้ง ส่วน pandas_udf ข้าม 6 ครั้งเท่ากันแต่เรียกแค่ 3 ครั้ง ถ้ามีฟังก์ชันของ Spark ที่ทำงานเดียวกันอยู่แล้ว ให้ใช้ตัวนั้นก่อนนะ' },
  ],
  en: [
    { at: 0, name: 'Start', title: 'The same 24 rows and the same function, but different journeys', text: 'The dashed line in the middle is the border between the executor JVM and the Python worker, which is a separate process. Every time a row crosses this line it costs something: converting the data format, sending it over a socket, and converting it back.' },
    { at: 1, name: 'Cross the socket', title: 'Rows are grouped into batches and sent to the Python worker', text: 'Spark functions never cross (blue rows turn green inside the JVM at once). Python UDF and pandas_udf send 8 rows at a time in the picture.' },
    { at: 2.2, name: 'Call function', title: 'In Python: row by row, or batch by batch', text: 'The Arrow-optimized UDF turns columns into rows and calls f one row at a time (the counter at the bottom left goes up by 1). pandas_udf gives the whole batch to f as one Series in a single call (the counter jumps by a whole batch).' },
    { at: 7, name: 'Summary', title: 'The difference is how many times rows cross the line and how many times Python is called', text: 'Spark functions never cross. @udf crosses 6 times (3 batches, there and back) and makes 24 calls. pandas_udf crosses the same 6 times but makes only 3 calls. If a Spark function does the same job, use that one first.' },
  ],
};

const TEXT = {
  th: {
    title: 'ฟังก์ชันเดียวกัน 24 แถว: ฟังก์ชันของ Spark เทียบกับ Python UDF และ pandas_udf',
    aria: 'สามเลนเทียบการเดินทางของแถวระหว่าง JVM กับ Python Worker',
    perRow: 'f(x) ต่อแถว',
    perBatch: 'f(series) ต่อ Batch',
    crossings: (n: number) => `ข้ามเส้น ${n} ครั้ง`,
    calls: (n: number) => `เรียกฟังก์ชันใน Python ${n} ครั้ง`,
    caption: 'สีน้ำเงินคือแถวที่ยังไม่ผ่านฟังก์ชัน ส่วนสีเขียวคือแถวที่ได้ผลแล้ว ภาพใช้ Batch ละ 8 แถวเพื่อให้เห็นง่าย ค่าจริงคือ 100 แถวสำหรับ Pickle และ 10,000 แถวสำหรับ Arrow ความยาวเวลาในภาพเป็นสัดส่วนกับจำนวนครั้งที่เรียก ไม่ได้เป็นวินาทีที่วัดได้ สิ่งที่ตรวจจริงคือจำนวนครั้งที่เรียกฟังก์ชัน (exercises/08_udf.py)',
  },
  en: {
    title: 'The same function on 24 rows: Spark function vs Python UDF and pandas_udf',
    aria: 'Three lanes comparing how rows travel between the JVM and the Python worker',
    perRow: 'f(x) per row',
    perBatch: 'f(series) per batch',
    crossings: (n: number) => `${n} crossings`,
    calls: (n: number) => `${n} function calls in Python`,
    caption: 'Blue rows have not been through the function yet. Green rows have their result. The picture uses batches of 8 rows to stay readable. The real values are 100 rows for pickle and 10,000 for Arrow. Time in the picture is proportional to the number of calls, it is not measured seconds. What was really checked is the number of function calls (exercises/08_udf.py).',
  },
};

export default function UdfLanesLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const clock = useClock(DURATION);
  const { t } = clock;

  return (
    <figure className="viz lg">
      <div className="viz-title">{T.title}</div>
      <div className="viz-box">
        <svg viewBox="0 0 880 410" role="img" aria-label={T.aria}>
          <rect className="band" x="10" y="10" width="860" height="392" rx="12" />
          <text className="b" x="130" y="36">JVM (executor)</text>
          <text className="b" x="660" y="36">Python worker</text>
          <line x1="440" x2="440" y1="44" y2="394" stroke="var(--line-strong)" strokeWidth="2" strokeDasharray="6 6" />

          {LANES[lang].map((L, li) => {
            const y0 = TOP + li * LANE_H;
            // counters
            let crossings = 0;
            let calls = 0;
            if (L.id !== 'builtin') {
              for (let b = 0; b < NB; b++) {
                if (t >= sendAt(L.id, b) + HOP) crossings++;
                if (t >= backAt(L.id, b) + HOP) crossings++;
                if (L.id === 'udf') {
                  for (let i = 0; i < BATCH; i++) if (t >= procAt(L.id, b) + (i + 1) * CALL) calls++;
                } else if (t >= procAt(L.id, b) + procLen(L.id)) calls++;
              }
            }
            const builtinDone = (i: number) => t >= 1 + i * 0.05 + 0.6;
            return (
              <g key={L.id}>
                <rect x="22" y={y0 - 2} width="836" height={LANE_H - 8} rx="10" fill="none" stroke="var(--line)" />
                <text className="b" x="34" y={y0 + 16} style={{ fontSize: 13 }}>{L.title}</text>
                <text className="s" x="34" y={y0 + 32}>{L.sub}</text>

                {L.id !== 'builtin' && (
                  <g>
                    <rect className={t >= procAt(L.id, 0) && t < endAt(L.id) ? 'fx-hot' : 'box'} x="560" y={y0 + 34} width="140" height="62" rx="8" opacity="0.9" />
                    <text className="s m b" x="706" y={y0 + 70}>{L.id === 'udf' ? T.perRow : T.perBatch}</text>
                  </g>
                )}
                {L.id === 'builtin' && <rect className="box" x="290" y={y0 + 40} width="120" height="52" rx="8" />}
                {L.id === 'builtin' && <text className="s m" x="350" y={y0 + 72} textAnchor="middle">codegen</text>}

                {/* rows */}
                {Array.from({ length: ROWS }, (_, n) => {
                  const b = Math.floor(n / BATCH);
                  const i = n % BATCH;
                  const home = jvmPos(b, i, y0);
                  let pos = home;
                  let done = false;
                  let ring = false;
                  if (L.id === 'builtin') {
                    done = builtinDone(n);
                    ring = t >= 1 + n * 0.05 && t < 1 + n * 0.05 + 0.6;
                  } else {
                    const go = smooth(prog(t, sendAt(L.id, b) + (i % 4) * 0.02, sendAt(L.id, b) + HOP));
                    const back = smooth(prog(t, backAt(L.id, b) + (i % 4) * 0.02, backAt(L.id, b) + HOP));
                    const py = pyPos(i, y0);
                    pos = t < backAt(L.id, b) ? [mix(home[0], py[0], go), mix(home[1], py[1], go)] : [mix(py[0], home[0], back), mix(py[1], home[1], back)];
                    const p0 = procAt(L.id, b);
                    if (L.id === 'udf') {
                      done = t >= p0 + (i + 1) * CALL;
                      ring = t >= p0 + i * CALL && t < p0 + (i + 1) * CALL;
                    } else {
                      done = t >= p0 + procLen(L.id);
                      ring = t >= p0 && t < p0 + procLen(L.id);
                    }
                  }
                  return (
                    <g key={n} transform={`translate(${pos[0]} ${pos[1]})`}>
                      <circle r="7.5" className={done ? 'k2' : 'k1'} />
                      {ring && <circle r="12" className="fx-ring" />}
                    </g>
                  );
                })}

                <g transform={`translate(34 ${y0 + LANE_H - 14})`}>
                  <text className="s m">{T.crossings(crossings)}</text>
                </g>
                <text className="s m" x="460" y={y0 + LANE_H - 14}>{T.calls(calls)}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <ClockControls clock={clock} marks={MARKS[lang]} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
