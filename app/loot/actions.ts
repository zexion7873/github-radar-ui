"use server";

import { cookies } from "next/headers";
import { updateTag } from "next/cache";
import { updateSelect, updateNumber } from "@/lib/notion";

// Notion's Status select options for loot rows. The action rejects anything else
// so a malformed POST can't spawn a stray option in Notion.
const STATUSES = new Set(["new", "adopted", "skipped"]);

// proxy.ts does NOT cover Server Actions (they POST to their own route), so the
// session is verified here too — same cookie/secret check as the proxy gate.
export async function setLootStatus(pageId: string, status: string) {
  const secret = process.env.AUTH_SECRET;
  const authed = !!secret && (await cookies()).get("gh_radar")?.value === secret;
  if (!authed) throw new Error("unauthorized");
  if (!STATUSES.has(status)) throw new Error(`invalid status: ${status}`);

  await updateSelect(pageId, "Status", status);
  // updateTag (not revalidateTag) gives read-your-writes: the next read waits for
  // fresh data instead of serving the stale cache, so a reload shows the new Status.
  updateTag("notion");
}

// Recommendation is 1-5; 0 clears the cell. Same session check as setLootStatus.
export async function setLootRecommendation(pageId: string, value: number) {
  const secret = process.env.AUTH_SECRET;
  const authed = !!secret && (await cookies()).get("gh_radar")?.value === secret;
  if (!authed) throw new Error("unauthorized");
  if (!Number.isInteger(value) || value < 0 || value > 5) {
    throw new Error(`invalid rating: ${value}`);
  }

  await updateNumber(pageId, "Recommendation", value === 0 ? null : value);
  updateTag("notion");
}
