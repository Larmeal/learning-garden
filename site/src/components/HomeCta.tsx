import { nextStep, type CtaLesson } from './ContinueCta';
import { useProgress } from './useProgress';

export interface HomeSubject {
  name: string;
  lessons: CtaLesson[];
}

// Main call to action of the home page. Continues the first subject the learner has started and not finished;
// with no progress yet it starts the first subject that has a lesson to read.
export default function HomeCta({ subjects }: { subjects: HomeSubject[] }) {
  const { done } = useProgress();
  const steps = subjects.map((s) => ({ s, step: nextStep(s.lessons, done) })).filter((x) => x.step);
  if (steps.length === 0) return null;

  const started = steps.find((x) => x.step!.doneCount > 0 && x.step!.next);
  const pick = started ?? steps.find((x) => x.step!.next) ?? steps[0];
  const { s, step } = pick;
  const label = started ? `เรียน ${s.name} ต่อ` : step!.next ? `เริ่มเรียน ${s.name}` : `ทบทวน ${s.name}`;

  return (
    <a className="btn primary lg" href={step!.href}>
      {label}
    </a>
  );
}
