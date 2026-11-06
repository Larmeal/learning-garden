import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { StepControls, useStepper, type Lang, type StepInfo } from './stepper';

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

const PHASE_BASE: Omit<Phase, 'title' | 'text'>[] = [
  {
    name: 'Parsed',
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
    phase: 1,
    rule: 'ResolveRelations, ResolveReferences, AnsiTypeCoercion',
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

interface StepText {
  title: string;
  text: string;
  where?: string;
}
interface UiText {
  steps: StepText[];
  queryLabel: string;
  phasesLabel: string;
  planLabel: (name: string) => string;
  ruleActive: string;
  noRule: string;
  caption: string;
}
const TEXT: Record<Lang, UiText> = {
  th: {
    steps: [
    { title: 'Parsed: แผนที่ได้จากตัวอักษรของ SQL', text: 'เครื่องหมาย \' หน้าชื่อ (\'Project, \'id) แปลว่ายังไม่รู้ว่าชื่อนี้คืออะไร view v มีจริงไหม id เป็นชนิดอะไร ตอนนี้เป็นแค่โครงของประโยค' },
    { title: 'Analyzed: เติมความหมายให้ทุกชื่อ', text: 'Analyzer หา view v เจอ จึงขยายเป็นแผนข้างใน และผูก id กับ column จริง (id#2L) พร้อมชนิด bigint ตัวเลข 10 ถูกเติม cast ให้ชนิดตรงกัน (type coercion)', where: 'batch Resolution ใน Analyzer.scala' },
    { title: 'Optimizer เริ่ม: ถอดชั้นที่ไม่ต้องใช้', text: 'SubqueryAlias มีไว้ให้ Analyzer ตามชื่อ view พอวิเคราะห์เสร็จก็ไม่มีประโยชน์ แผนจึงสั้นลงหนึ่งชั้น' },
    { title: 'PushDownPredicates: ย้าย Filter ลงไปใกล้ข้อมูล', text: 'Filter ใช้แค่ id ซึ่งมีอยู่ก่อน Project ตัวล่าง จึงลงไปอยู่เหนือ Range ได้ ยิ่ง filter เร็ว ข้อมูลที่ต้องส่งต่อยิ่งน้อย' },
    { title: 'ColumnPruning: ทิ้ง column ที่ไม่มีใครใช้', text: 'คำสั่งไม่เคยอ่าน dbl เลย จึงตัดออกจาก Project ตัวล่าง ถ้าข้างล่างเป็นไฟล์ Parquet นี่คือสิ่งที่ทำให้ไม่ต้องอ่าน column นั้นจาก disk' },
    { title: 'CollapseProject: รวม Project ที่ซ้อนกัน', text: 'Project ตัวล่างเหลือแค่ส่ง id ผ่านเฉยๆ ตัวบนจึงอ่าน id ตรงจากข้างล่างได้เลย ลดหนึ่งขั้นของการคัดลอกแถว' },
    { title: 'ConstantFolding: คิดค่าคงที่ให้เสร็จก่อนรัน', text: '1 + 2 กลายเป็น 3 และ 1 = 1 กลายเป็น true ไม่ต้องคำนวณซ้ำกับทุกแถว cast(10 as bigint) ก็กลายเป็น 10' },
    { title: 'BooleanSimplification: true AND p เท่ากับ p', text: 'เงื่อนไข 1 = 1 หายไปใช้สองกฎต่อกัน (กฎแรกคิดให้เป็น true กฎที่สองตัดทิ้ง) ไม่ใช่กฎเดียว นี่คือภาพของ optimizer: กฎเล็กๆ หลายตัวต่อกัน' },
    { title: 'Physical: เลือกวิธีรันจริง', text: 'Planner แปลงแต่ละ node เป็น operator ที่รันได้ และ CollapseCodegenStages ครอบสามตัวนี้เป็น codegen stage เดียว (*(1)) ที่คอมไพล์เป็น Java loop เดียว' },
    ],
    queryLabel: 'ดูแผนเปลี่ยนทีละกฎ:',
    phasesLabel: 'ขั้นของ query pipeline',
    planLabel: (name) => `แผนขั้น ${name}`,
    ruleActive: 'กฎที่ทำงาน',
    noRule: 'ยังไม่มีกฎไหนทำงาน',
    caption: 'แผนจริงมี node มากกว่านี้เล็กน้อย (View, SubqueryAlias ของตาราง nums) และ expression id เปลี่ยนทุกครั้งที่รัน ลำดับกฎมาจาก plan change log ของ Spark 4.2.0',
  },
  en: {
    steps: [
    { title: 'Parsed: the plan built from the text of the SQL', text: 'A quote mark \' before a name (\'Project, \'id) means Spark does not yet know what the name is: whether view v exists, or what type id has. For now this is only the skeleton of the sentence.' },
    { title: 'Analyzed: give every name a meaning', text: 'The Analyzer finds view v, so it expands it into the plan inside and binds id to the real column (id#2L) with the type bigint. The number 10 gets a cast so the types match (type coercion).', where: 'batch Resolution in Analyzer.scala' },
    { title: 'Optimizer starts: remove layers that are not needed', text: 'SubqueryAlias is there so the Analyzer can follow the view name. After analysis it is useless, so the plan is one layer shorter.' },
    { title: 'PushDownPredicates: move the Filter down close to the data', text: 'The Filter uses only id, which exists before the lower Project, so it can sit above Range. The earlier a filter runs, the less data has to be passed on.' },
    { title: 'ColumnPruning: drop columns nobody uses', text: 'The query never reads dbl, so it is cut from the lower Project. If a Parquet file is below, this is what lets Spark skip reading that column from disk.' },
    { title: 'CollapseProject: merge nested Projects', text: 'The lower Project now only passes id through, so the upper one can read id straight from below. One less step of copying rows.' },
    { title: 'ConstantFolding: compute constants before the run', text: '1 + 2 becomes 3 and 1 = 1 becomes true, so nothing is recomputed for every row. cast(10 as bigint) becomes 10.' },
    { title: 'BooleanSimplification: true AND p equals p', text: 'The condition 1 = 1 disappears through two rules in a row (the first turns it into true, the second removes it), not one rule. This is what an optimizer looks like: many small rules chained together.' },
    { title: 'Physical: choose how to really run it', text: 'The Planner turns each node into an operator that can run, and CollapseCodegenStages wraps these three in one codegen stage (*(1)) that is compiled into a single Java loop.' },
    ],
    queryLabel: 'Watch the plan change one rule at a time:',
    phasesLabel: 'Phases of the query pipeline',
    planLabel: (name) => `Plan at phase ${name}`,
    ruleActive: 'Rule at work',
    noRule: 'No rule has run yet',
    caption: 'The real plan has a few more nodes (View, SubqueryAlias of the table nums), and the expression ids change on every run. The order of the rules comes from the plan change log of Spark 4.2.0.',
  },
};

export default function PlanPipelineLab({ lang = 'th' }: { lang?: Lang }) {
  const L = TEXT[lang];
  // base steps (language-free) get their title, text and where from TEXT
  const PHASE_STEPS: Phase[] = PHASE_BASE.map((s, i) => ({ ...s, ...L.steps[i] }));
  const { step, go, playing, toggle } = useStepper(PHASE_STEPS.length, 3200);
  const reduce = useReducedMotion();
  const cur = PHASE_STEPS[step];
  const t = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 260, damping: 30 };

  return (
    <figure className="viz">
      <div className="viz-title">
        {L.queryLabel} <code>SELECT id + (1 + 2) AS x FROM v WHERE 1 = 1 AND id &gt; 10</code>
      </div>

      <ol className="plan-phases" aria-label={L.phasesLabel}>
        {PHASES.map((p, i) => (
          <li key={p} data-on={i === cur.phase ? '' : undefined} data-done={i < cur.phase ? '' : undefined}>
            {p}
          </li>
        ))}
      </ol>

      <div className="viz-box plan-box">
        <div className="plan-tree" role="img" aria-label={L.planLabel(cur.name)}>
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
              <span className="plan-rule-label">{L.ruleActive}</span>
              <strong>{cur.rule}</strong>
              <span className="plan-rule-where">{cur.where}</span>
            </>
          ) : (
            <span className="plan-rule-label">{L.noRule}</span>
          )}
        </div>
      </div>

      <StepControls steps={PHASE_STEPS} step={step} playing={playing} go={go} toggle={toggle} lang={lang} />
      <figcaption className="viz-caption">
        {L.caption}
      </figcaption>
    </figure>
  );
}
