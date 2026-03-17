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

describe("evolution routes accept and replay", () => {
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

  it("audits accept-time retention decisions with per-item reasons", async () => {
    const dataDirs = getDataDirs();
    writeJson(path.join(dataDirs.characters, characterId, "states", "v1.json"), {
      version: 1,
      chatId,
      acceptedAt: 1000,
      state: {
        activeThreads: [],
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
          currentStateVersion: 1,
          currentState: {
            activeThreads: [
              {
                value: "book the train to Kazan",
                status: "active",
                confidence: "likely",
                lastSeenVersion: 1,
                unseenAcceptedHandoffs: 0,
              },
              {
                value: "follow up on the old gallery invite",
                status: "active",
                confidence: "likely",
                lastSeenVersion: 1,
                unseenAcceptedHandoffs: 1,
              },
            ],
          },
          pendingProposal: {
            proposalId: "proposal-accept-audit",
            sourceChatId: chatId,
            sourceRange: {
              chatId,
              startMessageIndex: 0,
              endMessageIndex: 1,
            },
            proposedState: {
              activeThreads: [
                {
                  value: "book the train to Kazan",
                  status: "active",
                  confidence: "likely",
                },
              ],
            },
            changes: [
              {
                sectionKey: "activeThreads",
                summary: "The train booking is still the active thread.",
                evidence: ["They returned to the train booking directly."],
              },
            ],
            createdAt: 100,
          },
          stateVersions: [],
          lastProcessedChatId: null,
        },
      },
    });

    const appendLLMAudit = vi.fn(async () => {});
    const { postHandlers } = buildHandlers({ appendLLMAudit });
    const accept = postHandlers.get("/data/character-evolution/:charId/proposal/accept");
    expect(accept).toBeTruthy();

    const acceptRes = createRes();
    await accept!(createReq({}, { charId: characterId }), acceptRes);

    expect(acceptRes.statusCode).toBe(200);
    expect(appendLLMAudit).toHaveBeenCalledWith(expect.objectContaining({
      endpoint: "character_evolution_accept",
      status: 200,
      metadata: expect.objectContaining({
        acceptedVersion: 2,
        retentionReport: expect.objectContaining({
          acceptedVersion: 2,
          sections: expect.objectContaining({
            activeThreads: expect.objectContaining({
              bucket: "fast",
              archiveThreshold: 2,
              decisions: expect.arrayContaining([
                expect.objectContaining({
                  reason: "reinforced",
                  valuePreview: "book the train to Kazan",
                  fromStatus: "active",
                  toStatus: "active",
                }),
                expect.objectContaining({
                  reason: "decay_archive",
                  valuePreview: "follow up on the old gallery invite",
                  fromStatus: "active",
                  toStatus: "archived",
                }),
              ]),
            }),
          }),
        }),
      }),
      response: expect.objectContaining({
        version: 2,
      }),
    }));
  });

  it("rejects malformed partial accept payloads instead of silently sanitizing them", async () => {
    const { postHandlers } = buildHandlers();
    const handoff = postHandlers.get("/data/character-evolution/handoff");
    const accept = postHandlers.get("/data/character-evolution/:charId/proposal/accept");
    expect(handoff).toBeTruthy();
    expect(accept).toBeTruthy();

    await handoff!(createReq({ characterId, chatId }), createRes());

    const acceptRes = createRes();
    await accept!(createReq({
      proposedState: [],
    }, { charId: characterId }), acceptRes);

    expect(acceptRes.statusCode).toBe(400);
    expect(acceptRes.payload).toEqual(expect.objectContaining({
      error: "EVOLUTION_INVALID_PROPOSAL",
      message: expect.stringContaining("proposedState must be an object"),
    }));

    const dataDirs = getDataDirs();
    const characterFile = JSON.parse(readFileSync(path.join(dataDirs.characters, characterId, "character.json"), "utf-8"));
    expect(characterFile.character.characterEvolution.pendingProposal).toEqual(expect.objectContaining({
      sourceChatId: chatId,
    }));
    expect(existsSync(path.join(dataDirs.characters, characterId, "states", "v1.json"))).toBe(false);
  });

  it("keeps accept successful when success-path audit logging fails", async () => {
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
          currentStateVersion: 1,
          currentState: {
            relationship: {
              trustLevel: "steady",
              dynamic: "warm",
            },
          },
          pendingProposal: {
            proposalId: "proposal-audit-failure",
            sourceChatId: chatId,
            sourceRange: {
              chatId,
              startMessageIndex: 0,
              endMessageIndex: 1,
            },
            proposedState: {
              relationship: {
                trustLevel: "high",
                dynamic: "closer after the handoff",
              },
            },
            changes: [
              {
                sectionKey: "relationship",
                summary: "The relationship warmed up.",
                evidence: ["They ended on a closer note."],
              },
            ],
            createdAt: 100,
          },
          stateVersions: [],
          lastProcessedChatId: null,
        },
      },
    });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const appendLLMAudit = vi.fn(async () => {
      throw new Error("disk full");
    });
    const { postHandlers } = buildHandlers({ appendLLMAudit });
    const accept = postHandlers.get("/data/character-evolution/:charId/proposal/accept");
    expect(accept).toBeTruthy();

    const acceptRes = createRes();
    await accept!(createReq({}, { charId: characterId }), acceptRes);

    expect(acceptRes.statusCode).toBe(200);
    expect(acceptRes.payload).toEqual(expect.objectContaining({
      ok: true,
      version: 2,
    }));

    const characterFile = JSON.parse(readFileSync(path.join(dataDirs.characters, characterId, "character.json"), "utf-8"));
    expect(characterFile.character.characterEvolution.currentStateVersion).toBe(2);
    expect(existsSync(path.join(dataDirs.characters, characterId, "states", "v2.json"))).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(
      "[character-evolution] Failed to append accept audit log.",
      expect.objectContaining({
        characterId,
        version: 2,
        error: "disk full",
      }),
    );

    warnSpy.mockRestore();
  });

  it("re-validates pending proposals against latest global defaults on accept", async () => {
    const dataDirs = getDataDirs();
    const { postHandlers } = buildHandlers();
    const handoff = postHandlers.get("/data/character-evolution/handoff");
    const accept = postHandlers.get("/data/character-evolution/:charId/proposal/accept");
    expect(handoff).toBeTruthy();
    expect(accept).toBeTruthy();

    await handoff!(createReq({ characterId, chatId }), createRes());

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
              key: "relationship",
              label: "Relationship",
              enabled: false,
              includeInPrompt: true,
              instruction: "Track relationship shifts.",
              kind: "object",
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

    const acceptRes = createRes();
    await accept!(createReq({}, { charId: characterId }), acceptRes);

    expect(acceptRes.statusCode).toBe(400);
    expect(acceptRes.payload).toEqual(expect.objectContaining({
      error: "EVOLUTION_INVALID_PROPOSAL",
      message: expect.stringContaining('proposedState section "relationship" is not enabled for evolution'),
    }));

    const characterFile = JSON.parse(readFileSync(path.join(dataDirs.characters, characterId, "character.json"), "utf-8"));
    expect(characterFile.character.characterEvolution.pendingProposal).toEqual(expect.objectContaining({
      sourceChatId: chatId,
    }));
    expect(existsSync(path.join(dataDirs.characters, characterId, "states", "v1.json"))).toBe(false);
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

});
