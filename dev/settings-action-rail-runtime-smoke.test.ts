import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

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
});
