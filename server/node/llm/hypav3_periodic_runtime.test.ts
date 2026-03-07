import { describe, expect, it } from "vitest";

import {
  planPeriodicHypaV3Summarization,
  resolveHypaV3Settings,
} from "./memory.cjs";

describe("hypav3 periodic summarization runtime gating", () => {
  const baseSettings = {
    hypaV3: true,
    hypaV3PresetId: 0,
    hypaV3Presets: [
      {
        name: "Default",
        settings: {
          periodicSummarizationEnabled: false,
          periodicSummarizationInterval: 2,
          summarizationPrompt: "",
          reSummarizationPrompt: "",
          doNotSummarizeUserMessage: false,
        },
      },
    ],
  };

  it("forces periodic summarization enabled for legacy presets", () => {
    const resolved = resolveHypaV3Settings(baseSettings, {
      supaMemory: true,
    });

    expect(resolved.periodicSummarizationEnabled).toBe(true);
    expect(resolved.periodicSummarizationInterval).toBe(2);
  });

  it("runs periodic summarization when interval is reached", () => {
    const plan = planPeriodicHypaV3Summarization({
      character: {
        supaMemory: true,
      },
      settings: baseSettings,
      chat: {
        message: [
          { role: "user", data: "Hello", chatId: "m1" },
          { role: "char", data: "Hi", chatId: "m2" },
        ],
        hypaV3Data: {
          summaries: [],
          lastSummarizedMessageIndex: 0,
        },
      },
    });

    expect(plan.shouldRun).toBe(true);
    expect(plan.reason).toBe("ready");
    expect(Array.isArray(plan.promptMessages)).toBe(true);
    expect(plan.promptMessages.length).toBeGreaterThan(0);
    expect(plan.summarizable.length).toBe(2);
  });

  it("maps {{char}}/{{user}} in periodic prompt to character/persona names", () => {
    const plan = planPeriodicHypaV3Summarization({
      character: {
        supaMemory: true,
        name: "Eva",
      },
      settings: {
        ...baseSettings,
        username: "FallbackUser",
        personas: [{ id: "persona-1", name: "Bound Persona" }],
        hypaV3Presets: [
          {
            name: "Default",
            settings: {
              periodicSummarizationEnabled: true,
              periodicSummarizationInterval: 2,
              summarizationPrompt: "Track {{char}} with {{user}}",
              reSummarizationPrompt: "",
              doNotSummarizeUserMessage: false,
            },
          },
        ],
      },
      chat: {
        bindedPersona: "persona-1",
        message: [
          { role: "user", data: "Hello", chatId: "m1" },
          { role: "char", data: "Hi", chatId: "m2" },
        ],
        hypaV3Data: {
          summaries: [],
          lastSummarizedMessageIndex: 0,
        },
      },
    });

    expect(plan.shouldRun).toBe(true);
    expect(plan.promptMessages?.[1]?.content).toBe("Track Eva with Bound Persona");
  });

  it("keeps character-level memory toggle as the hard gate", () => {
    const plan = planPeriodicHypaV3Summarization({
      character: {
        supaMemory: false,
      },
      settings: baseSettings,
      chat: {
        message: [
          { role: "user", data: "Hello", chatId: "m1" },
          { role: "char", data: "Hi", chatId: "m2" },
        ],
      },
    });

    expect(plan.shouldRun).toBe(false);
    expect(plan.reason).toBe("memory_disabled_on_character");
  });
});
