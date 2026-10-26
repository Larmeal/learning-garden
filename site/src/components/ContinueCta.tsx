import { isFinished, useProgress } from './useProgress';

export interface CtaLesson {
  id: string;
  title: string;
  href: string;
  pages: { id: string; href: string }[];
  stage: 'seed' | 'sprout' | 'evergreen';
}

/** Where a learner goes next in one subject: the next grown lesson not yet finished, or the first one when all are. */
export function nextStep(lessons: CtaLesson[], done: Record<string, boolean>) {
  const grown = lessons.filter((l) => l.stage !== 'seed');
  const fin = (l: CtaLesson) => isFinished(done, l.pages.map((p) => p.id));
  const doneCount = grown.filter(fin).length;
  const next = grown.find((l) => !fin(l));
  const target = next ?? grown[0];
  if (!target) return null;
  // Open the first page of that lesson the learner has not ticked yet.
  const href = (next ? next.pages.find((p) => !done[p.id])?.href : undefined) ?? target.href;
  return { grown: grown.length, doneCount, next, target, href };
}

// Main call to action for a subject: start the first grown lesson, or continue with the next one not yet finished.
export default function ContinueCta({ lessons }: { lessons: CtaLesson[] }) {
  const { done } = useProgress();
  const step = nextStep(lessons, done);
  if (!step) return null;
  const { grown, doneCount, next, target, href: targetHref } = step;
  const label = doneCount === 0 ? 'เริ่มเรียนบทแรก' : next ? 'เรียนต่อ' : 'ทบทวนตั้งแต่ต้น';

  return (
    <div className="cta-block">
      <a className="btn primary lg" href={targetHref}>
        {label}
      </a>
      <span className="cta-note">
        {doneCount > 0 && <>เรียนแล้ว {doneCount} จาก {grown} บทที่เปิดอยู่ · </>}
        {!next ? 'เรียนครบทุกบทที่เปิดอยู่แล้ว' : doneCount === 0 ? `เริ่มที่: ${target.title}` : `บทถัดไป: ${target.title}`}
      </span>
    </div>
  );
}
