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
type Lang = 'th' | 'en';

const TEXT: Record<
  Lang,
  {
    notes: Record<string, string>;
    validateNote: string;
    noNote: string;
    title: string;
    stop: string;
    play: string;
    prev: string;
    next: string;
    captionA: string;
    captionB: string;
    captionC: (version: string) => string;
  }
> = {
  th: {
    notes: {
  'checkpoint/checkpoint.py:run': 'จุดเริ่มต้น รับ batch_parameters เข้ามา แล้วไล่รัน Validation Definition ทีละตัว',
  'checkpoint/checkpoint.py:_run_validation_definitions': 'วนรัน Validation Definition ทุกตัวที่อยู่ใน Checkpoint',
  'core/validation_definition.py:run': 'เตรียมตัวให้พร้อมรัน (ถ้ายังไม่ได้ add ก็เพิ่มตัวเองเข้า Context) แล้วค่อยเรียก Validator',
  'validator/v1_validator.py:validate_expectation_suite': 'ชั้นบาง ๆ ที่ห่อ Validator ตัวเก่า ซึ่งเป็นตัวที่ทำงานจริง',
  'validator/validator.py:process_expectations_for_validation': 'จัดกลุ่ม Expectation ตามชื่อคอลัมน์ก่อนจะประเมิน ซึ่งเป็นต้นเหตุที่ทำให้ลำดับของผลไม่ตรงกับ Suite',
  'validator/validator.py:graph_validate': 'ตัวกลางที่รวม Metric ของทุก Expectation เป็นกราฟ แล้วให้ Engine เป็นคนคำนวณ',
  'expectations/expectation.py:get_validation_dependencies': 'แต่ละ Expectation จะประกาศว่าต้องใช้ Metric อะไรบ้าง (เรียกต่อกันไปตามลำดับชั้นของคลาส)',
  'validator/validation_graph.py:resolve': 'เริ่มแก้กราฟ Metric ไปทีละรอบ',
  'validator/validation_graph.py:_resolve': 'วนไปทีละรอบจนครบ',
  'execution_engine/execution_engine.py:resolve_metrics': 'หนึ่งรอบคือหนึ่งครั้งที่ Engine ถูกเรียก (ในการรันนี้นับได้ x5)',
  'execution_engine/pandas_execution_engine.py:resolve_metric_bundle': 'ส่วนที่ Engine ของ pandas ใช้รวมและคำนวณ Metric',
  'expectations/expectation.py:metrics_validate': 'เอาค่า Metric ที่คำนวณได้กลับไปส่งให้แต่ละ Expectation',
  'data_context/store/validation_results_store.py:store_validation_results': 'เก็บผลลง Store ก่อนที่ Action จะเริ่มทำงาน',
  'checkpoint/checkpoint.py:_run_actions': 'Action จะทำงานเป็นขั้นสุดท้าย',
},
    validateNote: 'Expectation ตัดสินผลจากค่า Metric (ไฟล์ของแต่ละ Expectation จะมี _validate ของตัวเอง)',
    noNote: 'ไม่มีหมายเหตุสำหรับขั้นนี้',
    title: 'ลำดับฟังก์ชันของ GX ใน Checkpoint.run หนึ่งครั้ง',
    stop: 'หยุด',
    play: 'เล่น',
    prev: 'ก่อนหน้า',
    next: 'ถัดไป',
    captionA: 'บันทึกด้วย ',
    captionB: ' เฉพาะฟังก์ชัน ',
    captionC: (v) => ` ตำแหน่งที่คัดไว้ของ GX ${v} (ฟังก์ชันอื่นถูกกรองออกไป) ส่วนการเยื้องบอกความลึกของการเรียก และตัวเลข xN บอกจำนวนครั้งที่ฟังก์ชันนั้นถูกเรียกที่ความลึกนั้น`,
  },
  en: {
    notes: {
  'checkpoint/checkpoint.py:run': 'Start: takes batch_parameters, then goes through the validation definitions one by one',
  'checkpoint/checkpoint.py:_run_validation_definitions': 'Loops over the validation definitions in the checkpoint and runs each one',
  'core/validation_definition.py:run': 'Gets ready to run (adds itself to the context if it was not added yet), then calls the validator',
  'validator/v1_validator.py:validate_expectation_suite': 'A thin layer that wraps the old Validator, which does the real work',
  'validator/validator.py:process_expectations_for_validation': 'Groups the expectations by column name before evaluating (this is why the order of the results can differ from the order in the suite)',
  'validator/validator.py:graph_validate': 'The middle layer that puts the metrics of all expectations into one graph and lets the engine compute them',
  'expectations/expectation.py:get_validation_dependencies': 'The expectation declares the metrics it needs (called one after another along the class hierarchy)',
  'validator/validation_graph.py:resolve': 'Starts resolving the metric graph in rounds',
  'validator/validation_graph.py:_resolve': 'Loops round by round until everything is done',
  'execution_engine/execution_engine.py:resolve_metrics': 'One round = one call to the engine (counted x5 in this run)',
  'execution_engine/pandas_execution_engine.py:resolve_metric_bundle': 'The part where the pandas engine groups and computes the metrics',
  'expectations/expectation.py:metrics_validate': 'Hands the computed metric values back to each expectation',
  'data_context/store/validation_results_store.py:store_validation_results': 'Stores the result in the store before the actions start',
  'checkpoint/checkpoint.py:_run_actions': 'The actions run last',
},
    validateNote: 'The expectation decides the result from the metric values (the file of each expectation has its own _validate)',
    noNote: 'No note for this step',
    title: 'The order of GX functions in one Checkpoint.run',
    stop: 'Pause',
    play: 'Play',
    prev: 'Previous',
    next: 'Next',
    captionA: 'Recorded with ',
    captionB: ' for only the ',
    captionC: (v) => ` selected functions of GX ${v} (other functions are filtered out). The indent is the depth of the call. The number xN is how many times that function was called at that depth.`,
  },
};

export default function CallTrace({ lang = 'th' }: { lang?: Lang }) {
  const t = TEXT[lang];
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
  const note = t.notes[key] ?? (cur.fn === '_validate' ? t.validateNote : '');

  return (
    <figure className="viz">
      <div className="viz-title">{t.title}</div>
      <div className="viz-controls">
        <button type="button" className="btn primary sm" onClick={() => { if (i >= trace.length - 1) setI(0); setPlaying((p) => !p); }}>{playing ? t.stop : t.play}</button>
        <button type="button" className="btn sm" onClick={() => { setPlaying(false); setI((n) => Math.max(0, n - 1)); }}>{t.prev}</button>
        <button type="button" className="btn sm" onClick={() => { setPlaying(false); setI((n) => Math.min(trace.length - 1, n + 1)); }}>{t.next}</button>
        <span className="gx-tag">{i + 1} / {trace.length}</span>
      </div>

      <ol className="gx-results" style={{ maxHeight: 360, overflowY: 'auto' }}>
        {trace.map((r, n) => (
          <li key={n} data-ok={n <= i ? 'true' : undefined} style={{ opacity: n <= i ? 1 : 0.35, paddingLeft: 12 + r.depth * 14 }}>
            <button type="button" className="gx-tree-key" onClick={() => { setPlaying(false); setI(n); }} style={{ textAlign: 'left' }}>
              <code>{r.file.split('/').pop()}</code> <b>{r.fn}</b>
            </button>
            {r.count > 1 && <span className="gx-tag">x{r.count}</span>}
          </li>
        ))}
      </ol>

      <div className="viz-now" aria-live="polite">
        <strong>{cur.fn}</strong>
        <span>{note || t.noNote}</span>
        <code className="gx-where">{cur.file}</code>
      </div>
      <p className="viz-caption">
        {t.captionA}<code>sys.setprofile</code>{t.captionB}{data.trace.length}{t.captionC(data.version)}
      </p>
    </figure>
  );
}
