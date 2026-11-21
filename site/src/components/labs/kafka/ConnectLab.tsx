import { StepControls, useStepper, type StepInfo } from '../spark/stepper';
import type { Lang } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import { Box, Cell } from './kf';

// Shows:      a file that grows, a source connector that turns its lines into records of a topic, the position that Connect keeps in its own topic, and a sink connector that writes the topic out to another file.
// Because:    Connect is "a worker that moves data between a system and a topic and remembers how far it got". The remembered position is what makes a restart safe, and it is a record in a topic, which a picture can show.
// Control:    the step buttons (create the source, append lines, delete and create it again, add a sink).
// Conclusion: a source connector keeps its position in the connect-offsets topic, so a restarted connector does not read old lines again; a sink is just a consumer group that writes what it reads.
//
// Every number is from exercise 10: lines of 8 bytes, the position {"position":40} in connect-offsets, five records in the topic lines, five lines in the sink file, and the group connect-file-sink with no lag.

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; file: string; worker: string; source: string; sink: string; topic: string; offsets: string; position: string; out: string; steps: StepInfo[]; caption: string;
}> = {
  th: {
    title: 'กดถัดไปทีละขั้น ดูว่า Connector ย้ายบรรทัดจากไฟล์เข้า Topic ได้อย่างไร จดตำแหน่งที่อ่านถึงไว้ที่ไหน และไม่อ่านซ้ำเมื่อสร้างใหม่',
    legend: [{ kind: 'new', text: 'ที่เพิ่งเกิดขึ้นในขั้นนี้' }, { kind: 'use', text: 'ที่มีอยู่แล้ว' }, { kind: 'skip', text: 'ที่ยังไม่มี' }],
    file: 'ไฟล์ in.txt', worker: 'Connect Worker', source: 'Source Task', sink: 'Sink Task', topic: 'Topic lines', offsets: 'Topic connect-offsets', position: 'position', out: 'ไฟล์ out.txt',
    steps: [
      { name: 'ไฟล์', title: 'ไฟล์ in.txt มีสามบรรทัด', text: 'บรรทัดละ 8 ไบต์ รวม 24 ไบต์ ตอนนี้ยังไม่มี Connector อะไรทำงาน และ Topic lines ยังว่าง' },
      { name: 'สร้าง Source', title: 'สร้าง Source Connector ผ่าน REST API', text: 'Source Task อ่านทั้งสามบรรทัด ส่งเข้า Topic lines เป็น Record สามตัว แล้วจดตำแหน่ง 24 ไว้ใน connect-offsets' },
      { name: 'เพิ่มบรรทัด', title: 'ต่อท้ายไฟล์อีกสองบรรทัด', text: 'Source Task อ่านต่อจากตำแหน่ง 24 เห็นแค่บรรทัดใหม่ จึงส่ง Record เพิ่มสองตัว Topic มีห้าตัว และตำแหน่งที่จดไว้เป็น 40' },
      { name: 'สร้างใหม่', title: 'ลบ Connector แล้วสร้างใหม่ชื่อเดิม', text: 'Connector ตัวใหม่ถาม connect-offsets ว่าชื่อนี้อ่านถึงไหนแล้ว ได้คำตอบ 40 จึงไม่ส่งอะไรซ้ำ Topic ยังมีห้าตัวพอดี' },
      { name: 'เพิ่ม Sink', title: 'สร้าง Sink Connector', text: 'Sink Task คือ Consumer Group ชื่อ connect-file-sink อ่านห้าตัวจาก Topic แล้วเขียนลงไฟล์ out.txt เป็นห้าบรรทัด Lag เป็น 0' },
    ],
    caption: 'ตัวเลขมาจากแบบฝึก 10: Connect รันเป็น Process แยกต่างหาก (connect-distributed.sh) FileStream เป็น Connector สาธิตที่มากับ Kafka ส่วน Connector ที่ต่อฐานข้อมูลหรือ S3 ไม่ได้รัน',
  },
  en: {
    title: 'Press next one step at a time. See how a connector moves lines from a file into a topic, where it notes how far it has read, and that it does not read again when it is created anew',
    legend: [{ kind: 'new', text: 'what happens in this step' }, { kind: 'use', text: 'what exists already' }, { kind: 'skip', text: 'what is not there yet' }],
    file: 'file in.txt', worker: 'Connect worker', source: 'source task', sink: 'sink task', topic: 'topic lines', offsets: 'topic connect-offsets', position: 'position', out: 'file out.txt',
    steps: [
      { name: 'file', title: 'The file in.txt has three lines', text: 'Each line is 8 bytes, 24 in all. No connector is running yet and the topic lines is empty.' },
      { name: 'create source', title: 'Create a source connector through the REST API', text: 'The source task reads all three lines, sends them to the topic lines as three records, and notes the position 24 in connect-offsets.' },
      { name: 'append', title: 'Two more lines are appended to the file', text: 'The source task reads on from position 24 and sees only the new lines, so it sends two more records. The topic has five, and the noted position is 40.' },
      { name: 'recreate', title: 'Delete the connector and create it again with the same name', text: 'The new connector asks connect-offsets how far this name had read, gets 40, and sends nothing again. The topic still has exactly five.' },
      { name: 'add sink', title: 'Create a sink connector', text: 'The sink task is a consumer group named connect-file-sink. It reads the five records from the topic and writes five lines to out.txt. The lag is 0.' },
    ],
    caption: 'The numbers come from exercise 10: Connect runs as a separate process (connect-distributed.sh), and FileStream is a demo connector that ships with Kafka. A connector for a database or S3 was not run.',
  },
};

export default function ConnectLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const st = useStepper(T.steps.length);
  const s = st.step;
  const lines = s >= 2 ? 5 : 3;
  const records = s >= 1 ? lines : 0;
  const pos = s >= 2 ? 40 : s >= 1 ? 24 : null;
  const sinkLines = s >= 4 ? 5 : 0;
  const mark = (i: number) => `o${i + 1}`;
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="viz-box">
        <svg viewBox="0 0 880 330" role="img" aria-label={T.title}>
          <Box x={14} y={14} w={250} h={130} title={T.file} state="use" />
          {Array.from({ length: lines }, (_, i) => (
            <Cell key={i} x={26 + i * 46} y={68} w={40} h={44} text={mark(i)} state={s === 2 && i >= 3 ? 'new' : 'use'} />
          ))}
          <Box x={300} y={14} w={290} h={130} title={T.worker} state="use" />
          <Box x={314} y={52} w={120} h={76} title={T.source} state={s === 1 || s === 2 || s === 3 ? 'new' : s > 3 ? 'use' : 'skip'} />
          <Box x={450} y={52} w={126} h={76} title={T.sink} state={s === 4 ? 'new' : 'skip'} />
          <Box x={626} y={14} w={240} h={130} title={T.out} state={sinkLines ? 'use' : 'skip'} />
          {Array.from({ length: sinkLines }, (_, i) => (
            <Cell key={i} x={638 + i * 44} y={68} w={38} h={44} text={mark(i)} state={s === 4 ? 'new' : 'use'} />
          ))}
          <path className="ib-arrow" d="M264,80 L314,90" style={{ opacity: s >= 1 ? 1 : 0.2 }} />
          <path className="ib-arrow" d="M576,90 L626,80" style={{ opacity: s >= 4 ? 1 : 0.2 }} />
          <text x={14} y={178} className="ib-n">{T.topic}</text>
          {Array.from({ length: 5 }, (_, i) => (i < records ? (
            <Cell key={i} x={14 + i * 64} y={216} w={56} h={44} offset={i} text={mark(i)} state={(s === 1 && i < 3) || (s === 2 && i >= 3) ? 'new' : 'use'} />
          ) : (
            <rect key={i} className="ib-skip" x={14 + i * 64} y={216} width={56} height={44} rx={8} style={{ opacity: 0.4 }} />
          )))}
          <Box x={420} y={176} w={446} h={96} title={T.offsets} state={pos ? (s === 1 || s === 2 ? 'new' : 'use') : 'skip'} />
          <text x={436} y={238} className="ib-m" style={{ fontSize: 13, fill: 'var(--fg)' }}>{pos ? 'key: ["file-source", {"filename": ...}]' : '—'}</text>
          <text x={436} y={262} className="ib-m" style={{ fontSize: 15, fill: 'var(--fg)' }}>{pos ? `value: {"${T.position}": ${pos}}` : ''}</text>
          {s === 3 && <text x={14} y={304} className="ib-n" style={{ fill: 'var(--brand)' }}>✓ 5 = 5 (nothing is read twice)</text>}
        </svg>
      </div>
      <StepControls steps={T.steps} step={s} playing={st.playing} go={st.go} toggle={st.toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
