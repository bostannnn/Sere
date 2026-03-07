import { describe, expect, it, vi } from "vitest";

import { buildPromptTrace, truncatePromptMessagesForAudit } from "./prompt.cjs";
import { createTraceAuditors } from "./trace_audit.cjs";

describe("trace audit routing", () => {
  it("persists generate trace audit with explicit endpoint and path", async () => {
    const appendLLMAudit = vi.fn(async () => {});
    const { appendGenerateTraceAudit } = createTraceAuditors({
      appendLLMAudit,
      promptPipeline: {
        buildPromptTrace: () => [{ role: "system", content: "trace" }],
        truncatePromptMessagesForAudit: (messages: unknown[]) => ({
          promptMessages: messages,
          omittedMessageCount: 0,
        }),
      },
    });

    await appendGenerateTraceAudit({
      req: { method: "POST" },
      reqId: "req-1",
      normalized: {
        mode: "emotion",
        provider: "openrouter",
        characterId: "charA",
        chatId: "chatA",
      },
      endpoint: "execute_trace",
      path: "/data/llm/execute",
      status: 200,
      ok: true,
    });

    expect(appendLLMAudit).toHaveBeenCalledTimes(1);
    const entry = appendLLMAudit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(entry.path).toBe("/data/llm/execute");
    expect(entry.endpoint).toBe("execute_trace");
    expect((entry.response as Record<string, unknown>)?.endpoint).toBe("execute_trace");
  });

  it("defaults to generate trace endpoint/path when no override is provided", async () => {
    const appendLLMAudit = vi.fn(async () => {});
    const { appendGenerateTraceAudit } = createTraceAuditors({
      appendLLMAudit,
      promptPipeline: {
        buildPromptTrace: () => [{ role: "user", content: "hi" }],
        truncatePromptMessagesForAudit: (messages: unknown[]) => ({
          promptMessages: messages,
          omittedMessageCount: 0,
        }),
      },
    });

    await appendGenerateTraceAudit({
      req: { method: "POST" },
      reqId: "req-2",
      normalized: {},
      status: 200,
      ok: true,
    });

    const entry = appendLLMAudit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(entry.path).toBe("/data/llm/generate/trace");
    expect(entry.endpoint).toBe("generate_trace");
  });

  it("unwraps normalized generate payloads and records prompt messages", async () => {
    const appendLLMAudit = vi.fn(async () => {});
    const { appendGenerateTraceAudit } = createTraceAuditors({
      appendLLMAudit,
      promptPipeline: {
        buildPromptTrace,
        truncatePromptMessagesForAudit,
      },
    });

    await appendGenerateTraceAudit({
      req: { method: "POST" },
      reqId: "req-3",
      normalized: {
        promptBlocks: [{ index: 0, role: "user", title: "User Message", source: "legacy" }],
        request: {
          request: {
            requestBody: {
              messages: [{ role: "user", content: "hello from generate" }],
            },
          },
        },
      },
      endpoint: "generate_trace",
      path: "/data/llm/generate/trace",
      status: 200,
      ok: true,
    });

    const entry = appendLLMAudit.mock.calls[0]?.[0] as Record<string, unknown>;
    const response = (entry.response || {}) as Record<string, unknown>;
    const promptMessages = (response.promptMessages || []) as Array<Record<string, unknown>>;
    expect(response.messageCount).toBe(1);
    expect(promptMessages[0]?.content).toBe("hello from generate");
    expect(promptMessages[0]?.title).toBe("User Message");
  });

  it("unwraps normalized execute payloads and records prompt messages", async () => {
    const appendLLMAudit = vi.fn(async () => {});
    const { appendGenerateTraceAudit } = createTraceAuditors({
      appendLLMAudit,
      promptPipeline: {
        buildPromptTrace,
        truncatePromptMessagesForAudit,
      },
    });

    await appendGenerateTraceAudit({
      req: { method: "POST" },
      reqId: "req-4",
      normalized: {
        promptBlocks: [{ index: 0, role: "system", title: "Main Prompt", source: "template" }],
        request: {
          request: {
            messages: [{ role: "system", content: "execute trace body" }],
          },
        },
      },
      endpoint: "execute_trace",
      path: "/data/llm/execute",
      status: 200,
      ok: true,
    });

    const entry = appendLLMAudit.mock.calls[0]?.[0] as Record<string, unknown>;
    const response = (entry.response || {}) as Record<string, unknown>;
    const promptMessages = (response.promptMessages || []) as Array<Record<string, unknown>>;
    expect(response.messageCount).toBe(1);
    expect(promptMessages[0]?.content).toBe("execute trace body");
    expect(promptMessages[0]?.title).toBe("Main Prompt");
  });
});
