import Plant, { type PlantStage } from './Plant';
import { isFinished, plantStage, useProgress } from './useProgress';

// Small plant plus label in the lesson header, driven by this learner's progress through all the lesson's pages.
export default function GrowthBadge({ pages, content }: { pages: string[]; content: PlantStage }) {
  const { done } = useProgress();
  const stage = plantStage(content, isFinished(done, pages));
  const read = pages.filter((p) => done[p]).length;
  const label: Record<PlantStage, string> = {
    seed: 'เมล็ด (เนื้อหายังเป็นโครง)',
    sprout: pages.length > 1 ? `ต้นอ่อน (อ่านจบ ${read} จาก ${pages.length} หน้า)` : 'ต้นอ่อน (ยังเรียนไม่จบ)',
    evergreen: 'โตเต็มที่ (เรียนจบแล้ว)',
  };
  return (
    <span className="stage" title="ต้นนี้โตตามที่คุณเรียน">
      <Plant stage={stage} size={26} sway />
      {label[stage]}
    </span>
  );
}
