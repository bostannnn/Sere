import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { registerHypaV3ManualRoutes } from "./hypav3_manual_routes.cjs";
import {
  normalizePromptOverride,
  applyPromptOverride,
  resolveManualPromptSource,
} from "../llm/hypav3_prompt_override.cjs";

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

const characterId = "char-test";
const chatId = "chat-test";

let tmpRoot = "";
let dataDirs: { root: string; characters: string };

function writeJson(filePath: string, payload: unknown) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf-8");
}

function createSettingsFile(presetPrompt: string) {
  writeJson(path.join(dataDirs.root, "settings.json"), {
    hypaV3: true,
    hypaV3PresetId: 0,
    hypaV3Presets: [
      {
        name: "Preset",
        settings: {
          periodicSummarizationEnabled: true,
          periodicSummarizationInterval: 2,
          summarizationPrompt: presetPrompt,
          reSummarizationPrompt: "preset-resummary",
        },
      },
    ],
  });
}

function createCharacterFile(characterPrompt: string) {
  writeJson(path.join(dataDirs.characters, characterId, "character.json"), {
    character: {
      chaId: characterId,
      name: "Character",
      supaMemory: true,
      hypaV3PromptOverride: {
        summarizationPrompt: characterPrompt,
        reSummarizationPrompt: "",
      },
    },
  });
}

function createChatFile() {
  writeJson(path.join(dataDirs.characters, characterId, "chats", `${chatId}.json`), {
    chat: {
      id: chatId,
      name: "Chat",
      message: [
        { role: "user", data: "hello", chatId: "m1" },
        { role: "char", data: "hi there", chatId: "m2" },
      ],
      hypaV3Data: {
        summaries: [],
        categories: [{ id: "", name: "Unclassified" }],
        lastSelectedSummaries: [],
      },
    },
  });
}

function createReq(body: Record<string, unknown>): MockReq {
  return {
    method: "POST",
    originalUrl: "/data/memory/hypav3/manual-summarize",
    body,
  };
}

function createRes(): MockRes {
  return {
    statusCode: 200,
    payload: null,
  };
}

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
  const message = error instanceof Error ? error.message : String(error);
  return {
    status: 500,
    code: "INTERNAL_SERVER_ERROR",
    payload: {
      error: "INTERNAL_SERVER_ERROR",
      message,
      details: null,
      requestId: arg.requestId,
      endpoint: arg.endpoint,
      durationMs: arg.durationMs,
    },
  };
}

function resolveHypaV3Settings(
  settings: Record<string, unknown>,
  character: Record<string, unknown> | null,
) {
  const presetId = Number(settings?.hypaV3PresetId ?? 0);
  const presets = Array.isArray(settings?.hypaV3Presets) ? settings.hypaV3Presets : [];
  const preset = (presets[presetId] as { settings?: Record<string, unknown> } | undefined)?.settings ?? {};
  const presetPrompt = toStringOrEmpty(preset.summarizationPrompt) || "preset-default";
  const characterPrompt = toStringOrEmpty(
    (character?.hypaV3PromptOverride as { summarizationPrompt?: unknown } | undefined)?.summarizationPrompt,
  ).trim();

  return {
    doNotSummarizeUserMessage: false,
    summarizationPrompt: characterPrompt || presetPrompt,
    reSummarizationPrompt: toStringOrEmpty(preset.reSummarizationPrompt),
  };
}

function buildHandler(): RegisteredHandler {
  const postHandlers = new Map<string, RegisteredHandler>();
  const app = {
    post(route: string, handler: RegisteredHandler) {
      postHandlers.set(route, handler);
    },
  };

  registerHypaV3ManualRoutes({
    app,
    fs,
    dataDirs,
    existsSync,
    LLMHttpError: MockLLMHttpError,
    isSafePathSegment: (value: string) => /^[a-zA-Z0-9._-]+$/.test(value),
    requirePasswordAuth: () => true,
    safeResolve: (baseDir: string, relPath: string) => {
      const resolved = path.resolve(baseDir, relPath);
      if (!resolved.startsWith(path.resolve(baseDir) + path.sep)) {
        throw new Error("Invalid path");
      }
      return resolved;
    },
    getReqIdFromResponse: () => "req-test-1",
    toStringOrEmpty,
    logLLMExecutionStart: () => {},
    logLLMExecutionEnd: () => {},
    appendLLMAudit: async () => {},
    appendMemoryTraceAudit: async () => {},
    buildHypaV3AuditRequestPayload: () => ({}),
    buildHypaV3AuditResponsePayload: () => ({}),
    sendJson: (res: MockRes, status: number, payload: unknown) => {
      res.statusCode = status;
      res.payload = payload;
    },
    toLLMErrorResponse,
    resolveHypaV3Settings,
    convertStoredMessageForHypaSummary: (message: { role?: string; data?: unknown; memo?: unknown }) => {
      const role = message?.role === "char" ? "assistant" : "user";
      return {
        role,
        content: toStringOrEmpty(message?.data),
        memo: toStringOrEmpty(message?.memo),
      };
    },
    buildHypaSummarizationPromptMessages: (
      messages: Array<{ role: string; content: string }>,
      prompt: string,
    ) => {
      const transcript = messages.map((item) => `${item.role}: ${item.content}`).join("\n");
      return [
        { role: "user", content: transcript },
        { role: "system", content: prompt },
      ];
    },
    executeHypaSummaryFromMessages: async (arg: { meta?: { provider?: string | null; model?: string | null } }) => {
      if (arg?.meta) {
        arg.meta.provider = "stub-provider";
        arg.meta.model = "stub-model";
      }
      return "Stub summary output";
    },
    generateSummaryEmbedding: async () => null,
    normalizeHypaV3DataForEdit: (raw: unknown) => {
      const base = (raw && typeof raw === "object" && !Array.isArray(raw)) ? raw as Record<string, unknown> : {};
      const summaries = Array.isArray(base.summaries) ? base.summaries : [];
      return {
        ...base,
        summaries: [...summaries],
      };
    },
    normalizePromptOverride,
    applyPromptOverride,
    resolveManualPromptSource,
    persistChatDataToRaw: (chatRaw: Record<string, unknown>, chat: Record<string, unknown>) => {
      if (chatRaw && typeof chatRaw === "object" && "chat" in chatRaw) {
        return { ...chatRaw, chat };
      }
      return { chat };
    },
  });

  const handler = postHandlers.get("/data/memory/hypav3/manual-summarize");
  if (!handler) {
    throw new Error("manual summarize handler was not registered");
  }
  return handler;
}

async function invokeManualSummarize(body: Record<string, unknown>) {
  const handler = buildHandler();
  const req = createReq(body);
  const res = createRes();
  await handler(req, res);
  return res;
}

async function invokeWithAuthBlocked(body: Record<string, unknown>) {
  const postHandlers = new Map<string, RegisteredHandler>();
  const app = {
    post(route: string, handler: RegisteredHandler) {
      postHandlers.set(route, handler);
    },
  };

  registerHypaV3ManualRoutes({
    app,
    fs,
    dataDirs,
    existsSync,
    LLMHttpError: MockLLMHttpError,
    isSafePathSegment: (value: string) => /^[a-zA-Z0-9._-]+$/.test(value),
    requirePasswordAuth: (_req: unknown, res: MockRes) => {
      res.statusCode = 401;
      res.payload = { error: "UNAUTHORIZED", message: "Unauthorized" };
      return false;
    },
    safeResolve: (baseDir: string, relPath: string) => {
      const resolved = path.resolve(baseDir, relPath);
      if (!resolved.startsWith(path.resolve(baseDir) + path.sep)) {
        throw new Error("Invalid path");
      }
      return resolved;
    },
    getReqIdFromResponse: () => "req-test-1",
    toStringOrEmpty,
    logLLMExecutionStart: () => {},
    logLLMExecutionEnd: () => {},
    appendLLMAudit: async () => {},
    appendMemoryTraceAudit: async () => {},
    buildHypaV3AuditRequestPayload: () => ({}),
    buildHypaV3AuditResponsePayload: () => ({}),
    sendJson: (res: MockRes, status: number, payload: unknown) => {
      res.statusCode = status;
      res.payload = payload;
    },
    toLLMErrorResponse,
    resolveHypaV3Settings,
    convertStoredMessageForHypaSummary: (message: { role?: string; data?: unknown; memo?: unknown }) => {
      const role = message?.role === "char" ? "assistant" : "user";
      return {
        role,
        content: toStringOrEmpty(message?.data),
        memo: toStringOrEmpty(message?.memo),
      };
    },
    buildHypaSummarizationPromptMessages: (
      messages: Array<{ role: string; content: string }>,
      prompt: string,
    ) => {
      const transcript = messages.map((item) => `${item.role}: ${item.content}`).join("\n");
      return [
        { role: "user", content: transcript },
        { role: "system", content: prompt },
      ];
    },
    executeHypaSummaryFromMessages: async () => "Stub summary output",
    generateSummaryEmbedding: async () => null,
    normalizeHypaV3DataForEdit: (raw: unknown) => {
      const base = (raw && typeof raw === "object" && !Array.isArray(raw)) ? raw as Record<string, unknown> : {};
      const summaries = Array.isArray(base.summaries) ? base.summaries : [];
      return {
        ...base,
        summaries: [...summaries],
      };
    },
    normalizePromptOverride,
    applyPromptOverride,
    resolveManualPromptSource,
    persistChatDataToRaw: (chatRaw: Record<string, unknown>, chat: Record<string, unknown>) => {
      if (chatRaw && typeof chatRaw === "object" && "chat" in chatRaw) {
        return { ...chatRaw, chat };
      }
      return { chat };
    },
  });

  const handler = postHandlers.get("/data/memory/hypav3/manual-summarize");
  if (!handler) {
    throw new Error("manual summarize handler was not registered");
  }
  const req = createReq(body);
  const res = createRes();
  await handler(req, res);
  return res;
}

beforeEach(() => {
  tmpRoot = mkdtempSync(path.join(os.tmpdir(), "hypav3-manual-routes-test-"));
  dataDirs = {
    root: tmpRoot,
    characters: path.join(tmpRoot, "characters"),
  };
  createSettingsFile("Preset prompt");
  createCharacterFile("Character prompt");
  createChatFile();
});

afterEach(() => {
  if (tmpRoot) {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

describe("hypav3 manual summarize route", () => {
  it("returns debug payload with stable shape and request_override promptSource", async () => {
    const res = await invokeManualSummarize({
      characterId,
      chatId,
      start: 1,
      end: 2,
      promptOverride: {
        summarizationPrompt: "Request override prompt",
        reSummarizationPrompt: "",
      },
    });

    expect(res.statusCode).toBe(200);
    const payload = res.payload as Record<string, unknown>;
    expect(payload.type).toBe("success");
    const debug = payload.debug as Record<string, unknown>;
    expect(debug).toMatchObject({
      model: "stub-model",
      isResummarize: false,
      characterId,
      chatId,
      start: 1,
      end: 2,
      source: "manual",
      promptSource: "request_override",
      prompt: "Request override prompt",
      rawResponse: "Stub summary output",
    });
    expect(typeof debug.timestamp).toBe("number");
    expect(typeof debug.input).toBe("string");
    expect(Array.isArray(debug.formatted)).toBe(true);
    expect((debug.formatted as Array<unknown>).length).toBeGreaterThan(0);
  });

  it("marks promptSource as preset_or_default when request override is blank and effective character override is empty", async () => {
    const res = await invokeManualSummarize({
      characterId,
      chatId,
      start: 1,
      end: 2,
      promptOverride: {
        summarizationPrompt: "",
        reSummarizationPrompt: "",
      },
    });

    expect(res.statusCode).toBe(200);
    const payload = res.payload as Record<string, unknown>;
    const debug = payload.debug as Record<string, unknown>;
    expect(debug.promptSource).toBe("preset_or_default");
    expect(debug.prompt).toBe("Preset prompt");
  });

  it("marks promptSource as character_override when stored character override is used", async () => {
    const res = await invokeManualSummarize({
      characterId,
      chatId,
      start: 1,
      end: 2,
    });

    expect(res.statusCode).toBe(200);
    const payload = res.payload as Record<string, unknown>;
    const debug = payload.debug as Record<string, unknown>;
    expect(debug.promptSource).toBe("character_override");
    expect(debug.prompt).toBe("Character prompt");
  });

  it("marks promptSource as preset_or_default when no overrides are present", async () => {
    createCharacterFile("");
    createSettingsFile("Preset fallback prompt");

    const res = await invokeManualSummarize({
      characterId,
      chatId,
      start: 1,
      end: 2,
      promptOverride: {
        summarizationPrompt: "",
        reSummarizationPrompt: "",
      },
    });

    expect(res.statusCode).toBe(200);
    const payload = res.payload as Record<string, unknown>;
    const debug = payload.debug as Record<string, unknown>;
    expect(debug.promptSource).toBe("preset_or_default");
    expect(debug.prompt).toBe("Preset fallback prompt");
  });

  it("returns early when auth fails", async () => {
    const res = await invokeWithAuthBlocked({
      characterId,
      chatId,
      start: 1,
      end: 2,
    });

    expect(res.statusCode).toBe(401);
    expect(res.payload).toEqual({ error: "UNAUTHORIZED", message: "Unauthorized" });
  });
});
