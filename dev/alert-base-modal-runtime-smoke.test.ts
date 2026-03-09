import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";
import { writable } from "svelte/store";

vi.mock(import("src/lib/UI/GUI/Button.svelte"), async () => ({
  default: (await import("./test-stubs/ButtonStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/TextInput.svelte"), async () => ({
  default: (await import("./test-stubs/TextInputStub.svelte")).default,
}));

vi.mock(import("src/ts/stores.svelte"), () => ({
  DBState: {
    db: {
      sourcemapTranslate: false,
    },
  },
  alertStore: {
    set: vi.fn(),
  },
}));

vi.mock(import("src/ts/gui/colorscheme"), () => ({
  ColorSchemeTypeStore: writable(false),
}));

vi.mock(import("src/ts/parser.svelte"), () => ({
  ParseMarkdown: vi.fn(async () => ""),
}));

vi.mock(import("src/ts/globalApi.svelte"), () => ({
  openURL: vi.fn(),
}));

vi.mock(import("src/ts/sourcemap"), () => ({
  translateStackTrace: vi.fn(async () => ""),
}));

vi.mock(import("src/lang"), () => {
  const language = new Proxy(
    {
      preview: "Preview",
      hideErrorDetails: "Hide details",
      showErrorDetails: "Show details",
      translating: "Translating",
      showOriginal: "Show original",
      translateCode: "Translate code",
    } as Record<string, string>,
    {
      get(target, property) {
        if (typeof property === "string" && property in target) {
          return target[property];
        }
        return String(property);
      },
    },
  );

  return { language };
});

import AlertBaseModal from "src/lib/Others/AlertComp/AlertBaseModal.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
}

describe("alert base modal runtime smoke", () => {
  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
    document.body.innerHTML = "";
  });

  it("shows input prompt text for password-style alerts", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(AlertBaseModal, {
      target,
      props: {
        alert: {
          type: "input",
          msg: "Enter current server password",
          defaultValue: "",
          datalist: [],
        },
      },
    });
    await flushUi();

    const modalText = target.textContent ?? "";
    expect(modalText).toContain("Input");
    expect(modalText).toContain("Enter current server password");

    const input = target.querySelector("#alert-input") as HTMLInputElement | null;
    expect(input).not.toBeNull();
  });
});
