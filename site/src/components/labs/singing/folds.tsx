// Drawings of the vocal folds, shared by the vocal fold lab and the register lab.
// open: 0 (folds touching) .. 1 (widest opening) is the flow of the glottal pulse at this moment of the cycle.

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const r1 = (x: number) => Math.round(x * 10) / 10;

/**
 * The glottis seen from above (the doctor's view). The front of the larynx is at the top. Two folds with a gap between them;
 * `chink` keeps a gap at the back when the closure is loose (breathy), `leak` is a thin gap left along the whole length.
 */
export function TopView({ open, chink = 0, leak = 0, width = 300, lang = 'th' }: { open: number; chink?: number; leak?: number; width?: number; lang?: 'th' | 'en' }) {
  const en = lang === 'en';
  const h = (width * 260) / 300;
  const gap = (y: number) => {
    // 0 at the front end, widest about two thirds of the way back
    const u = clamp((y - 40) / 170, 0, 1);
    const shape = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.85)), 0.9);
    return r1(leak + open * 34 * shape + chink * 10 * u * u);
  };
  const ys: number[] = [];
  for (let y = 40; y <= 214; y += 8) ys.push(y);
  const left = ys.map((y) => `${r1(150 - gap(y) / 2)},${y}`).join(' L');
  const right = ys.map((y) => `${r1(150 + gap(y) / 2)},${y}`).join(' L');
  return (
    <svg viewBox="0 0 300 260" role="img" aria-label={en ? 'The vocal folds seen from above, the gap between them opening and closing' : 'เส้นเสียงมองจากด้านบน ช่องระหว่างเส้นเสียงเปิดและปิด'} style={{ width, height: h, maxWidth: '100%', minWidth: 0 }}>
      <rect x="0" y="0" width="300" height="260" rx="14" fill="color-mix(in srgb, var(--fg) 88%, transparent)" />
      <path d="M150,34 C60,40 40,110 52,170 C60,214 110,246 150,248 C190,246 240,214 248,170 C260,110 240,40 150,34 Z" fill="color-mix(in srgb, var(--accent) 35%, var(--surface))" opacity="0.35" />
      {/* left fold and right fold */}
      <path d={`M150,40 L${left} L${r1(150 - gap(214) / 2)},228 L96,224 C70,200 66,120 90,64 C108,42 130,38 150,40 Z`} fill="color-mix(in srgb, var(--accent) 38%, var(--surface))" stroke="var(--accent)" strokeWidth="2" />
      <path d={`M150,40 L${right} L${r1(150 + gap(214) / 2)},228 L204,224 C230,200 234,120 210,64 C192,42 170,38 150,40 Z`} fill="color-mix(in srgb, var(--accent) 38%, var(--surface))" stroke="var(--accent)" strokeWidth="2" />
      {/* the two arytenoid cartilages at the back */}
      <ellipse cx={r1(122 - chink * 4)} cy="232" rx="16" ry="10" fill="var(--surface-2)" stroke="var(--line-strong)" />
      <ellipse cx={r1(178 + chink * 4)} cy="232" rx="16" ry="10" fill="var(--surface-2)" stroke="var(--line-strong)" />
      <text x="150" y="22" textAnchor="middle" fontSize="12" fill="var(--bg)">{en ? 'front' : 'หน้า'}</text>
      <text x="150" y="254" textAnchor="middle" fontSize="12" fill="var(--bg)">{en ? 'back' : 'หลัง'}</text>
    </svg>
  );
}

/**
 * A slice through the vocal folds from front to back (the view of the cross-section): the airway runs up the middle, a fold sticks
 * out from each wall. `thick` 0 (thin, stretched: head voice) .. 1 (thick, short: chest voice). The top edge of a fold lags behind
 * the bottom edge (the mucosal wave), so `open` is the lower edge and `openTop` the upper one.
 */
export function Coronal({ open, openTop, thick, width = 300, lang = 'th' }: { open: number; openTop: number; thick: number; width?: number; lang?: 'th' | 'en' }) {
  const en = lang === 'en';
  const h = (width * 220) / 300;
  const th = 26 + 58 * thick; // height of the fold
  const cy = 120;
  const gapLow = 3 + 26 * open; // half gap at the bottom edge
  const gapTop = 3 + 26 * openTop;
  const xl = (g: number) => r1(150 - g);
  const xr = (g: number) => r1(150 + g);
  const contact = Math.max(0, Math.min(th, th * (1 - Math.max(open, openTop)) * (open < 0.08 || openTop < 0.08 ? 1 : 0.3)));
  return (
    <svg viewBox="0 0 300 220" role="img" aria-label={en ? 'Cross-section of the two vocal folds, the thickness changes with register' : 'ภาพตัดขวางของเส้นเสียงสองข้าง ความหนาเปลี่ยนตาม register'} style={{ width, height: h, maxWidth: '100%', minWidth: 0 }}>
      <rect x="0" y="0" width="300" height="220" rx="14" fill="var(--surface)" stroke="var(--line)" />
      {/* the walls of the larynx */}
      <path d="M40,0 L40,100 C40,106 46,108 52,110" fill="none" stroke="var(--line-strong)" strokeWidth="2" />
      <path d="M260,0 L260,100 C260,106 254,108 248,110" fill="none" stroke="var(--line-strong)" strokeWidth="2" />
      <path d="M40,220 L40,150 C40,140 46,130 52,128" fill="none" stroke="var(--line-strong)" strokeWidth="2" />
      <path d="M260,220 L260,150 C260,140 254,130 248,128" fill="none" stroke="var(--line-strong)" strokeWidth="2" />
      {/* folds: lateral edge on the wall, medial edge on the airway */}
      <path d={`M48,${cy - th / 2 - 6} C80,${cy - th / 2 - 8} ${xl(gapTop) - 30},${cy - th / 2 - 2} ${xl(gapTop)},${cy - th / 2 + 2} C${xl((gapTop + gapLow) / 2) - 4},${cy} ${xl((gapTop + gapLow) / 2) - 4},${cy} ${xl(gapLow)},${cy + th / 2 - 2} C${xl(gapLow) - 30},${cy + th / 2 + 4} 80,${cy + th / 2 + 6} 48,${cy + th / 2 + 6} Z`} fill="color-mix(in srgb, var(--accent) 38%, var(--surface))" stroke="var(--accent)" strokeWidth="2" />
      <path d={`M252,${cy - th / 2 - 6} C220,${cy - th / 2 - 8} ${xr(gapTop) + 30},${cy - th / 2 - 2} ${xr(gapTop)},${cy - th / 2 + 2} C${xr((gapTop + gapLow) / 2) + 4},${cy} ${xr((gapTop + gapLow) / 2) + 4},${cy} ${xr(gapLow)},${cy + th / 2 - 2} C${xr(gapLow) + 30},${cy + th / 2 + 4} 220,${cy + th / 2 + 6} 252,${cy + th / 2 + 6} Z`} fill="color-mix(in srgb, var(--accent) 38%, var(--surface))" stroke="var(--accent)" strokeWidth="2" />
      {/* where the folds touch */}
      {contact > 2 && <line x1="150" x2="150" y1={r1(cy - contact / 2)} y2={r1(cy + contact / 2)} stroke="var(--brand)" strokeWidth="4" strokeLinecap="round" />}
      <text x="150" y="16" textAnchor="middle" fontSize="12" fill="var(--muted)">{en ? 'air rises from the lungs below' : 'ลมจากปอดขึ้นมาจากด้านล่าง'}</text>
      <path d="M150,210 L150,190 M144,196 L150,188 L156,196" stroke="var(--muted)" strokeWidth="2" fill="none" />
    </svg>
  );
}
