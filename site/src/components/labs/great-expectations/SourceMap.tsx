import { useState } from 'react';

interface Hop {
  fn: string;
  file: string;
  does: string;
  tip: string;
}

type Lang = 'th' | 'en';

// The real call path, read from the 1.9.3 checkout and the 1.24.1 wheel (file and function names are the same in both).
const BASE: { fn: string; file: string }[] = [
  { fn: 'Checkpoint.run', file: 'checkpoint/checkpoint.py' },
  { fn: 'ValidationDefinition.run', file: 'core/validation_definition.py' },
  { fn: 'Validator.validate_expectation_suite', file: 'validator/v1_validator.py' },
  { fn: 'Validator.graph_validate', file: 'validator/validator.py' },
  { fn: 'ValidationGraph.resolve', file: 'validator/validation_graph.py' },
  { fn: 'ExecutionEngine.resolve_metrics', file: 'execution_engine/execution_engine.py' },
  { fn: 'resolve_metric_bundle', file: 'execution_engine/{sqlalchemy,sparkdf}_execution_engine.py' },
  { fn: 'Expectation.metrics_validate → _validate', file: 'expectations/expectation.py' },
];

const TEXT: Record<Lang, { title: string; tipLabel: string; caption: string; hops: { does: string; tip: string }[] }> = {
  th: {
    title: 'เส้นทางเรียกจริงของ GX จากคำสั่งรันจนถึงผลของ Expectation',
    tipLabel: 'ลองดู: ',
    caption: 'Knowledge Graph มีแต่เส้น imports/contains/exports/inherits (เส้น calls มี 44 เส้น) จึงไม่เห็นลำดับนี้ เราต้องอ่านซอร์สเอง ชื่อไฟล์และฟังก์ชันตรงกันทั้ง 1.9.3 และ 1.24.1 แต่เนื้อในบางไฟล์ต่างกัน',
    hops: [
      { does: 'ตรวจว่าทุกอย่างถูก add, วนรัน Validation Definition, สร้าง CheckpointResult, แล้วรัน Action', tip: 'ค้นหา _run_validation_definitions และ _run_actions' },
      { does: 'เช็ก Freshness, สร้าง Validator, ใส่ run_id ลง meta, เก็บผลลง Validation Results Store', tip: 'ทุกอย่างอ้างผ่าน Store ให้ดู _decode_suite และ _decode_data' },
      { does: 'ตัวห่อบาง ๆ ที่แปลง Suite เป็นรายการ Configuration แล้วส่งต่อให้ Validator ตัวเก่า และคำนวณสถิติ success_percent', tip: 'มี _wrapped_validator ที่สร้างตอนใช้ครั้งแรก (จุดแรกที่แตะข้อมูล)' },
      { does: 'ถาม Expectation ทุกตัวว่าต้องใช้ Metric อะไร แล้วรวมเป็นกราฟเดียว resolve จากนั้นให้ Expectation ตัดสิน โดย catch_exceptions จะทำให้ Error กลายเป็นผล fail', tip: 'อ่านสามเมธอด _generate_metric_dependency_subgraphs…, _generate_suite_level_graph…, _resolve_suite_level_graph…' },
      { does: 'วนเป็นรอบ โดยหา Metric ที่ Dependency พร้อมแล้ว (_parse) ส่งให้ Engine และลองซ้ำสูงสุด 3 ครั้งต่อ Metric', tip: 'MAX_METRIC_COMPUTATION_RETRIES = 3' },
      { does: 'แยก Metric เป็น direct (คำนวณทันที) กับ bundled (Aggregate ที่เลื่อนไว้รวมคำสั่ง) แล้วประมวลผล', tip: '_build_direct_and_bundled_metric_computation_configurations' },
      { does: 'SQL จะรวม Aggregate ของ Domain เดียวกันเป็น SELECT เดียว ส่วน Spark จะเป็น df.agg(...).collect() ครั้งเดียว', tip: 'pandas ไม่มี bundle' },
      { does: 'หยิบค่า Metric ที่ resolve แล้วมาตัดสิน success และจัดรูปผลตาม result_format', tip: 'ColumnMapExpectation._validate มี "vacuous truth" เมื่อไม่มีแถวให้พิจารณา' },
    ],
  },
  en: {
    title: 'The real call path of GX, from the run command to the result of an expectation',
    tipLabel: 'Try: ',
    caption: 'The knowledge graph only has imports/contains/exports/inherits edges (it has 44 calls edges), so it does not show this order. You have to read the source. File and function names are the same in 1.9.3 and 1.24.1, but some files differ inside.',
    hops: [
      { does: 'Checks that everything was added, loops over the validation definitions, builds a CheckpointResult, then runs the actions', tip: 'Search for _run_validation_definitions and _run_actions' },
      { does: 'Checks freshness, builds a Validator, puts run_id into meta, saves the result in the validation results store', tip: 'Everything goes through a store: see _decode_suite and _decode_data' },
      { does: 'A thin wrapper. It turns the suite into a list of configurations, hands them to the old Validator, and computes the success_percent statistics', tip: 'There is a _wrapped_validator, built on first use (the first place that touches the data)' },
      { does: 'Asks every expectation which metrics it needs, merges them into one graph, resolves it, then lets each expectation decide. catch_exceptions turns an error into a failed result', tip: 'Read the three methods _generate_metric_dependency_subgraphs…, _generate_suite_level_graph…, _resolve_suite_level_graph…' },
      { does: 'Loops in rounds: finds metrics whose dependencies are ready (_parse) and sends them to the engine, retrying each metric up to 3 times', tip: 'MAX_METRIC_COMPUTATION_RETRIES = 3' },
      { does: 'Splits metrics into direct (computed at once) and bundled (aggregates that are held back so they can be merged into one statement), then processes them', tip: '_build_direct_and_bundled_metric_computation_configurations' },
      { does: 'SQL: merges the aggregates of one domain into a single SELECT. Spark: one df.agg(...).collect() call', tip: 'pandas has no bundle' },
      { does: 'Takes the resolved metric values, decides success, and shapes the result according to result_format', tip: 'ColumnMapExpectation._validate has a "vacuous truth" when there are no rows to consider' },
    ],
  },
};

export default function SourceMap({ lang = 'th' }: { lang?: Lang }) {
  const t = TEXT[lang];
  const HOPS: Hop[] = BASE.map((b, n) => ({ ...b, ...t.hops[n] }));
  const [i, setI] = useState(0);
  const h = HOPS[i];
  return (
    <figure className="viz">
      <div className="viz-title">{t.title}</div>
      <ol className="gx-hops">
        {HOPS.map((x, n) => (
          <li key={x.fn} data-on={n === i} data-done={n < i}>
            <button type="button" onClick={() => setI(n)}>
              <span className="mono">{n + 1}</span>
              <code>{x.fn}</code>
            </button>
          </li>
        ))}
      </ol>
      <div className="viz-now" aria-live="polite">
        <strong>{h.fn}</strong>
        <code className="gx-where">great_expectations/{h.file}</code>
        <span style={{ display: 'block', marginTop: 8 }}>{h.does}</span>
        <span style={{ display: 'block', marginTop: 8 }}>{t.tipLabel}{h.tip}</span>
      </div>
      <p className="viz-caption">{t.caption}</p>
    </figure>
  );
}
