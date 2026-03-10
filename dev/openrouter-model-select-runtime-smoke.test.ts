import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

vi.mock(import("src/ts/model/openrouter"), () => ({
  openRouterModelsWithState: vi.fn(async () => ({
    models: [],
    status: 503,
    source: "server",
    stale: false,
    updatedAt: null,
    error: "offline",
  })),
}));

import OpenRouterModelSelect from "src/lib/UI/GUI/OpenRouterModelSelect.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("openrouter model select runtime smoke", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("keeps auto options and the current value available when the model list is unavailable", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(OpenRouterModelSelect, {
      target,
      props: {
        value: "openrouter/auto",
      },
    });
    await flushUi();

    const select = target.querySelector("select") as HTMLSelectElement | null;
    expect(select).not.toBeNull();
    expect(select?.value).toBe("openrouter/auto");

    const optionValues = Array.from(target.querySelectorAll("option")).map((option) => option.getAttribute("value"));
    expect(optionValues).toContain("risu/free");
    expect(optionValues).toContain("openrouter/auto");
  });
});
