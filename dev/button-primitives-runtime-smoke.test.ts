import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

import ButtonPrimitiveHarness from "./test-stubs/ButtonPrimitiveHarness.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("button primitives runtime smoke", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("keeps shared button wrappers on explicit semantic attributes", async () => {
    const onGuiClick = vi.fn();
    const onRoundedClick = vi.fn();
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(ButtonPrimitiveHarness, {
      target,
      props: { onGuiClick, onRoundedClick },
    });
    await flushUi();

    const guiButton = target.querySelector("button.button-harness-gui") as HTMLButtonElement | null;
    const roundedButton = target.querySelector(
      "button.ds-ui-base-rounded-button",
    ) as HTMLButtonElement | null;
    expect(guiButton).not.toBeNull();
    expect(roundedButton).not.toBeNull();

    expect(guiButton?.getAttribute("type")).toBe("button");
    expect(guiButton?.getAttribute("title")).toBe("GUI action");
    expect(guiButton?.getAttribute("aria-label")).toBe("GUI action");
    expect(guiButton?.getAttribute("aria-pressed")).toBe("false");

    expect(roundedButton?.getAttribute("type")).toBe("button");
    expect(roundedButton?.getAttribute("title")).toBe("Rounded action");
    expect(roundedButton?.getAttribute("aria-label")).toBe("Rounded action");
    expect(roundedButton?.getAttribute("aria-pressed")).toBe("false");

    guiButton?.click();
    roundedButton?.click();
    await flushUi();

    expect(onGuiClick).toHaveBeenCalledTimes(1);
    expect(onRoundedClick).toHaveBeenCalledTimes(1);
    expect(target.querySelector('[data-testid="button-harness-gui-count"]')?.textContent).toBe("1");
    expect(target.querySelector('[data-testid="button-harness-rounded-count"]')?.textContent).toBe("1");
    expect(guiButton?.getAttribute("aria-pressed")).toBe("true");
    expect(roundedButton?.getAttribute("aria-pressed")).toBe("true");
  });
});
