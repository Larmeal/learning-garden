import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import matrix from './joinMatrix.json';

// The result of every combination below is an explain() of a real join that
// subjects/spark/code/exercises/07_performance_tuning.py ran (Spark 4.2.0, AQE off).
// A 100-row table (estimated 800 B) is joined with a 2,000,000-row table (estimated 16 MB) on k.
// Regenerate the matrix with: uv run python exercises/07_performance_tuning.py --write

type Row = { small: string; how: string; hint: string; threshold: string; node: string | null; build: string | null };
const ROWS = matrix as Row[];

const SIDES = [
  { id: 'right', label: 'ตารางเล็กอยู่ขวา' },
  { id: 'left', label: 'ตารางเล็กอยู่ซ้าย' },
];
const HOWS = [
  { id: 'inner', label: 'inner' },
  { id: 'left', label: 'left outer' },
  { id: 'right', label: 'right outer' },
  { id: 'full', label: 'full outer' },
];
const HINTS = [
  { id: 'none', label: 'ไม่มี hint' },
  { id: 'broadcast', label: 'broadcast' },
  { id: 'merge', label: 'merge' },
  { id: 'shuffle_hash', label: 'shuffle_hash' },
  { id: 'shuffle_replicate_nl', label: 'shuffle_replicate_nl' },
];
const THRESHOLDS = [
  { id: 'default', label: 'threshold 10 MB' },
  { id: 'disabled', label: 'threshold -1 (ปิด)' },
];

const NOTES: Record<string, string> = {
  BroadcastHashJoin: 'ตารางเล็กถูกเก็บมาที่ driver แล้วส่งสำเนาไปทุก executor ตารางใหญ่ไม่ถูก shuffle และไม่ต้อง sort',
  SortMergeJoin: 'ทั้งสองฝั่งถูก shuffle ด้วย key (Exchange) แล้ว sort ในแต่ละ partition จากนั้นไล่รวมสองแถวที่เรียงแล้ว',
  ShuffledHashJoin: 'ทั้งสองฝั่งถูก shuffle แต่ไม่ sort ฝั่งที่เล็กกว่าถูกสร้างเป็น hash table ในแต่ละ partition',
  CartesianProduct: 'ไม่มี shuffle เลย แต่จับคู่ทุกแถวกับทุกแถว แล้วค่อยกรองด้วยเงื่อนไข join ช้ามากเมื่อข้อมูลใหญ่',
};

function useReason(r: Row, p: { small: string; how: string; hint: string; threshold: string }) {
  const bits: string[] = [];
  const buildable = p.small === 'right' ? p.how === 'inner' || p.how === 'left' : p.how === 'inner' || p.how === 'right';
  if (p.hint === 'broadcast' && !buildable) bits.push('hint broadcast ใช้ไม่ได้กับ join type และฝั่งนี้ จึงถูกข้ามเงียบๆ');
  if (p.hint === 'shuffle_replicate_nl' && p.how !== 'inner') bits.push('hint shuffle_replicate_nl ใช้ได้กับ inner join เท่านั้น จึงถูกข้าม');
  if (p.hint === 'none' && p.threshold === 'default' && !buildable) bits.push('ตารางเล็กอยู่ฝั่งที่ join type นี้ไม่ยอมให้ broadcast');
  if (p.hint === 'none' && p.threshold === 'disabled') bits.push('threshold ปิดอยู่และไม่มี hint จึงไม่ broadcast');
  if (p.hint === 'merge') bits.push('hint merge ชนะ threshold');
  if (p.hint === 'broadcast' && buildable) bits.push('hint broadcast ชนะ threshold (แม้ตั้งเป็น -1)');
  void r;
  return bits;
}

function Column({ title, size, node, side, build, left }: { title: string; size: string; node: string; side: 'small' | 'big'; build: string | null; left: boolean }) {
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
        {layers.length === 0 && <div className="jp-none">ไม่มี Exchange หรือ Sort</div>}
      </div>
      <motion.div layout className={`jp-scan ${side}`} transition={t}>
        <strong>{title}</strong>
        <span>{size}</span>
        {built && <em>build side</em>}
      </motion.div>
    </div>
  );
}

export default function JoinPickerLab() {
  const [small, setSmall] = useState('right');
  const [how, setHow] = useState('inner');
  const [hint, setHint] = useState('none');
  const [threshold, setThreshold] = useState('default');

  const row = useMemo(
    () => ROWS.find((r) => r.small === small && r.how === how && r.hint === hint && r.threshold === threshold)!,
    [small, how, hint, threshold],
  );
  const node = row.node ?? '?';
  const reasons = useReason(row, { small, how, hint, threshold });
  const smallCol = <Column key="s" title="ตารางเล็ก" size="100 แถว (~800 B)" node={node} side="small" build={row.build} left={small === 'left'} />;
  const bigCol = <Column key="b" title="ตารางใหญ่" size="2,000,000 แถว (~16 MB)" node={node} side="big" build={row.build} left={small !== 'left'} />;

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
      <div className="viz-title">Spark เลือก join ตัวไหน: ลองเปลี่ยนเงื่อนไข</div>
      {group('ตำแหน่ง', SIDES, small, setSmall)}
      {group('Join type', HOWS, how, setHow)}
      {group('Hint ที่ตารางเล็ก', HINTS, hint, setHint)}
      {group('Threshold', THRESHOLDS, threshold, setThreshold)}

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
        <span>{NOTES[node]}</span>
        {reasons.length > 0 && <span> เพราะ: {reasons.join(' และ ')}</span>}
      </div>
      <figcaption className="viz-caption">
        ทุกช่องคือผล explain() จริงของ join ที่รันด้วย Spark 4.2.0 (AQE ปิด เพื่อให้เห็นแผนตั้งต้น) ตารางเล็กประเมินขนาดได้ 800 ไบต์ ตารางใหญ่ 16 ล้านไบต์
      </figcaption>
    </figure>
  );
}
