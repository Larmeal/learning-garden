import { useState } from 'react';
import { StepControls, useStepper, type Lang, type StepInfo } from '../spark/stepper';
import { Legend } from './ib';

// Shows:      the same DELETE of one row done three ways (copy-on-write, merge-on-read with a position delete file, version 3 with a deletion
//             vector): which files are in the snapshot afterwards, what is still on disk, and what the reader has to do.
// Because:    "the original file is not edited" and "a note says skip row 3" are easy to read and hard to picture. Seeing the ten cells of the
//             file, the struck-out cell and the note side by side is what makes the cost of each mode visible.
// Control:    the mode switch changes which files exist after the DELETE; the steps walk through before, DELETE, the read and the cost.
// Conclusion: copy-on-write pays when it writes (a whole new file), merge-on-read pays every time it reads (apply the note).
//
// Measured in exercises/06_row_level.py (10 rows in one file, DELETE id = 3): copy-on-write gave operation overwrite with 1 file added and 1
// removed, total-records 9; merge-on-read v2 gave operation delete with 1 position delete file (pos 2), total-records still 10 while
// count(*) is 9; v3 gave a Puffin deletion vector (added-dvs 1). The cost step is the author's conclusion, not a timing.

type Mode = 'cow' | 'mor' | 'dv';

const TEXT: Record<Lang, {
  title: string; mode: string; modes: Record<Mode, string>; snap: string; inSnap: string; onDisk: string; reader: string; sees: string; rows: string; total: string;
  notYet: string; dataFile: string; noteV2: string; noteV3: string; removed: string; skip: string; none: string; legend: [string, string, string];
  steps: (m: Mode) => StepInfo[]; caption: string;
}> = {
  th: {
    title: 'ลบ Row เดียวด้วย DELETE แล้วลองดูว่าแต่ละโหมดเปลี่ยนไฟล์อย่างไร และผู้อ่านต้องทำอะไรบ้าง',
    mode: 'โหมด', modes: { cow: 'Copy-on-write', mor: 'Merge-on-read (v2)', dv: 'Merge-on-read (v3)' },
    snap: 'Snapshot', inSnap: 'ไฟล์ที่ Snapshot นี้ใช้', onDisk: 'ยังอยู่บนดิสก์ แต่ Snapshot นี้ไม่ใช้', reader: 'ผู้อ่านเห็น', sees: 'Row ที่อ่านได้', rows: 'Row', total: 'total-records ใน Summary',
    notYet: 'ยังไม่ได้อ่าน Snapshot 2', dataFile: 'ไฟล์ข้อมูล', noteV2: 'โน้ต: Position Delete (Parquet)', noteV3: 'โน้ต: Deletion Vector (Puffin)', removed: 'ถูกเอาออกจาก Snapshot', skip: 'ข้าม', none: 'ไม่มี',
    legend: ['ไฟล์ที่ใช้อยู่', 'ไฟล์ที่เกิดใหม่', 'ไฟล์ที่เลิกใช้แล้ว'],
    steps: (m) => [
      { name: 'ก่อนลบ', title: 'ตารางมีไฟล์เดียว 10 Row', text: 'Snapshot 1 ชี้ไปที่ไฟล์ข้อมูล F1 ที่มี id 1 ถึง 10 ผู้อ่านจึงเห็น 10 Row' },
      m === 'cow'
        ? { name: 'DELETE', title: 'Copy-on-write: เขียนไฟล์ใหม่ทั้งไฟล์', text: 'Iceberg แก้ F1 ไม่ได้ จึงอ่านทั้งไฟล์ แล้วเขียน F2 ที่ไม่มี id 3 ออกมา จากนั้นทำ Snapshot 2 ให้ชี้ F2 แทน F1 (operation overwrite, เพิ่ม 1 ไฟล์ เอาออก 1 ไฟล์) ส่วน F1 ยังอยู่บนดิสก์ เพราะ Snapshot 1 ยังใช้อยู่' }
        : m === 'mor'
          ? { name: 'DELETE', title: 'Merge-on-read: เขียนโน้ตว่าข้ามตำแหน่งไหน', text: 'F1 ไม่ถูกแตะเลย Iceberg เขียน Delete File เล็ก ๆ ที่บอกว่า "F1 ตำแหน่ง 2" (id 3 เป็น Row ลำดับที่ 3 เมื่อนับจาก 0 จึงเป็นตำแหน่ง 2) แล้ว Snapshot 2 ก็ชี้ทั้ง F1 และโน้ตนี้ (operation delete)' }
          : { name: 'DELETE', title: 'Format version 3: โน้ตเป็น Deletion Vector', text: 'ทำงานคล้าย Merge-on-read แต่โน้ตเป็นบิตแมปที่บอกว่า Row ไหนของ F1 ถูกลบ โดยเก็บไว้ในไฟล์ Puffin (Summary มี added-dvs 1) และจะไม่มีไฟล์ Parquet ของ Position Delete' },
      m === 'cow'
        ? { name: 'ผู้อ่าน', title: 'ผู้อ่านเปิด F2 แล้วอ่านได้เลย', text: 'ไม่มีอะไรต้องหัก ผู้อ่านจึงเห็น 9 Row และ total-records ใน Summary ก็เป็น 9 เช่นกัน' }
        : { name: 'ผู้อ่าน', title: 'ผู้อ่านเปิด F1 แล้วหักตามโน้ต', text: 'ผู้อ่านอ่าน F1 กับโน้ตแล้วข้ามตำแหน่ง 2 จึงได้ 9 Row แต่ total-records ใน Summary ยังเป็น 10 เพราะมันนับ Row ที่เขียนในไฟล์ข้อมูล และไม่ได้หักโน้ตออก (วัดจริงในแบบฝึก 06)' },
      m === 'cow'
        ? { name: 'ต้นทุน', title: 'ต้นทุนอยู่ตอนเขียน', text: 'ลบ Row เดียวแต่ต้องเขียนไฟล์ใหม่ทั้งไฟล์ ถ้าไฟล์ใหญ่ก็จะแพง แลกกับการอ่านที่ไม่มีภาระเพิ่ม (ข้อสรุปของผู้เขียนนะ ตัวอย่างนี้เล็กเกินกว่าจะวัดเวลา)' }
        : { name: 'ต้นทุน', title: 'ต้นทุนอยู่ตอนอ่าน', text: 'การเขียนถูกมากเพราะเขียนแค่โน้ต แต่ทุกครั้งที่อ่านต้องหักโน้ตด้วย ยิ่งโน้ตสะสมมากก็ยิ่งอ่านช้าลง จนกว่าจะรวมไฟล์ใหม่ (ข้อสรุปของผู้เขียนนะ ไม่ได้วัดเวลา)' },
    ],
    caption: 'ตัวเลขใน Summary วัดจริงในแบบฝึก 06 (10 Row ในหนึ่งไฟล์ ลบ id = 3) ส่วนขั้น "ต้นทุน" เป็นข้อสรุปของผู้เขียน หนังสือ Apache Iceberg: The Definitive Guide บทที่ 4 หน้า 86 เล่าเรื่อง COW กับ MOR ไว้เช่นกัน',
  },
  en: {
    title: 'Delete one row with DELETE and see how each mode changes the files and what the reader has to do',
    mode: 'Mode', modes: { cow: 'Copy-on-write', mor: 'Merge-on-read (v2)', dv: 'Merge-on-read (v3)' },
    snap: 'Snapshot', inSnap: 'Files this snapshot uses', onDisk: 'Still on disk, but this snapshot does not use it', reader: 'The reader sees', sees: 'rows read', rows: 'rows', total: 'total-records in the summary',
    notYet: 'has not read snapshot 2 yet', dataFile: 'data file', noteV2: 'note: position delete (Parquet)', noteV3: 'note: deletion vector (Puffin)', removed: 'removed from the snapshot', skip: 'skip', none: 'none',
    legend: ['file in use', 'newly written', 'no longer used'],
    steps: (m) => [
      { name: 'before', title: 'The table has one file of 10 rows', text: 'Snapshot 1 points to the data file F1 with ids 1 to 10. A reader sees 10 rows.' },
      m === 'cow'
        ? { name: 'DELETE', title: 'Copy-on-write: a whole new file is written', text: 'Iceberg cannot edit F1, so it reads the whole file, writes F2 without id 3, and makes snapshot 2 point to F2 instead of F1 (operation overwrite, 1 file added and 1 removed). F1 is still on disk because snapshot 1 still uses it.' }
        : m === 'mor'
          ? { name: 'DELETE', title: 'Merge-on-read: write a note saying which position to skip', text: 'F1 is not touched. Iceberg writes a small delete file that says "F1, position 2" (id 3 is the third row, so counting from 0 its position is 2). Snapshot 2 points to F1 and to the note (operation delete).' }
          : { name: 'DELETE', title: 'Format version 3: the note is a deletion vector', text: 'The same as merge-on-read, but the note is a bitmap of which rows of F1 are deleted, kept in a Puffin file (the summary has added-dvs 1). There is no Parquet position delete file.' },
      m === 'cow'
        ? { name: 'reader', title: 'The reader opens F2 and reads it as it is', text: 'Nothing to subtract. The reader sees 9 rows, and total-records in the summary is 9 too.' }
        : { name: 'reader', title: 'The reader opens F1 and subtracts the note', text: 'The reader reads F1 and the note and skips position 2, getting 9 rows. But total-records in the summary is still 10, because it counts the rows written in data files and does not subtract the note (measured in exercise 06).' },
      m === 'cow'
        ? { name: 'cost', title: 'The cost is at write time', text: 'One row was deleted but a whole file had to be written. For a large file that is expensive, in exchange for reads with no extra work (the author’s conclusion; this example is too small to time).' }
        : { name: 'cost', title: 'The cost is at read time', text: 'The write is very cheap (only a note), but every read has to apply the note, and the more notes pile up the slower reads get, until files are rewritten (the author’s conclusion, not timed).' },
    ],
    caption: 'The numbers in the summary were measured in exercise 06 (10 rows in one file, delete id = 3). The "cost" step is the author’s conclusion. The book Apache Iceberg: The Definitive Guide, chapter 4, page 86, tells the story of COW and MOR too.',
  },
};

const IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const REST = IDS.filter((i) => i !== 3);

function Cells({ x, y, ids, w, struck }: { x: number; y: number; ids: number[]; w: number; struck?: number }) {
  return (
    <g>
      {ids.map((id, i) => (
        <g key={id}>
          <rect className="ib-node" x={x + i * w} y={y} width={w - 4} height={30} rx={5} style={id === struck ? { strokeDasharray: '4 3', opacity: 0.45, fill: 'var(--surface-2)' } : undefined} />
          <text x={x + i * w + (w - 4) / 2} y={y + 21} textAnchor="middle" className="ib-m" style={id === struck ? { opacity: 0.55, textDecoration: 'line-through' } : { fill: 'var(--fg)' }}>{id}</text>
        </g>
      ))}
    </g>
  );
}

export default function DeleteModeLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [mode, setMode] = useState<Mode>('mor');
  const steps = T.steps(mode);
  const { step, go, playing, toggle } = useStepper(steps.length, 5200);
  const after = step >= 1;
  const note = mode === 'dv' ? T.noteV3 : T.noteV2;
  const count = step === 0 ? 10 : step === 1 && mode !== 'cow' ? '–' : 9;

  return (
    <figure className="viz">
      <div className="viz-title">{T.title}</div>
      <Legend items={[{ kind: 'use', text: T.legend[0] }, { kind: 'new', text: T.legend[1] }, { kind: 'skip', text: T.legend[2] }]} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.mode}</span>
        <span className="seg" role="group" aria-label={T.mode}>
          {(['cow', 'mor', 'dv'] as Mode[]).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>{T.modes[m]}</button>
          ))}
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 380" role="img" aria-label={T.title}>
          <text x={16} y={28} className="ib-t">{T.snap} {after ? 2 : 1}</text>
          <text x={16} y={50} className="ib-s">{T.inSnap}</text>

          {/* files of the current snapshot */}
          {!(after && mode === 'cow') && (
            <g>
              <rect className={after ? 'ib-use' : 'ib-node'} x={16} y={62} width={400} height={92} rx={10} style={!after ? { stroke: 'var(--accent)', strokeWidth: 3 } : undefined} />
              <text x={30} y={86} className="ib-n">F1 · {T.dataFile}</text>
              <Cells x={28} y={98} ids={IDS} w={38} struck={after && mode !== 'cow' ? 3 : undefined} />
              {after && mode !== 'cow' && <text x={402} y={86} textAnchor="end" className="ib-s">id 3 → {T.skip}</text>}
            </g>
          )}
          {after && mode === 'cow' && (
            <g>
              <rect className="ib-new" x={16} y={62} width={400} height={92} rx={10} />
              <text x={30} y={86} className="ib-n">F2 · {T.dataFile}</text>
              <Cells x={28} y={98} ids={REST} w={38} />
              <text x={402} y={86} textAnchor="end" className="ib-s ib-acc">9 {T.rows}</text>
            </g>
          )}
          {after && mode !== 'cow' && (
            <g>
              <rect className="ib-new" x={16} y={168} width={400} height={74} rx={10} />
              <text x={30} y={194} className="ib-n">X · {note}</text>
              <text x={30} y={222} className="ib-m" style={{ fill: 'var(--fg)' }}>{mode === 'mor' ? 'F1 → pos 2' : 'F1 → bit 2'}</text>
            </g>
          )}

          <text x={16} y={282} className="ib-n">{T.onDisk}</text>
          {after && mode === 'cow' ? (
            <g>
              <rect className="ib-skip" x={16} y={296} width={400} height={64} rx={10} />
              <text x={30} y={322} className="ib-n">F1 · {T.removed}</text>
              <text x={30} y={346} className="ib-m">…00001.parquet</text>
            </g>
          ) : (
            <text x={16} y={326} className="ib-s">{T.none}</text>
          )}

          {/* the reader */}
          <rect className="ib-zone" x={444} y={20} width={426} height={340} rx={12} />
          <text x={462} y={52} className="ib-t">{T.reader}</text>
          {step === 0 && <Cells x={460} y={72} ids={IDS} w={39} />}
          {step === 1 && mode !== 'cow' && <text x={462} y={96} className="ib-s">{T.notYet}</text>}
          {(step >= 2 || (step === 1 && mode === 'cow')) && <Cells x={460} y={72} ids={REST} w={39} />}
          <text x={462} y={150} className="ib-s">{T.sees}</text>
          <text x={462} y={200} className="ib-big ib-acc">{count} <tspan className="ib-s">{T.rows}</tspan></text>
          <text x={462} y={262} className="ib-s">{T.total}</text>
          <text x={462} y={312} className="ib-big">{step === 0 ? 10 : mode === 'cow' ? 9 : 10}</text>
        </svg>
      </div>
      <StepControls steps={steps} step={step} playing={playing} go={go} toggle={toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
