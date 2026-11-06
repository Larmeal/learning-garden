import { useMemo, useState } from 'react';
import { ClockControls, prog, smooth, useClock, type Lang, type Mark } from './timeline';

// A micro-batch writes offsets/N before it runs and commits/N after it ran, each through a temporary file that is
// renamed (HDFSMetadataLog.add -> CheckpointFileManager.createAtomic). On restart populateStartOffsets compares the two
// logs (MicroBatchExecution.scala:743): offsets/N without commits/N means "run batch N again with the offsets in the
// file". Sources: HDFSMetadataLog.scala:51, MicroBatchExecution.scala:743 and 909-1013 and 1406-1530. Measured
// (exercises/09_streaming.py, replay_and_state): deleting commits/1 and restarting re-runs batch 1 and the state of the
// aggregation carries over (a is still 2, not reset). The five crash points and the picture of the sink are the lesson's
// own reasoning, only the commits/1 case was run.

type Crash = 'a' | 'b' | 'c' | 'd' | 'e';
const CRASHES: { id: Crash; at: number; hasOffsets: boolean; sinkWritten: boolean }[] = [
  { id: 'a', at: 0.1, hasOffsets: false, sinkWritten: false },
  { id: 'b', at: 0.6, hasOffsets: false, sinkWritten: false },
  { id: 'c', at: 1.8, hasOffsets: true, sinkWritten: false },
  { id: 'd', at: 3.1, hasOffsets: true, sinkWritten: true },
  { id: 'e', at: 3.5, hasOffsets: true, sinkWritten: true },
];
const TEXT: Record<Lang, {
  crashLabels: Record<Crash, string>;
  stepLabel: string[];
  title: string;
  crashGroup: string;
  idemBtn: (on: boolean) => string;
  svgLabel: string;
  headRun2Replay: string;
  headRun2New: string;
  headRun1: string;
  skipped: string;
  crashedHere: string;
  finished: string;
  active: string;
  waiting: string;
  processCrashed: (label: string) => string;
  latestOffsets: string;
  latestCommits: string;
  replayVerdict: string;
  freshVerdict: string;
  checkpointOnDisk: string;
  tmpLegend: string;
  sinkTitle: string;
  sinkDupNote: string;
  sinkIdemNote: string;
  mark0: { name: string; title: string; text: string };
  crashName: string;
  crashTitle: (label: string) => string;
  crashText: Record<Crash, string>;
  restartName: string;
  restartTitle: string;
  restartReplay: string;
  restartFresh: string;
  resultName: string;
  resultDup: string;
  resultOnce: string;
  resultIdem: string;
  resultNotIdem: string;
  resultNone: string;
  caption: string;
}> = {
  th: {
    crashLabels: { a: 'ก่อนเขียน offsets/2', b: 'กลางการเขียน offsets/2', c: 'ระหว่างประมวลผล', d: 'หลังเขียน sink ก่อน commit', e: 'กลางการเขียน commits/2' },
    stepLabel: ['1 เขียน offsets/2 (ช่วงข้อมูลของ batch)', '2 ประมวลผล: อ่าน state, รวม, เขียน state และ sink', '3 เขียน commits/2'],
    title: 'ล่มตรงไหนของ batch ก็กลับมาถูกต้อง: checkpoint สองไฟล์ต่อ batch',
    crashGroup: 'จุดที่ล่ม',
    idemBtn: (on) => `sink idempotent: ${on ? 'ใช่' : 'ไม่'}`,
    svgLabel: 'ขั้นตอนของ batch 2, ไฟล์ใน checkpoint และ sink ก่อนและหลังล่ม',
    headRun2Replay: 'หลังรีสตาร์ท: รัน batch 2 ซ้ำ',
    headRun2New: 'หลังรีสตาร์ท: สร้าง batch 2 ใหม่',
    headRun1: 'ก่อนล่ม: batch 2',
    skipped: 'ข้าม: มี offsets/2 อยู่แล้ว',
    crashedHere: 'ล่มตรงนี้',
    finished: 'เสร็จ',
    active: 'กำลังทำ',
    waiting: 'รอ',
    processCrashed: (label) => `process ล่ม (${label})`,
    latestOffsets: 'offsets/ ล่าสุด:',
    latestCommits: 'commits/ ล่าสุด: 1',
    replayVerdict: 'มี offsets/2 ไม่มี commits/2: รันซ้ำ',
    freshVerdict: 'ไม่มี batch ค้าง: สร้าง batch 2 ใหม่',
    checkpointOnDisk: 'checkpoint บน disk',
    tmpLegend: 'tmp = ไฟล์ชั่วคราวก่อน rename   .d = .delta ของ state',
    sinkTitle: 'sink (ผลที่ลูกค้าเห็น)',
    sinkDupNote: 'batch 2 ซ้ำสองชุด: ไม่ idempotent',
    sinkIdemNote: 'เขียนซ้ำแล้วผลเท่าเดิม',
    mark0: { name: 'batch 2 เริ่ม', title: 'batch 2 ทำสามอย่างตามลำดับ และสองอย่างเขียน checkpoint', text: 'offsets/N ถูกเขียนก่อนประมวลผล เพื่อจดว่า batch นี้อ่านช่วงข้อมูลไหน commits/N ถูกเขียนหลังจบ ทั้งสองเขียนเป็นไฟล์ชั่วคราวแล้ว rename (createAtomic) ผู้อ่านจึงเห็นไฟล์ N แบบครบหรือไม่เห็นเลย ไม่มีแบบครึ่งๆ' },
    crashName: 'ล่ม',
    crashTitle: (label) => `ล่ม ${label}`,
    crashText: { a: 'ยังไม่มีอะไรของ batch 2 บน disk', b: 'มีแค่ไฟล์ชั่วคราว ซึ่งไม่ใช่ชื่อ 2 ผู้อ่านไม่นับว่ามี offsets/2', c: 'offsets/2 อยู่แล้ว แต่ผลยังไม่ถึง sink', d: 'sink ได้ข้อมูลของ batch 2 ไปแล้ว แต่ commits/2 ยังไม่ถูกเขียน นี่คือจุดที่อันตรายที่สุด', e: 'commits/2 มีแค่ไฟล์ชั่วคราว ยังไม่ใช่ชื่อ 2' },
    restartName: 'รีสตาร์ท',
    restartTitle: 'populateStartOffsets อ่านทั้ง offsets/ และ commits/',
    restartReplay: 'เจอ offsets/2 แต่ไม่เจอ commits/2 แปลว่า batch 2 เริ่มแล้วแต่ไม่รู้ว่าจบไหม Spark จึงรัน batch 2 ซ้ำด้วยช่วง offset ใน offsets/2 (ผลต้องเหมือนเดิม) state โหลดจากเวอร์ชันของ batch 1 ไม่ถูกบวกซ้ำ (วัดจริง: ลบ commits/1 แล้วรีสตาร์ท batch 1 ถูกรันซ้ำ และ state ของ a ยังเป็น 2)',
    restartFresh: 'ไม่เจอ offsets/2 (ไฟล์ชั่วคราวไม่นับ) จึงไม่มี batch 2 ค้าง Spark ถาม source ใหม่ว่ามีข้อมูลถึงไหน แล้วสร้าง batch 2 ตามปกติ',
    resultName: 'ผลลัพธ์',
    resultDup: 'sink ได้ข้อมูลของ batch 2 สองครั้ง',
    resultOnce: 'batch 2 จบสมบูรณ์ครั้งเดียว',
    resultIdem: 'sink เขียนด้วย batch id เป็นตัวกำหนด จึงเขียนซ้ำได้ผลเหมือนเดิม นี่คือสัญญาข้อที่สามที่ Spark ฝากไว้ที่ sink (idempotent)',
    resultNotIdem: 'Spark ไม่รู้ว่า sink รับข้อมูลไปแล้ว จึงเขียนซ้ำ ถ้า sink ไม่ idempotent จะมีแถวซ้ำ ลองเปิดตัวเลือก idempotent ดู (นี่คือเหตุผลที่สัญญา exactly-once ต้องการ sink ที่รับ batch id)',
    resultNone: 'ก่อนล่มยังไม่มีอะไรไปถึง sink จึงไม่มีอะไรซ้ำ',
    caption: 'ลำดับ offsets, ประมวลผล, commits และการ rename ไฟล์ชั่วคราวอ่านจาก HDFSMetadataLog และ MicroBatchExecution (Spark 4.2.0) กรณีที่รันจริงคือลบ commits/1 แล้วรีสตาร์ท (exercises/09_streaming.py: batch ถูกรันซ้ำ และ state ไม่ถูกรีเซ็ต) ห้าจุดที่ล่มในภาพเป็นการไล่เหตุผลจากลำดับนั้น ยังไม่ได้ทดสอบทีละจุด',
  },
  en: {
    crashLabels: { a: 'before writing offsets/2', b: 'while writing offsets/2', c: 'during processing', d: 'after the sink write, before commit', e: 'while writing commits/2' },
    stepLabel: ['1 Write offsets/2 (the batch range)', '2 Process: read state, aggregate, write state, sink', '3 Write commits/2'],
    title: 'A crash anywhere in a batch still recovers correctly: two checkpoint files per batch',
    crashGroup: 'Crash point',
    idemBtn: (on) => `idempotent sink: ${on ? 'yes' : 'no'}`,
    svgLabel: 'Steps of batch 2, files in the checkpoint and the sink before and after the crash',
    headRun2Replay: 'After restart: run batch 2 again',
    headRun2New: 'After restart: plan a new batch 2',
    headRun1: 'Before the crash: batch 2',
    skipped: 'Skipped: offsets/2 already exists',
    crashedHere: 'Crashed here',
    finished: 'Done',
    active: 'Running',
    waiting: 'Waiting',
    processCrashed: (label) => `Process crashed (${label})`,
    latestOffsets: 'latest offsets/:',
    latestCommits: 'latest commits/: 1',
    replayVerdict: 'offsets/2 but no commits/2: run again',
    freshVerdict: 'No pending batch: plan batch 2',
    checkpointOnDisk: 'checkpoint on disk',
    tmpLegend: 'tmp = temporary file before rename   .d = .delta of state',
    sinkTitle: 'sink (what the customer sees)',
    sinkDupNote: 'Batch 2 twice: not idempotent',
    sinkIdemNote: 'Written again, same result',
    mark0: { name: 'batch 2 starts', title: 'Batch 2 does three things in order, and two of them write to the checkpoint', text: 'offsets/N is written before processing, to record which range of data this batch reads. commits/N is written after the batch ends. Both are written as a temporary file and then renamed (createAtomic), so a reader sees file N complete or not at all, never half written.' },
    crashName: 'crash',
    crashTitle: (label) => `Crash ${label}`,
    crashText: { a: 'Nothing of batch 2 is on disk yet.', b: 'Only a temporary file exists. It does not have the name 2, so readers do not count it as offsets/2.', c: 'offsets/2 exists, but the result has not reached the sink.', d: 'The sink already has the data of batch 2, but commits/2 was not written. This is the most dangerous point.', e: 'commits/2 exists only as a temporary file, not yet under the name 2.' },
    restartName: 'restart',
    restartTitle: 'populateStartOffsets reads both offsets/ and commits/',
    restartReplay: 'It finds offsets/2 but no commits/2. That means batch 2 started and nobody knows if it finished. So Spark runs batch 2 again with the offset range in offsets/2 (the result must be the same). The state is loaded from the version of batch 1, so nothing is added twice (measured: after deleting commits/1 and restarting, batch 1 is run again and the state of a is still 2).',
    restartFresh: 'It does not find offsets/2 (a temporary file does not count), so no batch 2 is pending. Spark asks the source again how far the data goes and plans batch 2 as usual.',
    resultName: 'result',
    resultDup: 'The sink got the data of batch 2 twice',
    resultOnce: 'Batch 2 finished cleanly, once',
    resultIdem: 'The sink writes keyed by batch id, so writing again gives the same result. This is the third promise that Spark leaves to the sink (idempotent).',
    resultNotIdem: 'Spark does not know the sink already took the data, so it writes again. If the sink is not idempotent there are duplicate rows. Try turning on the idempotent option (this is why the exactly-once promise needs a sink that accepts a batch id).',
    resultNone: 'Before the crash nothing reached the sink, so nothing is duplicated.',
    caption: 'The order of offsets, processing, commits and the rename of temporary files is read from HDFSMetadataLog and MicroBatchExecution (Spark 4.2.0). The case that was run is deleting commits/1 and restarting (exercises/09_streaming.py: the batch is run again and the state is not reset). The five crash points in the picture follow from that order by reasoning and were not tested one by one.',
  },
};
const DURATION = 13;
const FIRST = 0.5;

interface Op {
  at: number;
  kind: 'tmpOff' | 'offsets' | 'state' | 'sink' | 'tmpCommit' | 'commits';
}
function runOps(start: number, needOffsets: boolean, cut: number | null): { ops: Op[]; steps: { step: number; from: number; to: number }[] } {
  const ops: Op[] = [];
  const steps: { step: number; from: number; to: number }[] = [];
  let base = start;
  if (needOffsets) {
    ops.push({ at: base + 0.3, kind: 'tmpOff' }, { at: base + 0.9, kind: 'offsets' });
    steps.push({ step: 0, from: base, to: base + 1 });
    base += 1;
  }
  ops.push({ at: base + 1.2, kind: 'state' }, { at: base + 1.8, kind: 'sink' });
  steps.push({ step: 1, from: base, to: base + 2 });
  ops.push({ at: base + 2.2, kind: 'tmpCommit' }, { at: base + 2.8, kind: 'commits' });
  steps.push({ step: 2, from: base + 2, to: base + 3 });
  if (cut == null) return { ops, steps };
  return { ops: ops.filter((o) => o.at <= cut), steps: steps.map((s) => ({ ...s, to: Math.min(s.to, cut) })).filter((s) => s.from < cut) };
}


export default function CheckpointCrashLab({ lang = 'th' }: { lang?: Lang }) {
  const L = TEXT[lang];
  const [crash, setCrash] = useState<Crash>('d');
  const [idem, setIdem] = useState(false);
  const clock = useClock(DURATION);
  const { t } = clock;
  const c = CRASHES.find((x) => x.id === crash)!;
  const cLabel = L.crashLabels[c.id];

  const plan = useMemo(() => {
    const first = runOps(FIRST, true, FIRST + c.at);
    const crashT = FIRST + c.at;
    const restart = crashT + 1.1;
    const second = runOps(restart + 1.3, !c.hasOffsets, null);
    return { first, crashT, restart, second };
  }, [c]);

  // replay the operations up to the clock time
  const all = [...plan.first.ops.map((o) => ({ ...o, run: 1 })), ...plan.second.ops.map((o) => ({ ...o, run: 2 }))].sort((a, b) => a.at - b.at);
  let offsets2 = false;
  let tmpOff = false;
  let commits2 = false;
  let tmpCommit = false;
  let stateV3 = false;
  let sinkRows = 0;
  let sinkDup = false;
  all.forEach((o) => {
    if (t < o.at) return;
    if (o.kind === 'tmpOff') tmpOff = true;
    if (o.kind === 'offsets') { tmpOff = false; offsets2 = true; }
    if (o.kind === 'state') stateV3 = true;
    if (o.kind === 'sink') {
      if (sinkRows > 0 && !idem) sinkDup = true;
      if (sinkRows === 0 || !idem) sinkRows++;
    }
    if (o.kind === 'tmpCommit') tmpCommit = true;
    if (o.kind === 'commits') { tmpCommit = false; commits2 = true; }
  });

  const crashed = t >= plan.crashT && t < plan.restart + 1.3;
  const inRun2 = t >= plan.restart + 1.3;
  const reading = t >= plan.restart && t < plan.restart + 1.3;
  const cur = inRun2 ? plan.second : plan.first;
  const curStep = cur.steps.filter((s) => t >= s.from).slice(-1)[0];
  const done = commits2;

  const marks: Mark[] = [
    { at: 0, ...L.mark0 },
    { at: plan.crashT, name: L.crashName, title: L.crashTitle(cLabel), text: L.crashText[c.id] },
    { at: plan.restart, name: L.restartName, title: L.restartTitle, text: c.hasOffsets ? L.restartReplay : L.restartFresh },
    {
      at: plan.restart + 1.3 + (c.hasOffsets ? 2.9 : 3.9),
      name: L.resultName,
      title: sinkDup ? L.resultDup : L.resultOnce,
      text: c.sinkWritten ? (idem ? L.resultIdem : L.resultNotIdem) : L.resultNone,
    },
  ];

  const chip = (x: number, y: number, label: string, kind: 'ok' | 'tmp' | 'new' | 'dup') => (
    <g transform={`translate(${x} ${y})`}>
      <rect width="46" height="24" rx="5" className={kind === 'new' ? 'fx-hot' : 'box'} strokeDasharray={kind === 'tmp' ? '4 3' : undefined} stroke={kind === 'dup' ? 'var(--accent)' : undefined} strokeWidth={kind === 'dup' ? 2.5 : undefined} opacity={kind === 'tmp' ? 0.9 : 1} />
      <text className="s m b" x="23" y="16" textAnchor="middle" style={{ fill: kind === 'dup' ? 'var(--accent)' : undefined }}>{label}</text>
    </g>
  );

  return (
    <figure className="viz lg">
      <div className="viz-title">{L.title}</div>
      <div className="viz-steps" role="group" aria-label={L.crashGroup}>
        {CRASHES.map((x) => (
          <button key={x.id} type="button" aria-pressed={crash === x.id} onClick={() => { setCrash(x.id); clock.restart(); }}>{L.crashLabels[x.id]}</button>
        ))}
        <button type="button" aria-pressed={idem} onClick={() => { setIdem((v) => !v); clock.restart(); }}>{L.idemBtn(idem)}</button>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 440" role="img" aria-label={L.svgLabel}>
          <rect className="band" x="10" y="10" width="860" height="420" rx="12" />

          <text className="b" x="28" y="38">{inRun2 ? (c.hasOffsets ? L.headRun2Replay : L.headRun2New) : L.headRun1}</text>
          {L.stepLabel.map((lab, i) => {
            const y = 56 + i * 74;
            const skipped = inRun2 && c.hasOffsets && i === 0;
            const active = curStep?.step === i && !crashed && !reading && !done;
            const finished = !skipped && (inRun2 ? plan.second.steps.some((s) => s.step === i && t >= s.to) : plan.first.steps.some((s) => s.step === i && t >= s.to && !(crashed && t >= plan.crashT)));
            const crashedHere = !inRun2 && crashed && curStep?.step === i;
            return (
              <g key={i} transform={`translate(28 ${y})`}>
                <rect className={crashedHere ? 'box' : active ? 'fx-hot' : 'box'} width="400" height="62" rx="10" stroke={crashedHere ? 'var(--accent)' : undefined} strokeWidth={crashedHere ? 3 : undefined} opacity={skipped ? 0.45 : 1} />
                <text className="b" x="14" y="26" style={{ fontSize: 13 }}>{lab}</text>
                <text className="s b" x="14" y="48" style={{ fill: crashedHere ? 'var(--accent)' : finished ? 'var(--k2)' : active ? 'var(--accent)' : 'var(--muted)' }}>
                  {skipped ? L.skipped : crashedHere ? L.crashedHere : finished ? L.finished : active ? L.active : L.waiting}
                </text>
              </g>
            );
          })}
          {crashed && !reading && (
            <g transform="translate(28 290)">
              <rect className="fx-hot" width="400" height="44" rx="10" stroke="var(--accent)" strokeWidth="3" />
              <text className="b acc" x="14" y="28">{L.processCrashed(cLabel)}</text>
            </g>
          )}
          {reading && (
            <g transform="translate(28 290)" opacity={smooth(prog(t, plan.restart, plan.restart + 0.4))}>
              <rect className="fx-hot" width="400" height="86" rx="10" />
              <text className="b" x="14" y="24">populateStartOffsets</text>
              <text className="s m" x="14" y="46">{L.latestOffsets} {c.hasOffsets ? '2' : '1'}   {L.latestCommits}</text>
              <text className="s b acc" x="14" y="68">{c.hasOffsets ? L.replayVerdict : L.freshVerdict}</text>
            </g>
          )}

          {/* checkpoint folder */}
          <g transform="translate(470 38)">
            <text className="b">{L.checkpointOnDisk}</text>
            <g transform="translate(0 16)">
              <text className="s m" y="18">offsets/</text>
              {[0, 1].map((n) => <g key={n}>{chip(90 + n * 52, 0, String(n), 'ok')}</g>)}
              {offsets2 && chip(194, 0, '2', 'new')}
              {tmpOff && chip(194, 0, 'tmp', 'tmp')}
              <text className="s m" y="64">commits/</text>
              {[0, 1].map((n) => <g key={n}>{chip(90 + n * 52, 46, String(n), 'ok')}</g>)}
              {commits2 && chip(194, 46, '2', 'new')}
              {tmpCommit && chip(194, 46, 'tmp', 'tmp')}
              <text className="s m" y="110">state/</text>
              {[1, 2].map((n, i) => <g key={n}>{chip(90 + i * 52, 92, `${n}.d`, 'ok')}</g>)}
              {stateV3 && chip(194, 92, '3.d', 'new')}
            </g>
            <text className="s" y="150">{L.tmpLegend}</text>

            <g transform="translate(0 190)">
              <text className="b">{L.sinkTitle}</text>
              <g transform="translate(0 14)">
                {chip(0, 0, 'b0', 'ok')}
                {chip(52, 0, 'b1', 'ok')}
                {sinkRows >= 1 && chip(104, 0, 'b2', 'new')}
                {sinkRows >= 2 && chip(156, 0, 'b2', 'dup')}
              </g>
              {sinkDup && <text className="s b acc" y="64">{L.sinkDupNote}</text>}
              {!sinkDup && sinkRows >= 1 && idem && c.sinkWritten && inRun2 && t >= plan.restart + 1.3 + 1.8 && <text className="s b" y="64" style={{ fill: 'var(--k2)' }}>{L.sinkIdemNote}</text>}
            </g>
          </g>
        </svg>
      </div>
      <ClockControls clock={clock} marks={marks} lang={lang} />
      <figcaption className="viz-caption">{L.caption}</figcaption>
    </figure>
  );
}
