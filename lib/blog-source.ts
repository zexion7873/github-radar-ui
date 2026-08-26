// Blog rows were written with drifting `Source` strings (guest-author orgs like
// "Photoroom", suffix variants like "Sebastian Raschka (Ahead of AI)", "Meta" vs
// "Meta AI") — so the post URL's host, not the written Source, is the stable
// identity. Fold each row to its watch-list name by domain; unknown domains and
// unparsable URLs keep the written Source so no row ever loses its label.
//
// Kept free of `server-only` so vitest can import it; `lib/data.ts` applies it
// at row-mapping time.
const SOURCE_BY_DOMAIN: readonly [string, string][] = [
  ["anthropic.com", "Anthropic"],
  ["claude.com", "Anthropic"],
  ["openai.com", "OpenAI"],
  ["deepmind.google", "Google DeepMind"],
  ["research.google", "Google Research"],
  ["ai.meta.com", "Meta AI"],
  ["mistral.ai", "Mistral"],
  ["huggingface.co", "Hugging Face"],
  ["qwenlm.github.io", "Qwen"],
  ["qwen.ai", "Qwen"],
  ["langchain.com", "LangChain"],
  ["llamaindex.ai", "LlamaIndex"],
  ["x.ai", "xAI"],
  ["karpathy.bearblog.dev", "Andrej Karpathy"],
  ["karpathy.github.io", "Andrej Karpathy"],
  ["lilianweng.github.io", "Lilian Weng"],
  ["simonwillison.net", "Simon Willison"],
  ["sebastianraschka.com", "Sebastian Raschka"],
  ["interconnects.ai", "Nathan Lambert"],
  ["huyenchip.com", "Chip Huyen"],
  ["eugeneyan.com", "Eugene Yan"],
  ["hamel.dev", "Hamel Husain"],
  ["latent.space", "Latent Space"],
  ["jasonwei.net", "Jason Wei"],
];

export function canonicalBlogSource(
  url: string | null,
  written: string,
): string {
  if (!url) return written;
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return written;
  }
  for (const [domain, name] of SOURCE_BY_DOMAIN) {
    if (host === domain || host.endsWith("." + domain)) return name;
  }
  return written;
}
