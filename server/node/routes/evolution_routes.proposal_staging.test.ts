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

describe("evolution routes proposal staging", () => {
  it("accepts legacy lastChatEnded proposal aliases during handoff staging", async () => {
    const { postHandlers } = buildHandlers({
      executeInternalLLMTextCompletion: async () => JSON.stringify({
        proposedState: {
          lastChatEnded: {
            state: "ended awkwardly",
            residue: "both sides still had things unsaid",
          },
        },
        changes: [
          {
            sectionKey: "lastChatEnded",
            summary: "The last interaction ended awkwardly.",
            evidence: ["The chat cut off with unresolved tension."],
          },
        ],
      }),
    });
    const handler = postHandlers.get("/data/character-evolution/handoff");
    expect(handler).toBeTruthy();

    const res = createRes();
    await handler!(createReq({ characterId, chatId }), res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual(expect.objectContaining({
      ok: true,
      proposal: expect.objectContaining({
        proposedState: expect.objectContaining({
          lastInteractionEnded: {
            state: "ended awkwardly",
            residue: "both sides still had things unsaid",
          },
        }),
        changes: [
          expect.objectContaining({
            sectionKey: "lastInteractionEnded",
          }),
        ],
      }),
    }));

    const dataDirs = getDataDirs();
    const characterFile = JSON.parse(readFileSync(path.join(dataDirs.characters, characterId, "character.json"), "utf-8"));
    expect(characterFile.character.characterEvolution.pendingProposal).toEqual(expect.objectContaining({
      proposedState: expect.objectContaining({
        lastInteractionEnded: {
          state: "ended awkwardly",
          residue: "both sides still had things unsaid",
        },
      }),
      changes: [
        expect.objectContaining({
          sectionKey: "lastInteractionEnded",
        }),
      ],
    }));
  });

  it("preserves existing notes in the staged pending proposal when a matched item update omits note", async () => {
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
          currentStateVersion: 0,
          currentState: {
            userFacts: [
              {
                value: "Lives in Dubai",
                confidence: "confirmed",
                status: "active",
                note: "Eva reacted with surprise and skepticism to Andrew living in Dubai.",
                sourceChatId: chatId,
                sourceRange: {
                  chatId,
                  startMessageIndex: 0,
                  endMessageIndex: 1,
                },
                updatedAt: 1000,
                lastSeenAt: 1000,
                timesSeen: 1,
              },
              {
                value: "Used to live in Berlin",
                confidence: "confirmed",
                status: "corrected",
                note: "Older location fact already superseded.",
                sourceChatId: chatId,
                sourceRange: {
                  chatId,
                  startMessageIndex: 0,
                  endMessageIndex: 1,
                },
                updatedAt: 900,
                lastSeenAt: 900,
                timesSeen: 2,
              },
            ],
          },
          stateVersions: [],
        },
      },
    });
    writeJson(path.join(dataDirs.characters, characterId, "chats", `${chatId}.json`), {
      chat: {
        id: chatId,
        message: [
          { role: "user", data: "I live in Dubai." },
          { role: "char", data: "That sounds grim." },
        ],
      },
    });

    const { postHandlers } = buildHandlers({
      executeInternalLLMTextCompletion: async () => JSON.stringify({
        proposedState: {
          userFacts: [
            {
              value: "Lives in Dubai",
              confidence: "confirmed",
            },
          ],
        },
        changes: [
          {
            sectionKey: "userFacts",
            summary: "Confirmed the user's city again.",
            evidence: ["The user again stated they live in Dubai."],
          },
        ],
      }),
    });
    const handler = postHandlers.get("/data/character-evolution/handoff");
    expect(handler).toBeTruthy();

    const res = createRes();
    await handler!(createReq({ characterId, chatId }), res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual(expect.objectContaining({
      proposal: expect.objectContaining({
        proposedState: expect.objectContaining({
          userFacts: [
            expect.objectContaining({
              value: "Lives in Dubai",
              note: "Eva reacted with surprise and skepticism to Andrew living in Dubai.",
            }),
          ],
        }),
      }),
    }));
    expect((res.payload as Record<string, unknown>).proposal).toEqual(expect.not.objectContaining({
      proposedState: expect.objectContaining({
        userFacts: expect.arrayContaining([
          expect.objectContaining({
            value: "Used to live in Berlin",
          }),
        ]),
      }),
    }));

    const characterFile = JSON.parse(readFileSync(path.join(dataDirs.characters, characterId, "character.json"), "utf-8"));
    expect(characterFile.character.characterEvolution.pendingProposal).toEqual(expect.objectContaining({
      proposedState: expect.objectContaining({
        userFacts: [
          expect.objectContaining({
            value: "Lives in Dubai",
            note: "Eva reacted with surprise and skepticism to Andrew living in Dubai.",
          }),
        ],
      }),
    }));
    expect(characterFile.character.characterEvolution.pendingProposal.proposedState.userFacts).toHaveLength(1);
  });

  it("drops unchanged echoed non-reinforcement items from the staged pending proposal", async () => {
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
          currentStateVersion: 2,
          currentState: {
            relationship: {
              trustLevel: "steady",
              dynamic: "guarded but warmer",
            },
            userRead: [
              {
                value: "Andrew keeps joking to dodge vulnerability",
                status: "active",
                confidence: "confirmed",
                note: "older accepted read",
                sourceChatId: "chat-old",
                sourceRange: {
                  chatId: "chat-old",
                  startMessageIndex: 0,
                  endMessageIndex: 2,
                },
                updatedAt: 100,
                lastSeenAt: 100,
                timesSeen: 2,
              },
            ],
          },
          stateVersions: [],
        },
      },
    });

    const { postHandlers } = buildHandlers({
      executeInternalLLMTextCompletion: async () => JSON.stringify({
        proposedState: {
          relationship: {
            trustLevel: "high",
            dynamic: "closer after the last chat",
          },
          userRead: [
            {
              value: "Andrew keeps joking to dodge vulnerability",
              status: "active",
              confidence: "confirmed",
            },
          ],
        },
        changes: [
          {
            sectionKey: "relationship",
            summary: "The relationship warmed further.",
            evidence: ["They sounded closer by the end of the range."],
          },
          {
            sectionKey: "userRead",
            summary: "Eva repeated the same read again.",
            evidence: ["She framed him the same way again."],
          },
        ],
      }),
    });
    const handler = postHandlers.get("/data/character-evolution/handoff");
    expect(handler).toBeTruthy();

    const res = createRes();
    await handler!(createReq({ characterId, chatId }), res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual(expect.objectContaining({
      proposal: expect.objectContaining({
        proposedState: {
          relationship: {
            trustLevel: "high",
            dynamic: "closer after the last chat",
          },
        },
        changes: [
          expect.objectContaining({
            sectionKey: "relationship",
          }),
        ],
      }),
    }));

    const characterFile = JSON.parse(readFileSync(path.join(dataDirs.characters, characterId, "character.json"), "utf-8"));
    expect(characterFile.character.characterEvolution.pendingProposal.proposedState).toEqual({
      relationship: {
        trustLevel: "high",
        dynamic: "closer after the last chat",
      },
    });
    expect(characterFile.character.characterEvolution.pendingProposal.changes).toEqual([
      expect.objectContaining({
        sectionKey: "relationship",
      }),
    ]);
  });
});
