import { fetchTrending } from "@/lib/data";
import { TABLES } from "@/lib/config";
import TrendingList from "@/components/TrendingList";
import { DataError } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Page() {
  const result = await fetchTrending(TABLES.trending);
  if (!result.ok) return <DataError error={result.error} />;
  return <TrendingList rows={result.rows} />;
}
