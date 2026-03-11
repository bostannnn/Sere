import { describe, expect, it } from "vitest";

import {
  planPeriodicMemorySummarization,
  resolveMemorySettings,
} from "./memory.cjs";

describe("memory periodic summarization runtime gating", () => {
  const baseSettings = {
    memoryEnabled: true,
    memoryPresetId: 0,
    memoryPresets: [
      {
        name: "Default",
        settings: {
          periodicSummarizationEnabled: false,
          periodicSummarizationInterval: 2,
          summarizationPrompt: "",
          doNotSummarizeUserMessage: false,
        },
      },
    ],
  };

  it("forces periodic summarization enabled for legacy presets", () => {
    const resolved = resolveMemorySettings(baseSettings, {
      supaMemory: true,
    });

    expect(resolved.periodicSummarizationEnabled).toBe(true);
    expect(resolved.periodicSummarizationInterval).toBe(2);
  });

  it("runs periodic summarization when interval is reached", () => {
    const plan = planPeriodicMemorySummarization({
      character: {
        supaMemory: true,
      },
      settings: baseSettings,
      chat: {
        message: [
          { role: "user", data: "Hello", chatId: "m1" },
          { role: "char", data: "Hi", chatId: "m2" },
        ],
        memoryData: {
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

  it("keeps character-level memory toggle as the hard gate", () => {
    const plan = planPeriodicMemorySummarization({
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
