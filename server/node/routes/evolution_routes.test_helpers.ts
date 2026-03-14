import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { registerEvolutionRoutes } from "./evolution_routes.cjs";
import { registerEvolutionVersionRoutes } from "./evolution_version_routes.cjs";

export class MockLLMHttpError extends Error {
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

export type MockReq = {
  method: string;
  originalUrl: string;
  body: Record<string, unknown>;
  params?: Record<string, string>;
};

export type MockRes = {
  statusCode: number;
  payload: unknown;
};

export type RegisteredHandler = (req: MockReq, res: MockRes) => Promise<void>;

export const characterId = "char-test";
export const chatId = "chat-test";

let tmpRoot = "";
let dataDirs: { root: string; characters: string };

export function getDataDirs() {
  return dataDirs;
}

export function writeJson(filePath: string, payload: unknown) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf-8");
}

export function createReq(body: Record<string, unknown>, params: Record<string, string> = {}): MockReq {
  return {
    method: "POST",
    originalUrl: "/data/character-evolution/test",
    body,
    params,
  };
}

export function createRes(): MockRes {
  return {
    statusCode: 200,
    payload: null,
  };
}

export function toStringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function toLLMErrorResponse(error: unknown, arg: { requestId: string; endpoint: string; durationMs: number }) {
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

export function buildHandlers(overrides: {
  appendLLMAudit?: (payload: unknown) => Promise<void>;
  executeInternalLLMTextCompletion?: (arg: Record<string, unknown>) => Promise<string>;
  logLLMExecutionEnd?: (payload: unknown) => void;
  applyStateCommands?: (commands: Array<Record<string, unknown>>) => Promise<unknown>;
  fsOverride?: Partial<typeof fs>;
} = {}) {
  const postHandlers = new Map<string, RegisteredHandler>();
  const getHandlers = new Map<string, RegisteredHandler>();
  const app = {
    post(route: string, handler: RegisteredHandler) {
      postHandlers.set(route, handler);
    },
    get(route: string, handler: RegisteredHandler) {
      getHandlers.set(route, handler);
    },
  };

  const evolutionRouteContext = registerEvolutionRoutes({
    app,
    fs: {
      ...fs,
      ...overrides.fsOverride,
    },
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
    getReqIdFromResponse: () => "req-evo-1",
    toStringOrEmpty,
    sendJson: (res: MockRes, status: number, payload: unknown) => {
      res.statusCode = status;
      res.payload = payload;
    },
    toLLMErrorResponse,
    logLLMExecutionStart: () => {},
    logLLMExecutionEnd: overrides.logLLMExecutionEnd ?? (() => {}),
    appendLLMAudit: overrides.appendLLMAudit ?? (async () => {}),
    buildExecutionAuditRequest: (_endpoint: string, body: unknown) => body,
    executeInternalLLMTextCompletion: overrides.executeInternalLLMTextCompletion ?? (async () => JSON.stringify({
      proposedState: {
        relationship: {
          trustLevel: "high",
          dynamic: "closer after the last chat",
        },
      },
      changes: [],
    })),
    applyStateCommands: overrides.applyStateCommands ?? (async (commands: Array<Record<string, unknown>>) => {
      const command = commands[0];
      if (command?.type === "character.replace") {
        writeJson(path.join(dataDirs.characters, characterId, "character.json"), {
          character: command.character,
        });
      }
      return { ok: true, lastEventId: 1, applied: [], conflicts: [] };
    }),
    readStateLastEventId: async () => 1,
  });
  registerEvolutionVersionRoutes(evolutionRouteContext);

  return { postHandlers, getHandlers };
}

export function setupEvolutionRouteTest() {
  tmpRoot = mkdtempSync(path.join(os.tmpdir(), "risu-evo-route-"));
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
      desc: "desc",
      personality: "personality",
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
}

export function cleanupEvolutionRouteTest() {
  if (tmpRoot) {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
  tmpRoot = "";
}
