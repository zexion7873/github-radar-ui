import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";

// Owner-only pages call this before reading data: proxy.ts's matcher is a routing
// rule, so a request the platform routes past it would otherwise render the ledger.
export async function requireOwner(from: string): Promise<void> {
  if (!isAuthed((await cookies()).get("gh_radar")?.value)) {
    redirect(`/login?from=${encodeURIComponent(from)}`);
  }
}
