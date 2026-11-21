import { useState } from 'react';
import type { Lang } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import data from './volumes.json';

// Shows:      one container with a folder /place, and the place that folder is stored in (its own writable layer, a named volume, a folder of our computer, or memory).
//             Press write, then restart, then remove the container: a new container appears and the file is there or it is not, depending on where it lived.
// Because:    "which storage outlives what" is about where the file sits relative to the container box. In a table it is a row of ticks. In the picture the file is
//             inside the container that is thrown away, or outside it, in the box that stays.
// Control:    the storage (four kinds) and the three events (write the file, restart, remove the container and start a new one).
// Conclusion: only data that lives outside the container (a volume or a bind mount) outlives the removal of the container, and only a place that is not memory survives a restart.
//
// What survives what comes from exercises/07_volumes.py --write (volumes.json): each cell is a real docker run, restart and rm.

type Kind = 'layer' | 'volume' | 'bind' | 'tmpfs';
const KINDS: Kind[] = ['layer', 'volume', 'bind', 'tmpfs'];
const M = data.matrix;

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; storage: string; kinds: Record<Kind, string>; where: Record<Kind, [string, string]>; events: { write: string; restart: string; rm: string; again: string };
  container: string; file: string; empty: string; readout: (k: Kind, last: 'none' | 'write' | 'restart' | 'rm', present: boolean, gen: number) => string; caption: string;
}> = {
  th: {
    title: 'เลือกที่เก็บข้อมูล แล้วกดเขียนไฟล์ รีสตาร์ท และลบ Container ตามลำดับ ดูว่าไฟล์ยังอยู่ใน Container ตัวใหม่หรือไม่',
    legend: [{ kind: 'new', text: 'ไฟล์ที่เพิ่งเปลี่ยน' }, { kind: 'use', text: 'ไฟล์ที่ยังอยู่' }, { kind: 'skip', text: 'ที่ว่าง' }],
    storage: 'ที่เก็บ',
    kinds: { layer: 'ชั้นเขียนของ Container', volume: 'Volume ที่มีชื่อ', bind: 'Bind Mount', tmpfs: 'tmpfs (หน่วยความจำ)' },
    where: {
      layer: ['ชั้นเขียนของ Container', 'อยู่ข้างใน Container ตัวนั้น'],
      volume: ['Volume ที่ Docker เก็บให้', 'อยู่นอก Container'],
      bind: ['โฟลเดอร์บนคอมพิวเตอร์ของเรา', 'อยู่นอก Container'],
      tmpfs: ['หน่วยความจำ', 'อยู่ข้างใน Container ตัวนั้น'],
    },
    events: { write: 'เขียน note.txt', restart: 'docker restart', rm: 'ลบ Container แล้วสร้างตัวใหม่', again: 'เริ่มใหม่' },
    container: 'Container ตัวที่',
    file: 'note.txt',
    empty: 'ว่างเปล่า',
    readout: (k, last, present, gen) => {
      if (last === 'none') return 'เริ่มจาก Container ตัวที่ 1 ที่ยังไม่มีไฟล์ กดเขียน note.txt ก่อน';
      if (last === 'write') return 'เขียนไฟล์แล้ว ลองกดรีสตาร์ท หรือลบ Container ดู';
      if (last === 'restart') return present ? 'หลังรีสตาร์ท ไฟล์ยังอยู่' : 'หลังรีสตาร์ท ไฟล์หายไปแล้ว เพราะที่เก็บเป็นหน่วยความจำ';
      return present ? `Container ตัวที่ ${gen} เริ่มใหม่และยังเห็นไฟล์ เพราะไฟล์อยู่นอก Container` : `Container ตัวที่ ${gen} เริ่มใหม่และไม่เห็นไฟล์ เพราะไฟล์อยู่ข้างใน Container ตัวเก่าที่ถูกลบไปแล้ว`;
    },
    caption: 'ผลของทุกช่องมาจากแบบฝึก 07 (รัน Container, เขียนไฟล์, docker restart, docker rm แล้วเริ่มตัวใหม่บนที่เก็บเดียวกันจริง ๆ) ในเครื่องนี้ Bind Mount ชี้ไปที่โฟลเดอร์บน Windows และ Volume อยู่ใน Linux ที่ Docker Desktop เปิดไว้',
  },
  en: {
    title: 'Choose a storage, then press write file, restart and remove container in order, and see whether the file is still there in the new container',
    legend: [{ kind: 'new', text: 'the file that just changed' }, { kind: 'use', text: 'the file that is still there' }, { kind: 'skip', text: 'empty' }],
    storage: 'storage',
    kinds: { layer: "the container's own layer", volume: 'named volume', bind: 'bind mount', tmpfs: 'tmpfs (memory)' },
    where: {
      layer: ['writable layer of the container', 'inside that container'],
      volume: ['volume kept by Docker', 'outside the container'],
      bind: ['a folder on our computer', 'outside the container'],
      tmpfs: ['memory', 'inside that container'],
    },
    events: { write: 'write note.txt', restart: 'docker restart', rm: 'remove the container, start a new one', again: 'start over' },
    container: 'Container no.',
    file: 'note.txt',
    empty: 'empty',
    readout: (k, last, present, gen) => {
      if (last === 'none') return 'We start with container 1, which has no file. Press write note.txt first.';
      if (last === 'write') return 'The file is written. Now try restart, or remove the container.';
      if (last === 'restart') return present ? 'After the restart the file is still there.' : 'After the restart the file is gone, because the storage is memory.';
      return present ? `Container ${gen} starts fresh and still sees the file, because the file lives outside the container.` : `Container ${gen} starts fresh and does not see the file, because it lived inside the old container that was removed.`;
    },
    caption: 'The result of every cell comes from exercise 07 (a real container, a written file, docker restart, docker rm and a new container on the same storage). On this computer the bind mount points at a folder on Windows and the volume lives in the Linux that Docker Desktop starts.',
  },
};

export default function VolumeLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [kind, setKind] = useState<Kind>('volume');
  const [present, setPresent] = useState(false);
  const [gen, setGen] = useState(1);
  const [last, setLast] = useState<'none' | 'write' | 'restart' | 'rm'>('none');
  const [changed, setChanged] = useState(false);
  const reset = (k: Kind) => { setKind(k); setPresent(false); setGen(1); setLast('none'); setChanged(false); };
  const write = () => { setPresent(true); setLast('write'); setChanged(true); };
  const restart = () => { setPresent(present && M[kind].restart); setLast('restart'); setChanged(false); };
  const remove = () => { setPresent(present && M[kind].removed); setGen(gen + 1); setLast('rm'); setChanged(false); };
  const inside = kind === 'layer' || kind === 'tmpfs';
  const fileBox = (x: number, y: number) => (
    <g>
      <rect className={changed ? 'ib-new' : 'ib-use'} x={x} y={y} width={150} height={40} rx={8} />
      <text x={x + 14} y={y + 26} className="ib-m" style={{ fontSize: 15, fill: 'var(--fg)' }}>{T.file}</text>
    </g>
  );
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.storage}</span>
        <span className="seg" role="group" aria-label={T.storage}>
          {KINDS.map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => reset(k)}>{T.kinds[k]}</button>
          ))}
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 330" role="img" aria-label={T.title}>
          <rect className="ib-use" x={14} y={20} width={400} height={270} rx={12} />
          <text x={30} y={50} className="ib-n">{`${T.container} ${gen}`}</text>
          <text x={30} y={72} className="ib-m">/place</text>
          <rect className="ib-skip" x={30} y={92} width={368} height={inside ? 170 : 80} rx={9} />
          <text x={44} y={118} className="ib-s">{inside ? T.where[kind][0] : '/place'}</text>
          {inside && present && fileBox(44, 134)}
          {inside && !present && <text x={44} y={170} className="ib-s">{T.empty}</text>}
          {!inside && (
            <g>
              <path className="ib-arrow" d="M398,132 L470,132" />
              <rect className={present ? 'ib-use' : 'ib-skip'} x={470} y={50} width={396} height={170} rx={12} />
              <text x={486} y={82} className="ib-n">{T.where[kind][0]}</text>
              <text x={486} y={104} className="ib-s">{T.where[kind][1]}</text>
              {present ? fileBox(486, 128) : <text x={486} y={156} className="ib-s">{T.empty}</text>}
            </g>
          )}
          <text x={30} y={316} className="ib-s">{`${T.kinds[kind]} · ${T.where[kind][1]}`}</text>
        </svg>
      </div>
      <div className="lab-controls">
        <button type="button" className="btn sm" onClick={write}>{T.events.write}</button>
        <button type="button" className="btn sm" onClick={restart}>{T.events.restart}</button>
        <button type="button" className="btn sm" onClick={remove}>{T.events.rm}</button>
        <button type="button" className="btn sm" onClick={() => reset(kind)}>{T.events.again}</button>
      </div>
      <div className="readout" aria-live="polite"><div>{T.readout(kind, last, present, gen)}</div></div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
