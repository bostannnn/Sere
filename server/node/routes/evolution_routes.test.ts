import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { registerEvolutionRoutes } from "./evolution_routes.cjs";

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
  params?: Record<string, string>;
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

function createReq(body: Record<string, unknown>, params: Record<string, string> = {}): MockReq {
  return {
    method: "POST",
    originalUrl: "/data/character-evolution/test",
    body,
    params,
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

function buildHandlers() {
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
    getReqIdFromResponse: () => "req-evo-1",
    toStringOrEmpty,
    sendJson: (res: MockRes, status: number, payload: unknown) => {
      res.statusCode = status;
      res.payload = payload;
    },
    toLLMErrorResponse,
    logLLMExecutionStart: () => {},
    logLLMExecutionEnd: () => {},
    appendLLMAudit: async () => {},
    buildExecutionAuditRequest: () => ({}),
    executeInternalLLMTextCompletion: async () => JSON.stringify({
      proposedState: {
        relationship: {
          trustLevel: "high",
          dynamic: "closer after the last chat",
        },
        userFacts: [
          {
            value: "User is returning to work soon",
            confidence: "likely",
            note: "stated directly",
            status: "active",
          },
        ],
      },
      changes: [
        {
          sectionKey: "relationship",
          summary: "Relationship became closer.",
          evidence: ["Character said they feel more comfortable."],
        },
      ],
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

  return {
    postHandlers,
    getHandlers,
  };
}

beforeEach(() => {
  tmpRoot = mkdtempSync(path.join(os.tmpdir(), "risu-evo-route-"));
  dataDirs = {
    root: tmpRoot,
    characters: path.join(tmpRoot, "characters"),
  };
  writeJson(path.join(dataDirs.root, "settings.json"), {
    data: {
      username: "User",
      characterEvolutionDefaults: {
        extractionProvider: "openrouter",
        extractionModel: "anthropic/claude-3.5-haiku",
        extractionPrompt: "default prompt",
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
      name: "Chat 1",
      message: [
        { role: "user", data: "I am going back to work next month." },
        { role: "char", data: "That sounds bigger than you make it sound." },
      ],
    },
  });
});

afterEach(() => {
  if (tmpRoot) {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

describe("registerEvolutionRoutes", () => {
  it("creates a pending proposal on handoff", async () => {
    const { postHandlers } = buildHandlers();
    const handler = postHandlers.get("/data/character-evolution/handoff");
    expect(handler).toBeTruthy();
    const req = createReq({ characterId, chatId });
    const res = createRes();

    await handler!(req, res);

    expect(res.statusCode).toBe(200);
    const payload = res.payload as { proposal?: { sourceChatId?: string } };
    expect(payload.proposal?.sourceChatId).toBe(chatId);

    const characterFile = JSON.parse(readFileSync(path.join(dataDirs.characters, characterId, "character.json"), "utf-8"));
    expect(characterFile.character.characterEvolution.pendingProposal.sourceChatId).toBe(chatId);
  });

  it("accepts a pending proposal and writes a version file", async () => {
    const { postHandlers, getHandlers } = buildHandlers();
    const handoff = postHandlers.get("/data/character-evolution/handoff");
    const accept = postHandlers.get("/data/character-evolution/:charId/proposal/accept");
    const getVersion = getHandlers.get("/data/character-evolution/:charId/versions/:version");
    expect(handoff).toBeTruthy();
    expect(accept).toBeTruthy();

    await handoff!(createReq({ characterId, chatId }), createRes());

    const acceptRes = createRes();
    await accept!(createReq({}, { charId: characterId }), acceptRes);

    expect(acceptRes.statusCode).toBe(200);
    const versionPath = path.join(dataDirs.characters, characterId, "states", "v1.json");
    expect(existsSync(versionPath)).toBe(true);

    const characterFile = JSON.parse(readFileSync(path.join(dataDirs.characters, characterId, "character.json"), "utf-8"));
    expect(characterFile.character.characterEvolution.currentStateVersion).toBe(1);
    expect(characterFile.character.characterEvolution.pendingProposal).toBeNull();

    if (getVersion) {
      const getRes = createRes();
      await getVersion({
        method: "GET",
        originalUrl: "/data/character-evolution/test",
        body: {},
        params: { charId: characterId, version: "1" },
      }, getRes);
      expect(getRes.statusCode).toBe(200);
    }
  });
});
