import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

vi.mock(import("src/lang"), () => ({
  language: {
    creatorNotes: "Creator Notes",
    remove: "Remove",
  },
}));

vi.mock(import("src/lib/UI/GUI/MultiLangDisplay.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));

vi.mock(import("src/ts/stores.svelte"), () => ({
  DBState: {
    db: {
      zoomsize: 100,
      lineHeight: 1.25,
    },
  },
}));

vi.mock(import("src/ts/gui/longtouch"), () => ({
  longpress: () => ({
    destroy: () => {},
    update: () => {},
  }),
}));

import CreatorQuote from "src/lib/ChatScreens/CreatorQuote.svelte";
import TextAreaResizable from "src/lib/UI/GUI/TextAreaResizable.svelte";

let mountedApps: Array<Record<string, unknown>> = [];

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("chat auxiliary primitives runtime smoke", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    mountedApps = [];
  });

  afterEach(async () => {
    for (const app of mountedApps) {
      await unmount(app);
    }
    mountedApps = [];
  });

  it("keeps creator quote card/close actions on panel/icon primitives", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const onRemove = vi.fn();

    mountedApps.push(
      mount(CreatorQuote, {
        target,
        props: {
          quote: "A quote",
          onRemove,
        },
      }),
    );

    await flushUi();

    expect(target.querySelector(".ds-chat-creator-quote-card.panel-shell")).not.toBeNull();

    const closeButton = target.querySelector(
      ".ds-chat-creator-quote-close.icon-btn.icon-btn--sm",
    ) as HTMLButtonElement | null;
    expect(closeButton).not.toBeNull();
    expect(closeButton?.type).toBe("button");
    expect(closeButton?.getAttribute("aria-label")).toBe("Remove");
    closeButton?.click();
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("keeps resizable editor on control-field primitive", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    mountedApps.push(
      mount(TextAreaResizable, {
        target,
        props: {
          value: "seed",
        },
      }),
    );

    await flushUi();

    const textarea = target.querySelector(
      "textarea.ds-textarea-resizable.control-field.message-edit-area",
    ) as HTMLTextAreaElement | null;
    expect(textarea).not.toBeNull();
    expect(textarea?.value).toBe("seed");

    textarea!.value = "updated";
    textarea!.dispatchEvent(new Event("input", { bubbles: true }));
    await flushUi();

    expect(textarea?.value).toBe("updated");
  });
});
