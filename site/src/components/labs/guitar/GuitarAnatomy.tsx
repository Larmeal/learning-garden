import { useState, type ReactNode } from 'react';
import { Pills } from '../../music/Controls';

// A flat schematic of an electric and an acoustic guitar. Pick a part to light it up and read what it does.
// The drawing is a diagram, not a scale model: the neck is drawn 17 frets long and the body shapes are simplified.

type Lang = 'th' | 'en';
type Kind = 'electric' | 'acoustic';
type Means = Record<'headstock' | 'tuners' | 'nut' | 'neck' | 'frets' | 'inlays' | 'strings' | 'pickups' | 'bridge' | 'controls' | 'body' | 'strap' | 'soundhole' | 'top' | 'acousticBridge' | 'pickguard', string>;

const TEXT: Record<Lang, { title: string; kind: string; svgLabel: (kind: string, part: string) => string; partsLabel: string; means: Means }> = {
  th: {
    title: 'ส่วนประกอบของกีต้าร์ กดชื่อส่วนเพื่อดู',
    kind: 'ชนิด',
    svgLabel: (kind, part) => `แผนภาพกีต้าร์ ${kind}, ส่วนที่เลือก: ${part}`,
    partsLabel: 'ส่วนประกอบ',
    means: {
      headstock: 'ส่วนหัวของกีต้าร์ เป็นที่ติดลูกบิดสายและโลโก้ ส่วนปลายสายก็พันอยู่ตรงนี้',
      tuners: 'ลูกบิดตั้งสาย ถ้าหมุนให้สายตึงขึ้นเสียงจะสูงขึ้น ถ้าหมุนให้สายหย่อนเสียงจะต่ำลง',
      nut: 'แผ่นเล็ก ๆ ที่รองสายตรงปลายคอ ทำหน้าที่กำหนดระยะห่างของสายและจุดเริ่มต้นของส่วนที่สั่นได้ (เฟร็ต 0)',
      neck: 'คอกีต้าร์ ข้างในมี Truss Rod ซึ่งเป็นแกนโลหะที่ปรับความโค้งของคอ เพื่อให้ต้านแรงดึงของสายได้',
      frets: 'แผ่นไม้บนคอและลวดเฟร็ต เฟร็ตแต่ละอันทำให้สายสั้นลงและเสียงสูงขึ้นครึ่งเสียง (Semitone) ระยะห่างของเฟร็ตจะแคบลงเรื่อย ๆ เพราะแต่ละก้าวเป็นสัดส่วนคงที่',
      inlays: 'จุดบอกตำแหน่งที่เฟร็ต 3 5 7 9 12 (สองจุด) 15 และ 17 ช่วยให้เรารู้ตำแหน่งได้โดยไม่ต้องนับ',
      strings: 'กีต้าร์มีหกสาย ตั้งแต่สาย 6 (หนาที่สุด เสียงต่ำที่สุด E) ไปถึงสาย 1 (บางที่สุด เสียงสูงที่สุด e) ระดับเสียงขึ้นอยู่กับความยาว ความตึง และความหนาของสาย',
      pickups: 'ขดลวดแม่เหล็กใต้สาย ทำหน้าที่เปลี่ยนการสั่นของสายให้เป็นสัญญาณไฟฟ้า Pickup ตัวที่อยู่ใกล้คอจะให้เสียงนุ่ม ส่วนตัวที่อยู่ใกล้ Bridge จะให้เสียงคมและแหลม',
      bridge: 'ยึดปลายสายอีกด้าน และกำหนดว่าส่วนที่สั่นของสายจะสิ้นสุดตรงไหน ระยะจากนัตถึง Saddle คือ Scale Length และเราปรับ Saddle เพื่อตั้ง Intonation',
      controls: 'ปุ่ม Volume ใช้ปรับความดัง ปุ่ม Tone ใช้ตัดเสียงแหลม และส่วนใหญ่จะมีสวิตช์ Selector สำหรับเลือก Pickup ด้วย',
      body: 'ตัวกีต้าร์ไฟฟ้าแบบ Solid Body ทำจากไม้ตัน เป็นที่ติด Pickup, Bridge และปุ่มควบคุม เสียงส่วนใหญ่มาจาก Pickup มากกว่ามาจากเนื้อไม้',
      strap: 'ปุ่มสำหรับคล้องสายสะพาย ตัวหนึ่งอยู่ที่ปลายตัวกีต้าร์ อีกตัวอยู่ด้านหลังหรือที่คอ',
      soundhole: 'รูที่ให้เสียงสั่นในกล่องก้องออกมาได้ และทำงานร่วมกับตัวกล่องเพื่อขยายเสียง (ไม่ต้องใช้ไฟฟ้า)',
      top: 'กล่องก้องเสียง ส่วนหน้า (Top) เป็นส่วนที่สั่นมากที่สุดและส่งเสียงออกมา ส่วนด้านหลังและด้านข้างช่วยสะท้อนเสียง ภายในมีโครงไม้ (Bracing) ค้ำหน้าไว้',
      acousticBridge: 'ยึดปลายสายไว้บนหน้ากีต้าร์ และส่งแรงสั่นเข้าไปในกล่อง ส่วน Saddle (แท่งบางสีขาวหรือดำ) คือจุดที่สายสิ้นสุด',
      pickguard: 'แผ่นบนหน้ากีต้าร์ ใต้สายเสียงต่ำ ช่วยกันรอยขีดข่วนจากปิ๊ก',
    },
  },
  en: {
    title: 'The parts of a guitar: press a name to see it',
    kind: 'Type',
    svgLabel: (kind, part) => `Diagram of an ${kind} guitar, selected part: ${part}`,
    partsLabel: 'Parts',
    means: {
      headstock: 'The head of the guitar. It holds the tuning machines and the logo. The ends of the strings are wound here.',
      tuners: 'The knobs that tune the strings. Turn one to tighten a string (higher pitch) or loosen it (lower pitch).',
      nut: 'A small strip that supports the strings at the end of the neck. It sets the distance between the strings and where the vibrating part starts (fret 0).',
      neck: 'The neck of the guitar. Inside is a truss rod, a metal rod that sets the curve of the neck against the pull of the strings.',
      frets: 'The wooden board on the neck and the fret wires. Each fret makes the string shorter and raises the pitch by a semitone. The frets get closer together along the neck because each step is the same ratio.',
      inlays: 'Dots that mark the position, at frets 3, 5, 7, 9, 12 (two dots), 15 and 17. They help you know where you are without counting.',
      strings: 'Six strings, from string 6 (thickest, lowest pitch, E) to string 1 (thinnest, highest pitch, e). Length, tension and thickness decide the pitch.',
      pickups: 'Magnetic coils under the strings. They turn the vibration of the strings into an electric signal. The one near the neck sounds soft. The one near the bridge sounds sharp and bright.',
      bridge: 'It holds the other end of the strings and sets where the vibrating part of the string ends. The distance from the nut to the saddle is the scale length. You adjust the saddle to set the intonation.',
      controls: 'The volume knob sets how loud it is. The tone knob cuts the high frequencies. There is often also a selector switch to choose the pickup.',
      body: 'The body of a solid body electric guitar is solid wood. It holds the pickups, the bridge and the controls. The sound comes mainly from the pickups, more than from the wood.',
      strap: 'A button for the guitar strap. One is at the end of the body and the other at the back or on the neck.',
      soundhole: 'A hole that lets the sound inside the sound box come out. Together with the box it amplifies the sound (no electricity needed).',
      top: 'The sound box. The top vibrates the most and sends out the sound. The back and the sides reflect it. Inside, wooden braces support the top.',
      acousticBridge: 'It holds the ends of the strings on the top of the guitar and passes the vibration into the box. The saddle (a thin white or black bar) is where the string ends.',
      pickguard: 'A plate on the top of the guitar, under the low strings, that protects it from scratches by the pick.',
    },
  },
};

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

const common = (bridgeX: number, m: Means): Part[] => [
  {
    id: 'headstock',
    label: 'headstock',
    mean: m.headstock,
    shape: <rect x="14" y="92" width="92" height="76" rx="10" {...hi} />,
  },
  {
    id: 'tuners',
    label: 'tuning machines',
    mean: m.tuners,
    shape: (
      <>
        {[30, 54, 78].flatMap((x) => [86, 174].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="8" {...hi} />))}
      </>
    ),
  },
  {
    id: 'nut',
    label: 'nut',
    mean: m.nut,
    shape: <rect x={NUT - 3} y="102" width="9" height="58" {...hi} />,
  },
  {
    id: 'neck',
    label: 'neck + truss rod',
    mean: m.neck,
    shape: <polygon points={`${NUT},106 ${END},98 ${END},162 ${NUT},154`} {...hi} />,
  },
  {
    id: 'frets',
    label: 'fretboard + frets',
    mean: m.frets,
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
    mean: m.inlays,
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
    mean: m.strings,
    shape: (
      <>
        {STRING_Y.map((y) => <line key={y} x1={NUT} x2={bridgeX} y1={y} y2={y} stroke="var(--accent)" strokeWidth="3.5" />)}
      </>
    ),
  },
];

const electricParts = (m: Means): Part[] => [
  ...common(662, m),
  {
    id: 'pickups',
    label: 'pickups',
    mean: m.pickups,
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
    mean: m.bridge,
    shape: <rect x="650" y="100" width="22" height="60" rx="3" {...hi} />,
  },
  {
    id: 'controls',
    label: 'volume + tone knobs',
    mean: m.controls,
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
    mean: m.body,
    shape: <path d="M470,110 C500,60 520,40 560,42 C600,44 610,70 650,60 C700,50 740,80 740,130 C740,180 700,215 650,205 C610,195 600,220 560,218 C520,216 500,200 470,150 Z" {...hi} />,
  },
  {
    id: 'strap',
    label: 'strap button',
    mean: m.strap,
    shape: <circle cx="728" cy="130" r="9" {...hi} />,
  },
];

const acousticParts = (m: Means): Part[] => [
  ...common(655, m),
  {
    id: 'soundhole',
    label: 'soundhole',
    mean: m.soundhole,
    shape: <circle cx="548" cy="130" r="32" {...hi} />,
  },
  {
    id: 'top',
    label: 'body (top, back, sides)',
    mean: m.top,
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
    mean: m.acousticBridge,
    shape: <rect x="642" y="98" width="26" height="64" rx="4" {...hi} />,
  },
  {
    id: 'pickguard',
    label: 'pickguard',
    mean: m.pickguard,
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

export default function GuitarAnatomy({ lang = 'th' }: { lang?: Lang }) {
  const t = TEXT[lang];
  const [kind, setKind] = useState<Kind>('electric');
  const [pick, setPick] = useState('frets');
  const parts = kind === 'electric' ? electricParts(t.means) : acousticParts(t.means);
  const chosen = parts.find((p) => p.id === pick) ?? parts[0];
  const bridgeX = kind === 'electric' ? 662 : 655;

  const change = (k: Kind) => {
    setKind(k);
    if (!(k === 'electric' ? electricParts(t.means) : acousticParts(t.means)).some((p) => p.id === pick)) setPick('frets');
  };

  return (
    <figure className="viz">
      <div className="viz-title">{t.title}</div>
      <Pills<Kind> label={t.kind} value={kind} onChange={change} options={[{ value: 'electric', text: 'electric (solid body)' }, { value: 'acoustic', text: 'acoustic (flattop)' }]} />
      <div className="viz-box">
        <svg viewBox="0 0 770 250" role="img" aria-label={t.svgLabel(kind, chosen.label)}>
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
      <div className="viz-steps" role="group" aria-label={t.partsLabel}>
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
