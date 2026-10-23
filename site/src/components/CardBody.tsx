import Plant, { type PlantStage } from './Plant';
import { isFinished, plantStage, useProgress } from './useProgress';

// Lower half of a subject card on the home page: one plant per lesson, grown by this learner's progress.
export default function CardBody({ lessons, grown }: { lessons: { id: string; stage: PlantStage; pages: string[] }[]; grown: number }) {
  const { done } = useProgress();
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
          เปิดแล้ว {grown} จาก {lessons.length} บท{finished > 0 && <> · เรียนจบ {finished}</>}
        </span>
        <span className="btn sm primary" aria-hidden="true">
          เปิดแปลง
        </span>
      </div>
    </>
  );
}
