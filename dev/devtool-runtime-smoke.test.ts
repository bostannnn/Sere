import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

const mocks = vi.hoisted(() => ({
  selectSingleFile: vi.fn(),
  sendChat: vi.fn(async () => {}),
}));

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");
  return {
    selectedCharID: writable(0),
    DBState: {
      db: {
        promptTemplate: "",
        characters: [
          {
            chatPage: 0,
            chats: [
              {
                scriptstate: {
                  mood: "focused",
                  score: 7,
                },
                message: [],
              },
            ],
          },
        ],
      },
    },
  };
});

vi.mock(import("src/ts/globalApi.svelte"), () => ({
  getRequestLog: () => "request-log",
  getServerLLMLogs: async () => [],
}));

vi.mock(import("src/ts/alert"), () => ({
  alertMd: () => {},
  alertWait: () => {},
}));

vi.mock(import("src/ts/tokenizer"), () => ({
  getCharToken: async () => ({ persistant: 1, dynamic: 2 }),
  getChatToken: async () => 3,
}));

vi.mock(import("src/ts/process/prompt"), () => ({
  tokenizePreset: async () => 4,
}));

vi.mock(import("src/ts/util"), () => ({
  selectSingleFile: mocks.selectSingleFile,
}));

vi.mock(import("src/ts/process/index.svelte"), async () => {
  const { writable } = await import("svelte/store");
  return {
    isDoingChat: writable(false),
    previewFormated: [],
    previewBody: "{}",
    sendChat: mocks.sendChat,
  };
});

vi.mock(import("src/ts/process/templates/chatTemplate"), () => ({
  applyChatTemplate: () => "template-output",
  chatTemplates: {
    chatml: {},
  },
}));

vi.mock(import("src/ts/process/lorebook.svelte"), () => ({
  loadLoreBookV3Prompt: async () => ({
    actives: [],
    matchLog: [],
  }),
}));

vi.mock(import("src/ts/process/modules"), () => ({
  getModules: () => [],
}));

vi.mock(import("src/lib/UI/GUI/TextAreaInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));

import DevTool from "src/lib/SideBars/DevTool.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("devtool runtime smoke", () => {
  beforeEach(() => {
    mocks.selectSingleFile.mockReset();
    mocks.sendChat.mockClear();
    mocks.selectSingleFile.mockResolvedValue(null);
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("keeps autopilot actions on primitive rails and icon buttons", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(DevTool, { target });
    await flushUi();

    const trigger = Array.from(
      document.querySelectorAll(".accordion-trigger-styled"),
    ).find((button) => (button.textContent ?? "").includes("Autopilot")) as HTMLButtonElement | undefined;
    expect(trigger).toBeDefined();
    trigger?.click();
    await flushUi();

    const actionRail = document.querySelector(
      ".devtool-action-row.action-rail.ds-ui-action-rail.ds-ui-action-rail-end",
    ) as HTMLDivElement | null;
    expect(actionRail).not.toBeNull();

    const iconButtons = Array.from(
      document.querySelectorAll(".devtool-icon-button.icon-btn.icon-btn--sm"),
    ) as HTMLButtonElement[];
    expect(iconButtons.length).toBe(3);

    iconButtons[1]?.click();
    await flushUi();
    let textareas = Array.from(
      document.querySelectorAll(".devtool-autopilot-list [data-testid='bindable-field-stub']"),
    );
    expect(textareas.length).toBe(1);

    mocks.selectSingleFile.mockResolvedValue({
      name: "autopilot.txt",
      data: new TextEncoder().encode("one\ntwo"),
    });
    iconButtons[2]?.click();
    await flushUi();
    textareas = Array.from(
      document.querySelectorAll(".devtool-autopilot-list [data-testid='bindable-field-stub']"),
    );
    expect(mocks.selectSingleFile).toHaveBeenCalledTimes(1);
    expect(textareas.length).toBe(2);
  });
});
