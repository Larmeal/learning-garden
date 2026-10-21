import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Pips from './Pips';
import Plant, { type PlantStage } from './Plant';
import { useProgress } from './useProgress';

export interface MapLesson {
  id: string;
  slug: string;
  title: string;
  phase: string;
  level: number;
  order: number;
  requires: string[];
  summary: string;
  stage: PlantStage;
  format: 'steps' | 'read';
  href: string;
}
export interface MapPhase {
  id: string;
  title: string;
  check: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const STAGE_LABEL = { seed: 'เมล็ด', sprout: 'ต้นอ่อน', evergreen: 'โตเต็มที่' } as const;

export default function TopicMap({ lessons, phases, initial }: { lessons: MapLesson[]; phases: MapPhase[]; initial: string }) {
  const [sel, setSel] = useState(initial);
  const reduce = useReducedMotion();
  const { done } = useProgress();

  const bySlug = useMemo(() => Object.fromEntries(lessons.map((l) => [l.slug, l])), [lessons]);
  const nextOf = useMemo(() => {
    const m: Record<string, string[]> = Object.fromEntries(lessons.map((l) => [l.slug, []]));
    lessons.forEach((l) => l.requires.forEach((r) => m[r]?.push(l.slug)));
    return m;
  }, [lessons]);

  const cur = bySlug[sel];
  const tagFor = (slug: string) => {
    if (slug === sel) return { cls: 'sel', text: 'เลือกอยู่' };
    if (cur.requires.includes(slug)) return { cls: 'pre', text: 'ก่อน' };
    if (nextOf[sel].includes(slug)) return { cls: 'nxt', text: 'ต่อ' };
    return { cls: '', text: '' };
  };

  const chips = (slugs: string[]) =>
    slugs.length === 0 ? (
      <span className="none">ไม่มี</span>
    ) : (
      slugs.map((s) => (
        <button key={s} type="button" className="chip" onClick={() => setSel(s)}>
          {pad(bySlug[s].order)} {bySlug[s].title}
        </button>
      ))
    );

  return (
    <div className="map">
      <div className="map-main">
        <div className="legend" aria-hidden="true">
          <span>
            ความยาก <Pips level={3} /> = 3 จาก 5
          </span>
          <span className="tag-chip sel">เลือกอยู่</span>
          <span>
            <span className="tag-chip pre">ก่อน</span> ต้องรู้มาก่อน
          </span>
          <span>
            <span className="tag-chip nxt">ต่อ</span> ใช้ความรู้นี้ต่อ
          </span>
        </div>

        {phases.map((p, pi) => (
          <motion.section
            key={p.id}
            className="phase-row"
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: pi * 0.07 }}
          >
            <div className="phase-head">
              <span className="phase-badge">{p.id}</span>
              <div>
                <h3>{p.title}</h3>
                <span className="check">เช็กตัวเอง: {p.check}</span>
              </div>
            </div>
            <div className="tiles">
              {lessons
                .filter((l) => l.phase === p.id)
                .map((l) => {
                  const t = tagFor(l.slug);
                  return (
                    <button key={l.slug} type="button" className={`tile ${t.cls}`} aria-current={l.slug === sel ? 'true' : undefined} onClick={() => setSel(l.slug)}>
                      <span className="top">
                        <Plant stage={l.stage} size={44} />
                        <span className="no">{pad(l.order)}</span>
                      </span>
                      <span className="nm">{l.title}</span>
                      <span className="meta">
                        <Pips level={l.level} />
                        <span className="tag">{t.text}</span>
                      </span>
                      {done[l.id] && (
                        <span className="tick" role="img" aria-label="เรียนแล้ว">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M5 12.5l4.5 4.5L19 7.5" />
                          </svg>
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          </motion.section>
        ))}
      </div>

      <div aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={cur.slug}
            className="panel"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <div className="head">
              <Plant stage={cur.stage} size={56} />
              <div>
                <h3>{cur.title}</h3>
                <span className="sub">
                  หัวข้อ {pad(cur.order)} · ช่วง {cur.phase} · {STAGE_LABEL[cur.stage]}
                </span>
              </div>
            </div>
            <div className="panel-detail">
              <div className="actions">
                <Pips level={cur.level} />
                {cur.format === 'steps' && <span className="badge">เรียนทีละขั้น</span>}
              </div>
              <p>{cur.summary}</p>
              <dl>
                <dt>ต้องรู้มาก่อน</dt>
                <dd>{chips(cur.requires)}</dd>
                <dt>ใช้ต่อใน</dt>
                <dd>{chips(nextOf[cur.slug])}</dd>
              </dl>
            </div>
            <div className="actions">
              <a className="btn primary" href={cur.href}>
                {cur.stage === 'seed' ? 'ดูโครงบทเรียน' : 'เปิดบทเรียน'}
              </a>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
