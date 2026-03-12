import { describe, expect, it } from "vitest";

import {
  applyPromptInnerFormat,
  resolveChatTemplateMessages,
  resolveMemoryTemplateCardMessages,
} from "./promptAssembly";

describe("promptAssembly", () => {
  it("resolves ranged chat cards through one shared helper", () => {
    expect(resolveChatTemplateMessages({
      chats: [
        { role: "system", content: "setup" },
        { role: "user", content: "hello", memo: "chat-1" },
        { role: "assistant", content: "reply", memo: "chat-2" },
      ],
      rangeStart: 1,
      rangeEnd: "end",
      sendChatAsSystem: true,
    })).toEqual([
      { role: "system", content: "user: hello", memo: undefined, name: undefined },
      { role: "system", content: "assistant: reply", memo: undefined, name: undefined },
    ]);
  });

  it("resolves memory template cards through the shared helper", () => {
    expect(resolveMemoryTemplateCardMessages({
      memoryMessages: [{ role: "system", content: "Original memory", memo: "legacy" }],
      selectedSummaryTexts: ["Summary 1", "Summary 2"],
      rangeStart: -1,
      rangeEnd: "end",
    })).toEqual({
      messages: [
        {
          role: "system",
          content: "<Past Events Summary>\nSummary 2\n</Past Events Summary>",
          memo: "memory",
        },
      ],
    });
  });

  it("applies inner formatting without mutating unrelated message fields", () => {
    const original: Array<{
      role: "system";
      content: string;
      memo: string;
      removable: boolean;
    }> = [
      { role: "system", content: "State", memo: "memory", removable: true },
    ];

    expect(applyPromptInnerFormat(
      original,
      "<Wrapper>{{slot}}</Wrapper>",
      (innerFormat, slotContent) => innerFormat.replace("{{slot}}", slotContent),
    )).toEqual([
      { role: "system", content: "<Wrapper>State</Wrapper>", memo: "memory", removable: true },
    ]);
    expect(original).toEqual([
      { role: "system", content: "State", memo: "memory", removable: true },
    ]);
  });
});
