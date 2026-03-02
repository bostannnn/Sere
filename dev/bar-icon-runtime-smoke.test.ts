import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

import BarIcon from "src/lib/SideBars/BarIcon.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("bar icon runtime smoke", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("keeps sidebar icon button on icon-btn primitive and preserves interactive semantics", async () => {
    const onClick = vi.fn();
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(BarIcon, {
      target,
      props: {
        onClick,
        additionalStyle: Promise.resolve("opacity: 0.5;"),
        type: "button",
        title: "Open character",
        ariaLabel: "Open character",
        ariaPressed: true,
      },
    });
    await flushUi();

    const button = document.querySelector(
      ".sidebar-bar-icon-button.icon-btn",
    ) as HTMLButtonElement | null;
    expect(button).not.toBeNull();
    expect(button?.type).toBe("button");
    expect(button?.title).toBe("Open character");
    expect(button?.getAttribute("aria-label")).toBe("Open character");
    expect(button?.getAttribute("aria-pressed")).toBe("true");
    expect(button?.classList.contains("sidebar-bar-icon-interactive")).toBe(true);
    expect(button?.getAttribute("style") ?? "").toContain("opacity: 0.5");

    button?.click();
    await flushUi();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders non-interactive icon container when onClick is absent", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(BarIcon, {
      target,
      props: {
        additionalStyle: Promise.resolve("opacity: 0.25;"),
      },
    });
    await flushUi();

    const staticIcon = document.querySelector(
      ".sidebar-bar-icon-button.sidebar-bar-icon-static.icon-btn",
    ) as HTMLElement | null;
    expect(staticIcon).not.toBeNull();
    expect(staticIcon?.tagName).toBe("DIV");
    expect(staticIcon?.getAttribute("aria-hidden")).toBe("true");
    expect(staticIcon?.getAttribute("style") ?? "").toContain("opacity: 0.25");

    const nestedInteractive = staticIcon?.querySelector("button");
    expect(nestedInteractive).toBeNull();
  });
});
