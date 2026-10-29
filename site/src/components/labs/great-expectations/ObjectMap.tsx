import { useState } from 'react';

interface Node {
  id: string;
  label: string;
  sub: string;
  x: number;
  y: number;
  group: 'data' | 'expect' | 'run' | 'out' | 'runtime' | 'store';
  what: string;
  code: string;
  where: string;
}

const W = 200;
const H = 56;

const NODES: Node[] = [
  {
    id: 'ds', label: 'Data Source', sub: 'ที่ข้อมูลอยู่', x: 40, y: 50, group: 'data',
    what: 'แทนที่เก็บข้อมูลหนึ่งแห่งและวิธีเชื่อมต่อ เช่น pandas, ไฟล์ในโฟลเดอร์, ฐานข้อมูล SQL, Spark',
    code: 'source = context.data_sources.add_pandas("my_source")',
    where: 'เก็บใน config ของ context (ephemeral อยู่ใน memory, file อยู่ใน great_expectations.yml)',
  },
  {
    id: 'asset', label: 'Data Asset', sub: 'ชุดข้อมูลหนึ่งชุด', x: 40, y: 140, group: 'data',
    what: 'กลุ่มของระเบียนใน data source เช่น ตารางหนึ่งตาราง ไฟล์ CSV ชุดหนึ่ง หรือ DataFrame',
    code: 'asset = source.add_dataframe_asset("users")',
    where: 'เก็บพร้อม data source',
  },
  {
    id: 'bd', label: 'Batch Definition', sub: 'วิธีหยิบข้อมูลมาตรวจ', x: 40, y: 230, group: 'data',
    what: 'บอกว่าจะแบ่งข้อมูลของ asset อย่างไรและหยิบก้อนไหน (ทั้งก้อน, รายวัน, ไฟล์เดียว) เป็นแค่สูตร ยังไม่ได้อ่านข้อมูลจนกว่าจะขอ batch',
    code: 'bd = asset.add_batch_definition_whole_dataframe("all_users")',
    where: 'เก็บพร้อม data source',
  },
  {
    id: 'exp', label: 'Expectation', sub: 'ข้อคาดหวังหนึ่งข้อ', x: 320, y: 50, group: 'expect',
    what: 'ข้อยืนยันที่ทดสอบได้เกี่ยวกับข้อมูล คล้าย assert ใน unit test เป็นคลาส Python',
    code: 'gxe.ExpectColumnValuesToNotBeNull(column="id")',
    where: 'อยู่ใน suite',
  },
  {
    id: 'suite', label: 'Expectation Suite', sub: 'ชุดของ expectation', x: 320, y: 140, group: 'expect',
    what: 'กลุ่มของ expectation ที่ใช้ด้วยกัน ข้อมูลชุดเดียวมีได้หลาย suite ต้อง add เข้า context ก่อนจึงนำไปรันได้',
    code: 'suite = context.suites.add(gx.ExpectationSuite(name="users_suite"))',
    where: 'expectations store (ไฟล์ในโฟลเดอร์ expectations/ ถ้าเป็น file context)',
  },
  {
    id: 'vd', label: 'Validation Definition', sub: 'จับคู่ข้อมูลกับ suite', x: 320, y: 260, group: 'run',
    what: 'จับ batch definition คู่กับ suite หนึ่งชุด เรียก run() เพื่อตรวจและได้ผลลัพธ์ระดับ suite',
    code: 'vd = gx.ValidationDefinition(name="users_vd", data=bd, suite=suite)',
    where: 'validation definition store (เก็บเป็น "ชื่อ + id" ของ batch definition และ suite)',
  },
  {
    id: 'cp', label: 'Checkpoint', sub: 'รันหลายชุด แล้วทำ action', x: 600, y: 260, group: 'run',
    what: 'วิธีหลักที่ใช้ตรวจใน production รัน validation definition ชุดหนึ่งด้วยพารามิเตอร์ร่วมกัน แล้วสั่ง action',
    code: 'cp = context.checkpoints.add(gx.Checkpoint(name="daily", validation_definitions=[vd], actions=[...]))',
    where: 'checkpoint store (ไฟล์ในโฟลเดอร์ checkpoints/)',
  },
  {
    id: 'actions', label: 'Actions', sub: 'แจ้งเตือน / อัปเดตรายงาน', x: 600, y: 150, group: 'out',
    what: 'ขั้นตอนอัตโนมัติหลังตรวจเสร็จ เช่น ส่ง Slack, email, PagerDuty หรืออัปเดต Data Docs',
    code: 'gx.checkpoint.UpdateDataDocsAction(name="docs")',
    where: 'เป็นส่วนหนึ่งของ checkpoint',
  },
  {
    id: 'docs', label: 'Data Docs / ผล', sub: 'หน้า HTML และ validation result', x: 600, y: 50, group: 'out',
    what: 'ผลการตรวจถูกเก็บลง validation results store ทุกครั้งที่รัน และ Data Docs สร้างหน้า HTML ที่คนอ่านได้',
    code: 'uncommitted/data_docs/local_site/index.html',
    where: 'uncommitted/validations/ และ uncommitted/data_docs/',
  },
  {
    id: 'runtime', label: 'ตอนรัน (run time)', sub: 'DataFrame, batch_parameters', x: 600, y: 350, group: 'runtime',
    what: 'ข้อมูลที่ส่งเข้ามาตอนสั่งรัน เช่น DataFrame, พารามิเตอร์เลือก batch (ปี เดือน วัน) และ expectation_parameters ไม่ถูกเก็บไว้กับ object ข้างบน',
    code: 'cp.run(batch_parameters={"dataframe": df})',
    where: 'ไม่ถูกเก็บ (DataFrame ถูกแทนด้วยข้อความ placeholder ในผลที่บันทึก)',
  },
  {
    id: 'store', label: 'Stores', sub: 'ที่เก็บ suite, definition, checkpoint, ผล', x: 40, y: 350, group: 'store',
    what: 'ที่เก็บของ context: Store แปลง object เป็นข้อมูลที่เก็บได้ ส่วน StoreBackend เป็นที่เก็บจริง (memory, ไฟล์, S3, GCS, Azure, database, GX Cloud) validation definition กับ checkpoint อ้างของอื่นผ่านชื่อและ id ใน store นี้',
    code: 'context.validation_results_store.list_keys()',
    where: 'ตามชนิดของ context',
  },
];

// [from, to, label]
const EDGES: [string, string][] = [
  ['ds', 'asset'], ['asset', 'bd'], ['exp', 'suite'], ['bd', 'vd'], ['suite', 'vd'], ['vd', 'cp'], ['cp', 'actions'], ['actions', 'docs'], ['runtime', 'cp'],
];

const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));

function edgePath(a: Node, b: Node): string {
  const ac = { x: a.x + W / 2, y: a.y + H / 2 };
  const bc = { x: b.x + W / 2, y: b.y + H / 2 };
  if (Math.abs(ac.x - bc.x) < 10) {
    const down = bc.y > ac.y;
    return `M${ac.x} ${down ? a.y + H : a.y} L${bc.x} ${down ? b.y : b.y + H}`;
  }
  if (Math.abs(ac.y - bc.y) < 10) return `M${a.x + W} ${ac.y} L${b.x} ${bc.y}`;
  return `M${a.x + W} ${ac.y} C${a.x + W + 60} ${ac.y} ${b.x - 40} ${bc.y} ${b.x} ${bc.y}`;
}

export default function ObjectMap() {
  const [pick, setPick] = useState('vd');
  const node = byId[pick];

  return (
    <figure className="viz">
      <div className="viz-title">แผนที่ของชิ้นส่วนใน GX: แตะกล่องเพื่อดูว่าแต่ละชิ้นคืออะไร</div>
      <div className="viz-box">
        <svg viewBox="0 0 880 440" role="img" aria-label="แผนผังความสัมพันธ์ของ Data Context, Data Source, Batch Definition, Expectation Suite, Validation Definition และ Checkpoint">
          <defs>
            <marker id="gx-om" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path className="mk" d="M0 0 L10 5 L0 10 z" />
            </marker>
          </defs>
          <rect className="band" x="10" y="10" width="860" height="420" rx="18" />
          <text className="b m acc" x="28" y="34">Data Context</text>

          <text className="s" x="140" y="34" textAnchor="start">ข้อมูล</text>
          <text className="s" x="420" y="34">ความคาดหวัง</text>
          <text className="s" x="700" y="34">ผลและการแจ้ง</text>

          {EDGES.map(([f, t]) => (
            <path key={f + t} className="ln" d={edgePath(byId[f], byId[t])} markerEnd="url(#gx-om)" strokeDasharray={f === 'runtime' ? '5 5' : undefined} />
          ))}

          {NODES.map((n) => {
            const sel = n.id === pick;
            return (
              <g
                key={n.id}
                className="pick"
                role="button"
                tabIndex={0}
                aria-pressed={sel}
                aria-label={`${n.label}: ${n.sub}`}
                onClick={() => setPick(n.id)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setPick(n.id))}
              >
                <rect
                  className={`box${sel ? ' sel' : ''}`}
                  x={n.x}
                  y={n.y}
                  width={n.id === 'store' ? 480 : W}
                  height={H}
                  rx="12"
                  strokeDasharray={n.group === 'runtime' ? '6 5' : undefined}
                />
                <text className="b" x={n.x + 14} y={n.y + 24}>{n.label}</text>
                <text className="s" x={n.x + 14} y={n.y + 42}>{n.sub}</text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="viz-now" aria-live="polite">
        <strong>{node.label}</strong>
        <span>{node.what}</span>
        <pre className="codeline" style={{ marginTop: 10 }}>{node.code}</pre>
        <span style={{ display: 'block', marginTop: 8 }}>เก็บที่ไหน: {node.where}</span>
      </div>

      <p className="viz-caption">
        เส้นประคือสิ่งที่ส่งตอนรัน ไม่ได้ถูกเก็บ อ่านจากซ้ายไปขวา: ระบุข้อมูล, เขียนความคาดหวัง, จับคู่เป็น validation definition, ให้ checkpoint รันแล้วทำ action
      </p>
    </figure>
  );
}
