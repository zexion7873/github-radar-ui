import { notFound } from "next/navigation";
import { fetchLoot, latestPerRepo } from "@/lib/data";
import { LOOT_TARGETS, type LootTarget } from "@/lib/config";
import LootBoard from "@/components/LootBoard";
import { ChipLink, ChipScroller, DataError } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ target: string }>;
}) {
  const { target } = await params;
  if (!(target in LOOT_TARGETS)) notFound();
  const { uuid } = LOOT_TARGETS[target as LootTarget];
  const result = await fetchLoot(uuid);
  if (!result.ok) return <DataError error={result.error} />;
  return (
    <div className="flex flex-col gap-4">
      {/* Nav's "Loot" tab only lands on the default target — this row is the
          actual switch, scaling to however many LOOT_TARGETS grows to. */}
      <ChipScroller label="切換 Loot 對象">
        {(Object.keys(LOOT_TARGETS) as LootTarget[]).map((t) => (
          <ChipLink key={t} href={`/loot/${t}`} on={t === target}>
            {LOOT_TARGETS[t].label}
          </ChipLink>
        ))}
      </ChipScroller>
      {/* Collapse to one card per repo (latest week); the detail page gathers
          the earlier weeks for its 歷次點評 section. */}
      <LootBoard
        rows={latestPerRepo(result.rows)}
        target={target as LootTarget}
      />
    </div>
  );
}
