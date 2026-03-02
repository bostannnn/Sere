import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

import GuiInputPrimitiveHarness from "./test-stubs/GuiInputPrimitiveHarness.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("gui input primitives runtime smoke", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("keeps shared text/number/select inputs on control-field primitive", async () => {
    const onTextInput = vi.fn();
    const onNumberChange = vi.fn();
    const onSelectChange = vi.fn();

    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(GuiInputPrimitiveHarness, {
      target,
      props: {
        onTextInput,
        onNumberChange,
        onSelectChange,
      },
    });

    await flushUi();

    const textInput = target.querySelector("input.gui-harness-text") as HTMLInputElement | null;
    const numberInput = target.querySelector("input.gui-harness-number") as HTMLInputElement | null;
    const selectInput = target.querySelector("select.gui-harness-select") as HTMLSelectElement | null;

    expect(textInput).not.toBeNull();
    expect(numberInput).not.toBeNull();
    expect(selectInput).not.toBeNull();
    expect(textInput?.classList.contains("control-field")).toBe(true);
    expect(numberInput?.classList.contains("control-field")).toBe(true);
    expect(selectInput?.classList.contains("control-field")).toBe(true);

    textInput!.value = "beta";
    textInput!.dispatchEvent(new Event("input", { bubbles: true }));

    numberInput!.value = "7";
    numberInput!.dispatchEvent(new Event("input", { bubbles: true }));
    numberInput!.dispatchEvent(new Event("change", { bubbles: true }));

    selectInput!.value = "b";
    selectInput!.dispatchEvent(new Event("input", { bubbles: true }));
    selectInput!.dispatchEvent(new Event("change", { bubbles: true }));

    await flushUi();

    const values = target.querySelector('[data-testid="gui-input-values"]')?.textContent ?? "";
    expect(values).toContain("beta|7|");
    expect(onTextInput).toHaveBeenCalled();
    expect(onNumberChange).toHaveBeenCalled();
    expect(onSelectChange).toHaveBeenCalled();
  });
});
