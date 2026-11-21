import { useState } from 'react';
import type { Lang } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import data from './lifecycle.json';

// Shows:      the states of one container as boxes in a row, and the commands that are allowed from the state it is in. Press a command and the container
//             moves, its process appears, freezes or disappears, and the exit code shows. For docker stop a second picture shows the clock: SIGTERM at 0,
//             the grace period, SIGKILL at the end, and the moment the program really ended.
// Because:    the state of a container is the state of one process. Pressing the commands in the wrong order (start a running container, pause an exited one)
//             shows which moves exist. The wait of docker stop depends on what PID 1 does with SIGTERM, which is a picture of time.
// Control:    the program that is PID 1 (three kinds, it decides what docker stop does) and the commands.
// Conclusion: a container is running exactly as long as its process; docker stop asks politely first, and a PID 1 that ignores the request costs the whole grace period.
//
// Times and exit codes come from exercises/03_lifecycle.py --write (lifecycle.json, "stops", measured with docker stop -t 5). The states and transitions are the
// ones the exercise walked through with real commands (created, running, paused, running, exited, running, exited, removed).

type St = 'none' | 'created' | 'running' | 'paused' | 'exited' | 'removed';
type Prog = 0 | 1 | 2;
type Cmd = 'create' | 'start' | 'pause' | 'unpause' | 'stop' | 'kill' | 'ends' | 'rm';
const STOPS = data.stops;
const GRACE = 5;

const NEXT: Record<St, Partial<Record<Cmd, St>>> = {
  none: { create: 'created' },
  created: { start: 'running', rm: 'removed' },
  running: { pause: 'paused', stop: 'exited', kill: 'exited', ends: 'exited' },
  paused: { unpause: 'running' },
  exited: { start: 'running', rm: 'removed' },
  removed: {},
};

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; prog: string; progs: string[]; cmds: Record<Cmd, string>; again: string;
  states: Record<St, [string, string]>; process: Record<St, string>; code: string; clock: string; term: string; kill: string; ended: string; s: string;
  readout: (st: St, code: number | null, secs: number | null, prog: Prog) => string; caption: string;
}> = {
  th: {
    title: 'กดคำสั่งตามลำดับ เพื่อพา Container ผ่านแต่ละสถานะ และลองสั่ง docker stop กับโปรแกรมสามแบบดูว่าใช้เวลาไม่เท่ากัน',
    legend: [{ kind: 'new', text: 'สถานะตอนนี้' }, { kind: 'use', text: 'สถานะที่เคยผ่าน' }, { kind: 'skip', text: 'ยังไม่ถึง' }],
    prog: 'โปรแกรมที่เป็น PID 1',
    progs: ['Python ที่รับ SIGTERM', 'Sleep ธรรมดา', 'Sleep ผ่าน --init'],
    cmds: { create: 'docker create', start: 'docker start', pause: 'docker pause', unpause: 'docker unpause', stop: 'docker stop', kill: 'docker kill', ends: 'โปรแกรมจบเอง', rm: 'docker rm' },
    again: 'เริ่มใหม่',
    states: { none: ['ยังไม่มี', ''], created: ['สร้างไว้แล้ว', 'created'], running: ['กำลังทำงาน', 'running'], paused: ['ถูกแช่แข็ง', 'paused'], exited: ['จบแล้ว', 'exited'], removed: ['ถูกลบ', 'ไม่มีในรายการ'] },
    process: { none: 'ยังไม่มี Container', created: 'ยังไม่มี Process เพราะยังไม่ได้ Start', running: 'Process ทำงานอยู่', paused: 'Process ยังอยู่แต่ถูกแช่แข็ง', exited: 'Process จบไปแล้ว', removed: 'ไม่มีอะไรเหลือ' },
    code: 'Exit Code',
    clock: 'เส้นเวลาของ docker stop -t 5',
    term: 'ส่ง SIGTERM',
    kill: 'ส่ง SIGKILL',
    ended: 'Process จบ',
    s: 'วินาที',
    readout: (st, code, secs, prog) =>
      st === 'exited' && secs !== null
        ? `docker stop ใช้เวลา ${secs} วินาที และได้ Exit Code ${code}${prog === 1 ? ' เพราะ Sleep ที่เป็น PID 1 ไม่สนใจ SIGTERM จึงต้องรอจนหมดเวลาแล้วโดน SIGKILL' : prog === 0 ? ' เพราะโปรแกรมรับ SIGTERM แล้วปิดตัวเองด้วยโค้ดที่เลือก' : ' เพราะ --init ส่งต่อ SIGTERM ให้ Sleep ซึ่งตายเพราะสัญญาณนั้น (128 + 15)'}`
        : st === 'exited' && code !== null
          ? `Container จบด้วย Exit Code ${code}`
          : 'กดคำสั่งที่เปิดอยู่เพื่อไปสถานะถัดไป',
    caption: 'เวลาและ Exit Code ของ docker stop มาจากแบบฝึก 03 (ตั้ง -t 5 และวัดจริง ส่วนโปรแกรมที่รับ SIGTERM คือ Python ที่ตั้ง Signal Handler) ลำดับสถานะ created, running, paused, running, exited, running, exited ถึงถูกลบ เป็นลำดับที่แบบฝึกสั่งจริง',
  },
  en: {
    title: 'Press the commands in order to walk a container through its states, and try docker stop with three kinds of program to see that it takes different times',
    legend: [{ kind: 'new', text: 'the state now' }, { kind: 'use', text: 'a state it has been in' }, { kind: 'skip', text: 'not reached yet' }],
    prog: 'The program that is PID 1',
    progs: ['Python that handles SIGTERM', 'Plain sleep', 'Sleep behind --init'],
    cmds: { create: 'docker create', start: 'docker start', pause: 'docker pause', unpause: 'docker unpause', stop: 'docker stop', kill: 'docker kill', ends: 'the program ends', rm: 'docker rm' },
    again: 'start over',
    states: { none: ['not there yet', ''], created: ['made, not started', 'created'], running: ['working', 'running'], paused: ['frozen', 'paused'], exited: ['ended', 'exited'], removed: ['removed', 'not in the list'] },
    process: { none: 'no container yet', created: 'no process yet, it was never started', running: 'the process is working', paused: 'the process exists but is frozen', exited: 'the process has ended', removed: 'nothing is left' },
    code: 'exit code',
    clock: 'the clock of docker stop -t 5',
    term: 'send SIGTERM',
    kill: 'send SIGKILL',
    ended: 'process ended',
    s: 's',
    readout: (st, code, secs, prog) =>
      st === 'exited' && secs !== null
        ? `docker stop took ${secs} s and the exit code is ${code}${prog === 1 ? ': a plain sleep as PID 1 ignores SIGTERM, so Docker waited out the grace period and then sent SIGKILL' : prog === 0 ? ': the program handles SIGTERM and closes itself with the code it chose' : ': --init passes SIGTERM on to sleep, which dies of that signal (128 + 15)'}`
        : st === 'exited' && code !== null
          ? `The container ended with exit code ${code}`
          : 'Press a command that is enabled to go to the next state',
    caption: 'The times and exit codes of docker stop come from exercise 03 (-t 5, measured; the program that handles SIGTERM is Python with a signal handler). The order created, running, paused, running, exited, running, exited and removed is the order the exercise ran for real.',
  },
};

const BOXES: [St, number, number][] = [['created', 14, 24], ['running', 236, 24], ['exited', 458, 24], ['removed', 680, 24], ['paused', 236, 132]];

export default function LifecycleLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [prog, setProg] = useState<Prog>(0);
  const [st, setSt] = useState<St>('none');
  const [seen, setSeen] = useState<St[]>([]);
  const [last, setLast] = useState<{ code: number | null; secs: number | null }>({ code: null, secs: null });
  const press = (c: Cmd) => {
    const to = NEXT[st][c];
    if (!to) return;
    let code = last.code;
    let secs = last.secs;
    if (c === 'stop') { code = STOPS[prog].exitCode; secs = STOPS[prog].seconds; }
    if (c === 'kill') { code = 137; secs = 0; }
    if (c === 'ends') { code = 0; secs = null; }
    if (to === 'running') { code = null; secs = null; }
    setLast({ code, secs });
    setSt(to);
    setSeen((s) => (s.includes(to) ? s : [...s, to]));
  };
  const reset = () => { setSt('none'); setSeen([]); setLast({ code: null, secs: null }); };
  const cmds = Object.keys(T.cmds) as Cmd[];
  const timeX = (s: number) => 40 + (s / GRACE) * 740;
  const ended = st === 'exited' && last.secs !== null ? last.secs : null;
  const killed = ended !== null && ended >= GRACE - 0.3;
  const dot = st === 'running' || st === 'paused';
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.prog}</span>
        <span className="seg" role="group" aria-label={T.prog}>
          {T.progs.map((p, i) => (
            <button key={p} type="button" aria-pressed={prog === i} onClick={() => setProg(i as Prog)}>{p}</button>
          ))}
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 410" role="img" aria-label={T.title}>
          {BOXES.map(([s, x, y]) => {
            const now = st === s;
            const cls = now ? 'ib-new' : seen.includes(s) ? 'ib-use' : 'ib-skip';
            return (
              <g key={s}>
                <rect className={cls} x={x} y={y} width={186} height={72} rx={10} />
                <text x={x + 93} y={y + 32} textAnchor="middle" className="ib-n">{T.states[s][0]}</text>
                <text x={x + 93} y={y + 56} textAnchor="middle" className="ib-m">{T.states[s][1]}</text>
              </g>
            );
          })}
          <path className="ib-line" d="M200,60 L236,60" />
          <text x={218} y={16} textAnchor="middle" className="ib-s">start</text>
          <path className="ib-line" d="M422,60 L458,60" />
          <text x={440} y={16} textAnchor="middle" className="ib-s">stop · kill</text>
          <path className="ib-line" d="M644,60 L680,60" />
          <text x={662} y={16} textAnchor="middle" className="ib-s">rm</text>
          <path className="ib-line" d="M276,96 L276,128" />
          <text x={268} y={118} textAnchor="end" className="ib-s">pause</text>
          <path className="ib-line" d="M346,128 L346,96" />
          <text x={354} y={118} className="ib-s">unpause</text>
          {/* the container and its process */}
          <rect className="ib-node" x={458} y={124} width={408} height={116} rx={12} />
          <text x={474} y={150} className="ib-n">Container</text>
          <text x={560} y={150} className="ib-m">{T.progs[prog]}</text>
          {st !== 'none' && st !== 'removed' && (
            <g>
              <circle cx={512} cy={190} r={20} className={dot ? 'ib-new' : 'ib-skip'} style={st === 'paused' ? { strokeDasharray: '3 4' } : undefined} />
              <text x={512} y={195} textAnchor="middle" className="ib-s" style={{ fill: 'var(--fg)' }}>{dot ? 'PID 1' : '·'}</text>
            </g>
          )}
          <text x={620} y={168} className="ib-s">{T.code}</text>
          <text x={620} y={206} className="ib-big" style={{ fontSize: 30 }}>{st === 'exited' && last.code !== null ? last.code : '·'}</text>
          <text x={474} y={228} className="ib-s">{T.process[st]}</text>
          {/* the clock of docker stop */}
          <text x={14} y={278} className="ib-layer">{T.clock}</text>
          <line x1={40} y1={316} x2={780} y2={316} className="ib-line" style={{ strokeWidth: 6 }} />
          <circle cx={timeX(0)} cy={316} r={8} className="ib-badge" />
          <text x={timeX(0) - 12} y={344} textAnchor="start" className="ib-s">{`0 ${T.s}: ${T.term}`}</text>
          <circle cx={timeX(GRACE)} cy={316} r={8} style={{ fill: 'var(--ib-bad)' }} />
          <text x={timeX(GRACE) + 14} y={344} textAnchor="end" className="ib-s">{`${GRACE} ${T.s}: ${T.kill}`}</text>
          {ended !== null && ended > 0 && (
            <g>
              <path className={killed ? 'ib-arrow-bad' : 'ib-arrow'} d={`M${timeX(0)},316 L${timeX(Math.min(ended, GRACE))},316`} />
              <rect className="ib-banner" x={Math.min(Math.max(timeX(Math.min(ended, GRACE)) - 110, 14), 650)} y={362} width={220} height={36} rx={9} />
              <text x={Math.min(Math.max(timeX(Math.min(ended, GRACE)), 124), 760)} y={386} textAnchor="middle" className="ib-n">{`${T.ended}: ${ended} ${T.s}`}</text>
            </g>
          )}
        </svg>
      </div>
      <div className="lab-controls">
        {cmds.map((c) => (
          <button key={c} type="button" className="btn sm" disabled={!NEXT[st][c]} onClick={() => press(c)}>{T.cmds[c]}</button>
        ))}
        <button type="button" className="btn sm" onClick={reset}>{T.again}</button>
      </div>
      <div className="readout" aria-live="polite"><div>{T.readout(st, last.code, last.secs, prog)}</div></div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
