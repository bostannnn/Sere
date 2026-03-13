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

describe("evolution routes versioning history edits", () => {
  it("applies an explicit archived edit when a same-value active item remains in canonical state", async () => {
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
            characterLikes: [
              {
                value: "Dead Man",
                status: "archived",
                confidence: "confirmed",
                note: "older archived formulation",
                sourceChatId: "chat-old",
                sourceRange: {
                  startMessageIndex: 2,
                  endMessageIndex: 4,
                },
                updatedAt: 150,
                lastSeenAt: 170,
                timesSeen: 3,
              },
              {
                value: "Dead Man",
                status: "active",
                confidence: "confirmed",
                note: "current live formulation",
                sourceChatId: "chat-active",
                sourceRange: {
                  startMessageIndex: 6,
                  endMessageIndex: 8,
                },
                updatedAt: 220,
                lastSeenAt: 220,
                timesSeen: 2,
              },
            ],
          },
          pendingProposal: {
            proposalId: "proposal-edit-archived-history",
            sourceChatId: chatId,
            sourceRange: {
              chatId,
              startMessageIndex: 0,
              endMessageIndex: 1,
            },
            proposedState: {
              characterLikes: [
                {
                  value: "Dead Man",
                  status: "archived",
                  note: "older archived formulation clarified",
                },
                {
                  value: "Dead Man",
                  status: "active",
                  confidence: "confirmed",
                  note: "current live formulation",
                },
              ],
            },
            changes: [
              {
                sectionKey: "characterLikes",
                summary: "The archived history row was clarified while the active row stayed live.",
                evidence: ["Review refined the historical note without reviving the old preference."],
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
        value: "Dead Man",
        status: "archived",
        note: "older archived formulation clarified",
        sourceChatId: "chat-old",
        sourceRange: {
          startMessageIndex: 2,
          endMessageIndex: 4,
        },
        updatedAt: 150,
        lastSeenAt: 170,
        timesSeen: 3,
      }),
      expect.objectContaining({
        value: "Dead Man",
        status: "active",
        note: "current live formulation",
      }),
    ]);
  });

  it("applies an explicit corrected edit when a same-value active item remains in canonical state", async () => {
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
                value: "user hates ferries",
                status: "corrected",
                confidence: "confirmed",
                note: "older corrected formulation",
                sourceChatId: "chat-old",
                sourceRange: {
                  startMessageIndex: 3,
                  endMessageIndex: 5,
                },
                updatedAt: 210,
                lastSeenAt: 230,
                timesSeen: 4,
              },
              {
                value: "user hates ferries",
                status: "active",
                confidence: "confirmed",
                note: "current live formulation",
                sourceChatId: "chat-active",
                sourceRange: {
                  startMessageIndex: 6,
                  endMessageIndex: 7,
                },
                updatedAt: 240,
                lastSeenAt: 240,
                timesSeen: 2,
              },
            ],
          },
          pendingProposal: {
            proposalId: "proposal-edit-corrected-history",
            sourceChatId: chatId,
            sourceRange: {
              chatId,
              startMessageIndex: 0,
              endMessageIndex: 1,
            },
            proposedState: {
              activeThreads: [
                {
                  value: "user hates ferries",
                  status: "corrected",
                  note: "older corrected formulation clarified",
                },
                {
                  value: "user hates ferries",
                  status: "active",
                  confidence: "confirmed",
                  note: "current live formulation",
                },
              ],
            },
            changes: [
              {
                sectionKey: "activeThreads",
                summary: "The corrected history row was clarified while the active row stayed live.",
                evidence: ["Review refined the historical note without changing the current interpretation."],
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
        value: "user hates ferries",
        status: "corrected",
        note: "older corrected formulation clarified",
        sourceChatId: "chat-old",
        sourceRange: {
          startMessageIndex: 3,
          endMessageIndex: 5,
        },
        updatedAt: 210,
        lastSeenAt: 230,
        timesSeen: 4,
      }),
      expect.objectContaining({
        value: "user hates ferries",
        status: "active",
        note: "current live formulation",
      }),
    ]);
  });

  it("applies an explicit archived edit after normalized matching when a same-value active item remains live", async () => {
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
            characterLikes: [
              {
                value: "Dead Man",
                status: "archived",
                confidence: "confirmed",
                note: "older archived formulation",
                sourceChatId: "chat-old",
                sourceRange: {
                  startMessageIndex: 2,
                  endMessageIndex: 4,
                },
                updatedAt: 150,
                lastSeenAt: 170,
                timesSeen: 3,
              },
              {
                value: "Dead Man",
                status: "active",
                confidence: "confirmed",
                note: "current live formulation",
                sourceChatId: "chat-active",
                sourceRange: {
                  startMessageIndex: 6,
                  endMessageIndex: 8,
                },
                updatedAt: 220,
                lastSeenAt: 220,
                timesSeen: 2,
              },
            ],
          },
          pendingProposal: {
            proposalId: "proposal-edit-archived-history-normalized",
            sourceChatId: chatId,
            sourceRange: {
              chatId,
              startMessageIndex: 0,
              endMessageIndex: 1,
            },
            proposedState: {
              characterLikes: [
                {
                  value: "dead-man!",
                  status: "archived",
                  note: "older archived formulation clarified",
                },
                {
                  value: "Dead Man",
                  status: "active",
                  confidence: "confirmed",
                  note: "current live formulation",
                },
              ],
            },
            changes: [
              {
                sectionKey: "characterLikes",
                summary: "The archived history row was clarified with normalized matching.",
                evidence: ["Review changed punctuation only while refining the historical note."],
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
        status: "archived",
        note: "older archived formulation clarified",
        sourceChatId: "chat-old",
        sourceRange: {
          startMessageIndex: 2,
          endMessageIndex: 4,
        },
        updatedAt: 150,
        lastSeenAt: 170,
        timesSeen: 3,
      }),
      expect.objectContaining({
        value: "Dead Man",
        status: "active",
        note: "current live formulation",
      }),
    ]);
  });
});
