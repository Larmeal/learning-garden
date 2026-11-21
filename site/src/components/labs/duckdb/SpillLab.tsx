import { useState } from 'react';
import type { Lang } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import data from './spill.json';

// Shows:      a box for memory that is limited to the size we pick, the state of one big GROUP BY that has to fit in it, and a stack of temp files on disk that grows when it does not.
// Because:    "spilling" is the overflow of something into somewhere else, and the amount that overflows is the number to watch as the limit shrinks.
// Control:    the memory limit (six values). The memory box shrinks and the pile of files on disk grows, and the seconds change.
// Conclusion: the same answer comes out under every limit. Below about 1 GB the query writes temp files, and the lower the limit the more it writes.
//
// The temp folder peak and the seconds come from exercises/10_beyond_memory.py --write (spill.json): the engine's own profile of a GROUP BY with 7.3 million groups.
// The seconds change a lot between runs on this computer, so read them as one run.

const LIMITS = data.limits;
const MAXMB = 2048;
const LIM_MB: Record<string, number> = { '2GB': 2048, '1GB': 1024, '600MB': 600, '400MB': 400, '200MB': 200, '100MB': 100 };

const TEXT: Record<Lang, { title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; pick: string; mem: string; disk: string; temp: string; sec: string; answer: string; readout: (lim: string, temp: number) => string; caption: string }> = {
  th: {
    title: 'ลด memory_limit ทีละขั้น แล้วดูว่าไฟล์ชั่วคราวบนดิสก์เริ่มเกิดตอนไหนและคำตอบเปลี่ยนไหม',
    legend: [{ kind: 'new', text: 'ไฟล์ชั่วคราวที่ถูกเขียนลงดิสก์' }, { kind: 'use', text: 'Memory ที่ DuckDB ใช้ได้' }],
    pick: 'memory_limit', mem: 'Memory ที่ใช้ได้', disk: 'ดิสก์ (temp_directory)', temp: 'โฟลเดอร์ชั่วคราวสูงสุด', sec: 'วินาที', answer: 'คำตอบ: 7,344,514 กลุ่มจาก 20,000,000 แถว',
    readout: (lim, temp) => (temp === 0
      ? `ที่ ${lim} ข้อมูลของ Query พอดีกับ Memory จึงไม่มีอะไรถูกเขียนลงดิสก์ และคำตอบเดิม`
      : `ที่ ${lim} Memory ไม่พอ DuckDB จึงเขียนข้อมูลบางส่วนลงไฟล์ชั่วคราวสูงสุดประมาณ ${temp} MB แล้วทำต่อ ได้คำตอบเดิมแต่ใช้เวลานานขึ้น`),
    caption: 'ขนาดโฟลเดอร์ชั่วคราวสูงสุดและเวลามาจากแบบฝึก 10 (Profile ของ Engine กับ GROUP BY 20 ล้านแถวที่มี 7.3 ล้านกลุ่ม) เวลาเปลี่ยนมากระหว่างรอบการรันบนเครื่องเดียวกัน จึงควรอ่านเป็นผลของการรันหนึ่งครั้ง',
  },
  en: {
    title: 'Lower memory_limit step by step and see when temporary files appear on disk and whether the answer changes',
    legend: [{ kind: 'new', text: 'temp file written to disk' }, { kind: 'use', text: 'memory DuckDB may use' }],
    pick: 'memory_limit', mem: 'memory available', disk: 'disk (temp_directory)', temp: 'peak temp folder', sec: 'seconds', answer: 'answer: 7,344,514 groups out of 20,000,000 rows',
    readout: (lim, temp) => (temp === 0
      ? `At ${lim} the data of the query fits in memory, so nothing is written to disk, and the answer is the same.`
      : `At ${lim} memory is not enough, so DuckDB writes part of the data to temporary files, peaking at about ${temp} MB, and carries on. The answer is the same but takes longer.`),
    caption: 'The peak temp folder and the seconds come from exercise 10 (the engine\'s profile of a GROUP BY over 20 million rows with 7.3 million groups). The seconds change a lot between runs on the same computer, so read them as one run.',
  },
};

export default function SpillLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [k, setK] = useState(4);
  const L = LIMITS[k];
  const memW = Math.max(40, (LIM_MB[L.limit] / MAXMB) * 380);
  const files = Math.min(12, Math.ceil(L.tempMB / 40));
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.pick}</span>
        <span className="seg" role="group" aria-label={T.pick}>
          {LIMITS.map((x, i) => <button key={x.limit} type="button" aria-pressed={k === i} onClick={() => setK(i)}>{x.limit}</button>)}
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 280" role="img" aria-label={T.title}>
          <text x={14} y={26} className="ib-n">{T.mem}</text>
          <rect className="ib-skip" x={14} y={40} width={380} height={64} rx={10} />
          <rect className="ib-use" x={14} y={40} width={memW} height={64} rx={10} />
          <text x={26} y={80} className="ib-big" style={{ fontSize: 30 }}>{L.limit}</text>
          <path className={L.tempMB > 0 ? 'ib-arrow' : 'ib-line'} d="M410,72 L470,72" />
          <text x={480} y={26} className="ib-n">{T.disk}</text>
          <rect className="ib-skip" x={480} y={40} width={386} height={150} rx={10} />
          {Array.from({ length: files }, (_, i) => (
            <rect key={i} className="ib-new" x={494 + (i % 6) * 60} y={54 + Math.floor(i / 6) * 60} width={50} height={46} rx={7} />
          ))}
          <text x={14} y={150} className="ib-s">{T.temp}</text>
          <text x={14} y={192} className="ib-big" style={{ fontSize: 36 }}>{`${L.tempMB} MB`}</text>
          <text x={14} y={226} className="ib-n">{`${L.seconds} ${T.sec}`}</text>
          <text x={14} y={262} className="ib-s">{T.answer}</text>
        </svg>
      </div>
      <div className="readout" aria-live="polite"><div>{T.readout(L.limit, L.tempMB)}</div></div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
