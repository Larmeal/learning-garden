import { useState } from 'react';
import type { Lang } from '../spark/timeline';
import { Legend } from '../iceberg/ib';

// Shows:      the same N programs run two ways. As N virtual machines, each program sits on its own guest operating system with its own kernel.
//             As N containers, each program sits on its own set of files, and all of them sit on one kernel.
// Because:    the difference is a stack of boxes. A sentence says "a container shares the kernel"; the picture shows N kernels turn into 1.
// Control:    the number of programs (1 to 4).
// Conclusion: a container carries the files of a program and no kernel, so the cost of one more container is a process, not another operating system.
//
// Nothing here is measured: it is the structure that Docker in Action section 1.1.3 describes. The lesson never claims a start-up time or a memory size for a VM,
// because exercise 01 only measured containers.

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[]; count: string; vm: string; ct: string; hw: string; hyper: string;
  guest: string; app: string; files: string; engine: string; kernel: string; kernels: string; readout: (n: number) => string; caption: string;
}> = {
  th: {
    title: 'เลือกจำนวนโปรแกรมที่จะรัน แล้วดูว่าฝั่ง Virtual Machine กับฝั่ง Container ต้องมี Kernel กี่ตัว',
    legend: [{ kind: 'new', text: 'Kernel (ระบบปฏิบัติการ)' }, { kind: 'use', text: 'โปรแกรมกับไฟล์ของมัน' }, { kind: 'node', text: 'ของที่ใช้ร่วมกัน' }],
    count: 'จำนวนโปรแกรม',
    vm: 'Virtual Machine',
    ct: 'Container',
    hw: 'ฮาร์ดแวร์ของคอมพิวเตอร์',
    hyper: 'Hypervisor (สร้างฮาร์ดแวร์จำลอง)',
    guest: 'Kernel ของตัวเอง',
    app: 'โปรแกรม',
    files: 'ไฟล์ของ Image',
    engine: 'Docker Engine',
    kernel: 'Kernel ของ Linux ตัวเดียว',
    kernels: 'Kernel',
    readout: (n) => `โปรแกรม ${n} ตัวบน Virtual Machine ต้องบูต Kernel ${n} ตัว ส่วนบน Container ใช้ Kernel เดิมตัวเดียว ${n === 1 ? 'เท่ากันตอนมีโปรแกรมเดียว แต่ลองกดเพิ่มดู' : 'ที่เหลือคือ Process ธรรมดา'}`,
    caption: 'ภาพนี้เป็นโครงสร้างจากหนังสือ Docker in Action หัวข้อ 1.1.3 หน้า 5 ไม่มีตัวเลขที่วัดได้ ในแบบฝึกเราวัดแค่ฝั่ง Container จึงไม่ได้เทียบเวลาบูตหรือขนาด Memory กับ Virtual Machine',
  },
  en: {
    title: 'Choose how many programs to run, and see how many kernels the virtual machine side and the container side need',
    legend: [{ kind: 'new', text: 'a kernel (operating system)' }, { kind: 'use', text: 'a program and its files' }, { kind: 'node', text: 'shared' }],
    count: 'programs',
    vm: 'Virtual machines',
    ct: 'Containers',
    hw: 'hardware of the computer',
    hyper: 'hypervisor (makes virtual hardware)',
    guest: 'its own kernel',
    app: 'program',
    files: 'image files',
    engine: 'Docker engine',
    kernel: 'One Linux kernel',
    kernels: 'kernels',
    readout: (n) => `${n} program${n === 1 ? '' : 's'} on virtual machines need${n === 1 ? 's' : ''} ${n} kernel${n === 1 ? '' : 's'} booted. On containers they share the one kernel that is already there${n === 1 ? ', so one program shows no difference yet, press a bigger number' : ''}.`,
    caption: 'This is the structure described in Docker in Action section 1.1.3, page 5. Nothing is measured: the exercise only measured the container side, so no boot time or memory size of a virtual machine is claimed.',
  },
};

export default function KernelStackLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [n, setN] = useState(3);
  const colW = 420;
  const gap = 10;
  const w = (colW - gap * (n - 1)) / n;
  const Col = ({ x0, vm }: { x0: number; vm: boolean }) => (
    <g>
      <text x={x0} y={26} className="ib-t">{vm ? T.vm : T.ct}</text>
      <text x={x0 + colW} y={36} textAnchor="end" className="ib-big ib-acc">{vm ? n : 1}</text>
      <text x={x0 + colW} y={58} textAnchor="end" className="ib-s">{T.kernels}</text>
      {Array.from({ length: n }, (_, i) => {
        const x = x0 + i * (w + gap);
        return vm ? (
          <g key={i}>
            <rect className="ib-use" x={x} y={96} width={w} height={64} rx={9} />
            <text x={x + w / 2} y={133} textAnchor="middle" className="ib-n">{`${T.app} ${i + 1}`}</text>
            <rect className="ib-new" x={x} y={170} width={w} height={86} rx={9} />
            <text x={x + w / 2} y={206} textAnchor="middle" className="ib-n">Kernel</text>
            <text x={x + w / 2} y={232} textAnchor="middle" className="ib-s">{T.guest}</text>
          </g>
        ) : (
          <g key={i}>
            <rect className="ib-use" x={x} y={96} width={w} height={64} rx={9} />
            <text x={x + w / 2} y={125} textAnchor="middle" className="ib-n">{`${T.app} ${i + 1}`}</text>
            <text x={x + w / 2} y={148} textAnchor="middle" className="ib-s">{T.files}</text>
          </g>
        );
      })}
      {vm ? (
        <g>
          <rect className="ib-node" x={x0} y={270} width={colW} height={44} rx={9} />
          <text x={x0 + 14} y={298} className="ib-n">{T.hyper}</text>
        </g>
      ) : (
        <g>
          <rect className="ib-node" x={x0} y={170} width={colW} height={44} rx={9} />
          <text x={x0 + 14} y={198} className="ib-n">{T.engine}</text>
          <rect className="ib-new" x={x0} y={222} width={colW} height={92} rx={9} />
          <text x={x0 + 14} y={262} className="ib-n">{T.kernel}</text>
          <text x={x0 + 14} y={286} className="ib-s">{n} {T.app}</text>
        </g>
      )}
      <rect className="ib-node" x={x0} y={324} width={colW} height={44} rx={9} />
      <text x={x0 + 14} y={352} className="ib-n">{T.hw}</text>
    </g>
  );
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.count}</span>
        <span className="seg" role="group" aria-label={T.count}>
          {[1, 2, 3, 4].map((k) => (
            <button key={k} type="button" aria-pressed={n === k} onClick={() => setN(k)}>{k}</button>
          ))}
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 390" role="img" aria-label={T.title}>
          <Col x0={8} vm />
          <Col x0={452} vm={false} />
        </svg>
      </div>
      <div className="readout" aria-live="polite"><div>{T.readout(n)}</div></div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
