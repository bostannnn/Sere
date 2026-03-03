import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

vi.mock(import("src/lang"), () => ({
  language: {
    model: "Model",
    none: "None",
    customModels: "Custom Models",
    showUnrecommended: "Show unrecommended",
  },
}));

vi.mock(import("src/ts/stores.svelte"), () => ({
  DBState: {
    db: {
      customModels: [
        { id: "custom:model", name: "Custom Model" },
      ],
    },
  },
}));

vi.mock(import("src/ts/model/modellist"), () => ({
  getModelInfo: (id: string) => ({
    fullName: id === "provider:model-a" ? "Provider Model A" : "None",
  }),
  getModelList: () => [
    {
      providerName: "@as-is",
      models: [
        { id: "provider:model-a", name: "Provider Model A" },
        { id: "provider:model-b", name: "Provider Model B" },
      ],
    },
  ],
}));

vi.mock(import("src/ts/horde/getModels"), () => ({
  getHordeModels: async () => [
    { name: "Horde A", performance: 1.1 },
  ],
}));

vi.mock(import("src/lib/UI/Accordion.svelte"), async () => ({
  default: (await import("./test-stubs/AccordionOpenStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/CheckInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));

import ModelList from "src/lib/UI/ModelList.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("model list runtime smoke", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("keeps model picker panel/back button on shared panel/icon primitives", async () => {
    const onChange = vi.fn();
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(ModelList, {
      target,
      props: {
        value: "provider:model-a",
        onChange,
      },
    });
    await flushUi();

    const trigger = target.querySelector(".ds-model-list-trigger") as HTMLButtonElement | null;
    expect(trigger).not.toBeNull();
    expect(trigger?.type).toBe("button");
    trigger?.click();
    await flushUi();

    const panel = document.querySelector(".ds-model-list-panel.panel-shell") as HTMLElement | null;
    expect(panel).not.toBeNull();

    const backButton = document.querySelector(
      ".ds-model-list-back.icon-btn.icon-btn--sm",
    ) as HTMLButtonElement | null;
    expect(backButton).not.toBeNull();
    expect(backButton?.type).toBe("button");
    expect(backButton?.title).toBe("Back");
    expect(backButton?.getAttribute("aria-label")).toBe("Back");

    const options = Array.from(document.querySelectorAll(".ds-model-list-item")) as HTMLButtonElement[];
    expect(options.length).toBeGreaterThan(0);
    expect(options.every((option) => option.type === "button")).toBe(true);
    const targetOption = options.find((option) => option.textContent?.includes("Provider Model B"));
    expect(targetOption).toBeDefined();
    expect(targetOption?.title).toBe("Provider Model B");
    expect(targetOption?.getAttribute("aria-label")).toBe("Provider Model B");
    targetOption?.click();
    await flushUi();

    expect(onChange).toHaveBeenLastCalledWith("provider:model-b");
    expect(document.querySelector(".ds-model-list-overlay")).toBeNull();
  });

  it("keeps blank selection path stable when blankable is enabled", async () => {
    const onChange = vi.fn();
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(ModelList, {
      target,
      props: {
        value: "provider:model-a",
        onChange,
        blankable: true,
      },
    });
    await flushUi();

    const trigger = target.querySelector(".ds-model-list-trigger") as HTMLButtonElement | null;
    trigger?.click();
    await flushUi();

    const noneOption = Array.from(document.querySelectorAll(".ds-model-list-item")).find((option) =>
      option.textContent?.trim() === "None"
    ) as HTMLButtonElement | undefined;
    expect(noneOption).toBeDefined();
    expect(noneOption?.title).toBe("None");
    expect(noneOption?.getAttribute("aria-label")).toBe("None");
    noneOption?.click();
    await flushUi();

    expect(onChange).toHaveBeenLastCalledWith("");
    expect(document.querySelector(".ds-model-list-overlay")).toBeNull();
  });

  it("stays stable when mounted with an undefined value", async () => {
    const runtimeErrors: string[] = [];
    const onError = (event: Event) => {
      const errEvent = event as ErrorEvent;
      runtimeErrors.push(String(errEvent.error ?? errEvent.message ?? event));
    };
    const onUnhandledRejection = (event: Event) => {
      const rejectionEvent = event as PromiseRejectionEvent;
      runtimeErrors.push(String(rejectionEvent.reason ?? event));
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    try {
      const onChange = vi.fn();
      const target = document.createElement("div");
      document.body.appendChild(target);

      app = mount(ModelList, {
        target,
        props: {
          value: undefined,
          onChange,
        },
      });
      await flushUi();

      const trigger = target.querySelector(".ds-model-list-trigger") as HTMLButtonElement | null;
      expect(trigger).not.toBeNull();
      expect(trigger?.textContent?.trim()).toBe("None");
      expect(runtimeErrors).toEqual([]);
    } finally {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    }
  });

  it("renders the picker in a body portal so parent overflow cannot clip it", async () => {
    const onChange = vi.fn();
    const clippingContainer = document.createElement("div");
    clippingContainer.style.overflow = "hidden";
    clippingContainer.style.height = "12px";
    clippingContainer.style.position = "relative";
    document.body.appendChild(clippingContainer);

    const target = document.createElement("div");
    clippingContainer.appendChild(target);

    app = mount(ModelList, {
      target,
      props: {
        value: "provider:model-a",
        onChange,
      },
    });
    await flushUi();

    const trigger = clippingContainer.querySelector(".ds-model-list-trigger") as HTMLButtonElement | null;
    expect(trigger).not.toBeNull();
    trigger?.click();
    await flushUi();

    const overlay = document.querySelector(".ds-model-list-overlay") as HTMLElement | null;
    expect(overlay).not.toBeNull();
    expect(overlay?.parentElement).toBe(document.body);
    expect(overlay ? clippingContainer.contains(overlay) : true).toBe(false);
    expect(overlay?.getAttribute("role")).toBe("button");

    const dialog = overlay?.querySelector('[role="dialog"][aria-modal="true"]') as HTMLElement | null;
    expect(dialog).not.toBeNull();

    overlay?.click();
    await flushUi();
    expect(document.querySelector(".ds-model-list-overlay")).toBeNull();
  });
});
