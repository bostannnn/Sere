import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

const hoisted = vi.hoisted(() => ({
  selectedFiles: [] as Array<{ data: Uint8Array; name: string }>,
  saveCounter: 0,
}));

vi.mock(import("src/ts/globalApi.svelte"), () => ({
  getFileSrc: async (path: string) => `file://${path}`,
  saveAsset: async (_data: Uint8Array, _folder: string, extension: string) => {
    hoisted.saveCounter += 1;
    return `saved-${hoisted.saveCounter}.${extension}`;
  },
}));

vi.mock(import("src/ts/util"), () => ({
  selectMultipleFile: async () => hoisted.selectedFiles,
}));

import AssetInput from "src/lib/ChatScreens/AssetInput.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("asset input runtime smoke", () => {
  beforeEach(() => {
    hoisted.selectedFiles = [];
    hoisted.saveCounter = 0;
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("uses icon/action/panel primitives for asset controls and preserves select behavior", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    const currentCharacter = {
      type: "character",
      additionalAssets: [
        ["Song", "song.mp3", "mp3"],
        ["Scene", "scene.png", "png"],
      ],
    };
    const onSelect = vi.fn();

    app = mount(AssetInput, {
      target,
      props: {
        currentCharacter,
        onSelect,
      },
    });

    await flushUi();

    expect(target.querySelector(".ds-chat-asset-add-button.icon-btn.icon-btn--md")).not.toBeNull();
    expect(target.querySelector(".ds-chat-asset-list.action-rail")).not.toBeNull();
    expect(target.querySelector(".ds-chat-asset-tile.panel-shell, .ds-chat-asset-audio-tile.panel-shell")).not.toBeNull();

    const addButton = target.querySelector(".ds-chat-asset-add-button.icon-btn.icon-btn--md") as HTMLButtonElement | null;
    expect(addButton).not.toBeNull();
    expect(addButton?.type).toBe("button");
    expect(addButton?.getAttribute("aria-label")).toBe("Add asset");

    const assetButtons = [...target.querySelectorAll(".ds-chat-asset-list button")] as HTMLButtonElement[];
    expect(assetButtons.length).toBeGreaterThan(0);
    expect(assetButtons.every((button) => button.type === "button")).toBe(true);
    expect(assetButtons[0]?.getAttribute("aria-label")).toContain("Select asset:");
    assetButtons[0]?.click();

    expect(onSelect).toHaveBeenCalledWith(currentCharacter.additionalAssets[0]);
  });

  it("keeps add flow behavior while using primitive-composed button classes", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    const currentCharacter = {
      type: "character",
      additionalAssets: [] as [string, string, string][],
    };
    hoisted.selectedFiles = [{ data: new Uint8Array([1, 2, 3]), name: "newAsset.PNG" }];

    app = mount(AssetInput, {
      target,
      props: {
        currentCharacter,
        onSelect: () => {},
      },
    });

    await flushUi();

    const addButton = target.querySelector(".ds-chat-asset-add-button.icon-btn.icon-btn--md") as HTMLButtonElement | null;
    expect(addButton).not.toBeNull();
    expect(addButton?.type).toBe("button");
    addButton?.click();

    await flushUi();

    expect(currentCharacter.additionalAssets.length).toBe(1);
    expect(currentCharacter.additionalAssets[0]?.[0]).toBe("newAsset.PNG");
    expect(currentCharacter.additionalAssets[0]?.[1]).toBe("saved-1.png");
    expect(currentCharacter.additionalAssets[0]?.[2]).toBe("png");
  });
});
