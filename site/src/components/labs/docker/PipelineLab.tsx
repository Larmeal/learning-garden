import { useState } from 'react';
import type { Lang } from '../spark/timeline';
import { Legend, Lines } from '../iceberg/ib';
import data from './capstone.json';

// Shows:      the whole pipeline as a path: the CSV file, the etl container (with its safeguards as chips), a network that has no way out, and the database with its
//             volume. Choose how the pipeline is broken (nothing, wrong host name, wrong password, too little memory). The arrow stops at the place where it breaks,
//             and the ladder under the picture shows what each command (compose ps, compose logs, docker inspect, docker events) would print, from the real run.
// Because:    finding the cause is walking the path from the symptom to the place. The exit code alone (1, 1, 137) does not say where; the log and inspect do.
// Control:    the breakage (four choices).
// Conclusion: look at the status first, then the log, then docker inspect, then events: the same exit code 1 means two different causes, and 137 with OOMKilled means memory.
//
// Safeguards and the output of each command come from exercises/12_capstone_pipeline.py --write (capstone.json): a real Compose project with three real breakages.

type Break = 'ok' | 'wrong host name' | 'wrong password' | 'too little memory';
const BREAKS: Break[] = ['ok', 'wrong host name', 'wrong password', 'too little memory'];
const B = data.breaks;
const S = data.safeguards;

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; pick: string; picks: Record<Break, string>; csv: string; etl: string; db: string; vol: string; net: string; chips: string[];
  where: Record<Break, string>; ladder: string; cmds: string[]; result: string; readout: Record<Break, string>; caption: string;
}> = {
  th: {
    title: 'เลือกว่าจะทำให้ Pipeline พังแบบไหน แล้วดูว่าลูกศรหยุดตรงไหน และคำสั่งแต่ละขั้นของการหาสาเหตุพิมพ์อะไรออกมา',
    legend: [{ kind: 'use', text: 'ทำงานปกติ' }, { kind: 'new', text: 'จุดที่พัง' }, { kind: 'skip', text: 'ไปไม่ถึง' }],
    pick: 'ทำให้พังแบบ',
    picks: { ok: 'ไม่พัง', 'wrong host name': 'ชื่อ Host ผิด', 'wrong password': 'รหัสผ่านผิด', 'too little memory': 'Memory น้อยเกินไป' },
    csv: 'ไฟล์ orders.csv',
    etl: 'etl (ตัวโหลด)',
    db: 'db (Postgres)',
    vol: 'Volume pgdata',
    net: 'Network ที่ไม่มีทางออกอินเทอร์เน็ต',
    chips: [`ผู้ใช้ ${S.user} (ไม่ใช่ root)`, 'ระบบไฟล์อ่านอย่างเดียว', 'ไม่มี Capability เลย', `จำกัด Memory ${S.memoryMb} MB`],
    where: { ok: 'ถึงปลายทาง', 'wrong host name': 'หาชื่อ db ไม่เจอ', 'wrong password': 'db ปฏิเสธรหัสผ่าน', 'too little memory': 'ถูกฆ่าก่อนออกจากตัวเอง' },
    ladder: 'ไล่หาสาเหตุทีละขั้น',
    cmds: ['docker compose ps -a', 'docker compose logs etl', 'docker inspect', 'docker events'],
    result: 'ผลที่พิมพ์ออกมา',
    readout: {
      ok: 'ทุกอย่างผ่าน etl โหลดสี่แถวและปฏิเสธหนึ่งแถว แล้วจบด้วย 0',
      'wrong host name': 'Exit Code เป็น 1 เหมือนกรณีรหัสผ่านผิด จึงต้องเปิด Log จึงรู้ว่าปัญหาคือหาชื่อ Host ไม่เจอ',
      'wrong password': 'Exit Code เป็น 1 เหมือนกรณีชื่อ Host ผิด แต่ Log บอกว่า db ปฏิเสธรหัสผ่าน',
      'too little memory': 'Exit Code 137 กับ OOMKilled เป็นจริง บอกได้ทันทีว่าติดขีดจำกัด Memory ส่วน Log ว่างเพราะโปรแกรมถูกฆ่าก่อนพิมพ์',
    },
    caption: 'ผลทุกช่องมาจากแบบฝึก 12 (Compose จริงที่ Build, รัน และทำให้พังสามแบบ) บรรทัดสุดท้ายของ Log ถูกตัดที่ 200 ตัวอักษร ความปลอดภัยของ etl ที่แสดงเป็นแผ่นป้ายตรวจแล้วจาก docker inspect และจากการลองเขียนไฟล์ข้างใน',
  },
  en: {
    title: 'Choose how to break the pipeline and see where the arrow stops, and what each command of the search for the cause prints',
    legend: [{ kind: 'use', text: 'works as normal' }, { kind: 'new', text: 'where it breaks' }, { kind: 'skip', text: 'not reached' }],
    pick: 'Break it with',
    picks: { ok: 'nothing', 'wrong host name': 'a wrong host name', 'wrong password': 'a wrong password', 'too little memory': 'too little memory' },
    csv: 'the file orders.csv',
    etl: 'etl (the loader)',
    db: 'db (Postgres)',
    vol: 'Volume pgdata',
    net: 'A network with no way out to the internet',
    chips: [`user ${S.user} (not root)`, 'read-only file system', 'no capabilities at all', `memory limit ${S.memoryMb} MB`],
    where: { ok: 'reaches the end', 'wrong host name': 'cannot find the name db', 'wrong password': 'db refuses the password', 'too little memory': 'killed before it can leave itself' },
    ladder: 'Search for the cause, one step at a time',
    cmds: ['docker compose ps -a', 'docker compose logs etl', 'docker inspect', 'docker events'],
    result: 'What it prints',
    readout: {
      ok: 'Everything passes: etl loads four rows, rejects one, and ends with 0.',
      'wrong host name': 'The exit code is 1, the same as for a wrong password, so we must open the log to learn that the host name could not be found.',
      'wrong password': 'The exit code is 1, the same as for a wrong host name, but the log says db refused the password.',
      'too little memory': 'Exit code 137 with OOMKilled true tells us at once that the memory limit was hit. The log is empty because the program was killed before it printed.',
    },
    caption: 'Every cell comes from exercise 12 (a real Compose project that was built, run and broken three ways). The last line of the log is cut at 200 characters. The safeguards of etl shown as chips were checked with docker inspect and by trying to write files inside.',
  },
};

export default function PipelineLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [brk, setBrk] = useState<Break>('wrong host name');
  const info = brk === 'ok' ? { exitCode: 0, oom: false, ps: 'etl exited 0', log: 'loaded 4 rejected 1 rows in table: 4', events: ['create', 'start', 'die'] } : B[brk];
  const failed = brk !== 'ok';
  const cutAt = brk === 'too little memory' ? 'etl' : brk === 'wrong host name' ? 'net' : brk === 'wrong password' ? 'db' : 'none';
  const outputs = [info.ps, info.log || '(empty)', `ExitCode=${info.exitCode}  OOMKilled=${info.oom ? 'true' : 'false'}`, (info.events as string[]).join(', ')];
  const st = (k: string) => (cutAt === k ? 'ib-new' : 'ib-use');
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.pick}</span>
        <span className="seg" role="group" aria-label={T.pick}>
          {BREAKS.map((k) => (
            <button key={k} type="button" aria-pressed={brk === k} onClick={() => setBrk(k)}>{T.picks[k]}</button>
          ))}
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 520" role="img" aria-label={T.title}>
          <rect className="ib-use" x={14} y={30} width={150} height={96} rx={10} />
          <text x={26} y={62} className="ib-n">CSV</text>
          <text x={26} y={86} className="ib-s">{T.csv}</text>
          <text x={26} y={110} className="ib-s">read-only</text>
          <path className="ib-arrow" d="M164,78 L206,78" />
          <rect className={cutAt === 'etl' ? 'ib-new' : 'ib-use'} x={206} y={30} width={250} height={196} rx={10} />
          <text x={220} y={58} className="ib-n">{T.etl}</text>
          {T.chips.map((c, i) => (
            <g key={c}>
              <rect className="ib-node" x={220} y={70 + i * 30} width={224} height={26} rx={8} />
              <text x={230} y={88 + i * 30} className="ib-s" style={{ fontSize: 14, fill: 'var(--fg)' }}>{c}</text>
            </g>
          ))}
          {cutAt === 'etl' && <text x={220} y={216} className="ib-n" style={{ fill: 'var(--ib-bad)' }}>✗ 137</text>}
          <path className={cutAt === 'etl' ? 'ib-arrow-bad' : 'ib-arrow'} d="M456,100 L500,100" style={cutAt === 'etl' ? { opacity: 0.3 } : undefined} />
          <rect className={cutAt === 'net' ? 'ib-new' : cutAt === 'etl' ? 'ib-skip' : 'ib-zone'} x={500} y={30} width={190} height={150} rx={10} />
          <Lines x={512} y={58} text={T.net} max={18} lh={20} className="ib-n" />
          <path className={cutAt === 'db' || cutAt === 'none' ? 'ib-arrow' : 'ib-arrow-bad'} d="M690,100 L730,100" style={cutAt === 'etl' ? { opacity: 0.3 } : undefined} />
          <rect className={cutAt === 'db' ? 'ib-new' : cutAt === 'none' ? 'ib-use' : 'ib-skip'} x={730} y={30} width={136} height={96} rx={10} />
          <text x={742} y={62} className="ib-n">db</text>
          <text x={742} y={86} className="ib-s">{T.db}</text>
          <rect className="ib-node" x={730} y={140} width={136} height={40} rx={9} />
          <text x={742} y={166} className="ib-s">{T.vol}</text>
          <text x={14} y={262} className="ib-n" style={{ fill: failed ? 'var(--ib-bad)' : 'var(--accent)' }}>{failed ? `✗ ${T.where[brk]}` : `✓ ${T.where[brk]}`}</text>
          <text x={14} y={298} className="ib-t">{T.ladder}</text>
          {T.cmds.map((c, i) => (
            <g key={c}>
              <rect className="ib-node" x={14} y={312 + i * 48} width={852} height={40} rx={8} />
              <text x={28} y={337 + i * 48} className="ib-m" style={{ fontSize: 14, fill: 'var(--accent)' }}>{`${i + 1}. ${c}`}</text>
              <text x={292} y={337 + i * 48} className="ib-m" style={{ fontSize: 13, fill: 'var(--fg)' }}>{outputs[i].length > 62 ? outputs[i].slice(0, 61) + '…' : outputs[i]}</text>
            </g>
          ))}
        </svg>
      </div>
      <div className="readout" aria-live="polite"><div>{T.readout[brk]}</div></div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
