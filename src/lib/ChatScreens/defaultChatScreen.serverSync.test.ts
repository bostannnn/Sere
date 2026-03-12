import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveServerAuthToken: vi.fn(),
  saveServerDatabase: vi.fn(),
}));

vi.mock("src/ts/storage/serverAuth", () => ({
  resolveServerAuthToken: mocks.resolveServerAuthToken,
}));

vi.mock("src/ts/storage/serverDb", () => ({
  saveServerDatabase: mocks.saveServerDatabase,
}));

import {
  extractHttpStatusFromError,
  flushUserMessageBeforeGeneration,
  getUserMessagePersistFailureMessage,
} from "./defaultChatScreen.serverSync";

describe("defaultChatScreen server sync helpers", () => {
  beforeEach(() => {
    mocks.resolveServerAuthToken.mockReset();
    mocks.saveServerDatabase.mockReset();
  });

  it("extracts HTTP status codes from persisted error messages", () => {
    expect(extractHttpStatusFromError(new Error("Save failed (401)"))).toBe(401);
    expect(extractHttpStatusFromError("No status")).toBeNull();
  });

  it("maps auth failures to user-facing persistence errors", () => {
    expect(getUserMessagePersistFailureMessage(new Error("Save failed (429)"))).toContain("rate-limited");
    expect(getUserMessagePersistFailureMessage(new Error("Save failed (401)"))).toContain("authentication failed");
  });

  it("retries the save after refreshing auth on 401/403", async () => {
    mocks.saveServerDatabase
      .mockRejectedValueOnce(new Error("Persist failed (401)"))
      .mockResolvedValueOnce(undefined);

    await flushUserMessageBeforeGeneration({
      database: { characters: [] } as never,
      character: { chaId: "char-1" },
      chat: { id: "chat-1" },
    });

    expect(mocks.resolveServerAuthToken).toHaveBeenCalledWith({ interactive: true });
    expect(mocks.saveServerDatabase).toHaveBeenCalledTimes(2);
  });
});
