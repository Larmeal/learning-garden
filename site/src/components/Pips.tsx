// Difficulty 1-5 as filled squares. Server-rendered unless a parent island hydrates it.
export default function Pips({ level }: { level: number }) {
  return (
    <span className="pips" role="img" aria-label={`ความยาก ${level} จาก 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <i key={i} className={i <= level ? 'on' : undefined} />
      ))}
    </span>
  );
}
