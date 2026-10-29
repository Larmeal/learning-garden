import { useState } from 'react';

interface Hop {
  fn: string;
  file: string;
  does: string;
  tip: string;
}

// The real call path, read from the 1.9.3 checkout and the 1.24.1 wheel (file and function names are the same in both).
const HOPS: Hop[] = [
  { fn: 'Checkpoint.run', file: 'checkpoint/checkpoint.py', does: 'ตรวจว่าทุกอย่างถูก add, วนรัน validation definition, สร้าง CheckpointResult, แล้วรัน action', tip: 'ค้นหา _run_validation_definitions และ _run_actions' },
  { fn: 'ValidationDefinition.run', file: 'core/validation_definition.py', does: 'เช็ก freshness, สร้าง Validator, ใส่ run_id ลง meta, เก็บผลลง validation results store', tip: 'ทุกอย่างอ้างผ่าน store: ดู _decode_suite และ _decode_data' },
  { fn: 'Validator.validate_expectation_suite', file: 'validator/v1_validator.py', does: 'ตัวห่อบางๆ แปลง suite เป็นรายการ configuration แล้วส่งต่อให้ Validator ตัวเก่า คำนวณสถิติ success_percent', tip: 'มี _wrapped_validator ที่สร้างตอนใช้ครั้งแรก (จุดแรกที่แตะข้อมูล)' },
  { fn: 'Validator.graph_validate', file: 'validator/validator.py', does: 'ถาม expectation ทุกตัวว่าต้องใช้ metric อะไร รวมเป็นกราฟเดียว resolve แล้วให้ expectation ตัดสิน catch_exceptions ทำให้ error กลายเป็นผล fail', tip: 'อ่านสามเมธอด _generate_metric_dependency_subgraphs…, _generate_suite_level_graph…, _resolve_suite_level_graph…' },
  { fn: 'ValidationGraph.resolve', file: 'validator/validation_graph.py', does: 'วนเป็นรอบ: หา metric ที่ dependency พร้อม (_parse) ส่งให้ engine ลองซ้ำสูงสุด 3 ครั้งต่อ metric', tip: 'MAX_METRIC_COMPUTATION_RETRIES = 3' },
  { fn: 'ExecutionEngine.resolve_metrics', file: 'execution_engine/execution_engine.py', does: 'แยก metric เป็น direct (คำนวณทันที) กับ bundled (aggregate เลื่อนไว้รวมคำสั่ง) แล้วประมวลผล', tip: '_build_direct_and_bundled_metric_computation_configurations' },
  { fn: 'resolve_metric_bundle', file: 'execution_engine/{sqlalchemy,sparkdf}_execution_engine.py', does: 'SQL: รวม aggregate ของ domain เดียวกันเป็น SELECT เดียว. Spark: เป็น df.agg(...).collect() ครั้งเดียว', tip: 'pandas ไม่มี bundle' },
  { fn: 'Expectation.metrics_validate → _validate', file: 'expectations/expectation.py', does: 'หยิบค่า metric ที่ resolve แล้วมาตัดสิน success และจัดรูปผลตาม result_format', tip: 'ColumnMapExpectation._validate มี "vacuous truth" เมื่อไม่มีแถวให้พิจารณา' },
];

export default function SourceMap() {
  const [i, setI] = useState(0);
  const h = HOPS[i];
  return (
    <figure className="viz">
      <div className="viz-title">เส้นทางเรียกจริงของ GX จากคำสั่งรันจนถึงผลของ expectation</div>
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
        <span style={{ display: 'block', marginTop: 8 }}>ลองดู: {h.tip}</span>
      </div>
      <p className="viz-caption">
        knowledge graph มีแต่เส้น imports/contains/exports/inherits (เส้น calls มี 44 เส้น) จึงไม่เห็นลำดับนี้ ต้องอ่านซอร์ส
        ชื่อไฟล์และฟังก์ชันตรงกันทั้ง 1.9.3 และ 1.24.1 แต่เนื้อในบางไฟล์ต่างกัน
      </p>
    </figure>
  );
}
