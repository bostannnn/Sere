import { getFetchData, getServerLLMLogs, type ServerLLMLogEntry } from "src/ts/globalApi.svelte";
import { isNodeServer } from "src/ts/platform";
import type { ChatMessageLike, ChatStateLike, RequestDataInfo, RequestDataPayload } from "./types";

function beautifyJSON(data: string) {
    try {
        return JSON.stringify(JSON.parse(data), null, 2);
    } catch {
        return data;
    }
}

function parseMaybeJson(value: unknown): unknown {
    if (typeof value !== "string") {
        return value;
    }
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

function stringifyPretty(value: unknown): string {
    try {
        if (typeof value === "string") {
            return beautifyJSON(value);
        }
        return JSON.stringify(value ?? null, null, 2);
    } catch {
        return String(value);
    }
}

function getLastUserMessageContent(messages: ChatMessageLike[], startIndex: number): string {
    for (let idx = startIndex; idx >= 0; idx--) {
        const msg = messages[idx];
        if (msg?.role === "user" && typeof msg.data === "string" && msg.data.trim()) {
            return msg.data.trim();
        }
    }
    return "";
}

function extractRequestMessages(requestPayload: unknown): unknown[] {
    const request = parseMaybeJson(requestPayload);
    if (!request || typeof request !== "object") {
        return [];
    }
    const root = request as Record<string, unknown>;
    const nested = root.request && typeof root.request === "object"
        ? root.request as Record<string, unknown>
        : root;

    if (Array.isArray(nested.messages)) {
        return nested.messages;
    }

    const requestBody = nested.requestBody && typeof nested.requestBody === "object"
        ? nested.requestBody as Record<string, unknown>
        : null;
    if (requestBody && Array.isArray(requestBody.messages)) {
        return requestBody.messages;
    }

    return [];
}

function extractLastUserMessageFromDurableLog(log: ServerLLMLogEntry): string {
    const messages = extractRequestMessages(log.request);
    for (let idx = messages.length - 1; idx >= 0; idx--) {
        const msg = messages[idx] as { role?: unknown; content?: unknown } | undefined;
        if (msg?.role !== "user") {
            continue;
        }
        if (typeof msg.content === "string" && msg.content.trim()) {
            return msg.content.trim();
        }
        if (Array.isArray(msg.content)) {
            const joined = msg.content
                .map((part) => {
                    if (typeof part === "string") {
                        return part;
                    }
                    if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") {
                        return (part as { text: string }).text;
                    }
                    return "";
                })
                .filter(Boolean)
                .join("\n")
                .trim();
            if (joined) {
                return joined;
            }
        }
    }
    return "";
}

function extractModelFromDurableLog(log: ServerLLMLogEntry): string {
    const request = parseMaybeJson(log.request);
    if (!request || typeof request !== "object") {
        return "";
    }

    const root = request as Record<string, unknown>;
    const nested = root.request && typeof root.request === "object"
        ? root.request as Record<string, unknown>
        : root;
    if (typeof nested.model === "string" && nested.model.trim()) {
        return nested.model.trim();
    }

    const requestBody = nested.requestBody && typeof nested.requestBody === "object"
        ? nested.requestBody as Record<string, unknown>
        : null;
    if (requestBody && typeof requestBody.model === "string" && requestBody.model.trim()) {
        return requestBody.model.trim();
    }

    return "";
}

function pickBestDurableLog(
    logs: ServerLLMLogEntry[],
    targetTimeMs: number,
    targetUserMessage: string,
    targetModel = ""
): ServerLLMLogEntry | null {
    let best: ServerLLMLogEntry | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const log of logs) {
        if (log?.endpoint !== "generate") {
            continue;
        }
        if (typeof log.mode === "string" && log.mode && log.mode !== "model") {
            continue;
        }

        const ts = Date.parse(String(log.timestamp || ""));
        let score = Number.isFinite(ts) ? Math.abs(ts - targetTimeMs) : 1_000_000_000;
        if (Number.isFinite(ts)) {
            const delta = ts - targetTimeMs;
            if (delta < -2_000) {
                score += 120_000 + Math.abs(delta);
            } else if (delta > 180_000) {
                score += delta;
            }
        }

        const lastUser = extractLastUserMessageFromDurableLog(log);
        if (targetUserMessage && lastUser === targetUserMessage) {
            score -= 60_000;
        } else if (targetUserMessage && lastUser) {
            score += 60_000;
        }

        const logModel = extractModelFromDurableLog(log);
        if (targetModel && logModel === targetModel) {
            score -= 25_000;
        } else if (targetModel && logModel) {
            score += 25_000;
        }

        if (score < bestScore) {
            best = log;
            bestScore = score;
        }
    }

    return best;
}

export function formatCombinedRequestData(payload: RequestDataPayload): string {
    const sourceLabel = payload.source === "client"
        ? "Client request log (in-memory)"
        : "Server durable log fallback";

    return [
        "Log Source",
        sourceLabel,
        "",
        "URL",
        payload.url,
        "",
        "Request Body",
        payload.body,
        "",
        "Response",
        payload.response,
    ].join("\n");
}

export async function copyToClipboardSafe(text: string) {
    try {
        if (navigator?.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return;
        }
    } catch {
        // Fall back to document.execCommand in unsupported or non-secure contexts.
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand("copy");
    } finally {
        document.body.removeChild(textarea);
    }
}

export function createRequestDataLoader() {
    const requestDataCache: Record<string, Promise<RequestDataPayload | null>> = {};

    return async function loadRequestData(
        generationId: string,
        info: RequestDataInfo,
        context: {
            selectedCharId: number;
            chat: ChatStateLike | null;
        }
    ): Promise<RequestDataPayload | null> {
        const cacheKey = `${generationId}::${context.selectedCharId}::${info?.idx ?? -1}`;
        const cached = requestDataCache[cacheKey];
        if (cached) {
            return cached;
        }

        const pending = (async () => {
            const clientLog = getFetchData(generationId);
            if (clientLog) {
                return {
                    source: "client" as const,
                    url: clientLog.url,
                    body: stringifyPretty(clientLog.body),
                    response: stringifyPretty(clientLog.response),
                };
            }

            if (!isNodeServer || !info || !context.chat) {
                return null;
            }

            const messages = Array.isArray(context.chat.message) ? context.chat.message : [];
            if (!context.chat.id || messages.length === 0) {
                return null;
            }

            const message = messages[info.idx] as ChatMessageLike | undefined;
            const targetTimeMs = Number.isFinite(Number(message?.time))
                ? Number(message?.time)
                : Date.now();
            const targetUserMessage = getLastUserMessageContent(messages, info.idx - 1);
            const targetModel = typeof info.genInfo?.model === "string" ? info.genInfo.model : "";

            const logs = await getServerLLMLogs({ limit: 200, chatId: context.chat.id });
            if (!Array.isArray(logs) || logs.length === 0) {
                return null;
            }

            const best = pickBestDurableLog(logs, targetTimeMs, targetUserMessage, targetModel);
            if (!best) {
                return null;
            }

            const path = typeof best.path === "string" && best.path ? best.path : "/data/llm/generate";
            const meta = {
                source: "durable_server_log",
                requestId: best.requestId ?? null,
                timestamp: best.timestamp ?? null,
                status: best.status ?? null,
                ok: best.ok ?? null,
                durationMs: best.durationMs ?? null,
            };

            return {
                source: "server" as const,
                url: `${path} [req:${best.requestId ?? "-"}]`,
                body: stringifyPretty(parseMaybeJson(best.request)),
                response: stringifyPretty({
                    meta,
                    response: parseMaybeJson(best.response),
                    error: parseMaybeJson(best.error),
                }),
            };
        })();

        requestDataCache[cacheKey] = pending;
        return pending;
    };
}
