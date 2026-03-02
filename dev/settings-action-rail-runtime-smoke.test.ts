import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

vi.mock(import("uuid"), () => ({
  v4: () => "generated-custom-model-id",
}));

vi.mock(import("src/lang"), () => ({
  language: {
    customStopWords: "Custom Stop Words",
    openrouterFallback: "OpenRouter fallback",
    openrouterMiddleOut: "OpenRouter middle-out",
    useInstructPrompt: "Use instruct prompt",
    openrouterProviderOrder: "Provider order",
    openrouterProviderOnly: "Provider only",
    openrouterProviderIgnore: "Provider ignore",
    provider: "Provider",
    customModels: "Custom Models",
    name: "Name",
    proxyRequestModel: "Proxy Request Model",
    tokenizer: "Tokenizer",
    format: "Format",
    proxyAPIKey: "Proxy API Key",
    additionalParams: "Additional Params",
    flags: "Flags",
  },
}));

vi.mock(import("src/lib/UI/Accordion.svelte"), async () => ({
  default: (await import("./test-stubs/AccordionOpenStub.svelte")).default,
}));

vi.mock(import("src/lib/Setting/Pages/ChatFormatSettings.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/OpenrouterProviderList.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
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

vi.mock(import("src/lib/UI/GUI/OptionalInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/CheckInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");
  return {
    DBState: {
      db: {},
    },
    selIdState: {
      selId: 0,
    },
    selectedCharID: writable(0),
  };
});

import OpenrouterSettings from "src/lib/Setting/Pages/OpenrouterSettings.svelte";
import OobaSettings from "src/lib/Setting/Pages/OobaSettings.svelte";
import CustomModelsSettings from "src/lib/Setting/Pages/Advanced/CustomModelsSettings.svelte";
import { DBState } from "src/ts/stores.svelte";

let app: Record<string, unknown> | undefined;

function createDbState() {
  return {
    openrouterFallback: false,
    openrouterMiddleOut: false,
    useInstructPrompt: false,
    openrouterProvider: {
      order: ["OpenAI"],
      only: ["Anthropic"],
      ignore: ["Google"],
    },
    reverseProxyOobaArgs: {},
    localStopStrings: ["stop-alpha"],
    customModels: [
      {
        internalId: "openai/gpt-4.1",
        url: "https://example.com",
        tokenizer: 0,
        format: 0,
        id: "custom-model-alpha",
        key: "",
        name: "Alpha",
        params: "",
        flags: [],
      },
    ],
  };
}

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("settings action-rail runtime smoke", () => {
  beforeEach(() => {
    DBState.db = createDbState();
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("keeps Openrouter provider action rows on action-rail primitive", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(OpenrouterSettings, { target });
    await flushUi();

    const rails = Array.from(
      document.querySelectorAll(".ds-settings-inline-actions.action-rail"),
    ) as HTMLElement[];
    expect(rails.length).toBeGreaterThanOrEqual(3);

    const firstRailButtons = Array.from(
      rails[0]?.querySelectorAll("button.ds-settings-icon-action") ?? [],
    ) as HTMLButtonElement[];
    expect(firstRailButtons.length).toBe(2);
    expect(firstRailButtons[0]?.classList.contains("icon-btn")).toBe(true);
    expect(firstRailButtons[0]?.classList.contains("icon-btn--sm")).toBe(true);

    firstRailButtons[0]?.click();
    await flushUi();
    expect(DBState.db.openrouterProvider.order.length).toBe(2);

    firstRailButtons[1]?.click();
    await flushUi();
    expect(DBState.db.openrouterProvider.order.length).toBe(1);
  });

  it("keeps Ooba stop-string controls on action-rail and fluid action-rail rows", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(OobaSettings, { target, props: { instructionMode: true } });
    await flushUi();

    const addRail = document.querySelector(
      ".ds-settings-inline-actions.action-rail",
    ) as HTMLElement | null;
    expect(addRail).not.toBeNull();

    const rowRail = document.querySelector(
      ".ds-settings-inline-actions.ds-settings-inline-actions-fluid.action-rail",
    ) as HTMLElement | null;
    expect(rowRail).not.toBeNull();
    const panelShellCard = document.querySelector(
      ".ds-settings-section.ds-settings-card.panel-shell",
    ) as HTMLElement | null;
    expect(panelShellCard).not.toBeNull();

    const addButton = addRail?.querySelector(
      "button.ds-settings-icon-action",
    ) as HTMLButtonElement | null;
    expect(addButton).not.toBeNull();
    addButton?.click();
    await flushUi();
    expect(DBState.db.localStopStrings.length).toBe(2);

    const removeButton = rowRail?.querySelector(
      "button.ds-settings-icon-action",
    ) as HTMLButtonElement | null;
    expect(removeButton).not.toBeNull();
    removeButton?.click();
    await flushUi();
    expect(DBState.db.localStopStrings.length).toBe(1);
  });

  it("keeps custom model row and footer controls on action-rail", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(CustomModelsSettings, { target });
    await flushUi();

    const rowRail = document.querySelector(
      ".ds-settings-inline-actions.ds-settings-model-row-actions.action-rail",
    ) as HTMLElement | null;
    expect(rowRail).not.toBeNull();

    const rowButtons = Array.from(
      rowRail?.querySelectorAll("button.ds-settings-icon-action") ?? [],
    ) as HTMLButtonElement[];
    expect(rowButtons.length).toBe(3);
    expect(rowButtons[0]?.classList.contains("icon-btn")).toBe(true);
    expect(rowButtons[0]?.classList.contains("icon-btn--sm")).toBe(true);

    const toggleButton = document.querySelector(
      ".ds-settings-model-row-toggle",
    ) as HTMLButtonElement | null;
    expect(toggleButton).not.toBeNull();
    toggleButton?.click();
    await flushUi();

    const rails = Array.from(
      document.querySelectorAll(".ds-settings-inline-actions.action-rail"),
    ) as HTMLElement[];
    expect(rails.length).toBeGreaterThanOrEqual(3);

    const footerRail = rails[rails.length - 1];
    const addButton = footerRail?.querySelector(
      "button.ds-settings-icon-action",
    ) as HTMLButtonElement | null;
    expect(addButton).not.toBeNull();
    addButton?.click();
    await flushUi();

    expect(DBState.db.customModels.length).toBe(2);
    expect(DBState.db.customModels[1]?.id).toBe("xcustom:::generated-custom-model-id");
  });
});
