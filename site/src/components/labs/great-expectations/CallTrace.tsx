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
},
    validateNote: 'expectation ตัดสินผลจากค่า metric (ไฟล์ของแต่ละ expectation มี _validate ของตัวเอง)',
    noNote: 'ไม่มีหมายเหตุสำหรับขั้นนี้',
    title: 'ลำดับฟังก์ชันของ GX ใน Checkpoint.run หนึ่งครั้ง',
    stop: 'หยุด',
    play: 'เล่น',
    prev: 'ก่อนหน้า',
    next: 'ถัดไป',
    captionA: 'บันทึกด้วย ',
    captionB: ' เฉพาะฟังก์ชัน ',
    captionC: (v) => ` ตำแหน่งที่คัดไว้ของ GX ${v} (ฟังก์ชันอื่นถูกกรองออก) การเยื้องคือความลึกของการเรียก ตัวเลข xN คือจำนวนครั้งที่ฟังก์ชันนั้นถูกเรียกที่ความลึกนั้น`,
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
