import { beforeEach, describe, expect, it, vi } from "vitest";

const requestChatDataMock = vi.hoisted(() => vi.fn());
const parseChatMLMock = vi.hoisted(() => vi.fn((data: string): null => {
  void data;
  return null;
}));

const personaName = "Alex Persona";
const characterName = "Eve";

const dbState = {
  subModel: "mock-submodel",
  hypaV3PresetId: "default",
  hypaV3Presets: {
    default: {
      name: "Default",
      settings: {
        summarizationModel: "subModel",
        summarizationPrompt: "You are {{char}} with {{user}}.",
        reSummarizationPrompt: "",
        summarizationAllowThinking: false,
        memoryTokensRatio: 1,
        extraSummarizationRatio: 0,
        maxChatsPerSummary: 10,
        periodicSummarizationEnabled: false,
        periodicSummarizationInterval: 10,
        recentMemoryRatio: 1,
        similarMemoryRatio: 0,
        enableSimilarityCorrection: false,
        preserveOrphanedMemory: false,
        processRegexScript: false,
        doNotSummarizeUserMessage: false,
        useExperimentalImpl: false,
        summarizationRequestsPerMinute: 60,
        summarizationMaxConcurrent: 1,
        embeddingRequestsPerMinute: 60,
        embeddingMaxConcurrent: 1,
        alwaysToggleOn: false,
      },
    },
  },
} as const;

vi.mock(import("src/ts/process/request/request"), () => ({
  requestChatData: requestChatDataMock,
}));

vi.mock(import("src/ts/process/webllm"), () => ({
  chatCompletion: vi.fn(),
  unloadEngine: vi.fn(),
}));

vi.mock(import("src/ts/parser/chatML"), () => ({
  parseChatML: parseChatMLMock,
}));

vi.mock(import("src/ts/storage/database.svelte"), () => ({
  getDatabase: () => dbState,
  getCurrentCharacter: () => ({ type: "character", name: characterName, nickname: "" }),
} as unknown as typeof import("src/ts/storage/database.svelte")));

vi.mock(import("src/ts/stores.svelte"), () => ({
  hypaV3ProgressStore: {
    set: vi.fn(),
    update: vi.fn(),
    subscribe: vi.fn(() => () => {}),
  },
} as unknown as typeof import("src/ts/stores.svelte")));

vi.mock(import("src/ts/parser.svelte"), () => ({
  risuChatParser: (
    text: string,
    arg?: {
      chara?: { name?: string; nickname?: string };
    } | undefined
  ) =>
    text
      .replaceAll("{{char}}", arg?.chara?.nickname || arg?.chara?.name || "")
      .replaceAll("{{user}}", personaName),
} as unknown as typeof import("src/ts/parser.svelte")));

import { summarize } from "./hypav3";

describe("hypav3 summarize prompt parsing", () => {
  beforeEach(() => {
    requestChatDataMock.mockReset();
    parseChatMLMock.mockClear();
    requestChatDataMock.mockResolvedValue({
      type: "success",
      result: "Summary output",
    });
  });

  it("resolves {{char}}/{{user}} to character/persona names before summarization request", async () => {
    const out = await summarize([
      { role: "user", content: "Hello from chat" },
    ] as never);

    expect(out).toBe("Summary output");

    expect(parseChatMLMock).toHaveBeenCalledTimes(1);
    const parseInput = String(parseChatMLMock.mock.calls[0]?.[0] ?? "");
    expect(parseInput).toContain(`You are ${characterName} with ${personaName}.`);
    expect(parseInput).not.toContain("{{char}}");
    expect(parseInput).not.toContain("{{user}}");

    expect(requestChatDataMock).toHaveBeenCalledTimes(1);
    const requestArg = requestChatDataMock.mock.calls[0]?.[0] as {
      formated: Array<{ role: string; content: string }>;
    };
    const systemMessage = requestArg.formated.find((msg) => msg.role === "system");
    expect(systemMessage?.content).toContain(`You are ${characterName} with ${personaName}.`);
    expect(systemMessage?.content).not.toContain("{{char}}");
    expect(systemMessage?.content).not.toContain("{{user}}");
  });
});
