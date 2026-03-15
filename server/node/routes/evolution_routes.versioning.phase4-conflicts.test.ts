import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

describe("evolution routes phase 4 conflicts", () => {
  it("stores corrected replacements in the pending proposal during handoff creation", async () => {
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
          useGlobalDefaults: false,
          extractionProvider: "openrouter",
          extractionModel: "anthropic/claude-3.5-haiku",
          extractionMaxTokens: 2400,
          extractionPrompt: "prompt",
          currentStateVersion: 1,
          currentState: {
            relationship: {
              trustLevel: "steady",
              dynamic: "warm",
            },
            userFacts: [
              {
                value: "user lives in Berlin",
                status: "active",
                confidence: "likely",
                note: "older location",
                sourceChatId: "chat-old",
                updatedAt: 100,
                lastSeenAt: 100,
                timesSeen: 2,
              },
            ],
          },
          pendingProposal: null,
          stateVersions: [],
          lastProcessedChatId: null,
        },
      },
    });

    const { postHandlers } = buildHandlers({
      executeInternalLLMTextCompletion: async () => JSON.stringify({
        proposedState: {
          relationship: {
            trustLevel: "steady",
            dynamic: "warm",
          },
          userFacts: [
            {
              value: "user lives in Berlin",
              status: "active",
              confidence: "likely",
              note: "older location",
            },
            {
              value: "user lives in Moscow",
              status: "active",
              confidence: "confirmed",
              note: "explicit move in the processed range",
            },
          ],
        },
        changes: [
          {
            sectionKey: "userFacts",
            summary: "The user location was updated.",
            evidence: ["They explicitly said they moved to Moscow."],
          },
        ],
      }),
    });
    const handoff = postHandlers.get("/data/character-evolution/handoff");
    expect(handoff).toBeTruthy();

    const handoffRes = createRes();
    await handoff!(createReq({ characterId, chatId }), handoffRes);

    expect(handoffRes.statusCode).toBe(200);
    expect(handoffRes.payload).toEqual(expect.objectContaining({
      proposal: expect.objectContaining({
        proposedState: expect.objectContaining({
          userFacts: [
            expect.objectContaining({
              value: "user lives in Berlin",
              status: "corrected",
              confidence: "likely",
              note: "older location",
              sourceChatId: "chat-old",
              updatedAt: 100,
              lastSeenAt: 100,
              timesSeen: 2,
            }),
            expect.objectContaining({
              value: "user lives in Moscow",
              status: "active",
              confidence: "confirmed",
              note: "explicit move in the processed range",
              sourceChatId: chatId,
              sourceRange: {
                startMessageIndex: 0,
                endMessageIndex: 1,
              },
              updatedAt: expect.any(Number),
              lastSeenAt: expect.any(Number),
              timesSeen: 1,
            }),
          ],
        }),
      }),
    }));
  });

  it("retains short-form replaced facts as corrected during handoff creation and accept", async () => {
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
          useGlobalDefaults: false,
          extractionProvider: "openrouter",
          extractionModel: "anthropic/claude-3.5-haiku",
          extractionMaxTokens: 2400,
          extractionPrompt: "prompt",
          currentStateVersion: 1,
          currentState: {
            relationship: {
              trustLevel: "steady",
              dynamic: "warm",
            },
            userFacts: [
              {
                value: "Lives in Moscow",
                status: "active",
                confidence: "confirmed",
                note: "older accepted location",
                sourceChatId: "chat-old",
                updatedAt: 100,
                lastSeenAt: 100,
                timesSeen: 2,
              },
            ],
          },
          pendingProposal: null,
          stateVersions: [],
          lastProcessedChatId: null,
        },
      },
    });

    const { postHandlers } = buildHandlers({
      executeInternalLLMTextCompletion: async () => JSON.stringify({
        proposedState: {
          relationship: {
            trustLevel: "steady",
            dynamic: "warm",
          },
          userFacts: [
            {
              value: "Lives in Berlin now",
              status: "active",
              confidence: "confirmed",
              note: "explicitly stated new location",
            },
          ],
        },
        changes: [
          {
            sectionKey: "userFacts",
            summary: "The user location changed.",
            evidence: ["They said they live in Berlin now."],
          },
        ],
      }),
    });

    const handoff = postHandlers.get("/data/character-evolution/handoff");
    expect(handoff).toBeTruthy();

    const handoffRes = createRes();
    await handoff!(createReq({ characterId, chatId }), handoffRes);

    expect(handoffRes.statusCode).toBe(200);
    expect(handoffRes.payload.proposal.proposedState.userFacts).toEqual([
      expect.objectContaining({
        value: "Lives in Moscow",
        status: "corrected",
        confidence: "confirmed",
        note: "older accepted location",
        sourceChatId: "chat-old",
        updatedAt: 100,
        lastSeenAt: 100,
        timesSeen: 2,
      }),
      expect.objectContaining({
        value: "Lives in Berlin now",
        status: "active",
        confidence: "confirmed",
        note: "explicitly stated new location",
        sourceChatId: chatId,
        sourceRange: {
          startMessageIndex: 0,
          endMessageIndex: 1,
        },
        updatedAt: expect.any(Number),
        lastSeenAt: expect.any(Number),
        timesSeen: 1,
      }),
    ]);

    const accept = postHandlers.get("/data/character-evolution/:charId/proposal/accept");
    expect(accept).toBeTruthy();

    const acceptRes = createRes();
    await accept!(createReq({}, { charId: characterId }), acceptRes);

    expect(acceptRes.statusCode).toBe(200);
    expect(acceptRes.payload.state.userFacts).toEqual([
      expect.objectContaining({
        value: "Lives in Moscow",
        status: "corrected",
        confidence: "confirmed",
        note: "older accepted location",
        sourceChatId: "chat-old",
        updatedAt: 100,
        lastSeenAt: 100,
        timesSeen: 2,
      }),
      expect.objectContaining({
        value: "Lives in Berlin now",
        status: "active",
        confidence: "confirmed",
        note: "explicitly stated new location",
        sourceChatId: chatId,
        sourceRange: {
          startMessageIndex: 0,
          endMessageIndex: 1,
        },
        updatedAt: acceptRes.payload.acceptedAt,
        lastSeenAt: acceptRes.payload.acceptedAt,
        timesSeen: 1,
      }),
    ]);
  });

  it("keeps short-form coexistence facts active during handoff creation", async () => {
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
          useGlobalDefaults: false,
          extractionProvider: "openrouter",
          extractionModel: "anthropic/claude-3.5-haiku",
          extractionMaxTokens: 2400,
          extractionPrompt: "prompt",
          currentStateVersion: 1,
          currentState: {
            relationship: {
              trustLevel: "steady",
              dynamic: "warm",
            },
            userFacts: [
              {
                value: "Has a cat",
                status: "active",
                confidence: "likely",
                note: "existing pet",
                sourceChatId: "chat-old",
                updatedAt: 100,
                lastSeenAt: 100,
                timesSeen: 2,
              },
            ],
          },
          pendingProposal: null,
          stateVersions: [],
          lastProcessedChatId: null,
        },
      },
    });

    const { postHandlers } = buildHandlers({
      executeInternalLLMTextCompletion: async () => JSON.stringify({
        proposedState: {
          relationship: {
            trustLevel: "steady",
            dynamic: "warm",
          },
          userFacts: [
            {
              value: "Has a cat",
              status: "active",
              confidence: "likely",
              note: "existing pet",
            },
            {
              value: "Has a dog",
              status: "active",
              confidence: "confirmed",
              note: "second compatible pet fact",
            },
          ],
        },
        changes: [
          {
            sectionKey: "userFacts",
            summary: "A second pet fact was added.",
            evidence: ["They said they also have a dog."],
          },
        ],
      }),
    });

    const handoff = postHandlers.get("/data/character-evolution/handoff");
    expect(handoff).toBeTruthy();

    const handoffRes = createRes();
    await handoff!(createReq({ characterId, chatId }), handoffRes);

    expect(handoffRes.statusCode).toBe(200);
    expect(handoffRes.payload.proposal.proposedState.userFacts).toEqual([
      expect.objectContaining({
        value: "Has a cat",
        status: "active",
        confidence: "likely",
        note: "existing pet",
        sourceChatId: "chat-old",
        updatedAt: 100,
        lastSeenAt: 100,
        timesSeen: 2,
      }),
      expect.objectContaining({
        value: "Has a dog",
        status: "active",
        confidence: "confirmed",
        note: "second compatible pet fact",
        sourceChatId: chatId,
        sourceRange: {
          startMessageIndex: 0,
          endMessageIndex: 1,
        },
        updatedAt: expect.any(Number),
        lastSeenAt: expect.any(Number),
        timesSeen: 1,
      }),
    ]);
  });

  it("keeps unchanged coexistence facts when the model outputs only the new changed item", async () => {
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
          useGlobalDefaults: false,
          extractionProvider: "openrouter",
          extractionModel: "anthropic/claude-3.5-haiku",
          extractionMaxTokens: 2400,
          extractionPrompt: "prompt",
          currentStateVersion: 1,
          currentState: {
            relationship: {
              trustLevel: "steady",
              dynamic: "warm",
            },
            userFacts: [
              {
                value: "Has a cat",
                status: "active",
                confidence: "likely",
                note: "existing pet",
                sourceChatId: "chat-old",
                updatedAt: 100,
                lastSeenAt: 100,
                timesSeen: 2,
              },
            ],
          },
          pendingProposal: null,
          stateVersions: [],
          lastProcessedChatId: null,
        },
      },
    });

    const { postHandlers } = buildHandlers({
      executeInternalLLMTextCompletion: async () => JSON.stringify({
        proposedState: {
          userFacts: [
            {
              value: "Has a dog",
              status: "active",
              confidence: "confirmed",
              note: "second compatible pet fact",
            },
          ],
        },
        changes: [
          {
            sectionKey: "userFacts",
            summary: "A second pet fact was added.",
            evidence: ["They said they also have a dog."],
          },
        ],
      }),
    });

    const handoff = postHandlers.get("/data/character-evolution/handoff");
    expect(handoff).toBeTruthy();

    const handoffRes = createRes();
    await handoff!(createReq({ characterId, chatId }), handoffRes);

    expect(handoffRes.statusCode).toBe(200);
    expect(handoffRes.payload.proposal.proposedState.userFacts).toEqual([
      expect.objectContaining({
        value: "Has a cat",
        status: "active",
        confidence: "likely",
        note: "existing pet",
        sourceChatId: "chat-old",
        updatedAt: 100,
        lastSeenAt: 100,
        timesSeen: 2,
      }),
      expect.objectContaining({
        value: "Has a dog",
        status: "active",
        confidence: "confirmed",
        note: "second compatible pet fact",
        sourceChatId: chatId,
        sourceRange: {
          startMessageIndex: 0,
          endMessageIndex: 1,
        },
        updatedAt: expect.any(Number),
        lastSeenAt: expect.any(Number),
        timesSeen: 1,
      }),
    ]);
  });

  it("re-applies deterministic conflict handling on accept so contradictory actives do not survive", async () => {
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
          useGlobalDefaults: false,
          extractionProvider: "openrouter",
          extractionModel: "anthropic/claude-3.5-haiku",
          extractionMaxTokens: 2400,
          extractionPrompt: "prompt",
          currentStateVersion: 1,
          currentState: {
            relationship: {
              trustLevel: "steady",
              dynamic: "warm",
            },
            userFacts: [
              {
                value: "user lives in Berlin",
                status: "active",
                confidence: "likely",
                note: "older location",
                sourceChatId: "chat-old",
                updatedAt: 100,
                lastSeenAt: 100,
                timesSeen: 2,
              },
            ],
          },
          pendingProposal: {
            proposalId: "proposal-phase4-conflict-accept",
            sourceChatId: chatId,
            sourceRange: {
              chatId,
              startMessageIndex: 0,
              endMessageIndex: 1,
            },
            proposedState: {
              relationship: {
                trustLevel: "steady",
                dynamic: "warm",
              },
              userFacts: [
                {
                  value: "user lives in Berlin",
                  status: "active",
                  confidence: "likely",
                  note: "older location",
                },
                {
                  value: "user lives in Moscow",
                  status: "active",
                  confidence: "confirmed",
                  note: "explicit move in the processed range",
                },
              ],
            },
            changes: [
              {
                sectionKey: "userFacts",
                summary: "The user location was updated.",
                evidence: ["They explicitly said they moved to Moscow."],
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
    expect(acceptRes.payload.state.userFacts).toEqual([
      expect.objectContaining({
        value: "user lives in Berlin",
        status: "corrected",
        confidence: "likely",
        note: "older location",
        sourceChatId: "chat-old",
        updatedAt: 100,
        lastSeenAt: 100,
        timesSeen: 2,
      }),
      expect.objectContaining({
        value: "user lives in Moscow",
        status: "active",
        confidence: "confirmed",
        note: "explicit move in the processed range",
        sourceChatId: chatId,
        sourceRange: {
          startMessageIndex: 0,
          endMessageIndex: 1,
        },
        updatedAt: acceptRes.payload.acceptedAt,
        lastSeenAt: acceptRes.payload.acceptedAt,
        timesSeen: 1,
      }),
    ]);
  });

  it("stages only the new compatible same-prefix like when the current one can coexist", async () => {
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
          useGlobalDefaults: false,
          extractionProvider: "openrouter",
          extractionModel: "anthropic/claude-3.5-haiku",
          extractionMaxTokens: 2400,
          extractionPrompt: "prompt",
          currentStateVersion: 1,
          currentState: {
            relationship: {
              trustLevel: "steady",
              dynamic: "warm",
            },
            characterLikes: [
              {
                value: "user likes dark fantasy books",
                status: "active",
                confidence: "likely",
                note: "existing stable preference",
              },
            ],
          },
          pendingProposal: null,
          stateVersions: [],
          lastProcessedChatId: null,
        },
      },
    });

    const { postHandlers } = buildHandlers({
      executeInternalLLMTextCompletion: async () => JSON.stringify({
        proposedState: {
          relationship: {
            trustLevel: "steady",
            dynamic: "warm",
          },
          characterLikes: [
            {
              value: "user likes dark fantasy books",
              status: "active",
              confidence: "likely",
              note: "existing stable preference",
            },
            {
              value: "user likes dark fantasy movies",
              status: "active",
              confidence: "likely",
              note: "new compatible preference",
            },
          ],
        },
        changes: [
          {
            sectionKey: "characterLikes",
            summary: "A second compatible preference was added.",
            evidence: ["They also talked about loving dark fantasy movies."],
          },
        ],
      }),
    });
    const handoff = postHandlers.get("/data/character-evolution/handoff");
    expect(handoff).toBeTruthy();

    const handoffRes = createRes();
    await handoff!(createReq({ characterId, chatId }), handoffRes);

    expect(handoffRes.statusCode).toBe(200);
    expect(handoffRes.payload.proposal.proposedState.characterLikes).toEqual([
      expect.objectContaining({
        value: "user likes dark fantasy movies",
        status: "active",
        confidence: "likely",
        note: "new compatible preference",
      }),
    ]);
  });

  it("corrects active-thread slot replacements through accept instead of leaving both active", async () => {
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
          useGlobalDefaults: false,
          extractionProvider: "openrouter",
          extractionModel: "anthropic/claude-3.5-haiku",
          extractionMaxTokens: 2400,
          extractionPrompt: "prompt",
          currentStateVersion: 1,
          currentState: {
            relationship: {
              trustLevel: "steady",
              dynamic: "warm",
            },
            activeThreads: [
              {
                value: "meet at 7pm tomorrow",
                status: "active",
                confidence: "likely",
                sourceChatId: "chat-old",
                updatedAt: 100,
                lastSeenAt: 100,
                timesSeen: 2,
              },
            ],
          },
          pendingProposal: {
            proposalId: "proposal-phase4-active-thread-replace",
            sourceChatId: chatId,
            sourceRange: {
              chatId,
              startMessageIndex: 0,
              endMessageIndex: 1,
            },
            proposedState: {
              relationship: {
                trustLevel: "steady",
                dynamic: "warm",
              },
              activeThreads: [
                {
                  value: "meet at 7pm tomorrow",
                  status: "active",
                  confidence: "likely",
                },
                {
                  value: "meet at 9pm tomorrow",
                  status: "active",
                  confidence: "confirmed",
                  note: "the time was moved later",
                },
              ],
            },
            changes: [
              {
                sectionKey: "activeThreads",
                summary: "The meeting time changed.",
                evidence: ["They explicitly moved it to 9pm tomorrow."],
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
    expect(acceptRes.payload.state.activeThreads).toEqual([
      expect.objectContaining({
        value: "meet at 7pm tomorrow",
        status: "corrected",
        confidence: "likely",
        sourceChatId: "chat-old",
        updatedAt: 100,
        lastSeenAt: 100,
        timesSeen: 2,
      }),
      expect.objectContaining({
        value: "meet at 9pm tomorrow",
        status: "active",
        confidence: "confirmed",
        note: "the time was moved later",
        sourceChatId: chatId,
        sourceRange: {
          startMessageIndex: 0,
          endMessageIndex: 1,
        },
        updatedAt: acceptRes.payload.acceptedAt,
        lastSeenAt: acceptRes.payload.acceptedAt,
        timesSeen: 1,
      }),
    ]);
  });

  it("corrects multi-token fact replacements through handoff proposal creation", async () => {
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
          useGlobalDefaults: false,
          extractionProvider: "openrouter",
          extractionModel: "anthropic/claude-3.5-haiku",
          extractionMaxTokens: 2400,
          extractionPrompt: "prompt",
          currentStateVersion: 1,
          currentState: {
            relationship: {
              trustLevel: "steady",
              dynamic: "warm",
            },
            userFacts: [
              {
                value: "user moved to New York",
                status: "active",
                confidence: "likely",
                note: "older location",
                sourceChatId: "chat-old",
                updatedAt: 100,
                lastSeenAt: 100,
                timesSeen: 2,
              },
            ],
          },
          pendingProposal: null,
          stateVersions: [],
          lastProcessedChatId: null,
        },
      },
    });

    const { postHandlers } = buildHandlers({
      executeInternalLLMTextCompletion: async () => JSON.stringify({
        proposedState: {
          relationship: {
            trustLevel: "steady",
            dynamic: "warm",
          },
          userFacts: [
            {
              value: "user moved to New York",
              status: "active",
              confidence: "likely",
              note: "older location",
            },
            {
              value: "user moved to Los Angeles",
              status: "active",
              confidence: "confirmed",
              note: "explicit move in the processed range",
            },
          ],
        },
        changes: [
          {
            sectionKey: "userFacts",
            summary: "The user location was updated again.",
            evidence: ["They explicitly said they moved to Los Angeles."],
          },
        ],
      }),
    });
    const handoff = postHandlers.get("/data/character-evolution/handoff");
    expect(handoff).toBeTruthy();

    const handoffRes = createRes();
    await handoff!(createReq({ characterId, chatId }), handoffRes);

    expect(handoffRes.statusCode).toBe(200);
    expect(handoffRes.payload.proposal.proposedState.userFacts).toEqual([
      expect.objectContaining({
        value: "user moved to New York",
        status: "corrected",
        confidence: "likely",
        note: "older location",
        sourceChatId: "chat-old",
        updatedAt: 100,
        lastSeenAt: 100,
        timesSeen: 2,
      }),
      expect.objectContaining({
        value: "user moved to Los Angeles",
        status: "active",
        confidence: "confirmed",
        note: "explicit move in the processed range",
        sourceChatId: chatId,
        sourceRange: {
          startMessageIndex: 0,
          endMessageIndex: 1,
        },
        updatedAt: expect.any(Number),
        lastSeenAt: expect.any(Number),
        timesSeen: 1,
      }),
    ]);
  });

  it("corrects conflicting preference reversals during handoff proposal creation", async () => {
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
          useGlobalDefaults: false,
          extractionProvider: "openrouter",
          extractionModel: "anthropic/claude-3.5-haiku",
          extractionMaxTokens: 2400,
          extractionPrompt: "prompt",
          currentStateVersion: 1,
          currentState: {
            relationship: {
              trustLevel: "steady",
              dynamic: "warm",
            },
            userLikes: [
              {
                value: "user prefers sci fi over fantasy",
                status: "active",
                confidence: "likely",
                note: "older preference call",
              },
            ],
          },
          pendingProposal: null,
          stateVersions: [],
          lastProcessedChatId: null,
        },
      },
    });

    const { postHandlers } = buildHandlers({
      executeInternalLLMTextCompletion: async () => JSON.stringify({
        proposedState: {
          relationship: {
            trustLevel: "steady",
            dynamic: "warm",
          },
          userLikes: [
            {
              value: "user prefers sci fi over fantasy",
              status: "active",
              confidence: "likely",
              note: "older preference call",
            },
            {
              value: "user prefers fantasy over sci fi",
              status: "active",
              confidence: "confirmed",
              note: "they explicitly reversed the preference",
            },
          ],
        },
        changes: [
          {
            sectionKey: "userLikes",
            summary: "The user preference reversed.",
            evidence: ["They said they now prefer fantasy over sci fi."],
          },
        ],
      }),
    });
    const handoff = postHandlers.get("/data/character-evolution/handoff");
    expect(handoff).toBeTruthy();

    const handoffRes = createRes();
    await handoff!(createReq({ characterId, chatId }), handoffRes);

    expect(handoffRes.statusCode).toBe(200);
    expect(handoffRes.payload.proposal.proposedState.userLikes).toEqual([
      expect.objectContaining({
        value: "user prefers sci fi over fantasy",
        status: "corrected",
        confidence: "likely",
        note: "older preference call",
      }),
      expect.objectContaining({
        value: "user prefers fantasy over sci fi",
        status: "active",
        confidence: "confirmed",
        note: "they explicitly reversed the preference",
      }),
    ]);
  });

  it("merges stronger-evidence refinements through accept instead of keeping a duplicate active row", async () => {
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
          useGlobalDefaults: false,
          extractionProvider: "openrouter",
          extractionModel: "anthropic/claude-3.5-haiku",
          extractionMaxTokens: 2400,
          extractionPrompt: "prompt",
          currentStateVersion: 1,
          currentState: {
            relationship: {
              trustLevel: "steady",
              dynamic: "warm",
            },
            userFacts: [
              {
                value: "user moved to New York",
                status: "active",
                confidence: "likely",
                note: "older accepted phrasing",
                sourceChatId: "chat-old",
                sourceRange: {
                  startMessageIndex: 1,
                  endMessageIndex: 3,
                },
                updatedAt: 100,
                lastSeenAt: 100,
                timesSeen: 2,
              },
            ],
          },
          pendingProposal: {
            proposalId: "proposal-phase4-refinement-merge",
            sourceChatId: chatId,
            sourceRange: {
              chatId,
              startMessageIndex: 0,
              endMessageIndex: 1,
            },
            proposedState: {
              relationship: {
                trustLevel: "steady",
                dynamic: "warm",
              },
              userFacts: [
                {
                  value: "user moved to New York",
                  status: "active",
                  confidence: "likely",
                  note: "older accepted phrasing",
                },
                {
                  value: "user moved to New York last year",
                  status: "active",
                  confidence: "confirmed",
                  note: "new stronger timing detail",
                },
              ],
            },
            changes: [
              {
                sectionKey: "userFacts",
                summary: "The timing detail became more explicit.",
                evidence: ["They clarified it happened last year."],
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
    expect(acceptRes.payload.state.userFacts).toEqual([
      expect.objectContaining({
        value: "user moved to New York last year",
        status: "active",
        confidence: "confirmed",
        note: "new stronger timing detail",
        sourceChatId: chatId,
        sourceRange: {
          startMessageIndex: 0,
          endMessageIndex: 1,
        },
        updatedAt: acceptRes.payload.acceptedAt,
        lastSeenAt: acceptRes.payload.acceptedAt,
        timesSeen: 3,
      }),
    ]);
  });

  it("corrects opposite same-domain preference polarity during handoff proposal creation", async () => {
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
          useGlobalDefaults: false,
          extractionProvider: "openrouter",
          extractionModel: "anthropic/claude-3.5-haiku",
          extractionMaxTokens: 2400,
          extractionPrompt: "prompt",
          currentStateVersion: 1,
          currentState: {
            relationship: {
              trustLevel: "steady",
              dynamic: "warm",
            },
            userDislikes: [
              {
                value: "user dislikes AI roleplay",
                status: "active",
                confidence: "likely",
                note: "older preference call",
              },
            ],
          },
          pendingProposal: null,
          stateVersions: [],
          lastProcessedChatId: null,
        },
      },
    });

    const { postHandlers } = buildHandlers({
      executeInternalLLMTextCompletion: async () => JSON.stringify({
        proposedState: {
          relationship: {
            trustLevel: "steady",
            dynamic: "warm",
          },
          userDislikes: [
            {
              value: "user dislikes AI roleplay",
              status: "active",
              confidence: "likely",
              note: "older preference call",
            },
            {
              value: "user is actively building and enjoying AI roleplay UI",
              status: "active",
              confidence: "confirmed",
              note: "new contradictory evidence in the processed range",
            },
          ],
        },
        changes: [
          {
            sectionKey: "userDislikes",
            summary: "The user's stance on AI roleplay changed.",
            evidence: ["They were actively building and enjoying AI roleplay UI."],
          },
        ],
      }),
    });
    const handoff = postHandlers.get("/data/character-evolution/handoff");
    expect(handoff).toBeTruthy();

    const handoffRes = createRes();
    await handoff!(createReq({ characterId, chatId }), handoffRes);

    expect(handoffRes.statusCode).toBe(200);
    expect(handoffRes.payload.proposal.proposedState.userDislikes).toEqual([
      expect.objectContaining({
        value: "user dislikes AI roleplay",
        status: "corrected",
        confidence: "likely",
        note: "older preference call",
      }),
      expect.objectContaining({
        value: "user is actively building and enjoying AI roleplay UI",
        status: "active",
        confidence: "confirmed",
        note: "new contradictory evidence in the processed range",
      }),
    ]);
  });

  it("collapses stronger-evidence refinements during handoff proposal creation", async () => {
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
          useGlobalDefaults: false,
          extractionProvider: "openrouter",
          extractionModel: "anthropic/claude-3.5-haiku",
          extractionMaxTokens: 2400,
          extractionPrompt: "prompt",
          currentStateVersion: 1,
          currentState: {
            relationship: {
              trustLevel: "steady",
              dynamic: "warm",
            },
            userFacts: [
              {
                value: "user moved to New York",
                status: "active",
                confidence: "likely",
                note: "older accepted phrasing",
                sourceChatId: "chat-old",
                updatedAt: 100,
                lastSeenAt: 100,
                timesSeen: 2,
              },
            ],
          },
          pendingProposal: null,
          stateVersions: [],
          lastProcessedChatId: null,
        },
      },
    });

    const { postHandlers } = buildHandlers({
      executeInternalLLMTextCompletion: async () => JSON.stringify({
        proposedState: {
          relationship: {
            trustLevel: "steady",
            dynamic: "warm",
          },
          userFacts: [
            {
              value: "user moved to New York",
              status: "active",
              confidence: "likely",
              note: "older accepted phrasing",
            },
            {
              value: "user moved to New York last year",
              status: "active",
              confidence: "confirmed",
              note: "new stronger timing detail",
            },
          ],
        },
        changes: [
          {
            sectionKey: "userFacts",
            summary: "The move timing detail became more explicit.",
            evidence: ["They clarified they moved last year."],
          },
        ],
      }),
    });
    const handoff = postHandlers.get("/data/character-evolution/handoff");
    expect(handoff).toBeTruthy();

    const handoffRes = createRes();
    await handoff!(createReq({ characterId, chatId }), handoffRes);

    expect(handoffRes.statusCode).toBe(200);
    expect(handoffRes.payload.proposal.proposedState.userFacts).toEqual([
      expect.objectContaining({
        value: "user moved to New York last year",
        status: "active",
        confidence: "confirmed",
        note: "new stronger timing detail",
        sourceChatId: chatId,
        sourceRange: {
          startMessageIndex: 0,
          endMessageIndex: 1,
        },
        updatedAt: expect.any(Number),
        lastSeenAt: expect.any(Number),
        timesSeen: 3,
      }),
    ]);
  });

  it("re-applies opposite-polarity preference correction on accept", async () => {
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
          useGlobalDefaults: false,
          extractionProvider: "openrouter",
          extractionModel: "anthropic/claude-3.5-haiku",
          extractionMaxTokens: 2400,
          extractionPrompt: "prompt",
          currentStateVersion: 1,
          currentState: {
            relationship: {
              trustLevel: "steady",
              dynamic: "warm",
            },
            userLikes: [
              {
                value: "user likes tea",
                status: "active",
                confidence: "likely",
                note: "older preference call",
                sourceChatId: "chat-old",
                updatedAt: 100,
                lastSeenAt: 100,
                timesSeen: 2,
              },
            ],
          },
          pendingProposal: {
            proposalId: "proposal-phase4-opposite-polarity-accept",
            sourceChatId: chatId,
            sourceRange: {
              chatId,
              startMessageIndex: 0,
              endMessageIndex: 1,
            },
            proposedState: {
              relationship: {
                trustLevel: "steady",
                dynamic: "warm",
              },
              userLikes: [
                {
                  value: "user likes tea",
                  status: "active",
                  confidence: "likely",
                  note: "older preference call",
                },
                {
                  value: "user dislikes tea",
                  status: "active",
                  confidence: "confirmed",
                  note: "new contradictory evidence in the processed range",
                },
              ],
            },
            changes: [
              {
                sectionKey: "userLikes",
                summary: "The user's tea preference reversed.",
                evidence: ["They explicitly said they dislike tea now."],
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
    expect(acceptRes.payload.state.userLikes).toEqual([
      expect.objectContaining({
        value: "user likes tea",
        status: "corrected",
        confidence: "likely",
        note: "older preference call",
        sourceChatId: "chat-old",
        updatedAt: 100,
        lastSeenAt: 100,
        timesSeen: 2,
      }),
      expect.objectContaining({
        value: "user dislikes tea",
        status: "active",
        confidence: "confirmed",
        note: "new contradictory evidence in the processed range",
        sourceChatId: chatId,
        sourceRange: {
          startMessageIndex: 0,
          endMessageIndex: 1,
        },
        updatedAt: acceptRes.payload.acceptedAt,
        lastSeenAt: acceptRes.payload.acceptedAt,
        timesSeen: 1,
      }),
    ]);
  });
});
