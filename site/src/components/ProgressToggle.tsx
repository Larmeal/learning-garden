import type { PageItem } from './PageList';
import { useLessonStatus } from './useProgress';

// Tick for reading mode. It ticks this page only, and only once every question on it is answered.
// The lesson's tree grows once all its pages are ticked.
export default function ProgressToggle({ pageId, pages }: { pageId: string; pages: PageItem[] }) {
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
        {s.pageDone ? 'อ่านจบแล้ว (กดเพื่อยกเลิก)' : many ? 'ติ๊กว่าอ่านหน้านี้จบแล้ว' : 'ติ๊กว่าอ่านจบแล้ว'}
      </button>
      {locked && <span className="cta-note">ตอบคำถามให้ครบก่อน (เหลือ {s.left} ข้อ) แล้วจึงติ๊กได้</span>}
      {many && s.pageDone && !s.lessonFinished && (
        <span className="cta-note">
          ต้นไม้ของบทนี้จะโตเต็มที่เมื่อครบทุกหน้า เหลืออีก:{' '}
          {left.map((p, i) => (
            <span key={p.id}>
              {i > 0 && ', '}
              <a href={p.href}>{p.title}</a>
            </span>
          ))}
        </span>
      )}
      {many && s.lessonFinished && <span className="cta-note">ครบทุกหน้าแล้ว ต้นไม้ของบทนี้โตเต็มที่</span>}
    </div>
  );
}
