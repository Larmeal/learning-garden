import { StepControls, useStepper, type StepInfo } from '../spark/stepper';
import type { Lang } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import { Box } from './kf';
import data from './capstone.json';

// Shows:      the capstone run in order: three brokers, a producer, six partitions, workers that own partitions and write into a table, and the two things that go wrong (a worker crash, a broker kill).
// Because:    the point of the capstone is the sequence: who owns what before and after each failure, how many orders have been sent and how many are in the table. One picture per moment says it.
// Control:    the step buttons through the eight moments of the run.
// Conclusion: nothing is lost (600 sent, 600 in the table) and nothing is counted twice (10 orders were delivered twice and the table ignored them), because the producer is idempotent, the commit comes after the write and the table has a key.
//
// The moments and numbers are those of exercise 12 (see capstone.json): 600 orders, 10 extra deliveries after the crash of worker w2, one broker killed, six partitions of which four hold data.

interface S { sent: number; rows: number; owners: Record<string, number[]>; dead: string[]; deadBroker: boolean; t: number }
const T0 = (what: string) => (data.timeline.find((e) => e.what.startsWith(what))?.t ?? 0) as number;
const STATES: S[] = [
  { sent: 0, rows: 0, owners: {}, dead: [], deadBroker: false, t: T0('start') },
  { sent: 0, rows: 0, owners: { w1: [0, 3], w2: [1, 4], w3: [2, 5] }, dead: [], deadBroker: false, t: T0('three workers') },
  { sent: 200, rows: 200, owners: { w1: [0, 3], w2: [1, 4], w3: [2, 5] }, dead: [], deadBroker: false, t: T0('wave 1') },
  { sent: 200, rows: 200, owners: { w1: [0, 3], w2: [], w3: [2, 5] }, dead: ['w2'], deadBroker: false, t: T0('worker w2') },
  { sent: 400, rows: 400, owners: { w1: [0, 3, 4], w3: [1, 2, 5] }, dead: ['w2'], deadBroker: false, t: T0('wave 2') },
  { sent: 400, rows: 400, owners: { w1: [0, 3, 4], w3: [1, 2, 5] }, dead: ['w2'], deadBroker: true, t: T0('broker ') },
  { sent: 600, rows: 600, owners: { w1: [0, 3, 4], w3: [1, 2, 5], w4: [] }, dead: ['w2'], deadBroker: true, t: T0('wave 3') },
  { sent: 600, rows: 600, owners: { w1: [0, 3], w3: [1, 2], w4: [4, 5] }, dead: ['w2'], deadBroker: true, t: T0('every order') },
];
const K = data.killed_broker;
const SINCE = (data.timeline.find((e) => e.what.startsWith('wave 3')) as { seconds_since_kill?: number } | undefined)?.seconds_since_kill ?? 0;
const WORKERS = ['w1', 'w2', 'w3', 'w4'];
const COUNTS = [0, 150, 75, 150, 0, 225];

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; producer: string; sent: string; partition: string; worker: string; table: string; rows: string; extra: string; crashed: string; empty: string; steps: StepInfo[]; caption: string;
}> = {
  th: {
    title: 'กดถัดไปทีละขั้นตามการรันจริงของ Pipeline ดูว่าใครอ่าน Partition ไหน ตอน Consumer ล้มและ Broker ล้ม และจำนวน Order ในตารางตอนจบ',
    legend: [{ kind: 'use', text: 'ทำงานอยู่' }, { kind: 'new', text: 'เพิ่งเปลี่ยนในขั้นนี้' }, { kind: 'skip', text: 'ล้มแล้ว' }],
    producer: 'Producer (idempotent, acks=all)', sent: 'ส่งแล้ว', partition: 'Partition', worker: 'Worker', table: 'ตาราง orders (PK: order_id)', rows: 'แถว', extra: 'ซ้ำ ไม่นับ', crashed: 'ล้ม', empty: 'ว่าง',
    steps: [
      { name: 'เริ่ม', title: 'เริ่ม Cluster และ Topic', text: 'Broker สามตัวกับ Controller หนึ่งตัว Topic orders มี 6 Partition 3 Replica และ min.insync.replicas=2' },
      { name: 'แบ่งงาน', title: 'Worker สามตัวแบ่ง Partition กัน', text: 'Group ledger มี w1, w2, w3 ได้ตัวละสอง Partition' },
      { name: 'ส่งรอบ 1', title: 'ส่ง Order 200 ตัว', text: 'Worker เขียนทุก Order ลงตาราง แล้วค่อย Commit ทุก 40 ตัว ตอนนี้ตารางมี 200 แถว' },
      { name: 'Worker ล้ม', title: 'w2 ล้มโดยไม่ทันบอกลา', text: 'w2 อ่านและเขียนลงตารางไปแล้ว 10 Order ที่ยังไม่ได้ Commit ดังนั้นหลังจากนี้มันจะถูกส่งให้คนอื่นอีกรอบ' },
      { name: 'รับช่วง', title: 'w1 กับ w3 รับ Partition ของ w2 และเราส่งรอบ 2', text: 'ตารางมี 400 แถว Order 10 ตัวที่ w2 ค้างไว้ถูกส่งมาซ้ำ แต่ INSERT OR IGNORE ไม่นับซ้ำ' },
      { name: 'Broker ล้ม', title: `ฆ่า Broker ${K} (Leader ของ Partition 0) ด้วย SIGKILL`, text: `เราเริ่มส่งรอบ 3 และเปิด Worker w4 ทดแทน Producer ส่งรอบนี้เสร็จใน ${SINCE} วินาทีหลังฆ่า เพราะต้องรอและลองใหม่จนมี Leader ใหม่ (บทที่ 6 วัดไว้ว่าราว 9 วินาที)` },
      { name: 'ส่งรอบ 3', title: 'ส่ง Order ครบ 600 ตัว', text: 'Producer ได้ ack ครบทุกตัวแม้ Broker ล้ม เพราะ acks=all, min.insync.replicas=2 และ Idempotence ช่วยให้ลองส่งซ้ำได้ปลอดภัย' },
      { name: 'จบ', title: 'ตารางมี 600 แถวพอดี Lag เป็น 0', text: `Worker ได้ Order มา ${data.deliveries} ครั้ง (ซ้ำ ${data.deliveries - data.distinct}) แต่ตารางมี ${data.distinct} แถว ไม่ขาดและไม่ซ้ำ ลูกค้า 8 คนกระจายลงแค่ 4 จาก 6 Partition` },
    ],
    caption: 'ลำดับและตัวเลขมาจากแบบฝึก 12 (capstone.json): เวลาที่แสดงเป็นวินาทีนับจากเริ่ม ตัวเลขในกล่อง Partition คือจำนวน Record ตอนจบ Broker รันใน Docker ส่วน Worker เป็น Thread ของโปรแกรมทดสอบ ทั้งหมดอยู่บนคอมพิวเตอร์เครื่องเดียว',
  },
  en: {
    title: 'Press next one step at a time through the real run of the pipeline. See who reads which partition when a consumer and a broker fail, and how many orders are in the table at the end',
    legend: [{ kind: 'use', text: 'running' }, { kind: 'new', text: 'changed in this step' }, { kind: 'skip', text: 'crashed' }],
    producer: 'producer (idempotent, acks=all)', sent: 'sent', partition: 'partition', worker: 'worker', table: 'table orders (PK: order_id)', rows: 'rows', extra: 'repeats ignored', crashed: 'crashed', empty: 'idle',
    steps: [
      { name: 'start', title: 'Start the cluster and the topic', text: 'Three brokers and one controller. The topic orders has 6 partitions, 3 replicas and min.insync.replicas=2.' },
      { name: 'share', title: 'Three workers share the partitions', text: 'The group ledger has w1, w2 and w3, two partitions each.' },
      { name: 'wave 1', title: 'Send 200 orders', text: 'The workers write every order to the table and commit every 40. The table has 200 rows.' },
      { name: 'worker crash', title: 'w2 crashes without saying goodbye', text: 'w2 had read and written 10 orders that were not committed yet, so they will be delivered to someone else again.' },
      { name: 'takeover', title: 'w1 and w3 take over the partitions of w2, and we send wave 2', text: 'The table has 400 rows. The 10 orders that w2 left behind came a second time, but INSERT OR IGNORE did not count them twice.' },
      { name: 'broker crash', title: `Kill broker ${K} (leader of partition 0) with SIGKILL`, text: `We started wave 3 and a replacement worker w4. The producer finished this wave ${SINCE} seconds after the kill, because it waited and retried until there was a new leader (lesson 6 measured about 9 seconds).` },
      { name: 'wave 3', title: 'All 600 orders sent', text: 'The producer got an ack for every order in spite of the dead broker, because acks=all, min.insync.replicas=2 and idempotence make retrying safe.' },
      { name: 'end', title: 'The table has exactly 600 rows, lag is 0', text: `The workers received ${data.deliveries} deliveries (${data.deliveries - data.distinct} extra) but the table has ${data.distinct} rows: nothing missing, nothing doubled. The 8 customers landed in only 4 of the 6 partitions.` },
    ],
    caption: 'The order and the numbers come from exercise 12 (capstone.json): times are seconds since the start. The numbers in the partition boxes are the record counts at the end. The brokers run in Docker and the workers are threads of the test program, all on one computer.',
  },
};

export default function PipelineLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const st = useStepper(T.steps.length);
  const s = st.step;
  const S = STATES[s];
  const prev = STATES[Math.max(0, s - 1)];
  const ownerOf = (p: number) => Object.entries(S.owners).find(([, ps]) => ps.includes(p))?.[0];
  const extra = data.deliveries - data.distinct;
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="viz-box">
        <svg viewBox="0 0 880 380" role="img" aria-label={T.title}>
          {[1, 2, 3].map((b, i) => (
            <Box key={b} x={14 + i * 128} y={14} w={118} h={60} title={`Broker ${b}`} state={S.deadBroker && b === data.killed_broker ? 'skip' : s === 5 && b !== data.killed_broker ? 'use' : 'use'} dead={S.deadBroker && b === data.killed_broker} />
          ))}
          <Box x={410} y={14} w={236} h={60} title={T.producer} state={S.sent !== prev.sent ? 'new' : 'use'} sub={`${T.sent} ${S.sent}`} />
          {Array.from({ length: 6 }, (_, p) => {
            const o = ownerOf(p);
            return (
              <g key={p}>
                <rect className={o ? 'ib-use' : 'ib-skip'} x={14 + p * 112} y={112} width={104} height={62} rx={9} />
                <text x={14 + p * 112 + 10} y={138} className="ib-n">{`${T.partition} ${p}`}</text>
                <text x={14 + p * 112 + 10} y={160} className="ib-s">{o ? `→ ${o}` : '—'}{s >= 7 ? `  (${COUNTS[p]})` : ''}</text>
              </g>
            );
          })}
          {WORKERS.map((w, i) => {
            const mine = S.owners[w];
            const dead = S.dead.includes(w);
            const here = mine !== undefined || dead;
            const changed = JSON.stringify(prev.owners[w]) !== JSON.stringify(mine) && !dead;
            return (
              <g key={w} style={!here ? { opacity: 0.3 } : undefined}>
                <rect className={dead ? 'ib-skip' : changed ? 'ib-new' : 'ib-use'} x={14 + i * 150} y={210} width={140} height={84} rx={10} />
                <text x={24 + i * 150} y={238} className="ib-n">{`${T.worker} ${w}`}</text>
                <text x={24 + i * 150} y={262} className="ib-s">{dead ? `✗ ${T.crashed}` : mine === undefined ? '' : mine.length ? mine.map((p) => `P${p}`).join(' ') : T.empty}</text>
              </g>
            );
          })}
          <rect className={S.rows !== prev.rows ? 'ib-new' : 'ib-use'} x={624} y={196} width={242} height={112} rx={12} />
          <text x={638} y={222} className="ib-s">{T.table}</text>
          <text x={638} y={264} className="ib-big" style={{ fontSize: 44 }}>{S.rows}</text>
          <text x={730} y={264} className="ib-s">{T.rows}</text>
          {s >= 4 && <text x={638} y={298} className="ib-s" style={{ fontSize: 13 }}>{`+${s >= 7 ? extra : 10} ${T.extra}`}</text>}
          <text x={14} y={340} className="ib-s">{`t = ${S.t} s`}</text>
        </svg>
      </div>
      <StepControls steps={T.steps} step={s} playing={st.playing} go={st.go} toggle={st.toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
