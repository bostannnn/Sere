import { describe, expect, it } from "vitest";

import {
  createServerSaveConflictError,
  formatServerSaveFailureMessage,
  getServerSaveFailureLogDetails,
  summarizeStateCommand,
  summarizeStateCommandBatch,
} from "src/ts/storage/serverSaveDiagnostics";

describe("server save diagnostics", () => {
  it("summarizes command targets with resource identifiers", () => {
    expect(
      summarizeStateCommand({
        type: "chat.replace",
        charId: "char-1",
        chatId: "chat-9",
      }),
    ).toBe("chat.replace (charId=char-1, chatId=chat-9)");
  });

  it("formats stale base conflicts with command and event ids", () => {
    const error = createServerSaveConflictError({
      response: {
        ok: false,
        lastEventId: 18,
        applied: [],
        conflicts: [
          {
            index: -1,
            code: "STALE_BASE_EVENT",
            details: {
              baseEventId: 12,
              currentLastEventId: 18,
            },
          },
        ],
      },
      commands: [
        { type: "settings.replace" },
        { type: "character.delete", charId: "char-1" },
      ],
      baseEventId: 12,
      attempt: 2,
    });

    expect(summarizeStateCommandBatch(error.result?.commands ?? [])).toBe(
      "settings.replace + character.delete (charId=char-1)",
    );
    expect(formatServerSaveFailureMessage(error)).toBe(
      "Live save conflict while saving settings.replace + character.delete (charId=char-1). Server state advanced from event 12 to 18. Recent changes may be lost after refresh.",
    );
  });

  it("includes indexed command details for non-stale conflicts", () => {
    const error = createServerSaveConflictError({
      response: {
        ok: false,
        lastEventId: 22,
        applied: [],
        conflicts: [
          {
            index: 1,
            code: "NOT_FOUND",
          },
        ],
      },
      commands: [
        { type: "settings.replace" },
        { type: "chat.delete", charId: "char-1", chatId: "chat-2" },
      ],
      baseEventId: 22,
      attempt: 0,
    });

    expect(formatServerSaveFailureMessage(error)).toBe(
      "Live save conflict while saving chat.delete (charId=char-1, chatId=chat-2) (NOT_FOUND). Recent changes may be lost after refresh.",
    );
    expect(getServerSaveFailureLogDetails(error)).toEqual({
      status: 409,
      name: "ServerSaveConflictError",
      message: "POST /data/state/commands conflicted while saving settings.replace + chat.delete (charId=char-1, chatId=chat-2) (NOT_FOUND)",
      baseEventId: 22,
      lastEventId: 22,
      conflicts: [
        {
          index: 1,
          code: "NOT_FOUND",
          message: undefined,
          details: undefined,
        },
      ],
      commands: [
        "settings.replace",
        "chat.delete (charId=char-1, chatId=chat-2)",
      ],
      attempt: 0,
    });
  });
});
