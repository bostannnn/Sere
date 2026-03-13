import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

describe("evolution routes versioning migration", () => {
  it("normalizes legacy string-array snapshots when loading a saved version", async () => {
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
          },
          stateVersions: [
            {
              version: 1,
              chatId: "chat-old",
              acceptedAt: 100,
            },
          ],
        },
      },
    });
    writeJson(path.join(dataDirs.characters, characterId, "states", "v1.json"), {
      version: 1,
      chatId: "chat-old",
      acceptedAt: 100,
      state: {
        relationship: {
          trustLevel: "steady",
          dynamic: "warm",
        },
        activeThreads: ["keep the ferry plan alive"],
      },
    });

    const { getHandlers } = buildHandlers();
    const getVersion = getHandlers.get("/data/character-evolution/:charId/versions/:version");
    expect(getVersion).toBeTruthy();

    const getRes = createRes();
    await getVersion!({
      method: "GET",
      originalUrl: "/data/character-evolution/test",
      body: {},
      params: { charId: characterId, version: "1" },
    }, getRes);

    expect(getRes.statusCode).toBe(200);
    expect(getRes.payload.version.state.activeThreads).toEqual([
      {
        value: "keep the ferry plan alive",
        status: "active",
      },
    ]);
  });

  it("migrates a legacy phase 1 state through handoff accept and retains archived history on the next accept", async () => {
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
          currentStateVersion: 0,
          currentState: {
            relationship: {
              trustLevel: "",
              dynamic: "",
            },
            characterLikes: [
              "Stalker",
            ],
            keyMoments: [
              "Eva framed movies as emotional landmarks.",
            ],
            lastChatEnded: {
              state: "close and reflective",
              residue: "film talk should carry forward",
            },
          },
          stateVersions: [],
          lastProcessedChatId: null,
          processedRanges: [],
          lastProcessedMessageIndexByChat: {},
        },
      },
    });
    writeJson(path.join(dataDirs.characters, characterId, "chats", `${chatId}.json`), {
      chat: {
        id: chatId,
        message: [
          { role: "user", data: "What films matter to you most?" },
          { role: "char", data: "Stalker and Dead Man feel closest to my bloodstream." },
          { role: "user", data: "What about Dead Man next time?" },
          { role: "char", data: "We can revisit Stalker; Dead Man feels like history now." },
        ],
      },
    });

    let llmCallCount = 0;
    const { postHandlers } = buildHandlers({
      executeInternalLLMTextCompletion: async () => {
        llmCallCount += 1;
        if (llmCallCount === 1) {
          return JSON.stringify({
            proposedState: {
              relationship: {
                trustLevel: "warmer",
                dynamic: "films became a real bridge",
              },
              characterLikes: [
                "Stalker",
                "Dead Man",
              ],
              keyMoments: [
                "Eva explicitly tied Stalker and Dead Man to how she sees herself.",
              ],
              lastChatEnded: {
                state: "close and reflective",
                residue: "the shared movie language should carry into the next chat",
              },
            },
            changes: [
              {
                sectionKey: "characterLikes",
                summary: "Films became explicit durable likes.",
                evidence: ["Eva named Stalker and Dead Man as central films."],
              },
              {
                sectionKey: "keyMoments",
                summary: "The film exchange became a notable moment.",
                evidence: ["The conversation made the movie discussion emotionally significant."],
              },
            ],
          });
        }

        return JSON.stringify({
          proposedState: {
            relationship: {
              trustLevel: "warmer",
              dynamic: "films became a real bridge",
            },
            characterLikes: [
              {
                value: "Stalker",
                status: "active",
                confidence: "confirmed",
                note: "still live in current taste",
              },
            ],
            keyMoments: [
              {
                value: "Eva shifted Dead Man into history while keeping Stalker current.",
                confidence: "likely",
                status: "active",
                note: "second-pass active-only proposal",
              },
            ],
            lastInteractionEnded: {
              state: "more settled and selective",
              residue: "Stalker remains current; Dead Man reads as older history",
            },
          },
          changes: [
            {
              sectionKey: "keyMoments",
              summary: "The follow-up clarified which movie remains current.",
              evidence: ["Eva said Dead Man feels like history now."],
            },
          ],
        });
      },
    });
    const handoff = postHandlers.get("/data/character-evolution/handoff");
    const accept = postHandlers.get("/data/character-evolution/:charId/proposal/accept");
    expect(handoff).toBeTruthy();
    expect(accept).toBeTruthy();

    const firstHandoffRes = createRes();
    await handoff!(
      createReq({
        characterId,
        chatId,
        sourceRange: {
          chatId,
          startMessageIndex: 0,
          endMessageIndex: 1,
        },
      }),
      firstHandoffRes,
    );
    expect(firstHandoffRes.statusCode).toBe(200);

    const firstCharacterFile = JSON.parse(
      readFileSync(path.join(dataDirs.characters, characterId, "character.json"), "utf-8"),
    );
    const firstPendingState = structuredClone(
      firstCharacterFile.character.characterEvolution.pendingProposal.proposedState,
    );
    firstPendingState.characterLikes = firstPendingState.characterLikes.map((item: Record<string, unknown>) =>
      item.value === "Dead Man"
        ? { ...item, status: "archived", note: "review archived after acceptance" }
        : item,
    );

    const firstAcceptRes = createRes();
    await accept!(
      createReq({ proposedState: firstPendingState }, { charId: characterId }),
      firstAcceptRes,
    );
    expect(firstAcceptRes.statusCode).toBe(200);
    expect(firstAcceptRes.payload.state.lastInteractionEnded).toEqual({
      state: "close and reflective",
      residue: "the shared movie language should carry into the next chat",
    });
    expect(firstAcceptRes.payload.state.keyMoments).toEqual([
      expect.objectContaining({
        value: "Eva explicitly tied Stalker and Dead Man to how she sees herself.",
        status: "active",
      }),
    ]);

    const secondHandoffRes = createRes();
    await handoff!(
      createReq({
        characterId,
        chatId,
        sourceRange: {
          chatId,
          startMessageIndex: 2,
          endMessageIndex: 3,
        },
      }),
      secondHandoffRes,
    );
    expect(secondHandoffRes.statusCode).toBe(200);

    const secondAcceptRes = createRes();
    await accept!(createReq({}, { charId: characterId }), secondAcceptRes);
    expect(secondAcceptRes.statusCode).toBe(200);

    const finalCharacterFile = JSON.parse(
      readFileSync(path.join(dataDirs.characters, characterId, "character.json"), "utf-8"),
    );
    expect(finalCharacterFile.character.characterEvolution.currentState.characterLikes).toEqual([
      expect.objectContaining({
        value: "Stalker",
        status: "active",
      }),
      expect.objectContaining({
        value: "Dead Man",
        status: "archived",
        note: "review archived after acceptance",
      }),
    ]);
    expect(finalCharacterFile.character.characterEvolution.currentState.lastInteractionEnded).toEqual({
      state: "more settled and selective",
      residue: "Stalker remains current; Dead Man reads as older history",
    });
    expect(
      Object.prototype.hasOwnProperty.call(
        finalCharacterFile.character.characterEvolution.currentState,
        "lastChatEnded",
      ),
    ).toBe(false);
    expect(finalCharacterFile.character.characterEvolution.currentStateVersion).toBe(2);
    expect(finalCharacterFile.character.characterEvolution.processedRanges).toEqual([
      {
        version: 1,
        acceptedAt: expect.any(Number),
        range: {
          chatId,
          startMessageIndex: 0,
          endMessageIndex: 1,
        },
      },
      {
        version: 2,
        acceptedAt: expect.any(Number),
        range: {
          chatId,
          startMessageIndex: 2,
          endMessageIndex: 3,
        },
      },
    ]);
  });

  it("does not fabricate a cursor range when accepting a legacy pending proposal without sourceRange", async () => {
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
          currentStateVersion: 0,
          currentState: {
            relationship: {
              trustLevel: "steady",
              dynamic: "old dynamic",
            },
          },
          pendingProposal: {
            proposalId: "proposal-legacy",
            sourceChatId: chatId,
            proposedState: {
              relationship: {
                trustLevel: "higher",
                dynamic: "warmer",
              },
            },
            changes: [
              {
                sectionKey: "relationship",
                summary: "Relationship became warmer.",
                evidence: ["Character said they feel closer now."],
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
    expect(acceptRes.payload).toEqual(expect.not.objectContaining({
      range: expect.anything(),
    }));

    const characterFile = JSON.parse(readFileSync(path.join(dataDirs.characters, characterId, "character.json"), "utf-8"));
    expect(characterFile.character.characterEvolution.lastProcessedMessageIndexByChat ?? {}).toEqual({});
    expect(characterFile.character.characterEvolution.processedRanges ?? []).toEqual([]);

    const versionFile = JSON.parse(readFileSync(path.join(dataDirs.characters, characterId, "states", "v1.json"), "utf-8"));
    expect(versionFile.range ?? null).toBeNull();
  });
});
