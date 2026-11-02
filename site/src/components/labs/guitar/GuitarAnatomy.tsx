import { useState, type ReactNode } from 'react';
import { Pills } from '../../music/Controls';

// A flat schematic of an electric and an acoustic guitar. Pick a part to light it up and read what it does.
// The drawing is a diagram, not a scale model: the neck is drawn 17 frets long and the body shapes are simplified.

type Kind = 'electric' | 'acoustic';
interface Part {
  id: string;
  label: string;
  mean: string;
  shape: ReactNode;
}

const NUT = 110;
const END = 480; // where the neck meets the body
const fretX = (n: number) => NUT + ((END - NUT) * (1 - 2 ** (-n / 12))) / (1 - 2 ** (-17 / 12));
const STRING_Y = [112, 119.2, 126.4, 133.6, 140.8, 148];

const hi = { fill: 'var(--accent)', fillOpacity: 0.28, stroke: 'var(--accent)', strokeWidth: 3 } as const;

const common = (bridgeX: number): Part[] => [
  {
    id: 'headstock',
    label: 'headstock',
    mean: 'ส่วนหัว ติดลูกบิดสายและโลโก้ ปลายสายพันอยู่ที่นี่',
    shape: <rect x="14" y="92" width="92" height="76" rx="10" {...hi} />,
  },
  {
    id: 'tuners',
    label: 'tuning machines',
    mean: 'ลูกบิดตั้งสาย หมุนเพื่อขึงสายให้ตึงขึ้น (เสียงสูงขึ้น) หรือหย่อน (เสียงต่ำลง)',
    shape: (
      <>
        {[30, 54, 78].flatMap((x) => [86, 174].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="8" {...hi} />))}
      </>
    ),
  },
  {
    id: 'nut',
    label: 'nut',
    mean: 'แผ่นเล็กที่รองสายตรงปลายคอ กำหนดระยะห่างสายและจุดเริ่มต้นของส่วนที่สั่นได้ (เฟร็ต 0)',
    shape: <rect x={NUT - 3} y="102" width="9" height="58" {...hi} />,
  },
  {
    id: 'neck',
    label: 'neck + truss rod',
    mean: 'คอกีต้าร์ ข้างในมี truss rod แกนโลหะที่ปรับความโค้งของคอให้ต้านแรงดึงของสาย',
    shape: <polygon points={`${NUT},106 ${END},98 ${END},162 ${NUT},154`} {...hi} />,
  },
  {
    id: 'frets',
    label: 'fretboard + frets',
    mean: 'แผ่นไม้บนคอและลวดเฟร็ต แต่ละเฟร็ตทำให้สายสั้นลง เสียงสูงขึ้นครึ่งเสียง (semitone) ระยะเฟร็ตแคบลงเรื่อยๆ เพราะเป็นสัดส่วนคงที่',
    shape: (
      <>
        {Array.from({ length: 17 }, (_, i) => i + 1).map((n) => (
          <line key={n} x1={fretX(n)} x2={fretX(n)} y1={100} y2={160} stroke="var(--accent)" strokeWidth="4" />
        ))}
      </>
    ),
  },
  {
    id: 'inlays',
    label: 'inlay (position marker)',
    mean: 'จุดบอกตำแหน่ง ที่เฟร็ต 3 5 7 9 12 (สองจุด) 15 และ 17 ช่วยให้รู้ตำแหน่งโดยไม่ต้องนับ',
    shape: (
      <>
        {[3, 5, 7, 9, 15, 17].map((n) => <circle key={n} cx={(fretX(n - 1) + fretX(n)) / 2} cy={130} r="7" {...hi} />)}
        <circle cx={(fretX(11) + fretX(12)) / 2} cy={120} r="7" {...hi} />
        <circle cx={(fretX(11) + fretX(12)) / 2} cy={140} r="7" {...hi} />
      </>
    ),
  },
  {
    id: 'strings',
    label: 'strings',
    mean: 'หกสาย จากสาย 6 (หนาสุด เสียงต่ำสุด E) ถึงสาย 1 (บางสุด เสียงสูงสุด e) ความยาว ความตึง และความหนาตัดสินระดับเสียง',
    shape: (
      <>
        {STRING_Y.map((y) => <line key={y} x1={NUT} x2={bridgeX} y1={y} y2={y} stroke="var(--accent)" strokeWidth="3.5" />)}
      </>
    ),
  },
];

const electricParts = (): Part[] => [
  ...common(662),
  {
    id: 'pickups',
    label: 'pickups',
    mean: 'ขดลวดแม่เหล็กใต้สาย เปลี่ยนการสั่นของสายเป็นสัญญาณไฟฟ้า ตัวใกล้คอเสียงนุ่ม ตัวใกล้ bridge เสียงคมและแหลม',
    shape: (
      <>
        <rect x="518" y="94" width="18" height="72" rx="3" {...hi} />
        <rect x="596" y="94" width="18" height="72" rx="3" {...hi} />
      </>
    ),
  },
  {
    id: 'bridge',
    label: 'bridge + saddles',
    mean: 'ยึดปลายสายอีกด้านและกำหนดจุดสิ้นสุดของสายที่สั่น ระยะจากนัตถึง saddle คือ scale length ปรับ saddle เพื่อตั้ง intonation',
    shape: <rect x="650" y="100" width="22" height="60" rx="3" {...hi} />,
  },
  {
    id: 'controls',
    label: 'volume + tone knobs',
    mean: 'ปุ่ม volume ปรับความดัง ปุ่ม tone ตัดเสียงแหลม และมักมี selector สวิตช์เลือก pickup',
    shape: (
      <>
        <circle cx="628" cy="190" r="12" {...hi} />
        <circle cx="662" cy="195" r="12" {...hi} />
      </>
    ),
  },
  {
    id: 'body',
    label: 'body',
    mean: 'ตัวกีต้าร์ไฟฟ้าแบบ solid body เป็นไม้ตัน ที่ติด pickup, bridge และปุ่มควบคุม เสียงมาจาก pickup เป็นหลักมากกว่าตัวไม้',
    shape: <path d="M470,110 C500,60 520,40 560,42 C600,44 610,70 650,60 C700,50 740,80 740,130 C740,180 700,215 650,205 C610,195 600,220 560,218 C520,216 500,200 470,150 Z" {...hi} />,
  },
  {
    id: 'strap',
    label: 'strap button',
    mean: 'ปุ่มคล้องสายสะพาย ตัวหนึ่งที่ปลายตัว อีกตัวที่ด้านหลังหรือคอ',
    shape: <circle cx="728" cy="130" r="9" {...hi} />,
  },
];

const acousticParts = (): Part[] => [
  ...common(655),
  {
    id: 'soundhole',
    label: 'soundhole',
    mean: 'รูให้เสียงที่สั่นอยู่ในกล่องก้องออกมา ร่วมกับตัวกล่องทำหน้าที่ขยายเสียง (ไม่ต้องใช้ไฟฟ้า)',
    shape: <circle cx="548" cy="130" r="32" {...hi} />,
  },
  {
    id: 'top',
    label: 'body (top, back, sides)',
    mean: 'กล่องก้องเสียง หน้า (top) สั่นเป็นหลักและส่งเสียง ด้านหลังและด้านข้างสะท้อนเสียง ภายในมีโครงไม้ (bracing) ค้ำหน้า',
    shape: (
      <>
        <ellipse cx="540" cy="130" rx="70" ry="62" {...hi} />
        <ellipse cx="660" cy="130" rx="88" ry="90" {...hi} />
      </>
    ),
  },
  {
    id: 'bridge',
    label: 'bridge + saddle',
    mean: 'ยึดปลายสายบนหน้ากีต้าร์ส่งแรงสั่นเข้ากล่อง saddle (แท่งบางสีขาวหรือดำ) คือจุดที่สายสิ้นสุด',
    shape: <rect x="642" y="98" width="26" height="64" rx="4" {...hi} />,
  },
  {
    id: 'pickguard',
    label: 'pickguard',
    mean: 'แผ่นกันรอยจากปิ๊กบนหน้ากีต้าร์ข้างใต้สายเสียงต่ำ',
    shape: <path d="M582,160 C590,176 612,186 634,182 C622,166 604,158 582,160 Z" {...hi} />,
  },
];

const BASE_BODY: Record<Kind, ReactNode> = {
  electric: (
    <path d="M470,110 C500,60 520,40 560,42 C600,44 610,70 650,60 C700,50 740,80 740,130 C740,180 700,215 650,205 C610,195 600,220 560,218 C520,216 500,200 470,150 Z" fill="var(--surface-2)" stroke="var(--line-strong)" strokeWidth="2" />
  ),
  acoustic: (
    <>
      <ellipse cx="540" cy="130" rx="70" ry="62" fill="var(--line-strong)" />
      <ellipse cx="660" cy="130" rx="88" ry="90" fill="var(--line-strong)" />
      <ellipse cx="540" cy="130" rx="67" ry="59" fill="var(--surface-2)" />
      <ellipse cx="660" cy="130" rx="85" ry="87" fill="var(--surface-2)" />
      <circle cx="548" cy="130" r="30" fill="var(--bg)" stroke="var(--line-strong)" strokeWidth="2" />
      <rect x="642" y="98" width="26" height="64" rx="4" fill="var(--soil)" />
    </>
  ),
};

export default function GuitarAnatomy() {
  const [kind, setKind] = useState<Kind>('electric');
  const [pick, setPick] = useState('frets');
  const parts = kind === 'electric' ? electricParts() : acousticParts();
  const chosen = parts.find((p) => p.id === pick) ?? parts[0];
  const bridgeX = kind === 'electric' ? 662 : 655;

  const change = (k: Kind) => {
    setKind(k);
    if (!(k === 'electric' ? electricParts() : acousticParts()).some((p) => p.id === pick)) setPick('frets');
  };

  return (
    <figure className="viz">
      <div className="viz-title">ส่วนประกอบของกีต้าร์ กดชื่อส่วนเพื่อดู</div>
      <Pills<Kind> label="ชนิด" value={kind} onChange={change} options={[{ value: 'electric', text: 'electric (solid body)' }, { value: 'acoustic', text: 'acoustic (flattop)' }]} />
      <div className="viz-box">
        <svg viewBox="0 0 770 250" role="img" aria-label={`แผนภาพกีต้าร์ ${kind}, ส่วนที่เลือก: ${chosen.label}`}>
          {/* headstock and neck */}
          <rect x="14" y="92" width="92" height="76" rx="10" fill="var(--surface-2)" stroke="var(--line-strong)" strokeWidth="2" />
          {[30, 54, 78].flatMap((x) => [86, 174].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="6" fill="var(--muted)" />))}
          <polygon points={`${NUT},106 ${END},98 ${END},162 ${NUT},154`} fill="var(--soil-dark)" opacity="0.55" stroke="var(--line-strong)" strokeWidth="2" />
          {BASE_BODY[kind]}
          {kind === 'electric' && (
            <>
              <rect x="518" y="94" width="18" height="72" rx="3" fill="var(--fg)" opacity="0.8" />
              <rect x="596" y="94" width="18" height="72" rx="3" fill="var(--fg)" opacity="0.8" />
              <rect x="650" y="100" width="22" height="60" rx="3" fill="var(--muted)" />
              <circle cx="628" cy="190" r="10" fill="var(--muted)" />
              <circle cx="662" cy="195" r="10" fill="var(--muted)" />
              <circle cx="728" cy="130" r="6" fill="var(--muted)" />
            </>
          )}
          {Array.from({ length: 17 }, (_, i) => i + 1).map((n) => (
            <line key={n} x1={fretX(n)} x2={fretX(n)} y1={100} y2={160} stroke="var(--muted)" strokeWidth="1.5" />
          ))}
          <rect x={NUT - 3} y="102" width="9" height="58" fill="var(--fg)" />
          {STRING_Y.map((y, i) => <line key={y} x1={NUT} x2={bridgeX} y1={y} y2={y} stroke="var(--muted)" strokeWidth={0.8 + i * 0.35} />)}
          {/* highlight of the chosen part */}
          <g pointerEvents="none">{chosen.shape}</g>
          <text className="s" x="14" y="238">headstock</text>
          <text className="s" x={NUT + 130} y="238">neck</text>
          <text className="s" x="560" y="246">body</text>
        </svg>
      </div>
      <div className="viz-steps" role="group" aria-label="ส่วนประกอบ">
        {parts.map((p) => (
          <button key={p.id} type="button" aria-pressed={p.id === chosen.id} onClick={() => setPick(p.id)}>{p.label}</button>
        ))}
      </div>
      <div className="viz-now" aria-live="polite">
        <strong>{chosen.label}</strong>
        <span>{chosen.mean}</span>
      </div>
    </figure>
  );
}
