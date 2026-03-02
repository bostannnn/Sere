import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

const mocks = vi.hoisted(() => ({
  requestChatData: vi.fn(),
  setDatabase: vi.fn(),
  translate: vi.fn(async (value: string) => `translated-${value}`),
  alertConfirm: vi.fn(async () => false),
}));

vi.mock(import("src/ts/process/request/request"), () => ({
  requestChatData: mocks.requestChatData,
}));

vi.mock(import("src/ts/process/index.svelte"), async () => {
  const { writable } = await import("svelte/store");
  return {
    isDoingChat: writable(false),
  };
});

vi.mock(import("src/ts/storage/database.svelte"), () => ({
  setDatabase: mocks.setDatabase,
}));

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");
  return {
    selectedCharID: writable(0),
    DBState: {
      db: {
        autoTranslate: false,
        translator: "mock",
        autoSuggestPrompt: "Suggest",
        subModel: "openrouter",
        characters: [
          {
            name: "Alpha",
            type: "character",
            chatPage: 0,
            chats: [
              {
                suggestMessages: ["One", "Two"],
                message: [{ role: "char", data: "Hello there" }],
              },
            ],
          },
        ],
      },
    },
  };
});

vi.mock(import("src/ts/translator/translator"), () => ({
  translate: mocks.translate,
}));

vi.mock(import("src/ts/alert"), () => ({
  alertConfirm: mocks.alertConfirm,
}));

vi.mock(import("src/lang"), () => ({
  language: {
    creatingSuggestions: "Creating suggestions",
    askReRollAutoSuggestions: "Reroll suggestions?",
  },
}));

vi.mock(import("src/ts/util"), () => ({
  getUserName: () => "User",
  replacePlaceholders: (value: string) => value,
}));

vi.mock(import("src/ts/parser.svelte"), () => ({
  ParseMarkdown: async (value: string) => value,
}));

vi.mock(import("src/ts/storage/defaultPrompts.js"), () => ({
  defaultAutoSuggestPrompt: "Default suggest prompt",
}));

import Suggestion from "src/lib/ChatScreens/Suggestion.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("suggestion runtime smoke", () => {
  beforeEach(() => {
    mocks.requestChatData.mockClear();
    mocks.setDatabase.mockClear();
    mocks.translate.mockClear();
    mocks.alertConfirm.mockClear();
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("applies icon button primitives to suggestion icon controls", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(Suggestion, {
      target,
      props: {
        send: () => {},
        messageInput: () => {},
      },
    });
    await flushUi();

    const iconButtons = [...document.querySelectorAll(".ds-suggestion-icon-btn")] as HTMLButtonElement[];
    expect(iconButtons.length).toBe(2);
    expect(iconButtons.every((button) => button.classList.contains("icon-btn"))).toBe(true);
    expect(iconButtons.every((button) => button.classList.contains("icon-btn--sm"))).toBe(true);
    expect(iconButtons.every((button) => button.type === "button")).toBe(true);

    const copyButtons = [...document.querySelectorAll(".ds-suggestion-copy-btn")] as HTMLButtonElement[];
    expect(copyButtons.length).toBe(2);
    expect(copyButtons.every((button) => button.classList.contains("icon-btn"))).toBe(true);
    expect(copyButtons.every((button) => button.classList.contains("icon-btn--sm"))).toBe(true);
    expect(copyButtons.every((button) => button.type === "button")).toBe(true);
  });

  it("keeps suggestion actions functional after primitive convergence", async () => {
    const send = vi.fn();
    const messageInput = vi.fn();

    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(Suggestion, {
      target,
      props: {
        send,
        messageInput,
      },
    });
    await flushUi();

    const translateButton = document.querySelector(".ds-suggestion-icon-btn") as HTMLButtonElement | null;
    expect(translateButton).not.toBeNull();
    expect(translateButton?.getAttribute("aria-pressed")).toBe("false");
    translateButton?.click();
    await flushUi();
    expect(mocks.translate).toHaveBeenCalledTimes(2);
    expect(translateButton?.getAttribute("aria-pressed")).toBe("true");

    const copyButton = document.querySelector(".ds-suggestion-copy-btn") as HTMLButtonElement | null;
    expect(copyButton).not.toBeNull();
    copyButton?.click();
    await flushUi();
    expect(messageInput).toHaveBeenCalledWith("One");

    const suggestionButton = document.querySelector(".ds-suggestion-btn") as HTMLButtonElement | null;
    expect(suggestionButton).not.toBeNull();
    suggestionButton?.click();
    await flushUi();
    expect(messageInput).toHaveBeenCalledWith("One");
    expect(send).toHaveBeenCalledTimes(1);
    expect(mocks.requestChatData).not.toHaveBeenCalled();
    expect(mocks.setDatabase).not.toHaveBeenCalled();
  });
});
