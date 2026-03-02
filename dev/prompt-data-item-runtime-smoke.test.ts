import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

vi.mock(import("src/lang"), () => ({
  language: {
    Chat: "Chat",
    mainPrompt: "Main Prompt",
    globalNote: "Global Note",
    jailbreakPrompt: "Jailbreak Prompt",
    cot: "CoT",
    formating: {
      plain: "Plain",
      jailbreak: "Jailbreak",
      personaPrompt: "Persona",
      description: "Description",
      authorNote: "Author Note",
      lorebook: "Lorebook",
      memory: "Memory",
      postEverything: "Post Everything",
    },
  },
}));

vi.mock(import("src/ts/stores.svelte"), () => ({
  DBState: {
    db: {
      promptSettings: {
        customChainOfThought: false,
        sendChatAsSystem: false,
      },
    },
  },
}));

vi.mock(import("src/lib/UI/GUI/OptionInput.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/UI/GUI/TextAreaInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));
vi.mock(import("src/lib/UI/GUI/SelectInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));
vi.mock(import("src/lib/UI/GUI/NumberInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));
vi.mock(import("src/lib/UI/GUI/CheckInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));
vi.mock(import("src/lib/UI/GUI/TextInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));

import PromptDataItem from "src/lib/UI/PromptDataItem.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("prompt data item runtime smoke", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("keeps prompt card and header actions on shared primitives", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(PromptDataItem, {
      target,
      props: {
        promptItem: {
          type: "plain",
          type2: "normal",
          role: "system",
          text: "",
          name: "Prompt A",
        },
        currentIndex: 0,
      },
    });
    await flushUi();

    const card = document.querySelector(".prompt-data-card.panel-shell") as HTMLElement | null;
    expect(card).not.toBeNull();

    const headerActions = document.querySelector(".prompt-data-header-actions.action-rail") as HTMLElement | null;
    expect(headerActions).not.toBeNull();

    const header = document.querySelector(".prompt-data-header") as HTMLElement | null;
    expect(header).not.toBeNull();
    expect(header?.getAttribute("role")).toBe("button");
    expect(header?.getAttribute("tabindex")).toBe("0");
    expect(header?.getAttribute("aria-expanded")).toBe("false");

    const headerButtons = Array.from(
      document.querySelectorAll(".prompt-data-header-icon-btn.icon-btn.icon-btn--sm"),
    ) as HTMLButtonElement[];
    expect(headerButtons.length).toBe(3);
    expect(headerButtons.every((button) => button.type === "button")).toBe(true);
  });
});
