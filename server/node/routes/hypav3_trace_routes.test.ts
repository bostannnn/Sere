import { describe, expect, it, vi } from "vitest";

import { registerHypaV3TraceRoutes } from "./hypav3_trace_routes.cjs";

class MockLLMHttpError extends Error {
  status: number;
  code: string;
  details: unknown;

  constructor(status: number, code: string, message: string, details: unknown = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type MockReq = {
  method: string;
  originalUrl: string;
  body: Record<string, unknown>;
};

type MockRes = {
  statusCode: number;
  payload: unknown;
};

type RegisteredHandler = (req: MockReq, res: MockRes) => Promise<void>;

function toStringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toLLMErrorResponse(error: unknown, arg: { requestId: string; endpoint: string; durationMs: number }) {
  if (error instanceof MockLLMHttpError) {
    return {
      status: error.status,
      code: error.code,
      payload: {
        error: error.code,
        message: error.message,
        details: error.details ?? null,
        requestId: arg.requestId,
        endpoint: arg.endpoint,
        durationMs: arg.durationMs,
      },
    };
  }
  return {
    status: 500,
    code: "INTERNAL_SERVER_ERROR",
    payload: {
      error: "INTERNAL_SERVER_ERROR",
      message: String(error),
      details: null,
      requestId: arg.requestId,
      endpoint: arg.endpoint,
      durationMs: arg.durationMs,
    },
  };
}

function createRes(): MockRes {
  return {
    statusCode: 200,
    payload: null,
  };
}

function buildHandlers(arg: {
  requirePasswordAuth?: (req: MockReq, res: MockRes) => boolean;
  safeResolve?: (baseDir: string, relPath: string) => string;
  onStart?: ReturnType<typeof vi.fn>;
}) {
  const postHandlers = new Map<string, RegisteredHandler>();
  const app = {
    post(route: string, handler: RegisteredHandler) {
      postHandlers.set(route, handler);
    },
  };

  registerHypaV3TraceRoutes({
    app,
    fs: { readFile: async () => "{}" },
    dataDirs: {
      root: "/tmp/risu-test",
      characters: "/tmp/risu-test/characters",
    },
    existsSync: () => false,
    LLMHttpError: MockLLMHttpError,
    isSafePathSegment: (value: string) => /^[a-zA-Z0-9._-]+$/.test(value),
    requirePasswordAuth: arg.requirePasswordAuth ?? (() => true),
    safeResolve: arg.safeResolve ?? ((baseDir: string, relPath: string) => `${baseDir}/${relPath}`),
    getReqIdFromResponse: () => "req-trace-test",
    toStringOrEmpty,
    logLLMExecutionStart: arg.onStart ?? vi.fn(),
    logLLMExecutionEnd: vi.fn(),
    appendLLMAudit: async () => {},
    buildHypaV3AuditRequestPayload: () => ({}),
    sendJson: (res: MockRes, status: number, payload: unknown) => {
      res.statusCode = status;
      res.payload = payload;
    },
    toLLMErrorResponse,
    resolveHypaV3Settings: () => ({ summarizationPrompt: "Prompt", doNotSummarizeUserMessage: false }),
    convertStoredMessageForHypaSummary: () => null,
    buildHypaSummarizationPromptMessages: () => [],
    resolveHypaSummaryProviderModel: () => ({ provider: "test", model: "test" }),
    buildMemoryTraceResponsePayload: () => ({ type: "success" }),
    normalizeHypaV3DataForEdit: () => ({ summaries: [] }),
    sanitizeHypaSummarizationContent: (text: string) => text,
    planPeriodicHypaV3Summarization: () => ({ shouldRun: false, reason: "not_ready", promptMessages: [] }),
  });

  return postHandlers;
}

describe("hypav3 trace routes", () => {
  it("returns early when auth fails", async () => {
    const onStart = vi.fn();
    const handlers = buildHandlers({
      onStart,
      requirePasswordAuth: (_req, res) => {
        res.statusCode = 401;
        res.payload = { error: "UNAUTHORIZED", message: "Unauthorized" };
        return false;
      },
    });
    const handler = handlers.get("/data/memory/hypav3/manual-summarize/trace");
    if (!handler) {
      throw new Error("manual summarize trace handler was not registered");
    }

    const res = createRes();
    await handler(
      {
        method: "POST",
        originalUrl: "/data/memory/hypav3/manual-summarize/trace",
        body: { characterId: "charA", chatId: "chatA", start: 1, end: 1 },
      },
      res,
    );

    expect(res.statusCode).toBe(401);
    expect(res.payload).toEqual({ error: "UNAUTHORIZED", message: "Unauthorized" });
    expect(onStart).not.toHaveBeenCalled();
  });

  it("returns early for periodic trace when auth fails", async () => {
    const onStart = vi.fn();
    const handlers = buildHandlers({
      onStart,
      requirePasswordAuth: (_req, res) => {
        res.statusCode = 401;
        res.payload = { error: "UNAUTHORIZED", message: "Unauthorized" };
        return false;
      },
    });
    const handler = handlers.get("/data/memory/hypav3/periodic-summarize/trace");
    if (!handler) {
      throw new Error("periodic summarize trace handler was not registered");
    }

    const res = createRes();
    await handler(
      {
        method: "POST",
        originalUrl: "/data/memory/hypav3/periodic-summarize/trace",
        body: { characterId: "charA", chatId: "chatA" },
      },
      res,
    );

    expect(res.statusCode).toBe(401);
    expect(res.payload).toEqual({ error: "UNAUTHORIZED", message: "Unauthorized" });
    expect(onStart).not.toHaveBeenCalled();
  });

  it("returns INVALID_PATH when safeResolve rejects path", async () => {
    const handlers = buildHandlers({
      safeResolve: () => {
        throw new Error("bad path");
      },
    });
    const handler = handlers.get("/data/memory/hypav3/manual-summarize/trace");
    if (!handler) {
      throw new Error("manual summarize trace handler was not registered");
    }

    const res = createRes();
    await handler(
      {
        method: "POST",
        originalUrl: "/data/memory/hypav3/manual-summarize/trace",
        body: { characterId: "charA", chatId: "chatA", start: 1, end: 1 },
      },
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({
      error: "INVALID_PATH",
    });
  });

  it("returns INVALID_PATH for periodic trace when safeResolve rejects path", async () => {
    const handlers = buildHandlers({
      safeResolve: () => {
        throw new Error("bad path");
      },
    });
    const handler = handlers.get("/data/memory/hypav3/periodic-summarize/trace");
    if (!handler) {
      throw new Error("periodic summarize trace handler was not registered");
    }

    const res = createRes();
    await handler(
      {
        method: "POST",
        originalUrl: "/data/memory/hypav3/periodic-summarize/trace",
        body: { characterId: "charA", chatId: "chatA" },
      },
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({ error: "INVALID_PATH" });
  });

  it("returns INVALID_PATH for resummarize trace when safeResolve rejects path", async () => {
    const handlers = buildHandlers({
      safeResolve: () => {
        throw new Error("bad path");
      },
    });
    const handler = handlers.get("/data/memory/hypav3/resummarize-preview/trace");
    if (!handler) {
      throw new Error("resummarize preview trace handler was not registered");
    }

    const res = createRes();
    await handler(
      {
        method: "POST",
        originalUrl: "/data/memory/hypav3/resummarize-preview/trace",
        body: { characterId: "charA", chatId: "chatA", summaryIndices: [0, 1] },
      },
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({ error: "INVALID_PATH" });
  });
});
