import { describe, expect, it } from "vitest";
import {
  askExamples,
  assertProps,
  currentChart,
  latestPerRepo,
  momentumByRepo,
  repoMomentum,
  weeklySeriesByRepo,
  type BlogRow,
  type LootRow,
  type TrendingRow,
  type WeekPoint,
} from "./data";
import { NotionError, type NotionPage } from "./notion";

const trending = (repo: string, week: string | null): TrendingRow => ({
  id: `${repo}-${week}`,
  repo,
  week,
  starsPerWeek: null,
  totalStars: null,
  language: "",
  category: null,
  link: null,
  description: "",
  comment: "",
  weeksOnChart: null,
  maintained: null,
  risk: null,
  license: null,
});

const loot = (repo: string, week: string | null): LootRow => ({
  id: `${repo}-${week}`,
  repo,
  intro: "",
  asset: "",
  type: null,
  week,
  link: null,
  why: "",
  how: "",
  status: null,
  recommendation: null,
  verdict: "",
  maintained: null,
  license: null,
});

describe("assertProps", () => {
  const page = (props: string[]): NotionPage => ({
    id: "p1",
    properties: Object.fromEntries(props.map((k) => [k, {}])),
  });

  it("passes on an empty cell — it checks presence, not population", () => {
    expect(() =>
      assertProps(page(["Repo", "Stars/wk", "Total stars"]), [
        "Repo",
        "Stars/wk",
        "Total stars",
      ]),
    ).not.toThrow();
  });

  it("throws a NotionError naming the missing column", () => {
    const call = () => assertProps(page(["Repo"]), ["Repo", "Total stars"]);
    expect(call).toThrow(NotionError);
    expect(call).toThrow(/missing expected property: Total stars/);
  });

  it("pluralizes when more than one column is missing", () => {
    expect(() =>
      assertProps(page(["Repo"]), ["Repo", "Total stars", "Risk"]),
    ).toThrow(/missing expected properties: Total stars, Risk/);
  });
});

describe("latestPerRepo", () => {
  it("keeps the most recent week per repo", () => {
    const rows = [
      trending("a/x", "2026-06-01"),
      trending("a/x", "2026-06-15"),
      trending("a/x", "2026-06-08"),
      trending("b/y", "2026-05-01"),
    ];
    const out = latestPerRepo(rows);
    expect(out).toHaveLength(2);
    const byRepo = Object.fromEntries(out.map((r) => [r.repo, r.week]));
    expect(byRepo["a/x"]).toBe("2026-06-15");
    expect(byRepo["b/y"]).toBe("2026-05-01");
  });

  it("treats a null week as the oldest so a dated row wins", () => {
    const out = latestPerRepo([
      trending("a/x", null),
      trending("a/x", "2026-06-01"),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].week).toBe("2026-06-01");
  });
});

describe("currentChart", () => {
  it("keeps only repos whose latest week is the newest week in the data", () => {
    const rows = [
      trending("live/a", "2026-06-15"),
      trending("live/b", "2026-06-15"),
      trending("stale/x", "2026-05-01"), // fell off the chart weeks ago
    ];
    const { latestWeek, onChart } = currentChart(rows);
    expect(latestWeek).toBe("2026-06-15");
    expect(onChart.map((r) => r.repo).sort()).toEqual(["live/a", "live/b"]);
  });

  it("excludes null-week rows from the chart", () => {
    const { onChart } = currentChart([
      trending("a/x", "2026-06-15"),
      trending("b/y", null),
    ]);
    expect(onChart.map((r) => r.repo)).toEqual(["a/x"]);
  });

  it("returns an empty chart when no row has a week", () => {
    const { latestWeek, onChart } = currentChart([
      trending("a/x", null),
      trending("b/y", null),
    ]);
    expect(latestWeek).toBe("");
    expect(onChart).toEqual([]);
  });
});

describe("latestPerRepo (loot rows — generic over the row shape)", () => {
  it("keeps the most recent week per repo", () => {
    const out = latestPerRepo([
      loot("a/x", "2026-06-01"),
      loot("a/x", "2026-06-20"),
      loot("b/y", "2026-06-10"),
    ]);
    expect(out).toHaveLength(2);
    const byRepo = Object.fromEntries(out.map((r) => [r.repo, r.week]));
    expect(byRepo["a/x"]).toBe("2026-06-20");
    expect(byRepo["b/y"]).toBe("2026-06-10");
  });
});

describe("weeklySeriesByRepo", () => {
  it("groups by repo and sorts each series ascending by week", () => {
    const series = weeklySeriesByRepo([
      trending("a/x", "2026-06-15"),
      trending("a/x", "2026-06-01"),
      trending("a/x", "2026-06-08"),
      trending("b/y", "2026-05-01"),
    ]);
    expect(series["a/x"].map((p) => p.week)).toEqual([
      "2026-06-01",
      "2026-06-08",
      "2026-06-15",
    ]);
    expect(series["b/y"].map((p) => p.week)).toEqual(["2026-05-01"]);
  });

  it("keeps a Repo named after an Object.prototype member as its own entry", () => {
    const rows = ["constructor", "__proto__", "toString"].flatMap((repo) => [
      { ...trending(repo, "2026-06-01"), starsPerWeek: 10 },
      { ...trending(repo, "2026-06-08"), starsPerWeek: 30 },
    ]);
    const series = weeklySeriesByRepo(rows);
    for (const repo of ["constructor", "__proto__", "toString"]) {
      expect(Object.hasOwn(series, repo)).toBe(true);
      expect(series[repo].map((p) => p.stars)).toEqual([10, 30]);
    }
    const momentum = momentumByRepo(series);
    expect(Object.hasOwn(momentum, "__proto__")).toBe(true);
    expect(momentum["__proto__"]).toBe(3);
    expect(momentum.constructor).toBe(3);
  });
});

describe("repoMomentum", () => {
  const pt = (week: string, stars: number | null): WeekPoint => ({ week, stars });

  it("returns null with fewer than 2 numeric points", () => {
    expect(repoMomentum([])).toBeNull();
    expect(repoMomentum([pt("2026-06-01", 100)])).toBeNull();
    // latest point is null -> no stars to compare
    expect(repoMomentum([pt("2026-06-01", 100), pt("2026-06-08", null)])).toBeNull();
  });

  it("returns null when the latest week has no stars, never an older week's", () => {
    expect(
      repoMomentum([
        pt("2026-06-01", 100),
        pt("2026-06-08", 300),
        pt("2026-06-15", null),
      ]),
    ).toBeNull();
  });

  it("averages only the prior weeks that have stars", () => {
    // prior non-null = [100], latest = 300 -> 3
    expect(
      repoMomentum([
        pt("2026-06-01", 100),
        pt("2026-06-08", null),
        pt("2026-06-15", 300),
      ]),
    ).toBe(3);
  });

  it("returns latest / mean-of-prior", () => {
    // prior mean = (100 + 200) / 2 = 150, latest = 300 -> 2
    expect(
      repoMomentum([
        pt("2026-06-01", 100),
        pt("2026-06-08", 200),
        pt("2026-06-15", 300),
      ]),
    ).toBe(2);
  });

  it("returns null when the prior baseline is zero", () => {
    expect(
      repoMomentum([pt("2026-06-01", 0), pt("2026-06-08", 50)]),
    ).toBeNull();
  });
});

describe("askExamples", () => {
  const t = (
    repo: string,
    week: string,
    starsPerWeek: number,
    category: string | null,
  ): TrendingRow => ({ ...trending(repo, week), starsPerWeek, category });
  const post = (title: string, archived: string | null): BlogRow => ({
    id: title,
    title,
    url: null,
    source: "",
    type: null,
    author: "",
    published: null,
    archived,
    brief: "",
    summary: "",
    comment: "",
  });
  const now = new Date("2026-10-12T05:00:00Z");

  it("draws from the previous chart week and a post archived 8+ days ago", () => {
    const rows = [
      t("new/hot", "2026-10-12", 9000, "agents"),
      t("a/one", "2026-10-05", 300, "tooling"),
      t("b/two", "2026-10-05", 800, "agents"),
      t("c/three", "2026-10-05", 100, "tooling"),
      t("d/four", "2026-10-05", 50, "other"),
      t("old/x", "2026-09-28", 5000, "models"),
    ];
    const blog = [
      post("Fresh post", "2026-10-10"),
      post("Edge post", "2026-10-05"),
      post("Synced post", "2026-10-04"),
    ];
    expect(askExamples(rows, blog, now)).toEqual([
      "「b/two」是做什麼的？為什麼會紅？",
      "「a/one」適合拿來做什麼？",
      "「Synced post」這篇在講什麼？",
    ]);
  });

  it("still names a repo when the week has no stars/wk", () => {
    const rows = [t("new/hot", "2026-10-12", 9, null), { ...trending("a/one", "2026-10-05") }];
    expect(askExamples(rows, [], now)).toEqual(["「a/one」是做什麼的？為什麼會紅？"]);
  });

  it("returns nothing it cannot prove is indexed", () => {
    const rows = [t("only/week", "2026-10-12", 9000, "agents")];
    expect(askExamples(rows, [post("Fresh post", "2026-10-10"), post("No date", null)], now)).toEqual([]);
  });
});
