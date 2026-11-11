import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { StepControls, useStepper, type StepInfo, type Lang } from './stepper';

// What crosses the socket between an executor (JVM) and its Python worker, for the three kinds of Python function.
// 8 rows and a batch of 4 keep the picture small. Real defaults: 100 rows per pickle batch (python.udf.maxRecordsPerBatch),
// 10,000 rows per Arrow batch (arrow.maxRecordsPerBatch). Source: PythonRunner, BatchEvalPythonExec, PythonArrowInput,
// worker.py (Spark 4.2.0). Call counts per kind were asserted by subjects/spark/code/exercises/08_udf.py.

type Kind = 'pickle' | 'arrow' | 'pandas';

const KINDS: Record<Lang, { id: Kind; label: string; sub: string }[]> = {
  th: [
    { id: 'pickle', label: 'Python UDF (useArrow=False)', sub: 'evalType 100, BatchEvalPython' },
    { id: 'arrow', label: 'Python UDF แบบ Arrow (ค่าเริ่มต้น)', sub: 'evalType 101, ArrowEvalPython' },
    { id: 'pandas', label: 'pandas_udf', sub: 'evalType 200, ArrowEvalPython' },
  ],
  en: [
    { id: 'pickle', label: 'Python UDF (useArrow=False)', sub: 'evalType 100, BatchEvalPython' },
    { id: 'arrow', label: 'Arrow Python UDF (default)', sub: 'evalType 101, ArrowEvalPython' },
    { id: 'pandas', label: 'pandas_udf', sub: 'evalType 200, ArrowEvalPython' },
  ],
};

const STEPS: Record<Lang, Record<Kind, StepInfo[]>> = {
  th: {
    pickle: [
      { name: 'แถวใน JVM', title: 'แถวอยู่ในรูป InternalRow ของ JVM', text: 'Executor อ่าน Partition ของตัวเอง และแต่ละแถวต้องถูกแปลงเป็น Object ที่ Python เข้าใจ' },
      { name: 'Pickle', title: 'จัดเป็นชุดละ 100 แถว แล้ว Pickle', text: 'BatchEvalPythonExec จะแปลงแถวเป็น Java Object แล้ว Pickle ทีละ Batch (ภาพใช้ 4 แถวต่อ Batch) ค่าเริ่มต้นคือ 100 แถว' },
      { name: 'Socket', title: 'ส่งผ่าน Socket ไปที่ Python Worker', text: 'ทุก Task จะมี Python Worker Process ของตัวเอง โดย JVM ส่ง Handshake (version, ไฟล์, broadcast, ตัวฟังก์ชันที่ pickle แล้ว) ตามด้วยข้อมูล' },
      { name: 'เรียกฟังก์ชัน', title: 'Worker เรียกฟังก์ชัน 1 ครั้งต่อ 1 แถว', text: 'Unpickle แล้ววนทีละแถวเรียก f(x) ภาพนับได้ 8 ครั้งสำหรับ 8 แถว' },
      { name: 'ส่งกลับ', title: 'Pickle ผลกลับ แล้ว JVM แปลงเป็นแถว', text: 'ผลลัพธ์ถูก Pickle เป็น Batch ส่งกลับไปที่ JVM ซึ่งจะ Unpickle แล้วแปลงเป็น InternalRow ตามชนิดที่ประกาศไว้ ถ้าชนิดไม่ตรง ผลที่ได้คือ NULL แบบเงียบ ๆ' },
    ],
    arrow: [
      { name: 'แถวใน JVM', title: 'แถวอยู่ในรูป InternalRow ของ JVM', text: 'ขั้นเดียวกับเส้นทาง pickle' },
      { name: 'Arrow batch', title: 'จัดเป็น Arrow Batch สูงสุด 10,000 แถว', text: 'แถวถูกเขียนเป็น Column (Arrow) ได้ทีละก้อนใหญ่ ซึ่งถูกกว่าการ Pickle แถวต่อแถว (ภาพใช้ 4 แถวต่อ Batch)' },
      { name: 'Socket', title: 'ส่งผ่าน Socket เป็น Arrow Stream', text: 'ใช้ Socket แบบเดียวกัน ต่างกันที่ข้อมูลเป็น Arrow ซึ่งอ่านเข้า Memory ของ Python ได้โดยไม่ต้อง Unpickle ทีละแถว' },
      { name: 'เรียกฟังก์ชัน', title: 'Worker ยังเรียกฟังก์ชันทีละแถว', text: 'Worker แปลง Column เป็น list แล้ว [f(*row) for row in rows] ดังนั้นฟังก์ชันของคุณจะถูกเรียก 8 ครั้ง ที่เร็วขึ้นก็เพราะการขนส่ง ไม่ได้เป็นเพราะฟังก์ชันเป็น Vectorized' },
      { name: 'ส่งกลับ', title: 'แปลงผลกลับเป็น Arrow แล้วส่ง', text: 'ผลลัพธ์ถูกแปลงด้วยชนิดที่ประกาศไว้ ถ้าไม่ตรงอาจถูก Cast (1.5 เป็น int ได้ 1) หรือเกิด Error' },
    ],
    pandas: [
      { name: 'แถวใน JVM', title: 'แถวอยู่ในรูป InternalRow ของ JVM', text: 'ขั้นเดียวกับสองเส้นทางแรก' },
      { name: 'Arrow batch', title: 'จัดเป็น Arrow Batch', text: 'เหมือน Arrow UDF คือส่งทีละ Batch ใหญ่' },
      { name: 'Socket', title: 'ส่งผ่าน Socket เป็น Arrow Stream', text: 'ใช้เส้นทางเดียวกับ Arrow UDF' },
      { name: 'เรียกฟังก์ชัน', title: 'Worker เรียกฟังก์ชัน 1 ครั้งต่อ 1 Batch', text: 'แต่ละ Batch จะกลายเป็น pandas Series แล้วฟังก์ชันของคุณรับทั้ง Series ไปคำนวณแบบ Vectorized ในครั้งเดียว ภาพนับได้ 2 ครั้ง สำหรับ 2 Batch' },
      { name: 'ส่งกลับ', title: 'ส่ง Series กลับเป็น Arrow', text: 'ต้องได้ Series ความยาวเท่าเดิม และชนิดที่คืนต้อง Cast เข้ากับชนิดที่ประกาศไว้ได้ ไม่อย่างนั้นจะเกิด PythonException' },
    ],
  },
  en: {
    pickle: [
      { name: 'Rows in JVM', title: 'Rows are JVM InternalRow objects', text: 'The executor reads its own partition. Each row must be turned into an object that Python understands.' },
      { name: 'pickle', title: 'Group 100 rows into a batch, then pickle', text: 'BatchEvalPythonExec turns rows into Java objects and pickles them one batch at a time (the picture uses 4 rows per batch). The default is 100 rows.' },
      { name: 'socket', title: 'Send over a socket to the Python worker', text: 'Every task has its own Python worker process. The JVM sends a handshake (version, files, broadcasts, the pickled function), then the data.' },
      { name: 'Call function', title: 'The worker calls the function once per row', text: 'It unpickles the batch and loops over the rows, calling f(x) for each one. The picture counts 8 calls for 8 rows.' },
      { name: 'Send back', title: 'Pickle the result, and the JVM turns it into rows', text: 'The results are pickled as a batch and sent back. The JVM unpickles them and converts them to InternalRow with the declared type. If the type does not match, the result is silently NULL.' },
    ],
    arrow: [
      { name: 'Rows in JVM', title: 'Rows are JVM InternalRow objects', text: 'The same step as the pickle path.' },
      { name: 'Arrow batch', title: 'Group up to 10,000 rows into an Arrow batch', text: 'Rows are written as columns (Arrow) in big chunks. This is cheaper than pickling row by row (the picture uses 4 rows per batch).' },
      { name: 'socket', title: 'Send over a socket as an Arrow stream', text: 'It uses the same kind of socket. The difference is that the data is Arrow, which Python can read into memory without unpickling row by row.' },
      { name: 'Call function', title: 'The worker still calls the function row by row', text: 'The worker turns the columns into lists and runs [f(*row) for row in rows], so your function is called 8 times. It is faster because of the transport, not because the function is vectorized.' },
      { name: 'Send back', title: 'Convert the result back to Arrow and send it', text: 'The result is converted with the declared type. If it does not match, it may be cast (1.5 becomes the int 1) or raise an error.' },
    ],
    pandas: [
      { name: 'Rows in JVM', title: 'Rows are JVM InternalRow objects', text: 'The same step as the first two paths.' },
      { name: 'Arrow batch', title: 'Group rows into an Arrow batch', text: 'Same as the Arrow UDF: data is sent one big batch at a time.' },
      { name: 'socket', title: 'Send over a socket as an Arrow stream', text: 'It uses the same path as the Arrow UDF.' },
      { name: 'Call function', title: 'The worker calls the function once per batch', text: 'Each batch becomes a pandas Series. Your function takes the whole Series and computes in one vectorized call. The picture counts 2 calls for 2 batches.' },
      { name: 'Send back', title: 'Send the Series back as Arrow', text: 'You must return a Series of the same length. The returned type must be castable to the declared type, or you get a PythonException.' },
    ],
  },
};

const TEXT = {
  th: {
    title: 'ข้อมูลเดินทางระหว่าง JVM กับ Python Worker อย่างไร',
    pick: 'เลือกชนิดของฟังก์ชัน',
    aria: (n: number) => `ขั้นที่ ${n} ของเส้นทางข้อมูล`,
    worker: 'Python Worker (Process แยก)',
    inJvm: 'InternalRow ในหน่วยความจำของ JVM',
    back: 'รับผลกลับเป็น InternalRow',
    format: (f: string) => `รูปแบบข้อมูล: ${f}`,
    wholeBatch: 'f(series)  # ทั้ง batch',
    calls: (n: number) => `เรียกฟังก์ชัน ${n} ครั้ง`,
    caption: 'ภาพใช้ 8 แถวและ 4 แถวต่อ Batch เพื่อให้อ่านง่าย ส่วนค่าจริงคือ 100 แถวต่อ Batch ของ Pickle และ 10,000 แถวต่อ Batch ของ Arrow',
  },
  en: {
    title: 'How data travels between the JVM and the Python worker',
    pick: 'Choose the kind of function',
    aria: (n: number) => `Step ${n} of the data path`,
    worker: 'Python worker (separate process)',
    inJvm: 'InternalRow in JVM memory',
    back: 'Results come back as InternalRow',
    format: (f: string) => `Data format: ${f}`,
    wholeBatch: 'f(series)  # whole batch',
    calls: (n: number) => `${n} function calls`,
    caption: 'The picture uses 8 rows and 4 rows per batch to stay readable. The real values are 100 rows per pickle batch and 10,000 rows per Arrow batch.',
  },
};

const ROWS = 8;
const BATCH = 4;
const EASE = { duration: 0.7, ease: 'easeInOut' as const };

export default function UdfBridgeLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [kind, setKind] = useState<Kind>('pickle');
  const { step, go, playing, toggle, reset } = useStepper(5, 3000);
  const reduce = useReducedMotion();
  const t = reduce ? { duration: 0 } : EASE;
  const perRow = kind !== 'pandas';
  const calls = step >= 3 ? (perRow ? ROWS : ROWS / BATCH) : 0;
  const pos = (i: number) => {
    const b = Math.floor(i / BATCH);
    const k = i % BATCH;
    if (step === 1) return { x: 76 + b * 110 + k * 22, y: 150 };
    if (step === 2) return { x: 362 + b * 90 + k * 20, y: 170 };
    if (step === 3) return { x: 592 + k * 28, y: 120 + b * 36 };
    return { x: 50 + i * 34, y: 150 };
  };
  const framed = kind === 'pickle' ? 'pickle' : 'Arrow';

  return (
    <figure className="viz">
      <div className="viz-title">{T.title}</div>
      <div className="viz-steps" role="group" aria-label={T.pick}>
        {KINDS[lang].map((k) => (
          <button key={k.id} type="button" aria-pressed={kind === k.id} onClick={() => { setKind(k.id); reset(); }}>
            {k.label}
          </button>
        ))}
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 330" role="img" aria-label={T.aria(step + 1)}>
          <rect className="band" x="10" y="10" width="860" height="310" rx="12" />
          <rect className="box" x="26" y="50" width="300" height="240" rx="10" />
          <text className="b" x="42" y="76">Executor (JVM)</text>
          <rect className="box" x="554" y="50" width="300" height="240" rx="10" />
          <text className="b" x="570" y="76">{T.worker}</text>
          <motion.rect className="zone" x="340" y="104" width="200" height="130" rx="8" initial={false} animate={{ opacity: step === 2 ? 1 : 0.35 }} transition={t} />
          <text className="s b" x="440" y="124" textAnchor="middle">socket</text>
          <text className="s" x="440" y="222" textAnchor="middle">{KINDS[lang].find((k) => k.id === kind)!.sub}</text>

          {/* batch frames */}
          {[0, 1].map((b) => (
            <motion.rect
              key={b}
              rx="8"
              width={96}
              height={34}
              className="box on"
              initial={false}
              animate={{
                x: step === 2 ? 346 + b * 90 : 62 + b * 110,
                y: step === 2 ? 153 : 133,
                opacity: step === 1 || step === 2 ? 1 : 0,
              }}
              transition={t}
              style={{ fill: 'none' }}
            />
          ))}

          {Array.from({ length: ROWS }, (_, i) => {
            const { x, y } = pos(i);
            return (
              <motion.g key={i} initial={false} animate={{ x, y }} transition={{ ...t, delay: reduce ? 0 : i * 0.03 }}>
                <circle r="9" className={step === 4 ? 'k2' : 'k1'} />
                <text className="dl" y="4">{i + 1}</text>
                {step === 3 && <circle r="12" fill="none" stroke="var(--accent)" strokeWidth="2" />}
              </motion.g>
            );
          })}

          <text className="s" x="42" y="262">{step <= 1 ? T.inJvm : step === 4 ? T.back : ''}</text>
          <text className="s" x="570" y="262">{step >= 3 ? T.format(framed) : ''}</text>

          <motion.g initial={false} animate={{ opacity: step >= 3 ? 1 : 0 }} transition={t}>
            <rect className="box on" x="570" y="190" width="268" height="46" rx="8" />
            <text className="b m" x="584" y="209" style={{ fontSize: 13 }}>{perRow ? '[f(*row) for row in rows]' : T.wholeBatch}</text>
            <text className="m b acc" x="584" y="227">{T.calls(calls)}</text>
          </motion.g>
        </svg>
      </div>
      <StepControls steps={STEPS[lang][kind]} step={step} playing={playing} go={go} toggle={toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
