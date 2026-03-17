import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
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
    expect(characterFile.character.characterEvolution.pendingProposal.proposedState).toEqual({
      relationship: {
        trustLevel: "high",
        dynamic: "closer after the last chat",
      },
    });
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

  it("rejects malformed partial extractor proposals before staging a pending proposal", async () => {
    const { postHandlers } = buildHandlers({
      executeInternalLLMTextCompletion: async () => JSON.stringify({
        proposedState: {},
        changes: [
          {
            sectionKey: "userFacts",
            summary: "Claims a change without including a replacement section.",
            evidence: ["User said they have a dog."],
          },
        ],
      }),
    });
    const handler = postHandlers.get("/data/character-evolution/handoff");
    expect(handler).toBeTruthy();

    const res = createRes();
    await handler!(createReq({ characterId, chatId }), res);

    expect(res.statusCode).toBe(502);
    expect(res.payload).toEqual(expect.objectContaining({
      error: "EVOLUTION_INVALID_PROPOSAL",
    }));

    const dataDirs = getDataDirs();
    const characterFile = JSON.parse(readFileSync(path.join(dataDirs.characters, characterId, "character.json"), "utf-8"));
    expect(characterFile.character.characterEvolution.pendingProposal ?? null).toBeNull();
  });

  it("retries once when the extractor returns malformed JSON and succeeds on a valid retry", async () => {
    const executeInternalLLMTextCompletion = vi
      .fn()
      .mockResolvedValueOnce("```json\n{ invalid }\n```")
      .mockResolvedValueOnce(JSON.stringify({
        proposedState: {
          relationship: {
            trustLevel: "high",
            dynamic: "closer after the retry",
          },
        },
        changes: [
          {
            sectionKey: "relationship",
            summary: "Recovered valid JSON on retry.",
            evidence: ["retry"],
          },
        ],
      }));
    const { postHandlers } = buildHandlers({ executeInternalLLMTextCompletion });
    const handler = postHandlers.get("/data/character-evolution/handoff");
    expect(handler).toBeTruthy();

    const res = createRes();
    await handler!(createReq({ characterId, chatId }), res);

    expect(res.statusCode).toBe(200);
    expect(executeInternalLLMTextCompletion).toHaveBeenCalledTimes(2);
    expect(executeInternalLLMTextCompletion).toHaveBeenNthCalledWith(2, expect.objectContaining({
      taskLabel: "character_evolution_handoff_retry",
      messages: expect.arrayContaining([
        expect.objectContaining({
          role: "assistant",
          content: "```json\n{ invalid }\n```",
        }),
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining("invalid JSON"),
        }),
      ]),
    }));
    expect(res.payload).toEqual(expect.objectContaining({
      ok: true,
      proposal: expect.objectContaining({
        proposedState: {
          relationship: {
            trustLevel: "high",
            dynamic: "closer after the retry",
          },
        },
      }),
    }));
  });

  it("rejects extractor proposals with unknown proposedState keys before staging a pending proposal", async () => {
    const { postHandlers } = buildHandlers({
      executeInternalLLMTextCompletion: async () => JSON.stringify({
        proposedState: {
          userFact: [
            {
              value: "User has a dog.",
            },
          ],
        },
        changes: [],
      }),
    });
    const handler = postHandlers.get("/data/character-evolution/handoff");
    expect(handler).toBeTruthy();

    const res = createRes();
    await handler!(createReq({ characterId, chatId }), res);

    expect(res.statusCode).toBe(502);
    expect(res.payload).toEqual(expect.objectContaining({
      error: "EVOLUTION_INVALID_PROPOSAL",
      message: expect.stringContaining('unknown proposedState section "userFact"'),
    }));

    const dataDirs = getDataDirs();
    const characterFile = JSON.parse(readFileSync(path.join(dataDirs.characters, characterId, "character.json"), "utf-8"));
    expect(characterFile.character.characterEvolution.pendingProposal ?? null).toBeNull();
  });

  it("rejects malformed top-level proposal shapes before staging a pending proposal", async () => {
    const { postHandlers } = buildHandlers({
      executeInternalLLMTextCompletion: async () => JSON.stringify({
        proposedState: [],
        changes: [],
      }),
    });
    const handler = postHandlers.get("/data/character-evolution/handoff");
    expect(handler).toBeTruthy();

    const res = createRes();
    await handler!(createReq({ characterId, chatId }), res);

    expect(res.statusCode).toBe(502);
    expect(res.payload).toEqual(expect.objectContaining({
      error: "EVOLUTION_INVALID_PROPOSAL",
      message: expect.stringContaining("proposedState must be an object"),
    }));

    const dataDirs = getDataDirs();
    const characterFile = JSON.parse(readFileSync(path.join(dataDirs.characters, characterId, "character.json"), "utf-8"));
    expect(characterFile.character.characterEvolution.pendingProposal ?? null).toBeNull();
  });

  it("re-validates extractor proposals against latest global defaults before staging", async () => {
    const dataDirs = getDataDirs();
    const executeInternalLLMTextCompletion = vi.fn(async () => {
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
                key: "userFacts",
                label: "User Facts",
                enabled: false,
                includeInPrompt: true,
                instruction: "Track durable user facts.",
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
      return JSON.stringify({
        proposedState: {
          userFacts: [
            {
              value: "User needs a new job soon.",
            },
          ],
        },
        changes: [
          {
            sectionKey: "userFacts",
            summary: "User is actively job hunting.",
            evidence: ["[0] Andrew says they need a job soon."],
          },
        ],
      });
    });
    const { postHandlers } = buildHandlers({ executeInternalLLMTextCompletion });
    const handler = postHandlers.get("/data/character-evolution/handoff");
    expect(handler).toBeTruthy();

    const res = createRes();
    await handler!(createReq({ characterId, chatId }), res);

    expect(res.statusCode).toBe(502);
    expect(res.payload).toEqual(expect.objectContaining({
      error: "EVOLUTION_INVALID_PROPOSAL",
      message: expect.stringContaining('proposedState section "userFacts" is not enabled for evolution'),
    }));

    const characterFile = JSON.parse(readFileSync(path.join(dataDirs.characters, characterId, "character.json"), "utf-8"));
    expect(characterFile.character.characterEvolution.pendingProposal ?? null).toBeNull();
  });

});
