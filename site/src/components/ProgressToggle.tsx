import type { PageItem } from './PageList';
import { useLessonStatus } from './useProgress';
import { ui, type Lang } from '../i18n';

// Tick for reading mode. It ticks this page only, and only once every question on it is answered.
// The lesson's tree grows once all its pages are ticked.
export default function ProgressToggle({ pageId, pages, lang = 'th' }: { pageId: string; pages: PageItem[]; lang?: Lang }) {
  const t = ui[lang].tick;
  const s = useLessonStatus(pageId, pages.map((p) => p.id));
  const locked = !s.pageDone && !s.canFinish;
  const many = pages.length > 1;
  const left = pages.filter((p) => s.remaining.includes(p.id));
  return (
    <div className="tick-block">
      <button type="button" className={s.pageDone ? 'btn' : 'btn primary'} onClick={s.toggle} disabled={locked} aria-pressed={s.pageDone}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
        {s.pageDone ? t.done : many ? t.markPage : t.markLesson}
      </button>
      {locked && <span className="cta-note">{t.locked(s.left)}</span>}
      {many && s.pageDone && !s.lessonFinished && (
        <span className="cta-note">
          {t.remaining}{' '}
          {left.map((p, i) => (
            <span key={p.id}>
              {i > 0 && ', '}
              <a href={p.href}>{p.title}</a>
            </span>
          ))}
        </span>
      )}
      {many && s.lessonFinished && <span className="cta-note">{t.allDone}</span>}
    </div>
  );
}
