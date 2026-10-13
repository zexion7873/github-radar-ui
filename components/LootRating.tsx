// Read-only, so assistive tech gets one image, not a row of controls.
export default function LootRating({ value }: { value: number | null }) {
  const display = value ?? 0;
  return (
    <div
      role="img"
      aria-label={display > 0 ? `推薦評分:${display} / 5 星` : "尚未評分"}
      className="flex items-center gap-0.5 text-2xl leading-none"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          aria-hidden
          className={n <= display ? "text-accent" : "text-muted"}
        >
          ★
        </span>
      ))}
    </div>
  );
}
