import { describe, expect, it, vi } from "vitest";

const shared = vi.hoisted(() => ({
  buildOpenAIRequestPayloadMock: vi.fn(),
  requestDeepSeekServerExecutionMock: vi.fn(),
  requestOpenAIServerExecutionMock: vi.fn(),
  requestOpenRouterServerExecutionMock: vi.fn(),
  requestHTTPOpenAIMock: vi.fn(),
  getTranStreamMock: vi.fn(),
  wrapToolStreamMock: vi.fn(),
}));

vi.mock("src/ts/model/modellist", () => ({
  LLMFormat: {
    OpenAICompatible: "OpenAICompatible",
  },
}));

vi.mock("src/ts/globalApi.svelte", () => ({
  addFetchLog: () => {},
  fetchNative: vi.fn(),
  textifyReadableStream: vi.fn(),
}));

vi.mock("src/ts/platform", () => ({
  isNodeServer: false,
  isTauri: false,
}));

vi.mock("../index.svelte", () => ({}));

vi.mock("./providers/openai.payload", () => ({
  buildOpenAIRequestPayload: shared.buildOpenAIRequestPayloadMock,
}));

vi.mock("./providers/openai.server", () => ({
  requestDeepSeekServerExecution: shared.requestDeepSeekServerExecutionMock,
  requestOpenAIServerExecution: shared.requestOpenAIServerExecutionMock,
  requestOpenRouterServerExecution: shared.requestOpenRouterServerExecutionMock,
}));

vi.mock("./providers/openai.response", () => ({
  requestHTTPOpenAI: shared.requestHTTPOpenAIMock,
}));

vi.mock("./providers/openai.stream", () => ({
  getTranStream: shared.getTranStreamMock,
  wrapToolStream: shared.wrapToolStreamMock,
}));

vi.mock("./providers/openai.legacy", () => ({
  requestOpenAILegacyInstruct: vi.fn(),
  requestOpenAIResponseAPI: vi.fn(),
}));

describe("openAI import wiring", () => {
  it("resolves the openai.stream provider import", async () => {
    const module = await import("./openAI");

    expect(typeof module.requestOpenAI).toBe("function");
    expect(module.requestOpenAILegacyInstruct).toBeTypeOf("function");
    expect(module.requestOpenAIResponseAPI).toBeTypeOf("function");
  });
});
