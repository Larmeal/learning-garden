import { useLessonStatus } from './useProgress';

// Tick for reading mode. Matches the player: a lesson with questions can only be ticked once they are all answered.
export default function ProgressToggle({ lessonId }: { lessonId: string }) {
  const s = useLessonStatus(lessonId);
  const locked = !s.finished && !s.canFinish;
  return (
    <div className="tick-block">
      <button type="button" className={s.finished ? 'btn' : 'btn primary'} onClick={s.toggle} disabled={locked} aria-pressed={s.finished}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
        {s.finished ? 'อ่านจบแล้ว (กดเพื่อยกเลิก)' : 'ติ๊กว่าอ่านจบแล้ว'}
      </button>
      {locked && <span className="cta-note">ตอบคำถามให้ครบก่อน (เหลือ {s.left} ข้อ) แล้วต้นไม้ของบทนี้จะโตได้</span>}
    </div>
  );
}
