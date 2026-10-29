import { useEffect, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import data from './callTrace.json';

// Reads callTrace.json, written by code/31_call_trace.py: the GX functions that ran during one Checkpoint.run,
// recorded with sys.setprofile and collapsed so that each (file, function, depth) appears once with a call count.

interface Row {
  file: string;
  fn: string;
  depth: number;
  count: number;
}
const NOTES: Record<string, string> = {
  'checkpoint/checkpoint.py:run': 'จุดเริ่ม: รับ batch_parameters แล้วไล่ validation definition ทีละตัว',
  'checkpoint/checkpoint.py:_run_validation_definitions': 'วนรัน validation definition ใน checkpoint',
  'core/validation_definition.py:run': 'เตรียมให้พร้อมรัน (เพิ่มตัวเองเข้า context ถ้ายังไม่ได้ add) แล้วเรียก validator',
  'validator/v1_validator.py:validate_expectation_suite': 'ชั้นบางที่ห่อ Validator ตัวเก่าที่ทำงานจริง',
  'validator/validator.py:process_expectations_for_validation': 'จัดกลุ่ม expectation ตามชื่อคอลัมน์ก่อนประเมิน (ต้นเหตุที่ลำดับของผลไม่ตรงกับ suite)',
  'validator/validator.py:graph_validate': 'ตัวกลางที่รวม metric ของทุก expectation เป็นกราฟแล้วให้ engine คำนวณ',
  'expectations/expectation.py:get_validation_dependencies': 'expectation ประกาศ metric ที่ต้องใช้ (เรียกต่อกันตามลำดับชั้นของคลาส)',
  'validator/validation_graph.py:resolve': 'เริ่มแก้กราฟ metric เป็นรอบ',
  'validator/validation_graph.py:_resolve': 'วนทีละรอบจนครบ',
  'execution_engine/execution_engine.py:resolve_metrics': 'หนึ่งรอบ = หนึ่งครั้งที่ engine ถูกเรียก (นับได้ x5 ในการรันนี้)',
  'execution_engine/pandas_execution_engine.py:resolve_metric_bundle': 'ส่วนที่ engine ของ pandas รวมและคำนวณ metric',
  'expectations/expectation.py:metrics_validate': 'เอาค่า metric ที่ได้กลับไปให้แต่ละ expectation',
  'data_context/store/validation_results_store.py:store_validation_results': 'เก็บผลลง store ก่อนที่ action จะเริ่ม',
  'checkpoint/checkpoint.py:_run_actions': 'action ทำงานหลังสุด',
};

export default function CallTrace() {
  const trace: Row[] = data.trace;
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!playing) return;
    if (i >= trace.length - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setI((n) => n + 1), reduce ? 0 : 900);
    return () => clearTimeout(t);
  }, [playing, i, reduce, trace.length]);

  const cur = trace[i];
  const key = `${cur.file}:${cur.fn}`;
  const note = NOTES[key] ?? (cur.fn === '_validate' ? 'expectation ตัดสินผลจากค่า metric (ไฟล์ของแต่ละ expectation มี _validate ของตัวเอง)' : '');

  return (
    <figure className="viz">
      <div className="viz-title">ลำดับฟังก์ชันของ GX ใน Checkpoint.run หนึ่งครั้ง</div>
      <div className="viz-controls">
        <button type="button" className="btn primary sm" onClick={() => { if (i >= trace.length - 1) setI(0); setPlaying((p) => !p); }}>{playing ? 'หยุด' : 'เล่น'}</button>
        <button type="button" className="btn sm" onClick={() => { setPlaying(false); setI((n) => Math.max(0, n - 1)); }}>ก่อนหน้า</button>
        <button type="button" className="btn sm" onClick={() => { setPlaying(false); setI((n) => Math.min(trace.length - 1, n + 1)); }}>ถัดไป</button>
        <span className="gx-tag">{i + 1} / {trace.length}</span>
      </div>

      <ol className="gx-results" style={{ maxHeight: 360, overflowY: 'auto' }}>
        {trace.map((r, n) => (
          <li key={n} data-ok={n <= i ? 'true' : 'false'} style={{ opacity: n <= i ? 1 : 0.35, paddingLeft: 12 + r.depth * 14 }}>
            <button type="button" className="gx-tree-key" onClick={() => { setPlaying(false); setI(n); }} style={{ textAlign: 'left' }}>
              <code>{r.file.split('/').pop()}</code> <b>{r.fn}</b>
            </button>
            {r.count > 1 && <span className="gx-tag">x{r.count}</span>}
          </li>
        ))}
      </ol>

      <div className="viz-now" aria-live="polite">
        <strong>{cur.fn}</strong>
        <span>{note || 'ไม่มีหมายเหตุสำหรับขั้นนี้'}</span>
        <code className="gx-where">{cur.file}</code>
      </div>
      <p className="viz-caption">
        บันทึกด้วย <code>sys.setprofile</code> เฉพาะฟังก์ชัน {data.trace.length} ตำแหน่งที่คัดไว้ของ GX {data.version} (ฟังก์ชันอื่นถูกกรองออก) การเยื้องคือความลึกของการเรียก
        ตัวเลข xN คือจำนวนครั้งที่ฟังก์ชันนั้นถูกเรียกที่ความลึกนั้น
      </p>
    </figure>
  );
}
