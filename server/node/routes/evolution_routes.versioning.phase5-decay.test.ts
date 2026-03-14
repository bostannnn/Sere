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

describe("evolution routes phase 5 decay", () => {
  it("overwrites lastInteractionEnded on accept even when the pending proposal omits it", async () => {
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
            lastInteractionEnded: {
              state: "they went to bed tangled together",
              residue: "sleepy sweetness",
            },
          },
          pendingProposal: {
            proposalId: "proposal-phase5-last-ended",
            sourceChatId: chatId,
            sourceRange: {
              chatId,
              startMessageIndex: 0,
              endMessageIndex: 1,
            },
            proposedState: {
              relationship: {
                trustLevel: "steady",
                dynamic: "warmer after the talk",
              },
            },
            changes: [
              {
                sectionKey: "relationship",
                summary: "The relationship remains warm.",
                evidence: ["They ended the range on a calmer note."],
              },
            ],
            createdAt: 100,
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
    expect(acceptRes.payload.state).toEqual(expect.objectContaining({
      lastInteractionEnded: {
        state: "",
        residue: "",
      },
      relationship: {
        trustLevel: "steady",
        dynamic: "warmer after the talk",
      },
    }));
  });

  it("decays the merged canonical state instead of a bounded prompt projection", async () => {
    const dataDirs = getDataDirs();
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
          promptProjection: {
            rankings: {
              fast: ["lastSeenAt", "updatedAt", "timesSeen", "confidence"],
              medium: ["lastSeenAt", "timesSeen", "confidence", "updatedAt"],
              slow: ["confidence", "timesSeen", "lastSeenAt", "updatedAt"],
            },
            limits: {
              generation: {
                activeThreads: 1,
                runningJokes: 1,
                characterLikes: 2,
                characterDislikes: 2,
                characterHabits: 2,
                characterBoundariesPreferences: 2,
                userFacts: 2,
                userRead: 2,
                userLikes: 2,
                userDislikes: 2,
                keyMoments: 1,
                characterIntimatePreferences: 1,
                userIntimatePreferences: 1,
              },
              extraction: {
                activeThreads: 1,
                runningJokes: 1,
                characterLikes: 2,
                characterDislikes: 2,
                characterHabits: 2,
                characterBoundariesPreferences: 2,
                userFacts: 2,
                userRead: 2,
                userLikes: 2,
                userDislikes: 2,
                keyMoments: 1,
                characterIntimatePreferences: 1,
                userIntimatePreferences: 1,
              },
            },
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
          currentStateVersion: 1,
          currentState: {
            relationship: {
              trustLevel: "high",
              dynamic: "steady and flirty",
            },
            activeThreads: [
              {
                value: "book the train to Kazan",
                status: "active",
                confidence: "suspected",
                note: "freshly resurfaced in this range",
                lastSeenVersion: 1,
                unseenAcceptedHandoffs: 0,
              },
              {
                value: "follow up on the old gallery invite",
                status: "active",
                confidence: "likely",
                note: "older unresolved thread",
                lastSeenVersion: 1,
                unseenAcceptedHandoffs: 1,
              },
            ],
          },
          pendingProposal: {
            proposalId: "proposal-phase5-canonical",
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
                  note: "confirmed again in the accepted range",
                },
              ],
            },
            changes: [
              {
                sectionKey: "activeThreads",
                summary: "The active next-step remains the train booking.",
                evidence: ["They explicitly returned to the train booking."],
              },
            ],
            createdAt: 100,
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
    expect(acceptRes.payload.state.relationship).toEqual({
      trustLevel: "high",
      dynamic: "steady and flirty",
    });
    expect(acceptRes.payload.state.activeThreads).toEqual([
      expect.objectContaining({
        value: "book the train to Kazan",
        status: "active",
        unseenAcceptedHandoffs: 0,
      }),
      expect.objectContaining({
        value: "follow up on the old gallery invite",
        status: "archived",
        unseenAcceptedHandoffs: 2,
      }),
    ]);
  });

  it("advances decay for omitted sections when they were not reinforced by the accepted handoff", async () => {
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
            activeThreads: [
              {
                value: "buy the concert tickets",
                status: "active",
                confidence: "likely",
                lastSeenVersion: 1,
                unseenAcceptedHandoffs: 1,
              },
            ],
            userFacts: [
              {
                value: "user is switching jobs",
                status: "active",
                confidence: "likely",
                lastSeenVersion: 1,
                unseenAcceptedHandoffs: 0,
              },
            ],
          },
          pendingProposal: {
            proposalId: "proposal-phase5-omitted",
            sourceChatId: chatId,
            sourceRange: {
              chatId,
              startMessageIndex: 0,
              endMessageIndex: 1,
            },
            proposedState: {
              userFacts: [
                {
                  value: "user is switching jobs",
                  status: "active",
                  confidence: "confirmed",
                  note: "stated clearly again in this range",
                },
              ],
            },
            changes: [
              {
                sectionKey: "userFacts",
                summary: "The job change was reinforced.",
                evidence: ["They said the switch is definitely happening."],
              },
            ],
            createdAt: 100,
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
        value: "buy the concert tickets",
        status: "archived",
        unseenAcceptedHandoffs: 2,
      }),
    ]);
    expect(acceptRes.payload.state.userFacts).toEqual([
      expect.objectContaining({
        value: "user is switching jobs",
        status: "active",
        unseenAcceptedHandoffs: 0,
      }),
    ]);
  });

  it("keeps confirmed slow items active after repeated unseen accepted handoffs", async () => {
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
          currentStateVersion: 8,
          currentState: {
            characterLikes: [
              {
                value: "quiet museums",
                status: "active",
                confidence: "confirmed",
                lastSeenVersion: 8,
                unseenAcceptedHandoffs: 8,
              },
            ],
          },
          pendingProposal: {
            proposalId: "proposal-phase5-confirmed-slow",
            sourceChatId: chatId,
            sourceRange: {
              chatId,
              startMessageIndex: 0,
              endMessageIndex: 1,
            },
            proposedState: {
              relationship: {
                trustLevel: "",
                dynamic: "",
              },
            },
            changes: [
              {
                sectionKey: "relationship",
                summary: "No durable slow-memory change.",
                evidence: ["The range did not revisit museum preferences."],
              },
            ],
            createdAt: 100,
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
    expect(acceptRes.payload.state.characterLikes).toEqual([
      expect.objectContaining({
        value: "quiet museums",
        status: "active",
        confidence: "confirmed",
        unseenAcceptedHandoffs: 9,
      }),
    ]);
  });

  it("archives medium sections after 5 unseen accepted handoffs without decaying relationship", async () => {
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
          currentStateVersion: 5,
          currentState: {
            relationship: {
              trustLevel: "high",
              dynamic: "stable and affectionate",
            },
            userRead: [
              {
                value: "she seemed relieved after the deadline passed",
                status: "active",
                confidence: "likely",
                lastSeenVersion: 1,
                unseenAcceptedHandoffs: 4,
              },
            ],
          },
          pendingProposal: {
            proposalId: "proposal-phase5-medium-route",
            sourceChatId: chatId,
            sourceRange: {
              chatId,
              startMessageIndex: 0,
              endMessageIndex: 1,
            },
            proposedState: {
              userFacts: [
                {
                  value: "user has a new team lead",
                  status: "active",
                  confidence: "likely",
                },
              ],
            },
            changes: [
              {
                sectionKey: "userFacts",
                summary: "A new team lead was mentioned.",
                evidence: ["The user described their new manager."],
              },
            ],
            createdAt: 100,
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
    expect(acceptRes.payload.state.relationship).toEqual({
      trustLevel: "high",
      dynamic: "stable and affectionate",
    });
    expect(acceptRes.payload.state.userRead).toEqual([
      expect.objectContaining({
        value: "she seemed relieved after the deadline passed",
        status: "archived",
        unseenAcceptedHandoffs: 5,
      }),
    ]);
    expect(acceptRes.payload.state.userFacts).toEqual([
      expect.objectContaining({
        value: "user has a new team lead",
        status: "active",
        unseenAcceptedHandoffs: 0,
      }),
    ]);
  });

  it("treats repeated unchanged active items as seen for decay on accept", async () => {
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
            activeThreads: [
              {
                value: "meet again at the station",
                status: "active",
                confidence: "likely",
                note: "stable standing plan",
                lastSeenVersion: 1,
                unseenAcceptedHandoffs: 1,
                updatedAt: 100,
                lastSeenAt: 100,
                timesSeen: 2,
              },
            ],
          },
          pendingProposal: {
            proposalId: "proposal-phase5-unchanged-repeat",
            sourceChatId: chatId,
            sourceRange: {
              chatId,
              startMessageIndex: 0,
              endMessageIndex: 1,
            },
            proposedState: {
              activeThreads: [
                {
                  value: "meet again at the station",
                  status: "active",
                  confidence: "likely",
                  note: "stable standing plan",
                },
              ],
            },
            changes: [
              {
                sectionKey: "activeThreads",
                summary: "The station plan was repeated without a wording change.",
                evidence: ["They again agreed to meet at the station."],
              },
            ],
            createdAt: 100,
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
        value: "meet again at the station",
        status: "active",
        confidence: "likely",
        note: "stable standing plan",
        lastSeenVersion: 2,
        unseenAcceptedHandoffs: 0,
        updatedAt: 100,
        lastSeenAt: 100,
        timesSeen: 2,
      }),
    ]);
  });
});
