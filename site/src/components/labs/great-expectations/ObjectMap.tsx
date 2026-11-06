import { useState } from 'react';
import type { Lang } from '../../../i18n';

interface NodeText {
  label: string;
  sub: string;
  what: string;
  code: string;
  where: string;
}

interface Node extends NodeText {
  id: string;
  x: number;
  y: number;
  group: 'data' | 'expect' | 'run' | 'out' | 'runtime' | 'store';
}

const W = 200;
const H = 56;

// Positions and groups are shared. Texts are per language (code lines are the same in both).
const LAYOUT: { id: string; x: number; y: number; group: Node['group'] }[] = [
  { id: 'ds', x: 40, y: 50, group: 'data' },
  { id: 'asset', x: 40, y: 140, group: 'data' },
  { id: 'bd', x: 40, y: 230, group: 'data' },
  { id: 'exp', x: 320, y: 50, group: 'expect' },
  { id: 'suite', x: 320, y: 140, group: 'expect' },
  { id: 'vd', x: 320, y: 260, group: 'run' },
  { id: 'cp', x: 600, y: 260, group: 'run' },
  { id: 'actions', x: 600, y: 150, group: 'out' },
  { id: 'docs', x: 600, y: 50, group: 'out' },
  { id: 'runtime', x: 600, y: 350, group: 'runtime' },
  { id: 'store', x: 40, y: 350, group: 'store' },
];

const NODE_TEXT: Record<Lang, Record<string, NodeText>> = {
  th: {
    ds: {
      label: 'Data Source', sub: 'ที่ข้อมูลอยู่',
      what: 'แทนที่เก็บข้อมูลหนึ่งแห่งและวิธีเชื่อมต่อ เช่น pandas, ไฟล์ในโฟลเดอร์, ฐานข้อมูล SQL, Spark',
      code: 'source = context.data_sources.add_pandas("my_source")',
      where: 'เก็บใน config ของ context (ephemeral อยู่ใน memory, file อยู่ใน great_expectations.yml)',
    },
    asset: {
      label: 'Data Asset', sub: 'ชุดข้อมูลหนึ่งชุด',
      what: 'กลุ่มของระเบียนใน data source เช่น ตารางหนึ่งตาราง ไฟล์ CSV ชุดหนึ่ง หรือ DataFrame',
      code: 'asset = source.add_dataframe_asset("users")',
      where: 'เก็บพร้อม data source',
    },
    bd: {
      label: 'Batch Definition', sub: 'วิธีหยิบข้อมูลมาตรวจ',
      what: 'บอกว่าจะแบ่งข้อมูลของ asset อย่างไรและหยิบก้อนไหน (ทั้งก้อน, รายวัน, ไฟล์เดียว) เป็นแค่สูตร ยังไม่ได้อ่านข้อมูลจนกว่าจะขอ batch',
      code: 'bd = asset.add_batch_definition_whole_dataframe("all_users")',
      where: 'เก็บพร้อม data source',
    },
    exp: {
      label: 'Expectation', sub: 'ข้อคาดหวังหนึ่งข้อ',
      what: 'ข้อยืนยันที่ทดสอบได้เกี่ยวกับข้อมูล คล้าย assert ใน unit test เป็นคลาส Python',
      code: 'gxe.ExpectColumnValuesToNotBeNull(column="id")',
      where: 'อยู่ใน suite',
    },
    suite: {
      label: 'Expectation Suite', sub: 'ชุดของ expectation',
      what: 'กลุ่มของ expectation ที่ใช้ด้วยกัน ข้อมูลชุดเดียวมีได้หลาย suite ต้อง add เข้า context ก่อนจึงนำไปรันได้',
      code: 'suite = context.suites.add(gx.ExpectationSuite(name="users_suite"))',
      where: 'expectations store (ไฟล์ในโฟลเดอร์ expectations/ ถ้าเป็น file context)',
    },
    vd: {
      label: 'Validation Definition', sub: 'จับคู่ข้อมูลกับ suite',
      what: 'จับ batch definition คู่กับ suite หนึ่งชุด เรียก run() เพื่อตรวจและได้ผลลัพธ์ระดับ suite',
      code: 'vd = gx.ValidationDefinition(name="users_vd", data=bd, suite=suite)',
      where: 'validation definition store (เก็บเป็น "ชื่อ + id" ของ batch definition และ suite)',
    },
    cp: {
      label: 'Checkpoint', sub: 'รันหลายชุด แล้วทำ action',
      what: 'วิธีหลักที่ใช้ตรวจใน production รัน validation definition ชุดหนึ่งด้วยพารามิเตอร์ร่วมกัน แล้วสั่ง action',
      code: 'cp = context.checkpoints.add(gx.Checkpoint(name="daily", validation_definitions=[vd], actions=[...]))',
      where: 'checkpoint store (ไฟล์ในโฟลเดอร์ checkpoints/)',
    },
    actions: {
      label: 'Actions', sub: 'แจ้งเตือน / อัปเดตรายงาน',
      what: 'ขั้นตอนอัตโนมัติหลังตรวจเสร็จ เช่น ส่ง Slack, email, PagerDuty หรืออัปเดต Data Docs',
      code: 'gx.checkpoint.UpdateDataDocsAction(name="docs")',
      where: 'เป็นส่วนหนึ่งของ checkpoint',
    },
    docs: {
      label: 'Data Docs / ผล', sub: 'หน้า HTML และ validation result',
      what: 'ผลการตรวจถูกเก็บลง validation results store ทุกครั้งที่รัน และ Data Docs สร้างหน้า HTML ที่คนอ่านได้',
      code: 'uncommitted/data_docs/local_site/index.html',
      where: 'uncommitted/validations/ และ uncommitted/data_docs/',
    },
    runtime: {
      label: 'ตอนรัน (run time)', sub: 'DataFrame, batch_parameters',
      what: 'ข้อมูลที่ส่งเข้ามาตอนสั่งรัน เช่น DataFrame, พารามิเตอร์เลือก batch (ปี เดือน วัน) และ expectation_parameters ไม่ถูกเก็บไว้กับ object ข้างบน',
      code: 'cp.run(batch_parameters={"dataframe": df})',
      where: 'ไม่ถูกเก็บ (DataFrame ถูกแทนด้วยข้อความ placeholder ในผลที่บันทึก)',
    },
    store: {
      label: 'Stores', sub: 'ที่เก็บ suite, definition, checkpoint, ผล',
      what: 'ที่เก็บของ context: Store แปลง object เป็นข้อมูลที่เก็บได้ ส่วน StoreBackend เป็นที่เก็บจริง (memory, ไฟล์, S3, GCS, Azure, database, GX Cloud) validation definition กับ checkpoint อ้างของอื่นผ่านชื่อและ id ใน store นี้',
      code: 'context.validation_results_store.list_keys()',
      where: 'ตามชนิดของ context',
    },
  },
  en: {
    ds: {
      label: 'Data Source', sub: 'Where data lives',
      what: 'Stands for one place that holds data and how to connect to it, for example pandas, files in a folder, a SQL database, Spark.',
      code: 'source = context.data_sources.add_pandas("my_source")',
      where: 'Saved in the config of the context (ephemeral lives in memory, file lives in great_expectations.yml)',
    },
    asset: {
      label: 'Data Asset', sub: 'One set of data',
      what: 'A group of records in a data source, for example one table, one set of CSV files, or a DataFrame.',
      code: 'asset = source.add_dataframe_asset("users")',
      where: 'Saved together with the data source',
    },
    bd: {
      label: 'Batch Definition', sub: 'How to pick a batch',
      what: 'Says how to split the data of the asset and which piece to take (the whole thing, one day, one file). It is only a recipe. No data is read until you ask for a batch.',
      code: 'bd = asset.add_batch_definition_whole_dataframe("all_users")',
      where: 'Saved together with the data source',
    },
    exp: {
      label: 'Expectation', sub: 'One expectation',
      what: 'A testable statement about the data, like an assert in a unit test. It is a Python class.',
      code: 'gxe.ExpectColumnValuesToNotBeNull(column="id")',
      where: 'Lives in a suite',
    },
    suite: {
      label: 'Expectation Suite', sub: 'A set of expectations',
      what: 'A group of expectations that are used together. One dataset can have many suites. You must add it to the context before you can run it.',
      code: 'suite = context.suites.add(gx.ExpectationSuite(name="users_suite"))',
      where: 'The expectations store (a file in the expectations/ folder for a file context)',
    },
    vd: {
      label: 'Validation Definition', sub: 'Pairs data with a suite',
      what: 'Pairs a batch definition with one suite. Call run() to validate and get a result at the suite level.',
      code: 'vd = gx.ValidationDefinition(name="users_vd", data=bd, suite=suite)',
      where: 'The validation definition store (saved as the "name + id" of the batch definition and the suite)',
    },
    cp: {
      label: 'Checkpoint', sub: 'Runs several, then actions',
      what: 'The main way to validate in production. It runs a list of validation definitions with shared parameters, then triggers the actions.',
      code: 'cp = context.checkpoints.add(gx.Checkpoint(name="daily", validation_definitions=[vd], actions=[...]))',
      where: 'The checkpoint store (a file in the checkpoints/ folder)',
    },
    actions: {
      label: 'Actions', sub: 'Alerts / update reports',
      what: 'Automatic steps after validation finishes, for example sending Slack, email, PagerDuty, or updating Data Docs.',
      code: 'gx.checkpoint.UpdateDataDocsAction(name="docs")',
      where: 'Part of the checkpoint',
    },
    docs: {
      label: 'Data Docs / results', sub: 'HTML pages and results',
      what: 'The validation result is saved in the validation results store on every run, and Data Docs builds HTML pages that people can read.',
      code: 'uncommitted/data_docs/local_site/index.html',
      where: 'uncommitted/validations/ and uncommitted/data_docs/',
    },
    runtime: {
      label: 'At run time', sub: 'DataFrame, batch_parameters',
      what: 'Data passed in when you start the run, for example a DataFrame, batch parameters (year, month, day) and expectation_parameters. They are not saved with the objects above.',
      code: 'cp.run(batch_parameters={"dataframe": df})',
      where: 'Not saved (a DataFrame is replaced by a placeholder text in the saved result)',
    },
    store: {
      label: 'Stores', sub: 'Stores of suites, definitions, checkpoints, results',
      what: 'The storage of the context: a Store turns an object into data that can be saved, and a StoreBackend is the real place (memory, files, S3, GCS, Azure, database, GX Cloud). Validation definitions and checkpoints refer to other objects by name and id in these stores.',
      code: 'context.validation_results_store.list_keys()',
      where: 'Depends on the type of context',
    },
  },
};

const TEXT: Record<Lang, {
  title: string;
  ariaLabel: string;
  groupData: string;
  groupExpect: string;
  groupOut: string;
  where: string;
  caption: string;
}> = {
  th: {
    title: 'แผนที่ของชิ้นส่วนใน GX: แตะกล่องเพื่อดูว่าแต่ละชิ้นคืออะไร',
    ariaLabel: 'แผนผังความสัมพันธ์ของ Data Context, Data Source, Batch Definition, Expectation Suite, Validation Definition และ Checkpoint',
    groupData: 'ข้อมูล',
    groupExpect: 'ความคาดหวัง',
    groupOut: 'ผลและการแจ้ง',
    where: 'เก็บที่ไหน:',
    caption: 'เส้นประคือสิ่งที่ส่งตอนรัน ไม่ได้ถูกเก็บ อ่านจากซ้ายไปขวา: ระบุข้อมูล, เขียนความคาดหวัง, จับคู่เป็น validation definition, ให้ checkpoint รันแล้วทำ action',
  },
  en: {
    title: 'A map of the parts of GX: tap a box to see what each part is',
    ariaLabel: 'Diagram of how Data Context, Data Source, Batch Definition, Expectation Suite, Validation Definition and Checkpoint relate',
    groupData: 'Data',
    groupExpect: 'Expectations',
    groupOut: 'Results and alerts',
    where: 'Where it is kept:',
    caption: 'The dashed line is what you pass in at run time. It is not saved. Read from left to right: name the data, write the expectations, pair them as a validation definition, let a checkpoint run it and then do the actions.',
  },
};

// [from, to, label]
const EDGES: [string, string][] = [
  ['ds', 'asset'], ['asset', 'bd'], ['exp', 'suite'], ['bd', 'vd'], ['suite', 'vd'], ['vd', 'cp'], ['cp', 'actions'], ['actions', 'docs'], ['runtime', 'cp'],
];

function edgePath(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const ac = { x: a.x + W / 2, y: a.y + H / 2 };
  const bc = { x: b.x + W / 2, y: b.y + H / 2 };
  if (Math.abs(ac.x - bc.x) < 10) {
    const down = bc.y > ac.y;
    return `M${ac.x} ${down ? a.y + H : a.y} L${bc.x} ${down ? b.y : b.y + H}`;
  }
  if (Math.abs(ac.y - bc.y) < 10) return `M${a.x + W} ${ac.y} L${b.x} ${bc.y}`;
  return `M${a.x + W} ${ac.y} C${a.x + W + 60} ${ac.y} ${b.x - 40} ${bc.y} ${b.x} ${bc.y}`;
}

export default function ObjectMap({ lang = 'th' }: { lang?: Lang }) {
  const [pick, setPick] = useState('vd');
  const t = TEXT[lang];
  const NODES: Node[] = LAYOUT.map((l) => ({ ...l, ...NODE_TEXT[lang][l.id] }));
  const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));
  const node = byId[pick];

  return (
    <figure className="viz">
      <div className="viz-title">{t.title}</div>
      <div className="viz-box">
        <svg viewBox="0 0 880 440" role="img" aria-label={t.ariaLabel}>
          <defs>
            <marker id="gx-om" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path className="mk" d="M0 0 L10 5 L0 10 z" />
            </marker>
          </defs>
          <rect className="band" x="10" y="10" width="860" height="420" rx="18" />
          <text className="b m acc" x="28" y="34">Data Context</text>

          <text className="s" x="140" y="34" textAnchor="start">{t.groupData}</text>
          <text className="s" x="420" y="34">{t.groupExpect}</text>
          <text className="s" x="700" y="34">{t.groupOut}</text>

          {EDGES.map(([f, to]) => (
            <path key={f + to} className="ln" d={edgePath(byId[f], byId[to])} markerEnd="url(#gx-om)" strokeDasharray={f === 'runtime' ? '5 5' : undefined} />
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
        <span style={{ display: 'block', marginTop: 8 }}>{t.where} {node.where}</span>
      </div>

      <p className="viz-caption">{t.caption}</p>
    </figure>
  );
}
