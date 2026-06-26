import { notFound } from "next/navigation";
import { fetchLoot, latestLootPerRepo } from "@/lib/data";
import { LOOT_TARGETS, type LootTarget } from "@/lib/config";
import LootBoard from "@/components/LootBoard";
import { DataError } from "@/components/ui";

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
  // Collapse to one card per repo (latest week); the detail page gathers the
  // earlier weeks for its 歷次點評 section.
  return (
    <LootBoard
      rows={latestLootPerRepo(result.rows)}
      target={target as LootTarget}
    />
  );
}
