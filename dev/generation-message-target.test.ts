import { describe, expect, it } from "vitest";
import { ensureGenerationMessageTarget, resolveGenerationMessageIndex } from "src/ts/process/generationMessageTarget";
import type { Chat, Message } from "src/ts/storage/database.svelte";

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    role: "char",
    data: "",
    ...overrides,
  };
}

function makeChat(messages: Message[]): Chat {
  return {
    name: "Chat",
    note: "",
    localLore: [],
    message: messages,
  };
}

describe("generation message target", () => {
  it("prefers generation id match even when fallback index drifts", () => {
    const chat = makeChat([
      makeMessage({ role: "user", data: "u0" }),
      makeMessage({ role: "char", data: "out", chatId: "gen-1" }),
    ]);

    const first = ensureGenerationMessageTarget({
      chat,
      generationId: "gen-1",
      fallbackIndex: 1,
      createMessage: () => makeMessage({ chatId: "gen-1" }),
    });
    expect(first).toBe(1);

    chat.message.unshift(makeMessage({ role: "user", data: "inserted" }));

    const afterShift = ensureGenerationMessageTarget({
      chat,
      generationId: "gen-1",
      fallbackIndex: 1,
      createMessage: () => makeMessage({ chatId: "gen-1" }),
    });
    expect(afterShift).toBe(2);
  });

  it("uses fallback index and backfills chatId when generation id is missing", () => {
    const chat = makeChat([
      makeMessage({ data: "first" }),
      makeMessage({ data: "second" }),
    ]);

    const index = resolveGenerationMessageIndex(chat.message, "gen-2", 1);
    expect(index).toBe(1);
    expect(chat.message[1].chatId).toBe("gen-2");
  });

  it("creates a new message when target cannot be resolved and createWhenMissing is true", () => {
    const chat = makeChat([makeMessage({ data: "existing" })]);

    const index = ensureGenerationMessageTarget({
      chat,
      generationId: "gen-3",
      fallbackIndex: 7,
      createWhenMissing: true,
      createMessage: () => makeMessage({ data: "new", chatId: "gen-3" }),
    });

    expect(index).toBe(1);
    expect(chat.message).toHaveLength(2);
    expect(chat.message[1].chatId).toBe("gen-3");
  });

  it("returns -1 without mutating when target cannot be resolved and createWhenMissing is false", () => {
    const chat = makeChat([makeMessage({ data: "only" })]);

    const index = ensureGenerationMessageTarget({
      chat,
      generationId: "gen-4",
      fallbackIndex: 10,
      createWhenMissing: false,
      createMessage: () => makeMessage({ data: "should-not-exist", chatId: "gen-4" }),
    });

    expect(index).toBe(-1);
    expect(chat.message).toHaveLength(1);
  });

  it("returns -1 safely when chat is missing", () => {
    const index = ensureGenerationMessageTarget({
      chat: null,
      generationId: "gen-5",
      fallbackIndex: 0,
      createWhenMissing: true,
      createMessage: () => makeMessage({ chatId: "gen-5" }),
    });

    expect(index).toBe(-1);
  });
});
