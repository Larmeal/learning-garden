import type { Lang } from '../spark/timeline';
import { StepControls, useStepper } from '../spark/stepper';
import { Legend, Node, Num } from '../iceberg/ib';

// Shows:      the same question asked twice, once of a database with a server (two processes with a socket between them) and once of DuckDB (one process, a function call).
// Because:    "runs inside our process" is about where the boxes sit and how many times a border is crossed, which a sentence says but a picture lets us count.
// Control:    the four steps of a question (ask, read, build the answer, hand it back). Every step lights the parts of both lanes that work in that step.
// Conclusion: with DuckDB the request and the answer never cross the border of a process, so there is no connection to open and no rows to send over a socket.
//
// What was measured: exercise 01 found no child process and no listening port when DuckDB ran. The server lane describes how a client-server database works in general
// (PostgreSQL was not installed and nothing was measured on it).

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; steps: { name: string; title: string; text: string }[];
  laneA: string; laneB: string; app: string; appSub: string; server: string; serverSub: string; file: string; fileSub: string; mine: string; mineSub: string; engine: string; engineSub: string;
  data: string; dataSub: string; cross: string; proc1: string; proc2: string; procOne: string; caption: string;
}> = {
  th: {
    title: 'กด ถัดไป ทีละขั้นของคำถามเดียวกัน แล้วนับว่าคำสั่งกับผลลัพธ์ข้ามขอบเขตของ Process ไปกี่ครั้ง',
    legend: [{ kind: 'new', text: 'ส่วนที่ทำงานในขั้นนี้' }, { kind: 'use', text: 'ส่วนที่รออยู่' }, { kind: 'skip', text: 'ยังไม่ถูกใช้' }],
    steps: [
      { name: 'ถาม', title: '1. โค้ดของเราส่งคำถาม', text: 'ฝั่ง Server คำสั่ง SQL ต้องถูกส่งผ่าน Socket ไปหาอีก Process หนึ่ง ส่วน DuckDB เป็นแค่การเรียกฟังก์ชันใน Process เดิม' },
      { name: 'อ่าน', title: '2. ฐานข้อมูลอ่านข้อมูล', text: 'Server อ่านไฟล์ข้อมูลในที่ของมันเอง ส่วน DuckDB อ่านไฟล์หรือ DataFrame ที่อยู่ใน Memory ของ Process เราได้เลย' },
      { name: 'ประกอบ', title: '3. ประกอบคำตอบ', text: 'Server ต้องแปลงผลเป็นแถวที่ส่งผ่านเครือข่ายได้ ส่วน DuckDB ผลอยู่ใน Memory ของเราอยู่แล้ว' },
      { name: 'ส่งกลับ', title: '4. คำตอบถึงโค้ดของเรา', text: 'ฝั่ง Server ผลต้องข้ามขอบเขตกลับมาอีกครั้งแล้วถูกอ่านเป็นแถวใหม่ รวมข้ามสองครั้ง ฝั่ง DuckDB ข้ามศูนย์ครั้ง' },
    ],
    laneA: 'ฐานข้อมูลแบบมี Server (เช่น PostgreSQL)', laneB: 'DuckDB',
    app: 'โค้ดของเรา', appSub: 'Process 1', server: 'Server ฐานข้อมูล', serverSub: 'Process 2', file: 'ไฟล์ข้อมูล', fileSub: 'ในที่ของ Server',
    mine: 'โค้ดของเรา', mineSub: 'Python', engine: 'DuckDB', engineSub: 'ไลบรารีใน Process เดียวกัน', data: 'ไฟล์ หรือ DataFrame', dataSub: 'อ่านได้ตรง ๆ',
    cross: 'ข้ามขอบเขต Process', proc1: 'Process 1', proc2: 'Process 2', procOne: 'Process เดียว',
    caption: 'ที่วัดจริงในแบบฝึก 01 คือไม่มี Child Process และไม่มี Port ที่เปิดรอเมื่อ DuckDB ทำงาน ส่วนฝั่ง Server เล่าตามที่ฐานข้อมูลแบบมี Server ทำงานโดยทั่วไป ไม่ได้ติดตั้ง PostgreSQL มาวัด',
  },
  en: {
    title: 'Press Next through the steps of one question and count how often the command and the result cross the border of a process',
    legend: [{ kind: 'new', text: 'works in this step' }, { kind: 'use', text: 'waiting' }, { kind: 'skip', text: 'not used yet' }],
    steps: [
      { name: 'Ask', title: '1. Our code sends the question', text: 'With a server, the SQL has to travel over a socket to another process. With DuckDB it is only a function call in the same process.' },
      { name: 'Read', title: '2. The database reads the data', text: 'The server reads the data file in its own place. DuckDB can read a file or a DataFrame that is already in the memory of our process.' },
      { name: 'Build', title: '3. The answer is built', text: 'The server has to turn the result into rows that can cross a network. For DuckDB the result is already in our own memory.' },
      { name: 'Return', title: '4. The answer reaches our code', text: 'With a server the result crosses the border again and is read as new rows, two crossings in all. With DuckDB there are zero.' },
    ],
    laneA: 'A database with a server (such as PostgreSQL)', laneB: 'DuckDB',
    app: 'Our code', appSub: 'Process 1', server: 'Database server', serverSub: 'Process 2', file: 'Data file', fileSub: 'in the server\'s place',
    mine: 'Our code', mineSub: 'Python', engine: 'DuckDB', engineSub: 'a library in the same process', data: 'File or DataFrame', dataSub: 'read directly',
    cross: 'process border crossings', proc1: 'Process 1', proc2: 'Process 2', procOne: 'One process',
    caption: 'What was measured in exercise 01 is that no child process and no listening port appear when DuckDB runs. The server lane describes how a client-server database works in general. PostgreSQL was not installed and nothing was measured on it.',
  },
};

export default function InProcessLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const s = useStepper(T.steps.length);
  const step = s.step;
  const crossA = step === 0 ? 1 : step === 3 ? 2 : step >= 1 ? 1 : 0;
  const st = (on: boolean, seen: boolean) => (on ? 'new' : seen ? 'use' : 'skip') as 'new' | 'use' | 'skip';
  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="viz-box">
        <svg viewBox="0 0 880 350" role="img" aria-label={T.title}>
          <text x={14} y={26} className="ib-t">{T.laneA}</text>
          <text x={866} y={26} className="ib-n" textAnchor="end">{`${T.cross}: ${crossA}`}</text>
          <rect className="ib-zone" x={14} y={40} width={250} height={130} rx={12} />
          <text x={26} y={62} className="ib-layer">{T.proc1}</text>
          <rect className="ib-zone" x={360} y={40} width={250} height={130} rx={12} />
          <text x={372} y={62} className="ib-layer">{T.proc2}</text>
          <Node x={30} y={80} w={218} h={70} title={T.app} sub={T.appSub} state={st(step === 0 || step === 3, true)} mono={false} />
          <Node x={376} y={80} w={218} h={70} title={T.server} sub={T.serverSub} state={st(step === 1 || step === 2, step >= 0)} mono={false} />
          <Node x={640} y={80} w={216} h={70} title={T.file} sub={T.fileSub} state={st(step === 1, step >= 1)} mono={false} />
          <path className={step === 0 ? 'ib-arrow' : 'ib-line'} d="M264,102 L360,102" />
          <path className={step === 3 ? 'ib-arrow' : 'ib-line'} d="M360,130 L264,130" />
          <path className={step === 1 ? 'ib-arrow' : 'ib-line'} d="M610,115 L640,115" />
          {(step === 0 || step === 3) && <Num x={312} y={step === 0 ? 102 : 130} n={step === 0 ? 1 : 2} />}
          <text x={14} y={196} className="ib-t">{T.laneB}</text>
          <rect className="ib-zone" x={14} y={210} width={842} height={130} rx={12} />
          <text x={26} y={232} className="ib-layer">{T.procOne}</text>
          <Node x={30} y={250} w={218} h={70} title={T.mine} sub={T.mineSub} state={st(step === 0 || step === 3, true)} mono={false} />
          <Node x={376} y={250} w={218} h={70} title={T.engine} sub={T.engineSub} state={st(step === 1 || step === 2, step >= 0)} mono={false} />
          <Node x={640} y={250} w={216} h={70} title={T.data} sub={T.dataSub} state={st(step === 1, step >= 1)} mono={false} />
          <path className={step === 0 || step === 3 ? 'ib-arrow' : 'ib-line'} d="M248,285 L376,285" />
          <path className={step === 1 ? 'ib-arrow' : 'ib-line'} d="M594,285 L640,285" />
          <text x={866} y={196} className="ib-n" textAnchor="end">{`${T.cross}: 0`}</text>
        </svg>
      </div>
      <StepControls steps={T.steps} step={s.step} playing={s.playing} go={s.go} toggle={s.toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
