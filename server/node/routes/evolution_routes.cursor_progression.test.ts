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

describe("evolution routes cursor progression", () => {
  it("does not treat legacy lastProcessedChatId alone as full current-chat coverage", async () => {
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
          currentStateVersion: 1,
          currentState: {},
          stateVersions: [],
          lastProcessedChatId: chatId,
        },
      },
    });

    const { postHandlers } = buildHandlers();
    const handler = postHandlers.get("/data/character-evolution/handoff");
    expect(handler).toBeTruthy();

    const res = createRes();
    await handler!(createReq({ characterId, chatId }), res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual(expect.objectContaining({
      proposal: expect.objectContaining({
        sourceRange: {
          chatId,
          startMessageIndex: 0,
          endMessageIndex: 1,
        },
      }),
    }));
  });

  it("supports explicit contiguous next-range handoff and advances the per-chat cursor on accept", async () => {
    const { postHandlers } = buildHandlers();
    const handoff = postHandlers.get("/data/character-evolution/handoff");
    const accept = postHandlers.get("/data/character-evolution/:charId/proposal/accept");
    expect(handoff).toBeTruthy();
    expect(accept).toBeTruthy();

    const firstHandoffRes = createRes();
    await handoff!(createReq({
      characterId,
      chatId,
      sourceRange: {
        chatId,
        startMessageIndex: 0,
        endMessageIndex: 0,
      },
    }), firstHandoffRes);
    expect(firstHandoffRes.statusCode).toBe(200);
    expect(firstHandoffRes.payload).toEqual(expect.objectContaining({
      proposal: expect.objectContaining({
        sourceRange: {
          chatId,
          startMessageIndex: 0,
          endMessageIndex: 0,
        },
      }),
    }));

    const firstAcceptRes = createRes();
    await accept!(createReq({}, { charId: characterId }), firstAcceptRes);
    expect(firstAcceptRes.statusCode).toBe(200);

    const secondHandoffRes = createRes();
    await handoff!(createReq({ characterId, chatId }), secondHandoffRes);
    expect(secondHandoffRes.statusCode).toBe(200);
    expect(secondHandoffRes.payload).toEqual(expect.objectContaining({
      proposal: expect.objectContaining({
        sourceRange: {
          chatId,
          startMessageIndex: 1,
          endMessageIndex: 1,
        },
      }),
    }));
  });

  it("caps implicit handoff range to the configured auto-handoff batch size", async () => {
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
          autoHandoffBatchSize: 2,
          currentStateVersion: 0,
          currentState: {},
          stateVersions: [],
        },
      },
    });

    writeJson(path.join(dataDirs.characters, characterId, "chats", `${chatId}.json`), {
      chat: {
        id: chatId,
        message: [
          { role: "user", data: "m0" },
          { role: "char", data: "m1" },
          { role: "user", data: "m2" },
          { role: "char", data: "m3" },
          { role: "user", data: "m4" },
        ],
      },
    });

    const { postHandlers } = buildHandlers();
    const handoff = postHandlers.get("/data/character-evolution/handoff");
    expect(handoff).toBeTruthy();

    const res = createRes();
    await handoff!(createReq({ characterId, chatId }), res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual(expect.objectContaining({
      proposal: expect.objectContaining({
        sourceRange: {
          chatId,
          startMessageIndex: 0,
          endMessageIndex: 1,
        },
      }),
    }));
  });

  it("preserves explicit per-chat cursor fallback for valid no-snapshot imports", async () => {
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
          currentStateVersion: 4,
          currentState: {
            activeThreads: [
              {
                value: "imported current thread",
                status: "active",
                confidence: "likely",
                lastSeenVersion: 2,
                unseenAcceptedHandoffs: 2,
              },
            ],
          },
          stateVersions: [
            { version: 4, chatId, acceptedAt: 4000 },
          ],
          processedRanges: [],
          lastProcessedChatId: chatId,
          lastProcessedMessageIndexByChat: {
            [chatId]: 1,
          },
        },
      },
    });

    writeJson(path.join(dataDirs.characters, characterId, "chats", `${chatId}.json`), {
      chat: {
        id: chatId,
        message: [
          { role: "user", data: "first" },
          { role: "char", data: "second" },
          { role: "user", data: "third" },
        ],
      },
    });

    const { postHandlers } = buildHandlers();
    const handoff = postHandlers.get("/data/character-evolution/handoff");
    expect(handoff).toBeTruthy();

    const res = createRes();
    await handoff!(createReq({ characterId, chatId }), res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual(expect.objectContaining({
      proposal: expect.objectContaining({
        sourceRange: {
          chatId,
          startMessageIndex: 2,
          endMessageIndex: 2,
        },
      }),
    }));
  });

  it("does not advance the cursor when a proposal is rejected", async () => {
    const { postHandlers } = buildHandlers();
    const handoff = postHandlers.get("/data/character-evolution/handoff");
    const reject = postHandlers.get("/data/character-evolution/:charId/proposal/reject");
    expect(handoff).toBeTruthy();
    expect(reject).toBeTruthy();

    await handoff!(createReq({ characterId, chatId }), createRes());

    const rejectRes = createRes();
    await reject!(createReq({}, { charId: characterId }), rejectRes);
    expect(rejectRes.statusCode).toBe(200);

    const dataDirs = getDataDirs();
    writeJson(path.join(dataDirs.characters, characterId, "chats", `${chatId}.json`), {
      chat: {
        id: chatId,
        message: [
          { role: "user", data: "I need a job soon." },
          { role: "char", data: "That sounds miserable, dude." },
          { role: "user", data: "And I still need help." },
        ],
      },
    });

    const secondHandoffRes = createRes();
    await handoff!(createReq({ characterId, chatId }), secondHandoffRes);
    expect(secondHandoffRes.statusCode).toBe(200);
    expect(secondHandoffRes.payload).toEqual(expect.objectContaining({
      proposal: expect.objectContaining({
        sourceRange: {
          chatId,
          startMessageIndex: 0,
          endMessageIndex: 2,
        },
      }),
    }));
  });
});
