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

describe("evolution routes phase 3 promotion", () => {
  it("preserves provenance metadata when accepting a lifecycle status transition on an existing item", async () => {
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
                value: "keep the ferry plan alive",
                status: "active",
                confidence: "likely",
                note: "Still unresolved before this accept",
                sourceChatId: "chat-old",
                sourceRange: {
                  startMessageIndex: 1,
                  endMessageIndex: 3,
                },
                updatedAt: 100,
                lastSeenAt: 120,
                timesSeen: 2,
              },
            ],
          },
          pendingProposal: {
            proposalId: "proposal-archive-1",
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
                  value: "keep the ferry plan alive",
                  status: "archived",
                  confidence: "likely",
                  note: "Resolved in the latest chat",
                },
              ],
            },
            changes: [
              {
                sectionKey: "activeThreads",
                summary: "The ferry plan is now resolved.",
                evidence: ["They agreed it was finished and no longer pending."],
              },
            ],
            createdAt: 1,
          },
          stateVersions: [
            {
              version: 1,
              chatId: "chat-old",
              acceptedAt: 120,
            },
          ],
          lastProcessedChatId: "chat-old",
          lastProcessedMessageIndexByChat: {
            "chat-old": 3,
          },
          processedRanges: [],
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
        activeThreads: [
          expect.objectContaining({
            value: "keep the ferry plan alive",
            status: "archived",
            note: "Resolved in the latest chat",
            sourceChatId: "chat-old",
            sourceRange: {
              startMessageIndex: 1,
              endMessageIndex: 3,
            },
            updatedAt: 100,
            lastSeenAt: 120,
            timesSeen: 2,
          }),
        ],
      }),
    }));
  });

  it("updates reinforcement metadata through the accept route when a pending proposal matches an active item", async () => {
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
                value: "meet again at the station",
                status: "active",
                confidence: "suspected",
                note: "earlier light read",
                sourceChatId: "chat-old",
                sourceRange: {
                  startMessageIndex: 1,
                  endMessageIndex: 2,
                },
                updatedAt: 100,
                lastSeenAt: 100,
                timesSeen: 1,
              },
            ],
          },
          pendingProposal: {
            proposalId: "proposal-reinforce-thread",
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
                  value: "meet again at the station",
                  status: "active",
                  confidence: "likely",
                  note: "reconfirmed in the newest accepted range",
                },
              ],
            },
            changes: [
              {
                sectionKey: "activeThreads",
                summary: "The station plan was reinforced again.",
                evidence: ["They explicitly agreed to meet again at the station."],
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
        value: "meet again at the station",
        status: "active",
        confidence: "likely",
        note: "reconfirmed in the newest accepted range",
        sourceChatId: chatId,
        sourceRange: {
          startMessageIndex: 0,
          endMessageIndex: 1,
        },
        updatedAt: acceptRes.payload.acceptedAt,
        lastSeenAt: acceptRes.payload.acceptedAt,
        timesSeen: 2,
      }),
    ]);
  });

  it("does not count normalized formatting-only matches as repeat evidence through the accept route", async () => {
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
                value: "Dead Man",
                status: "active",
                confidence: "likely",
                sourceChatId: "chat-old",
                sourceRange: {
                  startMessageIndex: 2,
                  endMessageIndex: 5,
                },
                updatedAt: 120,
                lastSeenAt: 120,
                timesSeen: 2,
              },
            ],
          },
          pendingProposal: {
            proposalId: "proposal-format-only-like",
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
              characterLikes: [
                {
                  value: "dead-man!",
                  status: "active",
                  confidence: "likely",
                },
              ],
            },
            changes: [
              {
                sectionKey: "characterLikes",
                summary: "The same like was restated with different formatting.",
                evidence: ["The wording repeated the same title with punctuation differences only."],
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
    expect(acceptRes.payload.state.characterLikes).toEqual([
      expect.objectContaining({
        value: "dead-man!",
        status: "active",
        confidence: "likely",
        sourceChatId: "chat-old",
        sourceRange: {
          startMessageIndex: 2,
          endMessageIndex: 5,
        },
        updatedAt: 120,
        lastSeenAt: 120,
        timesSeen: 2,
      }),
    ]);
  });
});
