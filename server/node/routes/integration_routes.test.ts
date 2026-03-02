import { afterEach, describe, expect, it, vi } from "vitest";

import { registerIntegrationRoutes } from "./integration_routes.cjs";

type MockReq = {
    method: string;
    headers: Record<string, string>;
    query: Record<string, string | string[]>;
    params: Record<string, string>;
    body?: unknown;
    ip: string;
};

type MockRes = {
    statusCode: number;
    body: Buffer;
    headersSent: boolean;
    headers: Record<string, string>;
    setHeader: (key: string, value: string) => void;
    status: (code: number) => MockRes;
    send: (payload: unknown) => void;
    write: (chunk: Buffer | string) => void;
    end: (chunk?: Buffer | string) => void;
};

function createMockRes(): MockRes {
    return {
        statusCode: 200,
        body: Buffer.alloc(0),
        headersSent: false,
        headers: {},
        setHeader(key: string, value: string) {
            this.headers[key.toLowerCase()] = String(value);
        },
        status(code: number) {
            this.statusCode = code;
            return this;
        },
        send(payload: unknown) {
            this.headersSent = true;
            if (Buffer.isBuffer(payload)) {
                this.body = payload;
                return;
            }
            if (typeof payload === "string") {
                this.body = Buffer.from(payload);
                return;
            }
            this.body = Buffer.from(JSON.stringify(payload));
        },
        write(chunk: Buffer | string) {
            const asBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            this.body = Buffer.concat([this.body, asBuffer]);
            this.headersSent = true;
        },
        end(chunk?: Buffer | string) {
            if (chunk !== undefined) {
                this.write(chunk);
                return;
            }
            this.headersSent = true;
        },
    };
}

function parseJsonBody(res: MockRes) {
    return JSON.parse(res.body.toString("utf-8"));
}

async function mockPipeline(stream: ReadableStream<Uint8Array> | null, res: MockRes) {
    if (!stream) {
        res.end();
        return;
    }
    const reader = stream.getReader();
    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }
        res.write(Buffer.from(value));
    }
    res.end();
}

function registerHandler() {
    let routeHandler: ((req: MockReq, res: MockRes, next?: (err?: unknown) => void) => Promise<void>) | null = null;
    const app = {
        all(_path: string, handler: typeof routeHandler) {
            routeHandler = handler;
        },
    };

    registerIntegrationRoutes({
        app,
        pipeline: mockPipeline,
    });

    if (!routeHandler) {
        throw new Error("integration route handler not registered");
    }
    return routeHandler;
}

function createReq(partial: Partial<MockReq>): MockReq {
    return {
        method: partial.method ?? "GET",
        headers: partial.headers ?? {},
        query: partial.query ?? {},
        params: partial.params ?? { 0: "history" },
        body: partial.body,
        ip: partial.ip ?? "127.0.0.1",
    };
}

async function invokeRoute(
    handler: (req: MockReq, res: MockRes, next?: (err?: unknown) => void) => Promise<void>,
    req: MockReq,
): Promise<MockRes> {
    const res = createMockRes();
    await handler(req, res, () => {});
    return res;
}

afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.RISU_COMFY_ALLOWED_HOSTS;
});

describe("integration_routes comfy proxy", () => {
    it("proxies prompt/history/view flow through /data/integrations/comfy/*", async () => {
        const fetchMock = vi.fn(async (url: string) => {
            if (url.endsWith("/prompt")) {
                return new Response(JSON.stringify({ prompt_id: "prompt-1" }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }
            if (url.endsWith("/history")) {
                return new Response(JSON.stringify({
                    "prompt-1": {
                        outputs: {
                            "9": {
                                images: [{ filename: "generated.png", subfolder: "", type: "output" }],
                            },
                        },
                    },
                }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }
            if (url.includes("/view?")) {
                return new Response(new Uint8Array([1, 2, 3]), {
                    status: 200,
                    headers: { "content-type": "image/png" },
                });
            }
            return new Response("not found", { status: 404 });
        });
        vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

        const handler = registerHandler();
        const baseHeader = encodeURIComponent("http://127.0.0.1:8188");

        const promptRes = await invokeRoute(handler, createReq({
            method: "POST",
            params: { 0: "prompt" },
            headers: {
                "x-risu-comfy-base": baseHeader,
                "x-risu-comfy-headers": encodeURIComponent(JSON.stringify({ "content-type": "application/json" })),
            },
            body: { prompt: { node: "value" } },
        }));

        expect(promptRes.statusCode).toBe(200);
        expect(parseJsonBody(promptRes).prompt_id).toBe("prompt-1");

        const historyRes = await invokeRoute(handler, createReq({
            method: "GET",
            params: { 0: "history" },
            headers: {
                "x-risu-comfy-base": baseHeader,
                "x-risu-comfy-headers": encodeURIComponent("{}"),
            },
        }));

        expect(historyRes.statusCode).toBe(200);
        expect(parseJsonBody(historyRes)["prompt-1"]).toBeTruthy();

        const viewRes = await invokeRoute(handler, createReq({
            method: "GET",
            params: { 0: "view" },
            headers: {
                "x-risu-comfy-base": baseHeader,
                "x-risu-comfy-headers": encodeURIComponent("{}"),
            },
            query: {
                filename: "generated.png",
                subfolder: "",
                type: "output",
            },
        }));

        expect(viewRes.statusCode).toBe(200);
        expect(viewRes.headers["content-type"]).toMatch(/image\/png/);
        expect(Array.from(viewRes.body.values())).toEqual([1, 2, 3]);

        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(fetchMock.mock.calls[0][0]).toBe("http://127.0.0.1:8188/prompt");
        expect(fetchMock.mock.calls[1][0]).toBe("http://127.0.0.1:8188/history");
        expect(String(fetchMock.mock.calls[2][0])).toContain("http://127.0.0.1:8188/view?");
    });

    it("supports auth boundary simulation for unauthorized/authorized requests", async () => {
        const handler = registerHandler();
        const baseReq = createReq({
            method: "GET",
            params: { 0: "history" },
            headers: {
                "x-risu-comfy-base": encodeURIComponent("http://127.0.0.1:8188"),
                "x-risu-comfy-headers": encodeURIComponent("{}"),
            },
        });

        const authBoundary = async (req: MockReq) => {
            const res = createMockRes();
            if (req.headers["risu-auth"] !== "ok") {
                res.status(401).send({ error: "UNAUTHORIZED", message: "Unauthorized" });
                return res;
            }
            return await invokeRoute(handler, req);
        };

        const unauthorized = await authBoundary(baseReq);
        expect(unauthorized.statusCode).toBe(401);

        vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch);
        const authorized = await authBoundary(createReq({
            ...baseReq,
            headers: {
                ...baseReq.headers,
                "risu-auth": "ok",
            },
        }));
        expect(authorized.statusCode).toBe(200);
    });

    it("enforces allowlist and rejects forbidden hosts", async () => {
        process.env.RISU_COMFY_ALLOWED_HOSTS = "127.0.0.2";
        const handler = registerHandler();

        const response = await invokeRoute(handler, createReq({
            method: "GET",
            params: { 0: "history" },
            headers: {
                "x-risu-comfy-base": encodeURIComponent("http://127.0.0.1:8188"),
                "x-risu-comfy-headers": encodeURIComponent("{}"),
            },
        }));

        expect(response.statusCode).toBe(403);
        const body = parseJsonBody(response);
        expect(body.error).toBe("COMFY_BASE_FORBIDDEN");
        expect(body.message).toContain("not allowed");
    });
});
