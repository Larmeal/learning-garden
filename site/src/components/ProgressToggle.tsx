import { useProgress } from './useProgress';

export default function ProgressToggle({ lessonId }: { lessonId: string }) {
  const { done, toggle } = useProgress();
  const isDone = !!done[lessonId];
  return (
    <button type="button" className={isDone ? 'btn' : 'btn primary'} onClick={() => toggle(lessonId)} aria-pressed={isDone}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
      {isDone ? 'เรียนแล้ว (กดเพื่อยกเลิก)' : 'ทำเครื่องหมายว่าเรียนแล้ว'}
    </button>
  );
}
