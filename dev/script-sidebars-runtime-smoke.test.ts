import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

const mocks = vi.hoisted(() => ({
  alertConfirm: vi.fn(async () => true),
}));

vi.mock(import("src/lang"), () => {
  const language = new Proxy(
    {
      formating: {
        alpha: "Alpha",
        beta: "Beta",
      },
    } as Record<string, unknown>,
    {
      get(target, key) {
        if (typeof key === "string" && key in target) return target[key];
        return String(key);
      },
    },
  );
  return { language };
});

vi.mock(import("src/ts/alert"), () => ({
  alertConfirm: mocks.alertConfirm,
}));

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");
  return {
    ReloadGUIPointer: writable(0),
  };
});

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
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/Others/Help.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));

import DropList from "src/lib/SideBars/DropList.svelte";
import RegexData from "src/lib/SideBars/Scripts/RegexData.svelte";
import TriggerV1Data from "src/lib/SideBars/Scripts/TriggerV1Data.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("script sidebars runtime smoke", () => {
  beforeEach(() => {
    mocks.alertConfirm.mockClear();
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("keeps droplist controls on list/action/icon primitives and preserves swap behavior", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(DropList, {
      target,
      props: {
        list: ["alpha", "beta"],
      },
    });
    await flushUi();

    const listRoot = document.querySelector(".sidebar-drop-list.list-shell") as HTMLElement | null;
    expect(listRoot).not.toBeNull();

    const rails = Array.from(
      document.querySelectorAll(".sidebar-drop-actions.action-rail"),
    ) as HTMLDivElement[];
    expect(rails.length).toBe(2);

    const buttons = Array.from(
      document.querySelectorAll(".sidebar-drop-action.icon-btn.icon-btn--sm"),
    ) as HTMLButtonElement[];
    expect(buttons.length).toBe(4);

    const labelsBefore = Array.from(
      document.querySelectorAll(".sidebar-drop-label"),
    ).map((node) => node.textContent?.trim());
    expect(labelsBefore[0]).toBe("Alpha");

    buttons[0]?.click();
    await flushUi();

    const labelsAfter = Array.from(
      document.querySelectorAll(".sidebar-drop-label"),
    ).map((node) => node.textContent?.trim());
    expect(labelsAfter[0]).toBe("Beta");
  });

  it("keeps regex script remove action on icon-btn and preserves remove callback", async () => {
    const onRemove = vi.fn();
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(RegexData, {
      target,
      props: {
        idx: 0,
        value: {
          comment: "Regex Entry",
          type: "editinput",
          in: "",
          out: "",
          ableFlag: false,
          flag: "g",
        },
        onRemove,
      },
    });
    await flushUi();

    const removeButton = document.querySelector(
      ".script-item-remove-button.icon-btn.icon-btn--sm",
    ) as HTMLButtonElement | null;
    expect(removeButton).not.toBeNull();
    expect(removeButton?.type).toBe("button");
    expect(removeButton?.title).toBe("Remove regex script");
    expect(removeButton?.getAttribute("aria-label")).toBe("Remove regex script");

    const toggleButton = document.querySelector(".script-item-toggle-button") as HTMLButtonElement | null;
    expect(toggleButton).not.toBeNull();
    expect(toggleButton?.type).toBe("button");
    expect(toggleButton?.title).toBe("Toggle regex script details");
    expect(toggleButton?.getAttribute("aria-label")).toBe("Toggle regex script details");

    removeButton?.click();
    await flushUi();

    expect(mocks.alertConfirm).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("keeps trigger v1 quick actions and blocks on shared primitives", async () => {
    const triggerValue = {
      comment: "Trigger Entry",
      type: "start",
      conditions: [] as Array<Record<string, unknown>>,
      effect: [] as Array<Record<string, unknown>>,
    };
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(TriggerV1Data, {
      target,
      props: {
        idx: 0,
        value: triggerValue,
        lowLevelAble: false,
      },
    });
    await flushUi();

    const toggleButton = document.querySelector(
      ".script-item-toggle-button",
    ) as HTMLButtonElement | null;
    expect(toggleButton).not.toBeNull();
    expect(toggleButton?.type).toBe("button");
    expect(toggleButton?.title).toBe("Toggle trigger details");
    expect(toggleButton?.getAttribute("aria-label")).toBe("Toggle trigger details");
    toggleButton?.click();
    await flushUi();

    const removeButton = document.querySelector(
      ".script-item-remove-button.icon-btn.icon-btn--sm",
    ) as HTMLButtonElement | null;
    expect(removeButton).not.toBeNull();
    expect(removeButton?.type).toBe("button");
    expect(removeButton?.title).toBe("Remove trigger");
    expect(removeButton?.getAttribute("aria-label")).toBe("Remove trigger");

    const blocks = Array.from(
      document.querySelectorAll(".trigger-v1-block.panel-shell"),
    );
    expect(blocks.length).toBe(2);

    const inlineActions = Array.from(
      document.querySelectorAll(".trigger-v1-inline-action.icon-btn.icon-btn--sm"),
    ) as HTMLButtonElement[];
    expect(inlineActions.length).toBeGreaterThanOrEqual(2);
    expect(inlineActions[0]?.type).toBe("button");
    expect(inlineActions[0]?.title).toBe("Add condition");
    expect(inlineActions[0]?.getAttribute("aria-label")).toBe("Add condition");

    inlineActions[0]?.click();
    await flushUi();
    expect(triggerValue.conditions.length).toBe(1);
  });
});
