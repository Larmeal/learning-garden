import { useState } from 'react';
import { ClockControls, mix, prog, smooth, useClock, type Lang, type Mark } from './timeline';

// PySpark is a client of the JVM (lesson 1, in depth): a DataFrame in Python holds only a handle (df._jdf, a Py4J
// JavaObject) of a Dataset that lives in the JVM; every transformation is a small call through the gateway that returns
// a new handle; rows come back only when an action asks for them (collect, show, toPandas); write is done by the
// executors and nothing comes back. In local[*] the driver JVM is the only executor and the tasks are threads of it.
// All of this was checked in exercise 01 (collect, show, toPandas, write, _jdf). The row counts are the picture's own.

type Action = 'collect' | 'show' | 'toPandas' | 'write';
const ACTIONS: { id: Action; code: string }[] = [
  { id: 'collect', code: 'rows = f.collect()' },
  { id: 'show', code: 'f.show()' },
  { id: 'toPandas', code: 'pdf = f.toPandas()' },
  { id: 'write', code: 'f.write.parquet("out/")' },
];
type Size = 'small' | 'big';

const DURATION = 15;
const THREADS = 16;

const MARKS_TH: Mark[] = [
  { at: 0, name: 'สร้าง DataFrame', title: 'spark.range(...) คือการเรียก method ใน JVM ผ่าน Py4J', text: 'Python ส่งข้อความเล็ก ๆ ผ่าน Socket ไปให้ JVM จากนั้น JVM จะสร้าง Dataset (เป็นแค่แผน ยังไม่มีข้อมูล) แล้วส่ง Handle กลับมา ตัวแปร df ใน Python จึงเก็บแค่ Handle นั้น (df._jdf เป็น JavaObject)' },
  { at: 2.6, name: 'Transformation', title: 'filter ก็คือการเรียก Method อีกครั้ง และได้ Handle ใหม่กลับมา', text: 'ไม่มีแถวข้อมูลข้าม Gateway เลย สิ่งที่ผ่านไปมามีแค่ชื่อ Method กับ Argument เล็ก ๆ และ Handle ที่ตอบกลับ ส่วนที่เป็นแผนอยู่ใน JVM ทั้งหมด จึงไม่ช้ากว่า Scala' },
  { at: 5, name: 'Action', title: 'Action ทำให้ JVM รัน Job โดย Task เป็น Thread ใน JVM เดียว (Local Mode)', text: 'ใน local[*] Driver เป็น Executor ตัวเดียว และ Task ทุกตัวเป็น Thread ใน JVM เดียวกัน ข้อมูลจะถูกอ่านและกรองที่นั่น ส่วน Python ยังรออยู่และยังไม่ได้รับข้อมูลอะไรเลย' },
  { at: 8.4, name: 'ผลลัพธ์', title: 'สิ่งที่ข้ามกลับมาขึ้นอยู่กับ Action ที่เลือก', text: 'collect และ toPandas จะก๊อปผลทั้งหมดเข้า Memory ของ Driver (และส่งมาที่ Python) ส่วน show ส่งกลับมาแค่ข้อความที่พิมพ์ (20 แถวแรก) และ write ไม่ผ่าน Driver เลย เพราะ Executor เป็นคนเขียนไฟล์เอง' },
];

const MARKS_EN: Mark[] = [
  { at: 0, name: 'Create DataFrame', title: 'spark.range(...) is a method call into the JVM through Py4J', text: 'Python sends a small message through a socket. The JVM builds a Dataset (just a plan, no data yet) and sends a handle back. The variable df in Python holds only that handle (df._jdf is a JavaObject).' },
  { at: 2.6, name: 'transformation', title: 'filter is another method call that returns a new handle', text: 'No rows of data cross the gateway. Only method names, small arguments and the handles that come back go through. The plan lives entirely in the JVM, so it is not slower than Scala.' },
  { at: 5, name: 'action', title: 'An action makes the JVM run a job: the tasks are threads in one JVM (local mode)', text: 'In local[*] the driver is the only executor, and all tasks are threads in the same JVM. The data is read and filtered there. Python is still waiting and has received no data.' },
  { at: 8.4, name: 'Result', title: 'What crosses back depends on the action you chose', text: 'collect and toPandas copy the whole result into the memory of the driver (and send it to Python). show sends back only the printed text (the first 20 rows). write does not go through the driver at all: the executors write the files themselves.' },
];
const MARKS: Record<Lang, Mark[]> = { th: MARKS_TH, en: MARKS_EN };

const TEXT: Record<Lang, {
  title: string; actionLabel: string; sizeLabel: string; small: string; big: string; svgLabel: string; python: string; printed: string;
  handleNote1: string; handleNote2: string; pyMem: string; rowsWord: string; showOnly: string; fitDriver: string; gateway: string;
  printedText: string; rowsBack: string; noRowsBack: string; calls: string; rowsBackCount: string; jvm: string; datasetNote: string; threads: string;
  writeOwn: string; noDriver: string; jobResult: string; showSends: string; sendsOnAction: string; caption: string;
}> = {
  th: {
    title: 'PySpark คุยกับ JVM ผ่าน Py4J อะไรข้ามไปมา และอะไรไม่ข้าม', actionLabel: 'Action', sizeLabel: 'จำนวนแถวหลังกรอง', small: 'กรองเหลือ 10 แถว', big: 'ไม่กรอง (1,000,000 แถว)',
    svgLabel: 'ข้อความระหว่าง Python กับ JVM ผ่าน Py4J และข้อมูลที่ข้ามกลับ', python: 'Python (Process ของคุณ)', printed: '→ None (พิมพ์แล้ว)',
    handleNote1: 'ตัวแปรใน Python เก็บแค่ Handle', handleNote2: '(df._jdf เป็น JavaObject) ไม่ได้เก็บข้อมูล', pyMem: 'Memory ของ Python/Driver ตอนนี้', rowsWord: 'แถว',
    showOnly: 'เฉพาะที่พิมพ์ (ไม่เกิน 20)', fitDriver: 'ต้องพอดีกับ Memory ของ Driver', gateway: 'Py4J (socket)', printedText: 'ข้อความที่พิมพ์', rowsBack: 'แถวข้ามกลับมา',
    noRowsBack: 'ไม่มีแถวข้ามกลับ', calls: 'การเรียก Py4J', rowsBackCount: 'แถวข้ามกลับ', jvm: 'JVM (Driver + Executor ใน local[*])', datasetNote: 'Dataset ใน JVM (เป็นแผน ไม่ใช่ข้อมูล)',
    threads: 'Task = Thread ใน JVM เดียวกัน (16 Partition)', writeOwn: 'Executor เขียนไฟล์เอง', noDriver: 'ไม่ผ่าน Driver และไม่ผ่าน Python', jobResult: 'ผลของ Job (อยู่ใน JVM ก่อน)',
    showSends: 'ส่งแค่ 20 แถวแรก', sendsOnAction: 'ส่งเมื่อ Action ขอ',
    caption: 'เราตรวจใน exercises/01_architecture.py แล้วว่า DataFrame ใน Python เก็บแค่ Handle (df._jdf) และ collect, show, toPandas, write ทำงานตามที่วาดไว้ ส่วนจำนวนแถวในภาพ ชื่อ Handle (H1, H2) และชื่อ Method ที่ Python ส่งไปเป็นภาพประกอบ จึงไม่ได้ตรงกับข้อความ Py4J จริงทุกตัวอักษร',
  },
  en: {
    title: 'PySpark talks to the JVM through Py4J: what crosses and what does not', actionLabel: 'action', sizeLabel: 'Rows after the filter', small: 'Filter down to 10 rows', big: 'No filter (1,000,000 rows)',
    svgLabel: 'Messages between Python and the JVM through Py4J, and the data that crosses back', python: 'Python (your process)', printed: '→ None (printed)',
    handleNote1: 'A Python variable holds only a handle', handleNote2: '(df._jdf is a JavaObject), not data', pyMem: 'Python/driver memory now', rowsWord: 'rows',
    showOnly: 'Only what is printed (max 20)', fitDriver: 'Must fit in driver memory', gateway: 'Py4J (socket)', printedText: 'Printed text', rowsBack: 'Rows cross back',
    noRowsBack: 'No rows cross back', calls: 'Py4J calls', rowsBackCount: 'Rows crossed back', jvm: 'JVM (driver + executor in local[*])', datasetNote: 'Dataset in the JVM (a plan, not data)',
    threads: 'task = thread in the same JVM (16 partitions)', writeOwn: 'Executors write files themselves', noDriver: 'Not through the driver or Python', jobResult: 'Job result (in the JVM first)',
    showSends: 'Sends first 20 rows', sendsOnAction: 'Sent when asked',
    caption: 'We checked in exercises/01_architecture.py that a DataFrame in Python holds only a handle (df._jdf) and that collect, show, toPandas and write work as drawn. The row counts in the picture, the handle names (H1, H2) and the method names that Python sends are an illustration, not the exact Py4J messages character by character.',
  },
};

export default function Py4jLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [action, setAction] = useState<Action>('collect');
  const [size, setSize] = useState<Size>('small');
  const clock = useClock(DURATION);
  const { t } = clock;
  const rows = size === 'small' ? 10 : 1000000;

  const a = ACTIONS.find((x) => x.id === action)!;
  const lines = ['df = spark.range(1_000_000)', size === 'small' ? 'f = df.filter("id % 100000 = 0")' : 'f = df.filter("id >= 0")', a.code];
  const call = [prog(t, 0.5, 1.7), prog(t, 3, 4.2), prog(t, 5.2, 6.2)]; // call travels to the JVM
  const back = [prog(t, 1.7, 2.5), prog(t, 4.2, 4.9), 0];
  const h1 = t >= 1.7;
  const h2 = t >= 4.2;
  const run = prog(t, 6.2, 8.2);
  const result = prog(t, 8.4, 11.5);
  const calls = (t >= 0.5 ? 1 : 0) + (t >= 3 ? 1 : 0) + (t >= 5.2 ? 1 : 0);

  const returnedRows = action === 'collect' || action === 'toPandas' ? rows : action === 'show' ? Math.min(20, rows) : 0;
  const dots = Math.min(14, returnedRows);
  const crossed = result > 0 ? (result >= 1 ? returnedRows : Math.round(returnedRows * result)) : 0;
  const activeLine = t < 2.6 ? 0 : t < 5 ? 1 : 2;

  const XG0 = 316;
  const XG1 = 520;

  return (
    <figure className="viz lg">
      <div className="viz-title">{T.title}</div>
      <div className="viz-steps" role="group" aria-label={T.actionLabel}>
        {ACTIONS.map((x) => (
          <button key={x.id} type="button" aria-pressed={action === x.id} onClick={() => { setAction(x.id); clock.restart(); }}>{x.code}</button>
        ))}
      </div>
      <div className="viz-steps" role="group" aria-label={T.sizeLabel}>
        <button type="button" aria-pressed={size === 'small'} onClick={() => { setSize('small'); clock.restart(); }}>{T.small}</button>
        <button type="button" aria-pressed={size === 'big'} onClick={() => { setSize('big'); clock.restart(); }}>{T.big}</button>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 470" role="img" aria-label={T.svgLabel}>
          <rect className="band" x="10" y="10" width="860" height="450" rx="12" />

          {/* Python process */}
          <rect className="box" x="24" y="40" width="284" height="400" rx="12" />
          <text className="b" x="40" y="66">{T.python}</text>
          {lines.map((l, i) => (
            <g key={i} transform={`translate(36 ${88 + i * 64})`}>
              <rect className={i === activeLine ? 'fx-hot' : 'box'} width="260" height="50" rx="8" />
              <text className="m b" x="10" y="21" style={{ fontSize: 11.5 }}>{l}</text>
              <text className="s m" x="10" y="40" style={{ fill: 'var(--k2)' }}>
                {i === 0 && h1 ? '→ handle H1' : i === 1 && h2 ? '→ handle H2' : i === 2 && result >= 1 ? (action === 'write' ? '→ None' : action === 'show' ? T.printed : action === 'collect' ? `→ list ${rows.toLocaleString('en-US')} Row` : `→ pandas ${rows.toLocaleString('en-US')} x 1`) : ''}
              </text>
            </g>
          ))}
          <text className="s" x="40" y="300">{T.handleNote1}</text>
          <text className="s" x="40" y="318">{T.handleNote2}</text>
          {action !== 'write' && result > 0 && (
            <g transform="translate(36 336)" opacity={smooth(Math.min(1, result * 2))}>
              <rect className="fx-hot" width="260" height="84" rx="8" />
              <text className="s b" x="10" y="20">{T.pyMem}</text>
              <text className="b num" x="10" y="48" style={{ fontSize: 15 }}>{crossed.toLocaleString('en-US')} {T.rowsWord}</text>
              <text className="s" x="10" y="70">{action === 'show' ? T.showOnly : T.fitDriver}</text>
            </g>
          )}

          {/* gateway */}
          <rect x={XG0 - 4} y="40" width={XG1 - XG0 + 8} height="400" rx="12" className="fx-file" opacity="0.5" />
          <text className="b" x={(XG0 + XG1) / 2} y="66" textAnchor="middle">Py4J (socket)</text>
          {[0, 1, 2].map((i) => {
            const y = 113 + i * 64;
            const c = call[i];
            const bk = back[i];
            return (
              <g key={i}>
                {c > 0 && <line x1={XG0} x2={XG0 + (XG1 - XG0) * c} y1={y - 6} y2={y - 6} stroke="var(--k1)" strokeWidth="3" strokeLinecap="round" />}
                {c > 0 && <text className="s m" x={(XG0 + XG1) / 2} y={y - 12} textAnchor="middle">{i === 0 ? 'range(1000000)' : i === 1 ? 'H1.filter(...)' : action === 'write' ? 'H2.write.parquet(...)' : action === 'show' ? 'H2.show()' : `H2.${action}()`}</text>}
                {bk > 0 && i < 2 && <line x1={XG1} x2={XG1 - (XG1 - XG0) * bk} y1={y + 8} y2={y + 8} stroke="var(--k2)" strokeWidth="3" strokeLinecap="round" />}
                {bk > 0 && i < 2 && <text className="s m" x={(XG0 + XG1) / 2} y={y + 24} textAnchor="middle" style={{ fill: 'var(--k2)' }}>handle H{i + 1}</text>}
              </g>
            );
          })}
          {/* rows coming back */}
          {action !== 'write' && result > 0 &&
            Array.from({ length: dots }, (_, i) => {
              const f = smooth(prog(result, i / (dots * 1.6), i / (dots * 1.6) + 0.6));
              if (f <= 0 || f >= 1) return null;
              return <circle key={i} cx={mix(XG1, XG0, f)} cy={270 + (i % 4) * 14} r="5" className="k2" />;
            })}
          {action !== 'write' && result > 0 && result < 1 && <text className="s b" x={(XG0 + XG1) / 2} y="352" textAnchor="middle" style={{ fill: 'var(--k2)' }}>{action === 'show' ? T.printedText : T.rowsBack}</text>}
          {action === 'write' && t >= 8.4 && <text className="s b" x={(XG0 + XG1) / 2} y="300" textAnchor="middle">{T.noRowsBack}</text>}
          <text className="s m" x={(XG0 + XG1) / 2} y="400" textAnchor="middle">{T.calls}: {calls}</text>
          <text className="s m" x={(XG0 + XG1) / 2} y="420" textAnchor="middle">{T.rowsBackCount}: {crossed.toLocaleString('en-US')}</text>

          {/* JVM */}
          <rect className="box" x="536" y="40" width="324" height="400" rx="12" />
          <text className="b" x="552" y="66">{T.jvm}</text>
          <g transform="translate(552 82)">
            <text className="s">{T.datasetNote}</text>
            {[h1, h2].map((on, i) => on && (
              <g key={i} transform={`translate(0 ${12 + i * 34})`}>
                <rect className="fx-file" width="290" height="28" rx="6" />
                <text className="s m b" x="10" y="19">H{i + 1}: {i === 0 ? 'Range (0, 1000000)' : size === 'small' ? 'Filter (id % 100000 = 0)' : 'Filter (id >= 0)'}</text>
              </g>
            ))}
          </g>
          <g transform="translate(552 180)">
            <text className="s">{T.threads}</text>
            {Array.from({ length: THREADS }, (_, i) => {
              const f = prog(run, (i % 8) * 0.04, 0.6 + (i % 8) * 0.04 + (i >> 3) * 0.1);
              const working = run > 0 && f < 1;
              const dn = run > 0 && f >= 1;
              return (
                <g key={i} transform={`translate(${(i % 8) * 36} ${12 + Math.floor(i / 8) * 40})`}>
                  <rect width="30" height="30" rx="5" className={working ? 'fx-hot' : dn ? 'k1' : 'box'} opacity={dn ? 0.85 : 1} />
                  <text className="s m" x="15" y="20" textAnchor="middle" style={{ fill: dn ? 'var(--on-key)' : undefined, fontSize: 10 }}>{i + 1}</text>
                </g>
              );
            })}
          </g>
          {action === 'write' && run > 0.2 && (
            <g transform="translate(552 290)" opacity={smooth(Math.min(1, (run - 0.2) * 2))}>
              <text className="s b">{T.writeOwn}</text>
              {Array.from({ length: 6 }, (_, i) => (
                <g key={i} transform={`translate(${i * 48} 12)`}>
                  <rect width="40" height="48" rx="4" className="fx-hot" />
                  <text className="s m" x="20" y="30" textAnchor="middle" style={{ fontSize: 9.5 }}>.parquet</text>
                </g>
              ))}
              <text className="s" y="78">{T.noDriver}</text>
            </g>
          )}
          {action !== 'write' && run > 0.2 && (
            <g transform="translate(552 290)" opacity={smooth(Math.min(1, (run - 0.2) * 2))}>
              <text className="s b">{T.jobResult}</text>
              <rect className="box" y="12" width="290" height="46" rx="6" />
              <text className="m b num" x="10" y="40" style={{ fontSize: 13 }}>{rows.toLocaleString('en-US')} {T.rowsWord}</text>
              <text className="s" x="150" y="40">{action === 'show' ? T.showSends : T.sendsOnAction}</text>
            </g>
          )}
        </svg>
      </div>
      <ClockControls clock={clock} marks={MARKS[lang]} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
