import { describe, expect, it } from "vitest";
import {
  currentChart,
  latestPerRepo,
  repoMomentum,
  weeklySeriesByRepo,
  type LootRow,
  type TrendingRow,
  type WeekPoint,
} from "./data";

const trending = (repo: string, week: string | null): TrendingRow => ({
  id: `${repo}-${week}`,
  repo,
  week,
  starsPerWeek: null,
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
  maintained: null,
  license: null,
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
});

describe("repoMomentum", () => {
  const pt = (week: string, stars: number | null): WeekPoint => ({ week, stars });

  it("returns null with fewer than 2 numeric points", () => {
    expect(repoMomentum([])).toBeNull();
    expect(repoMomentum([pt("2026-06-01", 100)])).toBeNull();
    // second point is null -> only 1 numeric value survives the filter
    expect(repoMomentum([pt("2026-06-01", 100), pt("2026-06-08", null)])).toBeNull();
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
