import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

import IconButtonHarness from "./test-stubs/IconButtonHarness.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("icon button runtime smoke", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("keeps shared icon button on icon-btn primitive and preserves click behavior", async () => {
    const onClick = vi.fn();
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(IconButtonHarness, {
      target,
      props: {
        onClick,
      },
    });
    await flushUi();

    const button = target.querySelector(
      ".ds-ui-icon-button.icon-btn.icon-btn--sm.icon-harness-btn",
    ) as HTMLButtonElement | null;
    expect(button).not.toBeNull();

    const label = target.querySelector(".ds-ui-icon-button-label");
    expect(label?.textContent).toContain("Add");
    expect(button?.getAttribute("title")).toBe("Add item");
    expect(button?.getAttribute("aria-label")).toBe("Add item");
    expect(button?.getAttribute("aria-pressed")).toBe("false");
    expect(button?.getAttribute("type")).toBe("button");

    button?.click();
    await flushUi();

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(target.querySelector('[data-testid="icon-button-harness-count"]')?.textContent).toBe("1");
    expect(button?.getAttribute("aria-pressed")).toBe("true");
  });
});
