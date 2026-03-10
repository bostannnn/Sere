import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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

function buildHandlers(overrides: {
  appendLLMAudit?: (payload: unknown) => Promise<void>;
  executeInternalLLMTextCompletion?: () => Promise<string>;
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

  registerEvolutionRoutes({
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
    buildExecutionAuditRequest: () => ({}),
    executeInternalLLMTextCompletion: overrides.executeInternalLLMTextCompletion ?? (async () => JSON.stringify({
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
        extractionMaxTokens: 2400,
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
    const appendLLMAudit = vi.fn(async () => {});
    const { postHandlers } = buildHandlers({ appendLLMAudit });
    const handler = postHandlers.get("/data/character-evolution/handoff");
    expect(handler).toBeTruthy();
    const req = createReq({ characterId, chatId });
    const res = createRes();

    await handler!(req, res);

    expect(res.statusCode).toBe(200);
    const payload = res.payload as { proposal?: { sourceChatId?: string } };
    expect(payload.proposal?.sourceChatId).toBe(chatId);
    expect(appendLLMAudit).toHaveBeenCalledWith(expect.objectContaining({
      endpoint: "character_evolution_handoff",
      status: 200,
      ok: true,
      metadata: {
        model: "anthropic/claude-3.5-haiku",
        maxTokens: 2400,
        replayed: false,
      },
    }));

    const characterFile = JSON.parse(readFileSync(path.join(dataDirs.characters, characterId, "character.json"), "utf-8"));
    expect(characterFile.character.characterEvolution.pendingProposal.sourceChatId).toBe(chatId);
  });

  it("normalizes provider-prefixed extraction models before execution for non-openrouter providers", async () => {
    writeJson(path.join(dataDirs.root, "settings.json"), {
      data: {
        username: "User",
        characterEvolutionDefaults: {
          extractionProvider: "openai",
          extractionModel: "openai/gpt-4.1-mini",
          extractionMaxTokens: 2400,
          extractionPrompt: "default prompt",
          sectionConfigs: [],
          privacy: {
            allowCharacterIntimatePreferences: false,
            allowUserIntimatePreferences: false,
          },
        },
      },
    });
    const executeInternalLLMTextCompletion = vi.fn(async () => JSON.stringify({
      proposedState: {},
      changes: [],
    }));
    const { postHandlers } = buildHandlers({ executeInternalLLMTextCompletion });
    const handler = postHandlers.get("/data/character-evolution/handoff");
    expect(handler).toBeTruthy();

    const res = createRes();
    await handler!(createReq({ characterId, chatId }), res);

    expect(res.statusCode).toBe(200);
    expect(executeInternalLLMTextCompletion).toHaveBeenCalledWith(expect.objectContaining({
      provider: "openai",
      model: "gpt-4.1-mini",
    }));
  });

  it("rejects a second handoff while a proposal is already pending", async () => {
    const { postHandlers } = buildHandlers();
    const handler = postHandlers.get("/data/character-evolution/handoff");
    expect(handler).toBeTruthy();

    await handler!(createReq({ characterId, chatId }), createRes());

    const secondRes = createRes();
    await handler!(createReq({ characterId, chatId }), secondRes);

    expect(secondRes.statusCode).toBe(409);
    expect(secondRes.payload).toEqual(expect.objectContaining({
      error: "PENDING_PROPOSAL_EXISTS",
    }));
  });

  it("returns a conflict instead of retrying a stale handoff write", async () => {
    const { postHandlers } = buildHandlers({
      applyStateCommands: async () => {
        throw {
          result: {
            conflicts: [
              { code: "STALE_BASE_EVENT" },
            ],
          },
        };
      },
    });
    const handler = postHandlers.get("/data/character-evolution/handoff");
    expect(handler).toBeTruthy();

    const res = createRes();
    await handler!(createReq({ characterId, chatId }), res);

    expect(res.statusCode).toBe(409);
    expect(res.payload).toEqual(expect.objectContaining({
      error: "EVOLUTION_STATE_CONFLICT",
    }));

    const characterFile = JSON.parse(readFileSync(path.join(dataDirs.characters, characterId, "character.json"), "utf-8"));
    expect(characterFile.character.characterEvolution.pendingProposal ?? null).toBeNull();
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
      expect(getRes.payload).toEqual(expect.objectContaining({
        version: expect.objectContaining({
          version: 1,
          sectionConfigs: expect.any(Array),
          privacy: {
            allowCharacterIntimatePreferences: false,
            allowUserIntimatePreferences: false,
          },
        }),
      }));
    }
  });

  it("allows an explicit replay handoff for an already accepted chat", async () => {
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
          currentStateVersion: 3,
          currentState: {},
          stateVersions: [],
          lastProcessedChatId: chatId,
        },
      },
    });

    const appendLLMAudit = vi.fn(async () => {});
    const { postHandlers } = buildHandlers({ appendLLMAudit });
    const handler = postHandlers.get("/data/character-evolution/handoff");
    expect(handler).toBeTruthy();

    const res = createRes();
    await handler!(createReq({ characterId, chatId, forceReplay: true }, {}), res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual(expect.objectContaining({
      ok: true,
      replayed: true,
      proposal: expect.objectContaining({
        sourceChatId: chatId,
      }),
    }));
    expect(appendLLMAudit).toHaveBeenCalledWith(expect.objectContaining({
      endpoint: "character_evolution_handoff",
      status: 200,
      metadata: expect.objectContaining({
        replayed: true,
      }),
      response: expect.objectContaining({
        replayed: true,
      }),
    }));
  });

  it("keeps an accepted version readable when snapshot finalization falls back to the staged file", async () => {
    const { postHandlers, getHandlers } = buildHandlers({
      fsOverride: {
        rename: async () => {
          throw new Error("rename failed");
        },
        copyFile: async () => {
          throw new Error("copy failed");
        },
      },
    });
    const handoff = postHandlers.get("/data/character-evolution/handoff");
    const accept = postHandlers.get("/data/character-evolution/:charId/proposal/accept");
    const getVersion = getHandlers.get("/data/character-evolution/:charId/versions/:version");
    expect(handoff).toBeTruthy();
    expect(accept).toBeTruthy();
    expect(getVersion).toBeTruthy();

    await handoff!(createReq({ characterId, chatId }), createRes());

    const acceptRes = createRes();
    await accept!(createReq({}, { charId: characterId }), acceptRes);

    expect(acceptRes.statusCode).toBe(200);
    expect(existsSync(path.join(dataDirs.characters, characterId, "states", "v1.json"))).toBe(false);
    expect(
      readdirSync(path.join(dataDirs.characters, characterId, "states")).some(
        (entry) => entry.startsWith(".v1.") && entry.endsWith(".pending.json"),
      ),
    ).toBe(true);

    const getRes = createRes();
    await getVersion!({
      method: "GET",
      originalUrl: "/data/character-evolution/test",
      body: {},
      params: { charId: characterId, version: "1" },
    }, getRes);

    expect(getRes.statusCode).toBe(200);
    expect(getRes.payload).toEqual(expect.objectContaining({
      version: expect.objectContaining({
        version: 1,
      }),
    }));
  });

  it("preserves disabled-section state when accepting a proposal", async () => {
    writeJson(path.join(dataDirs.characters, characterId, "character.json"), {
      character: {
        chaId: characterId,
        type: "character",
        name: "Eva",
        desc: "desc",
        personality: "personality",
        characterEvolution: {
          enabled: true,
          useGlobalDefaults: false,
          extractionProvider: "openrouter",
          extractionModel: "anthropic/claude-3.5-haiku",
          extractionMaxTokens: 2400,
          extractionPrompt: "prompt",
          sectionConfigs: [
            {
              key: "relationship",
              label: "Relationship",
              enabled: true,
              includeInPrompt: true,
              instruction: "Track relationship",
              kind: "object",
              sensitive: false,
            },
            {
              key: "userFacts",
              label: "User Facts",
              enabled: false,
              includeInPrompt: false,
              instruction: "Track facts",
              kind: "list",
              sensitive: false,
            },
          ],
          privacy: {
            allowCharacterIntimatePreferences: false,
            allowUserIntimatePreferences: false,
          },
          currentStateVersion: 0,
          currentState: {
            relationship: {
              trustLevel: "steady",
              dynamic: "old dynamic",
            },
            userFacts: [
              {
                value: "User works nights",
                confidence: "confirmed",
                note: "from an earlier accepted chat",
                status: "active",
              },
            ],
          },
          pendingProposal: {
            proposalId: "proposal-1",
            sourceChatId: chatId,
            proposedState: {
              relationship: {
                trustLevel: "higher",
                dynamic: "warmer after the last exchange",
              },
              userFacts: [],
            },
            changes: [
              {
                sectionKey: "relationship",
                summary: "Relationship became warmer.",
                evidence: ["Character said they feel closer now."],
              },
            ],
            createdAt: 1,
          },
          stateVersions: [],
          lastProcessedChatId: null,
        },
      },
    });

    const { postHandlers } = buildHandlers();
    const accept = postHandlers.get("/data/character-evolution/:charId/proposal/accept");
    expect(accept).toBeTruthy();

    const acceptRes = createRes();
    await accept!(createReq({}, { charId: characterId }), acceptRes);

    expect(acceptRes.statusCode).toBe(200);
    expect(acceptRes.payload).toEqual(expect.objectContaining({
      state: expect.objectContaining({
        relationship: {
          trustLevel: "higher",
          dynamic: "warmer after the last exchange",
        },
        userFacts: [
          {
            value: "User works nights",
            confidence: "confirmed",
            note: "from an earlier accepted chat",
            status: "active",
          },
        ],
      }),
    }));
  });

  it("preserves intimate preferences on accept when global defaults allow them", async () => {
    writeJson(path.join(dataDirs.root, "settings.json"), {
      data: {
        username: "User",
        characterEvolutionDefaults: {
          extractionProvider: "openrouter",
          extractionModel: "anthropic/claude-3.5-haiku",
          extractionMaxTokens: 2400,
          extractionPrompt: "prompt",
          sectionConfigs: [
            {
              key: "relationship",
              label: "Relationship",
              enabled: true,
              includeInPrompt: true,
              instruction: "Track relationship",
              kind: "object",
              sensitive: false,
            },
            {
              key: "characterIntimatePreferences",
              label: "Character Intimate Preferences",
              enabled: true,
              includeInPrompt: true,
              instruction: "Track character intimacy",
              kind: "list",
              sensitive: true,
            },
            {
              key: "userIntimatePreferences",
              label: "User Intimate Preferences",
              enabled: true,
              includeInPrompt: true,
              instruction: "Track user intimacy",
              kind: "list",
              sensitive: true,
            },
          ],
          privacy: {
            allowCharacterIntimatePreferences: true,
            allowUserIntimatePreferences: true,
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
          extractionProvider: "openrouter",
          extractionModel: "anthropic/claude-3.5-haiku",
          extractionMaxTokens: 2400,
          extractionPrompt: "prompt",
          sectionConfigs: [],
          privacy: {
            allowCharacterIntimatePreferences: false,
            allowUserIntimatePreferences: false,
          },
          currentStateVersion: 0,
          currentState: {
            relationship: {
              trustLevel: "steady",
              dynamic: "old dynamic",
            },
            characterIntimatePreferences: [],
            userIntimatePreferences: [],
          },
          pendingProposal: {
            proposalId: "proposal-1",
            sourceChatId: chatId,
            proposedState: {
              relationship: {
                trustLevel: "higher",
                dynamic: "warmer after the last exchange",
              },
              characterIntimatePreferences: [
                {
                  value: "Being in control during intimacy",
                  confidence: "confirmed",
                  note: "stated directly",
                  status: "active",
                },
              ],
              userIntimatePreferences: [
                {
                  value: "Face-sitting",
                  confidence: "confirmed",
                  note: "stated directly",
                  status: "active",
                },
              ],
            },
            changes: [
              {
                sectionKey: "characterIntimatePreferences",
                summary: "Character intimate preferences were updated.",
                evidence: ["Character explicitly described what they wanted."],
              },
              {
                sectionKey: "userIntimatePreferences",
                summary: "User intimate preferences were updated.",
                evidence: ["User explicitly described what they wanted."],
              },
            ],
            createdAt: 1,
          },
          stateVersions: [],
          lastProcessedChatId: null,
        },
      },
    });

    const { postHandlers } = buildHandlers();
    const accept = postHandlers.get("/data/character-evolution/:charId/proposal/accept");
    expect(accept).toBeTruthy();

    const acceptRes = createRes();
    await accept!(createReq({}, { charId: characterId }), acceptRes);

    expect(acceptRes.statusCode).toBe(200);
    expect(acceptRes.payload).toEqual(expect.objectContaining({
      state: expect.objectContaining({
        characterIntimatePreferences: [
          expect.objectContaining({
            value: "Being in control during intimacy",
          }),
        ],
        userIntimatePreferences: [
          expect.objectContaining({
            value: "Face-sitting",
          }),
        ],
      }),
    }));

    const versionFile = JSON.parse(
      readFileSync(path.join(dataDirs.characters, characterId, "states", "v1.json"), "utf-8"),
    );
    expect(versionFile).toEqual(expect.objectContaining({
      state: expect.objectContaining({
        characterIntimatePreferences: [
          expect.objectContaining({
            value: "Being in control during intimacy",
          }),
        ],
        userIntimatePreferences: [
          expect.objectContaining({
            value: "Face-sitting",
          }),
        ],
      }),
      privacy: {
        allowCharacterIntimatePreferences: true,
        allowUserIntimatePreferences: true,
      },
    }));
  });

  it("does not leave a visible version file behind when accept fails", async () => {
    const { postHandlers: handoffHandlers } = buildHandlers();
    const handoff = handoffHandlers.get("/data/character-evolution/handoff");
    expect(handoff).toBeTruthy();

    await handoff!(createReq({ characterId, chatId }), createRes());

    const { postHandlers } = buildHandlers({
      applyStateCommands: async () => {
        throw new Error("simulated replace failure");
      },
    });
    const accept = postHandlers.get("/data/character-evolution/:charId/proposal/accept");
    expect(accept).toBeTruthy();

    const acceptRes = createRes();
    await accept!(createReq({}, { charId: characterId }), acceptRes);

    expect(acceptRes.statusCode).toBe(500);

    const statesDir = path.join(dataDirs.characters, characterId, "states");
    expect(existsSync(path.join(statesDir, "v1.json"))).toBe(false);
    expect(existsSync(statesDir)).toBe(true);
    expect(readdirSync(statesDir)).toEqual([]);
  });

  it("rebuilds version history from disk when stored stateVersions metadata is empty", async () => {
    const versionOne = {
      version: 1,
      chatId: "chat-a",
      acceptedAt: 1001,
      state: {
        relationship: {
          trustLevel: "high",
          dynamic: "first",
        },
      },
    };
    const versionTwo = {
      version: 2,
      chatId: "chat-b",
      acceptedAt: 1002,
      state: {
        relationship: {
          trustLevel: "high",
          dynamic: "second",
        },
      },
    };

    writeJson(path.join(dataDirs.characters, characterId, "states", "v1.json"), versionOne);
    writeJson(path.join(dataDirs.characters, characterId, "states", "v2.json"), versionTwo);
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
          currentStateVersion: 2,
          currentState: versionTwo.state,
          stateVersions: [],
        },
      },
    });

    const { getHandlers } = buildHandlers();
    const listVersions = getHandlers.get("/data/character-evolution/:charId/versions");
    expect(listVersions).toBeTruthy();

    const listRes = createRes();
    await listVersions!({
      method: "GET",
      originalUrl: "/data/character-evolution/test",
      body: {},
      params: { charId: characterId },
    }, listRes);

    expect(listRes.statusCode).toBe(200);
    expect(listRes.payload).toEqual(expect.objectContaining({
      ok: true,
      currentStateVersion: 2,
      versions: [
        { version: 2, chatId: "chat-b", acceptedAt: 1002 },
        { version: 1, chatId: "chat-a", acceptedAt: 1001 },
      ],
    }));
  });

  it("rebuilds version history from staged files when finalized snapshots are unavailable", async () => {
    writeJson(path.join(dataDirs.characters, characterId, "states", ".v1.pending-a.pending.json"), {
      version: 1,
      chatId: "chat-a",
      acceptedAt: 1001,
      state: {
        relationship: {
          trustLevel: "high",
          dynamic: "first",
        },
      },
    });
    writeJson(path.join(dataDirs.characters, characterId, "states", ".v2.pending-b.pending.json"), {
      version: 2,
      chatId: "chat-b",
      acceptedAt: 1002,
      state: {
        relationship: {
          trustLevel: "higher",
          dynamic: "second",
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
          currentStateVersion: 2,
          currentState: {},
          stateVersions: [],
        },
      },
    });

    const { getHandlers } = buildHandlers();
    const listVersions = getHandlers.get("/data/character-evolution/:charId/versions");
    expect(listVersions).toBeTruthy();

    const listRes = createRes();
    await listVersions!({
      method: "GET",
      originalUrl: "/data/character-evolution/test",
      body: {},
      params: { charId: characterId },
    }, listRes);

    expect(listRes.statusCode).toBe(200);
    expect(listRes.payload).toEqual(expect.objectContaining({
      versions: [
        { version: 2, chatId: "chat-b", acceptedAt: 1002 },
        { version: 1, chatId: "chat-a", acceptedAt: 1001 },
      ],
    }));
  });

  it("audits raw model output when handoff parse fails", async () => {
    const appendLLMAudit = vi.fn(async () => {});
    const logLLMExecutionEnd = vi.fn();
    const { postHandlers } = buildHandlers({
      appendLLMAudit,
      logLLMExecutionEnd,
      executeInternalLLMTextCompletion: async () => "```json\n{ invalid }\n```",
    });
    const handler = postHandlers.get("/data/character-evolution/handoff");
    expect(handler).toBeTruthy();

    const res = createRes();
    await handler!(createReq({ characterId, chatId }), res);

    expect(res.statusCode).toBe(502);
    expect(appendLLMAudit).toHaveBeenCalledTimes(1);
    expect(appendLLMAudit).toHaveBeenCalledWith(expect.objectContaining({
      endpoint: "character_evolution_handoff",
      status: 502,
      ok: false,
      metadata: expect.objectContaining({
        model: "anthropic/claude-3.5-haiku",
        maxTokens: 2400,
        reason: "parse_failed",
      }),
      response: {
        type: "raw_text",
        result: "```json\n{ invalid }\n```",
      },
      error: expect.objectContaining({
        error: "EVOLUTION_PARSE_FAILED",
      }),
    }));
    expect(logLLMExecutionEnd).toHaveBeenCalledWith(expect.objectContaining({
      endpoint: "character_evolution_handoff",
      status: 502,
      code: "EVOLUTION_PARSE_FAILED",
      provider: "openrouter",
      characterId,
      chatId,
    }));
  });

  it("renders extractor prompt variables before the LLM call", async () => {
    writeJson(path.join(dataDirs.root, "settings.json"), {
      data: {
        username: "Andrew",
        characterEvolutionDefaults: {
          extractionProvider: "openrouter",
          extractionModel: "anthropic/claude-3.5-haiku",
          extractionMaxTokens: 2400,
          extractionPrompt: "Facts about {{user}} as seen by {{char}}.",
          sectionConfigs: [
            {
              key: "userRead",
              label: "User Read",
              enabled: true,
              includeInPrompt: true,
              instruction: "{{char}} reads {{user}} in a durable way.",
              kind: "list",
              sensitive: false,
            },
          ],
          privacy: {
            allowCharacterIntimatePreferences: false,
            allowUserIntimatePreferences: false,
          },
        },
      },
    });

    const executeInternalLLMTextCompletion = vi.fn(async ({ messages }: { messages: Array<{ content: string }> }) => {
      const combined = messages.map((m) => m.content).join("\n");
      expect(combined).toContain("Facts about Andrew as seen by Eva.");
      expect(combined).toContain("Eva reads Andrew in a durable way.");
      expect(combined).not.toContain("{{char}}");
      expect(combined).not.toContain("{{user}}");
      return JSON.stringify({
        proposedState: {},
        changes: [],
      });
    });

    const { postHandlers } = buildHandlers({ executeInternalLLMTextCompletion });
    const handler = postHandlers.get("/data/character-evolution/handoff");
    expect(handler).toBeTruthy();

    const res = createRes();
    await handler!(createReq({ characterId, chatId }), res);

    expect(res.statusCode).toBe(200);
    expect(executeInternalLLMTextCompletion).toHaveBeenCalledTimes(1);
  });
});
