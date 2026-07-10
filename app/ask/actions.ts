"use server";

import { cookies } from "next/headers";
import { isAuthed } from "@/lib/auth";
import { askRadar, type AskResult } from "@/lib/radar";

// /ask calls Claude and spends tokens, so it's gated like the loot writes. proxy.ts
// only covers /loot/*, so this Server Action verifies the session itself — the same
// constant-time check as the proxy gate.
async function assertAuthed() {
  if (!isAuthed((await cookies()).get("gh_radar")?.value)) {
    throw new Error("unauthorized");
  }
}

export async function ask(question: string): Promise<AskResult> {
  await assertAuthed();
  const base = process.env.RADAR_INTEL_URL;
  if (!base) return { ok: false, error: "尚未設定 RADAR_INTEL_URL" };
  return askRadar(base, question);
}
