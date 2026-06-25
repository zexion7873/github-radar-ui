import { type ReactNode } from "react";

// Shared card surface so every card (trending / loot / stats) gets the same
// border, shadow, and hover lift — change the look once, it propagates.
export const cardClass =
  "rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900";
export const cardInteractive = `${cardClass} transition-shadow duration-200 hover:border-zinc-300 hover:shadow-md dark:hover:border-zinc-700`;

type Tone = "gray" | "blue" | "green" | "amber" | "purple";

const TONE: Record<Tone, string> = {
  gray: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  green: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
};

export function Badge({
  children,
  tone = "gray",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}

export function Notice({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      <p className="font-semibold">{title}</p>
      <div className="mt-2 leading-relaxed">{children}</div>
    </div>
  );
}

export function DataError({ error }: { error: string }) {
  if (error.includes("NOTION_TOKEN")) {
    return (
      <Notice title="Notion token not set">
        <p>
          Add your Notion internal integration token to{" "}
          <code className="font-mono">.env.local</code>:
        </p>
        <pre className="mt-2 overflow-x-auto rounded bg-amber-100 p-2 text-xs dark:bg-amber-900/40">
          NOTION_TOKEN=ntn_xxx
        </pre>
        <p className="mt-2">
          Then share the three archive databases into the integration (Notion →
          ••• → Connections) and reload.
        </p>
      </Notice>
    );
  }
  return (
    <Notice title="Could not read Notion">
      <p className="font-mono text-xs">{error}</p>
      <p className="mt-2">
        Common causes: the database is not shared with the integration, or the
        token / API version is wrong.
      </p>
    </Notice>
  );
}

export function formatWeek(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${Number(m)}/${Number(d)}/${y.slice(2)}`;
}
