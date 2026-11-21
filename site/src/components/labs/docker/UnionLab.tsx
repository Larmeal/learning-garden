import { StepControls, useStepper, type Lang, type StepInfo } from '../spark/stepper';
import { Legend } from '../iceberg/ib';
import data from './layers.json';

// Shows:      one container started from an image of two layers, and three changes made in a row: add a file, change a file, delete a file.
//             On the left is what the container sees. On the right are the layers that hold it. Every change lands in the top, writable layer
//             and nothing below it is touched. A deleted file is only hidden: it stays in the image layer.
// Because:    "a union file system" is the relationship between these two views. A table of docker diff output cannot show that the same file is read
//             from a different layer after a step, or that a file which looks gone still takes its bytes.
// Control:    the step player (previous, next, autoplay, the four named steps).
// Conclusion: a container only ever writes into its own top layer. Changing a file copies it up first, and deleting only hides it.
//
// The diff lines and sizes come from exercises/02_images_layers.py --write (layers.json, section 8): the image is alpine:3.22 plus one layer with a 1 MB file.

const S = data.stack;
const MB = (data.apps['dlab-app1'].ownMb).toFixed(1);
const PASSWD = S[2].sizeRw; // bytes copied up when /etc/passwd was touched

type Where = 'L1' | 'L2' | 'W';
type FileView = { name: string; sub: string; where: Where | null; tag?: 'A' | 'C' | 'D' };

// what the container sees after each step (0 = the image alone)
function view(step: number): FileView[] {
  return [
    { name: '/bin/sh', sub: 'Alpine', where: 'L1' },
    { name: '/etc/passwd', sub: step >= 2 ? `${PASSWD} B` : 'Alpine', where: step >= 2 ? 'W' : 'L1', tag: step >= 2 ? 'C' : undefined },
    { name: '/data1', sub: `${MB} MB`, where: step >= 3 ? null : 'L2', tag: step >= 3 ? 'D' : undefined },
    { name: '/mychange', sub: '0 B', where: step >= 1 ? 'W' : null, tag: step >= 1 ? 'A' : undefined },
  ];
}

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; sees: string; layers: string; w: string; l2: string; l1: string; ro: string; wr: string;
  from: Record<Where, string>; hidden: string; absent: string; written: (n: number) => string; steps: StepInfo[]; caption: string;
}> = {
  th: {
    title: 'กด ถัดไป เพื่อให้ Container เพิ่ม แก้ และลบไฟล์ทีละอย่าง แล้วดูว่าไฟล์แต่ละตัวถูกอ่านมาจากชั้นไหน',
    legend: [{ kind: 'new', text: 'เขียนลงชั้นบนสุดตอนนี้' }, { kind: 'use', text: 'อยู่ในชั้นแล้ว' }, { kind: 'skip', text: 'ถูกซ่อนไว้' }],
    sees: 'สิ่งที่ Container เห็น',
    layers: 'ชั้นที่เก็บไฟล์เหล่านั้น',
    w: 'ชั้นเขียนของ Container',
    l2: 'ชั้นที่สองของ Image (dlab-app1)',
    l1: 'ชั้นแรกของ Image (alpine:3.22)',
    ro: 'อ่านได้อย่างเดียว',
    wr: 'เขียนได้',
    from: { L1: 'อ่านจากชั้นแรก', L2: 'อ่านจากชั้นที่สอง', W: 'อ่านจากชั้นเขียน' },
    hidden: 'ถูกซ่อน',
    absent: 'ยังไม่มี',
    written: (n) => `ชั้นเขียนของ Container ใหญ่ ${n} ไบต์`,
    caption: 'Output ของ docker diff และขนาดชั้นเขียนมาจากแบบฝึก 02 (หัวข้อ 8) ซึ่งรันบน Image ที่เป็น alpine:3.22 บวกอีกหนึ่งชั้นที่มีไฟล์ /data1 ขนาด 1 MB',
    steps: [
      { name: 'Image', title: 'Image มีสองชั้น และชั้นเขียนยังว่าง', text: 'ชั้นแรกคือ Alpine และชั้นที่สองเพิ่มไฟล์ /data1 ขนาด 1 MB Container เพิ่งเริ่มจึงเห็นไฟล์จากสองชั้นนี้รวมกัน ส่วนชั้นเขียนของมันยังไม่มีอะไร (docker diff ว่างเปล่า)' },
      { name: 'เพิ่มไฟล์', title: 'touch /mychange: เพิ่มไฟล์ใหม่ (A)', text: 'ไฟล์ที่ไม่เคยมีมาก่อนถูกเขียนลงชั้นเขียนชั้นเดียว Image ไม่ถูกแตะเลย และ docker diff ขึ้นบรรทัดเดียวคือ A /mychange' },
      { name: 'แก้ไฟล์', title: 'touch /etc/passwd: แก้ไฟล์ของชั้นล่าง (C)', text: 'ไฟล์นี้อยู่ในชั้นแรกซึ่งแก้ไม่ได้ Docker จึงคัดลอกทั้งไฟล์ขึ้นมาไว้ในชั้นเขียนก่อนแล้วค่อยแก้ที่สำเนา ตั้งแต่นี้ Container อ่าน passwd จากชั้นเขียน (Copy-on-write) และ docker diff ขึ้น C ทั้งโฟลเดอร์ /etc และไฟล์' },
      { name: 'ลบไฟล์', title: 'rm /data1: ลบไฟล์ของชั้นล่าง (D)', text: 'ชั้นที่สองลบไม่ได้ Docker จึงเขียนเครื่องหมายว่าลบไว้ในชั้นเขียน ซึ่งทำให้ Container มองไม่เห็นไฟล์ แต่ไฟล์ขนาด 1 MB ยังอยู่ใน Image และ Container ตัวใหม่จาก Image เดียวกันยังเห็นมัน' },
    ],
  },
  en: {
    title: 'Press Next to let the container add, change and delete a file in turn, and see which layer each file is read from',
    legend: [{ kind: 'new', text: 'written into the top layer now' }, { kind: 'use', text: 'already in a layer' }, { kind: 'skip', text: 'hidden' }],
    sees: 'What the container sees',
    layers: 'The layers that hold those files',
    w: 'Writable layer of the container',
    l2: 'Second layer of the image (dlab-app1)',
    l1: 'First layer of the image (alpine:3.22)',
    ro: 'read only',
    wr: 'writable',
    from: { L1: 'read from layer 1', L2: 'read from layer 2', W: 'read from the writable layer' },
    hidden: 'hidden',
    absent: 'not there yet',
    written: (n) => `The container's writable layer is ${n} bytes`,
    caption: 'The docker diff output and the size of the writable layer come from exercise 02 (section 8), run on an image that is alpine:3.22 plus one layer with a 1 MB file /data1.',
    steps: [
      { name: 'Image', title: 'The image has two layers and the writable layer is empty', text: 'The first layer is Alpine and the second adds the 1 MB file /data1. The container has just started, so it sees the files of both layers put together, and its own writable layer holds nothing (docker diff is empty).' },
      { name: 'Add a file', title: 'touch /mychange: a new file (A)', text: 'A file that never existed is written into the writable layer only. The image is not touched, and docker diff prints one line, A /mychange.' },
      { name: 'Change a file', title: 'touch /etc/passwd: change a file of a lower layer (C)', text: 'This file is in the first layer, which cannot be changed. Docker first copies the whole file up into the writable layer and changes the copy. From now on the container reads passwd from the writable layer (copy-on-write), and docker diff prints C for the folder /etc and for the file.' },
      { name: 'Delete a file', title: 'rm /data1: delete a file of a lower layer (D)', text: 'The second layer cannot be changed either, so Docker writes a mark in the writable layer that says the file is deleted. The container no longer sees it, but the 1 MB file is still in the image, and a new container from the same image still sees it.' },
    ],
  },
};

const LX = 14, LW = 400, RX = 452, RW = 414;

export default function UnionLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const { step, go, playing, toggle } = useStepper(4, 3400);
  const files = view(step);
  const written = S[step].sizeRw;
  const wFiles = files.filter((f) => f.where === 'W' || f.tag === 'D');
  const justNow = (f: FileView) => (step === 1 && f.tag === 'A') || (step === 2 && f.tag === 'C') || (step === 3 && f.tag === 'D');
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="viz-box">
        <svg viewBox="0 0 880 430" role="img" aria-label={T.title}>
          <text x={LX} y={26} className="ib-t">{T.sees}</text>
          <text x={RX} y={26} className="ib-t">{T.layers}</text>
          {/* what the container sees */}
          {files.map((f, i) => {
            const y = 44 + i * 74;
            const gone = f.tag === 'D';
            const absent = f.where === null && !gone;
            return (
              <g key={f.name} style={absent ? { opacity: 0.35 } : undefined}>
                <rect className={gone ? 'ib-skip' : justNow(f) ? 'ib-new' : absent ? 'ib-skip' : 'ib-use'} x={LX} y={y} width={LW} height={62} rx={10} />
                <text x={LX + 16} y={y + 28} className="ib-n" style={gone ? { textDecoration: 'line-through' } : undefined}>{f.name}</text>
                <text x={LX + 16} y={y + 50} className="ib-s">{gone ? T.hidden : absent ? T.absent : `${T.from[f.where as Where]} · ${f.sub}`}</text>
                {f.tag && (
                  <g>
                    <rect className="ib-badge" x={LX + LW - 44} y={y + 16} width={30} height={30} rx={15} />
                    <text x={LX + LW - 29} y={y + 37} className="ib-white" style={{ fontSize: 16 }}>{f.tag}</text>
                  </g>
                )}
              </g>
            );
          })}
          {/* the layers */}
          <rect className={step === 0 ? 'ib-skip' : 'ib-new'} x={RX} y={44} width={RW} height={158} rx={10} />
          <text x={RX + 16} y={70} className="ib-n">{T.w}</text>
          <text x={RX + RW - 16} y={70} textAnchor="end" className="ib-s">{T.wr}</text>
          {wFiles.length === 0 && <text x={RX + 16} y={118} className="ib-s">{lang === 'th' ? 'ยังว่างอยู่ (docker diff ไม่มีอะไร)' : 'still empty (docker diff prints nothing)'}</text>}
          {wFiles.map((f, i) => (
            <g key={f.name}>
              <rect className="ib-node" x={RX + 14} y={84 + i * 38} width={RW - 28} height={32} rx={8} />
              <text x={RX + 28} y={106 + i * 38} className="ib-m" style={{ fontSize: 15 }}>{f.tag === 'D' ? `${f.name}  (${T.hidden})` : `${f.name}  ${f.sub}`}</text>
              <text x={RX + RW - 30} y={106 + i * 38} textAnchor="end" className="ib-n">{f.tag}</text>
            </g>
          ))}
          <rect className="ib-use" x={RX} y={212} width={RW} height={86} rx={10} />
          <text x={RX + 16} y={240} className="ib-n">{T.l2}</text>
          <text x={RX + RW - 16} y={240} textAnchor="end" className="ib-s">{T.ro}</text>
          <rect className="ib-node" x={RX + 14} y={252} width={RW - 28} height={34} rx={8} style={step >= 3 ? { opacity: 0.45 } : undefined} />
          <text x={RX + 28} y={275} className="ib-m" style={{ fontSize: 15 }}>{`/data1  ${MB} MB`}</text>
          <rect className="ib-use" x={RX} y={308} width={RW} height={86} rx={10} />
          <text x={RX + 16} y={336} className="ib-n">{T.l1}</text>
          <text x={RX + RW - 16} y={336} textAnchor="end" className="ib-s">{T.ro}</text>
          <rect className="ib-node" x={RX + 14} y={348} width={RW - 28} height={34} rx={8} style={step >= 2 ? { opacity: 0.45 } : undefined} />
          <text x={RX + 28} y={371} className="ib-m" style={{ fontSize: 15 }}>/bin/sh   /etc/passwd   …</text>
          <rect className="ib-banner" x={LX} y={388} width={LW} height={36} rx={10} />
          <text x={LX + 14} y={411} className="ib-n">{T.written(written)}</text>
        </svg>
      </div>
      <StepControls steps={T.steps} step={step} playing={playing} go={go} toggle={toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
