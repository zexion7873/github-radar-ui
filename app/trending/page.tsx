import {
  fetchTrending,
  latestPerRepo,
  weeklySeriesByRepo,
  momentumByRepo,
} from "@/lib/data";
import { TABLES } from "@/lib/config";
import TrendingList from "@/components/TrendingList";
import { DataError } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Page() {
  const result = await fetchTrending(TABLES.trending);
  if (!result.ok) return <DataError error={result.error} />;
  // The full archive feeds the series and momentum; the list shows latestPerRepo().
  const series = weeklySeriesByRepo(result.rows);
  return (
    <TrendingList
      rows={latestPerRepo(result.rows)}
      series={series}
      momentum={momentumByRepo(series)}
    />
  );
}
