import { StepControls, useStepper, type Lang, type StepInfo } from '../spark/stepper';
import { Legend } from '../iceberg/ib';
import data from './smallimages.json';

// Shows:      two ways to build the same Python program, drawn as bars as long as the image. First everything on the big image. Then a build stage on the big
//             image, a COPY --from that carries over only the installed package, and a final stage on the slim image. The build stage is drawn dashed and left behind.
// Because:    "multi-stage keeps the compilers and the big base out of what you ship" is about what is thrown away. Sizes next to each other show the 9 times
//             difference and the dashed bar shows that the big image is still used, just not shipped.
// Control:    the step player (single stage, build stage, copy, ship).
// Conclusion: build in a big image, copy only the result into a small one, and ship the small one.
//
// Sizes come from exercises/06_small_safe_images.py --write (smallimages.json): docker image inspect of the images that were really built.

const SINGLE = data.single;
const MULTI = data.multi;
const BASEFULL = data.bases['python:3.13'];
const SCALE = 560 / SINGLE; // pixels per MB

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; single: string; multi: string; build: string; ship: string; mb: string; copy: string; times: string;
  steps: StepInfo[]; caption: string;
}> = {
  th: {
    title: 'กด ถัดไป เพื่อดู Dockerfile แบบ Multi-stage สร้างโปรแกรมเดียวกันด้วย Image ใหญ่ แต่ส่งมอบด้วย Image เล็ก',
    legend: [{ kind: 'new', text: 'ส่วนที่เพิ่มในขั้นนี้' }, { kind: 'use', text: 'ส่วนที่ส่งมอบ' }, { kind: 'skip', text: 'ส่วนที่ใช้สร้างแล้วทิ้ง' }],
    single: 'แบบ Stage เดียว',
    multi: 'แบบ Multi-stage',
    build: 'Stage สร้าง (python:3.13)',
    ship: 'Stage ส่งมอบ (python:3.13-slim)',
    mb: 'MB',
    copy: 'COPY --from',
    times: 'เท่า',
    caption: 'ขนาดมาจากแบบฝึก 06 (docker image inspect ของ Image ที่ Build จริงทั้งสองแบบ) แท่งยาวตามสัดส่วนขนาด Image ที่ส่งมอบของแบบ Multi-stage ขนาดเท่ากับ python:3.13-slim เปล่า ๆ เพราะแพ็กเกจที่ติดตั้งเล็กมาก (six)',
    steps: [
      { name: 'Stage เดียว', title: 'ติดตั้งและรันทุกอย่างบน Image ใหญ่', text: `Dockerfile แบบ FROM python:3.13 ได้ Image ขนาด ${SINGLE} MB ซึ่งมีคอมไพเลอร์ C และเครื่องมือสร้างอีกมากที่โปรแกรมของเราไม่ได้ใช้ตอนรัน (แบบฝึกเห็นว่ามี gcc ใน Image นี้)` },
      { name: 'Stage สร้าง', title: 'Dockerfile แบบ Multi-stage เริ่มด้วย Stage สร้าง', text: 'บรรทัด FROM python:3.13 AS build ตั้งชื่อ Stage แรก ข้างในรัน pip install ลงโฟลเดอร์ /deps ตรงนี้ใช้ Image ใหญ่ได้เต็มที่ เพราะ Stage นี้จะไม่ถูกส่งมอบ' },
      { name: 'COPY --from', title: 'หยิบเฉพาะผลลัพธ์ข้าม Stage', text: 'Stage ที่สองเริ่มจาก python:3.13-slim แล้ว COPY --from=build /deps /deps หยิบแค่โฟลเดอร์ที่ติดตั้งแล้วมา คอมไพเลอร์และเครื่องมือสร้างของ Stage แรกไม่ได้ตามมา' },
      { name: 'ส่งมอบ', title: 'Image ที่ส่งมอบคือ Stage สุดท้าย', text: `Image สุดท้ายมี ${MULTI} MB เล็กกว่าแบบ Stage เดียวหลายเท่า Layer ของ Image ใหญ่ไม่มีตัวไหนอยู่ในนั้น (แบบฝึกตรวจแล้ว) และ gcc ก็ไม่ติดมา Stage สร้างยังมีอยู่ในเครื่องเรา แต่ไม่ถูก Push ไปที่ไหน` },
    ],
  },
  en: {
    title: 'Press Next to see a multi-stage Dockerfile build the same program on a big image and ship it on a small one',
    legend: [{ kind: 'new', text: 'added in this step' }, { kind: 'use', text: 'what ships' }, { kind: 'skip', text: 'used to build, then left behind' }],
    single: 'Single stage',
    multi: 'Multi-stage',
    build: 'Build stage (python:3.13)',
    ship: 'Final stage (python:3.13-slim)',
    mb: 'MB',
    copy: 'COPY --from',
    times: 'x',
    caption: 'Sizes come from exercise 06 (docker image inspect of both images that were really built). A bar is as long as the size of the image. The shipped image of the multi-stage build is as big as plain python:3.13-slim, because the installed package (six) is tiny.',
    steps: [
      { name: 'Single stage', title: 'Install and run everything on the big image', text: `A Dockerfile with FROM python:3.13 gives an image of ${SINGLE} MB, with a C compiler and many build tools that our program never uses at run time (the exercise saw gcc in this image).` },
      { name: 'Build stage', title: 'A multi-stage Dockerfile starts with a build stage', text: 'The line FROM python:3.13 AS build names the first stage. Inside it pip install writes into the folder /deps. The big image is fine here, because this stage is not shipped.' },
      { name: 'COPY --from', title: 'Pick only the result across stages', text: 'The second stage starts from python:3.13-slim and runs COPY --from=build /deps /deps, taking only the installed folder. The compiler and build tools of the first stage do not come along.' },
      { name: 'Ship', title: 'The image that ships is the last stage', text: `The final image is ${MULTI} MB, many times smaller than the single-stage one. None of the layers of the big image is in it (the exercise checked) and neither is gcc. The build stage still exists on our computer, but it is not pushed anywhere.` },
    ],
  },
};

export default function MultiStageLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const { step, go, playing, toggle } = useStepper(4, 3600);
  const wSingle = SINGLE * SCALE;
  const wBuild = BASEFULL * SCALE;
  const wFinal = Math.max(MULTI * SCALE, 40);
  const ratio = (SINGLE / MULTI).toFixed(1);
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="viz-box">
        <svg viewBox="0 0 880 330" role="img" aria-label={T.title}>
          <text x={14} y={28} className="ib-t">{T.single}</text>
          <rect className={step === 0 ? 'ib-new' : 'ib-use'} x={14} y={40} width={wSingle} height={46} rx={9} />
          <text x={26} y={69} className="ib-n">python:3.13</text>
          <text x={wSingle + 26} y={69} className="ib-big" style={{ fontSize: 26 }}>{`${SINGLE} ${T.mb}`}</text>

          <text x={14} y={136} className="ib-t" style={{ opacity: step >= 1 ? 1 : 0.35 }}>{T.multi}</text>
          <g style={{ opacity: step >= 1 ? 1 : 0.25 }}>
            <rect className={step === 1 ? 'ib-new' : 'ib-skip'} x={14} y={148} width={wBuild} height={46} rx={9} />
            <text x={26} y={177} className="ib-n">{T.build}</text>
            <text x={wBuild + 26} y={177} className="ib-s">{`${BASEFULL} ${T.mb}`}</text>
          </g>
          {step >= 2 && (
            <g>
              <path className="ib-arrow" d="M120,194 L120,226" />
              <text x={132} y={216} className="ib-n" style={{ fill: 'var(--accent)' }}>{T.copy}</text>
            </g>
          )}
          <g style={{ opacity: step >= 2 ? 1 : 0.25 }}>
            <rect className={step === 2 ? 'ib-new' : 'ib-use'} x={14} y={230} width={wFinal} height={46} rx={9} />
            <text x={wFinal + 26} y={259} className="ib-n">{T.ship}</text>
            {step >= 3 && <text x={wFinal + 26} y={290} className="ib-big ib-ok" style={{ fontSize: 26 }}>{`${MULTI} ${T.mb}`}</text>}
          </g>
          {step >= 3 && (
            <g>
              <rect className="ib-banner" x={560} y={226} width={300} height={56} rx={10} />
              <text x={710} y={250} textAnchor="middle" className="ib-s">{SINGLE} ÷ {MULTI}</text>
              <text x={710} y={274} textAnchor="middle" className="ib-n" style={{ fontSize: 20 }}>{`${ratio} ${T.times}`}</text>
            </g>
          )}
        </svg>
      </div>
      <StepControls steps={T.steps} step={step} playing={playing} go={go} toggle={toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
