import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

vi.mock(import("src/lang"), () => ({
  language: {
    disabled: "Disabled",
  },
}));

vi.mock(import("src/lib/UI/GUI/CheckInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));

import SliderInput from "src/lib/UI/GUI/SliderInput.svelte";

let app: Record<string, unknown> | undefined;

describe("slider input runtime smoke", () => {
  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
    document.body.innerHTML = "";
  });

  it("commits the updated value before notifying the parent", async () => {
    const onchange = vi.fn();
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(SliderInput, {
      target,
      props: {
        min: 0,
        max: 1,
        step: 0.01,
        fixed: 2,
        value: 0.12,
        onchange,
      },
    });
    await tick();

    const slider = target.querySelector('input[type="range"]') as HTMLInputElement | null;
    expect(slider).not.toBeNull();

    slider!.value = "0.5";
    slider!.dispatchEvent(new Event("input", { bubbles: true }));
    await tick();

    expect(onchange).toHaveBeenCalledTimes(1);
    expect(slider!.value).toBe("0.5");
    expect(slider!.getAttribute("aria-valuenow")).toBe("0.5");
    expect(target.querySelector(".ds-ui-slider-value")?.textContent?.trim()).toBe("0.50");
  });
});
