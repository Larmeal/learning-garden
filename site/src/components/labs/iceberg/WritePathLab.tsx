import { useState } from 'react';
import { StepControls, useStepper, type Lang, type StepInfo } from '../spark/stepper';
import { Legend, Lines, Node, Num } from './ib';

// Shows:      one INSERT as seven numbered steps. The four new files appear one by one in a dashed area "outside the table"; nothing a reader
//             can see changes until step 7, when the pointer in the catalog changes and the dashed area becomes part of the table.
// Because:    "a commit ends with one atomic change" is only convincing when you watch six steps happen first with the table unchanged.
//             The book (Apache Iceberg: The Definitive Guide, chapter 3, figure 3-2, page 46) draws the write the same way, as steps 1 to 7.
// Control:    the steps walk the write; the switch "someone else committed meanwhile" changes step 7: the catalog refuses and the engine
//             has to go back to step 2.
// Conclusion: the files of a commit are all written first and are invisible; the table changes at the moment the pointer changes.
//
// The kinds of file are what exercises/01 and 02 listed after an INSERT; the conditional pointer change was read in JdbcUtil.java.
// The order of the steps is the book's. File names are shortened.

const TEXT: Record<Lang, {
  title: string; clash: string; no: string; yes: string; engine: string; engineSub: string; catalog: string; catalogSub: string;
  pointer: string; readerSees: string; zoneOut: string; zoneIn: string;
  slots: { title: string; sub: string }[];
  condOk: (a: string, b: string) => string; condBad: (a: string, b: string) => string; backTo2: string; othersCommit: string;
  legend: [string, string, string];
  steps: (clash: boolean) => StepInfo[];
  caption: string;
}> = {
  th: {
    title: 'ดู INSERT หนึ่งคำสั่งทีละขั้น ไฟล์ใหม่จะทยอยเกิดขึ้นนอกตาราง และผู้อ่านจะไม่เห็นอะไรเลยจนถึงขั้นสุดท้าย',
    clash: 'ระหว่างนั้นมีคนอื่น Commit ไปก่อน', no: 'ไม่มี', yes: 'มี', engine: 'Engine', engineSub: 'INSERT ...', catalog: 'Catalog', catalogSub: 'ป้ายบนชั้น',
    pointer: 'ตัวชี้ตอนนี้', readerSees: 'ผู้อ่านเห็นตาราง', zoneOut: 'ไฟล์ใหม่ที่ยังอยู่นอกตาราง (ผู้อ่านยังไม่เห็น)', zoneIn: 'ไฟล์ใหม่ที่อยู่ในตารางแล้ว (ผู้อ่านเห็นพร้อมกัน)',
    slots: [
      { title: 'ไฟล์ข้อมูล', sub: 'data/…00002.parquet' },
      { title: 'รายการไฟล์ (Manifest)', sub: '…-m0.avro' },
      { title: 'รายการของ Snapshot', sub: 'snap-….avro (Manifest List)' },
      { title: 'สารบัญฉบับใหม่', sub: '00004-….metadata.json' },
    ],
    condOk: (a, b) => `ถ้าตัวชี้ยังเป็น ${a} ให้เปลี่ยนเป็น ${b}`, condBad: (a, b) => `ขอเปลี่ยน ${a} เป็น ${b} แต่ตัวชี้ไม่ใช่ ${a} แล้ว`, backTo2: 'กลับไปขั้นที่ 2 แล้วลองใหม่', othersCommit: 'คนอื่น Commit ไปแล้ว',
    legend: ['ไฟล์ที่เพิ่งเขียน', 'ไฟล์ที่ผู้อ่านเห็นแล้ว', 'ยังไม่ได้เขียน'],
    steps: (clash) => [
      { name: 'วางแผน', title: '1. Engine อ่านคำสั่งและวางแผน', text: 'Engine แยกคำสั่ง INSERT แล้ววางแผนว่าจะเขียนอะไรลงที่ไหน ตอนนี้ยังไม่มีไฟล์ใหม่เลย' },
      { name: 'ถาม Catalog', title: '2. ขอสารบัญล่าสุดจาก Catalog', text: 'Engine ได้ Schema และวิธีแบ่ง Partition ของตารางมา เพื่อจะเขียนไฟล์ให้ถูกรูปแบบ ตอนนี้ตัวชี้เป็น v3' },
      { name: 'ไฟล์ข้อมูล', title: '3. เขียนไฟล์ข้อมูล', text: 'Engine เขียนไฟล์ Parquet ลงโฟลเดอร์ data/ แต่ยังไม่มีสารบัญฉบับไหนอ้างถึงไฟล์นี้ ผู้อ่านจึงยังเห็นตาราง v3 เหมือนเดิม' },
      { name: 'Manifest', title: '4. เขียนรายการไฟล์ (Manifest)', text: 'ไฟล์ -m0.avro ลิสต์ไฟล์ข้อมูลที่เพิ่งเขียนพร้อมสถิติของแต่ละ Column และก็ยังไม่มีใครอ้างถึงไฟล์นี้เช่นกัน' },
      { name: 'Manifest List', title: '5. เขียนรายการของ Snapshot (Manifest List)', text: 'ไฟล์ snap-….avro ของ Snapshot ใหม่ จะชี้ไปที่ Manifest ใหม่นี้ รวมกับ Manifest เก่าที่ใช้ซ้ำ' },
      { name: 'metadata.json', title: '6. เขียนสารบัญฉบับใหม่ (metadata.json)', text: 'ฉบับ v4 มี Snapshot ใหม่ต่อจากของเดิม ตอนนี้ไฟล์ใหม่ครบสี่ไฟล์แล้ว แต่ Catalog ยังชี้ v3 อยู่ ผู้อ่านจึงยังไม่เห็นอะไรเปลี่ยน' },
      clash
        ? { name: 'เปลี่ยนตัวชี้', title: '7. ขอเปลี่ยนตัวชี้ แต่ Catalog ปฏิเสธ', text: 'Engine ขอเปลี่ยนจาก v3 เป็น v4 แต่ระหว่างนั้นมีคนเปลี่ยนตัวชี้เป็นของเขาไปแล้ว เงื่อนไข "ยังเป็น v3 ไหม" จึงไม่จริง Catalog ไม่เปลี่ยนอะไร Engine เลยกลับไปขั้นที่ 2 เพื่ออ่านฉบับล่าสุด เขียนสารบัญต่อจากฉบับนั้น แล้วลองใหม่ (ไฟล์ข้อมูลที่เขียนไปแล้วใช้ต่อได้)' }
        : { name: 'เปลี่ยนตัวชี้', title: '7. เปลี่ยนตัวชี้ใน Catalog (Atomic)', text: 'Engine ขอเปลี่ยนจาก v3 เป็น v4 โดยมีเงื่อนไขว่าตัวชี้ยังเป็น v3 ซึ่งเงื่อนไขเป็นจริง Catalog จึงเปลี่ยนให้ในครั้งเดียว และตั้งแต่วินาทีนี้ผู้อ่านทุกคนจะเห็นไฟล์ใหม่พร้อมกัน' },
    ],
    caption: 'ลำดับขั้นตรงกับหนังสือ Apache Iceberg: The Definitive Guide บทที่ 3 หน้า 46 (Figure 3-2) ชนิดไฟล์ตรงกับแบบฝึก 01 และ 02 การเปลี่ยนตัวชี้แบบมีเงื่อนไขอ่านจาก JdbcUtil.java ชื่อไฟล์ย่อไว้',
  },
  en: {
    title: 'Watch one INSERT step by step. The new files appear outside the table, and a reader sees nothing until the last step',
    clash: 'Meanwhile someone else committed first', no: 'no', yes: 'yes', engine: 'Engine', engineSub: 'INSERT ...', catalog: 'Catalog', catalogSub: 'the shelf label',
    pointer: 'pointer now', readerSees: 'readers see table', zoneOut: 'New files, still outside the table (readers cannot see them)', zoneIn: 'New files, now in the table (everyone sees them at once)',
    slots: [
      { title: 'Data file', sub: 'data/…00002.parquet' },
      { title: 'List of files (manifest)', sub: '…-m0.avro' },
      { title: 'List of a snapshot', sub: 'snap-….avro (manifest list)' },
      { title: 'New table of contents', sub: '00004-….metadata.json' },
    ],
    condOk: (a, b) => `if the pointer is still ${a}, change it to ${b}`, condBad: (a, b) => `asks to change ${a} to ${b}, but the pointer is no longer ${a}`, backTo2: 'go back to step 2 and try again', othersCommit: 'someone else committed',
    legend: ['just written', 'seen by readers', 'not written yet'],
    steps: (clash) => [
      { name: 'plan', title: '1. The engine parses the statement and plans', text: 'It parses the INSERT and plans what to write where. There is no new file yet.' },
      { name: 'ask the catalog', title: '2. Ask the catalog for the latest table of contents', text: 'The engine gets the table’s schema and partitioning so it can write files in the right shape. The pointer is v3 now.' },
      { name: 'data file', title: '3. Write the data file', text: 'A Parquet file goes into the folder data/. No table of contents mentions it yet, so a reader still sees table v3.' },
      { name: 'manifest', title: '4. Write the list of files (manifest)', text: 'A -m0.avro file lists the data file just written, with the statistics of each column. Nothing refers to it yet either.' },
      { name: 'manifest list', title: '5. Write the list of the snapshot (manifest list)', text: 'The file snap-….avro of the new snapshot points to this new manifest, together with the old manifests that are reused.' },
      { name: 'metadata.json', title: '6. Write the new table of contents (metadata.json)', text: 'Version v4, with a new snapshot on top of the old ones. All four new files are written, but the catalog still points to v3, so readers see no change.' },
      clash
        ? { name: 'change pointer', title: '7. Ask to change the pointer, and the catalog refuses', text: 'The engine asks to change v3 to v4, but meanwhile someone else changed the pointer to theirs. The condition "is it still v3?" is false, so the catalog changes nothing. The engine goes back to step 2, reads the latest version, writes a table of contents on top of it and tries again (the data files already written can be reused).' }
        : { name: 'change pointer', title: '7. Change the pointer in the catalog (atomic)', text: 'The engine asks to change v3 to v4 on condition that the pointer is still v3. The condition holds, so the catalog changes it in one go. From this moment every reader sees the new files at the same time.' },
    ],
    caption: 'The order of the steps is the one in the book Apache Iceberg: The Definitive Guide, chapter 3, page 46 (figure 3-2). The kinds of files match exercises 01 and 02, and the conditional pointer change was read in JdbcUtil.java. File names are shortened.',
  },
};

const SLOT_Y = [96, 168, 240, 312];
const SLOT_X = 262;
const SLOT_W = 330;

export default function WritePathLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [clash, setClash] = useState(false);
  const steps = T.steps(clash);
  const { step, go, playing, toggle } = useStepper(steps.length, 4800);

  const committed = step >= 6 && !clash;
  const shown = (i: number) => step >= i + 2; // slot i is written at step index i + 2
  const pointer = committed ? 'v4' : clash && step >= 4 ? 'v4' : 'v3';
  const readers = pointer;
  const refused = step === 6 && clash;

  return (
    <figure className="viz">
      <div className="viz-title">{T.title}</div>
      <Legend items={[{ kind: 'new', text: T.legend[0] }, { kind: 'use', text: T.legend[1] }, { kind: 'skip', text: T.legend[2] }]} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.clash}</span>
        <span className="seg" role="group" aria-label={T.clash}>
          <button type="button" aria-pressed={!clash} onClick={() => setClash(false)}>{T.no}</button>
          <button type="button" aria-pressed={clash} onClick={() => setClash(true)}>{T.yes}</button>
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 490" role="img" aria-label={T.title}>
          <defs>
            <marker id="ibah" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9z" style={{ fill: 'var(--accent)' }} /></marker>
            <marker id="ibahbad" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9z" style={{ fill: 'var(--ib-bad)' }} /></marker>
          </defs>

          {/* the area of new files: dashed while it is outside the table, solid green once the pointer has changed */}
          <rect className="ib-zone" x={236} y={34} width={382} height={352} rx={14} />
          <rect className={committed ? 'ib-zone-solid' : 'ib-zone-dash'} x={236} y={34} width={382} height={352} rx={14} />
          <Lines x={252} y={58} text={committed ? T.zoneIn : T.zoneOut} max={40} lh={18} className="ib-s" />

          {/* engine */}
          <Node x={12} y={168} w={156} h={92} title={T.engine} sub={T.engineSub} state={step === 0 || refused ? 'use' : 'node'} />
          {step === 0 && <Num x={90} y={282} n={1} />}
          {refused && <Lines x={12} y={120} text={'↩ ' + T.backTo2} max={19} lh={20} className="ib-s ib-bad" />}

          {/* catalog */}
          <rect className="ib-new" x={688} y={110} width={182} height={206} rx={12} style={{ fill: 'var(--surface)', stroke: 'var(--accent)' }} />
          <text x={704} y={138} className="ib-n">{T.catalog}</text>
          <text x={704} y={158} className="ib-s">{T.catalogSub}</text>
          <text x={704} y={192} className="ib-s">{T.pointer}</text>
          <text x={704} y={236} className="ib-big ib-acc">{pointer}</text>
          {clash && step >= 4 && <text x={704} y={258} className="ib-s ib-bad">{T.othersCommit}</text>}
          <text x={704} y={296} className="ib-s">{T.readerSees} {readers}</text>

          {/* the four new files */}
          {T.slots.map((s, i) => (
            shown(i) ? (
              <g key={s.title}>
                <Node x={SLOT_X} y={SLOT_Y[i]} w={SLOT_W} h={58} title={s.title} sub={s.sub} state={committed ? 'use' : 'new'} tag={committed ? undefined : undefined} />
                <Num x={SLOT_X - 8} y={SLOT_Y[i] + 29} n={i + 3} color={step === i + 2 ? 'var(--accent)' : 'var(--line-strong)'} />
              </g>
            ) : (
              <Node key={s.title} x={SLOT_X} y={SLOT_Y[i]} w={SLOT_W} h={58} title={s.title} sub={s.sub} state="skip" />
            )
          ))}

          {/* arrows of the current step */}
          {step === 1 && (
            <g>
              <path className="ib-arrow" d="M690,130 C690,12 90,10 90,166" markerEnd="url(#ibah)" />
              <Num x={390} y={16} n={2} />
            </g>
          )}
          {step >= 2 && step <= 5 && (
            <path className="ib-arrow" d={`M170,214 L${SLOT_X - 28},${SLOT_Y[step - 2] + 29}`} markerEnd="url(#ibah)" />
          )}
          {step === 6 && (
            <g>
              <path className={refused ? 'ib-arrow-bad' : 'ib-arrow'} d="M90,262 C90,450 780,450 780,318" markerEnd={refused ? 'url(#ibahbad)' : 'url(#ibah)'} />
              <Num x={430} y={440} n={7} color={refused ? 'var(--ib-bad)' : 'var(--accent)'} />
              <Lines x={430} y={474} anchor="middle" max={60} lh={20} text={refused ? T.condBad('v3', 'v4') : T.condOk('v3', 'v4')} className={refused ? 'ib-n ib-bad' : 'ib-n ib-acc'} />
              
            </g>
          )}
        </svg>
      </div>
      <StepControls steps={steps} step={step} playing={playing} go={go} toggle={toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
