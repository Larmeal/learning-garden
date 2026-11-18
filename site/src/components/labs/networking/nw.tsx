import type { ReactNode } from 'react';
import { prog, smooth, mix } from '../spark/timeline';

// Drawing pieces shared by the Networking labs. Every piece takes plain numbers (position, opacity, progress), so a lab can draw itself as a pure
// function of the clock time. One colour per layer, the same in every lab (the Legend prints it): link (violet), network (blue), transport (green),
// application (the accent colour), security (dark). Packets are drawn as a bar of coloured segments, one per header, so the reader can SEE a header
// being added when a packet goes down a layer and removed when it comes up.

export const ease = (t: number, a: number, b: number) => smooth(prog(t, a, b));
export { mix, prog, smooth };

export type Layer = 'l2' | 'l3' | 'l4' | 'app' | 'tls';
export interface Part { layer: Layer; label: string; w?: number }

const LAYER_NAME: Record<'th' | 'en', Record<Layer, string>> = {
  th: { l2: 'Link (Ethernet)', l3: 'Network (IP)', l4: 'Transport (TCP/UDP)', app: 'Application', tls: 'TLS' },
  en: { l2: 'Link (Ethernet)', l3: 'Network (IP)', l4: 'Transport (TCP/UDP)', app: 'Application', tls: 'TLS' },
};

export function Legend({ layers = ['l2', 'l3', 'l4', 'app'], lang = 'th', extra }: { layers?: Layer[]; lang?: 'th' | 'en'; extra?: { cls: string; text: string }[] }) {
  return (
    <div className="ib-legend nw-legend" aria-label="legend">
      {layers.map((l) => (<span key={l}><i className={l} />{LAYER_NAME[lang][l]}</span>))}
      {extra?.map((e) => (<span key={e.text}><i className={e.cls} />{e.text}</span>))}
    </div>
  );
}

const partW = (p: Part) => p.w ?? Math.max(34, p.label.length * 9 + 14);
export const barWidth = (parts: Part[], gap = 2) => parts.reduce((a, p) => a + partW(p), 0) + gap * Math.max(0, parts.length - 1);

// A packet as a bar of header segments, from the outermost header on the left. Each part has its own width (units of the SVG).
export function PacketBar({ x, y, parts, h = 30, op = 1, center = false, gap = 2 }: { x: number; y: number; parts: Part[]; h?: number; op?: number; center?: boolean; gap?: number }) {
  if (op <= 0.01 || parts.length === 0) return null;
  const total = barWidth(parts, gap);
  let cx = center ? x - total / 2 : x;
  return (
    <g style={{ opacity: op }}>
      {parts.map((p, i) => {
        const px = cx;
        const w = partW(p);
        cx += w + gap;
        return (
          <g key={i}>
            <rect className={`nw-${p.layer}`} x={px} y={y} width={w} height={h} rx={5} />
            <text x={px + w / 2} y={y + h / 2 + 5} className="nw-txt">{p.label}</text>
          </g>
        );
      })}
    </g>
  );
}

// A small labelled packet for sequence pictures and queues (SYN, ACK, seq 1000).
export function Pk({ x, y, label, kind = 'data', op = 1, w, h = 28 }: { x: number; y: number; label: string; kind?: 'data' | 'ack' | 'ctl' | 'retx'; op?: number; w?: number; h?: number }) {
  if (op <= 0.01) return null;
  const pw = w ?? Math.max(40, label.length * 9 + 16);
  return (
    <g style={{ opacity: op }}>
      <rect className={`nw-pk ${kind}`} x={x - pw / 2} y={y - h / 2} width={pw} height={h} rx={8} />
      <text x={x} y={y + 5} textAnchor="middle" className="ib-m" style={{ fill: 'var(--fg)', fontWeight: 700, fontSize: 14 }}>{label}</text>
    </g>
  );
}

// A dropped packet: the packet with a cross over it.
export function Lost({ x, y, label, op = 1 }: { x: number; y: number; label: string; op?: number }) {
  if (op <= 0.01) return null;
  return (
    <g style={{ opacity: op }}>
      <rect className="nw-lost" x={x - 34} y={y - 15} width={68} height={30} rx={8} />
      <text x={x} y={y + 5} textAnchor="middle" className="ib-m" style={{ fontSize: 14, fill: 'var(--ib-bad)', fontWeight: 700 }}>{label}</text>
      <path d={`M${x - 14},${y - 10} L${x + 14},${y + 10} M${x + 14},${y - 10} L${x - 14},${y + 10}`} style={{ stroke: 'var(--ib-bad)', strokeWidth: 3.5, fill: 'none', strokeLinecap: 'round' }} />
    </g>
  );
}

export type DevKind = 'host' | 'router' | 'switch' | 'server' | 'cloud' | 'dns' | 'box';

// A device with a small icon, a plain name and (optionally) a technical line under it.
export function Dev({ x, y, w = 130, h = 74, kind = 'host', title, sub, hot, op = 1 }: { x: number; y: number; w?: number; h?: number; kind?: DevKind; title: string; sub?: string; hot?: boolean; op?: number }) {
  if (op <= 0.01) return null;
  const ix = x + 12, iy = y + 12;
  return (
    <g style={{ opacity: op }}>
      <rect className={`nw-dev${hot ? ' hot' : ''}`} x={x} y={y} width={w} height={h} rx={12} />
      {kind === 'host' && (<g className="nw-ico"><rect x={ix} y={iy} width={26} height={17} rx={2} /><path d={`M${ix + 6},${iy + 24} h14`} /></g>)}
      {kind === 'server' && (<g className="nw-ico"><rect x={ix} y={iy} width={26} height={9} rx={2} /><rect x={ix} y={iy + 13} width={26} height={9} rx={2} /><path d={`M${ix + 5},${iy + 4.5} h2 M${ix + 5},${iy + 17.5} h2`} /></g>)}
      {kind === 'router' && (<g className="nw-ico"><circle cx={ix + 13} cy={iy + 13} r={12} /><path d={`M${ix + 5},${iy + 13} h16 m-5,-4 l5,4 l-5,4`} /></g>)}
      {kind === 'switch' && (<g className="nw-ico"><rect x={ix} y={iy + 3} width={28} height={16} rx={3} /><path d={`M${ix + 5},${iy + 11} h2 M${ix + 12},${iy + 11} h2 M${ix + 19},${iy + 11} h2`} /></g>)}
      {kind === 'cloud' && (<g className="nw-ico"><path d={`M${ix + 6},${iy + 21} a7,7 0 0 1 1,-14 a9,9 0 0 1 17,2 a6,6 0 0 1 0,12 z`} /></g>)}
      {kind === 'dns' && (<g className="nw-ico"><rect x={ix} y={iy} width={26} height={22} rx={3} /><path d={`M${ix + 5},${iy + 7} h16 M${ix + 5},${iy + 13} h10`} /></g>)}
      {kind === 'box' && (<g className="nw-ico"><rect x={ix} y={iy} width={24} height={22} rx={3} /></g>)}
      <text x={x + 48} y={y + 29} className="ib-n">{title}</text>
      {sub && <text x={x + 12} y={y + h - 14} className="ib-m">{sub}</text>}
    </g>
  );
}

export function Wire({ x1, y1, x2, y2, hot, dashed, op = 1 }: { x1: number; y1: number; x2: number; y2: number; hot?: boolean; dashed?: boolean; op?: number }) {
  return <path className={`nw-wire${hot ? ' hot' : ''}`} d={`M${x1},${y1} L${x2},${y2}`} style={{ opacity: op, strokeDasharray: dashed ? '8 6' : undefined }} />;
}

// A point that has travelled the fraction p of the way from a to b.
export const lerp = (a: [number, number], b: [number, number], p: number): [number, number] => [mix(a[0], b[0], p), mix(a[1], b[1], p)];

// One message of a sequence picture (time runs down): an arrow from (x1,y1) to (x2,y2) that grows with p, and a label at the middle.
// The label of a message sits in the middle of the arrow, but is moved off the numbered circle at the start of the arrow when the arrow is short.
const labelX = (x1: number, x2: number, label: string) => {
  const mid = (x1 + x2) / 2, half = label.length * 4.1;
  return x2 >= x1 ? Math.max(mid, x1 + 20 + half) : Math.min(mid, x1 - 20 - half);
};

export function Msg({ x1, y1, x2, y2, p = 1, label, kind = 'data', n, lost, op = 1, labelDy = -9 }: { x1: number; y1: number; x2: number; y2: number; p?: number; label?: string; kind?: 'data' | 'ack' | 'ctl' | 'retx'; n?: number; lost?: boolean; op?: number; labelDy?: number }) {
  if (p <= 0.001 || op <= 0.01) return null;
  const hx = mix(x1, x2, p), hy = mix(y1, y2, p);
  const col = kind === 'ack' ? 'var(--k2)' : kind === 'ctl' ? 'var(--k3)' : kind === 'retx' ? 'var(--ib-bad)' : 'var(--accent)';
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const ah = 11;
  return (
    <g style={{ opacity: op }}>
      <path d={`M${x1},${y1} L${hx},${hy}`} style={{ stroke: col, strokeWidth: 3.5, fill: 'none', strokeDasharray: kind === 'retx' ? '7 5' : undefined, strokeLinecap: 'round' }} />
      {!lost && p > 0.98 && <path d={`M${x2},${y2} l${-ah * Math.cos(ang - 0.45)},${-ah * Math.sin(ang - 0.45)} M${x2},${y2} l${-ah * Math.cos(ang + 0.45)},${-ah * Math.sin(ang + 0.45)}`} style={{ stroke: col, strokeWidth: 3.5, fill: 'none', strokeLinecap: 'round' }} />}
      {lost && p > 0.98 && <path d={`M${hx - 9},${hy - 9} l18,18 M${hx + 9},${hy - 9} l-18,18`} style={{ stroke: 'var(--ib-bad)', strokeWidth: 4, fill: 'none', strokeLinecap: 'round' }} />}
      {label && p > 0.35 && <text x={labelX(x1, x2, label)} y={(y1 + y2) / 2 + labelDy} textAnchor="middle" className="ib-m" style={{ fill: 'var(--fg)', fontWeight: 700 }}>{label}</text>}
      {n !== undefined && p > 0.05 && (
        <g>
          <circle cx={x1} cy={y1} r={13} style={{ fill: col }} />
          <text x={x1} y={y1 + 5} className="ib-white" style={{ fontSize: 14 }}>{n}</text>
        </g>
      )}
    </g>
  );
}

// The vertical lifelines of a sequence picture, with the name of each side at the top.
export function Lifelines({ xs, y1, y2, names, subs }: { xs: number[]; y1: number; y2: number; names: string[]; subs?: string[] }) {
  return (
    <g>
      {xs.map((x, i) => (
        <g key={i}>
          <text x={x} y={y1 - 28} textAnchor="middle" className="ib-n" style={{ fontSize: 17 }}>{names[i]}</text>
          {subs?.[i] && <text x={x} y={y1 - 9} textAnchor="middle" className="ib-s">{subs[i]}</text>}
          <path className="nw-life" d={`M${x},${y1} L${x},${y2}`} />
        </g>
      ))}
    </g>
  );
}

// A note written beside a lifeline (the state of one side at this moment).
export function Note({ x, y, w, text, op = 1, tone }: { x: number; y: number; w: number; text: ReactNode; op?: number; tone?: 'ok' | 'bad' }) {
  if (op <= 0.01) return null;
  return (
    <g style={{ opacity: op }}>
      <rect className={`nw-cell${tone ? ' ' + tone : ' on'}`} x={x} y={y} width={w} height={32} rx={8} />
      <text x={x + w / 2} y={y + 21} textAnchor="middle" className="ib-n" style={{ fontSize: 15 }}>{text}</text>
    </g>
  );
}

export const fmt = (n: number, d = 1) => n.toFixed(d);
