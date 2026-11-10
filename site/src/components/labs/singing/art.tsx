import type { ReactNode } from 'react';
import { lipShape, type Pose } from '../../../lib/tract';

// The side view (sagittal section) of the head and neck, facing left, shared by the anatomy lab and the vocal tract lab.
// All shapes are drawn from a Pose, so the tongue, jaw, lips, soft palate and larynx move when the pose changes.
// Coordinates: the viewBox of the head is 0 0 400 440. The lips are on the left (x about 80), the back wall of the throat is at x = 300.

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
type Pt = [number, number];

/** a smooth closed or open curve through points (Catmull-Rom turned into cubic Beziers) */
export function smoothPath(pts: Pt[], closed = false): string {
  const n = pts.length;
  const get = (i: number) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return closed ? d + ' Z' : d;
}

/** y of the roof of the mouth (hard palate) at x */
export const palateY = (x: number) => {
  const u = Math.max(0, (235 - x) / 143);
  return 150 + 26 * u * u;
};

export interface HeadGeometry {
  tongue: Pt[];
  tongueTop: Pt;
  jawAngle: number;
  larynxY: number;
  velumTip: Pt;
  lipX: number;
  lowerLipY: number;
  mouthGap: number;
}

export function headGeometry(p: Pose): HeadGeometry {
  const jawAngle = -p.jaw * 17; // degrees (negative = counter-clockwise on screen: the chin goes down), about the hinge at (255, 185)
  const rad = (jawAngle * Math.PI) / 180;
  const rot = (x: number, y: number): Pt => {
    const dx = x - 255;
    const dy = y - 185;
    return [255 + dx * Math.cos(rad) - dy * Math.sin(rad), 185 + dx * Math.sin(rad) + dy * Math.cos(rad)];
  };
  const hx = lerp(250, 172, p.front);
  const lowY = 256 + 30 * p.jaw;
  const highY = palateY(hx) + 11;
  const hy = lerp(lowY, highY, p.height);
  const tip = rot(104, 216);
  const blade = [lerp(hx, tip[0], 0.55), lerp(hy, tip[1], 0.5) + 2] as Pt;
  const back: Pt = [Math.min(284, hx + 36), hy + lerp(24, 20, p.height)];
  const rootTop: Pt = [291, Math.max(back[1] + 20, 262)];
  const rootBottom: Pt = [284, 318 + 8 * p.jaw];
  const mid: Pt = [(tip[0] + hx) / 2 + 24, Math.max(hy + 54, tip[1] + 34)];
  const under = rot(112, 240);
  const larynxY = 352 - 24 * p.larynx + p.jaw * 3;
  return {
    tongue: [tip, blade, [hx, hy], back, rootTop, rootBottom, mid, under],
    tongueTop: [hx, hy],
    jawAngle,
    larynxY,
    velumTip: [lerp(284, 266, p.velum), lerp(138, 205, p.velum)],
    lipX: 80 - 12 * Math.max(0, lipShape(p)) + 8 * Math.max(0, -lipShape(p)),
    lowerLipY: rot(80, 205)[1],
    mouthGap: rot(80, 205)[1] - 184,
  };
}

export interface HeadProps {
  pose: Pose;
  /** highlight a part by key (see labels in the anatomy lab) */
  active?: string | null;
  /** draw the vocal folds as open (breathing) or closed */
  folds?: 'open' | 'closed';
  onPick?: (key: string) => void;
  /** show the extra drawing of the lower airway (trachea) down to y = 440 */
  trachea?: boolean;
  children?: ReactNode;
}

const FILL = 'var(--surface-2)';
const LINE = 'var(--fg)';
const TONGUE = 'color-mix(in srgb, var(--accent) 38%, var(--surface))';
const SOFT = 'color-mix(in srgb, var(--accent) 18%, var(--surface))';

export function SagittalHead({ pose, active, folds = 'closed', onPick, trachea = true, children }: HeadProps) {
  const g = headGeometry(pose);
  const lip = lipShape(pose);
  const hit = (key: string) => ({
    onClick: onPick ? () => onPick(key) : undefined,
    style: { cursor: onPick ? 'pointer' : undefined } as React.CSSProperties,
  });
  const on = (key: string) => (active === key ? 3.5 : 2);
  const ring = (key: string) => (active === key ? 'var(--accent)' : LINE);
  const palate = smoothPath([[86, 178], [112, 163], [160, 153], [210, 150], [236, 152]]);
  const velum = smoothPath([[236, 152], [262, lerp(132, 168, pose.velum)], g.velumTip]);
  const larynxTop = g.larynxY - 22;
  return (
    <g>
      {/* head and neck (without the lower jaw, which moves) */}
      <path
        d="M316,40 C250,8 150,12 112,60 C100,76 96,92 94,104 L86,116 C80,122 70,134 56,142 C54,148 60,153 72,152 L74,166 C66,170 64,176 68,182 L70,188 L100,190 L236,150 L300,150 L300,282 L190,282 L188,330 L190,440 L330,440 L336,214 L350,196 C388,150 372,60 316,40 Z"
        fill={FILL}
        stroke="none"
      />
      <path d="M316,40 C250,8 150,12 112,60 C100,76 96,92 94,104 L86,116 C80,122 70,134 56,142 C54,148 60,153 72,152 L74,166 C66,170 64,176 68,182 L70,188" fill="none" stroke={LINE} strokeWidth="2" strokeLinejoin="round" />
      <path d="M316,40 C372,60 388,150 350,196 L336,214 L330,440" fill="none" stroke={LINE} strokeWidth="2" />
      <path d="M190,282 L188,330 L190,440" fill="none" stroke={LINE} strokeWidth="2" />
      {/* hair, ear, eye and eyebrow, so that the head reads as a person */}
      <path d="M112,60 C150,12 250,8 316,40 C372,60 388,120 372,168 C366,140 350,108 322,88 C270,60 180,58 112,60 Z" fill="color-mix(in srgb, var(--fg) 72%, var(--surface-2))" stroke={LINE} strokeWidth="2" strokeLinejoin="round" />
      <path d="M312,150 C334,140 346,160 338,180 C334,192 322,196 314,190" fill="color-mix(in srgb, var(--accent) 14%, var(--surface-2))" stroke={LINE} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M322,158 C330,160 332,170 326,176" fill="none" stroke={LINE} strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
      <ellipse cx="124" cy="98" rx="6.5" ry="4.2" fill="#fff" stroke={LINE} strokeWidth="1.5" />
      <circle cx="122.5" cy="98" r="2.6" fill={LINE} />
      <path d="M110,88 C118,82 130,82 138,86" fill="none" stroke={LINE} strokeWidth="2.2" strokeLinecap="round" />
      {/* nasal cavity, above the palate */}
      <path d="M74,150 C100,134 170,124 236,124 L282,128 L290,146 L236,150 L112,162 L84,162 Z" fill={SOFT} stroke={ring('nasal')} strokeWidth={on('nasal')} {...hit('nasal')} />
      {/* the open space of the mouth and throat */}
      <path
        d={`M${g.lipX + 6},184 L${g.lipX + 6},${g.lowerLipY} L130,238 L240,296 L296,316 L300,${larynxTop + 10} L300,150 L236,152 L160,156 L98,178 Z`}
        fill="var(--surface)"
        stroke="none"
      />
      {/* lower jaw: chin, lower teeth, the front of the neck; it turns about the hinge at (255, 185) */}
      <g transform={`rotate(${g.jawAngle} 255 185)`}>
        <path d="M70,192 L72,214 C70,222 76,232 80,236 C84,250 96,258 112,262 L188,284 L190,300 L252,300 L262,262 L196,240 L104,226 L100,206 L96,194 Z" fill={FILL} stroke="none" />
        <path d="M72,214 C70,222 76,232 80,236 C84,250 96,258 112,262 L188,284" fill="none" stroke={ring('jaw')} strokeWidth={on('jaw')} strokeLinejoin="round" {...hit('jaw')} />
        <rect x="85" y="207" width="14" height="18" rx="4" fill="#fff" stroke={LINE} strokeWidth="1.5" />
      </g>
      {/* upper teeth */}
      <rect x="87" y="179" width="13" height="18" rx="4" fill="#fff" stroke={LINE} strokeWidth="1.5" />
      {/* tongue */}
      <path d={smoothPath(g.tongue, true)} fill={TONGUE} stroke={ring('tongue')} strokeWidth={on('tongue')} {...hit('tongue')} />
      {/* hard palate and soft palate */}
      <path d={palate} fill="none" stroke={ring('palate')} strokeWidth={on('palate') + 1.5} strokeLinecap="round" {...hit('palate')} />
      <path d={velum} fill="none" stroke={ring('velum')} strokeWidth={on('velum') + 3.5} strokeLinecap="round" style={{ cursor: onPick ? 'pointer' : undefined }} onClick={onPick ? () => onPick('velum') : undefined} />
      {/* lips */}
      <path d={`M${g.lipX + 12},172 C${g.lipX - 2},170 ${g.lipX - 8},182 ${g.lipX + 12},187 Z`} fill="color-mix(in srgb, var(--accent) 45%, var(--surface))" stroke={ring('lips')} strokeWidth={on('lips')} {...hit('lips')} />
      <path d={`M${g.lipX + 12},${g.lowerLipY} C${g.lipX - 4},${g.lowerLipY - 6} ${g.lipX - 8},${g.lowerLipY + 10} ${g.lipX + 12},${g.lowerLipY + 14} Z`} fill="color-mix(in srgb, var(--accent) 45%, var(--surface))" stroke={ring('lips')} strokeWidth={on('lips')} {...hit('lips')} />
      <title>{lip > 0.4 ? 'lips rounded' : lip < -0.3 ? 'lips spread' : 'lips relaxed'}</title>
      {/* pharynx back wall */}
      <path d="M300,150 L300,430" stroke={ring('pharynx')} strokeWidth={on('pharynx')} fill="none" strokeDasharray={active === 'pharynx' ? undefined : '4 4'} />
      {/* hyoid, epiglottis, larynx */}
      <circle cx={262} cy={g.larynxY - 52} r={4} fill={LINE} />
      <path d={`M${272},${g.larynxY - 40} C${264},${g.larynxY - 56} ${266},${g.larynxY - 74} ${284},${g.larynxY - 86}`} fill="none" stroke={ring('epiglottis')} strokeWidth={on('epiglottis') + 1} strokeLinecap="round" {...hit('epiglottis')} />
      <rect x={256} y={g.larynxY - 26} width={44} height={52} rx={10} fill={SOFT} stroke={ring('larynx')} strokeWidth={on('larynx')} {...hit('larynx')} />
      {/* vocal folds: two wedges that meet (closed) or leave a gap (open) */}
      <path d={`M300,${g.larynxY - 4} L${folds === 'open' ? 276 : 266},${g.larynxY} L300,${g.larynxY + 6} Z`} fill="var(--accent)" stroke="none" {...hit('folds')} />
      <path d={`M256,${g.larynxY - 4} L${folds === 'open' ? 262 : 266},${g.larynxY} L256,${g.larynxY + 6} Z`} fill="var(--accent)" stroke="none" />
      {/* trachea */}
      {trachea && (
        <g>
          <rect x={256} y={g.larynxY + 26} width={44} height={440 - g.larynxY - 26} fill="var(--surface)" stroke={ring('trachea')} strokeWidth={on('trachea')} {...hit('trachea')} />
          {Array.from({ length: 6 }).map((_, i) => {
            const y = g.larynxY + 42 + i * 24;
            return y < 432 ? <line key={i} x1={256} x2={300} y1={y} y2={y} stroke={LINE} strokeWidth="1" opacity="0.5" /> : null;
          })}
        </g>
      )}
      {children}
    </g>
  );
}

/** a small label with a leader line */
export function Tag({ x, y, tx, ty, text, anchor = 'start' }: { x: number; y: number; tx: number; ty: number; text: string; anchor?: 'start' | 'end' }) {
  return (
    <g pointerEvents="none">
      <line x1={x} y1={y} x2={tx} y2={ty} stroke="var(--muted)" strokeWidth="1" />
      <text x={tx + (anchor === 'start' ? 4 : -4)} y={ty + 4} fontSize="12" textAnchor={anchor} fill="var(--fg)">{text}</text>
    </g>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Torso: ribs, lungs, diaphragm and the abdominal wall, drawn in the frame of "FullBody" (viewBox 0 0 480 760)
// ---------------------------------------------------------------------------------------------------------------

export interface TorsoProps {
  /** 0 = breathed out .. 1 = full breath in */
  breath: number;
  /** how the breath is taken: belly and lower ribs move out (low), or only the collar bones and shoulders lift (high) */
  mode?: 'low' | 'high';
  active?: string | null;
  onPick?: (key: string) => void;
}

export const TORSO_LUNG_TOP = 408;

export function Torso({ breath, mode = 'low', active, onPick }: TorsoProps) {
  const b = Math.max(0, Math.min(1, breath));
  const low = mode === 'low';
  const hit = (key: string) => ({ onClick: onPick ? () => onPick(key) : undefined, style: { cursor: onPick ? 'pointer' : undefined } as React.CSSProperties });
  const sw = (key: string) => (active === key ? 3.5 : 2);
  const col = (key: string) => (active === key ? 'var(--accent)' : LINE);
  const lift = low ? 2 * b : 14 * b; // the shoulders lift in high breathing
  const out = low ? 10 * b : 3 * b; // the front of the chest moves forward
  const belly = low ? 20 * b : -14 * b; // the abdominal wall moves out (low) or is pulled in (high)
  const apexY = (low ? 520 + 44 * b : 520 + 14 * b) - 0; // top of the diaphragm dome (lower = flatter)
  const lungBottom = apexY - 4;
  const front = 168 - out;
  return (
    <g>
      {/* trunk: shoulders, chest and belly; it fades out towards the bottom instead of ending on a hard line */}
      <defs>
        <linearGradient id="sgTrunkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--surface-2)' }} />
          <stop offset="0.82" style={{ stopColor: 'var(--surface-2)' }} />
          <stop offset="1" style={{ stopColor: 'var(--surface-2)', stopOpacity: 0 }} />
        </linearGradient>
        <linearGradient id="sgTrunkLine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--fg)' }} />
          <stop offset="0.8" style={{ stopColor: 'var(--fg)' }} />
          <stop offset="1" style={{ stopColor: 'var(--fg)', stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <path d={`M${201},${374 - lift} C${168},${380 - lift} ${118},${392 - lift} ${100},${430 - lift * 0.5} C${94},${448} ${108},${462} ${front - 18},${470} L${front - 20},${560} C${front - 14 + belly * 0.2},${640} ${160 - belly},${700} ${176 - belly},${740} L340,740 C348,680 354,600 352,520 C352,474 394,470 402,438 C396,398 350,384 320,${374 - lift} Z`} fill="url(#sgTrunkFill)" stroke="url(#sgTrunkLine)" strokeWidth="2" strokeLinejoin="round" />
      {/* spine */}
      <path d="M326,380 C346,440 350,520 348,600 C346,660 340,700 336,740" fill="none" stroke="var(--muted)" strokeWidth="9" strokeLinecap="round" opacity="0.5" />
      {/* collar bone */}
      <path d={`M${222},${392 - lift} L${front + 10},${414 - lift}`} stroke={col('ribs')} strokeWidth="4" strokeLinecap="round" fill="none" />
      {/* lungs */}
      <path
        d={`M276,${TORSO_LUNG_TOP + 20} C${240 - out},${TORSO_LUNG_TOP + 4} ${208 - out},${TORSO_LUNG_TOP + 40} ${200 - out},${TORSO_LUNG_TOP + 100} C${194 - out},${lungBottom - 50} ${196 - out},${lungBottom} ${230},${lungBottom + 2} L${322},${lungBottom + 6} C${344 + out * 0.3},${lungBottom - 40} ${338},${TORSO_LUNG_TOP + 60} ${312},${TORSO_LUNG_TOP + 26} C${300},${TORSO_LUNG_TOP + 14} ${288},${TORSO_LUNG_TOP + 14} 276,${TORSO_LUNG_TOP + 20} Z`}
        fill="color-mix(in srgb, var(--k1) 22%, var(--surface))"
        stroke={col('lungs')}
        strokeWidth={sw('lungs')}
        {...hit('lungs')}
      />
      {/* bronchi */}
      <path d={`M276,${TORSO_LUNG_TOP - 6} L276,${TORSO_LUNG_TOP + 22} M276,${TORSO_LUNG_TOP + 22} L244,${TORSO_LUNG_TOP + 52} M276,${TORSO_LUNG_TOP + 22} L304,${TORSO_LUNG_TOP + 52}`} stroke="var(--fg)" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.6" />
      {/* ribs: from the spine round to the breastbone */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const y = 440 + i * 20;
        const fy = y + 14 + (low ? 2 * b : -8 * b) * (1 - i / 8);
        return (
          <path
            key={i}
            d={`M336,${y - lift * 0.3} C300,${y - 20} ${front + 40},${y - 14} ${front},${fy}`}
            fill="none"
            stroke={col('ribs')}
            strokeWidth={active === 'ribs' ? 4 : 2.5}
            strokeLinecap="round"
            opacity={active === 'ribs' ? 1 : 0.7}
            {...hit('ribs')}
          />
        );
      })}
      <path d={`M${front},${450} L${front},${566}`} stroke={col('ribs')} strokeWidth="6" strokeLinecap="round" opacity="0.8" {...hit('ribs')} />
      {/* diaphragm: a dome under the lungs, flatter when it contracts */}
      <path d={`M${front - 8},${566} C${210},${apexY - 10} ${290},${apexY - 14} 346,${582}`} fill="none" stroke={col('diaphragm')} strokeWidth={active === 'diaphragm' ? 7 : 5} strokeLinecap="round" {...hit('diaphragm')} />
      {/* abdominal wall */}
      <path d={`M${front - 8},${568} C${front - 14 + belly},${620} ${158 + belly},${690} ${176 + belly * 0.4},${736}`} fill="none" stroke={col('abs')} strokeWidth={active === 'abs' ? 9 : 6} strokeLinecap="round" opacity="0.85" {...hit('abs')} />
    </g>
  );
}

/** the head and the trunk together, so that the airway can be followed from the lungs to the lips */
export function FullBody({ pose, breath, mode, active, onPick, folds = 'closed', back, children }: { pose: Pose; breath: number; mode?: 'low' | 'high'; active?: string | null; onPick?: (k: string) => void; folds?: 'open' | 'closed'; back?: ReactNode; children?: ReactNode }) {
  return (
    <g>
      {back}
      <Torso breath={breath} mode={mode} active={active} onPick={onPick} />
      <g transform="translate(40,0) scale(0.85)">
        <SagittalHead pose={pose} active={active} onPick={onPick} folds={folds} trachea />
      </g>
      {children}
    </g>
  );
}
