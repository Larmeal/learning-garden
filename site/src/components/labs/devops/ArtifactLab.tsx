import { StepControls, useStepper, type StepInfo } from '../spark/stepper';
import { Banner } from '../iceberg/ib';
import { Arrow, Tile, type Lang } from './dv';

// Shows:      a registry as a shelf. An image is a box with a fingerprint (its digest); a tag is a sticker that can be peeled off and stuck on another box. Steps: build, push, stick the tags staging and prod,
//             run staging and prod from the digest, push a second build, move the sticker prod.
// Because:    "a tag can move, a digest cannot" is about what points at what. Seeing the sticker leave one box and land on another, while the old box and its fingerprint stay on the shelf, is the whole idea.
// Control:    the step buttons.
// Conclusion: promote a release by moving a name (a tag) to the same digest, never by building again; and deploy by digest when you need to be sure which bytes run.
//
// The digests (sha256:b7ad1b160069..., sha256:6d1d3d99cd9e...), the tags listed by the registry and the logs of the two containers are from one run of exercises/04_artifact_registry.py; another run gives other digests.

const D1 = 'b7ad1b160069', D2 = '6d1d3d99cd9e';
const TEXT: Record<Lang, { title: string; caption: string; build: string; shelf: string; staging: string; prod: string; digest: string; buildT: string; none: string; steps: StepInfo[]; envs: string; same: string }> = {
  th: {
    title: 'กดถัดไปทีละขั้น ดูป้าย (Tag) ย้ายไปมาบนชั้นของ Registry ขณะที่กล่อง (Image) กับรอยนิ้วมือ (Digest) ของมันอยู่ที่เดิม',
    caption: 'ค่า Digest, ป้ายที่ Registry บอก และผลจาก Container ทั้งสองมาจากการรันหนึ่งครั้งของแบบฝึก 04 (04_artifact_registry.py) รันอีกครั้งจะได้ Digest อื่น เพราะ Build ใหม่ได้ Image ใหม่เสมอ',
    build: 'เครื่อง Build', shelf: 'ชั้นของ Registry', staging: 'Staging', prod: 'Prod', digest: 'Digest', buildT: 'Image ที่เพิ่ง Build', none: 'ยังไม่มี', envs: 'Environment', same: 'Image เดียวกัน',
    steps: [
      { name: 'Build', title: 'Build Image ครั้งเดียว ที่ Commit 3f9c1a7', text: 'Pipeline สร้าง Image จากโค้ดของ Commit นั้น ตอนนี้ Image อยู่แค่ในเครื่อง Build ยังไม่มีใครอื่นเอาไปใช้ได้ (หนังสือบอกว่า Image ที่อยู่แค่ในคอมพิวเตอร์เราให้ Cluster ภายนอกดึงไปไม่ได้ ต้อง Push ขึ้น Registry ก่อน)' },
      { name: 'Push', title: 'Push ขึ้น Registry ได้ Digest เป็นรอยนิ้วมือของ Image', text: 'Registry ตอบกลับมาพร้อม Digest ซึ่งคือ sha256 ของเนื้อ Manifest ของ Image นี้ ป้ายแรกที่แปะคือชื่อ Commit (3f9c1a7) เรียกหากล่องใบนี้ด้วยชื่อ Commit หรือด้วย Digest ก็ได้ผลเหมือนกัน' },
      { name: 'แปะป้าย', title: 'เลื่อนระดับด้วยการแปะป้ายใหม่ ไม่ได้ Build ใหม่', text: 'ป้าย staging และ prod ถูกแปะบนกล่องใบเดิม Registry ยืนยันว่าทั้งสองชื่อชี้ไปที่ Digest เดียวกัน การเลื่อนระดับจึงไม่ได้เปลี่ยนไบต์ของ Image เลย' },
      { name: 'รันตาม Digest', title: 'Staging กับ Prod รัน Image ตัวเดียวกันด้วยค่า Config ต่างกัน', text: 'แบบฝึกลบ Image ในเครื่องทิ้งแล้ว Pull ด้วย Digest จากนั้นรันสอง Container ทั้งสองมี Image ID เดียวกัน และพิมพ์คนละบรรทัดตามค่า APP_ENV ที่ส่งเข้าไป' },
      { name: 'Build ใหม่', title: 'Build เวอร์ชันถัดไป ได้กล่องใบใหม่ที่มี Digest ใหม่', text: 'โค้ดเปลี่ยน Image ก็เปลี่ยน Digest ต่างจากใบแรก ป้ายของใบใหม่คือ v2 ส่วนใบเก่ายังอยู่บนชั้นพร้อมป้ายของมัน' },
      { name: 'ย้ายป้าย', title: 'ย้ายป้าย prod ไปที่ใบใหม่ ใบเก่ายังอยู่และดึงได้', text: 'ป้าย prod ถูกย้ายไป Digest ใหม่ ชื่อ prod จึงหมายถึงของใหม่แล้ว แต่ Digest เก่ายังตอบจาก Registry ได้ ดังนั้นถ้าต้องย้อนกลับ เราชี้ prod กลับไปที่ Digest เดิมได้ทันที' },
    ],
  },
  en: {
    title: 'Press Next one step at a time and watch a tag (a sticker) move around on the shelf of the registry, while the box (the image) and its fingerprint (the digest) stay where they are',
    caption: 'The digests, the tags the registry reports and the output of the two containers are from one run of exercise 04 (04_artifact_registry.py). Another run gives other digests, because a new build always gives a new image.',
    build: 'build machine', shelf: 'the shelf of the registry', staging: 'staging', prod: 'prod', digest: 'digest', buildT: 'image just built', none: 'none yet', envs: 'environments', same: 'the same image',
    steps: [
      { name: 'Build', title: 'Build the image once, at commit 3f9c1a7', text: 'The pipeline builds an image from the code of that commit. For now the image lives only on the build machine and nobody else can use it (the book says an image that lives only on our own computer cannot be fetched by an outside cluster, so it must be pushed to a registry first).' },
      { name: 'Push', title: 'Push to the registry and get a digest, the fingerprint of the image', text: 'The registry answers with a digest, the sha256 of the manifest of this image. The first sticker is the commit name (3f9c1a7). Calling the box by the commit name or by the digest gives the same result.' },
      { name: 'Add stickers', title: 'Promote by sticking new stickers, not by building again', text: 'The stickers staging and prod are stuck on the same box. The registry confirms both names point at one digest. So promoting did not change a single byte of the image.' },
      { name: 'Run by digest', title: 'Staging and prod run the same image with different config values', text: 'The exercise deleted the local image and pulled it again by digest, then ran two containers. Both have one image ID, and print different lines depending on the APP_ENV passed in.' },
      { name: 'New build', title: 'Build the next version and get a new box with a new digest', text: 'The code changed, so the image has a new digest, different from the first. Its sticker is v2, and the old box stays on the shelf with its stickers.' },
      { name: 'Move sticker', title: 'Move the prod sticker to the new box. The old one stays and can still be pulled', text: 'The prod sticker moved to the new digest, so the name prod now means the new thing. But the old digest still answers from the registry, so to go back we point prod at the old digest at once.' },
    ],
  },
};

export default function ArtifactLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const { step, go, playing, toggle } = useStepper(T.steps.length, 4800);
  const hasA = step >= 1;
  const hasB = step >= 4;
  const stick = (x: number, y: number, text: string, hot = false) => (
    <g key={text + x}>
      <rect x={x} y={y} width={text.length * 9.4 + 22} height={26} rx={13} className={hot ? 'nw-cell on' : 'nw-cell'} style={hot ? undefined : { fill: 'var(--surface-2)' }} />
      <text x={x + 11} y={y + 18} className="ib-m" style={{ fill: 'var(--fg)', fontSize: 14, fontWeight: 700 }}>{text}</text>
    </g>
  );
  const prodOnA = step >= 2 && step < 5;
  const prodOnB = step >= 5;
  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <div className="viz-box">
        <svg viewBox="0 0 880 470" role="img" aria-label={T.title}>
          <text x={20} y={30} className="ib-t">{T.build}</text>
          <Tile x={20} y={46} w={200} h={78} title={T.buildT} sub={step < 4 ? '3f9c1a7' : 'v2'} state={step === 0 || step === 4 ? 'on' : 'plain'} />
          <rect className="ib-zone-solid" x={290} y={14} width={330} height={376} rx={16} />
          <text x={306} y={40} className="ib-t">{T.shelf}</text>
          {/* box A */}
          {hasA && (
            <g>
              <rect className="ib-use" x={306} y={60} width={298} height={150} rx={12} />
              <text x={322} y={86} className="ib-n">Image A</text>
              <text x={322} y={108} className="ib-m">{T.digest} sha256:{D1}…</text>
              {stick(322, 122, '3f9c1a7')}
              {step >= 2 && stick(412, 122, 'staging', step === 2)}
              {prodOnA && stick(322, 160, 'prod', step === 2)}
            </g>
          )}
          {/* box B */}
          {hasB && (
            <g>
              <rect className={step === 4 ? 'ib-new' : 'ib-use'} x={306} y={226} width={298} height={150} rx={12} />
              <text x={322} y={252} className="ib-n">Image B</text>
              <text x={322} y={274} className="ib-m">{T.digest} sha256:{D2}…</text>
              {stick(322, 288, 'v2', step === 4)}
              {prodOnB && stick(380, 288, 'prod', step === 5)}
            </g>
          )}
          {step >= 1 && <Arrow x1={222} y1={92} x2={300} y2={92} op={step === 1 ? 1 : 0.4} />}
          {step >= 4 && <Arrow x1={222} y1={108} x2={300} y2={290} op={step === 4 ? 1 : 0.3} />}
          {/* environments */}
          <text x={650} y={30} className="ib-t">{T.envs}</text>
          <Tile x={650} y={46} w={212} h={92} title={T.staging} sub={step >= 3 ? `@${D1.slice(0, 8)} · staging` : T.none} state={step >= 3 ? 'ok' : 'skip'} />
          <Tile x={650} y={158} w={212} h={92} title={T.prod} sub={step >= 3 ? `@${D1.slice(0, 8)} · prod` : T.none} state={step >= 3 ? 'ok' : 'skip'} />
          {step >= 3 && <Arrow x1={606} y1={110} x2={646} y2={92} />}
          {step >= 3 && <Arrow x1={606} y1={140} x2={646} y2={204} />}
          {step === 3 && <text x={650} y={282} className="ib-n" style={{ fill: 'var(--k2)' }}>✓ {T.same}</text>}
          {step >= 3 && <text x={650} y={308} className="ib-s">hello from version 1 in staging</text>}
          {step >= 3 && <text x={650} y={330} className="ib-s">hello from version 1 in prod</text>}
          <Banner y={410} text={T.steps[step].title} />
        </svg>
      </div>
      <StepControls steps={T.steps} step={step} playing={playing} go={go} toggle={toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
