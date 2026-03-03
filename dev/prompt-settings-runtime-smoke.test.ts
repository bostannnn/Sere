import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

vi.mock(import("src/lang"), () => ({
  language: {
    fixedTokens: "Fixed tokens",
    exactTokens: "Exact tokens",
    template: "Template",
    settings: "Settings",
    promptTemplate: "Prompt Template",
    name: "Name",
    type: "Type",
    specialType: "Special Type",
    noSpecialType: "None",
    prompt: "Prompt",
    role: "Role",
    user: "User",
    character: "Character",
    systemPrompt: "System",
    Chat: "Chat",
    mainPrompt: "Main Prompt",
    globalNote: "Global Note",
    jailbreakPrompt: "Jailbreak Prompt",
    cachePoint: "Cache Point",
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
    promptSettings: {},
  },
}));

vi.mock(import("src/ts/stores.svelte"), () => ({
  DBState: {
    db: {
      promptTemplate: [
        {
          type: "plain",
          type2: "normal",
          role: "system",
          text: "hello",
          name: "Prompt A",
        },
      ],
      promptSettings: {
        customChainOfThought: false,
        sendChatAsSystem: false,
      },
    },
  },
}));

vi.mock(import("src/ts/process/prompt"), () => ({
  tokenizePreset: async () => 0,
}));

vi.mock(import("src/ts/process/templates/templateCheck"), () => ({
  templateCheck: () => [],
}));

vi.mock(import("src/lib/UI/GUI/TextInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/TextAreaInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/SelectInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/OptionInput.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/NumberInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/CheckInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/Accordion.svelte"), async () => ({
  default: (await import("./test-stubs/AccordionOpenStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/ModelList.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));

vi.mock(import("src/lib/Others/Help.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/Button.svelte"), async () => ({
  default: (await import("./test-stubs/ComponentActionButtonStub.svelte")).default,
}));

import PromptSettings from "src/lib/Setting/Pages/PromptSettings.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("prompt settings runtime smoke", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("opens prompt blocks on header click", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(PromptSettings, {
      target,
      props: {
        mode: "inline",
        subMenu: 0,
      },
    });
    await flushUi();

    const header = document.querySelector(".prompt-data-header") as HTMLElement | null;
    expect(header).not.toBeNull();
    expect(header?.getAttribute("aria-expanded")).toBe("false");

    header?.click();
    await flushUi();

    expect(header?.getAttribute("aria-expanded")).toBe("true");
    const expandedField = document.querySelector(".prompt-data-label-first");
    expect(expandedField).not.toBeNull();
  });
});
