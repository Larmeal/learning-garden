import { useState } from 'react';
import type { Lang } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import data from './kernel.json';

// Shows:      a program that takes 10 MB of memory at a time, and another that spins on one CPU. Choose a memory limit and a CPU limit. The memory ladder fills up
//             to the step where the program was killed (or to the top), and the CPU strip shows how many of the slots of each 100 ms the program was allowed to run.
// Because:    cgroups limit how much, and "how much" is a picture of a level that rises to a line, or of slots that are taken away. The two ways of running out
//             (killed at once, or slowed down) are different, and a table of numbers hides that difference.
// Control:    the memory limit (none, 256m, 64m, 32m) and the CPU limit (none, 1, 0.5, 0.25).
// Conclusion: running out of memory kills the process (exit code 137), running out of CPU only makes it wait.
//
// All numbers come from exercises/10_namespaces_cgroups.py --write (kernel.json): a real Python program in a real container under each limit.

type Mem = 'no limit' | '256m' | '64m' | '32m';
type Cpu = 'no limit' | '--cpus 1' | '--cpus 0.5' | '--cpus 0.25';
const MEMS: Mem[] = ['no limit', '256m', '64m', '32m'];
const CPUS: Cpu[] = ['no limit', '--cpus 1', '--cpus 0.5', '--cpus 0.25'];
const LIMIT_MB: Record<Mem, number | null> = { 'no limit': null, '256m': 256, '64m': 64, '32m': 32 };

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; mem: string; cpu: string; memNames: Record<Mem, string>; cpuNames: Record<Cpu, string>; memTitle: string; cpuTitle: string;
  killed: string; finished: string; limit: string; slot: string; run: string; wait: string; share: string; throttled: string; readout: (m: Mem, killed: boolean, mb: number, c: Cpu, share: number) => string; caption: string;
}> = {
  th: {
    title: 'เลือกขีดจำกัด Memory กับ CPU ของ Container แล้วดูว่าโปรแกรมที่กินทรัพยากรไปได้ไกลแค่ไหน และถูกฆ่าหรือแค่ช้าลง',
    legend: [{ kind: 'new', text: 'ได้ใช้แล้ว' }, { kind: 'skip', text: 'ไม่ได้ใช้ (ถูกฆ่าก่อน หรือถูกพักไว้)' }, { kind: 'use', text: 'ว่างรอ' }],
    mem: 'ขีดจำกัด Memory',
    cpu: 'ขีดจำกัด CPU',
    memNames: { 'no limit': 'ไม่จำกัด', '256m': '256 MB', '64m': '64 MB', '32m': '32 MB' },
    cpuNames: { 'no limit': 'ไม่จำกัด', '--cpus 1': '1 CPU', '--cpus 0.5': 'ครึ่ง CPU', '--cpus 0.25': 'หนึ่งในสี่ CPU' },
    memTitle: 'Memory: โปรแกรมขอทีละ 10 MB จนถึง 120 MB',
    cpuTitle: 'CPU: ในทุก 100 มิลลิวินาที โปรแกรมได้รันกี่ช่อง',
    killed: 'ถูกฆ่า (OOMKilled, Exit Code 137)',
    finished: 'ทำงานจบ',
    limit: 'ขีดจำกัด',
    slot: 'ช่อง',
    run: 'ได้รัน',
    wait: 'ถูกพัก',
    share: 'เวลา CPU ต่อเวลาจริง',
    throttled: 'ครั้งที่ถูกพัก',
    readout: (m, k, mb, c, s) => `${k ? `โปรแกรมไปได้ถึง ${mb} MB แล้วถูกฆ่า` : 'โปรแกรมกิน Memory ถึง 120 MB และจบเอง'} ส่วน CPU ที่ได้คือ ${s} ของหนึ่ง CPU${c === 'no limit' || c === '--cpus 1' ? '' : ' โปรแกรมไม่ตาย แค่ถูกพักเป็นช่วง ๆ'}`,
    caption: 'ผลทุกช่องมาจากแบบฝึก 10 (โปรแกรม Python จริงใน Container จริง ตั้ง --memory กับ --memory-swap เท่ากันเพื่อไม่ให้ใช้ Swap และตั้ง --cpus) CPU วัดจากเวลา CPU ที่โปรแกรมใช้ต่อเวลาจริง 2.5 วินาที',
  },
  en: {
    title: 'Choose a memory limit and a CPU limit for the container and see how far a program that eats resources gets, and whether it is killed or only slowed down',
    legend: [{ kind: 'new', text: 'it got to use' }, { kind: 'skip', text: 'it did not get (killed first, or paused)' }, { kind: 'use', text: 'free, waiting' }],
    mem: 'memory limit',
    cpu: 'CPU limit',
    memNames: { 'no limit': 'no limit', '256m': '256 MB', '64m': '64 MB', '32m': '32 MB' },
    cpuNames: { 'no limit': 'no limit', '--cpus 1': '1 CPU', '--cpus 0.5': 'half a CPU', '--cpus 0.25': 'a quarter CPU' },
    memTitle: 'Memory: the program asks for 10 MB at a time up to 120 MB',
    cpuTitle: 'CPU: in every 100 milliseconds, how many slots the program ran',
    killed: 'killed (OOMKilled, exit code 137)',
    finished: 'finished its work',
    limit: 'limit',
    slot: 'slot',
    run: 'ran',
    wait: 'paused',
    share: 'CPU time per real time',
    throttled: 'times it was paused',
    readout: (m, k, mb, c, s) => `${k ? `The program got as far as ${mb} MB and was killed.` : 'The program took 120 MB of memory and finished by itself.'} The CPU it got was ${s} of one CPU${c === 'no limit' || c === '--cpus 1' ? '.' : '. It did not die, it was only paused in turns.'}`,
    caption: 'Every cell comes from exercise 10 (a real Python program in a real container, with --memory and --memory-swap equal so that it could not use swap, and with --cpus). CPU is measured as the CPU time the program used per 2.5 seconds of real time.',
  },
};

export default function CgroupLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [mem, setMem] = useState<Mem>('64m');
  const [cpu, setCpu] = useState<Cpu>('--cpus 0.5');
  const m = data.memory[mem];
  const c = data.cpu[cpu];
  const steps = 12;
  const lim = LIMIT_MB[mem];
  const slotsRun = Math.max(0, Math.min(10, Math.round(c.share * 10)));
  const stepW = 40;
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.mem}</span>
        <span className="seg" role="group" aria-label={T.mem}>
          {MEMS.map((k) => (
            <button key={k} type="button" aria-pressed={mem === k} onClick={() => setMem(k)}>{T.memNames[k]}</button>
          ))}
        </span>
      </div>
      <div className="ib-controls">
        <span className="ib-lbl">{T.cpu}</span>
        <span className="seg" role="group" aria-label={T.cpu}>
          {CPUS.map((k) => (
            <button key={k} type="button" aria-pressed={cpu === k} onClick={() => setCpu(k)}>{T.cpuNames[k]}</button>
          ))}
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 340" role="img" aria-label={T.title}>
          <text x={14} y={24} className="ib-t">{T.memTitle}</text>
          {Array.from({ length: steps }, (_, i) => {
            const mb = (i + 1) * 10;
            const reached = mb <= m.reachedMb;
            const x = 14 + i * (stepW + 10);
            return (
              <g key={mb}>
                <rect className={reached ? 'ib-new' : 'ib-skip'} x={x} y={44} width={stepW} height={64} rx={7} />
                <text x={x + stepW / 2} y={82} textAnchor="middle" className="ib-s" style={{ fill: 'var(--fg)', fontSize: 14 }}>{mb}</text>
              </g>
            );
          })}
          {lim !== null && lim <= 120 && (
            <g>
              <path className="ib-arrow-bad" d={`M${14 + Math.floor(lim / 10) * (stepW + 10) - 5},38 L${14 + Math.floor(lim / 10) * (stepW + 10) - 5},116`} />
              <text x={14 + Math.floor(lim / 10) * (stepW + 10) - 10} y={134} textAnchor="end" className="ib-s" style={{ fill: 'var(--ib-bad)' }}>{`${T.limit} ${lim} MB`}</text>
            </g>
          )}
          <text x={14} y={168} className="ib-n" style={{ fill: m.oomKilled ? 'var(--ib-bad)' : 'var(--accent)' }}>{m.oomKilled ? `✗ ${T.killed}` : `✓ ${T.finished}`}</text>
          <text x={14} y={216} className="ib-t">{T.cpuTitle}</text>
          {Array.from({ length: 10 }, (_, i) => (
            <rect key={i} className={i < slotsRun ? 'ib-new' : 'ib-skip'} x={14 + i * 66} y={228} width={58} height={44} rx={8} />
          ))}
          <text x={14} y={296} className="ib-s">{`${slotsRun} ${T.slot} ${T.run} · ${10 - slotsRun} ${T.slot} ${T.wait}`}</text>
          <text x={14} y={324} className="ib-n">{`${T.share}: ${c.share}   ·   ${T.throttled}: ${c.throttled}`}</text>
        </svg>
      </div>
      <div className="readout" aria-live="polite"><div>{T.readout(mem, m.oomKilled, m.reachedMb, cpu, c.share)}</div></div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
