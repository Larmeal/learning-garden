import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { StepControls, useStepper, type StepInfo } from './stepper';

// Pipeline(stages=[StringIndexer, OneHotEncoder, VectorAssembler, LogisticRegression]) on a made-up dataset of 2,000 rows
// (exercises/12_mllib.py, Spark 4.2.0). The three sample rows are real output rows of PipelineModel.transform(test),
// rounded; the coefficients and the job counts (fit 14 jobs, transform 0 jobs) were printed and asserted there.

const COLS = [
  { id: 'x1', from: 0, v: ['-2.824', '-2.274', '-2.236'] },
  { id: 'x2', from: 0, v: ['0.191', '1.532', '0.043'] },
  { id: 'c', from: 0, v: ['a', 'a', 'c'] },
  { id: 'label', from: 0, v: ['0.0', '0.0', '0.0'] },
  { id: 'c_idx', from: 1, v: ['0.0', '0.0', '2.0'] },
  { id: 'c_vec', from: 2, v: ['(2,[0],[1.0])', '(2,[0],[1.0])', '(2,[],[])'] },
  { id: 'features', from: 3, v: ['[-2.82, 0.19, 1.0, 0.0]', '[-2.27, 1.53, 1.0, 0.0]', '[-2.24, 0.04, 0.0, 0.0]'] },
  { id: 'rawPrediction', from: 6, v: ['[6.41, -6.41]', '[7.42, -7.42]', '[6.03, -6.03]'] },
  { id: 'probability', from: 6, v: ['[0.998, 0.002]', '[0.999, 0.001]', '[0.998, 0.002]'] },
  { id: 'prediction', from: 6, v: ['0.0', '0.0', '0.0'] },
];

const STAGES = [
  { name: 'StringIndexer', kind: 'Estimator', model: 'StringIndexerModel' },
  { name: 'OneHotEncoder', kind: 'Estimator', model: 'OneHotEncoderModel' },
  { name: 'VectorAssembler', kind: 'Transformer', model: 'VectorAssembler' },
  { name: 'LogisticRegression', kind: 'Estimator', model: 'LogisticRegressionModel' },
];

interface S extends StepInfo {
  stage: number; // index of the stage being worked on, -1 for none
  fitted: number; // how many stages are already fitted
  phase: 'fit' | 'transform';
}

const STEPS: S[] = [
  { name: 'ข้อมูล', title: 'ข้อมูลฝึก: x1, x2, c, label', text: 'ตัวเลขสองคอลัมน์ ข้อความหนึ่งคอลัมน์ (a, b, c) และ label 0 หรือ 1 เรียก pipeline.fit(train) ซึ่งเป็น action: Spark เริ่มรัน job (วัดจริง: 14 job)', stage: -1, fitted: 0, phase: 'fit' },
  { name: 'StringIndexer', title: 'Estimator: fit ได้ StringIndexerModel', text: 'fit อ่านข้อมูลนับว่ามีค่า a, b, c อะไรบ้าง ได้ model ที่จำลำดับ [a, b, c] จากนั้น model.transform เติม c_idx (a เป็น 0.0, c เป็น 2.0) pipeline เอาผลนี้ส่งต่อให้ขั้นถัดไป', stage: 0, fitted: 1, phase: 'fit' },
  { name: 'OneHotEncoder', title: 'Estimator: fit ได้ OneHotEncoderModel', text: 'fit หาจำนวน category (3) แล้ว model แปลง c_idx เป็นเวกเตอร์ sparse ค่าเริ่มต้นตัด category สุดท้ายทิ้ง (dropLast) จึงมีขนาด 2: c ได้ (2,[],[]) ที่เป็นศูนย์ทั้งหมด', stage: 1, fitted: 2, phase: 'fit' },
  { name: 'VectorAssembler', title: 'Transformer: ไม่ต้อง fit', text: 'VectorAssembler รวม x1, x2 และ c_vec เป็น column เวกเตอร์เดียวชื่อ features ไม่มีอะไรให้เรียนรู้จากข้อมูล จึงเป็น Transformer ที่อยู่ใน PipelineModel ตามเดิม', stage: 2, fitted: 3, phase: 'fit' },
  { name: 'LogisticRegression', title: 'Estimator ตัวสุดท้าย: ขั้นที่หนักที่สุด', text: 'fit วนปรับน้ำหนักซ้ำหลายรอบบนข้อมูล ซึ่งเป็นส่วนที่เกิดหลาย job ได้ model ที่ถือ coefficients [2.71, -1.87, 1.50, -0.14] และ intercept 0.118 ซึ่งตรงกับที่ข้อมูลถูกสร้าง (x1 ดันไปทาง 1, x2 ดันออก)', stage: 3, fitted: 4, phase: 'fit' },
  { name: 'PipelineModel', title: 'ได้ PipelineModel: 3 model กับ 1 transformer', text: 'pipeline.fit คืน PipelineModel ที่มี stages = [StringIndexerModel, OneHotEncoderModel, VectorAssembler, LogisticRegressionModel] ต่อจากนี้ไม่มีอะไรต้องเรียนรู้อีก', stage: -1, fitted: 4, phase: 'fit' },
  { name: 'transform(test)', title: 'model.transform(test): ใช้ทุก stage ตามลำดับ', text: 'เติม rawPrediction, probability, prediction ท้ายตาราง ขั้นนี้ไม่เกิด job เลย (วัดจริง: 0 job) เพราะ transform แค่ต่อแผน plan จริงเป็น Project ซ้อนกันที่เรียก UDF ของแต่ละ stage การรันเกิดตอนเรียก action เช่น evaluate (AUC บน test = 0.981)', stage: -1, fitted: 4, phase: 'transform' },
];

export default function MlPipelineLab() {
  const { step, go, playing, toggle } = useStepper(STEPS.length, 4200);
  const reduce = useReducedMotion();
  const s = STEPS[step];
  const t = reduce ? { duration: 0 } : { duration: 0.45 };
  const visible = COLS.filter((c) => c.from <= step);
  return (
    <figure className="viz">
      <div className="viz-title">Pipeline.fit แล้ว PipelineModel.transform: ข้อมูลเดินผ่านทีละ stage</div>
      <div className="ml-chain" aria-label="stage ของ pipeline">
        {STAGES.map((st, i) => {
          const done = i < s.fitted;
          const active = i === s.stage;
          return (
            <motion.div key={st.name} className="ml-stage" data-active={active ? '' : undefined} data-done={done ? '' : undefined} layout transition={t}>
              <strong>{st.name}</strong>
              <span>{st.kind}</span>
              <em>{done ? `-> ${st.model}` : 'ยังไม่ fit'}</em>
            </motion.div>
          );
        })}
      </div>
      <div className="viz-box ml-wrap">
        <table className="ml-table">
          <thead>
            <tr>
              <AnimatePresence initial={false}>
                {visible.map((c) => (
                  <motion.th key={c.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={t} data-new={c.from === step ? '' : undefined}>
                    {c.id}
                  </motion.th>
                ))}
              </AnimatePresence>
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2].map((r) => (
              <tr key={r}>
                {visible.map((c) => (
                  <motion.td key={c.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={t} data-new={c.from === step ? '' : undefined}>
                    <code>{c.v[r]}</code>
                  </motion.td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <StepControls steps={STEPS} step={step} playing={playing} go={go} toggle={toggle} />
      <figcaption className="viz-caption">ตัวอย่างแถวเป็น 3 แถวจริงของผล transform บน test set (ปัดเศษ) ในการ fit จริง Spark ใช้ train set แต่หน้าตา column เหมือนกัน</figcaption>
    </figure>
  );
}
