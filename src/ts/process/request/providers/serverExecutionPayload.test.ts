import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestDataArgumentExtended } from "../request";

type OpenAIRequestBody = {
  model?: string;
  max_tokens?: number;
  max_completion_tokens?: number;
  messages?: Array<{ role: string; content?: unknown }>;
  prompt?: string;
  tools?: unknown[];
  stream?: boolean;
};

type GoogleRequestBody = {
  contents?: unknown[];
  generation_config?: {
    maxOutputTokens?: number;
  };
  tools?: {
    functionDeclarations?: unknown[];
  };
};

const shared = vi.hoisted(() => ({
  getDatabaseMock: vi.fn(() => ({
    globalRagSettings: { topK: 8, model: "rag-model" },
    openrouterAllowReasoningOnlyForDeepSeekV32Speciale: false,
  })),
  cloneServerRequestBodyMock: vi.fn((body: unknown, arg?: { stream?: boolean }) => {
    const cloned = structuredClone(body);
    if (typeof arg?.stream === "boolean" && cloned && typeof cloned === "object" && !Array.isArray(cloned)) {
      (cloned as Record<string, unknown>).stream = arg.stream;
    }
    return cloned;
  }),
  getLatestUserMessageMock: vi.fn((formated: Array<{ role?: string; content?: unknown }> = []) =>
    [...formated]
      .reverse()
      .find(
        (message): message is { role: "user"; content: string } =>
          message?.role === "user" && typeof message?.content === "string" && message.content.trim().length > 0,
      )
      ?.content.trim() || "",
  ),
  hasMultimodalMessagesMock: vi.fn((formated: Array<{ multimodals?: unknown[] }> = []) =>
    formated.some((message) => Array.isArray(message?.multimodals) && message.multimodals.length > 0),
  ),
  resolveServerExecutionEndpointMock: vi.fn((arg: { currentChar?: { chaId?: string }; chatId?: string }, canUseGenerateEndpoint: boolean) => {
    const hasServerAssemblyContext = !!arg.currentChar?.chaId && !!arg.chatId;
    return canUseGenerateEndpoint && hasServerAssemblyContext ? "/data/llm/generate" : "/data/llm/execute";
  }),
}));

vi.mock("src/ts/storage/database.svelte", () => ({
  getDatabase: shared.getDatabaseMock,
}));

vi.mock("../request.transport", () => ({
  cloneServerRequestBody: shared.cloneServerRequestBodyMock,
  getLatestUserMessage: shared.getLatestUserMessageMock,
  hasMultimodalMessages: shared.hasMultimodalMessagesMock,
  resolveServerExecutionEndpoint: shared.resolveServerExecutionEndpointMock,
}));

import { buildServerExecutionPayloadPlan } from "./serverExecutionPayload";

function buildCompactGenerateRequestBody(body: Record<string, unknown>) {
  const compact = structuredClone(body);
  delete compact.messages;
  delete compact.prompt;
  delete compact.stream;
  return compact;
}

function buildOpenAIPlan({
  argOverrides = {},
  bodyOverrides = {},
}: {
  argOverrides?: Partial<RequestDataArgumentExtended>;
  bodyOverrides?: Partial<OpenAIRequestBody>;
} = {}) {
  const arg: RequestDataArgumentExtended = {
    mode: "model",
    bias: {},
    continue: true,
    useStreaming: true,
    formated: [{ role: "user", content: "hello" }],
    currentChar: {
      chaId: "char-1",
      ragSettings: { enabled: true, enabledRulebooks: ["rb-1", 9] },
    } as unknown as RequestDataArgumentExtended["currentChar"],
    chatId: "chat-1",
    ...argOverrides,
  };
  const body: OpenAIRequestBody = {
    model: "gpt-4o-mini",
    max_tokens: 123,
    messages: [{ role: "user", content: "hello" }],
    tools: [{ type: "function", function: { name: "lookup" } }],
    ...bodyOverrides,
  };

  return buildServerExecutionPayloadPlan({
    arg,
    body,
    provider: "openai",
    requestBodyCloneOptions: { stream: !!arg.useStreaming },
    canUseGenerateEndpoint: (currentArg) => String(currentArg.mode ?? "model") === "model",
    isRawGenerateEligible: ({ requestBodyForServer }) => {
      const hasNonStringMessage =
        Array.isArray(requestBodyForServer.messages) &&
        requestBodyForServer.messages.some((message: { content?: unknown }) => typeof message?.content !== "string");
      const hasPromptOnly =
        typeof requestBodyForServer.prompt === "string" &&
        (!Array.isArray(requestBodyForServer.messages) || requestBodyForServer.messages.length === 0);

      return !hasNonStringMessage && !hasPromptOnly;
    },
    getModel: ({ requestBodyForServer }) =>
      typeof requestBodyForServer.model === "string" ? requestBodyForServer.model : undefined,
    getMaxTokens: ({ requestBodyForServer }) =>
      Number.isFinite(Number(requestBodyForServer.max_tokens ?? requestBodyForServer.max_completion_tokens))
        ? Number(requestBodyForServer.max_tokens ?? requestBodyForServer.max_completion_tokens)
        : undefined,
    getRequestMessages: ({ requestBodyForServer }) =>
      Array.isArray(requestBodyForServer.messages) ? requestBodyForServer.messages : undefined,
    getRequestPrompt: ({ requestBodyForServer }) =>
      typeof requestBodyForServer.prompt === "string" ? requestBodyForServer.prompt : undefined,
    getRequestTools: ({ requestBodyForServer }) =>
      Array.isArray(requestBodyForServer.tools) ? requestBodyForServer.tools : undefined,
    getSharedPayloadFields: () => ({
      allowReasoningOnlyForDeepSeekV32Speciale: false,
    }),
    buildRawRequestWrapper: ({ requestBodyForServer, model, maxTokens }) => ({
      requestBody: buildCompactGenerateRequestBody(requestBodyForServer),
      model,
      maxTokens,
      tools: Array.isArray(requestBodyForServer.tools) ? requestBodyForServer.tools : undefined,
    }),
  });
}

function buildGooglePlan({
  argOverrides = {},
  bodyOverrides = {},
}: {
  argOverrides?: Partial<RequestDataArgumentExtended>;
  bodyOverrides?: Partial<GoogleRequestBody>;
} = {}) {
  const arg: RequestDataArgumentExtended = {
    mode: "model",
    bias: {},
    formated: [{ role: "user", content: "hello" }],
    currentChar: {
      chaId: "char-1",
      ragSettings: { enabled: false, enabledRulebooks: ["rb-1"] },
    } as RequestDataArgumentExtended["currentChar"],
    chatId: "chat-1",
    modelInfo: { internalID: "gemini-2.0-flash" } as RequestDataArgumentExtended["modelInfo"],
    ...argOverrides,
  };
  const body: GoogleRequestBody = {
    contents: [{ role: "user", parts: [{ text: "hello" }] }],
    generation_config: { maxOutputTokens: 64 },
    tools: {
      functionDeclarations: [{ name: "searchDocs" }],
    },
    ...bodyOverrides,
  };

  return buildServerExecutionPayloadPlan({
    arg,
    body,
    provider: "google",
    getModel: ({ arg: currentArg }) =>
      typeof currentArg.modelInfo?.internalID === "string" ? currentArg.modelInfo.internalID : undefined,
    getMaxTokens: ({ requestBodyForServer }) =>
      Number.isFinite(Number(requestBodyForServer?.generation_config?.maxOutputTokens))
        ? Number(requestBodyForServer.generation_config.maxOutputTokens)
        : undefined,
    getRequestMessages: ({ requestBodyForServer }) =>
      Array.isArray(requestBodyForServer.contents) ? requestBodyForServer.contents : undefined,
    getRequestTools: ({ requestBodyForServer }) =>
      Array.isArray(requestBodyForServer?.tools?.functionDeclarations)
        ? requestBodyForServer.tools.functionDeclarations
        : undefined,
    getFallbackPayloadFields: ({ serverExecEndpoint }) => ({
      useClientAssembledRequest: serverExecEndpoint === "/data/llm/generate",
    }),
  });
}

describe("buildServerExecutionPayloadPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds the shared raw-generate envelope for OpenAI-compatible payloads", () => {
    const plan = buildOpenAIPlan();

    expect(plan.serverExecEndpoint).toBe("/data/llm/generate");
    expect(plan.canUseRawGeneratePayload).toBe(true);
    expect(plan.payload).toEqual({
      mode: "model",
      provider: "openai",
      characterId: "char-1",
      chatId: "chat-1",
      continue: true,
      streaming: true,
      allowReasoningOnlyForDeepSeekV32Speciale: false,
      userMessage: "hello",
      model: "gpt-4o-mini",
      maxTokens: 123,
      request: {
        requestBody: {
          model: "gpt-4o-mini",
          max_tokens: 123,
          tools: [{ type: "function", function: { name: "lookup" } }],
        },
        model: "gpt-4o-mini",
        maxTokens: 123,
        tools: [{ type: "function", function: { name: "lookup" } }],
      },
      ragSettings: {
        enabled: true,
        enabledRulebooks: ["rb-1"],
      },
      globalRagSettings: {
        topK: 8,
        minScore: undefined,
        budget: undefined,
        model: "rag-model",
      },
    });
  });

  it.each([
    {
      name: "prompt-only request bodies",
      bodyOverrides: {
        prompt: "hello",
        messages: [],
      },
      expectedPrompt: "hello",
    },
    {
      name: "non-string message payloads",
      bodyOverrides: {
        messages: [{ role: "user", content: [{ type: "text", text: "hello" }] }],
      },
      expectedPrompt: undefined,
    },
  ])("falls back to the wrapped request path for OpenAI $name", ({ bodyOverrides, expectedPrompt }) => {
    const plan = buildOpenAIPlan({ bodyOverrides });

    expect(plan.serverExecEndpoint).toBe("/data/llm/generate");
    expect(plan.canUseRawGeneratePayload).toBe(false);
    expect(plan.payload).not.toHaveProperty("userMessage");
    expect(plan.payload).toEqual(
      expect.objectContaining({
        provider: "openai",
        request: expect.objectContaining({
          requestBody: expect.objectContaining(bodyOverrides),
          messages: bodyOverrides.messages,
          prompt: expectedPrompt,
          model: "gpt-4o-mini",
          maxTokens: 123,
          tools: [{ type: "function", function: { name: "lookup" } }],
        }),
      }),
    );
  });

  it("keeps Google raw-generate payloads minimal when the shared base conditions are met", () => {
    const plan = buildGooglePlan();

    expect(plan.serverExecEndpoint).toBe("/data/llm/generate");
    expect(plan.canUseRawGeneratePayload).toBe(true);
    expect(plan.payload).toEqual({
      mode: "model",
      provider: "google",
      characterId: "char-1",
      chatId: "chat-1",
      continue: false,
      streaming: false,
      userMessage: "hello",
      model: "gemini-2.0-flash",
      maxTokens: 64,
      ragSettings: {
        enabled: false,
        enabledRulebooks: ["rb-1"],
      },
      globalRagSettings: {
        topK: 8,
        minScore: undefined,
        budget: undefined,
        model: "rag-model",
      },
    });
  });

  it.each([
    {
      name: "preview bodies",
      argOverrides: { previewBody: true },
      expectedEndpoint: "/data/llm/generate",
      expectedUseClientAssembledRequest: true,
    },
    {
      name: "missing character context",
      argOverrides: { currentChar: undefined },
      expectedEndpoint: "/data/llm/execute",
      expectedUseClientAssembledRequest: false,
    },
    {
      name: "missing chat context",
      argOverrides: { chatId: undefined },
      expectedEndpoint: "/data/llm/execute",
      expectedUseClientAssembledRequest: false,
    },
    {
      name: "missing latest user message",
      argOverrides: {
        formated: [{ role: "assistant", content: "hello" }],
      },
      expectedEndpoint: "/data/llm/generate",
      expectedUseClientAssembledRequest: true,
    },
    {
      name: "multimodal messages",
      argOverrides: {
        formated: [{ role: "user", content: "hello", multimodals: [{ type: "image", base64: "data:image/png;base64,test" }] }],
      },
      expectedEndpoint: "/data/llm/generate",
      expectedUseClientAssembledRequest: true,
    },
  ] satisfies Array<{
    name: string;
    argOverrides: Partial<RequestDataArgumentExtended>;
    expectedEndpoint: string;
    expectedUseClientAssembledRequest: boolean;
  }>)(
    "uses the wrapped fallback path for Google $name",
    ({ argOverrides, expectedEndpoint, expectedUseClientAssembledRequest }) => {
      const plan = buildGooglePlan({ argOverrides });

      expect(plan.serverExecEndpoint).toBe(expectedEndpoint);
      expect(plan.canUseRawGeneratePayload).toBe(false);
      expect(plan.payload).toEqual(
        expect.objectContaining({
          provider: "google",
          useClientAssembledRequest: expectedUseClientAssembledRequest,
          request: {
            requestBody: expect.any(Object),
            messages: [{ role: "user", parts: [{ text: "hello" }] }],
            prompt: undefined,
            model: "gemini-2.0-flash",
            maxTokens: 64,
            tools: [{ name: "searchDocs" }],
          },
        }),
      );
    },
  );
});
