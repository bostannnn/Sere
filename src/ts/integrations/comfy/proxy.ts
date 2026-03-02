import type { ComfyCommanderConfig } from "src/ts/storage/database.svelte";
import { normalizeComfyBaseUrl, type ComfyImageDescriptor } from "./types";
import { fetchWithServerAuth } from "src/ts/storage/serverAuth";

const comfyProxyLog = (..._args: unknown[]) => {};

function toHeadersRecord(headers: HeadersInit | undefined): Record<string, string> {
    const record: Record<string, string> = {};
    if (!headers) {
        return record;
    }

    if (headers instanceof Headers) {
        for (const [key, value] of headers.entries()) {
            record[key] = value;
        }
        return record;
    }

    if (Array.isArray(headers)) {
        for (const [key, value] of headers) {
            record[String(key)] = String(value);
        }
        return record;
    }

    for (const [key, value] of Object.entries(headers)) {
        if (value === undefined) {
            continue;
        }
        record[key] = String(value);
    }
    return record;
}

function normalizeComfyPath(path: string): string {
    return path.replace(/^\/+/, "");
}

async function parseComfyError(response: Response): Promise<string> {
    let bodyText = "";
    try {
        bodyText = await response.text();
    } catch {
        bodyText = "";
    }

    if (bodyText) {
        try {
            const parsed = JSON.parse(bodyText) as { message?: string; error?: string };
            if (typeof parsed?.message === "string" && parsed.message.trim()) {
                return parsed.message.trim();
            }
            if (typeof parsed?.error === "string" && parsed.error.trim()) {
                return parsed.error.trim();
            }
        } catch {
            // ignore non-json body
        }
        const plain = bodyText.trim();
        if (plain) {
            return plain;
        }
    }

    return `Request failed (${response.status})`;
}

export async function fetchComfyProxy(
    config: ComfyCommanderConfig,
    path: string,
    init: RequestInit = {},
): Promise<Response> {
    const normalizedBase = normalizeComfyBaseUrl(config.baseUrl);
    const baseUrl = new URL(normalizedBase);
    const normalizedPath = normalizeComfyPath(path);
    if (!normalizedPath) {
        throw new Error("Missing comfy proxy path");
    }

    const forwardHeaders = toHeadersRecord(init.headers);
    const proxyHeaders = new Headers();
    proxyHeaders.set("x-risu-comfy-base", encodeURIComponent(baseUrl.origin));
    proxyHeaders.set("x-risu-comfy-headers", encodeURIComponent(JSON.stringify(forwardHeaders)));

    const contentType = forwardHeaders["content-type"] ?? forwardHeaders["Content-Type"];
    if (contentType) {
        proxyHeaders.set("Content-Type", contentType);
    }

    const response = await fetchWithServerAuth(
        `/data/integrations/comfy/${normalizedPath}`,
        {
            method: init.method ?? "GET",
            headers: proxyHeaders,
            body: init.body,
            cache: init.cache,
            signal: init.signal,
            credentials: init.credentials,
            redirect: init.redirect,
            mode: init.mode,
            referrer: init.referrer,
            referrerPolicy: init.referrerPolicy,
            integrity: init.integrity,
            keepalive: init.keepalive,
        },
    );

    if (!response.ok) {
        const message = await parseComfyError(response);
        throw new Error(`${message} (${response.status})`);
    }

    if (config.debug) {
        comfyProxyLog("[ComfyProxy] Request OK", {
            path: normalizedPath,
            status: response.status,
        });
    }

    return response;
}

export async function queueComfyPrompt(
    config: ComfyCommanderConfig,
    prompt: Record<string, unknown>,
): Promise<string> {
    const response = await fetchComfyProxy(config, "prompt", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
    });

    const payload = await response.json() as { prompt_id?: string };
    const promptId = typeof payload.prompt_id === "string" ? payload.prompt_id.trim() : "";
    if (!promptId) {
        throw new Error("Comfy did not return prompt_id");
    }
    return promptId;
}

export async function fetchComfyHistory(config: ComfyCommanderConfig): Promise<Record<string, unknown>> {
    const response = await fetchComfyProxy(config, "history", {
        method: "GET",
    });
    const payload = await response.json();
    if (!payload || typeof payload !== "object") {
        throw new Error("Invalid Comfy history response");
    }
    return payload as Record<string, unknown>;
}

export async function fetchComfyImageBlob(
    config: ComfyCommanderConfig,
    descriptor: ComfyImageDescriptor,
): Promise<Blob> {
    const query = new URLSearchParams({
        filename: descriptor.filename,
        subfolder: descriptor.subfolder,
        type: descriptor.type,
    });

    const response = await fetchComfyProxy(config, `view?${query.toString()}`, {
        method: "GET",
    });
    return await response.blob();
}
