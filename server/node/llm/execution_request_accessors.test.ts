import { describe, expect, it } from "vitest";

describe("execution request accessors", () => {
  it("can read candidates in either outer-first or inner-first order", async () => {
    const accessors = await import("./execution_request_accessors.cjs");
    const input = {
      label: "outer",
      request: {
        label: "inner",
      },
    };

    expect(accessors.listExecutionRequestCandidates(input).map((entry: { label: string }) => entry.label)).toEqual([
      "outer",
      "inner",
    ]);
    expect(
      accessors.listExecutionRequestCandidates(input, { preferInnermost: true }).map((entry: { label: string }) => entry.label),
    ).toEqual(["inner", "outer"]);
    expect(accessors.readExecutionRequest(input)).toMatchObject({ label: "inner" });
  });

  it("preserves the engine path's fourth nested request hop", async () => {
    const accessors = await import("./execution_request_accessors.cjs");
    const input = {
      label: "outer",
      request: {
        label: "one",
        request: {
          label: "two",
          request: {
            label: "three",
            request: {
              label: "four",
              requestBody: {
                messages: [{ role: "user", content: "deepest" }],
              },
            },
          },
        },
      },
    };

    expect(accessors.readExecutionRequest(input)).toMatchObject({ label: "four" });
    expect(
      accessors.readExecutionMessages(input, { preferInnermost: true, maxNestedRequests: 4 })?.[0]?.content,
    ).toBe("deepest");
    expect(
      accessors.readExecutionMessages(input, { preferInnermost: true })?.[0]?.content,
    ).not.toBe("deepest");
  });

  it("preserves outer-first and inner-first message lookup behavior", async () => {
    const accessors = await import("./execution_request_accessors.cjs");
    const input = {
      requestBody: {
        messages: [{ role: "user", content: "outer-body" }],
      },
      messages: [{ role: "user", content: "outer-direct" }],
      request: {
        requestBody: {
          messages: [{ role: "user", content: "inner-body" }],
        },
        messages: [{ role: "user", content: "inner-direct" }],
      },
    };

    expect(accessors.readExecutionMessages(input)?.[0]?.content).toBe("outer-body");
    expect(accessors.readExecutionMessages(input, { preferInnermost: true })?.[0]?.content).toBe("inner-body");
  });

  it("can distinguish missing messages from present-but-empty messages at the current level", async () => {
    const accessors = await import("./execution_request_accessors.cjs");

    expect(
      accessors.readExecutionMessagesAtLevel({
        requestBody: {
          messages: [],
        },
      }),
    ).toEqual([]);
    expect(accessors.readExecutionMessagesAtLevel({})).toBeUndefined();
  });

  it("reads model, prompt, contents, and prompt blocks from supported execution shapes", async () => {
    const accessors = await import("./execution_request_accessors.cjs");
    const payload = {
      promptBlocks: [{ title: "top-level" }],
      request: {
        requestBody: {
          model: "body-model",
          prompt: "body prompt",
          contents: [{ role: "user", parts: [{ text: "hello" }] }],
        },
        promptBlocks: [{ title: "nested" }],
      },
    };

    expect(accessors.readExecutionModel(payload.request)).toBe("body-model");
    expect(accessors.readExecutionPrompt(payload.request)).toBe("body prompt");
    expect(accessors.readExecutionContents(payload.request)).toEqual([
      { role: "user", parts: [{ text: "hello" }] },
    ]);
    expect(accessors.readExecutionPromptBlocks(payload)).toEqual([{ title: "top-level" }]);
  });

  it("falls back from empty model strings to requestBody.model", async () => {
    const accessors = await import("./execution_request_accessors.cjs");

    expect(
      accessors.readExecutionModel({
        model: "",
        requestBody: {
          model: "body-model",
        },
      }, { maxNestedRequests: 0 }),
    ).toBe("body-model");
  });
});
