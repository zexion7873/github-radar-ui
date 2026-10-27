import {
  fetchTrending,
  latestPerRepo,
  currentChart,
  weeklySeriesByRepo,
  momentumByRepo,
} from "@/lib/data";
import { TABLES } from "@/lib/config";

// Read by the zexion7873/zexion7873 profile README Action. Renaming a key or
// leaking a non-public field (Notion ids, other columns) changes a public contract.
export async function GET() {
  const result = await fetchTrending(TABLES.trending);
  if (!result.ok) return unavailable(result.error);

  // Same ranking as the dashboard's 本週 lead.
  const { latestWeek, onChart } = currentChart(latestPerRepo(result.rows));
  if (onChart.length === 0) return unavailable("No trending rows");
  const top = [...onChart]
    .sort((a, b) => (b.starsPerWeek ?? 0) - (a.starsPerWeek ?? 0))
    .slice(0, 3);
  // The full archive, not latestPerRepo: the dashboard's ×N comes from the same call.
  const momentum = momentumByRepo(weeklySeriesByRepo(result.rows));

  return Response.json(
    {
      week: latestWeek,
      repos: top.map((r) => ({
        repo: r.repo,
        link: r.link,
        starsPerWeek: r.starsPerWeek,
        momentum: momentum[r.repo] ?? null,
        summary: r.description,
        take: r.comment,
      })),
    },
    { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } },
  );
}

// A cached error would let the Action read a stale failure as fresh.
function unavailable(error: string) {
  return Response.json({ error }, { status: 503, headers: { "Cache-Control": "no-store" } });
}
