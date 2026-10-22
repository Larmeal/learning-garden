import Plant, { type PlantStage } from './Plant';
import { plantStage, useProgress } from './useProgress';

const LABEL: Record<PlantStage, string> = {
  seed: 'เมล็ด (เนื้อหายังเป็นโครง)',
  sprout: 'ต้นอ่อน (ยังเรียนไม่จบ)',
  evergreen: 'โตเต็มที่ (เรียนจบแล้ว)',
};

// Small plant plus label in the lesson header, driven by this learner's progress.
export default function GrowthBadge({ lessonId, content }: { lessonId: string; content: PlantStage }) {
  const { done } = useProgress();
  const stage = plantStage(content, !!done[lessonId]);
  return (
    <span className="stage" title="ต้นนี้โตตามที่คุณเรียน">
      <Plant stage={stage} size={26} sway />
      {LABEL[stage]}
    </span>
  );
}
