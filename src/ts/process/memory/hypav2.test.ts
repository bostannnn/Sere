import { describe, expect, it } from "vitest";

import {
  convertHypaV2DataToMemoryData,
  normalizeSerializableHypaV2Data,
} from "./hypav2";

describe("hypav2 compatibility conversion", () => {
  it("converts serialized hypav2 main chunks into canonical memory summaries", () => {
    const converted = convertHypaV2DataToMemoryData({
      data: {
        lastMainChunkID: 1,
        chunks: [],
        mainChunks: [
          {
            id: 0,
            text: "First legacy summary",
            chatMemos: ["m1", "m2"],
            lastChatMemo: "m2",
          },
        ],
      },
      chats: [{ memo: "m1" }, { memo: "m2" }],
      uncategorizedLabel: "Unclassified",
    });

    expect(converted).toEqual({
      summaries: [
        {
          text: "First legacy summary",
          chatMemos: ["m1", "m2"],
          isImportant: false,
        },
      ],
      categories: [{ id: "", name: "Unclassified" }],
      lastSelectedSummaries: [],
    });
  });

  it("normalizes older targetId-based hypav2 data into serializable chunks", () => {
    const normalized = normalizeSerializableHypaV2Data({
      data: {
        chunks: [
          { text: "Chunk A", targetId: "m2" },
          { text: "Chunk B", targetId: "m4" },
        ],
        mainChunks: [
          { text: "Summary B", targetId: "m4" },
          { text: "Summary A", targetId: "m2" },
        ],
      },
      chats: [{ memo: "m1" }, { memo: "m2" }, { memo: "m3" }, { memo: "m4" }],
    });

    expect(normalized?.mainChunks).toEqual([
      {
        id: 0,
        text: "Summary A",
        chatMemos: ["m1", "m2"],
        lastChatMemo: "m2",
      },
      {
        id: 1,
        text: "Summary B",
        chatMemos: ["m2", "m3", "m4"],
        lastChatMemo: "m4",
      },
    ]);
    expect(normalized?.chunks).toEqual([
      { mainChunkID: 0, text: "Chunk A" },
      { mainChunkID: 1, text: "Chunk B" },
    ]);
  });
});
