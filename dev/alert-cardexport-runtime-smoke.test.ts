import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";
import { get } from "svelte/store";

const hoisted = vi.hoisted(() => ({
  alertStoreRef: null as ReturnType<typeof import("svelte/store").writable> | null,
}));

vi.mock(import("src/lang"), () => ({
  language: {
    shareExport: "Share/Export",
    type: "Type",
    risuMDesc: "Module export",
    risupresetDesc: "Preset export",
    ccv3Desc: "CCV3 export",
    format: "Format",
    export: "Export",
    notCharxWarn: "CHARX warning",
  },
}));

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");
  const alertStore = writable({
    type: "none",
    msg: "",
  });
  hoisted.alertStoreRef = alertStore;
  return {
    alertStore,
    DBState: {
      db: {
        botPresetsId: 0,
        botPresets: [{ image: "", regex: [] }],
        characters: [{ additionalAssets: [], emotionImages: [], ccAssets: [] }],
      },
    },
    selectedCharID: writable(0),
  };
});

vi.mock(import("src/ts/characterCards"), () => ({
  isCharacterHasAssets: vi.fn(() => false),
}));

vi.mock(import("src/lib/UI/GUI/Button.svelte"), async () => ({
  default: (await import("./test-stubs/ComponentActionButtonStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/CheckInput.svelte"), async () => ({
  default: (await import("./test-stubs/CheckInputStub.svelte")).default,
}));

describe("AlertCardExportModal runtime smoke", () => {
  let app: ReturnType<typeof mount> | null = null;

  beforeEach(() => {
    document.body.innerHTML = "";
    hoisted.alertStoreRef?.set({
      type: "none",
      msg: "",
    });
  });

  afterEach(() => {
    if (app) {
      unmount(app);
      app = null;
    }
    document.body.innerHTML = "";
  });

  it("shows bundle options only for JSON and writes the expanded payload", async () => {
    const { default: AlertCardExportModal } = await import("src/lib/Others/AlertComp/AlertCardExportModal.svelte");
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(AlertCardExportModal, {
      target,
      props: {
        alert: {
          type: "cardexport",
          msg: "",
          submsg: "",
        },
      },
    });
    await tick();

    let checkboxes = [...document.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[];
    expect(checkboxes).toHaveLength(3);
    expect(checkboxes[1]?.disabled).toBe(true);

    const select = document.querySelector("select") as HTMLSelectElement | null;
    expect(select).not.toBeNull();
    expect(select!.value).toBe("json");

    select!.selectedIndex = 2;
    select!.value = "png";
    select!.dispatchEvent(new Event("change", { bubbles: true }));
    await tick();
    await tick();

    expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    expect(document.body.textContent).toContain("Other formats export the base character card only.");

    select!.selectedIndex = 3;
    select!.value = "json";
    select!.dispatchEvent(new Event("change", { bubbles: true }));
    await tick();
    await tick();

    checkboxes = [...document.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[];
    expect(checkboxes).toHaveLength(3);
    expect(checkboxes[1]?.disabled).toBe(true);

    checkboxes[0]?.click();
    await tick();
    expect(checkboxes[1]?.disabled).toBe(false);

    checkboxes[1]?.click();
    checkboxes[2]?.click();
    await tick();

    const exportButton = document.querySelector(".alert-cardexport-submit") as HTMLButtonElement | null;
    expect(exportButton).not.toBeNull();
    exportButton?.click();
    await tick();

    expect(JSON.parse(get(hoisted.alertStoreRef!).msg)).toEqual({
      format: "json",
      includeChats: true,
      includeMemories: true,
      includeEvolution: true,
      cancelled: false,
    });
  }, 10000);
});
