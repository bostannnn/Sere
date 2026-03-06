import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

const mocks = vi.hoisted(() => ({
  openURL: vi.fn(),
  toggleFullscreen: vi.fn(),
}));

vi.mock(import("src/ts/globalApi.svelte"), () => ({
  openURL: mocks.openURL,
  toggleFullscreen: mocks.toggleFullscreen,
}));

import GithubStars from "src/lib/Others/GithubStars.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("github stars runtime smoke", () => {
  beforeEach(() => {
    mocks.openURL.mockClear();
    mocks.toggleFullscreen.mockClear();
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("keeps shortcut buttons on icon-btn primitives and dispatches actions", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(GithubStars, { target });
    await flushUi();

    const iconLinks = Array.from(
      document.querySelectorAll(".ds-github-stars-icon-link.icon-btn.icon-btn--md"),
    ) as HTMLButtonElement[];
    expect(iconLinks.length).toBe(4);
    expect(iconLinks.map((button) => button.type)).toEqual([
      "button",
      "button",
      "button",
      "button",
    ]);
    expect(iconLinks.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Open RisuAI website",
      "Open RisuAI Patreon",
      "Send email to RisuAI",
      "Toggle fullscreen",
    ]);
    iconLinks.forEach((button) => {
      expect(button.title.length).toBeGreaterThan(0);
      expect(button.title).toBe(button.getAttribute("aria-label"));
    });

    iconLinks.forEach((button) => button.click());
    await flushUi();

    const githubButton = document.querySelector(
      ".github-button.ds-github-stars-button",
    ) as HTMLAnchorElement | null;
    expect(githubButton?.getAttribute("href")).toBe("https://github.com/kwaroran/risuAI");

    expect(mocks.openURL).toHaveBeenCalledTimes(3);
    expect(mocks.toggleFullscreen).toHaveBeenCalledTimes(1);
  });
});
