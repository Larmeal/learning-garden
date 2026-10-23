import { useProgress } from './useProgress';

export interface PageItem {
  id: string; // progress key
  title: string;
  href: string;
  kind: 'main' | 'deep' | 'quiz';
}
export const KIND_LABEL = { main: 'ภาพรวม', deep: 'ลงลึก', quiz: 'บททดสอบ' } as const;

// The pages of one lesson (overview, deep dives, quiz) with a tick on each page the learner finished.
export default function PageList({ pages, currentId }: { pages: PageItem[]; currentId?: string }) {
  const { done } = useProgress();
  const count = pages.filter((p) => done[p.id]).length;
  return (
    <nav className="pagelist" aria-label="หน้าในบทนี้">
      <h4>
        หน้าในบทนี้ <span>{count}/{pages.length} หน้าที่อ่านจบ</span>
      </h4>
      <ol>
        {pages.map((p) => (
          <li key={p.id}>
            <a href={p.href} aria-current={p.id === currentId ? 'page' : undefined} data-done={done[p.id] ? '' : undefined}>
              <span className={`pk ${p.kind}`}>{KIND_LABEL[p.kind]}</span>
              <span className="pt">{p.title}</span>
              <span className="ptick" aria-label={done[p.id] ? 'อ่านจบแล้ว' : undefined}>
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
