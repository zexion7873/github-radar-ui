// The post's domain, not the drifting written Source, names the watch-list entry;
// unknown domains keep the written Source. Not `server-only`, for vitest.
const SOURCE_BY_DOMAIN: readonly [string, string][] = [
  ["anthropic.com", "Anthropic"],
  ["claude.com", "Anthropic"],
  ["claude.dev", "Anthropic"],
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
