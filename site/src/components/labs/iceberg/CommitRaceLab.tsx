import { useState } from 'react';
import { StepControls, useStepper, type Lang, type StepInfo } from '../spark/stepper';
import { Lines, Num } from './ib';

// Shows:      two writers that read the same version, write their own files, and race to change one pointer in the catalog. The second one
//             is refused because the pointer is no longer the version it read. The box on the right shows what is in the table at each step.
// Because:    "a conditional change of the pointer" is a sentence in the lesson. Here the reader sees the check pass for one writer and fail
//             for the other, and what ends up in the table in each case.
// Control:    the step buttons walk through the race; the retry switch changes how writer B ends (retries on: it reads the new version and
//             succeeds, so the table holds both writers' data. Retries off: it gets an error and its data is not in the table).
// Conclusion: nobody overwrites anybody: a commit only succeeds if the catalog still points at the version the writer started from.
//
// Measured in exercises/04_writes_commit.py: with the default settings PyIceberg logged "Commit failed due to a concurrent update, retrying (1/4)"
// and both rows were in the table; with commit.retry.num-retries = 0 it raised CommitFailedException "branch main has changed: expected id ...,
// found ...". The version names (v3, v4, v5) are drawn to fit.

const TEXT: Record<Lang, {
  title: string; retry: string; on: string; off: string; writer: (n: string) => string; catalog: string; pointer: string;
  table: string; old: string; dataOf: (n: string) => string; inTable: string; notYet: string; lost: string;
  a: string[]; b: (retry: boolean) => string[];
  check: (from: string, to: string) => string; ok: string; bad: (now: string) => string;
  steps: (retry: boolean) => StepInfo[]; caption: string;
}> = {
  th: {
    title: 'Writer สองคนอ่านตารางเวอร์ชันเดียวกัน แล้วแย่งกันเปลี่ยนตัวชี้ใน Catalog ลองดูว่าใครสำเร็จและใครต้องทำใหม่',
    retry: 'การลองใหม่ (Retry)', on: 'เปิด (ค่าเริ่มต้น)', off: 'ปิด', writer: (n) => `Writer ${n}`, catalog: 'Catalog', pointer: 'ตัวชี้ตอนนี้',
    table: 'ข้อมูลในตารางตอนนี้', old: 'ข้อมูลเดิม (v3)', dataOf: (n) => `ข้อมูลของ ${n}`, inTable: 'อยู่ในตาราง', notYet: 'ยังไม่อยู่ในตาราง', lost: 'ไม่อยู่ในตาราง (ต้องทำใหม่เอง)',
    a: ['อ่านตารางที่ v3', 'เขียนไฟล์ของ A แล้ว (ยังไม่มีใครเห็น)', 'Commit สำเร็จ ✓', 'จบแล้ว', 'จบแล้ว'],
    b: (retry) => ['อ่านตารางที่ v3', 'เขียนไฟล์ของ B แล้ว (ยังไม่มีใครเห็น)', 'รอ Commit ต่อจาก A', 'Commit ถูกปฏิเสธ ✗', retry ? 'อ่าน v4 แล้วลองใหม่ → สำเร็จ ✓' : 'ได้ Error ✗ ต้องเรียก refresh() เอง'],
    check: (f, t) => `Catalog ตรวจ: ถ้าตัวชี้ยังเป็น ${f} ให้เปลี่ยนเป็น ${t}`, ok: 'ผ่าน ✓ เปลี่ยนตัวชี้ได้', bad: (now) => `ไม่ผ่าน ✗ ตัวชี้เป็น ${now} ไปแล้ว`,
    steps: (retry) => [
      { name: 'อ่าน', title: 'ทั้งสองคนอ่านตารางที่เวอร์ชัน v3', text: 'A และ B เปิดตารางพร้อมกัน ทั้งคู่เห็นตัวชี้ใน Catalog เป็น v3 และต่างจำไว้ว่า "ฉันเริ่มจาก v3"' },
      { name: 'เขียน', title: 'ต่างคนต่างเขียนไฟล์ของตัวเอง', text: 'A เขียน Data File ของ A และ Metadata File ฉบับร่างที่ต่อจาก v3 B ก็ทำแบบเดียวกัน ตอนนี้ยังไม่มีใครเปลี่ยน Catalog ผู้อ่านเลยยังเห็นแค่ v3' },
      { name: 'A Commit', title: 'A ขอเปลี่ยนตัวชี้ก่อน และสำเร็จ', text: 'A ส่งคำขอว่า "ถ้าตัวชี้ยังเป็น v3 ให้เปลี่ยนเป็นฉบับของฉัน" ซึ่งตัวชี้ยังเป็น v3 อยู่ Catalog จึงเปลี่ยนให้ ตัวชี้กลายเป็น v4 (ของ A) และข้อมูลของ A เข้าตาราง' },
      { name: 'B Commit', title: 'B ขอเปลี่ยนบ้าง แต่ถูกปฏิเสธ', text: 'B ส่งคำขอแบบเดียวกันว่า "ถ้าตัวชี้ยังเป็น v3" แต่ตัวชี้เป็น v4 ของ A ไปแล้ว Catalog จึงไม่เปลี่ยนอะไรเลย และเพราะแบบนี้ B ถึงเขียนทับของ A ไม่ได้' },
      retry
        ? { name: 'B ลองใหม่', title: 'B อ่าน v4 แล้วเขียนต่อจากมัน และสำเร็จ', text: 'PyIceberg ลองใหม่เอง (Log: Commit failed due to a concurrent update, retrying 1/4) B อ่านตารางที่ v4 เขียน Metadata File ใหม่ต่อจาก v4 แล้วขอเปลี่ยน "ถ้าตัวชี้ยังเป็น v4" ซึ่งครั้งนี้สำเร็จ และได้ v5 ที่มีข้อมูลของทั้งสองคน' }
        : { name: 'B ล้มเหลว', title: 'B ได้ Error และข้อมูลของ B ยังไม่อยู่ในตาราง', text: 'เมื่อปิด Retry (commit.retry.num-retries = 0) B ได้ CommitFailedException ว่า branch main has changed: expected id ..., found ... Data File ของ B มีอยู่บนดิสก์ แต่ยังไม่มี Snapshot ไหนอ้างถึง เราต้องเรียก refresh() แล้วเขียนใหม่เอง' },
    ],
    caption: 'วัดจริงในแบบฝึก 04 ทั้งสองกรณี (ชื่อเวอร์ชันในภาพวาดขึ้นเอง) ฝั่ง Spark และ Java ก็ลองใหม่เองได้เหมือนกัน โดยค่าเริ่มต้นคือ 4 รอบ',
  },
  en: {
    title: 'Two writers read the same version and race to change the pointer in the catalog. See who succeeds and who has to redo the work',
    retry: 'Retry', on: 'on (default)', off: 'off', writer: (n) => `Writer ${n}`, catalog: 'Catalog', pointer: 'pointer now',
    table: 'What is in the table now', old: 'Existing data (v3)', dataOf: (n) => `Data of ${n}`, inTable: 'in the table', notYet: 'not in the table yet', lost: 'not in the table (redo it yourself)',
    a: ['read the table at v3', 'wrote A’s files (nobody sees them)', 'Commit succeeded ✓', 'done', 'done'],
    b: (retry) => ['read the table at v3', 'wrote B’s files (nobody sees them)', 'waiting to commit after A', 'Commit refused ✗', retry ? 'reads v4 and retries → succeeds ✓' : 'gets an error ✗ and must call refresh()'],
    check: (f, t) => `Catalog checks: if the pointer is still ${f}, change it to ${t}`, ok: 'passes ✓ pointer changed', bad: (now) => `fails ✗ the pointer is already ${now}`,
    steps: (retry) => [
      { name: 'read', title: 'Both read the table at version v3', text: 'A and B open the table at the same time. Both see the pointer in the catalog as v3, and both remember "I started from v3".' },
      { name: 'write', title: 'Each writes its own files', text: 'A writes its data file and a draft metadata file that continues v3. B does the same. Nobody has changed the catalog yet, so readers still see v3.' },
      { name: 'A commits', title: 'A asks to change the pointer first, and succeeds', text: 'A sends "if the pointer is still v3, change it to my version". It is still v3, so the catalog changes it. The pointer is v4 (A’s) and A’s data is in the table.' },
      { name: 'B commits', title: 'B asks too, and is refused', text: 'B sends the same kind of request, "if the pointer is still v3", but the pointer is already A’s v4. The catalog changes nothing. This is why B cannot overwrite A.' },
      retry
        ? { name: 'B retries', title: 'B reads v4, writes on top of it, and succeeds', text: 'PyIceberg retries by itself (log: Commit failed due to a concurrent update, retrying 1/4). B reads the table at v4, writes a new metadata file on top of v4 and asks "if the pointer is still v4". This time it works, and v5 holds the data of both writers.' }
        : { name: 'B fails', title: 'B gets an error and B’s data is not in the table', text: 'With retries off (commit.retry.num-retries = 0) B gets CommitFailedException: branch main has changed: expected id ..., found .... B’s data file is on disk, but no snapshot refers to it. You must call refresh() and write again yourself.' },
    ],
    caption: 'Measured in exercise 04 for both cases (version names in the drawing are made up). Spark and Java retry by themselves too, 4 times by default.',
  },
};

export default function CommitRaceLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [retry, setRetry] = useState(true);
  const steps = T.steps(retry);
  const { step, go, playing, toggle } = useStepper(steps.length, 4800);

  const aIn = step >= 2;
  const bIn = step >= 4 && retry;
  const pointer = bIn ? 'v5' : step >= 2 ? 'v4' : 'v3';
  const bLines = T.b(retry);

  const writer = (y: number, name: string, status: string, active: boolean, bad: boolean, files: string) => (
    <g>
      <rect className={active ? 'ib-use' : 'ib-node'} x={12} y={y} width={252} height={150} rx={12} />
      {step >= 1 && <text x={28} y={y + 132} className="ib-m">{files}</text>}
      <text x={28} y={y + 32} className="ib-t">{T.writer(name)}</text>
      <Lines x={28} y={y + 66} text={status} max={21} lh={24} className={bad ? 'ib-n ib-bad' : 'ib-n'} />
    </g>
  );

  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <div className="ib-controls">
        <span className="ib-lbl">{T.retry}</span>
        <span className="seg" role="group" aria-label={T.retry}>
          <button type="button" aria-pressed={retry} onClick={() => setRetry(true)}>{T.on}</button>
          <button type="button" aria-pressed={!retry} onClick={() => setRetry(false)}>{T.off}</button>
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 440" role="img" aria-label={T.title}>
          <defs>
            <marker id="ibah2" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9z" style={{ fill: 'var(--accent)' }} /></marker>
            <marker id="ibah2bad" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9z" style={{ fill: 'var(--ib-bad)' }} /></marker>
          </defs>
          {writer(24, 'A', T.a[step], step === 2, false, 'a.parquet + v4')}
          {writer(230, 'B', bLines[step], step === 3 || step === 4, step === 3 || (step === 4 && !retry), step >= 4 && retry ? 'b.parquet + v5' : 'b.parquet + v4′')}

          {/* catalog */}
          <rect className="ib-use" x={330} y={110} width={210} height={186} rx={12} />
          <text x={346} y={140} className="ib-t">{T.catalog}</text>
          <text x={346} y={170} className="ib-s">{T.pointer}</text>
          <text x={346} y={238} className="ib-big ib-acc">{pointer}</text>

          {/* what is in the table */}
          <rect className="ib-zone" x={606} y={24} width={264} height={356} rx={12} />
          <text x={622} y={54} className="ib-n">{T.table}</text>
          <rect className="ib-node" x={622} y={72} width={232} height={58} rx={9} />
          <text x={636} y={106} className="ib-n">{T.old}</text>
          <rect className={aIn ? 'ib-new' : 'ib-skip'} x={622} y={150} width={232} height={58} rx={9} />
          <text x={636} y={176} className="ib-n">{T.dataOf('A')}</text>
          <text x={636} y={197} className={aIn ? 'ib-s ib-ok' : 'ib-s'}>{aIn ? T.inTable : T.notYet}</text>
          <rect className={bIn ? 'ib-new' : 'ib-skip'} x={622} y={228} width={232} height={58} rx={9} />
          <text x={636} y={254} className="ib-n">{T.dataOf('B')}</text>
          <text x={636} y={275} className={bIn ? 'ib-s ib-ok' : step === 4 && !retry ? 'ib-s ib-bad' : 'ib-s'}>{bIn ? T.inTable : step === 4 && !retry ? T.lost : T.notYet}</text>

          {/* the commit attempts */}
          {step === 2 && (
            <g>
              <path className="ib-arrow" d="M266,100 L326,150" markerEnd="url(#ibah2)" />
              <Num x={296} y={118} n="✓" />
            </g>
          )}
          {step === 3 && (
            <g>
              <path className="ib-arrow-bad" d="M266,300 L326,250" markerEnd="url(#ibah2bad)" />
              <Num x={296} y={286} n="✗" color="var(--ib-bad)" />
            </g>
          )}
          {step === 4 && retry && (
            <g>
              <path className="ib-arrow" d="M266,300 L326,250" markerEnd="url(#ibah2)" />
              <Num x={296} y={286} n="✓" />
            </g>
          )}
          {(step === 2 || step === 3 || (step === 4 && retry)) && (
            <g>
              <Lines x={435} y={320} anchor="middle" max={30} lh={19} text={step === 2 ? T.check('v3', 'v4') : step === 3 ? T.check('v3', 'v4′') : T.check('v4', 'v5')} className="ib-s" />
              <Lines x={435} y={372} anchor="middle" max={30} lh={22} text={step === 3 ? T.bad('v4') : T.ok} className={step === 3 ? 'ib-n ib-bad' : 'ib-n ib-ok'} />
            </g>
          )}
        </svg>
      </div>
      <StepControls steps={steps} step={step} playing={playing} go={go} toggle={toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
