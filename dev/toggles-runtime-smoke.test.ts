import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

const hoisted = vi.hoisted(() => ({
  parsedToggles: [
    { key: "mode", value: "Mode", type: "select", options: ["One", "Two"] },
    { key: "nickname", value: "Nickname", type: "text" },
    { key: "bio", value: "Bio", type: "textarea" },
    { key: "divider", value: "Section", type: "divider" },
    { key: "caption", value: "Helper copy", type: "caption" },
  ],
}));

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");
  return {
    DBState: {
      db: {
        customPromptTemplateToggle: "",
        globalChatVariables: {},
        jailbreakToggle: false,
        hypaV3: false,
      },
    },
    MobileGUI: writable(false),
    selIdState: { selId: 0 },
  };
});

vi.mock(import("src/ts/process/modules"), () => ({
  getModuleToggles: () => "",
}));

vi.mock(import("src/ts/util"), () => ({
  parseToggleSyntax: () => hoisted.parsedToggles,
}));

vi.mock(import("src/lang"), () => ({
  language: {
    jailbreakToggle: "Jailbreak toggle",
    ToggleHypaMemory: "Hypa memory",
  },
}));

vi.mock(import("src/lib/UI/GUI/TextAreaInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));

import Toggles from "src/lib/SideBars/Toggles.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
}

describe("toggles runtime smoke", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("keeps toggle rows/scroll container and text/select controls on shared primitives", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(Toggles, {
      target,
      props: {
        chara: {
          supaMemory: false,
        },
      },
    });

    await flushUi();

    const rows = [...target.querySelectorAll(".sidebar-toggle-row")] as HTMLElement[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.classList.contains("action-rail"))).toBe(true);

    expect(target.querySelector(".sidebar-toggle-divider-row.action-rail")).not.toBeNull();
    expect(target.querySelector(".sidebar-toggle-scroll-shell.list-shell")).not.toBeNull();
    expect(target.querySelector("select.sidebar-toggle-control.control-field")).not.toBeNull();
    expect(target.querySelector("input.sidebar-toggle-control.control-field")).not.toBeNull();
  });
});
