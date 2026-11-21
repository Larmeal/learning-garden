import { useState } from 'react';
import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import { ease } from '../git/gl';
import data from './morsel.json';

// Shows:      the 5,000,000 rows of a column cut into batches (one tick each) and pushed through three steps: read the file, call a function on the
//             batch, add it to the running sum. In the streaming engine the batches overlap, so all three steps are busy at the same time.
//             In the in-memory engine one step finishes for every chunk before the next step starts.
// Because:    "streaming processes small batches" is a statement about time and overlap; a table of batch counts does not show the overlap.
// Control:    the scenario (streaming with the default morsel size, streaming with a smaller one, in-memory), play, scrub and the jump buttons.
//             A smaller morsel means more ticks (56 against 256), and in-memory shows one busy step at a time.
// Conclusion: the engine moves the data in morsels so that the steps work on different batches together, and the morsel size only changes how many.
//
// The call counts and the largest batch come from exercises/10_inside_polars.py (a map_batches probe on a 5,000,000-row Parquet file with 41 row groups).

type Sc = 'streaming' | 'small' | 'inmem';
const S = data as { rows: number; ideal: number; streaming: { calls: number; largest: number }; streaming_20000: { calls: number; largest: number }; in_memory: { calls: number; largest: number } };
const INFO: Record<Sc, { n: number; largest: number }> = {
  streaming: { n: S.streaming.calls, largest: S.streaming.largest },
  small: { n: S.streaming_20000.calls, largest: S.streaming_20000.largest },
  inmem: { n: S.in_memory.calls, largest: S.in_memory.largest },
};
const DURATION = 9;
const STAGES = 3;

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; pick: string; sc: Record<Sc, string>; steps: string[]; busy: (n: number) => string;
  batches: (n: number, largest: string) => string; summed: string; of: string; marks: Record<Sc, Mark[]>; caption: string; rows: string;
}> = {
  th: {
    title: 'ข้อมูล 5,000,000 แถวถูกตัดเป็นก้อน กดเล่นแล้วดูว่าสามขั้นทำงานพร้อมกันหรือทีละขั้น',
    legend: [{ kind: 'skip', text: 'ยังรออยู่' }, { kind: 'use', text: 'กำลังอยู่ในขั้นใดขั้นหนึ่ง' }, { kind: 'new', text: 'บวกเข้ายอดแล้ว' }],
    pick: 'แบบที่ลอง',
    sc: { streaming: 'Streaming (Morsel 100,000)', small: 'Streaming (Morsel 20,000)', inmem: 'In-memory' },
    steps: ['อ่านไฟล์', 'เรียกฟังก์ชัน', 'บวกเข้ายอด'],
    busy: (n) => (n === 0 ? 'ว่าง' : `ทำอยู่ ${n} ก้อน`),
    batches: (n, largest) => `${n} ก้อน ก้อนใหญ่สุด ${largest} แถว`,
    summed: 'บวกแล้ว', of: 'จาก', rows: 'แถว',
    marks: {
      streaming: [
        { at: 0, name: 'เริ่ม', title: 'ก้อนแรกเข้าขั้นอ่านไฟล์', text: 'ข้อมูลถูกตัดเป็น 56 ก้อน แต่ละก้อนเดินผ่านสามขั้นทีละขั้น' },
        { at: 3.5, name: 'พร้อมกัน', title: 'ทั้งสามขั้นทำงานพร้อมกัน', text: 'ขณะที่ก้อนหนึ่งกำลังถูกบวก ก้อนถัดไปกำลังเรียกฟังก์ชัน และก้อนหลังจากนั้นกำลังถูกอ่านจากไฟล์ ไม่มีขั้นไหนรอให้ทั้ง 5,000,000 แถวมาถึงก่อน' },
        { at: 8.2, name: 'จบ', title: 'ครบทุกก้อน', text: 'ผลรวมของทุกก้อนคือ 5,000,000 แถวพอดี ก้อนใหญ่สุด 121,952 แถว (ใหญ่กว่า 100,000 เพราะ Row Group ของไฟล์นี้มี 121,951 แถว)' },
      ],
      small: [
        { at: 0, name: 'เริ่ม', title: 'ตั้ง Morsel เป็น 20,000 แถว', text: 'ก้อนเล็กลง จำนวนก้อนจึงเพิ่มเป็น 256 ก้อน แต่ผลรวมยังเป็น 5,000,000 แถวเท่าเดิม' },
        { at: 3.5, name: 'พร้อมกัน', title: 'ก้อนมากขึ้น ลักษณะเดิม', text: 'สามขั้นยังทำงานพร้อมกันเหมือนเดิม เปลี่ยนแค่ว่าแต่ละก้อนเล็กลงและมีจำนวนมากขึ้น' },
        { at: 8.2, name: 'จบ', title: 'ครบทุกก้อน', text: 'ก้อนใหญ่สุดเหลือ 20,326 แถว (เกิน 20,000 เล็กน้อย)' },
      ],
      inmem: [
        { at: 0, name: 'อ่านไฟล์', title: 'In-memory อ่านทุกก้อนก่อน', text: 'ขั้นแรกเสร็จสำหรับทั้ง 41 ก้อน (Row Group ละหนึ่ง Chunk) ก่อนที่ขั้นที่สองจะเริ่ม' },
        { at: 3.2, name: 'ฟังก์ชัน', title: 'แล้วจึงเรียกฟังก์ชันทีละก้อน', text: 'ฟังก์ชันถูกเรียก 41 ครั้ง ครั้งละหนึ่ง Chunk ตอนนี้มีขั้นเดียวที่ทำงาน' },
        { at: 6.2, name: 'บวก', title: 'ขั้นสุดท้ายบวกเข้ายอด', text: 'คำตอบสุดท้ายเท่ากับของ Streaming ทุกตัวเลข ต่างกันที่วิธีรัน' },
      ],
    },
    caption: 'จำนวนก้อนและก้อนใหญ่สุดมาจากการรันจริงในแบบฝึก 10 (ฟังก์ชันที่จดขนาดของข้อมูลที่ถูกส่งเข้ามา บนไฟล์ Parquet 5,000,000 แถวที่มี 41 Row Group) ภาพวาดให้ทุกก้อนมีขนาดเท่ากัน เวลาในภาพเป็นภาพจำลอง และการที่ In-memory ทำทีละขั้นเป็นการอธิบายตามหลักการของมัน ผู้เขียนยังไม่ได้ตรวจในโค้ด',
  },
  en: {
    title: '5,000,000 rows cut into batches. Press play and see whether the three steps run together or one after another',
    legend: [{ kind: 'skip', text: 'still waiting' }, { kind: 'use', text: 'inside one of the steps' }, { kind: 'new', text: 'added to the sum' }],
    pick: 'Scenario',
    sc: { streaming: 'Streaming (morsel 100,000)', small: 'Streaming (morsel 20,000)', inmem: 'In-memory' },
    steps: ['read the file', 'call the function', 'add to the sum'],
    busy: (n) => (n === 0 ? 'idle' : `${n} batch${n === 1 ? '' : 'es'} busy`),
    batches: (n, largest) => `${n} batches, largest ${largest} rows`,
    summed: 'summed', of: 'of', rows: 'rows',
    marks: {
      streaming: [
        { at: 0, name: 'start', title: 'The first batch enters the read step', text: 'The data is cut into 56 batches, and each one walks through the three steps' },
        { at: 3.5, name: 'together', title: 'All three steps are busy together', text: 'While one batch is being added, the next is in the function and the one after that is being read from the file. No step waits for all 5,000,000 rows to arrive.' },
        { at: 8.2, name: 'end', title: 'Every batch is done', text: 'The sizes add up to exactly 5,000,000 rows. The largest batch is 121,952 rows (above 100,000 because the row groups of this file hold 121,951 rows).' },
      ],
      small: [
        { at: 0, name: 'start', title: 'Morsel size set to 20,000 rows', text: 'Smaller batches, so there are 256 of them, and the total is still 5,000,000 rows' },
        { at: 3.5, name: 'together', title: 'More batches, same pattern', text: 'The three steps still run together. Only the batches are smaller and more numerous.' },
        { at: 8.2, name: 'end', title: 'Every batch is done', text: 'The largest batch is 20,326 rows (a little above 20,000)' },
      ],
      inmem: [
        { at: 0, name: 'read', title: 'In-memory reads every chunk first', text: 'The first step finishes for all 41 chunks (one per row group) before the second step starts' },
        { at: 3.2, name: 'function', title: 'Then the function runs chunk by chunk', text: 'The function is called 41 times, once per chunk. Only one step is busy now.' },
        { at: 6.2, name: 'sum', title: 'The last step adds to the sum', text: 'The final answer equals the streaming one in every digit. The difference is how it was run.' },
      ],
    },
    caption: 'The batch counts and the largest batch come from a real run in exercise 10 (a function that records the size of every batch it receives, on a 5,000,000-row Parquet file with 41 row groups). The drawing gives every batch the same size, and the times in the picture are an illustration, and that in-memory goes one step at a time is how it is described to work, not something the author checked in the source.',
  },
};

// the stage of batch i at time t: 0 waiting, 1 to 3 inside that step, k + 0.5 finished step k and waiting for the next, 4 done
function stageOf(sc: Sc, i: number, n: number, t: number): number {
  if (sc === 'inmem') {
    const phases: [number, number][] = [[0, 3.2], [3.2, 6.2], [6.2, 8.6]];
    if (t >= phases[2][1]) return 4;
    for (let p = 0; p < 3; p++) {
      const [a, b] = phases[p];
      if (t >= a && t < b) {
        const cursor = ((t - a) / (b - a)) * n;
        if (i === Math.floor(cursor)) return p + 1;
        if (i < cursor) return p === 2 ? 4 : p + 1.5;
        return p === 0 ? 0 : p + 0.5;
      }
    }
    return 0;
  }
  const start = (i / n) * 6;
  const age = t - start;
  if (age < 0) return 0;
  if (age < 0.6) return 1;
  if (age < 1.2) return 2;
  if (age < 1.8) return 3;
  return 4;
}

export default function MorselLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [sc, setSc] = useState<Sc>('streaming');
  const clock = useClock(DURATION);
  const { t } = clock;
  const { n, largest } = INFO[sc];
  const marks = T.marks[sc];
  const st = Array.from({ length: n }, (_, i) => stageOf(sc, i, n, t));
  const inStep = (k: number) => st.filter((s) => s === k).length;
  const done = st.filter((s) => s === 4).length;
  const summed = Math.round((done / n) * S.rows);
  const tw = Math.min(14, 820 / n);
  const per = (820 - 0) / n;

  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.pick}</span>
        <div className="seg" role="group" aria-label={T.pick} style={{ flexWrap: 'wrap' }}>
          {(['streaming', 'small', 'inmem'] as Sc[]).map((k) => (
            <button key={k} type="button" aria-pressed={sc === k} onClick={() => { setSc(k); clock.restart(); }}>{T.sc[k]}</button>
          ))}
        </div>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 380" role="img" aria-label={T.title}>
          <text x={20} y={32} className="ib-n">{T.batches(n, largest.toLocaleString('en-US'))}</text>
          {st.map((s, i) => (
            <rect
              key={i}
              className={s === 4 ? 'ib-new' : s === 0 ? 'ib-skip' : 'ib-use'}
              x={20 + i * per + (per - tw) / 2}
              y={46}
              width={Math.max(1.5, tw - (n > 100 ? 0.8 : 3))}
              height={40}
              rx={n > 100 ? 1 : 3}
            />
          ))}
          {[0, 1, 2].map((k) => {
            const busy = inStep(k + 1);
            const x = 20 + k * 290;
            const glow = busy > 0;
            return (
              <g key={k}>
                <rect className={glow ? 'ib-new' : 'ib-node'} x={x} y={130} width={260} height={112} rx={12} />
                <text x={x + 20} y={164} className="ib-n">{k + 1}. {T.steps[k]}</text>
                <text x={x + 20} y={196} className="ib-s" style={{ fill: glow ? 'var(--fg)' : 'var(--muted)', fontSize: 18 }}>{T.busy(busy)}</text>
                {k < 2 && <path className="ib-line" d={`M${x + 262},186 L${x + 288},186`} style={{ stroke: 'var(--accent)', strokeWidth: 3 }} />}
                {glow && Array.from({ length: Math.min(busy, 12) }, (_, d) => (
                  <circle key={d} cx={x + 24 + d * 18} cy={222} r={6} style={{ fill: 'var(--accent)', opacity: ease(t, 0, 0.3) }} />
                ))}
              </g>
            );
          })}
          <text x={20} y={288} className="ib-n">{T.summed}: {summed.toLocaleString('en-US')} {T.of} {S.rows.toLocaleString('en-US')} {T.rows}</text>
          <rect className="ib-node" x={20} y={304} width={820} height={18} rx={9} />
          <rect className="ib-new" x={20} y={304} width={Math.max(0, (820 * summed) / S.rows)} height={18} rx={9} />
        </svg>
      </div>
      <ClockControls clock={clock} marks={marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
