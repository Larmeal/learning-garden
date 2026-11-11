import { useMemo, useState } from 'react';
import { ClockControls, prog, smooth, useClock, type Lang, type Mark } from './timeline';

// The conversation between the JVM (PythonRunner) and one Python worker for one task, as a sequence diagram.
// Order and values from the source (Spark 4.2.0): PythonRunner.scala:418-548 (what the JVM writes), worker.py:3562-3647
// (what the worker reads and answers), serializers.py:80-86 (the special lengths), util.py:505-545 and
// PythonRunner.scala:661-712 (errors). Lines of the source are in the lesson table. The 8 rows of data are drawn as
// 2 batches; the real batch is 100 rows (pickle) or 10,000 rows (Arrow).

type Mode = 'ok' | 'error' | 'crash';
type Dir = 'jvm' | 'py';
interface Row {
  dir: Dir;
  label: string;
  kind: 'meta' | 'data' | 'ctl' | 'bad';
  reads?: string; // what the worker does with it
  mid?: boolean; // a separator line
}

const HEAD_TH: Row[] = [
  { dir: 'jvm', label: 'Index ของ Partition', kind: 'meta', reads: 'split_index' },
  { dir: 'jvm', label: 'เวอร์ชัน Python', kind: 'meta', reads: 'check_python_version' },
  { dir: 'jvm', label: 'TaskContext (JSON)', kind: 'meta', reads: 'อ่าน TaskContext' },
  { dir: 'jvm', label: 'ไฟล์ของ Spark / includes', kind: 'meta', reads: 'setup_spark_files' },
  { dir: 'jvm', label: 'Broadcast Variables', kind: 'meta', reads: 'setup_broadcasts' },
  { dir: 'jvm', label: 'evalType (100, 101, 200 ...)', kind: 'meta', reads: 'eval_type' },
  { dir: 'jvm', label: 'runnerConf', kind: 'meta', reads: 'RunnerConf' },
  { dir: 'jvm', label: 'evalConf', kind: 'meta', reads: 'EvalConf' },
  { dir: 'jvm', label: 'writeCommand: ฟังก์ชันที่ Pickle แล้ว', kind: 'meta', reads: 'read_udfs: Unpickle ฟังก์ชัน' },
  { dir: 'jvm', label: 'flush แล้วถึงส่งข้อมูล', kind: 'ctl', mid: true },
  { dir: 'jvm', label: 'ข้อมูล Batch 1 (4 แถว)', kind: 'data', reads: 'load_stream แล้วเรียก func' },
];
const TAIL_TH: Record<Mode, Row[]> = {
  ok: [
    { dir: 'jvm', label: 'ข้อมูล Batch 2 (4 แถว)', kind: 'data' },
    { dir: 'py', label: 'ผลของ Batch 1', kind: 'data' },
    { dir: 'py', label: 'ผลของ Batch 2', kind: 'data' },
    { dir: 'jvm', label: 'END_OF_STREAM (-4)', kind: 'ctl' },
    { dir: 'py', label: 'TIMING_DATA (-3) และตัวนับ Spill', kind: 'ctl' },
    { dir: 'py', label: 'END_OF_DATA_SECTION (-1)', kind: 'ctl' },
    { dir: 'py', label: 'ค่าของ Accumulator', kind: 'meta' },
    { dir: 'py', label: 'END_OF_STREAM (-4) ตอบกลับ', kind: 'ctl' },
  ],
  error: [
    { dir: 'py', label: 'PYTHON_EXCEPTION_THROWN (-2)', kind: 'bad' },
    { dir: 'py', label: 'ข้อความ traceback', kind: 'bad' },
  ],
  crash: [],
};

const HEAD_EN: Row[] = [
  { dir: 'jvm', label: 'index of the partition', kind: 'meta', reads: 'split_index' },
  { dir: 'jvm', label: 'Python version', kind: 'meta', reads: 'check_python_version' },
  { dir: 'jvm', label: 'TaskContext (JSON)', kind: 'meta', reads: 'read the task context' },
  { dir: 'jvm', label: 'Spark files / includes', kind: 'meta', reads: 'setup_spark_files' },
  { dir: 'jvm', label: 'broadcast variables', kind: 'meta', reads: 'setup_broadcasts' },
  { dir: 'jvm', label: 'evalType (100, 101, 200 ...)', kind: 'meta', reads: 'eval_type' },
  { dir: 'jvm', label: 'runnerConf', kind: 'meta', reads: 'RunnerConf' },
  { dir: 'jvm', label: 'evalConf', kind: 'meta', reads: 'EvalConf' },
  { dir: 'jvm', label: 'writeCommand: the pickled function', kind: 'meta', reads: 'read_udfs: unpickles it' },
  { dir: 'jvm', label: 'flush, then send the data', kind: 'ctl', mid: true },
  { dir: 'jvm', label: 'data batch 1 (4 rows)', kind: 'data', reads: 'load_stream, then call func' },
];
const TAIL_EN: Record<Mode, Row[]> = {
  ok: [
    { dir: 'jvm', label: 'data batch 2 (4 rows)', kind: 'data' },
    { dir: 'py', label: 'result of batch 1', kind: 'data' },
    { dir: 'py', label: 'result of batch 2', kind: 'data' },
    { dir: 'jvm', label: 'END_OF_STREAM (-4)', kind: 'ctl' },
    { dir: 'py', label: 'TIMING_DATA (-3) and spill counters', kind: 'ctl' },
    { dir: 'py', label: 'END_OF_DATA_SECTION (-1)', kind: 'ctl' },
    { dir: 'py', label: 'accumulator values', kind: 'meta' },
    { dir: 'py', label: 'END_OF_STREAM (-4) as the reply', kind: 'ctl' },
  ],
  error: [
    { dir: 'py', label: 'PYTHON_EXCEPTION_THROWN (-2)', kind: 'bad' },
    { dir: 'py', label: 'traceback text', kind: 'bad' },
  ],
  crash: [],
};
const HEADS: Record<Lang, Row[]> = { th: HEAD_TH, en: HEAD_EN };
const TAILS: Record<Lang, Record<Mode, Row[]>> = { th: TAIL_TH, en: TAIL_EN };

const ROW_H = 24;
const TOP = 96;
const XJ = 210;
const XP = 640;
const STEP = 0.5;

const MODES: { id: Mode }[] = [{ id: 'ok' }, { id: 'error' }, { id: 'crash' }];

const TEXT: Record<Lang, {
  modeLabel: Record<Mode, string>; title: string; groupLabel: string; svgLabel: string; readsAs: string; workerDies: string; eof: string; pyExc: string; okReply: string;
  caption: string;
  handshake: { name: string; title: string; text: string };
  data: { name: string; title: string; text: string };
  back: { name: string; title: string; text: string };
  error: { name: string; title: string; text: string };
  crash: { name: string; title: string; text: string };
  close: { name: string; title: string; text: string };
}> = {
  th: {
    modeLabel: { ok: 'ทำงานปกติ', error: 'ฟังก์ชันของเรา raise error', crash: 'Python ตายเอง' },
    title: 'JVM กับ Python Worker คุยกันอย่างไรใน Task หนึ่งตัว', groupLabel: 'สถานการณ์', svgLabel: 'แผนภาพลำดับข้อความระหว่าง JVM และ Python Worker',
    readsAs: 'Worker อ่านเป็น', workerDies: 'Worker ตาย',
    eof: 'JVM อ่านเจอ EOF: SparkException "Python worker exited unexpectedly (crashed)"', pyExc: 'JVM: PythonException (PYTHON_EXCEPTION, SQLSTATE 38000) แล้ว Job ล้ม',
    okReply: 'ได้ -4 ตอบกลับมา JVM จึงคืน Worker เข้า Idle Pool เพื่อใช้ซ้ำได้',
    caption: 'ลำดับของข้อมูลประกอบ 9 อย่าง ค่าตัวคั่น (-1 ถึง -6) และเส้นทาง Error อ่านมาจากซอร์ส Spark 4.2.0 (บรรทัดอยู่ในตารางด้านบน) ส่วน Error แบบ raise ในฟังก์ชันเราตรวจด้วย exercises/08_udf.py (PythonException, SQLSTATE 38000) ภาพนี้ใช้ 4 แถวต่อ Batch เพื่อให้มองเห็นง่าย ซึ่งค่าจริงคือ 100 หรือ 10,000 และกรณีที่ Python ตายเองเรายังไม่ได้ทดสอบ',
    handshake: { name: 'handshake', title: 'ก่อนส่งข้อมูล JVM จะส่งข้อมูลประกอบ 9 อย่างตามลำดับตายตัว', text: 'ใน Task หนึ่งตัว PythonRunner จะขอ Worker แล้ว Writer.open จะเขียน 9 ค่านี้ลง Socket ส่วนฝั่ง Python ก็อ่านตามลำดับเดียวกันใน worker.py (ป้ายด้านขวา) ถ้าสองฝั่งลำดับไม่ตรงกัน ทุกอย่างหลังจากนั้นก็จะถูกอ่านผิดไปหมด' },
    data: { name: 'ข้อมูล', title: 'หลัง flush แล้วถึงส่งแถวจริงเป็น Batch', text: 'Batch ของ Python UDF แบบ Pickle คือ 100 แถว ส่วนของ Arrow คือ 10,000 แถว (ภาพใช้ 4 แถว) Worker จะอ่าน Batch แล้วเรียกฟังก์ชัน' },
    back: { name: 'ผลกลับ', title: 'ผลถูกส่งกลับเป็น Batch ผ่าน Socket เดียวกัน', text: 'JVM อ่านผลกลับมาเป็น InternalRow และตรวจชนิดเทียบกับที่ประกาศไว้ (Arrow ตรวจแล้วจะ Error ถ้าไม่ตรง)' },
    error: { name: 'error', title: 'ฟังก์ชัน raise: Worker เขียน -2 แล้วตามด้วย Traceback', text: 'Worker จับ Exception (handle_worker_exception) แล้วเขียน PYTHON_EXCEPTION_THROWN ตามด้วยข้อความ Traceback จากนั้นก็ออกไป JVM เห็น -2 จึงสร้าง PythonException (error class PYTHON_EXCEPTION, SQLSTATE 38000) และ Job ล้มด้วย "Task N in stage 0.0 failed 1 times" ใน Local mode' },
    crash: { name: 'ตาย', title: 'Python ตายเอง (เช่น segfault หรือถูก OOM kill): ไม่มี -2', text: 'Worker ไม่มีโอกาสเขียนอะไรเลย JVM จึงอ่านเจอ EOF แล้ว throw SparkException "Python worker exited unexpectedly (crashed)" (เรายังไม่ได้ทดสอบกรณีนี้ อ่านมาจาก PythonRunner.scala:686-712)' },
    close: { name: 'ปิดงาน', title: 'Worker ส่งสถิติและ Accumulator แล้วรอ END_OF_STREAM ของ JVM', text: 'เมื่อได้ -4 จาก JVM แล้ว Worker จะตอบ -4 กลับ JVM จึงคืน Worker เข้า Pool เพื่อใช้ซ้ำใน Task ถัดไป (ถ้า Worker ตอบ END_OF_DATA_SECTION แทน จะไม่ถูกใช้ซ้ำ ดูหัวข้อ Daemon)' },
  },
  en: {
    modeLabel: { ok: 'Normal run', error: 'Our function raises an error', crash: 'Python crashes' },
    title: 'How the JVM and a Python worker talk during one task', groupLabel: 'Scenario', svgLabel: 'Sequence diagram of the messages between the JVM and the Python worker',
    readsAs: 'worker reads it as', workerDies: 'worker dies',
    eof: 'JVM reads EOF: SparkException "Python worker exited unexpectedly (crashed)"', pyExc: 'JVM: PythonException (PYTHON_EXCEPTION, SQLSTATE 38000), then the job fails',
    okReply: 'Gets -4 as the reply: the JVM returns the worker to the idle pool for reuse',
    caption: 'The order of the 9 setup values, the separator values (-1 to -6) and the error path are read from the Spark 4.2.0 source (the lines are in the table above). The error raised in a function was checked with exercises/08_udf.py (PythonException, SQLSTATE 38000). The picture uses 4 rows per batch so that you can see them. The real size is 100 or 10,000. The case where Python crashes by itself was not tested.',
    handshake: { name: 'handshake', title: 'Before any data, the JVM sends 9 setup values in a fixed order', text: 'For each task, PythonRunner asks for a worker and Writer.open writes these 9 values to the socket. The Python side reads them in the same order in worker.py (the labels on the right). If the two sides disagree on the order, everything after that is read wrongly.' },
    data: { name: 'Data', title: 'Only after the flush are the real rows sent, in batches', text: 'A batch of a pickle-based Python UDF is 100 rows, and for Arrow it is 10,000 rows (the picture uses 4 rows). The worker reads a batch and calls the function.' },
    back: { name: 'Results back', title: 'Results are sent back as batches through the same socket', text: 'The JVM reads the results back as InternalRow and checks the types against the declared ones (Arrow checks and raises an error if they differ).' },
    error: { name: 'error', title: 'The function raises: the worker writes -2, then a traceback', text: 'The worker catches the exception (handle_worker_exception), writes PYTHON_EXCEPTION_THROWN, then the traceback text, then exits. The JVM sees -2, so it builds a PythonException (error class PYTHON_EXCEPTION, SQLSTATE 38000) and the job fails with "Task N in stage 0.0 failed 1 times" in local mode.' },
    crash: { name: 'Crash', title: 'Python dies by itself (for example a segfault or an OOM kill): there is no -2', text: 'There is no chance to write anything. The JVM reads EOF, so it throws SparkException "Python worker exited unexpectedly (crashed)" (this case was not tested, it is read from PythonRunner.scala:686-712).' },
    close: { name: 'Closing', title: 'The worker sends statistics and accumulators, then waits for END_OF_STREAM from the JVM', text: 'When it gets -4 from the JVM, the worker answers -4. Then the JVM returns the worker to the pool so the next task can reuse it (if the worker answers END_OF_DATA_SECTION instead, it is not reused, see the Daemon section).' },
  },
};

export default function HandshakeLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const HEAD = HEADS[lang];
  const TAIL = TAILS[lang];
  const [mode, setMode] = useState<Mode>('ok');
  const clock = useClock(14);
  const { t } = clock;
  const rows = useMemo(() => [...HEAD, ...TAIL[mode]], [HEAD, TAIL, mode]);
  const start = (i: number) => 0.4 + i * STEP;
  const total = start(rows.length) + 1.5;
  const firstData = HEAD.findIndex((r) => r.kind === 'data');
  const firstBack = rows.findIndex((r) => r.dir === 'py');

  const marks: Mark[] = [
    { at: 0, ...T.handshake },
    { at: start(firstData), ...T.data },
    mode === 'ok'
      ? { at: start(firstBack), ...T.back }
      : mode === 'error'
        ? { at: start(firstBack), ...T.error }
        : { at: start(HEAD.length), ...T.crash },
    ...(mode === 'ok' ? [{ at: start(rows.length - 3), ...T.close }] : []),
  ];

  return (
    <figure className="viz lg">
      <div className="viz-title">{T.title}</div>
      <div className="viz-steps" role="group" aria-label={T.groupLabel}>
        {MODES.map((m) => (
          <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => { setMode(m.id); clock.restart(); }}>{T.modeLabel[m.id]}</button>
        ))}
      </div>
      <div className="viz-box">
        <svg viewBox={`0 0 880 ${TOP + 22 * ROW_H + 40}`} role="img" aria-label={T.svgLabel}>
          <defs>
            <marker id="hs-a1" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="var(--k1)" /></marker>
            <marker id="hs-a2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="var(--k2)" /></marker>
            <marker id="hs-a3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="var(--accent)" /></marker>
          </defs>
          <rect className="band" x="10" y="10" width="860" height={TOP + 22 * ROW_H + 20} rx="12" />

          <g>
            <rect className="fx-hot" x={XJ - 120} y="26" width="240" height="38" rx="9" />
            <text className="b" x={XJ} y="43" textAnchor="middle">JVM (executor)</text>
            <text className="s m" x={XJ} y="58" textAnchor="middle">PythonRunner, Writer.open</text>
            <rect className="fx-file" x={XP - 120} y="26" width="240" height="38" rx="9" />
            <text className="b" x={XP} y="43" textAnchor="middle">Python worker</text>
            <text className="s m" x={XP} y="58" textAnchor="middle">worker.py: main()</text>
          </g>
          <line x1={XJ} x2={XJ} y1="68" y2={TOP + (rows.length + 1) * ROW_H} stroke="var(--line-strong)" strokeWidth="2" strokeDasharray="5 5" />
          <line x1={XP} x2={XP} y1="68" y2={TOP + (rows.length + 1) * ROW_H} stroke="var(--line-strong)" strokeWidth="2" strokeDasharray="5 5" />
          <text className="s" x={XP + 130} y="86">{T.readsAs}</text>

          {rows.map((r, i) => {
            const y = TOP + i * ROW_H;
            const p = smooth(prog(t, start(i), start(i) + STEP * 0.9));
            if (p <= 0) return null;
            const bad = r.kind === 'bad';
            const color = bad ? 'var(--accent)' : r.dir === 'jvm' ? 'var(--k1)' : 'var(--k2)';
            const marker = bad ? 'url(#hs-a3)' : r.dir === 'jvm' ? 'url(#hs-a1)' : 'url(#hs-a2)';
            const x0 = r.dir === 'jvm' ? XJ : XP;
            const x1 = r.dir === 'jvm' ? XP : XJ;
            const xe = x0 + (x1 - x0) * p;
            if (r.mid) {
              return (
                <g key={i} opacity={p}>
                  <line x1={XJ - 150} x2={XP + 150} y1={y} y2={y} stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="3 4" />
                  <text className="s b acc" x={(XJ + XP) / 2} y={y - 3} textAnchor="middle">{r.label}</text>
                </g>
              );
            }
            return (
              <g key={i}>
                <text className="s m" x="26" y={y + 4} opacity={p}>{i < 9 ? i + 1 : ''}</text>
                <line x1={x0} x2={xe} y1={y} y2={y} stroke={color} strokeWidth={r.kind === 'data' ? 5 : 2.5} strokeLinecap="round" markerEnd={p >= 0.98 ? marker : undefined} strokeDasharray={r.kind === 'ctl' ? '7 4' : undefined} />
                <text className={r.kind === 'ctl' || bad ? 's b m' : 's'} x={(XJ + XP) / 2} y={y - 5} textAnchor="middle" opacity={p} style={{ fill: bad ? 'var(--accent)' : undefined }}>{r.label}</text>
                {r.reads && r.dir === 'jvm' && p >= 0.98 && (
                  <text className="s m" x={XP + 14} y={y + 4} style={{ fill: 'var(--k2)' }}>{r.reads}</text>
                )}
              </g>
            );
          })}

          {mode === 'crash' && t >= start(HEAD.length) && (
            <g transform={`translate(${XP} ${TOP + HEAD.length * ROW_H})`} opacity={smooth(prog(t, start(HEAD.length), start(HEAD.length) + 0.6))}>
              <circle r="16" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="2.5" />
              <line x1="-8" y1="-8" x2="8" y2="8" stroke="var(--accent)" strokeWidth="3" />
              <line x1="-8" y1="8" x2="8" y2="-8" stroke="var(--accent)" strokeWidth="3" />
              <text className="s b acc" x="26" y="4">{T.workerDies}</text>
            </g>
          )}
          {mode === 'crash' && t >= start(HEAD.length) + 0.7 && (
            <g transform={`translate(${XJ} ${TOP + (HEAD.length + 1) * ROW_H})`}>
              <text className="s b acc" x="-100" y="4">{T.eof}</text>
            </g>
          )}
          {mode === 'error' && t >= start(rows.length) && (
            <g transform={`translate(${XJ} ${TOP + (rows.length + 0.3) * ROW_H})`} opacity={smooth(prog(t, start(rows.length), start(rows.length) + 0.6))}>
              <text className="s b acc" x="-100" y="4">{T.pyExc}</text>
            </g>
          )}
          {mode === 'ok' && t >= start(rows.length) && (
            <g transform={`translate(${XJ} ${TOP + (rows.length + 0.3) * ROW_H})`} opacity={smooth(prog(t, start(rows.length), start(rows.length) + 0.6))}>
              <text className="s b" x="-100" y="4" style={{ fill: 'var(--k2)' }}>{T.okReply}</text>
            </g>
          )}
        </svg>
      </div>
      <ClockControls clock={{ ...clock, duration: total } as typeof clock} marks={marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
