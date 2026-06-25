import { cardClass } from "@/components/ui";

// Shown instantly on every navigation while the dynamic page fetches Notion, so
// switching tabs reads as "loading" rather than a frozen blank screen.
export default function Loading() {
  return (
    <div className="grid animate-pulse gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={`h-32 ${cardClass}`} />
      ))}
    </div>
  );
}
