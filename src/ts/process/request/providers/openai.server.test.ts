import { beforeEach, describe, expect, it, vi } from "vitest";

const shared = vi.hoisted(() => {
  const getDatabaseMock = vi.fn(() => ({
    globalRagSettings: { enabled: true },
    openrouterAllowReasoningOnlyForDeepSeekV32Speciale: false,
  }));
  const cloneServerRequestBodyMock = vi.fn();
  const getLatestUserMessageMock = vi.fn();
  const hasMultimodalMessagesMock = vi.fn();
  const requestServerJsonMock = vi.fn();
  const requestServerPreviewMock = vi.fn();
  const requestServerStreamMock = vi.fn();
  const resolveServerExecutionEndpointMock = vi.fn();
  const readFailedServerStreamMock = vi.fn();
  const getServerFailureMessageMock = vi.fn();
  const getServerStringSuccessResultMock = vi.fn();
  const normalizeServerEnvelopeMock = vi.fn();
  const parseServerErrorPayloadMock = vi.fn();
  const stringifyUnknownResponseMock = vi.fn();
  const buildCharacterRagPayloadMock = vi.fn((value: unknown) => value);
  const buildGlobalRagPayloadMock = vi.fn((value: unknown) => value);
  const getTranStreamMock = vi.fn();
  const wrapToolStreamMock = vi.fn();

  return {
    getDatabaseMock,
    cloneServerRequestBodyMock,
    getLatestUserMessageMock,
    hasMultimodalMessagesMock,
    requestServerJsonMock,
    requestServerPreviewMock,
    requestServerStreamMock,
    resolveServerExecutionEndpointMock,
    readFailedServerStreamMock,
    getServerFailureMessageMock,
    getServerStringSuccessResultMock,
    normalizeServerEnvelopeMock,
    parseServerErrorPayloadMock,
    stringifyUnknownResponseMock,
    buildCharacterRagPayloadMock,
    buildGlobalRagPayloadMock,
    getTranStreamMock,
    wrapToolStreamMock,
  };
});

vi.mock("src/lang", () => ({
  language: {
    errors: {
      httpError: "HTTP ",
    },
  },
}));

vi.mock("src/ts/storage/database.svelte", () => ({
  getDatabase: shared.getDatabaseMock,
}));

vi.mock("../ragPayload", () => ({
  buildCharacterRagPayload: shared.buildCharacterRagPayloadMock,
  buildGlobalRagPayload: shared.buildGlobalRagPayloadMock,
}));

vi.mock("../request.responses", () => ({
  getServerFailureMessage: shared.getServerFailureMessageMock,
  getServerStringSuccessResult: shared.getServerStringSuccessResultMock,
  normalizeServerEnvelope: shared.normalizeServerEnvelopeMock,
  parseServerErrorPayload: shared.parseServerErrorPayloadMock,
  stringifyUnknownResponse: shared.stringifyUnknownResponseMock,
}));

vi.mock("../request.transport", () => ({
  cloneServerRequestBody: shared.cloneServerRequestBodyMock,
  getLatestUserMessage: shared.getLatestUserMessageMock,
  hasMultimodalMessages: shared.hasMultimodalMessagesMock,
  requestServerJson: shared.requestServerJsonMock,
  requestServerPreview: shared.requestServerPreviewMock,
  requestServerStream: shared.requestServerStreamMock,
  resolveServerExecutionEndpoint: shared.resolveServerExecutionEndpointMock,
  readFailedServerStream: shared.readFailedServerStreamMock,
}));

vi.mock("./openai.stream", () => ({
  getTranStream: shared.getTranStreamMock,
  wrapToolStream: shared.wrapToolStreamMock,
}));

import {
  requestOpenAIServerExecution,
  requestOpenRouterServerExecution,
} from "./openai.server";

describe("openai server execution helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    shared.cloneServerRequestBodyMock.mockImplementation((body: unknown) => structuredClone(body));
    shared.getLatestUserMessageMock.mockReturnValue("hello");
    shared.hasMultimodalMessagesMock.mockReturnValue(false);
    shared.resolveServerExecutionEndpointMock.mockReturnValue("/data/llm/generate");
    shared.getServerStringSuccessResultMock.mockReturnValue({
      result: "server result",
      newCharEtag: "etag-1",
    });
    shared.getServerFailureMessageMock.mockReturnValue("server failed");
    shared.normalizeServerEnvelopeMock.mockImplementation((raw: unknown) => raw);
    shared.stringifyUnknownResponseMock.mockImplementation((raw: unknown) =>
      typeof raw === "string" ? raw : JSON.stringify(raw),
    );
    shared.parseServerErrorPayloadMock.mockReturnValue({
      code: "UNKNOWN",
      status: 500,
      message: "boom",
    });
  });

  it("uses the generate endpoint and raw payload when server-side assembly can be reused", async () => {
    shared.requestServerJsonMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        type: "success",
        result: "server result",
      },
    });

    const result = await requestOpenAIServerExecution(
      {
        mode: "model",
        bias: {},
        formated: [{ role: "user", content: "hello" }],
        currentChar: { chaId: "char-1", ragSettings: { enabled: true } } as never,
        chatId: "chat-1",
        modelInfo: { format: "OpenAICompatible" } as never,
      },
      {
        model: "gpt-4o-mini",
        max_tokens: 123,
        stream: true,
        messages: [{ role: "user", content: "hello" }],
        tools: [{ type: "function", function: { name: "lookup" } }],
      },
    );

    expect(shared.resolveServerExecutionEndpointMock).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "model" }),
      true,
    );
    expect(shared.requestServerJsonMock).toHaveBeenCalledWith(
      "/data/llm/generate",
      expect.objectContaining({
        provider: "openai",
        userMessage: "hello",
        model: "gpt-4o-mini",
        maxTokens: 123,
        request: expect.objectContaining({
          requestBody: {
            model: "gpt-4o-mini",
            max_tokens: 123,
            tools: [{ type: "function", function: { name: "lookup" } }],
          },
        }),
      }),
      expect.objectContaining({ chatId: "chat-1" }),
    );
    expect(result).toEqual({
      type: "success",
      result: "server result",
      newCharEtag: "etag-1",
    });
  });

  it("falls back to execute endpoint for non-model modes", async () => {
    shared.resolveServerExecutionEndpointMock.mockReturnValue("/data/llm/execute");
    shared.requestServerJsonMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        type: "success",
        result: "server result",
      },
    });

    await requestOpenAIServerExecution(
      {
        mode: "emotion",
        bias: {},
        formated: [{ role: "user", content: "hello" }],
        currentChar: { chaId: "char-1" } as never,
        chatId: "chat-1",
        modelInfo: { format: "OpenAICompatible" } as never,
      },
      {
        model: "gpt-4o-mini",
        max_tokens: 50,
        messages: [{ role: "user", content: "hello" }],
      },
    );

    expect(shared.resolveServerExecutionEndpointMock).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "emotion" }),
      false,
    );
    expect(shared.requestServerJsonMock).toHaveBeenCalledWith(
      "/data/llm/execute",
      expect.objectContaining({
        request: expect.objectContaining({
          requestBody: expect.objectContaining({
            messages: [{ role: "user", content: "hello" }],
          }),
        }),
      }),
      expect.anything(),
    );
  });

  it("returns a no-retry failure for missing OpenAI keys", async () => {
    shared.requestServerJsonMock.mockResolvedValue({
      ok: false,
      status: 401,
      data: {
        error: "OPENAI_KEY_MISSING",
      },
    });
    shared.parseServerErrorPayloadMock.mockReturnValue({
      code: "OPENAI_KEY_MISSING",
      status: 401,
      message: "missing key",
    });

    const result = await requestOpenAIServerExecution(
      {
        mode: "model",
        bias: {},
        formated: [{ role: "user", content: "hello" }],
        modelInfo: { format: "OpenAICompatible" } as never,
      },
      {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "hello" }],
      },
    );

    expect(result).toEqual({
      type: "fail",
      noRetry: true,
      result: "HTTP OpenAI key is missing in server settings. [mode=model, model=gpt-4o-mini]",
    });
  });

  it("preserves streaming through the shared stream adapter", async () => {
    const pipeTo = vi.fn();
    const wrappedStream = new ReadableStream();
    shared.requestServerStreamMock.mockResolvedValue({
      status: 200,
      body: {
        pipeTo,
      },
    });
    shared.getTranStreamMock.mockReturnValue({
      readable: new ReadableStream(),
      writable: { sink: true },
    });
    shared.wrapToolStreamMock.mockReturnValue(wrappedStream);

    const result = await requestOpenRouterServerExecution(
      {
        mode: "model",
        bias: {},
        formated: [{ role: "user", content: "hello" }],
        useStreaming: true,
        currentChar: { chaId: "char-1" } as never,
        chatId: "chat-1",
        modelInfo: { format: "OpenAICompatible" } as never,
      },
      {
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: "hello" }],
      },
    );

    expect(shared.requestServerStreamMock).toHaveBeenCalledWith(
      "/data/llm/generate",
      expect.objectContaining({
        provider: "openrouter",
        streaming: true,
      }),
      expect.objectContaining({ useStreaming: true }),
    );
    expect(pipeTo).toHaveBeenCalledWith({ sink: true });
    expect(shared.wrapToolStreamMock).toHaveBeenCalled();
    expect(result).toEqual({
      type: "streaming",
      result: wrappedStream,
    });
  });
});
