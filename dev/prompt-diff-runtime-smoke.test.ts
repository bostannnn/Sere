import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

const hoisted = vi.hoisted(() => ({
  onClose: vi.fn(),
  db: {
    promptDiffPrefs: {
      diffStyle: "intraline",
      formatStyle: "card",
      viewStyle: "unified",
      isGrouped: false,
      showOnlyChanges: false,
      contextRadius: 3,
    },
    botPresets: [
      {
        promptTemplate: [
          {
            type: "plain",
            type2: "system",
            role: "system",
            name: "System",
            text: "Shared prompt body",
          },
        ],
      },
      {
        promptTemplate: [
          {
            type: "plain",
            type2: "system",
            role: "system",
            name: "System",
            text: "Shared prompt body",
          },
        ],
      },
    ],
  },
}));

vi.mock(import("src/ts/storage/database.svelte"), () => ({
  getDatabase: () => hoisted.db,
}));

import PromptDiffModal from "src/lib/Others/PromptDiffModal.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function waitForCondition(predicate: () => boolean, attempts = 50) {
  for (let i = 0; i < attempts; i += 1) {
    if (predicate()) {
      return true;
    }
    await flushUi();
  }
  return false;
}

describe("prompt diff runtime smoke", () => {
  beforeEach(() => {
    hoisted.onClose.mockClear();
    hoisted.db.promptDiffPrefs = {
      diffStyle: "intraline",
      formatStyle: "card",
      viewStyle: "unified",
      isGrouped: false,
      showOnlyChanges: false,
      contextRadius: 3,
    };
    hoisted.db.botPresets = [
      {
        promptTemplate: [
          {
            type: "plain",
            type2: "system",
            role: "system",
            name: "System",
            text: "Shared prompt body",
          },
        ],
      },
      {
        promptTemplate: [
          {
            type: "plain",
            type2: "system",
            role: "system",
            name: "System",
            text: "Shared prompt body",
          },
        ],
      },
    ];
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("keeps prompt diff controls and status badges on shared primitives", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(PromptDiffModal, {
      target,
      props: {
        firstPresetId: 0,
        secondPresetId: 1,
        onClose: hoisted.onClose,
      },
    });

    const settled = await waitForCondition(
      () => document.querySelector(".ds-prompt-diff-status-chip.control-chip") !== null,
    );
    expect(settled).toBe(true);

    const pillGroup = document.querySelector(".ds-prompt-diff-pill-group.seg-tabs") as HTMLElement | null;
    expect(pillGroup).not.toBeNull();
    const pills = [...document.querySelectorAll(".ds-prompt-diff-pill.seg-tab")] as HTMLElement[];
    expect(pills.length).toBeGreaterThan(0);

    const closeButton = document.querySelector(
      ".ds-prompt-diff-close.icon-btn.icon-btn--sm",
    ) as HTMLButtonElement | null;
    expect(closeButton).not.toBeNull();
    expect(closeButton?.type).toBe("button");
    expect(closeButton?.getAttribute("aria-label")).toBe("Close prompt diff");
    closeButton?.click();
    await flushUi();
    expect(hoisted.onClose).toHaveBeenCalledTimes(1);
  });

  it("renders no-change indicator on control-chip primitive in raw-only-changes mode", async () => {
    hoisted.db.promptDiffPrefs = {
      diffStyle: "intraline",
      formatStyle: "raw",
      viewStyle: "unified",
      isGrouped: false,
      showOnlyChanges: true,
      contextRadius: 3,
    };

    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(PromptDiffModal, {
      target,
      props: {
        firstPresetId: 0,
        secondPresetId: 1,
        onClose: hoisted.onClose,
      },
    });

    const settled = await waitForCondition(
      () => document.querySelector(".ds-prompt-diff-nochange-badge.control-chip") !== null,
    );
    expect(settled).toBe(true);
  });
});
