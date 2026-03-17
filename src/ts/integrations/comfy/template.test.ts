import { describe, expect, it } from "vitest";
import type { ComfyCommanderTemplate } from "src/ts/storage/database.svelte";
import {
  applyTemplatePrompt,
  applyWorkflowMacros,
  cleanLLMOutput,
  resolveTemplate,
} from "./template";

describe("resolveTemplate", () => {
  const templates: ComfyCommanderTemplate[] = [
    {
      id: "tpl-1",
      trigger: "pov",
      prompt: "",
      negativePrompt: "",
      imagePromptModel: "",
      imagePromptSystemPrompt: "",
      imagePromptUserPromptTemplate: "",
      imagePromptContextMessageCount: 4,
      imagePromptMaxContextChars: 1400,
      workflowId: "wf-1",
      showInChatMenu: false,
      buttonName: "",
      providerOverride: "none",
      runpodModelId: "",
      runpodEndpointId: "",
      runpodSchemaPreset: "generic-text",
      runpodOutputFormat: "png",
      runpodWidth: 1024,
      runpodHeight: 1024,
      runpodSize: "1024*1024",
      runpodNumInferenceSteps: 28,
      runpodGuidance: 7,
      runpodStrength: 0.8,
      runpodEnableSafetyChecker: true,
      modeDefault: "text-to-image",
      useReferenceImage: false,
      referenceSource: "none",
      allowReferenceFallbackToText: false,
    },
    {
      id: "tpl-2",
      trigger: "pov wide",
      prompt: "",
      negativePrompt: "",
      imagePromptModel: "",
      imagePromptSystemPrompt: "",
      imagePromptUserPromptTemplate: "",
      imagePromptContextMessageCount: 4,
      imagePromptMaxContextChars: 1400,
      workflowId: "wf-2",
      showInChatMenu: false,
      buttonName: "",
      providerOverride: "none",
      runpodModelId: "",
      runpodEndpointId: "",
      runpodSchemaPreset: "generic-text",
      runpodOutputFormat: "png",
      runpodWidth: 1024,
      runpodHeight: 1024,
      runpodSize: "1024*1024",
      runpodNumInferenceSteps: 28,
      runpodGuidance: 7,
      runpodStrength: 0.8,
      runpodEnableSafetyChecker: true,
      modeDefault: "text-to-image",
      useReferenceImage: false,
      referenceSource: "none",
      allowReferenceFallbackToText: false,
    },
  ];

  it("matches exact trigger", () => {
    const match = resolveTemplate(templates, "pov");
    expect(match?.template.id).toBe("tpl-1");
    expect(match?.userPrompt).toBe("");
  });

  it("prefers longest prefix trigger", () => {
    const match = resolveTemplate(templates, "pov wide sunrise");
    expect(match?.template.id).toBe("tpl-2");
    expect(match?.userPrompt).toBe("sunrise");
  });

  it("returns null when no trigger matches", () => {
    const match = resolveTemplate(templates, "unknown test");
    expect(match).toBeNull();
  });
});

describe("applyWorkflowMacros", () => {
  it("replaces all workflow macros", () => {
    const workflow = JSON.stringify({
      "1": {
        inputs: {
          text: "{{risu_prompt}} | %prompt% | {{risu_neg}} | %negative_prompt% | %seed% | %char_avatar%",
          seed: "%seed%",
        },
      },
    });

    const parsed = applyWorkflowMacros(workflow, {
      positivePrompt: "sunset portrait",
      negativePrompt: "low quality",
      seed: 123,
      charAvatarBase64: "avatar-data",
    });

    const node = parsed["1"] as { inputs: Record<string, unknown> };
    expect(node.inputs.text).toBe(
      "sunset portrait | sunset portrait | low quality | low quality | 123 | avatar-data",
    );
    expect(node.inputs.seed).toBe(123);
  });

  it("handles missing avatar value", () => {
    const workflow = JSON.stringify({
      "1": {
        inputs: {
          text: "before %char_avatar% after",
        },
      },
    });

    const parsed = applyWorkflowMacros(workflow, {
      positivePrompt: "x",
      negativePrompt: "y",
      seed: 1,
      charAvatarBase64: "",
    });

    const node = parsed["1"] as { inputs: Record<string, unknown> };
    expect(node.inputs.text).toBe("before  after");
  });

  it("coerces numeric seed inputs", () => {
    const workflow = JSON.stringify({
      "1": {
        inputs: {
          seed: 999,
        },
      },
    });

    const parsed = applyWorkflowMacros(workflow, {
      positivePrompt: "x",
      negativePrompt: "y",
      seed: 777,
      charAvatarBase64: "",
    });

    const node = parsed["1"] as { inputs: Record<string, unknown> };
    expect(node.inputs.seed).toBe(777);
  });
});

describe("cleanLLMOutput", () => {
  it("strips thought blocks", () => {
    const raw = "<Thoughts>hidden</Thoughts>\n<thinking>also hidden</thinking>\nvisible";
    expect(cleanLLMOutput(raw)).toBe("visible");
  });

  it("trims outer quotes", () => {
    expect(cleanLLMOutput('"hello world"')).toBe("hello world");
  });
});

describe("applyTemplatePrompt", () => {
  it("fills chat context placeholders", () => {
    const prompt = applyTemplatePrompt("{{templatePrompt}}\n{{chatContext}}", "fallback", {
      templatePrompt: "scene",
      prompt: "extra",
      char: "Alice",
      user: "Bob",
      lastMessage: "last",
      lastCharMessage: "reply",
      chatContext: "Alice: hello",
    });

    expect(prompt).toBe("scene\nAlice: hello");
  });
});
