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
          endpoint: "memory_periodic_summarize",
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
      toLLMErrorResponse: vi.fn(() => ({
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

  it("uses normalized LLM error response shape for /data/llm/logs failures", async () => {
    const { app, getHandlers } = createApp();
    const toLLMErrorResponse = vi.fn((...args: unknown[]) => {
      const ctx = (args[1] || {}) as Record<string, unknown>;
      return {
        status: 503,
        code: "LOG_READ_FAILED",
        payload: {
          error: "LOG_READ_FAILED",
          message: "read failed",
          requestId: ctx.requestId,
          endpoint: ctx.endpoint,
          durationMs: ctx.durationMs,
        },
      };
    });

    registerLLMRoutes({
      app,
      dataRoot: "/tmp/risu-test",
      promptPipeline: {
        buildPromptTrace: vi.fn(() => []),
      },
      listOpenRouterModels: vi.fn(async () => ({ models: [] })),
      parseLLMExecutionInput: vi.fn(() => ({})),
      previewLLMExecution: vi.fn(async () => ({})),
      handleLLMExecutePost: vi.fn(async () => {}),
      buildGenerateExecutionPayload: vi.fn(async () => ({
        mode: "model",
        provider: "openrouter",
        characterId: "charA",
        chatId: "chatA",
        request: { requestBody: { messages: [] } },
      })),
      appendMemoryTraceAudit: vi.fn(async () => {}),
      toStringOrEmpty: (value: unknown) => (typeof value === "string" ? value : ""),
      getReqIdFromResponse: vi.fn(() => "req-logs"),
      toLLMErrorResponse,
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
      readLLMExecutionLogs: vi.fn(async () => {
        throw new Error("boom");
      }),
    });

    const logsHandler = getHandlers.get("/data/llm/logs");
    if (!logsHandler) {
      throw new Error("logs handler not registered");
    }

    const req = {
      method: "GET",
      originalUrl: "/data/llm/logs",
      query: {},
    };
    const res = createRes();

    await logsHandler(req, res);

    expect(res.statusCode).toBe(503);
    expect((res.payload as Record<string, unknown>)?.error).toBe("LOG_READ_FAILED");
    expect((res.payload as Record<string, unknown>)?.requestId).toBe("req-logs");
    expect((res.payload as Record<string, unknown>)?.endpoint).toBe("logs");
    expect(toLLMErrorResponse).toHaveBeenCalledTimes(1);
  });
});
