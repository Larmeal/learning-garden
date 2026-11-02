import { nextStep, type CtaLesson } from './ContinueCta';
import { useProgress } from './useProgress';
import { ui, type Lang } from '../i18n';

export interface HomeSubject {
  name: string;
  lessons: CtaLesson[];
}

// Main call to action of the home page. Continues the first subject the learner has started and not finished;
// with no progress yet it starts the first subject that has a lesson to read.
export default function HomeCta({ subjects, lang = 'th' }: { subjects: HomeSubject[]; lang?: Lang }) {
  const { done } = useProgress();
  const t = ui[lang].cta;
  const steps = subjects.map((s) => ({ s, step: nextStep(s.lessons, done) })).filter((x) => x.step);
  if (steps.length === 0) return null;

  const started = steps.find((x) => x.step!.doneCount > 0 && x.step!.next);
  const pick = started ?? steps.find((x) => x.step!.next) ?? steps[0];
  const { s, step } = pick;
  const label = started ? t.homeContinue(s.name) : step!.next ? t.homeStart(s.name) : t.homeReview(s.name);

  return (
    <a className="btn primary lg" href={step!.href}>
      {label}
    </a>
  );
}
