import { useProgress } from './useProgress';
import { ui, type Lang } from '../i18n';

export interface PageItem {
  id: string; // progress key
  title: string;
  href: string;
  kind: 'main' | 'deep' | 'quiz';
}

// The pages of one lesson (overview, deep dives, quiz) with a tick on each page the learner finished.
export default function PageList({ pages, currentId, lang = 'th' }: { pages: PageItem[]; currentId?: string; lang?: Lang }) {
  const { done } = useProgress();
  const t = ui[lang];
  const count = pages.filter((p) => done[p.id]).length;
  return (
    <nav className="pagelist" aria-label={t.pages.label}>
      <h2>
        {t.pages.label} <span>{t.pages.readCount(count, pages.length)}</span>
      </h2>
      <ol>
        {pages.map((p) => (
          <li key={p.id}>
            <a href={p.href} aria-current={p.id === currentId ? 'page' : undefined} data-done={done[p.id] ? '' : undefined}>
              <span className="pt">{p.title}</span>
              <span className={`pk ${p.kind}`}>{t.kind[p.kind]}</span>
              <span className="ptick" aria-label={done[p.id] ? t.pages.read : undefined}>
                {done[p.id] && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                )}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
