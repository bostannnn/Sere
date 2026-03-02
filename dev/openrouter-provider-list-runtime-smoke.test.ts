import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

vi.mock(import("src/lang"), () => ({
  language: {
    provider: "Provider",
  },
}));

import OpenrouterProviderList from "src/lib/UI/OpenrouterProviderList.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("openrouter provider list runtime smoke", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("keeps compact icon primitive in modal and supports provider selection", async () => {
    const onChange = vi.fn();
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(OpenrouterProviderList, {
      target,
      props: {
        value: "OpenRouter",
        options: ["OpenRouter", "Anthropic"],
        onChange,
      },
    });
    await flushUi();

    const trigger = document.querySelector(".ds-settings-provider-trigger") as HTMLButtonElement | null;
    expect(trigger).not.toBeNull();
    const dialog = document.querySelector(".ds-provider-list-dialog") as HTMLDialogElement | null;
    expect(dialog).not.toBeNull();
    expect(dialog?.open).toBe(false);

    trigger?.click();
    await flushUi();

    const modal = document.querySelector(".ds-settings-modal");
    expect(modal).not.toBeNull();
    expect(dialog?.open).toBe(true);

    const modalActionRail = document.querySelector(
      ".ds-settings-inline-actions.action-rail",
    ) as HTMLElement | null;
    expect(modalActionRail).not.toBeNull();

    const backButton = document.querySelector(
      ".ds-settings-icon-action.icon-btn.icon-btn--sm",
    ) as HTMLButtonElement | null;
    expect(backButton).not.toBeNull();

    const providerOptions = Array.from(
      document.querySelectorAll(".ds-settings-provider-option"),
    ) as HTMLButtonElement[];
    expect(providerOptions.length).toBe(2);
    providerOptions[1]?.click();
    await flushUi();
    expect(onChange).toHaveBeenLastCalledWith("Anthropic");
    expect(dialog?.open).toBe(false);
  });

  it("accepts custom provider input and closes modal on change", async () => {
    const onChange = vi.fn();
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(OpenrouterProviderList, {
      target,
      props: {
        value: "OpenRouter",
        options: ["OpenRouter"],
        onChange,
      },
    });
    await flushUi();

    const trigger = document.querySelector(".ds-settings-provider-trigger") as HTMLButtonElement | null;
    const dialog = document.querySelector(".ds-provider-list-dialog") as HTMLDialogElement | null;
    expect(dialog).not.toBeNull();
    trigger?.click();
    await flushUi();
    expect(dialog?.open).toBe(true);

    const customInput = document.querySelector(".ds-settings-modal .ds-ui-input") as HTMLInputElement | null;
    expect(customInput).not.toBeNull();
    customInput!.value = "Custom Provider";
    customInput!.dispatchEvent(new Event("input", { bubbles: true }));
    customInput!.dispatchEvent(new Event("change", { bubbles: true }));
    await flushUi();

    expect(onChange).toHaveBeenLastCalledWith("Custom Provider");
    expect(dialog?.open).toBe(false);
  });
});
