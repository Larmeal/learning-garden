import { StepControls, useStepper, type Lang, type StepInfo } from '../spark/stepper';
import { Legend } from '../iceberg/ib';
import data from './dockerfile.json';

// Shows:      a Dockerfile of eight lines being built one line at a time. Each line goes to one of two places: a layer of files (stacked in the middle) or the label of
//             the image, its config (the card on the right). The last step runs the image and the container starts from both.
// Because:    "which instruction makes a layer and which only writes metadata" is about where each line lands. A list of instructions in a table does not show that
//             ENV, LABEL, EXPOSE and CMD never touch the stack and that WORKDIR, COPY and RUN do.
// Control:    the step player (one step per line, then docker run).
// Conclusion: files in the image come from FROM, WORKDIR, COPY and RUN. ENV, LABEL, EXPOSE and CMD are notes on the label, and docker run reads the label to start the program.
//
// The sizes come from exercises/04_dockerfile.py --write (dockerfile.json, from docker history). The layer count of the base is the real count of python:3.13-slim.

const S = data.steps; // LABEL, ENV, WORKDIR, COPY, RUN, EXPOSE, CMD
const SIZE = { WORKDIR: S[2].size, COPY: S[3].size, RUN: S[4].size };

const LINES = [
  'FROM python:3.13-slim',
  'LABEL org.example.course=docker',
  'ENV GREETING=hello',
  'WORKDIR /app',
  'COPY app.py .',
  'RUN python -c "...write 1000 bytes..."',
  'EXPOSE 8080',
  'CMD ["python", "app.py"]',
];
const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; file: string; layers: string; label: string; labelSub: string; base: string; folder: string; copy: string;
  write: string; cfg: string[]; run: string; out: string; steps: StepInfo[]; caption: string;
}> = {
  th: {
    title: 'กด ถัดไป ทีละบรรทัดของ Dockerfile แล้วดูว่าบรรทัดนั้นไปลงที่ชั้นของไฟล์ หรือไปเขียนเป็นป้ายบนตัว Image',
    legend: [{ kind: 'new', text: 'เพิ่มในขั้นนี้' }, { kind: 'use', text: 'เพิ่มไปแล้ว' }, { kind: 'skip', text: 'ยังไม่ถึงบรรทัดนี้' }],
    file: 'Dockerfile',
    layers: 'ชั้นของไฟล์ใน Image',
    label: 'ป้ายของ Image',
    labelSub: 'config ใน docker inspect',
    base: `Image ฐาน (${data.baseLayers} Layer)`,
    folder: 'สร้างโฟลเดอร์ /app',
    copy: 'ไฟล์ app.py',
    write: 'ไฟล์ built.txt',
    cfg: ['ป้ายชื่อ course', 'ตัวแปร GREETING', 'ที่ทำงาน /app', 'พอร์ต 8080 (บันทึกไว้เฉย ๆ)', 'คำสั่งเริ่ม python app.py'],
    run: 'docker run',
    out: 'greeting: hello | cwd: /app | uid: 0',
    caption: `ขนาดของแต่ละ Layer มาจาก docker history ในแบบฝึก 04 และจำนวน Layer ของ Image ฐานคือค่าจริง (${data.baseLayers}) บรรทัด WORKDIR ที่ docker history ขึ้น 0B ยังสร้าง Layer หนึ่งชั้น เพราะต้องสร้างโฟลเดอร์ ส่วน ENV, LABEL และ CMD ไม่เพิ่ม Layer เลย (แบบฝึกนับจาก Image อีกสองตัว)`,
    steps: [
      { name: 'FROM', title: 'FROM: เริ่มจากกองของ Image ฐาน', text: 'ทุก Dockerfile ต้องเริ่มด้วย FROM (หนังสือ Docker in Action หัวข้อ 8.1 หน้า 145) Layer ทั้งหมดของ Image ฐานกลายเป็นก้นกอง ตอนนี้ Image ใหม่ยังเหมือนฐานทุกอย่าง' },
      { name: 'LABEL', title: 'LABEL: เขียนป้ายหนึ่งแผ่น', text: 'LABEL ไม่เปลี่ยนไฟล์ใด ๆ มันแค่ใส่คู่ชื่อกับค่าลงในป้ายของ Image จึงไม่มี Layer ใหม่ และ docker history ขึ้นขนาด 0B' },
      { name: 'ENV', title: 'ENV: ตั้งตัวแปรสภาพแวดล้อม', text: 'ENV ก็เป็นการเขียนลงป้ายเหมือนกัน Container ที่เริ่มจาก Image นี้จะเห็นตัวแปร GREETING แต่ในกองของไฟล์ยังไม่มีอะไรเพิ่ม' },
      { name: 'WORKDIR', title: 'WORKDIR: ตั้งที่ทำงานและสร้างโฟลเดอร์', text: 'WORKDIR จดที่ทำงานลงป้าย และเพราะโฟลเดอร์ /app ยังไม่มี มันจึงสร้างโฟลเดอร์ขึ้นมาซึ่งเป็นการเปลี่ยนไฟล์ จึงได้ Layer ใหม่หนึ่งชั้น (รัน)' },
      { name: 'COPY', title: 'COPY: ก๊อปไฟล์จากเครื่องเราเข้า Image', text: 'COPY วางไฟล์ app.py ลงใน Layer ใหม่ ซึ่งมีขนาดเท่าไฟล์ ไฟล์ที่ถูก COPY จะเป็นของ root เสมอถ้าไม่สั่งเปลี่ยน (รัน)' },
      { name: 'RUN', title: 'RUN: รันคำสั่งตอนสร้าง แล้วเก็บสิ่งที่เปลี่ยน', text: 'RUN เปิดคำสั่งในชั้นชั่วคราว แล้วเก็บไฟล์ที่คำสั่งนั้นเขียนไว้เป็น Layer ใหม่ ที่นี่คือไฟล์ built.txt ขนาด 1000 ไบต์ ซึ่งทำให้ Layer ใหญ่กว่า COPY' },
      { name: 'EXPOSE', title: 'EXPOSE: จดว่าโปรแกรมฟังพอร์ตไหน', text: 'EXPOSE เป็นแค่บันทึกบนป้าย ไม่ได้เปิดพอร์ตใด ๆ แบบฝึกรัน Container แล้วดูว่าไม่มีพอร์ตถูก Publish (รัน)' },
      { name: 'CMD', title: 'CMD: จดคำสั่งที่จะรันตอนเริ่ม', text: 'CMD ก็เขียนลงป้ายเช่นกัน ยังไม่มีอะไรรัน คำสั่งนี้จะถูกใช้ตอนมีคนสั่ง docker run' },
      { name: 'docker run', title: 'docker run: Container อ่านป้ายแล้วเริ่มโปรแกรม', text: 'Container ใช้กองของไฟล์เป็นระบบไฟล์ แล้วอ่านป้ายเพื่อรู้ว่าต้องไปยืนที่ /app ตั้งตัวแปร GREETING และรัน python app.py ผลที่พิมพ์ออกมาเห็นครบทั้งสามอย่าง (รัน)' },
    ],
  },
  en: {
    title: 'Press Next one line of the Dockerfile at a time and see whether that line lands in a layer of files or is written as a label on the image',
    legend: [{ kind: 'new', text: 'added in this step' }, { kind: 'use', text: 'already added' }, { kind: 'skip', text: 'this line is not reached yet' }],
    file: 'Dockerfile',
    layers: 'The layers of files in the image',
    label: 'The label of the image',
    labelSub: 'config in docker inspect',
    base: `Base image (${data.baseLayers} layers)`,
    folder: 'creates the folder /app',
    copy: 'the file app.py',
    write: 'the file built.txt',
    cfg: ['label: course', 'variable: GREETING', 'working folder: /app', 'port 8080 (a note only)', 'start command: python app.py'],
    run: 'docker run',
    out: 'greeting: hello | cwd: /app | uid: 0',
    caption: `The size of each layer comes from docker history in exercise 04, and the layer count of the base image is the real one (${data.baseLayers}). The WORKDIR line, which docker history shows as 0B, still makes one layer because it creates a folder. ENV, LABEL and CMD add no layer at all (the exercise counted that on two more images).`,
    steps: [
      { name: 'FROM', title: 'FROM: start from the stack of the base image', text: 'Every Dockerfile must start with FROM (book Docker in Action section 8.1, page 145). All the layers of the base image become the bottom of the stack. The new image is still the same as its base.' },
      { name: 'LABEL', title: 'LABEL: write one tag on the label', text: 'LABEL changes no file. It only puts a name and a value on the label of the image, so there is no new layer and docker history shows 0B.' },
      { name: 'ENV', title: 'ENV: set an environment variable', text: 'ENV is a write to the label as well. A container started from this image will see the variable GREETING, and the stack of files has nothing new yet.' },
      { name: 'WORKDIR', title: 'WORKDIR: set the working folder and create it', text: 'WORKDIR notes the working folder on the label, and because the folder /app does not exist, it creates it. That changes the files, so one new layer appears (ran).' },
      { name: 'COPY', title: 'COPY: copy a file from our computer into the image', text: 'COPY puts the file app.py into a new layer, as big as the file. A copied file belongs to root unless we say otherwise (ran).' },
      { name: 'RUN', title: 'RUN: run a command at build time and keep what it changed', text: 'RUN runs the command in a temporary layer and keeps the files that the command wrote as a new layer. Here it is the file built.txt of 1000 bytes, so the layer is bigger than the COPY.' },
      { name: 'EXPOSE', title: 'EXPOSE: note which port the program listens on', text: 'EXPOSE is only a note on the label. It opens no port. The exercise started a container and saw that no port was published (ran).' },
      { name: 'CMD', title: 'CMD: note the command to run at start', text: 'CMD is written on the label too. Nothing runs yet. This command is used when someone runs docker run.' },
      { name: 'docker run', title: 'docker run: the container reads the label and starts the program', text: 'The container uses the stack of files as its file system, then reads the label to know it must stand in /app, set the variable GREETING and run python app.py. The printed result shows all three (ran).' },
    ],
  },
};

export default function DockerfileLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const { step, go, playing, toggle } = useStepper(9, 3600);
  const added = (i: number) => step >= i; // line i has been executed
  const cls = (i: number) => (step === i ? 'ib-new' : added(i) ? 'ib-use' : 'ib-skip');
  const layerRows: { i: number; title: string; sub: string }[] = [
    { i: 5, title: 'RUN', sub: `${T.write} · ${SIZE.RUN}` },
    { i: 4, title: 'COPY', sub: `${T.copy} · ${SIZE.COPY}` },
    { i: 3, title: 'WORKDIR', sub: `${T.folder} · ${SIZE.WORKDIR}` },
  ];
  const cfgRows = [1, 2, 3, 6, 7]; // LABEL, ENV, WORKDIR(note), EXPOSE, CMD  (indexes into LINES)
  const running = step === 8;
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="viz-box">
        <svg viewBox="0 0 880 450" role="img" aria-label={T.title}>
          {/* the Dockerfile */}
          <text x={14} y={24} className="ib-t">{T.file}</text>
          {LINES.map((l, i) => (
            <g key={l}>
              <rect className={cls(i)} x={14} y={36 + i * 44} width={300} height={36} rx={8} />
              <text x={26} y={60 + i * 44} className="ib-m" style={{ fontSize: 14, fill: 'var(--fg)' }}>{l.length > 34 ? l.slice(0, 33) + '…' : l}</text>
              <text x={320} y={60 + i * 44} className="ib-n" style={{ fontSize: 13, fill: 'var(--accent)' }}>{step === i ? '◀' : ''}</text>
            </g>
          ))}
          {/* layers */}
          <text x={338} y={24} className="ib-t">{T.layers}</text>
          {layerRows.map((r, k) => (
            <g key={r.title} style={added(r.i) ? undefined : { opacity: 0.45 }}>
              <rect className={cls(r.i)} x={338} y={44 + k * 62} width={260} height={52} rx={9} />
              <text x={352} y={67 + k * 62} className="ib-n">{r.title}</text>
              <text x={352} y={87 + k * 62} className="ib-s">{r.sub}</text>
            </g>
          ))}
          <rect className={cls(0)} x={338} y={44 + 3 * 62} width={260} height={74} rx={9} />
          <text x={352} y={72 + 3 * 62} className="ib-n">FROM</text>
          <text x={352} y={96 + 3 * 62} className="ib-s">{T.base}</text>
          {/* the label */}
          <text x={622} y={24} className="ib-t">{T.label}</text>
          <text x={622} y={44} className="ib-s">{T.labelSub}</text>
          {cfgRows.map((i, k) => (
            <g key={i} style={added(i) ? undefined : { opacity: 0.45 }}>
              <rect className={cls(i)} x={622} y={54 + k * 50} width={246} height={42} rx={8} />
              <text x={634} y={80 + k * 50} className="ib-s" style={{ fill: 'var(--fg)', fontSize: 14 }}>{T.cfg[k]}</text>
            </g>
          ))}
          {/* docker run */}
          <rect className={running ? 'ib-new' : 'ib-skip'} x={338} y={366} width={530} height={62} rx={10} style={running ? undefined : { opacity: 0.45 }} />
          <text x={352} y={392} className="ib-n">{T.run}</text>
          <text x={352} y={414} className="ib-m" style={{ fontSize: 15, fill: 'var(--fg)' }}>{running ? T.out : ''}</text>
        </svg>
      </div>
      <StepControls steps={T.steps} step={step} playing={playing} go={go} toggle={toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
