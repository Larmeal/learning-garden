import { StepControls, useStepper, type StepInfo } from '../spark/stepper';
import { Lines } from '../iceberg/ib';
import { Arrow, Tile, type Lang, type TileState } from './dv';
import data from './capstone.json';

// Shows:      the whole path of this subject as six stations (the app repository, CI, the registry, the config repository, the controller, the cluster) and what each one holds after each of eight steps of one story:
//             v1 goes out, v2 has a bug that no test covers and is caught by a canary, a revert rolls it back, v3 fixes it and brings the missing test.
// Because:    each earlier lesson drew one station. Only the whole line shows that the pieces hand over to each other (a commit becomes an image, an image becomes a line in a config repository, a line becomes containers)
//             and that every hand-over leaves a record you can read afterwards.
// Control:    the step buttons.
// Conclusion: from a commit to production and back again, every move is a commit or a tag somewhere, so "what runs now, which commit made it and who changed what when" can always be answered.
//
// Everything on the stations is from one run of exercises/13_capstone_pipeline.py (capstone.json): the commit ids of the images (fa85218, c247234, 7ebd8ce) and of the config repository, the stages of CI, the 5 failed
// of 60 requests on the canary (25 percent), and the final containers. Another run on another machine gives the same ids, because every commit has a fixed author and date.

const [I1, I2, I3] = data.images as string[];
const C = data.story.map((s) => s.config) as string[]; // v1, canary, revert, v3 config commits

const TEXT: Record<Lang, { title: string; caption: string; app: string; ci: string; reg: string; cfg: string; ctl: string; clu: string; steps: StepInfo[]; none: string; noTest: string; newTest: string; canary: string; pull: string; nothing: string }> = {
  th: {
    title: 'กดถัดไปทีละขั้นตามเรื่องของสามเวอร์ชัน ดูว่าแต่ละสถานีถืออะไร และการส่งต่อระหว่างสถานีทิ้งร่องรอยไว้ที่ไหน',
    caption: 'ทุก Commit Id ผลของ CI และตัวเลข 5 ใน 60 คำขอมาจากการรันหนึ่งครั้งของแบบฝึก 13 (capstone.json) รันซ้ำที่อื่นได้ Id เดิม เพราะทุก Commit ตั้งผู้เขียนกับวันที่ไว้คงที่ ส่วนที่ไม่ได้รัน: Kubernetes, Argo CD, GitHub Actions และ Cloud จริง',
    app: 'Repository ของแอป', ci: 'CI (hook)', reg: 'Registry', cfg: 'Repository ของ Config', ctl: 'Controller', clu: 'Cluster (Docker)', none: 'ว่าง', noTest: '(ไม่มี Test ของบั๊ก)', newTest: 'v3 ✓ · โค้ด v2 ✗', canary: 'canary: ล้ม 5 จาก 20 (25%)', pull: 'ดึง Image', nothing: '(ไม่มีอะไรต้องทำ)',
    steps: [
      { name: 'Push v1', title: 'Push Commit แรก แล้ว CI สร้าง Image', text: 'Hook ของ Repository รัน Pipeline ที่อยู่ใน Commit ทั้ง lint test และ image ผ่านหมด Image ถูกสร้างครั้งเดียวและ Push ขึ้น Registry โดยมี Commit เป็นชื่อ Tag' },
      { name: 'Release v1', title: 'เปลี่ยนไฟล์ใน Repository ของ Config แล้ว Controller สร้างสอง Replica', text: 'การ Release คือ Commit ใน Repository ของ Config ที่บอกว่า web ต้องรัน Image นี้สองตัว Controller อ่านไฟล์ แล้วสร้าง web-1 กับ web-2 ผู้ใช้เห็นเวอร์ชัน 1 ที่ไม่สนใจโค้ดคูปอง' },
      { name: 'Push v2', title: 'เวอร์ชัน 2 ผ่านทุกด่านของ CI ทั้งที่มีบั๊ก', text: 'โค้ดเพิ่มคูปองแต่ไม่มี Test ที่ใช้โค้ด WELCOME5 CI จึงเขียวหมดและ Registry มี Image ที่สอง บั๊กที่ Test ไม่ครอบคลุม ผ่าน Pipeline ได้เสมอ นี่คือเหตุผลที่ต้องมีด่านอื่นต่อไป' },
      { name: 'Canary', title: 'Release v2 เป็น Canary หนึ่งใน สาม Replica แล้วดูอัตรา Error', text: 'Config ใหม่ให้ web v1 สองตัว และ canary v2 หนึ่งตัว คำขอ 60 ตัวกระจายแบบวนรอบ คำขอที่ไปถึง Canary 20 ตัว ล้ม 5 ตัว (25%) เกินเกณฑ์ 10% ส่วน v1 ไม่ล้มเลย' },
      { name: 'Rollback', title: 'git revert Commit ของ Config แล้ว Controller ลบ Canary', text: 'ผู้ตัดสินเห็นเกินเกณฑ์ เรา Revert Commit ที่เพิ่ม Canary แล้ว Push Controller ลบ canary-1 และไม่แตะอย่างอื่น ทุกคำขอสำเร็จอีกครั้ง ประวัติของ Config บันทึกทั้งการเพิ่มและการ Revert' },
      { name: 'Fix v3', title: 'v3 แก้บั๊ก และเพิ่ม Test ที่ขาด', text: 'Test ของ v3 ที่ครอบคลุมโค้ด WELCOME5 ล้มเมื่อรันกับโค้ดของ v2 (KeyError) ซึ่งแปลว่ามันจะกันการ Release v2 ได้ถ้ามีมาตั้งแต่ต้น CI ของ v3 ผ่าน และ Image ที่สามเข้า Registry' },
      { name: 'Release v3', title: 'Release v3 ผ่าน Config Commit แล้ว Controller แทนที่ web สองตัว', text: 'Controller แทนที่ web-1 กับ web-2 ด้วย Image ใหม่ โค้ดที่เคยทำ v2 พัง ตอนนี้ได้ผล price=95' },
      { name: 'ร่องรอย', title: 'ตอบได้ว่าตอนนี้อะไรรันอยู่ มาจาก Commit ไหน และใครเปลี่ยนอะไรเมื่อไร', text: 'Registry มีสามรูป ประวัติ Config อ่านเป็นเรื่อง (release, canary, revert, release) และ Container ที่รันอยู่ใช้ Image ของ Commit สุดท้าย ทุกการเคลื่อนไหวเป็น Commit หรือ Tag ที่ไหนสักแห่ง' },
    ],
  },
  en: {
    title: 'Press Next one step at a time through the story of three versions and see what each station holds, and where each hand-over between stations leaves its trace',
    caption: 'All commit ids, the CI results and the 5 of 60 requests are from one run of exercise 13 (capstone.json). Running it elsewhere gives the same ids, because every commit has a fixed author and date. Not run: Kubernetes, Argo CD, GitHub Actions and a real cloud.',
    app: 'app repository', ci: 'CI (hook)', reg: 'registry', cfg: 'config repository', ctl: 'controller', clu: 'cluster (Docker)', none: 'empty', noTest: '(no test for the bug)', newTest: 'v3 ✓ · v2 code ✗', canary: 'canary: 5 / 20 failed (25%)', pull: 'pull image', nothing: '(nothing to do)',
    steps: [
      { name: 'Push v1', title: 'Push the first commit and CI builds the image', text: 'The hook of the repository runs the pipeline that is inside the commit. Lint, test and image all pass. The image is built once and pushed to the registry with the commit as its tag.' },
      { name: 'Release v1', title: 'Change a file in the config repository and the controller creates two replicas', text: 'A release is a commit in the config repository saying web must run this image twice. The controller reads the file and creates web-1 and web-2. Users see version 1, which ignores coupon code.' },
      { name: 'Push v2', title: 'Version 2 passes every gate of CI although it has a bug', text: 'The code adds coupons but no test uses the code WELCOME5. So CI is all green and the registry gets a second image. A bug that tests do not cover can always pass a pipeline, which is why other gates are needed.' },
      { name: 'Canary', title: 'Release v2 as a canary, one replica of three, and watch the error rate', text: 'The new config gives two web v1 and one canary v2. The 60 requests go round robin. The canary got 20 requests and 5 failed (25%), over the 10% threshold, while v1 failed none.' },
      { name: 'Rollback', title: 'git revert the config commit and the controller removes the canary', text: 'The judge sees the threshold exceeded. We revert the commit that added the canary and push. The controller removes canary-1 and touches nothing else. Every request succeeds again. The history of the config records both the addition and the revert.' },
      { name: 'Fix v3', title: 'v3 fixes the bug and adds the missing test', text: 'The test of v3 that covers the code WELCOME5 fails when run against the code of v2 (KeyError), so it would have blocked the release of v2 had it existed. CI of v3 passes and the third image goes to the registry.' },
      { name: 'Release v3', title: 'Release v3 through a config commit and the controller replaces both web containers', text: 'The controller replaces web-1 and web-2 with the new image. The code that broke v2 now gives price=95.' },
      { name: 'Traces', title: 'We can answer what is running now, from which commit, and who changed what and when', text: 'The registry has three images, the config history reads as a story (release, canary, revert, release), and the containers that run use the image of the last commit. Every move is a commit or a tag somewhere.' },
    ],
  },
};

export default function CapstoneLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const { step, go, playing, toggle } = useStepper(T.steps.length, 5600);
  const s = step;
  const appSub = s === 0 ? `v1 · ${I1}` : s < 2 ? `v1 · ${I1}` : s < 5 ? `v2 · ${I2}` : `v3 · ${I3}`;
  const tags = [I1, ...(s >= 2 ? [I2] : []), ...(s >= 5 ? [I3] : [])];
  const cfgSub = s < 1 ? T.none : s < 3 ? `release ${I1} → ${C[0]}` : s === 3 ? `canary ${I2} → ${C[1]}` : s === 4 ? `revert → ${C[2]}` : s < 6 ? `revert → ${C[2]}` : `release ${I3} → ${C[3]}`;
  const ctl: string = s < 1 ? '—' : s === 1 ? 'create web-1, web-2' : s === 2 ? T.nothing : s === 3 ? 'create canary-1' : s === 4 ? 'remove canary-1' : s === 5 ? T.nothing : 'replace web-1, web-2';
  const cluster = s < 1 ? T.none : s === 1 || s === 2 ? 'web ×2 · v1' : s === 3 ? 'web ×2 v1 + canary v2' : s === 4 || s === 5 ? 'web ×2 · v1' : 'web ×2 · v3';
  const ciStages = s === 0 ? 'lint ✓  test ✓  image ✓' : s === 2 ? 'lint ✓ test ✓ image ✓' : s === 5 ? T.newTest : s > 5 ? 'lint ✓  test ✓  image ✓' : '—';
  const active = [[0, 1, 2], [3, 4, 5], [0, 1, 2], [3, 4, 5], [3, 4, 5], [0, 1, 2], [3, 4, 5], [2, 3, 5]][s];
  const st = (i: number): TileState => (active.includes(i) ? 'on' : 'plain');
  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <div className="viz-box">
        <svg viewBox="0 0 880 410" role="img" aria-label={T.title}>
          <Tile x={20} y={30} w={250} h={96} title={T.app} sub={appSub} state={st(0)} />
          <Tile x={315} y={30} w={250} h={96} title={T.ci} sub={ciStages} state={s === 5 ? 'bad' : st(1)} />
          <Tile x={610} y={30} w={250} h={96} title={T.reg} sub={tags.join(' ')} state={st(2)} />
          <Arrow x1={272} y1={78} x2={311} y2={78} op={[0, 2, 5].includes(s) ? 1 : 0.3} />
          <Arrow x1={567} y1={78} x2={606} y2={78} op={[0, 2, 5].includes(s) ? 1 : 0.3} />
          <Tile x={20} y={210} w={250} h={96} title={T.cfg} sub={cfgSub} state={st(3)} />
          <Tile x={315} y={210} w={250} h={96} title={T.ctl} sub={ctl} state={st(4)} />
          <Tile x={610} y={210} w={250} h={96} title={T.clu} sub={cluster} state={s === 3 ? 'bad' : st(5)} />
          <Arrow x1={272} y1={258} x2={311} y2={258} op={[1, 3, 4, 6].includes(s) ? 1 : 0.3} />
          <Arrow x1={567} y1={258} x2={606} y2={258} op={[1, 3, 4, 6].includes(s) ? 1 : 0.3} />
          <Arrow x1={735} y1={128} x2={735} y2={206} dashed op={[1, 3, 6].includes(s) ? 1 : 0.25} />
          <text x={745} y={172} className="ib-s">{T.pull}</text>
          <rect className="ib-banner" x={12} y={330} width={856} height={64} rx={10} />
          <Lines x={26} y={362} text={T.steps[step].title} max={86} lh={26} className="ib-n" />
          {s === 3 && <text x={26} y={384} className="ib-m" style={{ fill: 'var(--ib-bad)', fontSize: 16 }}>{T.canary}</text>}
        </svg>
      </div>
      <StepControls steps={T.steps} step={step} playing={playing} go={go} toggle={toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
