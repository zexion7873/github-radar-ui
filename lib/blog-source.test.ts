import { describe, expect, it } from "vitest";
import { canonicalBlogSource } from "./blog-source";

describe("canonicalBlogSource", () => {
  it("folds a guest-author org on the Hugging Face blog into Hugging Face", () => {
    expect(
      canonicalBlogSource(
        "https://huggingface.co/blog/photoroom/some-post",
        "Photoroom",
      ),
    ).toBe("Hugging Face");
  });

  it("matches subdomains of a mapped domain", () => {
    expect(canonicalBlogSource("https://blog.langchain.com/x", "LangChain")).toBe(
      "LangChain",
    );
    expect(
      canonicalBlogSource(
        "https://magazine.sebastianraschka.com/p/x",
        "Sebastian Raschka (Ahead of AI)",
      ),
    ).toBe("Sebastian Raschka");
  });

  it("folds both Anthropic surfaces into one source", () => {
    expect(canonicalBlogSource("https://claude.com/blog/x", "Claude")).toBe(
      "Anthropic",
    );
    expect(
      canonicalBlogSource("https://www.anthropic.com/news/x", "Anthropic"),
    ).toBe("Anthropic");
  });

  it("does not treat a domain as a suffix of an unrelated host", () => {
    // sx.ai must not match x.ai — the match is exact host or dot-boundary suffix
    expect(canonicalBlogSource("https://sx.ai/post", "SX")).toBe("SX");
  });

  it("keeps the written source for unknown domains, null and garbage URLs", () => {
    expect(canonicalBlogSource("https://blog.google/x", "Google")).toBe("Google");
    expect(canonicalBlogSource(null, "Somewhere")).toBe("Somewhere");
    expect(canonicalBlogSource("not a url", "Somewhere")).toBe("Somewhere");
  });
});
