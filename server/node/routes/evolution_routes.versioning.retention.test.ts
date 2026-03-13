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

describe("evolution routes versioning retention", () => {
  it("keeps archived items in canonical state when a later active-only proposal omits them", async () => {
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
                value: "Stalker",
                status: "active",
                confidence: "confirmed",
              },
              {
                value: "Dead Man",
                status: "archived",
                confidence: "confirmed",
                sourceChatId: "chat-old",
              },
              {
                value: "Texas Chain Saw",
                status: "active",
                confidence: "confirmed",
              },
            ],
          },
          pendingProposal: {
            proposalId: "proposal-retain-archived",
            sourceChatId: chatId,
            sourceRange: {
              chatId,
              startMessageIndex: 0,
              endMessageIndex: 1,
            },
            proposedState: {
              characterLikes: [
                {
                  value: "Stalker",
                  status: "active",
                  confidence: "confirmed",
                },
                {
                  value: "Texas Chain Saw",
                  status: "active",
                  confidence: "confirmed",
                },
              ],
            },
            changes: [
              {
                sectionKey: "characterLikes",
                summary: "No new like changes.",
                evidence: ["The scene focused on current movie plans."],
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
        value: "Stalker",
        status: "active",
      }),
      expect.objectContaining({
        value: "Dead Man",
        status: "archived",
        sourceChatId: "chat-old",
      }),
      expect.objectContaining({
        value: "Texas Chain Saw",
        status: "active",
      }),
    ]);
  });

  it("keeps corrected items in canonical state when a later active-only proposal omits them", async () => {
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
                sourceChatId: "chat-old",
              },
              {
                value: "user dislikes ferry terminals",
                status: "active",
                confidence: "confirmed",
              },
            ],
          },
          pendingProposal: {
            proposalId: "proposal-retain-corrected",
            sourceChatId: chatId,
            sourceRange: {
              chatId,
              startMessageIndex: 0,
              endMessageIndex: 1,
            },
            proposedState: {
              activeThreads: [
                {
                  value: "user dislikes ferry terminals",
                  status: "active",
                  confidence: "confirmed",
                },
              ],
            },
            changes: [
              {
                sectionKey: "activeThreads",
                summary: "No corrected-thread deletion should occur.",
                evidence: ["The clarified ferry-terminal preference remains current."],
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
        sourceChatId: "chat-old",
      }),
      expect.objectContaining({
        value: "user dislikes ferry terminals",
        status: "active",
      }),
    ]);
  });

  it("preserves same-value archived history when a matching active item remains in canonical state", async () => {
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
              },
            ],
          },
          pendingProposal: {
            proposalId: "proposal-preserve-same-value-archive",
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
                  status: "active",
                  confidence: "confirmed",
                  note: "current live formulation updated",
                },
              ],
            },
            changes: [
              {
                sectionKey: "characterLikes",
                summary: "Current live formulation was refined.",
                evidence: ["The same favorite film came up again with clearer wording."],
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
        note: "older archived formulation",
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
        note: "current live formulation updated",
      }),
    ]);
  });

  it("preserves same-value corrected history when a matching active item remains in canonical state", async () => {
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
              },
            ],
          },
          pendingProposal: {
            proposalId: "proposal-preserve-same-value-corrected",
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
                  status: "active",
                  confidence: "confirmed",
                  note: "current live formulation updated",
                },
              ],
            },
            changes: [
              {
                sectionKey: "activeThreads",
                summary: "Current live formulation was refined.",
                evidence: ["The same ferry read came up again with clearer wording."],
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
        note: "older corrected formulation",
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
        note: "current live formulation updated",
      }),
    ]);
  });
});
