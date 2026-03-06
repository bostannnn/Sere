import { EventEmitter } from "node:events";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { createExecuteRouteHandler } from "./execute_route_handler.cjs";

type NormalizedInput = {
    endpoint: string;
    mode: string;
    provider: string;
    model?: string;
    characterId: string;
    chatId: string;
    requestedStreaming: boolean;
    streaming: boolean;
    request: Record<string, unknown>;
    _ragMeta?: Record<string, unknown> | null;
};

class MockReq extends EventEmitter {
    method = "POST";
    originalUrl = "/data/llm/execute";
}

class MockRes extends EventEmitter {
    statusCode = 200;
    headers: Record<string, string> = {};
    writableEnded = false;
    destroyed = false;
    private chunks: string[] = [];
    private onWrite?: (chunk: string, res: MockRes) => boolean | void;

    constructor(onWrite?: (chunk: string, res: MockRes) => boolean | void) {
        super();
        this.onWrite = onWrite;
    }

    status(code: number) {
        this.statusCode = code;
        return this;
    }

    setHeader(key: string, value: string) {
        this.headers[key.toLowerCase()] = String(value);
    }

    getHeader(key: string) {
        return this.headers[key.toLowerCase()];
    }

    write(chunk: Buffer | string) {
        const asText = typeof chunk === "string" ? chunk : chunk.toString("utf-8");
        this.chunks.push(asText);
        if (this.onWrite) {
            const result = this.onWrite(asText, this);
            if (typeof result === "boolean") {
                return result;
            }
        }
        return true;
    }

    end(chunk?: Buffer | string) {
        if (chunk !== undefined) {
            this.write(chunk);
        }
        this.writableEnded = true;
    }

    text() {
        return this.chunks.join("");
    }
}

function toSSEDataFrames(raw: string) {
    return raw
        .split("\n\n")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .filter((entry) => entry.startsWith("data:"))
        .map((entry) => entry.slice(5).trimStart());
}

function createStreamFromRead(readImpl: () => Promise<{ done: boolean; value?: Uint8Array }>) {
    const reader = {
        read: vi.fn(readImpl),
        cancel: vi.fn(async () => {}),
        releaseLock: vi.fn(() => {}),
    };
    const stream = {
        getReader() {
            return reader;
        },
    };
    return { stream, reader };
}

function createHarness(arg: {
    normalized?: NormalizedInput;
    executeLLM?: () => Promise<unknown>;
    toLLMErrorResponse?: (error: unknown, ctx: { requestId: string; endpoint: string; durationMs: number }) => {
        status: number;
        code: string;
        payload: Record<string, unknown>;
    };
}) {
    const normalized: NormalizedInput = arg.normalized ?? {
        endpoint: "execute",
        mode: "model",
        provider: "openai",
        characterId: "",
        chatId: "",
        requestedStreaming: true,
        streaming: true,
        request: {},
    };
    const appendLLMAudit = vi.fn(async () => {});
    const appendGenerateTraceAudit = vi.fn(async () => {});
    const sendJson = vi.fn();
    const sendSSE = vi.fn();
    const logLLMExecutionEnd = vi.fn();

    const { handleLLMExecutePost } = createExecuteRouteHandler({
        path,
        dataDirs: { characters: "/tmp" },
        parseLLMExecutionInput: vi.fn(() => normalized),
        isInternalExecutionRequest: vi.fn(() => false),
        LLMHttpError: class extends Error {
            status: number;
            code: string;
            constructor(status: number, code: string, message: string) {
                super(message);
                this.status = status;
                this.code = code;
            }
        },
        executeLLM: arg.executeLLM ?? (async () => ({ type: "success", result: "ok" })),
        getReqIdFromResponse: vi.fn(() => "req-test"),
        logLLMExecutionStart: vi.fn(),
        logLLMExecutionEnd,
        appendLLMAudit,
        appendGenerateTraceAudit,
        buildExecutionAuditRequest: vi.fn((_endpoint, body) => body),
        sanitizeOutputByMode: vi.fn((_mode, text) => text),
        toLLMErrorResponse: vi.fn(arg.toLLMErrorResponse ?? ((error, ctx) => ({
            status: Number.isFinite(Number((error as { status?: unknown })?.status))
                ? Number((error as { status?: unknown }).status)
                : 500,
            code: typeof (error as { code?: unknown })?.code === "string" && (error as { code?: string }).code
                ? String((error as { code?: string }).code)
                : "INTERNAL_ERROR",
            payload: {
                error: typeof (error as { code?: unknown })?.code === "string" && (error as { code?: string }).code
                    ? String((error as { code?: string }).code)
                    : "INTERNAL_ERROR",
                message: String((error as { message?: unknown })?.message || error),
                requestId: ctx.requestId,
                endpoint: ctx.endpoint,
                durationMs: ctx.durationMs,
            },
        }))),
        sendSSE,
        sendJson,
        existsSync: vi.fn(() => false),
        readJsonWithEtag: vi.fn(async () => ({ json: {}, etag: "etag-1" })),
        readStateLastEventId: vi.fn(async () => 0),
        isSafePathSegment: vi.fn(() => true),
        applyStateCommands: vi.fn(async () => ({ ok: true, lastEventId: 0, applied: [], conflicts: [] })),
    });

    return {
        handleLLMExecutePost,
        appendLLMAudit,
        appendGenerateTraceAudit,
        sendJson,
        sendSSE,
        logLLMExecutionEnd,
    };
}

describe("execute_route_handler streaming safety", () => {
    it("cancels upstream reader and audits CLIENT_DISCONNECTED when client aborts mid-stream", async () => {
        const encoder = new TextEncoder();
        const req = new MockReq();
        const res = new MockRes();
        let readCalls = 0;
        const { stream, reader } = createStreamFromRead(async () => {
            readCalls += 1;
            if (readCalls === 1) {
                queueMicrotask(() => req.emit("aborted"));
                return {
                    done: false,
                    value: encoder.encode('data: {"choices":[{"delta":{"content":"hello"}}]}\n\n'),
                };
            }
            return { done: true };
        });

        const harness = createHarness({
            executeLLM: async () => stream,
        });

        await harness.handleLLMExecutePost(req, res, {}, "execute");

        expect(reader.cancel).toHaveBeenCalledTimes(1);
        expect(reader.releaseLock).toHaveBeenCalledTimes(1);
        expect(res.writableEnded).toBe(true);

        const lastAudit = harness.appendLLMAudit.mock.calls.at(-1)?.[0];
        expect(lastAudit?.status).toBe(499);
        expect(lastAudit?.error?.error).toBe("CLIENT_DISCONNECTED");
    });

    it("waits for drain when SSE writes backpressure", async () => {
        const encoder = new TextEncoder();
        const req = new MockReq();
        let writeCalls = 0;
        const res = new MockRes(() => {
            writeCalls += 1;
            if (writeCalls === 1) {
                return false;
            }
            return true;
        });
        let readCalls = 0;
        const { stream } = createStreamFromRead(async () => {
            readCalls += 1;
            if (readCalls === 1) {
                return {
                    done: false,
                    value: encoder.encode('data: {"choices":[{"delta":{"content":"A"}}]}\n\n'),
                };
            }
            return { done: true };
        });
        const harness = createHarness({
            executeLLM: async () => stream,
        });

        let settled = false;
        const promise = harness.handleLLMExecutePost(req, res, {}, "execute").then(() => {
            settled = true;
        });
        await new Promise((resolve) => setTimeout(resolve, 15));
        expect(settled).toBe(false);

        res.emit("drain");
        await promise;

        expect(settled).toBe(true);
        expect(res.writableEnded).toBe(true);
    });

    it("reassembles partial SSE frames split across chunks", async () => {
        const encoder = new TextEncoder();
        const req = new MockReq();
        const res = new MockRes();
        let readCalls = 0;
        const { stream } = createStreamFromRead(async () => {
            readCalls += 1;
            if (readCalls === 1) {
                return {
                    done: false,
                    value: encoder.encode('data: {"choices":[{"delta":{"content":"Hel'),
                };
            }
            if (readCalls === 2) {
                return {
                    done: false,
                    value: encoder.encode('lo"}}]}\n\ndata: [DONE]\n\n'),
                };
            }
            return { done: true };
        });
        const harness = createHarness({
            executeLLM: async () => stream,
        });

        await harness.handleLLMExecutePost(req, res, {}, "execute");

        const frames = toSSEDataFrames(res.text());
        const payloads = frames
            .filter((entry) => entry !== "[DONE]")
            .map((entry) => JSON.parse(entry));

        expect(payloads.some((payload) => payload.type === "chunk" && payload.text === "Hello")).toBe(true);
        expect(payloads.some((payload) => payload.type === "done")).toBe(true);

        const audit = harness.appendLLMAudit.mock.calls.at(-1)?.[0];
        expect(audit?.status).toBe(200);
        expect(audit?.ok).toBe(true);
    });

    it("parses CRLF-framed SSE blocks from upstream streams", async () => {
        const encoder = new TextEncoder();
        const req = new MockReq();
        const res = new MockRes();
        let readCalls = 0;
        const { stream } = createStreamFromRead(async () => {
            readCalls += 1;
            if (readCalls === 1) {
                return {
                    done: false,
                    value: encoder.encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\r\n\r\ndata: [DONE]\r\n\r\n'),
                };
            }
            return { done: true };
        });
        const harness = createHarness({
            executeLLM: async () => stream,
        });

        await harness.handleLLMExecutePost(req, res, {}, "execute");

        const frames = toSSEDataFrames(res.text())
            .filter((entry) => entry !== "[DONE]")
            .map((entry) => JSON.parse(entry));
        expect(frames.some((payload: Record<string, unknown>) => payload.type === "chunk" && payload.text === "Hi")).toBe(true);
        expect(frames.some((payload: Record<string, unknown>) => payload.type === "done")).toBe(true);
    });

    it("uses cleanup path for fallback SSE responses", async () => {
        const req = new MockReq();
        const res = new MockRes((chunk) => {
            if (chunk.includes('"type":"chunk"')) {
                req.emit("aborted");
            }
            return true;
        });
        const harness = createHarness({
            normalized: {
                endpoint: "execute",
                mode: "model",
                provider: "cohere",
                characterId: "",
                chatId: "",
                requestedStreaming: true,
                streaming: false,
                request: {},
            },
            executeLLM: async () => ({
                type: "success",
                result: "fallback-text",
            }),
        });

        await harness.handleLLMExecutePost(req, res, {}, "execute");

        expect(res.writableEnded).toBe(true);
        expect(harness.sendJson).not.toHaveBeenCalled();
    });

    it("fails streaming model response when output is reasoning-only", async () => {
        const encoder = new TextEncoder();
        const req = new MockReq();
        const res = new MockRes();
        let readCalls = 0;
        const { stream } = createStreamFromRead(async () => {
            readCalls += 1;
            if (readCalls === 1) {
                return {
                    done: false,
                    value: encoder.encode('data: {"choices":[{"delta":{"content":"<Thoughts>hidden</Thoughts>"}}]}\n\n'),
                };
            }
            return { done: true };
        });
        const harness = createHarness({
            executeLLM: async () => stream,
        });

        await harness.handleLLMExecutePost(req, res, {}, "execute");

        const lastAudit = harness.appendLLMAudit.mock.calls.at(-1)?.[0];
        expect(lastAudit?.status).toBe(502);
        expect(lastAudit?.ok).toBe(false);
        expect(lastAudit?.error?.error).toBe("EMPTY_VISIBLE_OUTPUT");

        const frames = toSSEDataFrames(res.text())
            .map((frame) => {
                try {
                    return JSON.parse(frame);
                } catch {
                    return null;
                }
            })
            .filter(Boolean);
        const errorFrame = frames.find((frame: Record<string, unknown>) => frame.type === "fail");
        expect(errorFrame).toBeTruthy();
        expect(String((errorFrame as Record<string, unknown>).message || "")).toContain("no visible content");
        expect((errorFrame as Record<string, unknown>).error).toBe("EMPTY_VISIBLE_OUTPUT");
        expect((errorFrame as Record<string, unknown>).status).toBe(502);
        expect((errorFrame as Record<string, unknown>).requestId).toBe("req-test");
        expect((errorFrame as Record<string, unknown>).endpoint).toBe("execute");
        expect(typeof (errorFrame as Record<string, unknown>).durationMs).toBe("number");
        expect(frames.find((frame: Record<string, unknown>) => frame.type === "done")).toBeUndefined();
    });
});

describe("execute_route_handler visible output guard", () => {
    it("tags /execute trace audits with execute_trace endpoint metadata", async () => {
        const req = new MockReq();
        const res = new MockRes();
        const harness = createHarness({
            normalized: {
                endpoint: "execute",
                mode: "emotion",
                provider: "openrouter",
                characterId: "",
                chatId: "",
                requestedStreaming: false,
                streaming: false,
                request: {},
            },
            executeLLM: async () => ({
                type: "success",
                result: "happy",
            }),
        });

        await harness.handleLLMExecutePost(req, res, {}, "execute");

        const traceAudit = harness.appendGenerateTraceAudit.mock.calls.at(-1)?.[0];
        expect(traceAudit?.endpoint).toBe("execute_trace");
        expect(traceAudit?.path).toBe("/data/llm/execute");
    });

    it("fails non-stream model response when output is reasoning-only", async () => {
        const req = new MockReq();
        const res = new MockRes();
        const harness = createHarness({
            normalized: {
                endpoint: "execute",
                mode: "model",
                provider: "openrouter",
                characterId: "",
                chatId: "",
                requestedStreaming: false,
                streaming: false,
                request: {},
            },
            executeLLM: async () => ({
                type: "success",
                result: "<Thoughts>\ninternal only\n</Thoughts>\n",
            }),
        });

        await harness.handleLLMExecutePost(req, res, {}, "execute");

        expect(harness.sendJson).toHaveBeenCalledTimes(1);
        const status = harness.sendJson.mock.calls[0]?.[1];
        const payload = harness.sendJson.mock.calls[0]?.[2];
        expect(status).toBe(502);
        expect(payload?.message || "").toContain("no visible content");
        const lastAudit = harness.appendLLMAudit.mock.calls.at(-1)?.[0];
        expect(lastAudit?.ok).toBe(false);
    });

    it("allows reasoning-only non-stream output for DeepSeek-V3.2-Speciale when toggle is enabled", async () => {
        const req = new MockReq();
        const res = new MockRes();
        const harness = createHarness({
            normalized: {
                endpoint: "execute",
                mode: "model",
                provider: "openrouter",
                model: "deepseek/deepseek-v3.2-speciale",
                characterId: "",
                chatId: "",
                requestedStreaming: false,
                streaming: false,
                request: {
                    allowReasoningOnlyForDeepSeekV32Speciale: true,
                },
            },
            executeLLM: async () => ({
                type: "success",
                result: "<Thoughts>\ninternal only\n</Thoughts>\n",
            }),
        });

        await harness.handleLLMExecutePost(req, res, {}, "execute");

        expect(harness.sendJson).toHaveBeenCalledTimes(1);
        const status = harness.sendJson.mock.calls[0]?.[1];
        const payload = harness.sendJson.mock.calls[0]?.[2];
        expect(status).toBe(200);
        expect(payload?.type).toBe("success");
        expect(typeof payload?.result).toBe("string");
        expect(payload?.result).toContain("<Thoughts>");
        const lastAudit = harness.appendLLMAudit.mock.calls.at(-1)?.[0];
        expect(lastAudit?.ok).toBe(true);
    });

    it("streams OpenRouter reasoning as normal content and dedupes overlap when DeepSeek-V3.2-Speciale toggle is enabled", async () => {
        const encoder = new TextEncoder();
        const req = new MockReq();
        const res = new MockRes();
        let readCalls = 0;
        const { stream } = createStreamFromRead(async () => {
            readCalls += 1;
            if (readCalls === 1) {
                return {
                    done: false,
                    value: encoder.encode('data: {"choices":[{"delta":{"reasoning":"internal step"}}]}\n\n'),
                };
            }
            if (readCalls === 2) {
                return {
                    done: false,
                    value: encoder.encode('data: {"choices":[{"delta":{"content":"internal step and visible"}}]}\n\n'),
                };
            }
            return { done: true };
        });
        const harness = createHarness({
            normalized: {
                endpoint: "execute",
                mode: "model",
                provider: "openrouter",
                model: "deepseek/deepseek-v3.2-speciale",
                characterId: "",
                chatId: "",
                requestedStreaming: true,
                streaming: true,
                request: {
                    allowReasoningOnlyForDeepSeekV32Speciale: true,
                },
            },
            executeLLM: async () => stream,
        });

        await harness.handleLLMExecutePost(req, res, {}, "execute");

        const frames = toSSEDataFrames(res.text())
            .map((frame) => {
                try {
                    return JSON.parse(frame);
                } catch {
                    return null;
                }
            })
            .filter(Boolean);
        const chunkTexts = frames
            .filter((frame: Record<string, unknown>) => frame.type === "chunk")
            .map((frame: Record<string, unknown>) => String(frame.text || ""))
            .join("");
        expect(chunkTexts).toBe("internal step and visible");
        expect(chunkTexts).not.toContain("<Thoughts>");
        expect(frames.find((frame: Record<string, unknown>) => frame.type === "fail")).toBeUndefined();
        expect(frames.find((frame: Record<string, unknown>) => frame.type === "done")).toBeTruthy();
        const lastAudit = harness.appendLLMAudit.mock.calls.at(-1)?.[0];
        expect(lastAudit?.ok).toBe(true);
    });
});
