import { afterEach, describe, expect, it } from "vitest";
import { mount, tick, unmount } from "svelte";

import NumberInputHarness from "./test-stubs/NumberInputHarness.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("number input runtime smoke", () => {
  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
    document.body.innerHTML = "";
  });

  it("preserves temporary empty edits without snapping back to the last bound number", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(NumberInputHarness, { target });
    await flushUi();

    const input = target.querySelector("input.number-harness-input") as HTMLInputElement | null;
    const rerenderButton = target.querySelector(
      "button.number-harness-rerender",
    ) as HTMLButtonElement | null;

    expect(input).not.toBeNull();
    expect(rerenderButton).not.toBeNull();

    input!.value = "";
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    await flushUi();

    expect(input!.value).toBe("");
    expect(target.querySelector('[data-testid="number-bound-value"]')?.textContent).toBe("12");
    expect(
      target.querySelector('[data-testid="number-input-callback-values"]')?.textContent,
    ).toBe("12");

    rerenderButton!.click();
    await flushUi();

    expect(input!.value).toBe("");

    input!.dispatchEvent(new Event("change", { bubbles: true }));
    await flushUi();

    expect(input!.value).toBe("12");
    expect(
      target.querySelector('[data-testid="number-change-callback-values"]')?.textContent,
    ).toBe("12");
  });

  it("commits the bound numeric value before firing input and change callbacks", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(NumberInputHarness, { target });
    await flushUi();

    const input = target.querySelector("input.number-harness-input") as HTMLInputElement | null;
    expect(input).not.toBeNull();

    input!.value = "24";
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    await flushUi();

    expect(target.querySelector('[data-testid="number-bound-value"]')?.textContent).toBe("24");
    expect(
      target.querySelector('[data-testid="number-input-callback-values"]')?.textContent,
    ).toBe("24");

    input!.dispatchEvent(new Event("change", { bubbles: true }));
    await flushUi();

    expect(
      target.querySelector('[data-testid="number-change-callback-values"]')?.textContent,
    ).toBe("24");
  });
});
