import { StepControls, useStepper, type StepInfo } from '../spark/stepper';
import type { Lang } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import data from './connect.json';

// Shows:      the word count of Kafka Streams as it runs on three lines of text: the line, its words, the table of counts (the state store), the output topic that receives every change, and the changelog topic that backs the table.
// Because:    a Streams application is a topology that keeps state, and the state has a second life in a topic. The table, the output and the changelog change together and have to be seen together.
// Control:    the step buttons: each of the three lines, then "stop and delete the local state", then one more line after the restart.
// Conclusion: every update of a count is a record in the output topic and in the changelog topic; after the local state is deleted the counts come back from the changelog.
//
// The updates are the real ones of exercise 10 (the WordCountDemo of the Kafka distribution): hello 1, kafka 1, hello 2, streams 1, kafka 2, streams 2, kafka 3, and after the restart hello 3 and again 1.

type U = [string, number];
const UPDATES = data.words.updates as U[];
const AFTER = data.words.after_restart as U[];
const LINES = ['hello kafka', 'hello streams', 'kafka streams kafka', '', 'hello again'];
const RANGE: [number, number][] = [[0, 2], [2, 4], [4, 7]];

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; line: string; words: string; store: string; out: string; changelog: string; deleted: string; steps: StepInfo[]; caption: string;
}> = {
  th: {
    title: 'กดถัดไปทีละขั้น ดูว่า Kafka Streams นับคำอย่างไร ทุกการเปลี่ยนของตัวเลขถูกส่งออกไปที่ไหน และตัวเลขกลับมาได้อย่างไรเมื่อลบสถานะบนเครื่อง',
    legend: [{ kind: 'new', text: 'ที่เพิ่งเปลี่ยนในขั้นนี้' }, { kind: 'use', text: 'ที่มีอยู่' }, { kind: 'skip', text: 'ที่ถูกลบ' }],
    line: 'บรรทัดที่เข้ามา', words: 'คำที่แยกได้', store: 'ตารางนับ (State Store)', out: 'Topic ผลลัพธ์', changelog: 'Topic changelog (สำรองตารางนับ)', deleted: 'ลบแล้ว',
    steps: [
      { name: 'บรรทัด 1', title: 'เข้ามา: hello kafka', text: 'Streams แยกคำ แล้วนับ hello เป็น 1 และ kafka เป็น 1 ทุกครั้งที่ตัวเลขเปลี่ยน มี Record ออกไปที่ Topic ผลลัพธ์และ Topic changelog' },
      { name: 'บรรทัด 2', title: 'เข้ามา: hello streams', text: 'hello เปลี่ยนเป็น 2 และ streams เป็น 1 Topic ผลลัพธ์ได้ Record ใหม่สองตัว ไม่ได้เขียนทับตัวเก่า' },
      { name: 'บรรทัด 3', title: 'เข้ามา: kafka streams kafka', text: 'kafka เป็น 2 แล้วเป็น 3 และ streams เป็น 2 ทั้งสามการเปลี่ยนถูกส่งออกไปตามลำดับ' },
      { name: 'ลบสถานะ', title: 'หยุดแอปพลิเคชัน แล้วลบสถานะบนเครื่องทิ้ง', text: 'ตารางนับที่เก็บอยู่ใน RocksDB บนดิสก์ของแอปถูกลบหมด เหลือสำเนาเดียวที่ Topic changelog' },
      { name: 'เริ่มใหม่', title: 'เริ่มแอปใหม่ แล้วมีบรรทัด hello again เข้ามา', text: 'Streams อ่าน Topic changelog กลับมาสร้างตารางนับ จึงนับต่อได้ hello เป็น 3 (ไม่ใช่ 1) และ again เป็น 1' },
    ],
    caption: 'ตัวเลขมาจากแบบฝึก 10 ซึ่งรัน WordCountDemo ที่มากับ Kafka ในคอนเทนเนอร์ของ Broker (ต้องติดตั้ง libstdc++ เพิ่มเพราะ Image เป็น Alpine ที่ RocksDB ต้องใช้) ไม่ได้เขียน Topology ของเราเอง',
  },
  en: {
    title: 'Press next one step at a time. See how Kafka Streams counts words, where every change of a count is sent, and how the counts come back when the local state is deleted',
    legend: [{ kind: 'new', text: 'what changed in this step' }, { kind: 'use', text: 'what exists' }, { kind: 'skip', text: 'what was deleted' }],
    line: 'incoming line', words: 'words split out', store: 'table of counts (state store)', out: 'output topic', changelog: 'changelog topic (backup of the table)', deleted: 'deleted',
    steps: [
      { name: 'line 1', title: 'Incoming: hello kafka', text: 'Streams splits the words and counts hello as 1 and kafka as 1. Every time a count changes, a record goes to the output topic and the changelog topic.' },
      { name: 'line 2', title: 'Incoming: hello streams', text: 'hello becomes 2 and streams becomes 1. The output topic gets two new records; the old ones are not overwritten.' },
      { name: 'line 3', title: 'Incoming: kafka streams kafka', text: 'kafka becomes 2 and then 3, and streams becomes 2. All three changes go out in order.' },
      { name: 'delete state', title: 'Stop the application and delete the local state', text: 'The table of counts that lived in RocksDB on the application\'s disk is gone. The only copy left is the changelog topic.' },
      { name: 'restart', title: 'Start the application again; the line hello again arrives', text: 'Streams reads the changelog topic and rebuilds the table, so it counts on: hello becomes 3 (not 1) and again becomes 1.' },
    ],
    caption: 'The numbers come from exercise 10, which ran the WordCountDemo that ships with Kafka inside the broker\'s container (libstdc++ had to be installed because the image is Alpine and RocksDB needs it). No topology of our own was written.',
  },
};

export default function StreamsLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const st = useStepper(T.steps.length);
  const s = st.step;
  const upto = s <= 2 ? UPDATES.slice(0, RANGE[s][1]) : s === 3 ? UPDATES : [...UPDATES, ...AFTER];
  const fresh = s <= 2 ? UPDATES.slice(RANGE[s][0], RANGE[s][1]) : s === 4 ? AFTER : [];
  const table = new Map<string, number>();
  upto.forEach(([w, n]) => table.set(w, n));
  const line = LINES[s];
  const words = line ? line.split(' ') : [];
  const wiped = s === 3;
  const isFresh = (u: U) => fresh.some((f) => f[0] === u[0] && f[1] === u[1]);
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="viz-box">
        <svg viewBox="0 0 880 360" role="img" aria-label={T.title}>
          <text x={14} y={24} className="ib-n">{T.line}</text>
          <rect className={line ? 'ib-new' : 'ib-skip'} x={14} y={34} width={250} height={44} rx={8} />
          <text x={26} y={62} className="ib-m" style={{ fill: 'var(--fg)', fontSize: 15 }}>{line || '—'}</text>
          <text x={14} y={112} className="ib-s">{T.words}</text>
          {words.map((w, i) => (
            <g key={i}>
              <rect className="ib-node" x={14 + i * 84} y={122} width={78} height={32} rx={7} />
              <text x={14 + i * 84 + 39} y={144} textAnchor="middle" className="ib-m" style={{ fill: 'var(--fg)', fontSize: 14 }}>{w}</text>
            </g>
          ))}
          <path className="ib-arrow" d="M270,140 L330,140" style={{ opacity: words.length ? 1 : 0.2 }} />
          <text x={340} y={24} className="ib-n">{T.store}</text>
          <rect className={wiped ? 'ib-skip' : 'ib-use'} x={340} y={34} width={230} height={170} rx={10} style={wiped ? { opacity: 0.5 } : undefined} />
          {wiped ? <text x={455} y={130} textAnchor="middle" className="ib-bad" style={{ fontSize: 24 }}>✗ {T.deleted}</text> : [...table].map(([w, n], i) => (
            <text key={w} x={354} y={64 + i * 28} className="ib-m" style={{ fill: fresh.some((f) => f[0] === w) ? 'var(--accent)' : 'var(--fg)', fontSize: 16, fontWeight: fresh.some((f) => f[0] === w) ? 700 : 400 }}>{`${w}`.padEnd(8, ' ')} {n}</text>
          ))}
          <path className="ib-arrow" d="M570,120 L630,100" style={{ opacity: fresh.length ? 1 : 0.2 }} />
          <text x={640} y={24} className="ib-n">{T.out}</text>
          {upto.map((u, i) => (
            <g key={i}>
              <rect className={isFresh(u) ? 'ib-new' : 'ib-use'} x={640 + (i % 3) * 76} y={36 + Math.floor(i / 3) * 34} width={70} height={28} rx={6} />
              <text x={640 + (i % 3) * 76 + 36} y={55 + Math.floor(i / 3) * 34} textAnchor="middle" className="ib-m" style={{ fill: 'var(--fg)', fontSize: 12 }}>{`${u[0]}:${u[1]}`}</text>
            </g>
          ))}
          <text x={14} y={262} className="ib-n">{T.changelog}</text>
          {upto.map((u, i) => (
            <g key={i}>
              <rect className={isFresh(u) ? 'ib-new' : 'ib-use'} x={14 + i * 64} y={274} width={60} height={30} rx={6} style={{ opacity: s === 3 ? 1 : 0.9 }} />
              <text x={14 + i * 64 + 30} y={294} textAnchor="middle" className="ib-m" style={{ fill: 'var(--fg)', fontSize: 12 }}>{`${u[0].slice(0, 5)}:${u[1]}`}</text>
            </g>
          ))}
          {s >= 4 && <path className="ib-arrow" d="M300,262 L380,214" />}
        </svg>
      </div>
      <StepControls steps={T.steps} step={s} playing={st.playing} go={st.go} toggle={st.toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
