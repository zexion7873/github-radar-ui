import { fetchTrending, latestPerRepo } from "@/lib/data";
import { TABLES } from "@/lib/config";
import TrendingList from "@/components/TrendingList";
import { DataError } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Page() {
  const result = await fetchTrending(TABLES.trending);
  if (!result.ok) return <DataError error={result.error} />;
  // Collapse the weekly archive to one row per repo (latest week) so the list
  // shows distinct repos rather than the same repo repeated across weeks.
  return <TrendingList rows={latestPerRepo(result.rows)} />;
}
