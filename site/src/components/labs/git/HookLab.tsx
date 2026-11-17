import { useState } from 'react';
import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import { ease, mix } from './gl';
import data from './labData.json';

// Shows:      what happens to a git commit when a pre-commit hook is in the way. A token travels from the command to the commit being written. In
//             one run the hook exits with 1, the token bounces back and no commit is made. In the other, --no-verify sends the token over the hook.
// Because:    a hook is a script that sits between the command and its result, with the power to stop it. That is a path with a gate on it.
// Control:    the two runs (the hook says no, --no-verify skips it); the clock moves the token. Each run changes the path, the box colours,
//             the terminal and the log underneath.
// Conclusion: a pre-commit hook that exits non-zero stops the commit; --no-verify skips it, so a hook is a helper and never a guarantee.
//
// The script, its output and the two logs are what git printed in exercises/16_lab_data.py (the scenario of exercise 14, section 2).

type Run = 'stop' | 'skip';
const D = data.hook;
const DURATION = 8;

const TEXT: Record<Lang, { title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; pick: string; runs: Record<Run, string>; cmd: Record<Run, string>; start: string; hook: string; made: string; notMade: string; skipped: string; script: string; terminal: string; log: string; exit: string; marks: Record<Run, Mark[]>; caption: string }> = {
  th: {
    title: 'git commit ที่มี Hook ขวางอยู่ เลือกว่าจะให้ Hook ห้าม หรือสั่งข้าม Hook ด้วย --no-verify แล้วกดเล่นดูทางที่ Commit ต้องผ่าน',
    legend: [{ kind: 'new', text: 'Commit ที่ถูกเขียน' }, { kind: 'use', text: 'ด่านที่ผ่านได้' }, { kind: 'skip', text: 'ไม่ได้เกิดขึ้น หรือถูกข้าม' }],
    pick: 'ลองสั่งแบบไหน',
    runs: { stop: 'Commit ตรง ๆ (มี DEBUG อยู่ในโค้ด)', skip: 'Commit ด้วย --no-verify' },
    cmd: { stop: 'git commit -m "C2 with debug"', skip: 'git commit --no-verify -m "C2 with debug"' },
    start: 'คำสั่ง', hook: 'Hook: pre-commit', made: 'Commit ถูกเขียน', notMade: 'Commit ไม่ถูกเขียน', skipped: 'ถูกข้าม', script: '.git/hooks/pre-commit', terminal: 'Terminal', log: 'git log --format=%s', exit: 'exit',
    caption: 'สคริปต์ ข้อความที่ Hook พิมพ์ และผลของ git log มาจากแบบฝึก 16 (สถานการณ์เดียวกับแบบฝึก 14) รันผ่าน sh ของ Git for Windows Hook อื่นอย่าง prepare-commit-msg และ post-commit ไม่ได้รัน',
    marks: {
      stop: [
        { at: 0, name: 'สั่ง commit', title: 'เราสั่ง git commit ทั้งที่มีบรรทัด DEBUG', text: 'ก่อน Git จะเขียน Commit มันมองหาไฟล์ .git/hooks/pre-commit และรันก่อน' },
        { at: 2.2, name: 'Hook ห้าม', title: 'Hook ตรวจเจอ DEBUG แล้วออกด้วย exit 1', text: 'สคริปต์พิมพ์ข้อความบอกเหตุผลแล้วจบด้วย exit 1 Git ถือว่าเป็นคำสั่งห้าม' },
        { at: 4.2, name: 'ไม่มี Commit', title: 'Commit ไม่ถูกเขียน', text: 'git log ยังเห็นแค่ C1 งานที่ Stage ไว้ยังอยู่ครบ เราแก้ไฟล์แล้วสั่งใหม่ได้' },
      ],
      skip: [
        { at: 0, name: 'สั่ง commit', title: 'เราสั่ง git commit พร้อม --no-verify', text: 'ตัวเลือกนี้บอก Git ให้ไม่ต้องรัน pre-commit และ commit-msg' },
        { at: 2.0, name: 'ข้าม Hook', title: 'Commit ข้ามด่านไปเลย', text: 'Hook ไม่ได้ถูกรัน บรรทัด DEBUG จึงไม่มีใครเห็น' },
        { at: 4.2, name: 'มี Commit', title: 'Commit ถูกเขียน', text: 'git log เห็น C2 with debug ซ้อนบน C1 Hook จึงเป็นตัวช่วย ไม่ใช่การรับประกัน เพราะใครจะข้ามก็ได้ และ Hook ไม่ได้ถูกส่งไปกับ Repository ตอน Clone' },
      ],
    },
  },
  en: {
    title: 'A git commit with a hook in the way. Choose whether the hook says no or --no-verify skips it, then press play and follow the path the commit has to take',
    legend: [{ kind: 'new', text: 'the commit that was written' }, { kind: 'use', text: 'a gate it can pass' }, { kind: 'skip', text: 'did not happen, or was skipped' }],
    pick: 'Which command',
    runs: { stop: 'a plain commit (a DEBUG line is in the code)', skip: 'commit with --no-verify' },
    cmd: { stop: 'git commit -m "C2 with debug"', skip: 'git commit --no-verify -m "C2 with debug"' },
    start: 'command', hook: 'hook: pre-commit', made: 'commit written', notMade: 'no commit written', skipped: 'skipped', script: '.git/hooks/pre-commit', terminal: 'terminal', log: 'git log --format=%s', exit: 'exit',
    caption: 'The script, the text the hook prints and the git log output come from exercise 16 (the scenario of exercise 14), run through the sh of Git for Windows. Other hooks such as prepare-commit-msg and post-commit were not run.',
    marks: {
      stop: [
        { at: 0, name: 'git commit', title: 'We run git commit with a DEBUG line in the code', text: 'Before Git writes the commit, it looks for the file .git/hooks/pre-commit and runs it first.' },
        { at: 2.2, name: 'hook says no', title: 'The hook finds DEBUG and exits with 1', text: 'The script prints a message that says why and ends with exit 1. Git treats that as a no.' },
        { at: 4.2, name: 'no commit', title: 'No commit is written', text: 'git log still shows only C1. What we staged is all still there, so we can fix the file and try again.' },
      ],
      skip: [
        { at: 0, name: 'git commit', title: 'We run git commit with --no-verify', text: 'That option tells Git not to run pre-commit and commit-msg.' },
        { at: 2.0, name: 'skip the hook', title: 'The commit goes straight past the gate', text: 'The hook is never run, so nobody sees the DEBUG line.' },
        { at: 4.2, name: 'commit written', title: 'The commit is written', text: 'git log shows C2 with debug on top of C1. A hook is a helper and not a guarantee, because anyone can skip it and hooks are not sent along when a repository is cloned.' },
      ],
    },
  },
};

export default function HookLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [run, setRun] = useState<Run>('stop');
  const clock = useClock(DURATION);
  const { t } = clock;
  const X = { cmd: 90, hook: 440, made: 790 };
  const Y = 120;
  // token: stop run goes to the hook and back; skip run goes over the hook to the commit
  let tx: number, ty: number;
  if (run === 'stop') {
    const go = ease(t, 0.8, 2.2), back = ease(t, 3.4, 4.6);
    tx = mix(mix(X.cmd + 100, X.hook - 110, go), X.cmd + 100, back);
    ty = Y;
  } else {
    const p = ease(t, 0.8, 4.2);
    tx = mix(X.cmd + 100, X.made - 110, p);
    const u = Math.min(1, Math.max(0, (tx - (X.hook - 110)) / 220));
    ty = Y - 56 * Math.sin(Math.PI * u);
  }
  const hookBad = run === 'stop' && t >= 2.2;
  const written = run === 'skip' && t >= 4.2;
  const lines = D.fail_output.split('\n');
  const out = run === 'stop' ? (t >= 2.4 ? lines : []) : [];
  const logNow = run === 'stop' ? (t >= 4.2 ? D.log_after_fail : null) : (t >= 4.4 ? D.log_after_no_verify : null);
  const script = D.script.split('\n');
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.pick}</span>
        <div className="seg" role="group" aria-label={T.pick}>
          {(['stop', 'skip'] as Run[]).map((k) => (
            <button key={k} type="button" aria-pressed={run === k} onClick={() => { setRun(k); clock.restart(); }}>{T.runs[k]}</button>
          ))}
        </div>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 440" role="img" aria-label={T.title}>
          <line x1={X.cmd + 80} y1={Y} x2={X.hook - 90} y2={Y} className="ib-line" style={{ strokeWidth: 3 }} />
          <line x1={X.hook + 90} y1={Y} x2={X.made - 90} y2={Y} className="ib-line" style={{ strokeWidth: 3, strokeDasharray: hookBad ? '7 6' : undefined, opacity: hookBad ? 0.5 : 1 }} />
          {/* the three boxes */}
          <g>
            <rect className="ib-use" x={X.cmd - 80} y={Y - 34} width={160} height={68} rx={10} />
            <text x={X.cmd} y={Y - 8} textAnchor="middle" className="ib-s">{T.start}</text>
            <text x={X.cmd} y={Y + 16} textAnchor="middle" className="ib-m" style={{ fill: 'var(--fg)' }}>git commit</text>
          </g>
          <g style={{ opacity: run === 'skip' && t >= 1.2 ? 0.6 : 1 }}>
            <rect className={run === 'skip' && t >= 1.2 ? 'ib-skip' : 'ib-use'} x={X.hook - 90} y={Y - 34} width={180} height={68} rx={10} style={hookBad ? { stroke: 'var(--ib-bad)', strokeWidth: 4, fill: 'var(--surface)' } : undefined} />
            <text x={X.hook} y={Y - 8} textAnchor="middle" className="ib-n">{T.hook}</text>
            <text x={X.hook} y={Y + 18} textAnchor="middle" className={hookBad ? 'ib-bad ib-n' : 'ib-s'}>{hookBad ? `✗ ${T.exit} 1` : run === 'skip' && t >= 1.2 ? T.skipped : ''}</text>
          </g>
          <g style={{ opacity: hookBad ? 0.6 : 1 }}>
            <rect className={written ? 'ib-new' : hookBad ? 'ib-skip' : 'ib-node'} x={X.made - 90} y={Y - 34} width={180} height={68} rx={10} />
            <text x={X.made} y={Y + 6} textAnchor="middle" className="ib-n">{hookBad ? T.notMade : T.made}</text>
          </g>
          <circle cx={tx} cy={ty} r={11} style={{ fill: hookBad && t < 4.6 ? 'var(--ib-bad)' : 'var(--accent)' }} />

          {/* the script, the terminal and the log */}
          <rect className="ib-zone" x={12} y={210} width={450} height={214} rx={12} style={{ opacity: 0.55 }} />
          <text x={26} y={236} className="ib-n">{T.script}</text>
          {script.map((l, i) => (
            <text key={i} x={26} y={262 + i * 22} className="ib-m" style={{ fill: 'var(--fg)', fontSize: 12.5 }}>{l.replace(/ /g, ' ')}</text>
          ))}
          <rect className="ib-zone" x={476} y={210} width={392} height={214} rx={12} style={{ opacity: 0.55 }} />
          <text x={490} y={236} className="ib-n">{T.terminal}</text>
          <text x={490} y={262} className="ib-m" style={{ fill: 'var(--fg)', fontSize: 13 }}>{`$ ${T.cmd[run]}`}</text>
          {out.map((l, i) => (
            <text key={i} x={490} y={284 + i * 20} className="ib-m ib-bad" style={{ fontSize: 13, fill: 'var(--ib-bad)' }}>{l}</text>
          ))}
          <text x={490} y={330} className="ib-m" style={{ fill: 'var(--fg)', fontSize: 13 }}>{logNow ? `$ ${T.log}` : ''}</text>
          {logNow && logNow.map((l, i) => (
            <text key={i} x={490} y={352 + i * 20} className="ib-m" style={{ fill: 'var(--fg)', fontSize: 14, fontWeight: 700 }}>{l}</text>
          ))}
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks[run]} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
