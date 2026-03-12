import { describe, expect, it } from "vitest";

import { splitPromptMessagesForMemoryTemplate } from "./promptMemoryFormatting";

describe("promptMemoryContext", () => {
  it("extracts memory messages into the template-only bucket", () => {
    const { chatMessages, memoryMessages } = splitPromptMessagesForMemoryTemplate(
      [
        { role: "system", content: "Memory", memo: "memory" },
        { role: "user", content: "hello", memo: "chat-1" },
      ],
      true,
    );

    expect(memoryMessages).toEqual([{ role: "system", content: "Memory", memo: "memory" }]);
    expect(chatMessages).toEqual([
      { role: "user", content: "hello", memo: "chat-1", removable: true },
    ]);
  });

  it("keeps inline memory messages when no memory template card is present", () => {
    const { chatMessages, memoryMessages } = splitPromptMessagesForMemoryTemplate(
      [
        { role: "system", content: "Memory", memo: "memory" },
        { role: "assistant", content: "reply", memo: "chat-2" },
      ],
      false,
    );

    expect(memoryMessages).toEqual([]);
    expect(chatMessages).toEqual([
      {
        role: "system",
        content: "<Previous Conversation>Memory</Previous Conversation>",
        memo: "memory",
      },
      {
        role: "assistant",
        content: "reply",
        memo: "chat-2",
        removable: true,
      },
    ]);
  });
});
