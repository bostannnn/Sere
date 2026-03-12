import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { registerEvolutionRoutes } from "./evolution_routes.cjs";

class MockLLMHttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
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

const characterId = "char-audit";
const chatId = "chat-audit";

let tmpRoot = "";
let dataDirs: { root: string; characters: string };

function writeJson(filePath: string, payload: unknown) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf-8");
}

function createReq(body: Record<string, unknown>): MockReq {
  return {
    method: "POST",
    originalUrl: "/data/character-evolution/handoff",
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
        requestId: arg.requestId,
        endpoint: arg.endpoint,
        durationMs: arg.durationMs,
      },
    };
  }

  return {
    status: 500,
    code: "INTERNAL_ERROR",
    payload: {
      error: "INTERNAL_ERROR",
      message: error instanceof Error ? error.message : String(error),
      requestId: arg.requestId,
      endpoint: arg.endpoint,
      durationMs: arg.durationMs,
    },
  };
}

function buildHandler(appendLLMAudit: (payload: unknown) => Promise<void>): RegisteredHandler {
  const postHandlers = new Map<string, RegisteredHandler>();
  const app = {
    post(route: string, handler: RegisteredHandler) {
      postHandlers.set(route, handler);
    },
    get() {},
  };

  registerEvolutionRoutes({
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
    getReqIdFromResponse: () => "req-evo-audit",
    toStringOrEmpty,
    sendJson: (res: MockRes, status: number, payload: unknown) => {
      res.statusCode = status;
      res.payload = payload;
    },
    toLLMErrorResponse,
    logLLMExecutionStart: () => {},
    logLLMExecutionEnd: () => {},
    appendLLMAudit,
    buildExecutionAuditRequest: (_endpoint: string, body: unknown) => body,
    executeInternalLLMTextCompletion: async () => JSON.stringify({
      proposedState: {
        relationship: {
          trustLevel: "high",
          dynamic: "closer after the last chat",
        },
      },
      changes: [],
    }),
    applyStateCommands: async (commands: Array<Record<string, unknown>>) => {
      const command = commands[0];
      if (command?.type === "character.replace") {
        writeJson(path.join(dataDirs.characters, characterId, "character.json"), {
          character: command.character,
        });
      }
      return { ok: true, lastEventId: 1, applied: [], conflicts: [] };
    },
    readStateLastEventId: async () => 1,
  });

  const handler = postHandlers.get("/data/character-evolution/handoff");
  if (!handler) {
    throw new Error("handler not registered");
  }
  return handler;
}

beforeEach(() => {
  tmpRoot = mkdtempSync(path.join(os.tmpdir(), "risu-evo-audit-"));
  dataDirs = {
    root: tmpRoot,
    characters: path.join(tmpRoot, "characters"),
  };

  writeJson(path.join(dataDirs.root, "settings.json"), {
    data: {
      username: "Andrew",
      characterEvolutionDefaults: {
        extractionProvider: "openrouter",
        extractionModel: "anthropic/claude-3.5-haiku",
        extractionMaxTokens: 2400,
        extractionPrompt: "Facts about {{user}} as seen by {{char}}.",
        sectionConfigs: [],
        privacy: {
          allowCharacterIntimatePreferences: false,
          allowUserIntimatePreferences: false,
        },
      },
    },
  });

  writeJson(path.join(dataDirs.characters, characterId, "character.json"), {
    character: {
      chaId: characterId,
      type: "character",
      name: "Eva",
      desc: "Desc text",
      personality: "Personality text",
      characterEvolution: {
        enabled: true,
        useGlobalDefaults: true,
        currentStateVersion: 0,
        currentState: {},
        stateVersions: [],
      },
    },
  });

  writeJson(path.join(dataDirs.characters, characterId, "chats", `${chatId}.json`), {
    chat: {
      id: chatId,
      message: [
        { role: "user", data: "I need a job soon." },
        { role: "char", data: "That sounds miserable, dude." },
      ],
    },
  });
});

afterEach(() => {
  if (tmpRoot) {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

describe("evolution handoff audit", () => {
  it("stores the built prompt trace in the audit request", async () => {
    const appendLLMAudit = vi.fn(async () => {});
    const handler = buildHandler(appendLLMAudit);
    const res = createRes();

    await handler(createReq({ characterId, chatId }), res);

    expect(res.statusCode).toBe(200);
    expect(appendLLMAudit).toHaveBeenCalledTimes(1);
    expect(appendLLMAudit).toHaveBeenCalledWith(expect.objectContaining({
      endpoint: "character_evolution_handoff",
      ok: true,
      request: expect.objectContaining({
        characterId,
        chatId,
        promptMessageCount: 2,
        promptMessages: [
          expect.objectContaining({
            role: "system",
            title: "Character Evolution Prompt",
            source: "memory",
            content: "You are a strict structured extraction engine. Return JSON only.",
          }),
          expect.objectContaining({
            role: "user",
            title: "Character Evolution Prompt",
            source: "memory",
          }),
        ],
      }),
    }));
  });
});
