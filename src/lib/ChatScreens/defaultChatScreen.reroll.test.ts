import { describe, expect, it } from "vitest";

import {
  replaceMessageTailWithSnapshot,
  trimMessagesForRerollRequest,
} from "./defaultChatScreen.reroll";

describe("defaultChatScreen reroll helpers", () => {
  it("replaces only the tail messages covered by a reroll snapshot", () => {
    expect(
      replaceMessageTailWithSnapshot(
        [
          { role: "user", data: "Hi" },
          { role: "char", data: "A1" },
          { role: "char", data: "A2" },
        ],
        [
          { role: "char", data: "B1" },
          { role: "char", data: "B2" },
        ],
      ),
    ).toEqual([
      { role: "user", data: "Hi" },
      { role: "char", data: "B1" },
      { role: "char", data: "B2" },
    ]);
  });

  it("trims the active tail back to the next reroll request boundary", () => {
    expect(
      trimMessagesForRerollRequest([
        { role: "user", data: "Hi" },
        { role: "char", data: "One", saying: "char-a" },
        { role: "char", data: "Two", saying: "char-a" },
        { role: "char", data: "Three", saying: "char-a" },
      ]),
    ).toEqual([
      { role: "user", data: "Hi" },
      { role: "char", data: "One", saying: "char-a" },
      { role: "char", data: "Two", saying: "char-a" },
    ]);
  });
});
