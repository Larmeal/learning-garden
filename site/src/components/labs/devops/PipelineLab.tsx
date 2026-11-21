import { useState } from 'react';
import { ClockControls, useClock, type Mark } from '../spark/timeline';
import { Banner } from '../iceberg/ib';
import { Card, Legend, ease, mix } from '../networking/nw';
import { Seg, Tile, Arrow, type Lang, type TileState } from './dv';

// Shows:      one push travelling to a server whose hook starts a pipeline of three stages (lint, test, build) and what happens to the stages and to the artifact in three cases:
//             a green commit, a commit whose test fails, a commit with a syntax error.
// Because:    "fail fast" and "a red commit leaves no artifact" are about what does NOT happen (the later stages are skipped, no zip appears). A reader has to watch two tiles go grey and an empty shelf to believe it.
// Control:    which commit is pushed (green, red test, syntax error); play, scrub and jump buttons.
// Conclusion: the pipeline stops at the first failing gate, the stages after it are skipped, and only a commit that passed every stage leaves an artifact named after its commit.
//
// The results of the three cases are the real ones of exercises/02_ci_pipeline.py (lint, test, build per commit; the log line of the failed stage).

type Case = 'green' | 'test' | 'lint';
const D = 12;
const RESULT: Record<Case, ('passed' | 'failed' | 'skipped')[]> = { green: ['passed', 'passed', 'passed'], test: ['passed', 'failed', 'skipped'], lint: ['failed', 'skipped', 'skipped'] };
const LOG: Record<Case, string> = { green: '', test: 'FAILED (failures=1)', lint: 'SyntaxError: expected ":"' };

const TEXT: Record<Lang, { title: string; caption: string; case: string; cases: Record<Case, string>; dev: string; server: string; hook: string; stages: [string, string, string]; shelf: string; none: string; commit: Record<Case, string>; marks: Record<Case, Mark[]>; st: Record<string, string>; sha: string }> = {
  th: {
    title: 'เลือก Commit ที่จะ Push แล้วกดเล่น ดูว่า Pipeline หยุดที่ไหน และมี Artifact ออกมาหรือไม่',
    caption: 'ผลของทั้งสามกรณีและบรรทัด Log ของขั้นที่ล้มเหลว เป็นผลจริงของแบบฝึก 02 (02_ci_pipeline.py) ที่ Hook ของ Git ใช้ Runner ตัวเล็ก ๆ ที่เขียนเอง ไม่ใช่ GitHub Actions',
    case: 'Commit ที่ Push', cases: { green: 'ผ่านทุกด่าน', test: 'Test ไม่ผ่าน', lint: 'Syntax ผิด' },
    dev: 'เครื่อง Developer', server: 'Server ที่รับ Push', hook: 'post-receive Hook', stages: ['Lint', 'Test', 'Build'], shelf: 'ชั้นเก็บ Artifact', none: 'ไม่มีอะไรออกมา',
    commit: { green: 'แก้ข้อความทักทาย', test: 'เปลี่ยนคำทักทาย ลืมแก้ Test', lint: 'ลืมเครื่องหมาย :' }, sha: 'app-<commit>.zip',
    st: { passed: 'ผ่าน', failed: 'ไม่ผ่าน', skipped: 'ข้าม', running: 'กำลังรัน', waiting: 'รอ' },
    marks: {
      green: [
        { at: 0, name: 'Push', title: 'Developer Push Commit ขึ้น Server', text: 'Server เป็น Repository ที่ทุกคนใช้ร่วมกัน พอรับ Commit แล้ว Git จะเรียก Hook ชื่อ post-receive ให้เอง' },
        { at: 3, name: 'Hook', title: 'Hook เรียก Runner ให้อ่าน pipeline.toml ของ Commit นั้น', text: 'Runner ดึงไฟล์ของ Commit ที่เพิ่งมาใส่โฟลเดอร์สะอาด แล้วอ่านว่า Pipeline มีกี่ขั้นจากไฟล์ที่อยู่ใน Commit เอง' },
        { at: 5, name: 'Lint และ Test', title: 'สองด่านแรกเป็น Gate ผ่านทั้งคู่', text: 'Lint ตรวจโค้ดโดยไม่รัน ส่วน Test รันโค้ดแล้วเทียบกับที่คาดไว้ ถ้าด่านไหนล้ม โค้ดไม่ควรไปต่อ' },
        { at: 9, name: 'Build', title: 'Build ผ่าน ได้ Artifact ที่ชื่อมี Commit ติดอยู่', text: 'ขั้นนี้ไม่ได้ตรวจโค้ด แต่เปลี่ยนโค้ดเป็นรูปที่เอาไปใช้ได้ (ไฟล์ zip) และเก็บไว้บนชั้น ชื่อมี Commit ติดไว้ จึงรู้ว่ามันมาจาก Commit ไหน' },
      ],
      test: [
        { at: 0, name: 'Push', title: 'Developer Push Commit ที่ Test จะล้ม', text: 'เปลี่ยนคำทักทายจาก hello เป็น hi แต่ลืมแก้ Test ที่คาดว่าจะได้ hello ada' },
        { at: 3, name: 'Hook', title: 'Hook เรียก Runner', text: 'Runner อ่านสามขั้นจาก pipeline.toml ของ Commit นี้' },
        { at: 5, name: 'Test ล้ม', title: 'Lint ผ่าน แต่ Test ไม่ผ่าน', text: 'Lint ตรวจแค่รูปแบบ จึงไม่เห็นว่าคำทักทายเปลี่ยน Test จับได้เพราะมันเทียบกับค่าที่คาดไว้ Runner หยุดทันที' },
        { at: 9, name: 'Build ถูกข้าม', title: 'Build ไม่ถูกรัน ชั้น Artifact ว่างเปล่า', text: 'ด่านหลังด่านที่ล้มจะถูกข้าม (Fail Fast) Commit ที่ไม่ผ่านจึงไม่มีทางกลายเป็น Artifact ที่ใครหยิบไปใช้ได้' },
      ],
      lint: [
        { at: 0, name: 'Push', title: 'Developer Push Commit ที่ Syntax ผิด', text: 'ลืมเครื่องหมาย : หลังบรรทัด def' },
        { at: 3, name: 'Hook', title: 'Hook เรียก Runner', text: 'Runner อ่านสามขั้นจาก pipeline.toml' },
        { at: 5, name: 'Lint ล้ม', title: 'Lint ไม่ผ่านเป็นด่านแรก', text: 'Lint ตรวจไฟล์โดยไม่ต้องรัน เจอ Syntax ที่ผิดทันที' },
        { at: 9, name: 'ข้ามที่เหลือ', title: 'Test กับ Build ถูกข้าม', text: 'Test ที่ไม่มีวันรันได้ถ้าไฟล์ผิด Syntax จึงไม่ต้องเสียเวลารัน ได้ผลล้มเหลวเร็วที่สุดและถูกที่สุด' },
      ],
    },
  },
  en: {
    title: 'Choose the commit to push and press play, then watch where the pipeline stops and whether an artifact comes out',
    caption: 'The results of the three cases and the log line of the failed stage are the real ones of exercise 02 (02_ci_pipeline.py). The Git hook calls a small runner written for the exercise, not GitHub Actions.',
    case: 'Commit pushed', cases: { green: 'passes everything', test: 'failing test', lint: 'syntax error' },
    dev: 'Developer\'s computer', server: 'Server that takes the push', hook: 'post-receive hook', stages: ['Lint', 'Test', 'Build'], shelf: 'artifact shelf', none: 'nothing came out',
    commit: { green: 'change the greeting text', test: 'change greeting, forget the test', lint: 'forgot the : sign' }, sha: 'app-<commit>.zip',
    st: { passed: 'passed', failed: 'failed', skipped: 'skipped', running: 'running', waiting: 'waiting' },
    marks: {
      green: [
        { at: 0, name: 'Push', title: 'The developer pushes a commit to the server', text: 'The server is the repository everyone shares. When it receives a commit, Git calls the hook named post-receive by itself.' },
        { at: 3, name: 'Hook', title: 'The hook calls the runner, which reads pipeline.toml of that commit', text: 'The runner puts the files of the new commit into a clean folder and reads how many stages the pipeline has from the file that is inside the commit itself.' },
        { at: 5, name: 'Lint and Test', title: 'The first two stages are gates and both pass', text: 'Lint looks at the code without running it, and Test runs it and compares with what was expected. If a gate fails, the code must not go on.' },
        { at: 9, name: 'Build', title: 'Build passes and leaves an artifact with the commit in its name', text: 'This stage does not check the code. It turns the code into something that can be used (a zip file) and keeps it on the shelf, with the commit in the name so we know where it came from.' },
      ],
      test: [
        { at: 0, name: 'Push', title: 'The developer pushes a commit whose test will fail', text: 'The greeting changed from hello to hi, but the test that expects hello ada was not updated.' },
        { at: 3, name: 'Hook', title: 'The hook calls the runner', text: 'The runner reads the three stages from the pipeline.toml of this commit.' },
        { at: 5, name: 'Test fails', title: 'Lint passes but Test fails', text: 'Lint checks only the form, so it does not see that the greeting changed. The test catches it because it compares with the expected value. The runner stops at once.' },
        { at: 9, name: 'Build skipped', title: 'Build never runs and the shelf stays empty', text: 'The stages after the failing one are skipped (fail fast). A commit that did not pass can never become an artifact that someone picks up.' },
      ],
      lint: [
        { at: 0, name: 'Push', title: 'The developer pushes a commit with a syntax error', text: 'The colon after the def line is missing.' },
        { at: 3, name: 'Hook', title: 'The hook calls the runner', text: 'The runner reads the three stages from pipeline.toml.' },
        { at: 5, name: 'Lint fails', title: 'Lint is the first gate and it fails', text: 'Lint reads the file without running it and finds the wrong syntax at once.' },
        { at: 9, name: 'Rest skipped', title: 'Test and Build are skipped', text: 'A test can never run on a file with a syntax error, so we do not waste time on it. We get the failure as early and as cheaply as possible.' },
      ],
    },
  },
};

export default function PipelineLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [cs, setCs] = useState<Case>('green');
  const clock = useClock(D);
  const { t } = clock;
  const res = RESULT[cs];
  const marks = T.marks[cs];
  let current = 0;
  marks.forEach((m, i) => { if (t >= m.at - 0.001) current = i; });
  const sx = [90, 90 + 190, 90 + 380];
  const stageState = (i: number): { s: TileState; sub: string } => {
    const start = 5 + i * 1.3;
    if (t < start) return { s: 'plain', sub: T.st.waiting };
    if (res[i] === 'skipped') return { s: 'skip', sub: T.st.skipped };
    if (t < start + 0.9) return { s: 'on', sub: T.st.running };
    return res[i] === 'passed' ? { s: 'ok', sub: '✓ ' + T.st.passed } : { s: 'bad', sub: '✗ ' + T.st.failed };
  };
  const pPush = ease(t, 0.3, 2.2);
  const hookOn = t >= 3;
  const artifact = res[2] === 'passed' && t >= 9.2;

  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend layers={[]} lang={lang} extra={[{ cls: 'same', text: T.st.passed }, { cls: 'bad', text: T.st.failed }, { cls: 'chg', text: T.st.running }]} />
      <Seg label={T.case} options={(['green', 'test', 'lint'] as Case[]).map((c) => ({ id: c, text: T.cases[c] }))} value={cs} onChange={(c) => { setCs(c); clock.restart(); }} />
      <div className="viz-box">
        <svg viewBox="0 0 880 454" role="img" aria-label={T.title}>
          <Tile x={20} y={36} w={190} h={64} title={T.dev} state="plain" />
          <Tile x={330} y={36} w={190} h={64} title={T.server} sub="git push → bare repo" state={t >= 2.2 ? 'on' : 'plain'} />
          <Tile x={630} y={36} w={226} h={64} title={T.hook} sub="ci_runner.py" state={hookOn ? 'on' : 'plain'} />
          <Arrow x1={212} y1={68} x2={326} y2={68} op={t > 0.3 ? 1 : 0.2} />
          <Arrow x1={522} y1={68} x2={626} y2={68} op={t >= 3 ? 1 : 0.2} />
          <Card x={mix(115, 425, pPush)} y={mix(130, 130, 0)} w={230} title={T.commit[cs]} sub="commit" kind="q" op={t < 2.4 ? 1 : 0} />
          <text x={20} y={190} className="ib-t">pipeline.toml</text>
          {[0, 1, 2].map((i) => {
            const st = stageState(i);
            return <Tile key={i} x={sx[i]} y={204} w={160} h={74} title={T.stages[i]} sub={st.sub} state={st.s} op={t >= 3.4 ? 1 : 0.25} big />;
          })}
          <Arrow x1={sx[0] + 162} y1={241} x2={sx[1] - 2} y2={241} op={t >= 5 ? 1 : 0.2} bad={res[0] === 'failed'} />
          <Arrow x1={sx[1] + 162} y1={241} x2={sx[2] - 2} y2={241} op={t >= 6.3 ? 1 : 0.2} bad={res[1] === 'failed'} dashed={res[1] === 'skipped'} />
          <Arrow x1={sx[2] + 162} y1={241} x2={700} y2={241} op={t >= 9 && res[2] === 'passed' ? 1 : 0} />
          <Tile x={704} y={204} w={160} h={74} title={T.shelf} sub={artifact ? T.sha : T.none} state={artifact ? 'ok' : 'skip'} />
          {t >= 5.9 && LOG[cs] && (res[0] === 'failed' || t >= 6.9) && (
            <g>
              <rect x={20} y={304} width={840} height={44} rx={8} className="ib-skip" style={{ fill: 'var(--surface-2)' }} />
              <text x={34} y={332} className="ib-m" style={{ fill: 'var(--ib-bad)', fontSize: 16 }}>[ci] {cs === 'lint' ? 'lint' : 'test'} → {LOG[cs]}</text>
            </g>
          )}
          <Banner y={378} text={marks[current].title} />
        </svg>
      </div>
      <ClockControls clock={clock} marks={marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
