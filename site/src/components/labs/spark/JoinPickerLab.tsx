import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import matrix from './joinMatrix.json';
import type { Lang } from './stepper';

// The result of every combination below is an explain() of a real join that
// subjects/spark/code/exercises/07_performance_tuning.py ran (Spark 4.2.0, AQE off).
// A 100-row table (estimated 800 B) is joined with a 2,000,000-row table (estimated 16 MB) on k.
// Regenerate the matrix with: uv run python exercises/07_performance_tuning.py --write

type Row = { small: string; how: string; hint: string; threshold: string; node: string | null; build: string | null };
const ROWS = matrix as Row[];

const TEXT = {
  th: {
    sides: [
      { id: 'right', label: 'ตารางเล็กอยู่ขวา' },
      { id: 'left', label: 'ตารางเล็กอยู่ซ้าย' },
    ],
    hints: [
      { id: 'none', label: 'ไม่มี hint' },
      { id: 'broadcast', label: 'broadcast' },
      { id: 'merge', label: 'merge' },
      { id: 'shuffle_hash', label: 'shuffle_hash' },
      { id: 'shuffle_replicate_nl', label: 'shuffle_replicate_nl' },
    ],
    thresholds: [
      { id: 'default', label: 'threshold 10 MB' },
      { id: 'disabled', label: 'threshold -1 (ปิด)' },
    ],
    notes: {
      BroadcastHashJoin: 'ตารางเล็กถูกเก็บมาที่ driver แล้วส่งสำเนาไปทุก executor ตารางใหญ่ไม่ถูก shuffle และไม่ต้อง sort',
      SortMergeJoin: 'ทั้งสองฝั่งถูก shuffle ด้วย key (Exchange) แล้ว sort ในแต่ละ partition จากนั้นไล่รวมสองแถวที่เรียงแล้ว',
      ShuffledHashJoin: 'ทั้งสองฝั่งถูก shuffle แต่ไม่ sort ฝั่งที่เล็กกว่าถูกสร้างเป็น hash table ในแต่ละ partition',
      CartesianProduct: 'ไม่มี shuffle เลย แต่จับคู่ทุกแถวกับทุกแถว แล้วค่อยกรองด้วยเงื่อนไข join ช้ามากเมื่อข้อมูลใหญ่',
    } as Record<string, string>,
    reasonBroadcastSkipped: 'hint broadcast ใช้ไม่ได้กับ join type และฝั่งนี้ จึงถูกข้ามเงียบๆ',
    reasonReplicateSkipped: 'hint shuffle_replicate_nl ใช้ได้กับ inner join เท่านั้น จึงถูกข้าม',
    reasonWrongSide: 'ตารางเล็กอยู่ฝั่งที่ join type นี้ไม่ยอมให้ broadcast',
    reasonDisabled: 'threshold ปิดอยู่และไม่มี hint จึงไม่ broadcast',
    reasonMerge: 'hint merge ชนะ threshold',
    reasonBroadcast: 'hint broadcast ชนะ threshold (แม้ตั้งเป็น -1)',
    noExchange: 'ไม่มี Exchange หรือ Sort',
    smallTitle: 'ตารางเล็ก',
    smallSize: '100 แถว (~800 B)',
    bigTitle: 'ตารางใหญ่',
    bigSize: '2,000,000 แถว (~16 MB)',
    title: 'Spark เลือก join ตัวไหน: ลองเปลี่ยนเงื่อนไข',
    gPosition: 'ตำแหน่ง',
    gHow: 'Join type',
    gHint: 'Hint ที่ตารางเล็ก',
    gThreshold: 'Threshold',
    because: ' เพราะ: ',
    and: ' และ ',
    caption: 'ทุกช่องคือผล explain() จริงของ join ที่รันด้วย Spark 4.2.0 (AQE ปิด เพื่อให้เห็นแผนตั้งต้น) ตารางเล็กประเมินขนาดได้ 800 ไบต์ ตารางใหญ่ 16 ล้านไบต์',
  },
  en: {
    sides: [
      { id: 'right', label: 'Small table on the right' },
      { id: 'left', label: 'Small table on the left' },
    ],
    hints: [
      { id: 'none', label: 'No hint' },
      { id: 'broadcast', label: 'broadcast' },
      { id: 'merge', label: 'merge' },
      { id: 'shuffle_hash', label: 'shuffle_hash' },
      { id: 'shuffle_replicate_nl', label: 'shuffle_replicate_nl' },
    ],
    thresholds: [
      { id: 'default', label: 'threshold 10 MB' },
      { id: 'disabled', label: 'threshold -1 (off)' },
    ],
    notes: {
      BroadcastHashJoin: 'The small table is collected on the driver and a copy is sent to every executor. The big table is not shuffled and does not need to be sorted.',
      SortMergeJoin: 'Both sides are shuffled by the key (Exchange), then sorted inside each partition. Then the two sorted streams are merged.',
      ShuffledHashJoin: 'Both sides are shuffled but not sorted. The smaller side is built into a hash table in each partition.',
      CartesianProduct: 'There is no shuffle, but every row is paired with every row, and then the join condition filters the pairs. It is very slow when the data is big.',
    } as Record<string, string>,
    reasonBroadcastSkipped: 'the broadcast hint cannot be used with this join type and this side, so it is silently skipped',
    reasonReplicateSkipped: 'the shuffle_replicate_nl hint works only with an inner join, so it is skipped',
    reasonWrongSide: 'the small table is on a side that this join type does not allow to broadcast',
    reasonDisabled: 'the threshold is off and there is no hint, so nothing is broadcast',
    reasonMerge: 'the merge hint beats the threshold',
    reasonBroadcast: 'the broadcast hint beats the threshold (even when it is set to -1)',
    noExchange: 'No Exchange or Sort',
    smallTitle: 'Small table',
    smallSize: '100 rows (~800 B)',
    bigTitle: 'Big table',
    bigSize: '2,000,000 rows (~16 MB)',
    title: 'Which join does Spark choose? Change the conditions',
    gPosition: 'Position',
    gHow: 'Join type',
    gHint: 'Hint on the small table',
    gThreshold: 'Threshold',
    because: ' Because: ',
    and: ' and ',
    caption: 'Every cell is the real explain() of a join run with Spark 4.2.0 (AQE off, so you see the starting plan). The small table is estimated at 800 bytes and the big table at 16 million bytes.',
  },
};

const HOWS = [
  { id: 'inner', label: 'inner' },
  { id: 'left', label: 'left outer' },
  { id: 'right', label: 'right outer' },
  { id: 'full', label: 'full outer' },
];

function useReason(r: Row, p: { small: string; how: string; hint: string; threshold: string }, T: (typeof TEXT)['th']) {
  const bits: string[] = [];
  const buildable = p.small === 'right' ? p.how === 'inner' || p.how === 'left' : p.how === 'inner' || p.how === 'right';
  if (p.hint === 'broadcast' && !buildable) bits.push(T.reasonBroadcastSkipped);
  if (p.hint === 'shuffle_replicate_nl' && p.how !== 'inner') bits.push(T.reasonReplicateSkipped);
  if (p.hint === 'none' && p.threshold === 'default' && !buildable) bits.push(T.reasonWrongSide);
  if (p.hint === 'none' && p.threshold === 'disabled') bits.push(T.reasonDisabled);
  if (p.hint === 'merge') bits.push(T.reasonMerge);
  if (p.hint === 'broadcast' && buildable) bits.push(T.reasonBroadcast);
  void r;
  return bits;
}

function Column({ title, size, node, side, build, left, noExchange }: { title: string; size: string; node: string; side: 'small' | 'big'; build: string | null; left: boolean; noExchange: string }) {
  const reduce = useReducedMotion();
  const t = reduce ? { duration: 0 } : { duration: 0.35 };
  const layers: { key: string; label: string }[] = [];
  if (node === 'BroadcastHashJoin') {
    if (side === 'small') layers.push({ key: 'bx', label: 'BroadcastExchange' });
  } else if (node === 'SortMergeJoin') {
    layers.push({ key: 'ex', label: 'Exchange hashpartitioning(k)' }, { key: 'so', label: 'Sort [k]' });
  } else if (node === 'ShuffledHashJoin') {
    layers.push({ key: 'ex', label: 'Exchange hashpartitioning(k)' });
  }
  const built = build && ((build === 'Left') === left);
  return (
    <div className="jp-col">
      <div className="jp-layers">
        <AnimatePresence initial={false}>
          {layers.map((l) => (
            <motion.div key={l.key} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12, height: 0 }} transition={t} className="jp-box">
              <code>{l.label}</code>
            </motion.div>
          ))}
        </AnimatePresence>
        {layers.length === 0 && <div className="jp-none">{noExchange}</div>}
      </div>
      <motion.div layout className={`jp-scan ${side}`} transition={t}>
        <strong>{title}</strong>
        <span>{size}</span>
        {built && <em>build side</em>}
      </motion.div>
    </div>
  );
}

export default function JoinPickerLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [small, setSmall] = useState('right');
  const [how, setHow] = useState('inner');
  const [hint, setHint] = useState('none');
  const [threshold, setThreshold] = useState('default');

  const row = useMemo(
    () => ROWS.find((r) => r.small === small && r.how === how && r.hint === hint && r.threshold === threshold)!,
    [small, how, hint, threshold],
  );
  const node = row.node ?? '?';
  const reasons = useReason(row, { small, how, hint, threshold }, T);
  const smallCol = <Column key="s" title={T.smallTitle} size={T.smallSize} noExchange={T.noExchange} node={node} side="small" build={row.build} left={small === 'left'} />;
  const bigCol = <Column key="b" title={T.bigTitle} size={T.bigSize} noExchange={T.noExchange} node={node} side="big" build={row.build} left={small !== 'left'} />;

  const group = (label: string, opts: { id: string; label: string }[], val: string, set: (v: string) => void) => (
    <div className="jp-group" role="group" aria-label={label}>
      <span className="jp-label">{label}</span>
      <div className="viz-steps">
        {opts.map((o) => (
          <button key={o.id} type="button" aria-pressed={val === o.id} onClick={() => set(o.id)}>{o.label}</button>
        ))}
      </div>
    </div>
  );

  return (
    <figure className="viz">
      <div className="viz-title">{T.title}</div>
      {group(T.gPosition, T.sides, small, setSmall)}
      {group(T.gHow, HOWS, how, setHow)}
      {group(T.gHint, T.hints, hint, setHint)}
      {group(T.gThreshold, T.thresholds, threshold, setThreshold)}

      <div className="viz-box jp-box-wrap">
        <motion.div layout className="jp-join" data-node={node}>
          <strong>{node}</strong>
          {row.build && <span>Build{row.build}</span>}
          <span className="jp-how">{how} join on k</span>
        </motion.div>
        <div className="jp-arrows" aria-hidden="true">▲ ▲</div>
        <div className="jp-cols">{small === 'left' ? [smallCol, bigCol] : [bigCol, smallCol]}</div>
      </div>

      <div className="viz-now" aria-live="polite">
        <strong>{node}</strong>
        <span>{T.notes[node]}</span>
        {reasons.length > 0 && <span>{T.because}{reasons.join(T.and)}</span>}
      </div>
      <figcaption className="viz-caption">
        {T.caption}
      </figcaption>
    </figure>
  );
}
