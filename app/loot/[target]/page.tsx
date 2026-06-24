import { notFound } from "next/navigation";
import { fetchLoot } from "@/lib/data";
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
  return <LootBoard rows={result.rows} />;
}
