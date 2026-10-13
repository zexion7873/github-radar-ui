"use server";

import { cookies } from "next/headers";
import { updateTag } from "next/cache";
import { updateSelect } from "@/lib/notion";
import { fetchLoot, lootCacheTag, LOOT_PROPS } from "@/lib/data";
import { LOOT_TARGETS, LOOT_STATUSES } from "@/lib/config";
import { isAuthed } from "@/lib/auth";

// Notion's Status select options for loot rows. The action rejects anything else
// so a malformed POST can't spawn a stray option in Notion.
const STATUSES = new Set<string>(LOOT_STATUSES);

// proxy.ts does NOT cover Server Actions (they POST to their own route), so the
// session is verified here too — same constant-time check as the proxy gate.
async function assertAuthed() {
  if (!isAuthed((await cookies()).get("gh_radar")?.value)) {
    throw new Error("unauthorized");
  }
}

// Both arguments come from the client: without this, an authed user could PATCH
// any page the token reaches. hasOwn, not `in`, which accepts "constructor".
async function assertLootPage(target: string, pageId: string): Promise<string> {
  if (!Object.hasOwn(LOOT_TARGETS, target)) {
    throw new Error("unknown loot target");
  }
  const { uuid } = LOOT_TARGETS[target as keyof typeof LOOT_TARGETS];
  const result = await fetchLoot(uuid);
  if (!result.ok || !result.rows.some((row) => row.id === pageId)) {
    throw new Error("unknown loot page");
  }
  return uuid;
}

export async function setLootStatus(
  target: string,
  pageId: string,
  status: string,
) {
  await assertAuthed();
  if (!STATUSES.has(status)) throw new Error(`invalid status: ${status}`);
  const uuid = await assertLootPage(target, pageId);

  await updateSelect(pageId, LOOT_PROPS.status, status);
  // updateTag (not revalidateTag) gives read-your-writes: the next read waits for
  // fresh data instead of serving the stale cache, so a reload shows the new Status.
  updateTag(lootCacheTag(uuid));
}
