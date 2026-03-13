import { describe, expect, it } from "vitest";

import {
  getServerFailureMessage,
  getServerStringSuccessResult,
  normalizeServerEnvelope,
  parseServerErrorPayload,
  stringifyUnknownResponse,
} from "./request.responses";

describe("request response helpers", () => {
  it("normalizes primitive payloads into a server envelope", () => {
    expect(normalizeServerEnvelope("plain text")).toEqual({
      result: "plain text",
    });
    expect(normalizeServerEnvelope(undefined)).toEqual({});
  });

  it("extracts direct and nested string success results", () => {
    expect(
      getServerStringSuccessResult({
        type: "success",
        result: "top-level",
        newCharEtag: "etag-1",
      }),
    ).toEqual({
      result: "top-level",
      newCharEtag: "etag-1",
    });

    expect(
      getServerStringSuccessResult({
        type: "success",
        result: {
          type: "success",
          result: "nested",
          newCharEtag: "etag-2",
        },
      }),
    ).toEqual({
      result: "nested",
      newCharEtag: "etag-2",
    });
  });

  it("extracts failure messages from nested fail envelopes", () => {
    expect(
      getServerFailureMessage({
        type: "fail",
        result: {
          type: "fail",
          message: "nested failure",
        },
      }),
    ).toBe("nested failure");
  });

  it("parses status, code, and upstream message from error envelopes", () => {
    expect(
      parseServerErrorPayload(
        {
          error: "OPENAI_KEY_MISSING",
          details: {
            status: 401,
            body: {
              error: {
                message: "missing key",
              },
            },
          },
        },
        500,
      ),
    ).toEqual({
      status: 401,
      code: "OPENAI_KEY_MISSING",
      message: "missing key",
    });
  });

  it("stringifies unknown payloads consistently", () => {
    expect(stringifyUnknownResponse("text")).toBe("text");
    expect(stringifyUnknownResponse({ ok: true })).toBe(JSON.stringify({ ok: true }));
  });
});
