import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mount, tick, unmount } from "svelte";

import EvolutionWorkspaceTabsHarness from "./test-stubs/EvolutionWorkspaceTabsHarness.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("evolution workspace tabs runtime smoke", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("keeps keyboard navigation and focus movement working across extracted tabs", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(EvolutionWorkspaceTabsHarness, { target });
    await flushUi();

    const setupButton = target.querySelector("#evolution-subtab-0") as HTMLButtonElement | null;
    const sectionsButton = target.querySelector("#evolution-subtab-1") as HTMLButtonElement | null;
    const historyButton = target.querySelector("#evolution-subtab-4") as HTMLButtonElement | null;
    const selectedTab = target.querySelector('[data-testid="selected-tab"]');

    expect(setupButton).not.toBeNull();
    expect(sectionsButton).not.toBeNull();
    expect(historyButton).not.toBeNull();
    expect(selectedTab?.textContent).toBe("0");

    setupButton?.focus();
    setupButton?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await flushUi();
    expect(selectedTab?.textContent).toBe("1");
    expect(document.activeElement).toBe(sectionsButton);

    sectionsButton?.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    await flushUi();
    expect(selectedTab?.textContent).toBe("4");
    expect(document.activeElement).toBe(historyButton);

    historyButton?.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    await flushUi();
    expect(selectedTab?.textContent).toBe("0");
    expect(document.activeElement).toBe(setupButton);
  });
});
