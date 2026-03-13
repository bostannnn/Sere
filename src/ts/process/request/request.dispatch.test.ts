import { beforeEach, describe, expect, it, vi } from "vitest";

const shared = vi.hoisted(() => {
  const requestOpenAIMock = vi.fn();
  const requestOpenAILegacyInstructMock = vi.fn();
  const requestOpenAIResponseAPIMock = vi.fn();
  const requestGoogleCloudVertexMock = vi.fn();
  const requestClaudeMock = vi.fn();
  const getModelInfoMock = vi.fn();
  const getDatabaseMock = vi.fn(() => ({
    maxResponse: 256,
    temperature: 100,
    aiModel: "instructgpt35",
    subModel: "instructgpt35",
    genTime: 1,
    extractJson: "",
    seperateModelsForAxModels: false,
    useStreaming: false,
    fallbackModels: {},
  }));

  return {
    requestOpenAIMock,
    requestOpenAILegacyInstructMock,
    requestOpenAIResponseAPIMock,
    requestGoogleCloudVertexMock,
    requestClaudeMock,
    getModelInfoMock,
    getDatabaseMock,
  };
});

vi.mock("ollama/dist/browser.mjs", () => ({
  Ollama: class {},
}));

vi.mock("src/lang", () => ({
  language: {
    errors: {
      httpError: "HTTP ",
      unknownModel: "Unknown model",
    },
  },
}));

vi.mock("src/ts/globalApi.svelte", () => ({
  addFetchLog: vi.fn(),
  fetchNative: vi.fn(),
  globalFetch: vi.fn(),
  textifyReadableStream: vi.fn(),
}));

vi.mock("src/ts/model/modellist", () => ({
  getModelInfo: shared.getModelInfoMock,
  LLMFlags: {
    hasFullSystemPrompt: "hasFullSystemPrompt",
    hasFirstSystemPrompt: "hasFirstSystemPrompt",
    requiresAlternateRole: "requiresAlternateRole",
    mustStartWithUserInput: "mustStartWithUserInput",
  },
  LLMFormat: {
    OpenAICompatible: "OpenAICompatible",
    OpenAILegacyInstruct: "OpenAILegacyInstruct",
    NovelAI: "NovelAI",
    GoogleCloud: "GoogleCloud",
    Kobold: "Kobold",
    Ollama: "Ollama",
    Anthropic: "Anthropic",
    AnthropicLegacy: "AnthropicLegacy",
    OpenAIResponseAPI: "OpenAIResponseAPI",
  },
}));

vi.mock("src/ts/parser.svelte", () => ({
  risuEscape: (value: string) => value,
  risuUnescape: (value: string) => value,
}));

vi.mock("src/ts/storage/database.svelte", () => ({
  getCurrentCharacter: vi.fn(() => null),
  getCurrentChat: vi.fn(() => null),
  getDatabase: shared.getDatabaseMock,
}));

vi.mock("src/ts/tokenizer", () => ({
  tokenizeNum: vi.fn(async () => []),
}));

vi.mock("src/ts/util", () => ({
  sleep: vi.fn(async () => undefined),
}));

vi.mock("src/ts/platform", () => ({
  isNodeServer: true,
}));

vi.mock("src/ts/process/mcp/mcp", () => ({
  getTools: vi.fn(async () => []),
}));

vi.mock("src/ts/process/models/nai", () => ({
  NovelAIBadWordIds: {},
  stringlizeNAIChat: vi.fn(),
}));

vi.mock("src/ts/process/stringlize", () => ({
  unstringlizeChat: vi.fn((value: string) => value),
}));

vi.mock("src/ts/process/templates/chatTemplate", () => ({
  applyChatTemplate: vi.fn(() => ""),
}));

vi.mock("src/ts/process/triggers", () => ({
  runTrigger: vi.fn(async () => null),
}));

vi.mock("src/ts/process/request/openAI", () => ({
  requestOpenAI: shared.requestOpenAIMock,
  requestOpenAILegacyInstruct: shared.requestOpenAILegacyInstructMock,
  requestOpenAIResponseAPI: shared.requestOpenAIResponseAPIMock,
}));

vi.mock("src/ts/process/request/google", () => ({
  requestGoogleCloudVertex: shared.requestGoogleCloudVertexMock,
}));

vi.mock("src/ts/process/request/anthropic", () => ({
  requestClaude: shared.requestClaudeMock,
}));

vi.mock("src/ts/process/request/request.parameters", () => ({
  applyParameters: vi.fn((data: unknown) => data),
  setObjectValue: vi.fn((obj: Record<string, unknown>, key: string, value: unknown) => {
    obj[key] = value;
    return obj;
  }),
}));

vi.mock("src/ts/process/request/request.responses", () => ({
  getServerStringSuccessResult: vi.fn(),
  normalizeServerEnvelope: vi.fn((raw: unknown) => raw),
  stringifyUnknownResponse: vi.fn((raw: unknown) => (typeof raw === "string" ? raw : JSON.stringify(raw))),
}));

vi.mock("src/ts/process/request/ragPayload", () => ({
  buildCharacterRagPayload: vi.fn(),
  buildGlobalRagPayload: vi.fn(),
}));

vi.mock("src/ts/process/request/request.routing", () => ({
  isRemovedProviderModel: vi.fn((aiModel?: string) => aiModel === "reverse_proxy"),
  resolveServerStreaming: vi.fn((_provider: string, requested: boolean) => requested),
}));

import { requestChatDataMain } from "./request";

describe("requestChatDataMain dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("safeStructuredClone", structuredClone);

    shared.requestOpenAIMock.mockResolvedValue({ type: "success", result: "openai" });
    shared.requestOpenAILegacyInstructMock.mockResolvedValue({ type: "success", result: "legacy-instruct" });
    shared.requestOpenAIResponseAPIMock.mockResolvedValue({ type: "success", result: "response-api" });
    shared.requestGoogleCloudVertexMock.mockResolvedValue({ type: "success", result: "google" });
    shared.requestClaudeMock.mockResolvedValue({ type: "success", result: "claude" });
  });

  it("dispatches OpenAI legacy instruct format even in node runtime", async () => {
    shared.getModelInfoMock.mockReturnValue({
      format: "OpenAILegacyInstruct",
      flags: [],
      parameters: [],
    });

    const result = await requestChatDataMain({
      formated: [{ role: "user", content: "hello" }],
      bias: {},
    }, "model");

    expect(shared.requestOpenAILegacyInstructMock).toHaveBeenCalledTimes(1);
    expect(shared.requestOpenAIResponseAPIMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      type: "success",
      result: "legacy-instruct",
    });
  });

  it("dispatches OpenAI response API format even in node runtime", async () => {
    shared.getModelInfoMock.mockReturnValue({
      format: "OpenAIResponseAPI",
      flags: [],
      parameters: [],
    });

    const result = await requestChatDataMain({
      formated: [{ role: "user", content: "hello" }],
      bias: {},
    }, "model");

    expect(shared.requestOpenAIResponseAPIMock).toHaveBeenCalledTimes(1);
    expect(shared.requestOpenAILegacyInstructMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      type: "success",
      result: "response-api",
    });
  });

  it("still rejects removed providers before dispatch", async () => {
    const result = await requestChatDataMain({
      formated: [{ role: "user", content: "hello" }],
      bias: {},
      staticModel: "reverse_proxy",
    }, "model");

    expect(shared.requestOpenAILegacyInstructMock).not.toHaveBeenCalled();
    expect(shared.requestOpenAIResponseAPIMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      type: "fail",
      noRetry: true,
      result: "HTTP Provider has been removed: reverse_proxy",
    });
  });
});
