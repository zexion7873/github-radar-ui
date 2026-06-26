import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchLoot } from "@/lib/data";
import { LOOT_TARGETS, type LootTarget } from "@/lib/config";
import {
  Badge,
  DataError,
  STATUS_LABEL,
  STATUS_TONE,
  STATUS_SPINE,
  formatWeek,
} from "@/components/ui";
import LootRating from "@/components/LootRating";
import LootStatusControl from "@/components/LootStatusControl";

export const dynamic = "force-dynamic";

// A labelled full-text block. The card clamps these to 3 lines; here they read in
// full, preserving the source line breaks (whitespace-pre-line).
function Prose({ title, children }: { title: string; children: string }) {
  return (
    // Dossier field: a mono label rule over the body, so the detail reads as the
    // record behind a worklist item. Loot benches the serifs (its dialect voice),
    // so every heading here is mono, not the editorial serif the other pages use.
    <section className="flex flex-col gap-2 border-t border-border pt-4">
      <h2 className="font-mono text-[11px] tracking-[0.14em] text-muted uppercase">
        {title}
      </h2>
      <p className="text-sm leading-relaxed whitespace-pre-line text-foreground">
        {children}
      </p>
    </section>
  );
}

export default async function Page({
  params,
}: {
  params: Promise<{ target: string; id: string }>;
}) {
  const { target, id } = await params;
  if (!(target in LOOT_TARGETS)) notFound();
  const { uuid, label } = LOOT_TARGETS[target as LootTarget];
  const result = await fetchLoot(uuid);
  if (!result.ok) return <DataError error={result.error} />;

  // id is one weekly row's page id. Find it, then gather every week this repo was
  // shortlisted (newest first) for the 歷次點評 section. Claude's table never
  // repeats a repo, so `past` is usually empty and that section is skipped.
  const current = result.rows.find((r) => r.id === id);
  if (!current) notFound();
  const past = result.rows
    .filter((r) => r.repo === current.repo && r.id !== current.id)
    .sort((a, b) => (b.week ?? "").localeCompare(a.week ?? ""));

  const status = current.status ?? "new";

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <Link
        href={`/loot/${target}`}
        className="font-mono text-[11px] tracking-wide text-muted uppercase transition-colors hover:text-foreground"
      >
        ← {label}
      </Link>

      {/* Worklist dialect echo: the board's status spine carries onto the detail
          header, and the repo wears the same mono voice as the board rows. */}
      <header
        className={`flex flex-col gap-2 border-l-[3px] pl-4 ${STATUS_SPINE[status] ?? "border-l-border"}`}
      >
        <a
          href={current.link ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xl break-all text-foreground transition-colors hover:text-accent"
        >
          {current.repo} ↗
        </a>
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] tracking-wide text-muted uppercase">
          {current.type && <Badge>{current.type}</Badge>}
          <Badge tone={STATUS_TONE[status] ?? "muted"}>
            {STATUS_LABEL[status] ?? status}
          </Badge>
          {current.week && <span>最新 {formatWeek(current.week)}</span>}
        </div>
      </header>

      {current.intro && <Prose title="介紹">{current.intro}</Prose>}
      {current.asset && <Prose title="偷什麼">{current.asset}</Prose>}
      {current.why && <Prose title="為何值得">{current.why}</Prose>}
      {current.how && <Prose title="怎麼搬">{current.how}</Prose>}

      <section className="flex flex-col gap-4 border-y border-border py-6">
        <h2 className="font-mono text-[11px] tracking-[0.14em] text-muted uppercase">
          我的評估
        </h2>
        <LootRating pageId={current.id} value={current.recommendation} />
        <LootStatusControl pageId={current.id} status={status} />
      </section>

      {past.length > 0 && (
        <section className="flex flex-col gap-5 border-t border-border pt-4">
          <h2 className="font-mono text-[11px] tracking-[0.14em] text-muted uppercase">
            歷次點評
          </h2>
          {past.map((h) => {
            const hStatus = h.status ?? "new";
            return (
              <article
                key={h.id}
                className={`flex flex-col gap-2 border-l-[3px] pl-4 ${STATUS_SPINE[hStatus] ?? "border-l-border"}`}
              >
                <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] tracking-wide text-muted uppercase">
                  {h.week && <span>{formatWeek(h.week)}</span>}
                  <Badge tone={STATUS_TONE[hStatus] ?? "muted"}>
                    {STATUS_LABEL[hStatus] ?? hStatus}
                  </Badge>
                  {h.recommendation != null && (
                    <span className="text-accent">
                      {"★".repeat(h.recommendation)}
                    </span>
                  )}
                </div>
                {h.why && (
                  <p className="text-sm leading-relaxed whitespace-pre-line text-foreground">
                    <span className="font-medium text-muted">為何 </span>
                    {h.why}
                  </p>
                )}
                {h.how && (
                  <p className="text-sm leading-relaxed whitespace-pre-line text-foreground">
                    <span className="font-medium text-muted">怎麼搬 </span>
                    {h.how}
                  </p>
                )}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
