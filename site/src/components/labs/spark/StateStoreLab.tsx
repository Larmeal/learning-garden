import { useState } from 'react';
import { ClockControls, mix, prog, smooth, useClock, type Lang, type Mark } from './timeline';

// What a stateful streaming aggregation does in every micro-batch, partition by partition (statefulOperators.scala:
// 732-998, StateStoreRDD.scala:130): StateStoreRestoreExec reads the old count of each key (read only), the aggregate
// above merges it with the new rows, StateStoreSaveExec writes the new counts and, when the iterator closes, commits the
// next version of the store. The HDFS-backed provider (default) writes one .delta per version and merges deltas into a
// snapshot once at least minDeltasForSnapshot (10, internal) deltas exist, a maintenance job that runs in the background.
// The RocksDB provider keeps state on disk and writes changelog, .zip snapshot and .sst files. Measured
// (exercises/09_streaming.py): a delta file exists with the default provider, and .sst/.zip with RocksDB; the count of
// the query is the same. The input keys and the exact moment of the snapshot are made up for the picture.

type Provider = 'hdfs' | 'rocks';
const INPUT = ['a', 'b', 'a', 'c', 'a', 'b', 'c', 'a', 'b', 'a', 'c', 'a'];
const KEYS = ['a', 'b', 'c'];
const KEYCLS = [0, 1, 2];
const PER = 1.15;
const DURATION = INPUT.length * PER + 1.2;
const SNAP_AT = 11; // version at which the background job has merged the deltas (picture only)

const MARKS_TH: Mark[] = [
  { at: 0, name: 'batch 0', title: 'แถวใหม่เข้ามา: state ยังว่าง', text: 'ทุก batch ผ่านสามขั้นต่อ partition: Restore อ่านค่าเก่าของ key จาก state store, aggregate รวมกับแถวใหม่, Save เขียนค่าใหม่กลับและ commit เป็นเวอร์ชันถัดไป' },
  { at: PER * 3, name: 'สะสม', title: 'state จำค่าข้าม batch', text: 'key a ที่เห็นใน batch ก่อนๆ มี count สะสมอยู่ แถวใหม่ของ a ถูกบวกเข้าไปจึงไม่เริ่มนับใหม่ นี่คือสิ่งที่ checkpoint ของ state เก็บไว้ให้รีสตาร์ทต่อได้' },
  { at: PER * 9, name: 'snapshot', title: 'ไฟล์ delta สะสมจนถึง 10 แล้วรวมเป็น snapshot', text: 'ถ้าไม่รวม การกู้ state ต้องอ่าน delta ทุกเวอร์ชันตั้งแต่ต้น provider แบบ HDFS จึงให้งาน maintenance เบื้องหลังรวม delta เมื่อมีอย่างน้อย minDeltasForSnapshot (10, internal) ส่วน RocksDB เก็บ state บน disk ของ executor จึงรับ state ใหญ่กว่า memory ได้' },
];

const MARKS_EN: Mark[] = [
  { at: 0, name: 'batch 0', title: 'A new row arrives: the state is still empty', text: 'Every batch goes through three steps per partition: Restore reads the old value of the key from the state store, the aggregate merges it with the new row, and Save writes the new value back and commits it as the next version.' },
  { at: PER * 3, name: 'Accumulate', title: 'The state remembers values across batches', text: 'Key a, which appeared in earlier batches, already has a running count. The new row of a is added to it, so counting does not start again. This is what the checkpoint of the state keeps so that a restart can continue.' },
  { at: PER * 9, name: 'snapshot', title: 'Delta files pile up to 10, then are merged into a snapshot', text: 'Without merging, recovering the state would have to read the delta of every version from the start. So the HDFS provider lets a background maintenance job merge the deltas once there are at least minDeltasForSnapshot (10, internal). RocksDB keeps the state on the disk of the executor, so it can hold a state bigger than memory.' },
];
const MARKS: Record<Lang, Mark[]> = { th: MARKS_TH, en: MARKS_EN };

const TEXT: Record<Lang, {
  boxes: { name: string; sub: string }[]; title: string; groupLabel: string; hdfsBtn: string; svgLabel: string; incoming: string;
  store: (v: number) => string; countLabel: string; readOld: (k: string, n: number) => string; write: (k: string, n: number) => string;
  stateDir: (hdfs: boolean) => string; snapshot: string; rocksExtra: string; restart: string; load: (v: number) => string;
  hdfsRecover: (snap: boolean, v: number) => string; rocksRecover: string; hdfsMem: string; rocksMem: string; caption: string;
}> = {
  th: {
    boxes: [
      { name: 'StateStoreRestoreExec', sub: 'อ่านค่าเก่าของ key (อ่านอย่างเดียว)' },
      { name: 'HashAggregate', sub: 'รวมค่าเก่ากับแถวใหม่' },
      { name: 'StateStoreSaveExec', sub: 'เขียนค่าใหม่ แล้ว commit เวอร์ชันถัดไป' },
    ],
    title: 'Operator ที่มี state: Restore, รวม, Save ในทุก batch', groupLabel: 'provider ของ state', hdfsBtn: 'HDFSBackedStateStoreProvider (ค่าเริ่มต้น)',
    svgLabel: 'การทำงานของ state store ในแต่ละ batch', incoming: 'แถวที่เข้ามา (1 แถวต่อ batch)',
    store: (v) => `state store (เวอร์ชัน ${v})`, countLabel: 'count', readOld: (k, n) => `อ่านค่าเก่าของ ${k}: ${n}`, write: (k, n) => `เขียน ${k} = ${n}`,
    stateDir: (hdfs) => `state/ ใน checkpoint (${hdfs ? 'HDFS-backed' : 'RocksDB'})`, snapshot: 'snapshot (รวม delta เก่าแล้ว)',
    rocksExtra: '+ snapshot .zip และไฟล์ .sst ของ RocksDB (บน disk ของ executor)', restart: 'ถ้ารีสตาร์ทตอนนี้', load: (v) => `โหลดเวอร์ชัน ${v}`,
    hdfsRecover: (snap, v) => (snap ? 'snapshot + delta ที่ใหม่กว่า' : `อ่าน delta 1 ถึง ${v}`), rocksRecover: 'โหลดจาก snapshot แล้ว replay changelog',
    hdfsMem: 'state ใน memory ของ executor', rocksMem: 'state ใหญ่กว่า memory ได้',
    caption: 'ขั้นตอน Restore, aggregate, Save และการ commit เป็นเวอร์ชันถัดไปอ่านจาก statefulOperators.scala และ StateStoreRDD.scala (Spark 4.2.0) ตรวจจริงว่า provider แบบ HDFS สร้างไฟล์ .delta และ RocksDB สร้าง .sst กับ .zip โดยผลนับเท่ากัน (exercises/09_streaming.py) ลำดับ key ในภาพเป็นตัวอย่าง และจังหวะที่ delta ถูกรวมเป็น snapshot เป็นภาพประกอบ (งานเบื้องหลังจริงไม่ได้เกิดที่ batch ตายตัว)',
  },
  en: {
    boxes: [
      { name: 'StateStoreRestoreExec', sub: 'Read old value of key (read only)' },
      { name: 'HashAggregate', sub: 'Merge old value with new row' },
      { name: 'StateStoreSaveExec', sub: 'Write new value, commit next version' },
    ],
    title: 'An operator with state: Restore, merge, Save in every batch', groupLabel: 'state provider', hdfsBtn: 'HDFSBackedStateStoreProvider (default)',
    svgLabel: 'How the state store works in each batch', incoming: 'Incoming rows (1 row per batch)',
    store: (v) => `state store (version ${v})`, countLabel: 'count', readOld: (k, n) => `Read old value of ${k}: ${n}`, write: (k, n) => `Write ${k} = ${n}`,
    stateDir: (hdfs) => `state/ in the checkpoint (${hdfs ? 'HDFS-backed' : 'RocksDB'})`, snapshot: 'snapshot (old deltas merged)',
    rocksExtra: '+ snapshot .zip and RocksDB .sst files (on the executor disk)', restart: 'If restarted now', load: (v) => `Load version ${v}`,
    hdfsRecover: (snap, v) => (snap ? 'snapshot + newer deltas' : `Read delta 1 to ${v}`), rocksRecover: 'Load snapshot, replay changelog',
    hdfsMem: 'State in executor memory', rocksMem: 'State can exceed memory',
    caption: 'The steps Restore, aggregate, Save and the commit to the next version are read from statefulOperators.scala and StateStoreRDD.scala (Spark 4.2.0). We checked that the HDFS provider creates .delta files and RocksDB creates .sst and .zip files, with the same counts (exercises/09_streaming.py). The key order in the picture is an example, and the moment when deltas are merged into a snapshot is an illustration (the real background job does not run at a fixed batch).',
  },
};

export default function StateStoreLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [prov, setProv] = useState<Provider>('hdfs');
  const clock = useClock(DURATION);
  const { t } = clock;
  const batch = Math.min(INPUT.length - 1, Math.floor(t / PER));
  const local = t - batch * PER;
  const phase = local < 0.3 ? 0 : local < 0.55 ? 1 : local < 0.8 ? 2 : local < 1.05 ? 3 : 4;

  // counts after each batch
  const counts: number[][] = [];
  const run = [0, 0, 0];
  INPUT.forEach((k) => {
    run[KEYS.indexOf(k)]++;
    counts.push([...run]);
  });
  const doneBatches = t >= INPUT.length * PER ? INPUT.length : Math.max(0, Math.floor(t / PER) + (local >= 1.05 ? 1 : 0));
  const shown = doneBatches === 0 ? [0, 0, 0] : counts[doneBatches - 1];
  const cur = INPUT[batch];
  const curIdx = KEYS.indexOf(cur);
  const versions = doneBatches;
  const snapshotOn = prov === 'hdfs' && versions >= SNAP_AT;

  const boxes = T.boxes;
  const active = phase === 1 ? 0 : phase === 2 ? 1 : phase === 3 ? 2 : -1;

  return (
    <figure className="viz lg">
      <div className="viz-title">{T.title}</div>
      <div className="viz-steps" role="group" aria-label={T.groupLabel}>
        <button type="button" aria-pressed={prov === 'hdfs'} onClick={() => { setProv('hdfs'); clock.restart(); }}>{T.hdfsBtn}</button>
        <button type="button" aria-pressed={prov === 'rocks'} onClick={() => { setProv('rocks'); clock.restart(); }}>RocksDBStateStoreProvider</button>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 490" role="img" aria-label={T.svgLabel}>
          <rect className="band" x="10" y="10" width="860" height="470" rx="12" />

          {/* input queue */}
          <text className="b" x="28" y="38">{T.incoming}</text>
          <g transform="translate(28 50)">
            {INPUT.map((k, i) => {
              const ki = KEYS.indexOf(k);
              const used = i < batch || (i === batch && phase >= 1);
              return (
                <g key={i} transform={`translate(${(i % 6) * 46} ${Math.floor(i / 6) * 40})`} opacity={used ? 0.3 : 1}>
                  <circle cx="16" cy="16" r="14" className={`k${KEYCLS[ki] + 1}`} stroke={i === batch ? 'var(--accent)' : undefined} strokeWidth={i === batch ? 3 : undefined} />
                  <text className="dl" x="16" y="20" style={{ fontSize: 13 }}>{k}</text>
                  <text className="s m" x="16" y="38" textAnchor="middle">{i}</text>
                </g>
              );
            })}
          </g>

          {/* operator chain */}
          {boxes.map((b, i) => {
            const y = 150 + i * 62;
            return (
              <g key={b.name} transform={`translate(60 ${y})`}>
                <rect className={active === i ? 'fx-hot' : 'box'} width="300" height="50" rx="9" />
                <text className="m b" x="12" y="21" style={{ fontSize: 12.5 }}>{b.name}</text>
                <text className="s" x="12" y="40">{b.sub}</text>
                {i < 2 && <line x1="150" y1="50" x2="150" y2="62" stroke="var(--line-strong)" strokeWidth="2" />}
              </g>
            );
          })}
          <circle cx="372" cy={mix(138, 330, prog(local, 0, 1.05))} r="9" className={`k${KEYCLS[curIdx] + 1}`} />
          <text className="dl" x="372" y={mix(138, 330, prog(local, 0, 1.05)) + 4}>{cur}</text>

          {/* state table */}
          <g transform="translate(440 140)">
            <text className="b">{T.store(versions)}</text>
            <rect className="box" y="12" width="190" height="136" rx="9" />
            {KEYS.map((k, i) => {
              const hot = (phase === 1 || phase === 3) && i === curIdx;
              return (
                <g key={k} transform={`translate(12 ${32 + i * 36})`}>
                  <circle cx="14" cy="0" r="12" className={`k${i + 1}`} />
                  <text className="dl" x="14" y="4">{k}</text>
                  <rect x="40" y="-14" width="130" height="28" rx="6" className={hot ? 'fx-hot' : 'box'} />
                  <text className="m b num" x="52" y="5">{T.countLabel} = {shown[i]}</text>
                </g>
              );
            })}
            {phase === 1 && <text className="s b acc" y="172">{T.readOld(cur, shown[curIdx])}</text>}
            {phase === 3 && <text className="s b acc" y="172">{T.write(cur, shown[curIdx] + 1)}</text>}
          </g>

          {/* checkpoint files */}
          <g transform="translate(28 352)">
            <text className="b">{T.stateDir(prov === 'hdfs')}</text>
            <g transform="translate(0 12)">
              {Array.from({ length: INPUT.length }, (_, i) => {
                const on = i < versions;
                const merged = snapshotOn && i < SNAP_AT - 1;
                const label = prov === 'hdfs' ? `${i + 1}.delta` : `${i + 1}.changelog`;
                return (
                  <g key={i} transform={`translate(${(i % 6) * 100} ${Math.floor(i / 6) * 40})`} opacity={on ? (merged ? 0.4 : 1) : 0}>
                    <rect width={prov === 'hdfs' ? 92 : 108} height="30" rx="6" className={i === versions - 1 && local < 1.6 ? 'fx-hot' : 'box'} />
                    <text className="s m" x="8" y="20">{label}</text>
                  </g>
                );
              })}
              {snapshotOn && (
                <g transform="translate(0 84)">
                  <rect width="268" height="30" rx="6" className="fx-hot" />
                  <text className="s m b" x="8" y="20">{T.snapshot}</text>
                </g>
              )}
              {prov === 'rocks' && (
                <g transform="translate(0 84)">
                  <rect width="590" height="30" rx="6" className="fx-file" />
                  <text className="s m" x="8" y="20">{T.rocksExtra}</text>
                </g>
              )}
            </g>
          </g>

          <g transform="translate(676 140)">
            <rect className="box" width="180" height="150" rx="9" />
            <text className="s" x="10" y="20">{T.restart}</text>
            <text className="b num" x="10" y="46" style={{ fontSize: 14 }}>{T.load(versions)}</text>
            <text className="s" x="10" y="70">{prov === 'hdfs' ? T.hdfsRecover(snapshotOn, versions) : T.rocksRecover}</text>
            <text className="s" x="10" y="92">{prov === 'hdfs' ? T.hdfsMem : T.rocksMem}</text>
          </g>
        </svg>
      </div>
      <ClockControls clock={clock} marks={MARKS[lang]} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
