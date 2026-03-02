import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

vi.mock(import("src/ts/gui/guisize"), async () => {
  const { writable } = await import("svelte/store");
  return {
    textAreaSize: writable(0),
    textAreaTextSize: writable(2),
  };
});

vi.mock(import("src/ts/gui/highlight"), () => ({
  highlighter: () => {},
  getNewHighlightId: () => 1,
  removeHighlight: () => {},
  AllCBS: [],
}));

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");
  return {
    disableHighlight: writable(false),
  };
});

vi.mock(import("src/ts/platform"), () => ({
  isMobile: false,
}));

vi.mock(import("src/ts/util"), () => ({
  sleep: async (_ms = 0) => {},
}));

import TextAreaInput from "src/lib/UI/GUI/TextAreaInput.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("textarea input runtime smoke", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("keeps textarea shell/menu on shared primitives and preserves input callbacks", async () => {
    const onValueChange = vi.fn();
    const onInput = vi.fn();

    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(TextAreaInput, {
      target,
      props: {
        value: "seed",
        optimaizedInput: false,
        onValueChange,
        onInput,
      },
    });

    await flushUi();

    const shell = target.querySelector(".ds-textarea-shell.control-field") as HTMLDivElement | null;
    expect(shell).not.toBeNull();

    const autocompleteMenu = target.querySelector(
      ".ds-textarea-autocomplete-menu.ds-ui-menu",
    ) as HTMLDivElement | null;
    expect(autocompleteMenu).not.toBeNull();

    const input = target.querySelector("textarea.ds-textarea-input-layer") as HTMLTextAreaElement | null;
    expect(input).not.toBeNull();

    input!.value = "updated";
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    input!.dispatchEvent(new Event("change", { bubbles: true }));
    await flushUi();

    expect(onValueChange).toHaveBeenCalled();
    expect(onValueChange).toHaveBeenLastCalledWith("updated");
    expect(onInput).toHaveBeenCalled();
  });
});
