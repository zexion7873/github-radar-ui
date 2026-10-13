// A line with no trailing \p{P} is a label: over the live archive, 1207 such lines
// were all labels and 2156 punctuated ones all body. Not `server-only`, for vitest.
const LABEL_MAX = 48;

const isLabel = (text: string): boolean =>
  text.length <= LABEL_MAX && !/\p{P}$/u.test(text);

export type SummaryBlock = { text: string; label: boolean };

export function splitSummary(summary: string): SummaryBlock[] {
  const out: SummaryBlock[] = [];
  for (const raw of summary.split(/\n{2,}/)) {
    const block = raw.trim();
    if (!block) continue;
    // A lone \n glues a label to its cluster (all 133 such blocks open with one),
    // so peel the line off instead of demoting it.
    const nl = block.indexOf("\n");
    const head = nl === -1 ? block : block.slice(0, nl).trim();
    // Never the opening block: a one-block summary would render as a head with no body.
    if (out.length > 0 && isLabel(head)) {
      out.push({ text: head, label: true });
      const body = nl === -1 ? "" : block.slice(nl + 1).trim();
      if (body) out.push({ text: body, label: false });
      continue;
    }
    out.push({ text: block, label: false });
  }
  return out;
}
