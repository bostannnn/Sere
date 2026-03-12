import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";

import {
  buildHandlers,
  characterId,
  chatId,
  cleanupEvolutionRouteTest,
  createReq,
  createRes,
  getDataDirs,
  setupEvolutionRouteTest,
  writeJson,
} from "./evolution_routes.test_helpers";

beforeEach(() => {
  setupEvolutionRouteTest();
});

afterEach(() => {
  cleanupEvolutionRouteTest();
});

describe("evolution routes handoff", () => {
  it("creates a pending proposal on handoff", async () => {
    const { postHandlers } = buildHandlers();
    const handler = postHandlers.get("/data/character-evolution/handoff");
    expect(handler).toBeTruthy();

    const res = createRes();
    await handler!(createReq({ characterId, chatId }), res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual(expect.objectContaining({
      ok: true,
      replayed: false,
      proposal: expect.objectContaining({
        sourceChatId: chatId,
        sourceRange: {
          chatId,
          startMessageIndex: 0,
          endMessageIndex: 1,
        },
      }),
    }));

    const dataDirs = getDataDirs();
    const characterFile = JSON.parse(readFileSync(path.join(dataDirs.characters, characterId, "character.json"), "utf-8"));
    expect(characterFile.character.characterEvolution.pendingProposal).toEqual(expect.objectContaining({
      sourceChatId: chatId,
      sourceRange: {
        chatId,
        startMessageIndex: 0,
        endMessageIndex: 1,
      },
    }));
  });

  it("normalizes provider-prefixed extraction models before execution for non-openrouter providers", async () => {
    const dataDirs = getDataDirs();
    writeJson(path.join(dataDirs.root, "settings.json"), {
      data: {
        username: "Andrew",
        characterEvolutionDefaults: {
          extractionProvider: "openai",
          extractionModel: "openai/gpt-4.1-mini",
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

  it("rejects a handoff that finishes after another request already created a proposal", async () => {
    const dataDirs = getDataDirs();
    const executeInternalLLMTextCompletion = vi.fn(async () => {
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
            pendingProposal: {
              proposalId: "proposal-existing",
              sourceChatId: "other-chat",
              sourceRange: {
                chatId: "other-chat",
                startMessageIndex: 0,
                endMessageIndex: 1,
              },
              proposedState: {
                relationship: {
                  trustLevel: "steady",
                  dynamic: "already updated elsewhere",
                },
              },
              changes: [
                {
                  sectionKey: "relationship",
                  summary: "Another handoff finished first.",
                  evidence: ["existing proposal"],
                },
              ],
              createdAt: 1,
            },
            stateVersions: [],
            lastProcessedChatId: null,
          },
        },
      });
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

    expect(res.statusCode).toBe(409);
    expect(res.payload).toEqual(expect.objectContaining({
      error: "PENDING_PROPOSAL_EXISTS",
    }));

    const characterFile = JSON.parse(readFileSync(path.join(dataDirs.characters, characterId, "character.json"), "utf-8"));
    expect(characterFile.character.characterEvolution.pendingProposal).toEqual(expect.objectContaining({
      proposalId: "proposal-existing",
      sourceChatId: "other-chat",
      sourceRange: {
        chatId: "other-chat",
        startMessageIndex: 0,
        endMessageIndex: 1,
      },
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

    const dataDirs = getDataDirs();
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
    const dataDirs = getDataDirs();
    const versionPath = path.join(dataDirs.characters, characterId, "states", "v1.json");
    expect(existsSync(versionPath)).toBe(true);

    const characterFile = JSON.parse(readFileSync(path.join(dataDirs.characters, characterId, "character.json"), "utf-8"));
    expect(characterFile.character.characterEvolution.currentStateVersion).toBe(1);
    expect(characterFile.character.characterEvolution.pendingProposal).toBeNull();
    expect(characterFile.character.characterEvolution.lastProcessedMessageIndexByChat).toEqual({
      [chatId]: 1,
    });
    expect(characterFile.character.characterEvolution.processedRanges).toEqual([
      {
        version: 1,
        acceptedAt: expect.any(Number),
        range: {
          chatId,
          startMessageIndex: 0,
          endMessageIndex: 1,
        },
      },
    ]);

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
          range: {
            chatId,
            startMessageIndex: 0,
            endMessageIndex: 1,
          },
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
    const dataDirs = getDataDirs();
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
          stateVersions: [
            {
              version: 3,
              chatId,
              acceptedAt: 1000,
              range: {
                chatId,
                startMessageIndex: 0,
                endMessageIndex: 1,
              },
            },
          ],
          lastProcessedChatId: chatId,
          lastProcessedMessageIndexByChat: {
            [chatId]: 1,
          },
          processedRanges: [
            {
              version: 3,
              acceptedAt: 1000,
              range: {
                chatId,
                startMessageIndex: 0,
                endMessageIndex: 1,
              },
            },
          ],
        },
      },
    });

    const appendLLMAudit = vi.fn(async () => {});
    const { postHandlers } = buildHandlers({ appendLLMAudit });
    const handler = postHandlers.get("/data/character-evolution/handoff");
    expect(handler).toBeTruthy();

    const res = createRes();
    await handler!(createReq({ characterId, chatId, forceReplay: true }), res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual(expect.objectContaining({
      ok: true,
      replayed: true,
      proposal: expect.objectContaining({
        sourceChatId: chatId,
        sourceRange: {
          chatId,
          startMessageIndex: 0,
          endMessageIndex: 1,
        },
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

  it("rejects replay for a disjoint range that was never accepted", async () => {
    const dataDirs = getDataDirs();
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
          currentStateVersion: 1,
          currentState: {},
          stateVersions: [
            {
              version: 1,
              chatId,
              acceptedAt: 1000,
              range: {
                chatId,
                startMessageIndex: 0,
                endMessageIndex: 0,
              },
            },
          ],
          processedRanges: [
            {
              version: 1,
              acceptedAt: 1000,
              range: {
                chatId,
                startMessageIndex: 0,
                endMessageIndex: 0,
              },
            },
          ],
          lastProcessedChatId: chatId,
          lastProcessedMessageIndexByChat: {
            [chatId]: 0,
          },
        },
      },
    });

    const { postHandlers } = buildHandlers();
    const handler = postHandlers.get("/data/character-evolution/handoff");
    expect(handler).toBeTruthy();

    const res = createRes();
    await handler!(createReq({
      characterId,
      chatId,
      forceReplay: true,
      sourceRange: {
        chatId,
        startMessageIndex: 1,
        endMessageIndex: 1,
      },
    }), res);

    expect(res.statusCode).toBe(409);
    expect(res.payload).toEqual(expect.objectContaining({
      error: "RANGE_REPLAY_REQUIRES_ACCEPTED_RANGE",
    }));
  });

  it("rejects replay ranges that extend beyond accepted coverage", async () => {
    const dataDirs = getDataDirs();
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
          currentStateVersion: 1,
          currentState: {},
          stateVersions: [
            {
              version: 1,
              chatId,
              acceptedAt: 1000,
              range: {
                chatId,
                startMessageIndex: 0,
                endMessageIndex: 0,
              },
            },
          ],
          processedRanges: [
            {
              version: 1,
              acceptedAt: 1000,
              range: {
                chatId,
                startMessageIndex: 0,
                endMessageIndex: 0,
              },
            },
          ],
          lastProcessedChatId: chatId,
          lastProcessedMessageIndexByChat: {
            [chatId]: 0,
          },
        },
      },
    });

    const { postHandlers } = buildHandlers();
    const handler = postHandlers.get("/data/character-evolution/handoff");
    expect(handler).toBeTruthy();

    const res = createRes();
    await handler!(createReq({
      characterId,
      chatId,
      forceReplay: true,
      sourceRange: {
        chatId,
        startMessageIndex: 0,
        endMessageIndex: 1,
      },
    }), res);

    expect(res.statusCode).toBe(409);
    expect(res.payload).toEqual(expect.objectContaining({
      error: "RANGE_REPLAY_REQUIRES_ACCEPTED_RANGE",
    }));
  });

  it("does not treat legacy lastProcessedChatId alone as full current-chat coverage", async () => {
    const dataDirs = getDataDirs();
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
          currentStateVersion: 1,
          currentState: {},
          stateVersions: [],
          lastProcessedChatId: chatId,
        },
      },
    });

    const { postHandlers } = buildHandlers();
    const handler = postHandlers.get("/data/character-evolution/handoff");
    expect(handler).toBeTruthy();

    const res = createRes();
    await handler!(createReq({ characterId, chatId }), res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual(expect.objectContaining({
      proposal: expect.objectContaining({
        sourceRange: {
          chatId,
          startMessageIndex: 0,
          endMessageIndex: 1,
        },
      }),
    }));
  });

  it("supports explicit contiguous next-range handoff and advances the per-chat cursor on accept", async () => {
    const { postHandlers } = buildHandlers();
    const handoff = postHandlers.get("/data/character-evolution/handoff");
    const accept = postHandlers.get("/data/character-evolution/:charId/proposal/accept");
    expect(handoff).toBeTruthy();
    expect(accept).toBeTruthy();

    const firstHandoffRes = createRes();
    await handoff!(createReq({
      characterId,
      chatId,
      sourceRange: {
        chatId,
        startMessageIndex: 0,
        endMessageIndex: 0,
      },
    }), firstHandoffRes);
    expect(firstHandoffRes.statusCode).toBe(200);
    expect(firstHandoffRes.payload).toEqual(expect.objectContaining({
      proposal: expect.objectContaining({
        sourceRange: {
          chatId,
          startMessageIndex: 0,
          endMessageIndex: 0,
        },
      }),
    }));

    const firstAcceptRes = createRes();
    await accept!(createReq({}, { charId: characterId }), firstAcceptRes);
    expect(firstAcceptRes.statusCode).toBe(200);

    const secondHandoffRes = createRes();
    await handoff!(createReq({ characterId, chatId }), secondHandoffRes);
    expect(secondHandoffRes.statusCode).toBe(200);
    expect(secondHandoffRes.payload).toEqual(expect.objectContaining({
      proposal: expect.objectContaining({
        sourceRange: {
          chatId,
          startMessageIndex: 1,
          endMessageIndex: 1,
        },
      }),
    }));
  });

  it("does not advance the cursor when a proposal is rejected", async () => {
    const { postHandlers } = buildHandlers();
    const handoff = postHandlers.get("/data/character-evolution/handoff");
    const reject = postHandlers.get("/data/character-evolution/:charId/proposal/reject");
    expect(handoff).toBeTruthy();
    expect(reject).toBeTruthy();

    await handoff!(createReq({ characterId, chatId }), createRes());

    const rejectRes = createRes();
    await reject!(createReq({}, { charId: characterId }), rejectRes);
    expect(rejectRes.statusCode).toBe(200);

    const dataDirs = getDataDirs();
    writeJson(path.join(dataDirs.characters, characterId, "chats", `${chatId}.json`), {
      chat: {
        id: chatId,
        message: [
          { role: "user", data: "I need a job soon." },
          { role: "char", data: "That sounds miserable, dude." },
          { role: "user", data: "And I still need help." },
        ],
      },
    });

    const secondHandoffRes = createRes();
    await handoff!(createReq({ characterId, chatId }), secondHandoffRes);
    expect(secondHandoffRes.statusCode).toBe(200);
    expect(secondHandoffRes.payload).toEqual(expect.objectContaining({
      proposal: expect.objectContaining({
        sourceRange: {
          chatId,
          startMessageIndex: 0,
          endMessageIndex: 2,
        },
      }),
    }));
  });
});
