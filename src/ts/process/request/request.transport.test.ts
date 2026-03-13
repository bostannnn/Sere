import { describe, expect, it, vi } from "vitest";

vi.mock("src/ts/globalApi.svelte", () => ({
  addFetchLog: vi.fn(),
  fetchNative: vi.fn(),
  globalFetch: vi.fn(),
  textifyReadableStream: vi.fn(),
}));

import { createAccumulatingServerResponseStream } from "./request.transport";

function makeSSEStream(lines: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(line));
      }
      controller.close();
    },
  });

  return new Response(body);
}

async function readAll(stream: ReadableStream<Record<string, string>>) {
  const reader = stream.getReader();
  const chunks: Array<Record<string, string>> = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return chunks;
}

describe("createAccumulatingServerResponseStream", () => {
  it("accumulates chunk events and forwards the final etag on done", async () => {
    const res = makeSSEStream([
      'data: {"type":"chunk","text":"hel"}\n',
      'data: {"type":"chunk","text":"lo"}\n',
      'data: {"type":"done","newCharEtag":"etag-1"}\n',
    ]);

    const chunks = await readAll(createAccumulatingServerResponseStream(res));

    expect(chunks).toEqual([
      { "0": "hel" },
      { "0": "hello" },
      { "__newCharEtag": "etag-1" },
    ]);
  });

  it("surfaces terminal error events as stream output", async () => {
    const res = makeSSEStream([
      'data: {"type":"error","message":"server exploded"}\n',
    ]);

    const chunks = await readAll(createAccumulatingServerResponseStream(res));

    expect(chunks).toEqual([
      { "0": "Error: server exploded" },
    ]);
  });

  it("emits an incomplete-stream error when upstream closes before done", async () => {
    const res = makeSSEStream([
      'data: {"type":"chunk","text":"partial"}\n',
    ]);

    const chunks = await readAll(createAccumulatingServerResponseStream(res));

    expect(chunks).toEqual([
      { "0": "partial" },
      {
        "__error": "Server stream ended before done event.",
        "__errorCode": "UPSTREAM_STREAM_INCOMPLETE",
        "__status": "502",
      },
    ]);
  });
});
