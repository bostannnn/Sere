import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

vi.mock(import("@lucide/svelte"), async () => ({
  TrashIcon: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/Accordion.svelte"), async () => ({
  default: (await import("./test-stubs/AccordionOpenStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/Button.svelte"), async () => ({
  default: (await import("./test-stubs/ButtonStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/CheckInput.svelte"), async () => ({
  default: (await import("./test-stubs/CheckInputStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/NumberInput.svelte"), async () => ({
  default: (await import("./test-stubs/NumberInputStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/SelectInput.svelte"), async () => ({
  default: (await import("./test-stubs/SelectInputStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/OptionInput.svelte"), async () => ({
  default: (await import("./test-stubs/OptionInputStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/TextAreaInput.svelte"), async () => ({
  default: (await import("./test-stubs/TextAreaInputStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/TextInput.svelte"), async () => ({
  default: (await import("./test-stubs/TextInputStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/OpenRouterModelSelect.svelte"), async () => ({
  default: (await import("./test-stubs/OpenRouterModelSelectStub.svelte")).default,
}));

import ComfyCommanderTemplateEditor from "src/lib/Setting/Pages/Advanced/ComfyCommanderTemplateEditor.svelte";
import {
  createDefaultComfyCommanderRunpodConfig,
  createEmptyComfyCommanderTemplate,
  formatComfyCommanderImagePromptModel,
} from "src/ts/integrations/comfy/config";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("comfy commander template editor runtime smoke", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("keeps the selected OpenRouter prompt model after changing it", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    const template = {
      ...createEmptyComfyCommanderTemplate(),
      imagePromptModel: formatComfyCommanderImagePromptModel("openrouter", "deepseek/deepseek-v3.2"),
    };

    app = mount(ComfyCommanderTemplateEditor, {
      target,
      props: {
        template,
        index: 0,
        workflows: [],
        activeProvider: "runpod",
        runpodConfig: createDefaultComfyCommanderRunpodConfig(),
        onRemove: () => {},
      },
    });
    await flushUi();

    const modelSelect = target.querySelector('[data-testid="openrouter-model-select-stub"]') as HTMLSelectElement | null;
    expect(modelSelect).not.toBeNull();
    expect(modelSelect?.value).toBe("deepseek/deepseek-v3.2");

    modelSelect!.value = "mistralai/mistral-large";
    modelSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    await flushUi();

    expect(modelSelect?.value).toBe("mistralai/mistral-large");
    expect(template.imagePromptModel).toBe(formatComfyCommanderImagePromptModel("openrouter", "mistralai/mistral-large"));
  });
});
