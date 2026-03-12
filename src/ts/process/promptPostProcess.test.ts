import { describe, expect, it } from "vitest";

import {
  getPlainPromptLabel,
  markRecentUserCachePoints,
  systemizePromptChats,
  trimPromptChats,
} from "./promptPostProcess";

describe("promptPostProcess", () => {
  it("labels plain prompt variants with current prompt-template names", () => {
    expect(getPlainPromptLabel("main")).toBe("Main Prompt");
    expect(getPlainPromptLabel("globalNote")).toBe("Global Note");
    expect(getPlainPromptLabel("jailbreak")).toBe("Jailbreak");
    expect(getPlainPromptLabel("normal")).toBe("Plain Prompt");
    expect(getPlainPromptLabel("unknown")).toBe("Plain Prompt");
  });

  it("converts user and assistant chats into system chats without legacy fields", () => {
    expect(systemizePromptChats([
      { role: "user", content: "hello", memo: "memory" },
      { role: "assistant", content: "reply", name: "example_bot" },
      { role: "system", content: "keep" },
    ])).toEqual([
      { role: "system", content: "user: hello", memo: undefined, name: undefined },
      { role: "system", content: "example_bot: reply", name: undefined, memo: undefined },
      { role: "system", content: "keep" },
    ]);
  });

  it("marks the most recent user messages as cache points", () => {
    const chats = [
      { role: "system", content: "a" },
      { role: "user", content: "b" },
      { role: "assistant", content: "c" },
      { role: "user", content: "d" },
      { role: "user", content: "e" },
    ] as const;
    const mutableChats = chats.map((chat) => ({ ...chat }));

    markRecentUserCachePoints(mutableChats, 2);

    expect(mutableChats).toEqual([
      { role: "system", content: "a" },
      { role: "user", content: "b" },
      { role: "assistant", content: "c" },
      { role: "user", content: "d", cachePoint: true },
      { role: "user", content: "e", cachePoint: true },
    ]);
  });

  it("trims prompt chat content without dropping other fields", () => {
    expect(trimPromptChats([
      { role: "user", content: " hello ", cachePoint: true },
      { role: "system", content: "\nworld\t", memo: "memory" },
    ])).toEqual([
      { role: "user", content: "hello", cachePoint: true },
      { role: "system", content: "world", memo: "memory" },
    ]);
  });
});
