import { useState } from 'react';
import type { Lang } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import data from './layers.json';

// Shows:      one image, then two images, built on the same base. Every layer is drawn as a box with its real id (the first 12 digits of its sha256).
//             The base box is drawn once and both images point at it, and the counter shows the size actually stored against the size the two images
//             would take if they were separate copies.
// Because:    "layers are shared" is a statement about identity. Two images look like two stacks of the same size, and only the repeated id shows that
//             one box is the same box.
// Control:    which images are installed (the first only, or both).
// Conclusion: Docker stores a layer once, and an image only costs what its own layers add.
//
// Ids and sizes come from exercises/02_images_layers.py --write (layers.json). Sizes are the uncompressed sizes that docker image inspect reports.

const A1 = data.apps['dlab-app1'];
const A2 = data.apps['dlab-app2'];
const ID = data.layerIds;
const BASE = data.baseMb;

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; installed: string; one: string; both: string; layer: string; base: string;
  stored: string; separate: string; saved: string; mb: string; own: string; readout: (n: number, stored: number, sep: number) => string; caption: string;
}> = {
  th: {
    title: 'เลือกว่าติดตั้ง Image กี่ตัว แล้วดูว่า Layer ฐานของ Alpine ถูกเก็บกี่ชุด',
    legend: [{ kind: 'new', text: 'Layer ของ Image ตัวนั้นเอง' }, { kind: 'use', text: 'Layer ที่ใช้ร่วมกัน' }, { kind: 'skip', text: 'ยังไม่ได้ติดตั้ง' }],
    installed: 'ติดตั้งแล้ว',
    one: 'dlab-app1 ตัวเดียว',
    both: 'dlab-app1 และ dlab-app2',
    layer: 'Layer',
    base: 'Alpine (ฐาน)',
    stored: 'เก็บบนดิสก์จริง',
    separate: 'ถ้าแยกเก็บตัวใครตัวมัน',
    saved: 'ประหยัด',
    mb: 'MB',
    own: 'ส่วนของตัวเอง',
    readout: (n, st, sep) => (n === 1 ? `มี Image ตัวเดียว จึงเก็บ ${st.toFixed(1)} MB ไม่มีอะไรให้ใช้ร่วม` : `Image สองตัวใช้ Layer ฐานเดียวกัน จึงเก็บแค่ ${st.toFixed(1)} MB แทนที่จะเป็น ${sep.toFixed(1)} MB`),
    caption: 'ID ของ Layer (12 หลักแรกของ sha256) และขนาดมาจากแบบฝึก 02 ขนาดเป็นขนาดที่แตกไฟล์แล้วตามที่ docker image inspect บอก ตัวเลขที่เก็บจริงคือฐานบวกส่วนของแต่ละ Image ซึ่งคำนวณจากตัวเลขเหล่านั้น',
  },
  en: {
    title: 'Choose how many images are installed and see how many copies of the Alpine base layer are stored',
    legend: [{ kind: 'new', text: "the image's own layer" }, { kind: 'use', text: 'a shared layer' }, { kind: 'skip', text: 'not installed yet' }],
    installed: 'installed',
    one: 'dlab-app1 only',
    both: 'dlab-app1 and dlab-app2',
    layer: 'layer',
    base: 'Alpine (base)',
    stored: 'really stored on disk',
    separate: 'if each kept its own copy',
    saved: 'saved',
    mb: 'MB',
    own: 'its own part',
    readout: (n, st, sep) => (n === 1 ? `With one image we store ${st.toFixed(1)} MB and nothing is shared yet.` : `Two images share one base layer, so we store only ${st.toFixed(1)} MB instead of ${sep.toFixed(1)} MB.`),
    caption: 'The layer ids (first 12 digits of the sha256) and the sizes come from exercise 02. Sizes are the unpacked sizes reported by docker image inspect. The stored figure is the base plus each image\'s own part, calculated from those numbers.',
  },
};

export default function SharedLayersLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [n, setN] = useState<1 | 2>(2);
  const stored = BASE + A1.ownMb + (n === 2 ? A2.ownMb : 0);
  const separate = A1.mb + (n === 2 ? A2.mb : 0);
  const BW = 250;
  const col = (i: number) => 14 + i * 270;
  const baseX = n === 2 ? 14 + 135 : 14;
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.installed}</span>
        <span className="seg" role="group" aria-label={T.installed}>
          <button type="button" aria-pressed={n === 1} onClick={() => setN(1)}>{T.one}</button>
          <button type="button" aria-pressed={n === 2} onClick={() => setN(2)}>{T.both}</button>
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 330" role="img" aria-label={T.title}>
          {/* own layers on top */}
          {[{ name: 'dlab-app1', id: ID.app1, own: A1.ownMb }, { name: 'dlab-app2', id: ID.app2, own: A2.ownMb }].map((a, i) => {
            const on = i === 0 || n === 2;
            const x = col(i);
            return (
              <g key={a.name} style={on ? undefined : { opacity: 0.5 }}>
                <text x={x} y={26} className="ib-t">{a.name}</text>
                <rect className={on ? 'ib-new' : 'ib-skip'} x={x} y={40} width={BW} height={78} rx={10} />
                <text x={x + 14} y={68} className="ib-n">{`${T.layer} 2 · ${T.own}`}</text>
                <text x={x + 14} y={92} className="ib-m">{`sha256:${a.id}…`}</text>
                <text x={x + 14} y={110} className="ib-s">{`${a.own.toFixed(1)} ${T.mb}`}</text>
                <path className="ib-arrow" d={`M${x + BW / 2},118 L${on ? Math.min(Math.max(x + BW / 2, baseX + 40), baseX + BW - 40) : x + BW / 2},${on ? 160 : 118}`} style={on ? undefined : { opacity: 0 }} />
              </g>
            );
          })}
          {/* the base, drawn once */}
          <rect className="ib-use" x={baseX} y={160} width={BW} height={78} rx={10} />
          <text x={baseX + 14} y={188} className="ib-n">{`${T.layer} 1 · ${T.base}`}</text>
          <text x={baseX + 14} y={212} className="ib-m">{`sha256:${ID.alpine}…`}</text>
          <text x={baseX + 14} y={230} className="ib-s">{`${BASE.toFixed(1)} ${T.mb}`}</text>
          {n === 2 && (
            <g>
              <rect className="ib-badge" x={baseX + BW - 112} y={146} width={106} height={22} rx={11} />
              <text x={baseX + BW - 59} y={162} className="ib-white">{lang === 'th' ? 'ใช้ร่วม 2 Image' : 'shared by 2'}</text>
            </g>
          )}
          {/* the counters */}
          <rect className="ib-zone" x={14} y={262} width={852} height={56} rx={10} />
          <text x={28} y={286} className="ib-s">{T.stored}</text>
          <text x={28} y={308} className="ib-n ib-acc" style={{ fontSize: 22 }}>{`${stored.toFixed(1)} ${T.mb}`}</text>
          <text x={320} y={286} className="ib-s">{T.separate}</text>
          <text x={320} y={308} className="ib-n" style={{ fontSize: 22 }}>{`${separate.toFixed(1)} ${T.mb}`}</text>
          <text x={620} y={286} className="ib-s">{T.saved}</text>
          <text x={620} y={308} className="ib-n ib-ok" style={{ fontSize: 22 }}>{`${(separate - stored).toFixed(1)} ${T.mb}`}</text>
        </svg>
      </div>
      <div className="readout" aria-live="polite"><div>{T.readout(n, stored, separate)}</div></div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
