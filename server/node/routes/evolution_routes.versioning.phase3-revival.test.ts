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

describe("evolution routes phase 3 revival", () => {
  it("revives a normalized archived match through the accept route instead of keeping archived and active duplicates", async () => {
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
                status: "archived",
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
            proposalId: "proposal-revive-archived-like",
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
                  note: "brought back into the current flow",
                },
              ],
            },
            changes: [
              {
                sectionKey: "characterLikes",
                summary: "An archived like became active again.",
                evidence: ["They brought up Dead Man as an active current favorite again."],
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
        confidence: "confirmed",
        note: "brought back into the current flow",
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

  it("revives an exact archived match through the accept route instead of keeping archived and active duplicates", async () => {
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
                value: "Tea",
                status: "archived",
                confidence: "suspected",
                sourceChatId: "chat-old",
                sourceRange: {
                  startMessageIndex: 3,
                  endMessageIndex: 6,
                },
                updatedAt: 150,
                lastSeenAt: 150,
                timesSeen: 1,
              },
            ],
          },
          pendingProposal: {
            proposalId: "proposal-revive-archived-like-exact",
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
                  value: "Tea",
                  status: "active",
                  note: "now clearly active again",
                },
              ],
            },
            changes: [
              {
                sectionKey: "characterLikes",
                summary: "An archived like was reintroduced directly.",
                evidence: ["They explicitly said Tea is back in the current favorites."],
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
        value: "Tea",
        status: "active",
        confidence: "likely",
        note: "now clearly active again",
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

  it("preserves provenance metadata when accepting an active-to-corrected transition on an existing item", async () => {
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
                value: "user hates ferries",
                status: "active",
                confidence: "suspected",
                note: "Earlier rough interpretation",
                sourceChatId: "chat-old",
                sourceRange: {
                  startMessageIndex: 2,
                  endMessageIndex: 4,
                },
                updatedAt: 150,
                lastSeenAt: 170,
                timesSeen: 3,
              },
            ],
          },
          pendingProposal: {
            proposalId: "proposal-correct-1",
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
                  value: "user hates ferries",
                  status: "corrected",
                  confidence: "confirmed",
                  note: "They clarified they only hate crowded ferry terminals",
                },
              ],
            },
            changes: [
              {
                sectionKey: "activeThreads",
                summary: "The earlier ferry read was corrected.",
                evidence: ["They said ferries are fine, but crowded terminals stress them out."],
              },
            ],
            createdAt: 1,
          },
          stateVersions: [
            {
              version: 1,
              chatId: "chat-old",
              acceptedAt: 170,
            },
          ],
          lastProcessedChatId: "chat-old",
          lastProcessedMessageIndexByChat: {
            "chat-old": 4,
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
            value: "user hates ferries",
            status: "corrected",
            confidence: "confirmed",
            note: "They clarified they only hate crowded ferry terminals",
            sourceChatId: "chat-old",
            sourceRange: {
              startMessageIndex: 2,
              endMessageIndex: 4,
            },
            updatedAt: 150,
            lastSeenAt: 170,
            timesSeen: 3,
          }),
        ],
      }),
    }));
  });
});
