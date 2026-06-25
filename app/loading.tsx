import { cardClass } from "@/components/ui";

// Shown instantly on every navigation while the dynamic page fetches Notion, so
// switching tabs reads as "loading" rather than a frozen blank screen. Kept
// layout-neutral (a controls bar + stacked blocks) so it doesn't promise a
// 3-col grid the dashboard / blog / loot pages won't actually render.
export default function Loading() {
  return (
    <div className="animate-pulse space-y-3">
      <div className={`h-10 w-full ${cardClass}`} />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className={`h-24 ${cardClass}`} />
      ))}
    </div>
  );
}
