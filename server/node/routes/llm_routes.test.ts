import { describe, expect, it, vi } from "vitest";

import { registerLLMRoutes } from "./llm_routes.cjs";

type RegisteredHandler = (req: Record<string, unknown>, res: Record<string, unknown>) => Promise<void>;

function createApp() {
  const postHandlers = new Map<string, RegisteredHandler>();
  const getHandlers = new Map<string, RegisteredHandler>();
  return {
    app: {
      post(route: string, handler: RegisteredHandler) {
        postHandlers.set(route, handler);
      },
      get(route: string, handler: RegisteredHandler) {
        getHandlers.set(route, handler);
      },
    },
    postHandlers,
    getHandlers,
  };
}

function createRes() {
  return {
    statusCode: 200,
    payload: null as unknown,
  };
}

describe("llm routes", () => {
  it("passes readOnlyTrace=true for /data/llm/generate/trace and avoids periodic trace side-effects", async () => {
    const { app, postHandlers } = createApp();
    const appendMemoryTraceAudit = vi.fn(async () => {});
    const buildGenerateExecutionPayload = vi.fn(async (_body: unknown, options: Record<string, unknown>) => {
      if (options.readOnlyTrace !== true && typeof options.onPeriodicSummaryTrace === "function") {
        await options.onPeriodicSummaryTrace({
          endpoint: "hypav3_periodic_summarize",
          status: 200,
          ok: true,
          promptMessages: [],
        });
      }
      return {
        mode: "model",
        provider: "openrouter",
        characterId: "charA",
        chatId: "chatA",
        request: {
          requestBody: {
            messages: [{ role: "user", content: "hello" }],
          },
        },
      };
    });

    registerLLMRoutes({
      app,
      dataRoot: "/tmp/risu-test",
      promptPipeline: {
        buildPromptTrace: vi.fn(() => [{ role: "user", content: "hello" }]),
      },
      listOpenRouterModels: vi.fn(async () => ({ models: [] })),
      parseLLMExecutionInput: vi.fn(() => ({})),
      previewLLMExecution: vi.fn(async () => ({})),
      handleLLMExecutePost: vi.fn(async () => {}),
      buildGenerateExecutionPayload,
      appendMemoryTraceAudit,
      toStringOrEmpty: (value: unknown) => (typeof value === "string" ? value : ""),
      getReqIdFromResponse: vi.fn(() => "req-trace"),
      toLLMErrorResponse: vi.fn((_error: unknown) => ({
        status: 500,
        code: "INTERNAL_ERROR",
        payload: { error: "INTERNAL_ERROR", message: "Internal Error" },
      })),
      logLLMExecutionStart: vi.fn(),
      logLLMExecutionEnd: vi.fn(),
      appendLLMAudit: vi.fn(async () => {}),
      buildExecutionAuditRequest: vi.fn((_endpoint: string, body: unknown) => body),
      sendSSE: vi.fn(),
      sendJson: (res: Record<string, unknown>, status: number, payload: unknown) => {
        res.statusCode = status;
        res.payload = payload;
      },
      assembleLLMServerPrompt: vi.fn(async () => {}),
      readLLMExecutionLogs: vi.fn(async () => []),
    });

    const traceHandler = postHandlers.get("/data/llm/generate/trace");
    if (!traceHandler) {
      throw new Error("generate/trace handler not registered");
    }

    const req = {
      method: "POST",
      originalUrl: "/data/llm/generate/trace",
      body: {
        characterId: "charA",
        chatId: "chatA",
        userMessage: "hello",
      },
    };
    const res = createRes();

    await traceHandler(req, res);

    expect(buildGenerateExecutionPayload).toHaveBeenCalledTimes(1);
    const options = buildGenerateExecutionPayload.mock.calls[0]?.[1];
    expect(options?.readOnlyTrace).toBe(true);
    expect(appendMemoryTraceAudit).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect((res.payload as Record<string, unknown>)?.endpoint).toBe("generate_trace");
  });
});
