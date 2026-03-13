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

describe("evolution routes phase 3 carry-forward", () => {
  it("does not count omitted optional fields on a matched carried-forward item as repeat evidence through the accept route", async () => {
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
                status: "active",
                confidence: "likely",
                note: "existing stable note",
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
            proposalId: "proposal-omitted-optional-fields",
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
                },
              ],
            },
            changes: [
              {
                sectionKey: "characterLikes",
                summary: "The same like was carried forward without optional metadata.",
                evidence: ["The accepted proposal preserved the item but omitted note and confidence."],
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
        note: "existing stable note",
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

  it("allows an explicit blank note to clear a matched active item's note through the accept route", async () => {
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
                status: "active",
                confidence: "suspected",
                note: "old note to clear",
                sourceChatId: "chat-old",
                sourceRange: {
                  startMessageIndex: 2,
                  endMessageIndex: 5,
                },
                updatedAt: 120,
                lastSeenAt: 120,
                timesSeen: 1,
              },
            ],
          },
          pendingProposal: {
            proposalId: "proposal-clear-note",
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
                  note: "   ",
                },
              ],
            },
            changes: [
              {
                sectionKey: "characterLikes",
                summary: "The note was intentionally cleared on the carried-forward item.",
                evidence: ["The accepted review removed the old note while keeping the same active item."],
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
        note: "",
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
});
