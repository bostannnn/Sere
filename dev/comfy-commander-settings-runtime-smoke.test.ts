import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

vi.mock(import("src/lib/UI/GUI/TextInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/NumberInput.svelte"), async () => ({
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

vi.mock(import("src/lib/Others/Help.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
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

import ComfyCommanderSettings from "src/lib/Setting/Pages/Advanced/ComfyCommanderSettings.svelte";
import { DBState } from "src/ts/stores.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function findButtonByText(label: string) {
  return Array.from(document.querySelectorAll("button")).find(
    (button) => (button.textContent ?? "").replace(/\s+/g, " ").trim().includes(label),
  ) as HTMLButtonElement | undefined;
}

describe("comfy commander settings runtime smoke", () => {
  beforeEach(() => {
    DBState.db = {};
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("renders direct sections without outer accordion wrapper", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(ComfyCommanderSettings, { target });
    await flushUi();

    expect(DBState.db.comfyCommander).toBeDefined();
    expect(DBState.db.comfyCommander.config.baseUrl).toBe("http://127.0.0.1:8188");
    expect(document.querySelector(".accordion-trigger")).toBeNull();

    const sections = Array.from(document.querySelectorAll(".ds-comfy-section"));
    expect(sections.length).toBe(2);
    expect((document.body.textContent ?? "").includes("No workflows yet.")).toBe(true);
    expect((document.body.textContent ?? "").includes("No templates yet.")).toBe(true);
  });

  it("adds workflows and templates from direct action buttons", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(ComfyCommanderSettings, { target });
    await flushUi();

    const addWorkflowButton = findButtonByText("Add Workflow");
    const addTemplateButton = findButtonByText("Add Template");
    expect(addWorkflowButton).not.toBeUndefined();
    expect(addTemplateButton).not.toBeUndefined();

    addWorkflowButton?.click();
    addTemplateButton?.click();
    await flushUi();

    expect(DBState.db.comfyCommander.workflows.length).toBe(1);
    expect(DBState.db.comfyCommander.templates.length).toBe(1);
  });
});
