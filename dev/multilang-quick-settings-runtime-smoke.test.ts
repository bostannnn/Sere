import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

vi.mock(import("src/ts/stores.svelte"), () => ({
}));

vi.mock(import("src/ts/util"), () => ({
  encodeMultilangString: (value: Record<string, string>) => JSON.stringify(value),
  languageCodes: ["en", "es", "ko", "xx"],
  parseMultilangString: (value: string) => {
    try {
      return JSON.parse(value) as Record<string, string>;
    } catch {
      return { en: value };
    }
  },
  toLangName: (code: string) =>
    ({
      en: "English",
      es: "Spanish",
      ko: "Korean",
      xx: "xx",
    })[code] ?? code,
}));

vi.mock(import("src/ts/gui/colorscheme"), async () => {
  const { writable } = await import("svelte/store");
  return {
    ColorSchemeTypeStore: writable(false),
  };
});

vi.mock(import("src/ts/parser.svelte"), () => ({
  ParseMarkdown: vi.fn(async (value: string) => value),
}));

vi.mock(import("src/lib/UI/GUI/TextAreaInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));

import MultiLangInput from "src/lib/UI/GUI/MultiLangInput.svelte";
import MultiLangDisplay from "src/lib/UI/GUI/MultiLangDisplay.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("multilang + quick settings runtime smoke", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("keeps multilang input tabs on seg-tabs/seg-tab composition", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(MultiLangInput, {
      target,
      props: {
        value: JSON.stringify({
          en: "Hello",
          es: "Hola",
        }),
      },
    });
    await flushUi();

    const tabs = document.querySelector(".ds-multilang-tabs.seg-tabs") as HTMLElement | null;
    expect(tabs).not.toBeNull();

    const tabButtons = [...document.querySelectorAll(".ds-multilang-tab.seg-tab")] as HTMLButtonElement[];
    expect(tabButtons.length).toBeGreaterThanOrEqual(3);

    const addButton = tabButtons.find((button) => (button.textContent ?? "").trim() === "+");
    expect(addButton).toBeDefined();
    addButton?.click();
    await flushUi();

    const addList = document.querySelector(".ds-multilang-add-list") as HTMLElement | null;
    expect(addList).not.toBeNull();
    const addListButtons = addList?.querySelectorAll(".ds-multilang-tab.ds-multilang-tab-add.seg-tab") ?? [];
    expect(addListButtons.length).toBeGreaterThan(0);
  });

  it("keeps multilang display tabs on seg-tabs/seg-tab and switches content", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(MultiLangDisplay, {
      target,
      props: {
        value: JSON.stringify({
          en: "Hello",
          es: "Hola",
        }),
        markdown: false,
      },
    });
    await flushUi();

    const tabs = document.querySelector(".ds-multilang-display-tabs.seg-tabs") as HTMLElement | null;
    expect(tabs).not.toBeNull();

    const tabButtons = [...document.querySelectorAll(".ds-multilang-display-tab.seg-tab")] as HTMLButtonElement[];
    expect(tabButtons.length).toBe(2);
    expect((document.querySelector(".ds-multilang-display-content")?.textContent ?? "").includes("Hello")).toBe(true);

    const spanishButton = tabButtons.find((button) => (button.textContent ?? "").includes("Spanish"));
    expect(spanishButton).toBeDefined();
    spanishButton?.click();
    await flushUi();

    expect((document.querySelector(".ds-multilang-display-content")?.textContent ?? "").includes("Hola")).toBe(true);
    expect(spanishButton?.classList.contains("is-active")).toBe(true);
  });
});
