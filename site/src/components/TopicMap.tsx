import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Pips from './Pips';
import Plant, { type PlantStage } from './Plant';
import SubjectGarden from './SubjectGarden';
import { isFinished, plantStage, useProgress } from './useProgress';
import type { PageItem } from './PageList';
import { ui, type Lang } from '../i18n';

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
  pages: PageItem[];
}
export interface MapPhase {
  id: string;
  title: string;
  check: string;
}

const finished = (done: Record<string, boolean>, l: MapLesson) => isFinished(done, l.pages.map((p) => p.id));
const pad = (n: number) => String(n).padStart(2, '0');

export default function TopicMap({ lessons, phases, initial, lang = 'th' }: { lessons: MapLesson[]; phases: MapPhase[]; initial: string; lang?: Lang }) {
  const t = ui[lang].map;
  const stageName = ui[lang].stage;
  const STATE_LABEL = { seed: t.seedClosed, sprout: stageName.sprout, evergreen: ui[lang].garden.grown } as const;
  const [sel, setSel] = useState(initial);
  const [hover, setHover] = useState<string | null>(null);
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
    if (slug === sel) return { cls: 'sel', text: t.selected };
    if (cur.requires.includes(slug)) return { cls: 'pre', text: t.before };
    if (nextOf[sel].includes(slug)) return { cls: 'nxt', text: t.after };
    return { cls: '', text: '' };
  };

  const chips = (slugs: string[]) =>
    slugs.length === 0 ? (
      <span className="none">{t.none}</span>
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
        <SubjectGarden lessons={lessons} done={done} sel={sel} hover={hover} onSelect={setSel} onHover={setHover} lang={lang} />
        <div className="legend" aria-hidden="true">
          <span>
            {t.difficulty} <Pips level={3} lang={lang} /> {t.outOf5}
          </span>
          <span className="legend-item">
            <span className="tag-chip sel">{t.selected}</span>
            {t.legendSelected}
          </span>
          <span className="legend-item">
            <span className="tag-chip pre">{t.before}</span>
            {t.legendBefore}
          </span>
          <span className="legend-item">
            <span className="tag-chip nxt">{t.after}</span>
            {t.legendAfter}
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
                <span className="check">{t.selfCheck} {p.check}</span>
              </div>
            </div>
            <div className="tiles">
              {lessons
                .filter((l) => l.phase === p.id)
                .map((l) => {
                  const t = tagFor(l.slug);
                  return (
                    <button key={l.slug} type="button" className={`tile ${t.cls}`} aria-current={l.slug === sel ? 'true' : undefined} onClick={() => setSel(l.slug)} onMouseEnter={() => setHover(l.slug)} onMouseLeave={() => setHover(null)}>
                      <span className="top">
                        <Plant stage={plantStage(l.stage, finished(done, l))} size={44} />
                        <span className="no">{pad(l.order)}</span>
                      </span>
                      <span className="nm">{l.title}</span>
                      <span className="meta">
                        <Pips level={l.level} lang={lang} />
                        <span className="tag">{t.text}</span>
                      </span>
                      {finished(done, l) && (
                        <span className="tick" role="img" aria-label={t.learned}>
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
              <Plant stage={plantStage(cur.stage, finished(done, cur))} size={56} sway />
              <div>
                <h3>{cur.title}</h3>
                <span className="sub">
                  {t.topic(pad(cur.order), cur.phase, STATE_LABEL[plantStage(cur.stage, finished(done, cur))])}
                </span>
              </div>
            </div>
            <div className="panel-detail">
              <div className="actions">
                <Pips level={cur.level} lang={lang} />
                {cur.format === 'steps' && <span className="badge">{t.stepByStep}</span>}
              </div>
              <p>{cur.summary}</p>
              <dl>
                {cur.pages.length > 1 && (
                  <>
                    <dt>{t.pagesIn}</dt>
                    <dd className="pages">
                      {cur.pages.map((p) => (
                        <a key={p.id} className={`chip${done[p.id] ? ' done' : ''}`} href={p.href}>
                          {done[p.id] && '✓ '}
                          {ui[lang].kind[p.kind]}: {p.title}
                        </a>
                      ))}
                    </dd>
                  </>
                )}
                <dt>{t.requires}</dt>
                <dd>{chips(cur.requires)}</dd>
                <dt>{t.unlocks}</dt>
                <dd>{chips(nextOf[cur.slug])}</dd>
              </dl>
            </div>
            <div className="actions">
              <a className="btn primary" href={cur.href}>
                {cur.stage === 'seed' ? t.outline : t.open}
              </a>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
