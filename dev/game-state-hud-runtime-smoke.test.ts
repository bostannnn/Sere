import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");
  const selectedCharID = writable(0);
  const DBState = {
    db: {
      characters: [
        {
          gameState: {
            hunger: 3,
            health: 5,
            willpower: 4,
            humanity: 7,
            blood: 8,
            vitae: 2,
            sanity: 6,
            candles: 1,
            momentum: 9,
            night_cycle: "deep",
          },
        },
      ],
    },
  };
  return {
    DBState,
    selectedCharID,
  };
});

import GameStateHud from "src/lib/SideBars/GameStateHUD.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("game state hud runtime smoke", () => {
  beforeEach(() => {
    if (!("animate" in Element.prototype)) {
      Object.defineProperty(Element.prototype, "animate", {
        writable: true,
        configurable: true,
        value: () => ({
          finished: Promise.resolve(),
          cancel: () => {},
          play: () => {},
          onfinish: null,
        }),
      });
    }
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("applies control-chip primitives to ribbon stats", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(GameStateHud, { target });
    await flushUi();

    const chips = [...document.querySelectorAll(".ribbon-chip")] as HTMLElement[];
    expect(chips.length).toBeGreaterThan(0);
    expect(chips.every((chip) => chip.classList.contains("control-chip"))).toBe(true);

    const moreIndicator = document.querySelector(".more-indicator") as HTMLElement | null;
    expect(moreIndicator).not.toBeNull();
    expect(moreIndicator?.classList.contains("control-chip")).toBe(true);
  });

  it("uses panel-shell primitive for expanded stat cards", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(GameStateHud, { target });
    await flushUi();

    const toggle = document.querySelector(".hud-main-bar") as HTMLButtonElement | null;
    expect(toggle).not.toBeNull();
    toggle?.click();
    await flushUi();

    const expandedOverlay = document.querySelector(".hud-expanded-overlay") as HTMLElement | null;
    expect(expandedOverlay).not.toBeNull();

    const fullItems = [...document.querySelectorAll(".hud-full-item")] as HTMLElement[];
    expect(fullItems.length).toBeGreaterThan(0);
    expect(fullItems.every((item) => item.classList.contains("panel-shell"))).toBe(true);
  });
});
