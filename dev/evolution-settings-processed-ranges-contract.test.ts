import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("evolution settings processed ranges contract", () => {
  it("passes merged accepted ranges into the setup panel", () => {
    const source = readFileSync(
      "/Users/andrewbostan/Documents/RisuAII/src/lib/SideBars/Evolution/EvolutionWorkspaceContent.svelte",
      "utf-8",
    );

    expect(source).toContain("EvolutionSetupPanel");
    expect(source).toContain("processedRanges={displayedProcessedRanges}");
  });
});
