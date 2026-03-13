import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("evolution history panel contract", () => {
  it("keeps the history view on the shared all-items state editor path", () => {
    const source = readFileSync(
      "/Users/andrewbostan/Documents/RisuAII/src/lib/SideBars/Evolution/EvolutionHistoryPanel.svelte",
      "utf-8",
    );

    expect(source).toContain("<StateEditor");
    expect(source).toContain("value={selectedVersionState}");
    expect(source).toContain("readonly={true}");
    expect(source).not.toContain('itemFilter="active-only"');
  });
});
