import { StepControls, useStepper, type Lang, type StepInfo } from '../spark/stepper';
import { Legend } from '../iceberg/ib';
import data from './layers.json';

// Shows:      two Dockerfiles that create a 10 MB file and then delete it. In the left one the delete is its own RUN line, in the right one it is in the same
//             RUN line as the create. Each layer is a bar as tall as the bytes it holds.
// Because:    "a layer only adds" is about heights. The left stack keeps a 10 MB bar under a layer that says rm, and the right stack has no such bar.
// Control:    the step player (base, create, delete).
// Conclusion: deleting in a later layer hides a file and does not give the bytes back. To keep an image small, create and delete in the same RUN line.
//
// Sizes come from exercises/02_images_layers.py --write (layers.json, "additive"): the image size reported by docker image inspect.

const A = data.additive;
const FILE = A.keptMb - A.baseMb; // what the 10 MB file layer adds, as the image sees it
const PX = 11; // pixels per MB

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; two: string; one: string; base: string; create: string; remove: string; both: string;
  total: string; mb: string; steps: StepInfo[]; caption: string;
}> = {
  th: {
    title: 'กด ถัดไป เพื่อสร้างไฟล์ 10 MB แล้วลบมัน ดูว่า Image ที่ลบในบรรทัด RUN แยกกับที่ลบในบรรทัดเดียวกัน ต่างกันกี่ MB',
    legend: [{ kind: 'new', text: 'Layer ที่เพิ่มในขั้นนี้' }, { kind: 'use', text: 'Layer ที่มีอยู่แล้ว' }, { kind: 'skip', text: 'Layer ที่ไม่มีไบต์' }],
    two: 'ลบในบรรทัด RUN แยก',
    one: 'สร้างและลบในบรรทัด RUN เดียว',
    base: 'FROM alpine:3.22',
    create: 'RUN สร้างไฟล์ 10 MB',
    remove: 'RUN rm ไฟล์นั้น',
    both: 'RUN สร้างแล้ว rm',
    total: 'ขนาด Image',
    mb: 'MB',
    caption: 'ขนาดมาจากแบบฝึก 02 (docker image inspect ของ Image ที่ Build จริงสองตัว) ความสูงของแท่งเป็นสัดส่วนกับขนาด',
    steps: [
      { name: 'ฐาน', title: 'เริ่มจาก Alpine', text: 'ทั้งสอง Dockerfile เริ่มจาก Layer เดียวกัน ขนาดของ Image ตอนนี้เท่ากับ Alpine' },
      { name: 'สร้างไฟล์', title: 'สร้างไฟล์ 10 MB', text: 'ฝั่งซ้ายสร้างไฟล์ใน RUN บรรทัดแรก Layer นั้นเก็บไฟล์ไว้ทั้ง 10 MB ส่วนฝั่งขวาสร้างและลบใน RUN บรรทัดเดียว ซึ่งยังไม่จบ จึงยังไม่มี Layer ให้ดู' },
      { name: 'ลบไฟล์', title: 'ลบไฟล์นั้นทิ้ง', text: 'ฝั่งซ้ายลบด้วย RUN บรรทัดใหม่ ได้ Layer ที่แค่เขียนว่าไฟล์ถูกลบ ซึ่งซ่อนไฟล์จาก Container แต่ Layer ล่างยังเก็บ 10 MB อยู่ ฝั่งขวาลบก่อนที่ Layer จะถูกปิด ไฟล์จึงไม่เคยถูกเก็บเลย' },
    ],
  },
  en: {
    title: 'Press Next to create a 10 MB file and delete it, and see how many MB differ between deleting on a separate RUN line and on the same one',
    legend: [{ kind: 'new', text: 'the layer added in this step' }, { kind: 'use', text: 'a layer already there' }, { kind: 'skip', text: 'a layer with no bytes' }],
    two: 'delete on a separate RUN line',
    one: 'create and delete on one RUN line',
    base: 'FROM alpine:3.22',
    create: 'RUN create a 10 MB file',
    remove: 'RUN rm that file',
    both: 'RUN create, then rm',
    total: 'image size',
    mb: 'MB',
    caption: 'Sizes come from exercise 02 (docker image inspect of the two images that were really built). The height of a bar is proportional to its size.',
    steps: [
      { name: 'base', title: 'Start from Alpine', text: 'Both Dockerfiles start from the same layer, so the image is as big as Alpine.' },
      { name: 'create', title: 'Create a 10 MB file', text: 'The left Dockerfile creates the file in its first RUN line, and that layer keeps all 10 MB. The right one creates and deletes in a single RUN line that is not finished yet, so there is no layer to show.' },
      { name: 'delete', title: 'Delete that file', text: 'The left one deletes with a new RUN line. That layer only records that the file is deleted. The container no longer sees it, but the layer below still holds 10 MB. The right one deletes before the layer is closed, so the file was never stored.' },
    ],
  },
};

const BW = 330;

export default function AdditiveLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const { step, go, playing, toggle } = useStepper(3, 3400);
  const Y0 = 326; // bottom of the stacks
  const bar = (x: number, bottom: number, mb: number, cls: string, title: string, sub: string) => {
    const h = Math.max(mb * PX, 34);
    return (
      <g>
        <rect className={cls} x={x} y={bottom - h} width={BW} height={h} rx={9} />
        <text x={x + 14} y={bottom - h / 2 - 2} className="ib-n">{title}</text>
        <text x={x + 14} y={bottom - h / 2 + 18} className="ib-s">{sub}</text>
      </g>
    );
  };
  const leftTotal = step === 0 ? A.baseMb : step === 1 ? A.keptMb : A.keptMb;
  const rightTotal = A.mergedMb;
  const L = 24, R = 480;
  const baseH = Math.max(A.baseMb * PX, 34);
  const fileH = Math.max(FILE * PX, 34);
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="viz-box">
        <svg viewBox="0 0 880 410" role="img" aria-label={T.title}>
          <text x={L} y={26} className="ib-t">{T.two}</text>
          <text x={R} y={26} className="ib-t">{T.one}</text>
          {/* left stack: base, create, rm */}
          {bar(L, Y0, A.baseMb, 'ib-use', T.base, `${A.baseMb.toFixed(1)} ${T.mb}`)}
          {step >= 1 && bar(L, Y0 - baseH, FILE, step === 1 ? 'ib-new' : 'ib-use', T.create, `+${FILE.toFixed(1)} ${T.mb}`)}
          {step >= 2 && (
            <g>
              <rect className="ib-new" x={L} y={Y0 - baseH - fileH - 34} width={BW} height={34} rx={9} style={{ strokeDasharray: '7 5' }} />
              <text x={L + 14} y={Y0 - baseH - fileH - 11} className="ib-n">{`${T.remove} (+0 ${T.mb})`}</text>
            </g>
          )}
          {/* right stack: base, then a single layer with no bytes */}
          {bar(R, Y0, A.baseMb, 'ib-use', T.base, `${A.baseMb.toFixed(1)} ${T.mb}`)}
          {step >= 2 && (
            <g>
              <rect className="ib-new" x={R} y={Y0 - baseH - 34} width={BW} height={34} rx={9} style={{ strokeDasharray: '7 5' }} />
              <text x={R + 14} y={Y0 - baseH - 11} className="ib-n">{`${T.both} (+0 ${T.mb})`}</text>
            </g>
          )}
          {/* totals */}
          <text x={L} y={350} className="ib-s">{T.total}</text>
          <text x={L} y={390} className="ib-big" style={{ fontSize: 28 }}>{`${leftTotal.toFixed(1)} ${T.mb}`}</text>
          <text x={R} y={350} className="ib-s">{T.total}</text>
          <text x={R} y={390} className="ib-big ib-ok" style={{ fontSize: 28 }}>{`${(step >= 2 ? rightTotal : A.baseMb).toFixed(1)} ${T.mb}`}</text>
        </svg>
      </div>
      <StepControls steps={T.steps} step={step} playing={playing} go={go} toggle={toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
