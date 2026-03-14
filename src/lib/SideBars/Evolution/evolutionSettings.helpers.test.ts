import { describe, expect, it } from "vitest";

import {
  deriveMergedProcessedRanges,
  mergeEvolutionVersionMetas,
} from "./evolutionSettings.helpers";

describe("evolutionSettings.helpers", () => {
  it("prefers refreshed version metadata when it adds recovered ranges", () => {
    const merged = mergeEvolutionVersionMetas(
      [
        { version: 2, chatId: "chat-1", acceptedAt: 20 },
        { version: 1, chatId: "chat-1", acceptedAt: 10 },
      ],
      [
        {
          version: 2,
          chatId: "chat-1",
          acceptedAt: 20,
          range: {
            chatId: "chat-1",
            startMessageIndex: 12,
            endMessageIndex: 23,
          },
        },
      ],
    );

    expect(merged).toEqual([
      {
        version: 2,
        chatId: "chat-1",
        acceptedAt: 20,
        range: {
          chatId: "chat-1",
          startMessageIndex: 12,
          endMessageIndex: 23,
        },
      },
      {
        version: 1,
        chatId: "chat-1",
        acceptedAt: 10,
      },
    ]);
  });

  it("merges explicit processed ranges with recovered version ranges", () => {
    const processedRanges = deriveMergedProcessedRanges({
      evolutionSettings: {
        processedRanges: [
          {
            version: 1,
            acceptedAt: 10,
            range: {
              chatId: "chat-1",
              startMessageIndex: 0,
              endMessageIndex: 11,
            },
          },
        ],
        stateVersions: [],
      } as never,
      mergedStateVersions: [
        {
          version: 2,
          chatId: "chat-1",
          acceptedAt: 20,
          range: {
            chatId: "chat-1",
            startMessageIndex: 12,
            endMessageIndex: 23,
          },
        },
      ],
    });

    expect(processedRanges).toEqual([
      {
        version: 1,
        acceptedAt: 10,
        range: {
          chatId: "chat-1",
          startMessageIndex: 0,
          endMessageIndex: 11,
        },
      },
      {
        version: 2,
        acceptedAt: 20,
        range: {
          chatId: "chat-1",
          startMessageIndex: 12,
          endMessageIndex: 23,
        },
      },
    ]);
  });
});
