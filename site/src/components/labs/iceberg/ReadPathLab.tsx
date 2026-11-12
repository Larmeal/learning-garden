import { useState } from 'react';
import { StepControls, useStepper, type Lang, type StepInfo } from '../spark/stepper';
import { Banner, Legend, Node, Num } from './ib';

// Shows:      one SELECT walking down the three layers (catalog, metadata, data) with a numbered arrow, and which manifests and files are
//             opened or never touched, for two filters. A one-line banner in the picture says what the current step does.
// Because:    the order "catalog, metadata.json, manifest list, manifests, data files" and the places where files are skipped are a path
//             in space. The book (Apache Iceberg: The Definitive Guide, chapter 3, figure 3-6, page 59) draws it the same way, as a numbered path.
// Control:    the steps move the arrow down one layer at a time; the filter switch changes which manifests are skipped at step 3
//             (a filter on the partition can skip manifests, a filter on order_id cannot) and which files are skipped at step 5.
// Conclusion: an engine opens a few small files on the way down, and most data files are never opened.
//
// The table and the counts are exercise 05 (8 manifests, 8 data files, 4 days; the day filter opens 2 and 2, order_id = 7 opens 8 manifests and 1 file).

type Filter = 'day' | 'id';

const TEXT: Record<Lang, {
  title: string; filter: string; f: Record<Filter, string>; engine: string; layers: [string, string, string];
  metaT: string; listT: string; listS: string; day: string; legend: [string, string, string];
  banner: (step: number, f: Filter, nm: number, nf: number) => string;
  steps: (f: Filter) => StepInfo[]; caption: string;
}> = {
  th: {
    title: 'ตาม SELECT หนึ่งคำสั่งลงไปทีละชั้น แล้วดูว่าเปิดไฟล์อะไรบ้าง และไฟล์ไหนไม่เคยถูกเปิดเลย',
    filter: 'Filter ของ Query', f: { day: 'ordered_at ของวันที่ 2', id: 'order_id = 7' }, engine: 'Query Engine', layers: ['ชั้น Catalog', 'ชั้น Metadata: Manifest List กับ Manifest m1 ถึง m8', 'ชั้น Data: Data File d1 ถึง d8'],
    metaT: 'Metadata File (metadata.json)', listT: 'Manifest List', listS: 'ช่วงวันของ Manifest ทั้ง 8 ไฟล์', day: 'วัน',
    legend: ['เปิดอ่าน', 'ข้ามได้ ไม่เคยเปิด', 'ยังไม่ถึงขั้นนี้'],
    banner: (s, f, nm, nf) => [
      'Engine ถาม Catalog ว่า Metadata File ปัจจุบันอยู่ที่ไหน',
      'เปิด Metadata File แล้วได้ Schema, วิธีแบ่ง Partition และ Snapshot ปัจจุบัน',
      f === 'day' ? 'Manifest List บอกว่าข้าม 6 จาก 8 Manifest ได้เลย' : 'ข้ามอะไรไม่ได้ จึงต้องเปิดทั้ง 8 Manifest',
      f === 'day' ? 'เปิดเพียง 2 Manifest ที่เหลือ' : 'ดู Min/Max ของทั้ง 8 ไฟล์ แล้วเหลือ Data File ไฟล์เดียว',
      f === 'day' ? 'อ่าน Data File แค่ 2 ไฟล์' : 'อ่าน Data File แค่ 1 ไฟล์',
      `เปิด Manifest ${nm} จาก 8 และ Data File ${nf} จาก 8`,
    ][s],
    steps: (f) => [
      { name: 'ถาม Catalog', title: '1. Engine ถาม Catalog ว่า Metadata File ปัจจุบันอยู่ที่ไหน', text: 'Catalog ตอบแค่ตำแหน่งของไฟล์ ยังไม่มีข้อมูลของตารางเลย Engine จึงต้องเปิดไฟล์นั้นต่อ' },
      { name: 'metadata.json', title: '2. เปิด Metadata File (metadata.json)', text: 'ในไฟล์นี้มี Schema, วิธีแบ่ง Partition และ current-snapshot-id ซึ่งบอกว่า Manifest List ของ Snapshot ปัจจุบันอยู่ที่ไหน' },
      f === 'day'
        ? { name: 'Manifest List', title: '3. เปิด Manifest List แล้วข้าม Manifest ที่ไม่มีวันที่ 2', text: 'แต่ละแถวมีช่วงวันของ Partition ในแต่ละ Manifest เมื่อเทียบกับ Filter แล้วจะข้ามได้ 6 จาก 8 ไฟล์ โดยไม่ต้องเปิด (คำนวณจากช่วงใน Manifest List ตามแบบฝึก 05)' }
        : { name: 'Manifest List', title: '3. เปิด Manifest List แต่ข้ามอะไรไม่ได้', text: 'Manifest List มีแค่ช่วงของ Partition และไม่มีสถิติของ order_id เราจึงต้องเปิดทั้ง 8 Manifest เพื่อดู Min/Max ของแต่ละไฟล์' },
      { name: 'Manifest', title: '4. เปิด Manifest ที่เหลือ', text: f === 'day' ? 'ในแต่ละ Manifest มีค่า Partition และ Min/Max ของแต่ละ Column ต่อ Data File ซึ่งไฟล์ในช่วงวันที่ 2 ผ่านเงื่อนไขทั้งสองไฟล์' : 'ดู Min/Max ของ order_id ของทุกไฟล์ จะเห็นว่าไฟล์ที่ช่วง 6 ถึง 10 เท่านั้นที่อาจมี 7 ส่วนอีก 7 ไฟล์ถูกตัดทิ้ง' },
      { name: 'Data File', title: '5. เปิดเฉพาะ Data File ที่เหลือ', text: f === 'day' ? 'อ่าน Parquet 2 ไฟล์ ส่วนอีก 6 ไฟล์ไม่เคยถูกเปิดเลย' : 'อ่าน Parquet ไฟล์เดียว ส่วนอีก 7 ไฟล์ไม่เคยถูกเปิด' },
      { name: 'ผลลัพธ์', title: 'ผลลัพธ์กลับไปที่ Engine', text: f === 'day' ? 'เปิด Data File น้อยมากเมื่อเทียบกับทั้งตาราง แต่ก็ต้องเปิดไฟล์ Metadata ตามทางทุกชั้น' : 'Filter บน Column ที่ไม่ได้เป็น Partition ทำให้ต้องเปิด Manifest ครบ แต่สุดท้ายก็อ่าน Data File แค่ไฟล์เดียว' },
    ],
    caption: 'โครงสร้างและตัวเลขจากแบบฝึก 05 (Manifest 8 ไฟล์ Data File 8 ไฟล์) ลำดับเดียวกับที่หนังสือ Apache Iceberg: The Definitive Guide บทที่ 3 หน้า 59 (Figure 3-6) วาดไว้',
  },
  en: {
    title: 'Follow one SELECT down the layers, one step at a time, and see which files are opened and which are never touched',
    filter: 'Filter of the query', f: { day: 'ordered_at on day 2', id: 'order_id = 7' }, engine: 'Query engine', layers: ['Catalog layer', 'Metadata layer: manifest list and manifests m1 to m8', 'Data layer: data files d1 to d8'],
    metaT: 'Metadata file (metadata.json)', listT: 'Manifest list', listS: 'day range of all 8 manifests', day: 'day',
    legend: ['opened', 'skipped, never opened', 'not reached yet'],
    banner: (s, f, nm, nf) => [
      'The engine asks the catalog where the current metadata file is',
      'Open it: schema, partitioning and the current snapshot',
      f === 'day' ? 'The manifest list says 6 of the 8 manifests can be skipped' : 'Nothing can be skipped: all 8 manifests must be opened',
      f === 'day' ? 'Open just the 2 manifests that are left' : 'Read min/max of all 8 files: only one data file is left',
      f === 'day' ? 'Read only 2 data files' : 'Read only 1 data file',
      `Opened ${nm} of 8 manifests and ${nf} of 8 data files`,
    ][s],
    steps: (f) => [
      { name: 'ask the catalog', title: '1. The engine asks the catalog where the current metadata file is', text: 'The catalog only answers with the location of a file. There is no table data yet. The engine has to open that file next.' },
      { name: 'metadata.json', title: '2. Open the metadata file (metadata.json)', text: 'It gives the schema, the partitioning and the current-snapshot-id, which says where the manifest list of the current snapshot is.' },
      f === 'day'
        ? { name: 'manifest list', title: '3. Open the manifest list and skip the manifests with no day 2', text: 'Each row has the range of partition days in a manifest. Compared with the filter, 6 of the 8 can be skipped without being opened (computed from the ranges in the manifest list, as in exercise 05).' }
        : { name: 'manifest list', title: '3. Open the manifest list, but nothing can be skipped', text: 'The manifest list has only partition ranges and no order_id statistics, so all 8 manifests must be opened to see the min/max of each file.' },
      { name: 'manifest', title: '4. Open the manifests that are left', text: f === 'day' ? 'Each manifest has the partition value and the min/max of every column per data file. The files in the day 2 range both pass.' : 'Look at the min/max of order_id for every file. Only the file with range 6 to 10 can hold 7, and the other 7 files are ruled out.' },
      { name: 'data file', title: '5. Open only the data files that are left', text: f === 'day' ? 'Two Parquet files are read. The other 6 files are never opened.' : 'One Parquet file is read. The other 7 files are never opened.' },
      { name: 'result', title: 'The result goes back to the engine', text: f === 'day' ? 'Very few data files were opened compared with the whole table, but metadata files were opened on every layer on the way.' : 'A filter that is not on the partition must open every manifest, but still reads only one data file.' },
    ],
    caption: 'Structure and numbers from exercise 05 (8 manifests, 8 data files). The order is the one the book Apache Iceberg: The Definitive Guide draws in chapter 3, page 59 (figure 3-6).',
  },
};

const MX = (i: number) => 206 + i * 83;
const day = (i: number) => Math.floor(i / 2) + 1;

export default function ReadPathLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [filter, setFilter] = useState<Filter>('day');
  const steps = T.steps(filter);
  const { step, go, playing, toggle } = useStepper(steps.length, 5200);

  const manKeep = (i: number) => (filter === 'day' ? day(i) === 2 : true);
  const fileKeep = (i: number) => (filter === 'day' ? day(i) === 2 : i === 1);
  const showMan = step >= 2;
  const manOpened = (i: number) => step >= 3 && manKeep(i);
  const fileOpened = (i: number) => step >= 4 && manKeep(i) && fileKeep(i);
  const nm = Array.from({ length: 8 }, (_, i) => manKeep(i)).filter(Boolean).length;
  const nf = Array.from({ length: 8 }, (_, i) => manKeep(i) && fileKeep(i)).filter(Boolean).length;

  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={[{ kind: 'new', text: T.legend[0] }, { kind: 'skip', text: T.legend[1] }, { kind: 'node', text: T.legend[2] }]} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.filter}</span>
        <span className="seg" role="group" aria-label={T.filter}>
          {(['day', 'id'] as Filter[]).map((k) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>{T.f[k]}</button>
          ))}
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 480" role="img" aria-label={T.title}>
          <defs>
            <marker id="ibah3" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9z" style={{ fill: 'var(--accent)' }} /></marker>
          </defs>
          <rect className="ib-zone" x={192} y={14} width={680} height={90} rx={10} />
          <rect className="ib-zone" x={192} y={114} width={680} height={162} rx={10} />
          <rect className="ib-zone" x={192} y={286} width={680} height={116} rx={10} />
          <text x={862} y={36} textAnchor="end" className="ib-layer">{T.layers[0]}</text>
          <text x={862} y={136} textAnchor="end" className="ib-layer">{T.layers[1]}</text>
          <text x={862} y={396} textAnchor="end" className="ib-layer">{T.layers[2]}</text>

          {/* engine */}
          <rect className={step === 5 ? 'ib-new' : 'ib-use'} x={10} y={140} width={164} height={150} rx={12} />
          <text x={24} y={172} className="ib-n">{T.engine}</text>
          <text x={24} y={204} className="ib-m">SELECT ...</text>
          <text x={24} y={226} className="ib-m">WHERE</text>
          <text x={24} y={248} className="ib-m">{filter === 'day' ? 'ordered_at = day 2' : 'order_id = 7'}</text>

          {/* layers */}
          <Node x={206} y={36} w={320} h={50} title="Catalog" sub="db.orders → v3.metadata.json" state={step === 0 ? 'new' : 'node'} />
          <Node x={206} y={150} w={250} h={58} title={T.metaT} sub="schema · partition · snapshot" state={step === 1 ? 'new' : 'node'} mono={false} />
          <Node x={470} y={150} w={392} h={58} title={T.listT} sub={T.listS} state={step === 2 ? 'new' : 'node'} mono={false} />

          {Array.from({ length: 8 }, (_, i) => {
            const mSkip = showMan && !manKeep(i);
            const fSkip = (showMan && !manKeep(i)) || (step >= 3 && !fileKeep(i));
            return (
              <g key={i}>
                <path className="ib-line" d={`M${MX(i) + 38},262 L${MX(i) + 38},322`} style={{ opacity: manOpened(i) ? 1 : 0.25, stroke: manOpened(i) ? 'var(--accent)' : undefined, strokeWidth: manOpened(i) ? 3 : 2 }} />
                <Node x={MX(i)} y={222} w={76} h={50} title={`m${i + 1}`} sub={`${T.day} ${day(i)}`} mono={false} state={manOpened(i) ? 'new' : mSkip ? 'skip' : 'node'} />
                <Node x={MX(i)} y={322} w={76} h={56} title={`d${i + 1}`} sub={filter === 'day' ? `${T.day} ${day(i)}` : `${5 * i + 1}-${5 * i + 5}`} mono={false} state={fileOpened(i) ? 'new' : fSkip ? 'skip' : 'node'} />
              </g>
            );
          })}

          {/* the numbered arrow of the current step */}
          {step === 0 && <g><path className="ib-arrow" d="M92,138 L92,61 L202,61" markerEnd="url(#ibah3)" /><Num x={92} y={100} n={1} /></g>}
          {step === 1 && <g><path className="ib-arrow" d="M176,179 L202,179" markerEnd="url(#ibah3)" /><Num x={190} y={214} n={2} /></g>}
          {step === 2 && <Num x={470} y={150} n={3} />}
          {step === 3 && <Num x={MX(filter === 'day' ? 2 : 0)} y={222} n={4} />}
          {step === 4 && <Num x={MX(filter === 'day' ? 2 : 1)} y={322} n={5} />}

          <Banner y={418} text={T.banner(step, filter, nm, nf)} />
        </svg>
      </div>
      <StepControls steps={steps} step={step} playing={playing} go={go} toggle={toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
