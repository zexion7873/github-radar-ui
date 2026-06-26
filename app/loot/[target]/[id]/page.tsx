import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchLoot } from "@/lib/data";
import { LOOT_TARGETS, type LootTarget } from "@/lib/config";
import {
  Badge,
  DataError,
  STATUS_LABEL,
  STATUS_TONE,
  formatWeek,
} from "@/components/ui";
import LootRating from "@/components/LootRating";
import LootStatusControl from "@/components/LootStatusControl";

export const dynamic = "force-dynamic";

// A labelled full-text block. The card clamps these to 3 lines; here they read in
// full, preserving the source line breaks (whitespace-pre-line).
function Prose({ title, children }: { title: string; children: string }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-serif text-xl">{title}</h2>
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

      <header className="flex flex-col gap-2">
        <a
          href={current.link ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="font-serif text-2xl break-all text-foreground transition-colors hover:text-accent"
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
        <h2 className="font-serif text-xl">我的評估</h2>
        <LootRating pageId={current.id} value={current.recommendation} />
        <LootStatusControl pageId={current.id} status={status} />
      </section>

      {past.length > 0 && (
        <section className="flex flex-col gap-5">
          <h2 className="font-serif text-xl">歷次點評</h2>
          {past.map((h) => {
            const hStatus = h.status ?? "new";
            return (
              <article
                key={h.id}
                className="flex flex-col gap-2 border-l-2 border-border pl-4"
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
