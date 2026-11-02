import Plant, { type PlantStage } from './Plant';
import { isFinished, plantStage, useProgress } from './useProgress';
import { ui, type Lang } from '../i18n';

// Lower half of a subject card on the home page: one plant per lesson, grown by this learner's progress.
export default function CardBody({ lessons, grown, lang = 'th', thaiOnly = false }: { lessons: { id: string; stage: PlantStage; pages: string[] }[]; grown: number; lang?: Lang; thaiOnly?: boolean }) {
  const { done } = useProgress();
  const t = ui[lang];
  const finished = lessons.filter((l) => isFinished(done, l.pages)).length;
  return (
    <>
      <div className="bed" aria-hidden="true">
        {lessons.map((l) => (
          <Plant key={l.id} stage={plantStage(l.stage, isFinished(done, l.pages))} size={30} sway />
        ))}
      </div>
      <div className="card-foot">
        <span>
          {t.card.opened(grown, lessons.length)}
          {finished > 0 && t.card.finished(finished)}
          {thaiOnly && ` · ${t.thaiOnly}`}
        </span>
        <span className="btn sm primary" aria-hidden="true">
          {t.card.open}
        </span>
      </div>
    </>
  );
}
