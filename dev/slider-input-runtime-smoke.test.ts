import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

vi.mock(import("src/lang"), () => ({
  language: {
    disabled: "Disabled",
  },
}));

import SliderInputHarness from "./test-stubs/SliderInputHarness.svelte";
import DisableableSliderInputHarness from "./test-stubs/DisableableSliderInputHarness.svelte";

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
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(SliderInputHarness, {
      target,
    });
    await tick();

    const slider = target.querySelector('input[type="range"]') as HTMLInputElement | null;
    expect(slider).not.toBeNull();

    slider!.value = "0.5";
    slider!.dispatchEvent(new Event("input", { bubbles: true }));
    await tick();

    expect(slider!.value).toBe("0.5");
    expect(slider!.getAttribute("aria-valuenow")).toBe("0.5");
    expect(target.querySelector(".ds-ui-slider-value")?.textContent?.trim()).toBe("0.50");
    expect(target.querySelector('[data-testid="slider-bound-value"]')?.textContent).toBe("0.5");
    expect(target.querySelector('[data-testid="slider-callback-values"]')?.textContent).toBe(
      "0.5",
    );
  });

  it("uses the same update ordering when toggling a disableable slider", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(DisableableSliderInputHarness, { target });
    await tick();

    const checkbox = target.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    const slider = target.querySelector('input[type="range"]') as HTMLInputElement | null;

    expect(checkbox).not.toBeNull();
    expect(slider).not.toBeNull();
    expect(slider?.disabled).toBe(true);

    checkbox!.checked = true;
    checkbox!.dispatchEvent(new Event("change", { bubbles: true }));
    await tick();

    expect(target.querySelector('[data-testid="slider-bound-value"]')?.textContent).toBe("2");
    expect(target.querySelector('[data-testid="slider-callback-values"]')?.textContent).toBe("2");
    expect(slider!.disabled).toBe(false);
    expect(slider!.value).toBe("2");

    checkbox!.checked = false;
    checkbox!.dispatchEvent(new Event("change", { bubbles: true }));
    await tick();

    expect(target.querySelector('[data-testid="slider-bound-value"]')?.textContent).toBe("-1000");
    expect(target.querySelector('[data-testid="slider-callback-values"]')?.textContent).toBe(
      "2|-1000",
    );
    expect(target.querySelector(".ds-ui-slider-value")?.textContent?.trim()).toBe("Disabled");
  });
});
