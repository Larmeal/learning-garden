import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { StepControls, useStepper, type StepInfo } from './stepper';

// One real optimizer trace (Spark 4.2.0, spark.sql.planChangeLog.level=WARN), simplified:
//   CREATE TEMP VIEW v AS SELECT id, id * 2 AS dbl FROM nums
//   SELECT id + (1 + 2) AS x FROM v WHERE 1 = 1 AND id > 10
// Expression ids are stripped and a few wrapper nodes (View) are left out to keep the tree short.

interface Node {
  id: string;
  depth: number;
  text: string;
}
interface Phase extends StepInfo {
  phase: 0 | 1 | 2 | 3;
  rule?: string;
  where?: string;
  nodes: Node[];
  changed: string[];
}

const PHASES = ['Parsed', 'Analyzed', 'Optimized', 'Physical'];

const PHASE_STEPS: Phase[] = [
  {
    name: 'Parsed',
    title: 'Parsed: แผนที่ได้จากตัวอักษรของ SQL',
    text: 'เครื่องหมาย \' หน้าชื่อ (\'Project, \'id) แปลว่ายังไม่รู้ว่าชื่อนี้คืออะไร view v มีจริงไหม id เป็นชนิดอะไร ตอนนี้เป็นแค่โครงของประโยค',
    phase: 0,
    nodes: [
      { id: 'proj', depth: 0, text: "'Project [('id + (1 + 2)) AS x]" },
      { id: 'filt', depth: 1, text: "'Filter ((1 = 1) AND ('id > 10))" },
      { id: 'rel', depth: 2, text: "'UnresolvedRelation [v]" },
    ],
    changed: [],
  },
  {
    name: 'Analyzed',
    title: 'Analyzed: เติมความหมายให้ทุกชื่อ',
    text: 'Analyzer หา view v เจอ จึงขยายเป็นแผนข้างใน และผูก id กับ column จริง (id#2L) พร้อมชนิด bigint ตัวเลข 10 ถูกเติม cast ให้ชนิดตรงกัน (type coercion)',
    phase: 1,
    rule: 'ResolveRelations, ResolveReferences, AnsiTypeCoercion',
    where: 'batch Resolution ใน Analyzer.scala',
    nodes: [
      { id: 'proj', depth: 0, text: 'Project [(id#2L + cast((1 + 2) as bigint)) AS x#4L]' },
      { id: 'filt', depth: 1, text: 'Filter ((1 = 1) AND (id#2L > cast(10 as bigint)))' },
      { id: 'alias', depth: 2, text: 'SubqueryAlias v' },
      { id: 'p2', depth: 3, text: 'Project [id#2L, (id#2L * 2) AS dbl#3L]' },
      { id: 'rng', depth: 4, text: 'Range (0, 1000, step=1, splits=16)' },
    ],
    changed: ['proj', 'filt', 'alias', 'p2', 'rng'],
  },
  {
    name: 'FinishAnalysis',
    title: 'Optimizer เริ่ม: ถอดชั้นที่ไม่ต้องใช้',
    text: 'SubqueryAlias มีไว้ให้ Analyzer ตามชื่อ view พอวิเคราะห์เสร็จก็ไม่มีประโยชน์ แผนจึงสั้นลงหนึ่งชั้น',
    phase: 2,
    rule: 'FinishAnalysis',
    where: 'batch Finish Analysis, Optimizer.scala:177',
    nodes: [
      { id: 'proj', depth: 0, text: 'Project [(id#2L + cast((1 + 2) as bigint)) AS x#4L]' },
      { id: 'filt', depth: 1, text: 'Filter ((1 = 1) AND (id#2L > cast(10 as bigint)))' },
      { id: 'p2', depth: 2, text: 'Project [id#2L, (id#2L * 2) AS dbl#3L]' },
      { id: 'rng', depth: 3, text: 'Range (0, 1000, step=1, splits=16)' },
    ],
    changed: [],
  },
  {
    name: 'PushDown',
    title: 'PushDownPredicates: ย้าย Filter ลงไปใกล้ข้อมูล',
    text: 'Filter ใช้แค่ id ซึ่งมีอยู่ก่อน Project ตัวล่าง จึงลงไปอยู่เหนือ Range ได้ ยิ่ง filter เร็ว ข้อมูลที่ต้องส่งต่อยิ่งน้อย',
    phase: 2,
    rule: 'PushDownPredicates',
    where: 'Optimizer.scala:2078',
    nodes: [
      { id: 'proj', depth: 0, text: 'Project [(id#2L + cast((1 + 2) as bigint)) AS x#4L]' },
      { id: 'p2', depth: 1, text: 'Project [id#2L, (id#2L * 2) AS dbl#3L]' },
      { id: 'filt', depth: 2, text: 'Filter ((1 = 1) AND (id#2L > cast(10 as bigint)))' },
      { id: 'rng', depth: 3, text: 'Range (0, 1000, step=1, splits=16)' },
    ],
    changed: ['filt'],
  },
  {
    name: 'ColumnPruning',
    title: 'ColumnPruning: ทิ้ง column ที่ไม่มีใครใช้',
    text: 'คำสั่งไม่เคยอ่าน dbl เลย จึงตัดออกจาก Project ตัวล่าง ถ้าข้างล่างเป็นไฟล์ Parquet นี่คือสิ่งที่ทำให้ไม่ต้องอ่าน column นั้นจาก disk',
    phase: 2,
    rule: 'ColumnPruning',
    where: 'Optimizer.scala:1077',
    nodes: [
      { id: 'proj', depth: 0, text: 'Project [(id#2L + cast((1 + 2) as bigint)) AS x#4L]' },
      { id: 'p2', depth: 1, text: 'Project [id#2L]' },
      { id: 'filt', depth: 2, text: 'Filter ((1 = 1) AND (id#2L > cast(10 as bigint)))' },
      { id: 'rng', depth: 3, text: 'Range (0, 1000, step=1, splits=16)' },
    ],
    changed: ['p2'],
  },
  {
    name: 'CollapseProject',
    title: 'CollapseProject: รวม Project ที่ซ้อนกัน',
    text: 'Project ตัวล่างเหลือแค่ส่ง id ผ่านเฉยๆ ตัวบนจึงอ่าน id ตรงจากข้างล่างได้เลย ลดหนึ่งขั้นของการคัดลอกแถว',
    phase: 2,
    rule: 'CollapseProject',
    where: 'Optimizer.scala:1232',
    nodes: [
      { id: 'proj', depth: 0, text: 'Project [(id#2L + cast((1 + 2) as bigint)) AS x#4L]' },
      { id: 'filt', depth: 1, text: 'Filter ((1 = 1) AND (id#2L > cast(10 as bigint)))' },
      { id: 'rng', depth: 2, text: 'Range (0, 1000, step=1, splits=16)' },
    ],
    changed: ['proj'],
  },
  {
    name: 'ConstantFolding',
    title: 'ConstantFolding: คิดค่าคงที่ให้เสร็จก่อนรัน',
    text: '1 + 2 กลายเป็น 3 และ 1 = 1 กลายเป็น true ไม่ต้องคำนวณซ้ำกับทุกแถว cast(10 as bigint) ก็กลายเป็น 10',
    phase: 2,
    rule: 'ConstantFolding',
    where: 'optimizer/expressions.scala:50',
    nodes: [
      { id: 'proj', depth: 0, text: 'Project [(id#2L + 3) AS x#4L]' },
      { id: 'filt', depth: 1, text: 'Filter (true AND (id#2L > 10))' },
      { id: 'rng', depth: 2, text: 'Range (0, 1000, step=1, splits=16)' },
    ],
    changed: ['proj', 'filt'],
  },
  {
    name: 'BooleanSimplification',
    title: 'BooleanSimplification: true AND p เท่ากับ p',
    text: 'เงื่อนไข 1 = 1 หายไปใช้สองกฎต่อกัน (กฎแรกคิดให้เป็น true กฎที่สองตัดทิ้ง) ไม่ใช่กฎเดียว นี่คือภาพของ optimizer: กฎเล็กๆ หลายตัวต่อกัน',
    phase: 2,
    rule: 'BooleanSimplification',
    where: 'optimizer/expressions.scala:392',
    nodes: [
      { id: 'proj', depth: 0, text: 'Project [(id#2L + 3) AS x#4L]' },
      { id: 'filt', depth: 1, text: 'Filter (id#2L > 10)' },
      { id: 'rng', depth: 2, text: 'Range (0, 1000, step=1, splits=16)' },
    ],
    changed: ['filt'],
  },
  {
    name: 'Physical',
    title: 'Physical: เลือกวิธีรันจริง',
    text: 'Planner แปลงแต่ละ node เป็น operator ที่รันได้ และ CollapseCodegenStages ครอบสามตัวนี้เป็น codegen stage เดียว (*(1)) ที่คอมไพล์เป็น Java loop เดียว',
    phase: 3,
    rule: 'SparkStrategies + CollapseCodegenStages',
    where: 'SparkPlanner.scala:38, WholeStageCodegenExec.scala:914',
    nodes: [
      { id: 'proj', depth: 0, text: '*(1) Project [(id#2L + 3) AS x#4L]' },
      { id: 'filt', depth: 1, text: '*(1) Filter (id#2L > 10)' },
      { id: 'rng', depth: 2, text: '*(1) Range (0, 1000, step=1, splits=16)' },
    ],
    changed: ['proj', 'filt', 'rng'],
  },
];

export default function PlanPipelineLab() {
  const { step, go, playing, toggle } = useStepper(PHASE_STEPS.length, 3200);
  const reduce = useReducedMotion();
  const cur = PHASE_STEPS[step];
  const t = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 260, damping: 30 };

  return (
    <figure className="viz">
      <div className="viz-title">
        ดูแผนเปลี่ยนทีละกฎ: <code>SELECT id + (1 + 2) AS x FROM v WHERE 1 = 1 AND id &gt; 10</code>
      </div>

      <ol className="plan-phases" aria-label="ขั้นของ query pipeline">
        {PHASES.map((p, i) => (
          <li key={p} data-on={i === cur.phase ? '' : undefined} data-done={i < cur.phase ? '' : undefined}>
            {p}
          </li>
        ))}
      </ol>

      <div className="viz-box plan-box">
        <div className="plan-tree" role="img" aria-label={`แผนขั้น ${cur.name}`}>
          <AnimatePresence initial={false}>
            {cur.nodes.map((n) => (
              <motion.div
                key={n.id}
                layout
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24, height: 0, marginBottom: 0 }}
                transition={t}
                className="plan-node"
                data-changed={cur.changed.includes(n.id) ? '' : undefined}
                style={{ marginLeft: n.depth * 22 }}
              >
                <span className="plan-arrow" aria-hidden="true">{n.depth === 0 ? '' : '+- '}</span>
                <code>{n.text}</code>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <div className="plan-rule" aria-live="polite">
          {cur.rule ? (
            <>
              <span className="plan-rule-label">กฎที่ทำงาน</span>
              <strong>{cur.rule}</strong>
              <span className="plan-rule-where">{cur.where}</span>
            </>
          ) : (
            <span className="plan-rule-label">ยังไม่มีกฎไหนทำงาน</span>
          )}
        </div>
      </div>

      <StepControls steps={PHASE_STEPS} step={step} playing={playing} go={go} toggle={toggle} />
      <figcaption className="viz-caption">
        แผนจริงมี node มากกว่านี้เล็กน้อย (View, SubqueryAlias ของตาราง nums) และ expression id เปลี่ยนทุกครั้งที่รัน ลำดับกฎมาจาก
        plan change log ของ Spark 4.2.0
      </figcaption>
    </figure>
  );
}
