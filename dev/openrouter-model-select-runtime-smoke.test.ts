import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

const { mockedOpenRouterModelsWithState } = vi.hoisted(() => ({
  mockedOpenRouterModelsWithState: vi.fn(),
}));

vi.mock(import("src/ts/model/openrouter"), () => ({
  openRouterModelsWithState: mockedOpenRouterModelsWithState,
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
    mockedOpenRouterModelsWithState.mockReset();
    mockedOpenRouterModelsWithState.mockResolvedValue({
      models: [],
      status: 503,
      source: "server",
      stale: false,
      updatedAt: null,
      error: "offline",
    });
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

  it("applies the newly selected model and passes the fresh value to onchange", async () => {
    mockedOpenRouterModelsWithState.mockResolvedValue({
      models: [
        { id: "deepseek/deepseek-v3.2", name: "DeepSeek V3.2", price: 0.00029, context_length: 128000 },
        { id: "mistralai/mistral-large", name: "Mistral Large", price: 0.0004, context_length: 128000 },
      ],
      status: 200,
      source: "server",
      stale: false,
      updatedAt: "2026-03-17T18:58:00.000Z",
      error: "",
    });

    const target = document.createElement("div");
    document.body.appendChild(target);

    const onchange = vi.fn();
    app = mount(OpenRouterModelSelect, {
      target,
      props: {
        value: "deepseek/deepseek-v3.2",
        onchange,
      },
    });
    await flushUi();

    const select = target.querySelector("select") as HTMLSelectElement | null;
    expect(select).not.toBeNull();

    select!.value = "mistralai/mistral-large";
    select!.dispatchEvent(new Event("change", { bubbles: true }));
    await flushUi();

    expect(select?.value).toBe("mistralai/mistral-large");
    expect(onchange).toHaveBeenCalledWith("mistralai/mistral-large");
  });
});
