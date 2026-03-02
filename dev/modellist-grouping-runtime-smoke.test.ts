import { describe, expect, it, vi } from "vitest";

vi.mock(import("src/ts/storage/database.svelte"), () => ({
  getDatabase: () => ({
    enableCustomFlags: false,
    customFlags: [],
    customModels: [],
  }),
}));

import { getModelList } from "src/ts/model/modellist";

describe("model list grouping runtime smoke", () => {
  it("does not emit duplicate provider groups", () => {
    const grouped = getModelList({ groupedByProvider: true });
    const providerNames = grouped.map((entry) => entry.providerName);

    expect(new Set(providerNames).size).toBe(providerNames.length);

    const asIsGroup = grouped.find((entry) => entry.providerName === "@as-is");
    expect(asIsGroup).toBeDefined();
    expect(asIsGroup?.models.length ?? 0).toBeGreaterThan(1);
  });
});
