import { describe, expect, it } from "vitest";

import { summarizeIndustryUsage } from "./trending";

describe("summarizeIndustryUsage", () => {
  it("sums usage across multiple templates sharing the same vertical", () => {
    const result = summarizeIndustryUsage([
      { vertical: "RESTAURANT", _count: { videoProjects: 10 } },
      { vertical: "RESTAURANT", _count: { videoProjects: 5 } },
      { vertical: "REAL_ESTATE", _count: { videoProjects: 3 } },
    ]);
    expect(result).toEqual([
      { vertical: "RESTAURANT", count: 15 },
      { vertical: "REAL_ESTATE", count: 3 },
    ]);
  });

  it("sorts descending by total usage", () => {
    const result = summarizeIndustryUsage([
      { vertical: "RETAIL", _count: { videoProjects: 2 } },
      { vertical: "FINANCE", _count: { videoProjects: 8 } },
      { vertical: "HOSPITAL", _count: { videoProjects: 5 } },
    ]);
    expect(result.map((r) => r.vertical)).toEqual(["FINANCE", "HOSPITAL", "RETAIL"]);
  });

  it("drops verticals with zero usage rather than showing a hollow tile", () => {
    const result = summarizeIndustryUsage([
      { vertical: "RESTAURANT", _count: { videoProjects: 0 } },
      { vertical: "REAL_ESTATE", _count: { videoProjects: 4 } },
    ]);
    expect(result).toEqual([{ vertical: "REAL_ESTATE", count: 4 }]);
  });

  it("respects the limit", () => {
    const result = summarizeIndustryUsage(
      [
        { vertical: "RESTAURANT", _count: { videoProjects: 10 } },
        { vertical: "REAL_ESTATE", _count: { videoProjects: 9 } },
        { vertical: "FINANCE", _count: { videoProjects: 8 } },
      ],
      2
    );
    expect(result).toHaveLength(2);
  });

  it("returns an empty array when no templates have any usage", () => {
    expect(summarizeIndustryUsage([{ vertical: "OTHER", _count: { videoProjects: 0 } }])).toEqual([]);
  });
});
