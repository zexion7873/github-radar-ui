// Blog Summary is plain text (the writing routine is banned from Markdown — the
// column is also read inside Notion, where markup prints literally) and may precede
// a cluster of paragraphs with a short label on its own line. Terminal punctuation
// separates the two: measured over the live archive, 1207 unpunctuated lines were
// all labels and 2156 punctuated ones all body, with zero overlap. `\p{P}` is
// deliberately wider than terminal punctuation — promoting a sentence into a subhead
// is visible damage, demoting a label just renders it the way it rendered before —
// and the length cap guards the boundary against a future unpunctuated long
// paragraph rather than doing the classifying.
//
// Kept free of `server-only` so vitest can import it; the page applies it at render.
const LABEL_MAX = 48;

const isLabel = (text: string): boolean =>
  text.length <= LABEL_MAX && !/\p{P}$/u.test(text);

export type SummaryBlock = { text: string; label: boolean };

export function splitSummary(summary: string): SummaryBlock[] {
  const out: SummaryBlock[] = [];
  for (const raw of summary.split(/\n{2,}/)) {
    const block = raw.trim();
    if (!block) continue;
    // The routine usually parts a label from the cluster it heads with a blank
    // line, but sometimes glues the two with a lone \n — all 133 such blocks in
    // the archive open with a label, so peel that line off instead of demoting it.
    const nl = block.indexOf("\n");
    const head = nl === -1 ? block : block.slice(0, nl).trim();
    // A label never opens the summary: the routine mandates a lead paragraph, and
    // the guard also keeps a label-shaped one-block summary from rendering as a
    // head with no body.
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
