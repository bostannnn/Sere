<script lang="ts">
    import { CheckIcon, ChevronDownIcon, ChevronUpIcon, CopyIcon, XIcon } from "@lucide/svelte";
    import hljs from "highlight.js/lib/core";
    import json from "highlight.js/lib/languages/json";
    import DOMPurify from "dompurify";
    import { onMount } from "svelte";
    import { language } from "src/lang";
    import Button from "src/lib/UI/GUI/Button.svelte";
    import { getFetchLogs, getServerLLMLogs, type ServerLLMLogEntry } from "src/ts/globalApi.svelte";
    import { isNodeServer } from "src/ts/platform";
    import { alertStore } from "src/ts/stores.svelte";

    interface Props {
        mode?: "modal" | "page";
        title?: string;
        onClose?: () => void;
    }

    const {
        mode = "page",
        title = language.ShowLog,
        onClose,
    }: Props = $props();

    const isModal = $derived(mode === "modal");
    const requestLogsViewerLog = (..._args: unknown[]) => {};

    type ClientLogRecord = {
        body?: unknown
        header?: unknown
        response?: unknown
        success?: boolean
        date?: string
        url?: string
        chatId?: string
        status?: number
        mode?: unknown
        provider?: unknown
        request?: unknown
        requestBody?: unknown
        model?: unknown
        endpoint?: unknown
        path?: unknown
    }

    let expandedLogs: Set<number> = $state(new Set());
    let allExpanded = $state(false);
    let expandedServerLogs: Set<number> = $state(new Set());
    let allServerExpanded = $state(false);
    let copiedKey: string | null = $state(null);
    let serverLogs: ServerLLMLogEntry[] = $state([]);
    let serverLogsLoading = $state(false);
    let serverLogsError = $state("");
    const logs = $derived(getFetchLogs());

    if (!hljs.getLanguage("json")) {
        hljs.registerLanguage("json", json);
    }

    function handleClose() {
        if (onClose) {
            onClose();
            return;
        }
        alertStore.set({ type: "none", msg: "" });
    }

    function beautifyJSON(data: string) {
        try {
            return JSON.stringify(JSON.parse(data), null, 2);
        } catch {
            return data;
        }
    }

    function highlightJson(code: unknown): string {
        const text = (() => {
            if (typeof code === "string") {
                return code;
            }
            if (code === undefined) {
                return "null";
            }
            try {
                return JSON.stringify(code ?? null, null, 2);
            } catch {
                return String(code);
            }
        })();
        try {
            return DOMPurify.sanitize(hljs.highlight(text, { language: "json" }).value);
        } catch {
            return DOMPurify.sanitize(text.replace(/</g, "&lt;").replace(/>/g, "&gt;"));
        }
    }

    async function copyToClipboard(text: string, key: string) {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            const textarea = document.createElement("textarea");
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            document.body.removeChild(textarea);
        }
        copiedKey = key;
        setTimeout(() => {
            if (copiedKey === key) copiedKey = null;
        }, 1500);
    }

    function toJsonString(data: unknown) {
        try {
            if (typeof data === "string") {
                return beautifyJSON(data);
            }
            return JSON.stringify(data ?? null, null, 2);
        } catch {
            return String(data);
        }
    }

    function parseMaybeJson(data: unknown): unknown {
        if (typeof data !== "string") {
            return data;
        }
        try {
            return JSON.parse(data);
        } catch {
            return data;
        }
    }

    function normalizeMeta(value: unknown): string {
        if (typeof value !== "string") {
            return "";
        }
        const normalized = value.trim();
        return normalized;
    }

    function shortId(value: unknown, max = 8): string {
        const text = normalizeMeta(value);
        if (!text) {
            return "";
        }
        if (text.length <= max) {
            return text;
        }
        return `${text.slice(0, max)}...`;
    }

    function extractModelFromPayload(payload: ClientLogRecord | null | undefined): string {
        const request = payload?.request as ClientLogRecord | undefined;
        const requestBody = payload?.requestBody as ClientLogRecord | undefined;
        const response = payload?.response as ClientLogRecord | undefined;
        const requestRequestBody = request?.requestBody as ClientLogRecord | undefined;
        const responseRequest = response?.request as ClientLogRecord | undefined;
        const candidates = [
            requestRequestBody?.model,
            request?.model,
            requestBody?.model,
            payload?.model,
            responseRequest?.model,
        ];
        for (const candidate of candidates) {
            const model = normalizeMeta(candidate);
            if (model) {
                return model;
            }
        }
        return "";
    }

    function inferEndpointFromUrl(url: string): string {
        const raw = normalizeMeta(url);
        if (!raw) {
            return "";
        }
        try {
            const parsed = new URL(raw, window.location.origin);
            const path = parsed.pathname;
            if (path.includes("/data/llm/generate")) return "generate";
            if (path.includes("/data/llm/execute")) return "execute";
            if (path.includes("/data/llm/preview")) return "preview";
            if (path.includes("/data/llm/logs")) return "logs";
            if (path.includes("/data/rag")) return "rag";
            if (path.includes("/data/proxy")) return "proxy";
            return path || raw;
        } catch {
            return raw;
        }
    }

    function getClientLogMeta(log: ClientLogRecord) {
        const body = parseMaybeJson(log?.body) as ClientLogRecord | null;
        const response = parseMaybeJson(log?.response) as ClientLogRecord | null;
        const request = body?.request as ClientLogRecord | undefined;
        const modeValue = normalizeMeta(body?.mode ?? request?.mode);
        const provider = normalizeMeta(body?.provider) ||
            (String(log?.url ?? "").includes("openrouter.ai") ? "openrouter" : "");
        const model = extractModelFromPayload(body) || extractModelFromPayload(response);
        const endpoint = inferEndpointFromUrl(String(log?.url ?? ""));
        const chatId = normalizeMeta(log?.chatId ?? body?.chatId ?? request?.chatId);
        return { mode: modeValue, provider, model, endpoint, chatId };
    }

    function getServerLogMeta(log: ServerLLMLogEntry) {
        const request = parseMaybeJson(log?.request) as ClientLogRecord | null;
        const response = parseMaybeJson(log?.response) as ClientLogRecord | null;
        const nestedRequest = request?.request as ClientLogRecord | undefined;
        const modeValue = normalizeMeta(log?.mode ?? request?.mode);
        const provider = normalizeMeta(log?.provider ?? request?.provider);
        const model = extractModelFromPayload(request) || extractModelFromPayload(response);
        const endpoint = normalizeMeta(log?.endpoint ?? log?.path);
        const chatId = normalizeMeta(log?.chatId ?? request?.chatId ?? nestedRequest?.chatId);
        const requestId = normalizeMeta(log?.requestId);
        return { mode: modeValue, provider, model, endpoint, chatId, requestId };
    }

    function getClientLogExport(log: ClientLogRecord) {
        const meta = getClientLogMeta(log);
        return toJsonString({
            timestamp: log?.date ?? null,
            status: log?.status ?? null,
            success: !!log?.success,
            url: log?.url ?? "",
            chatId: log?.chatId ?? null,
            meta,
            requestBody: parseMaybeJson(log?.body),
            requestHeader: parseMaybeJson(log?.header),
            response: parseMaybeJson(log?.response),
        });
    }

    function getServerLogExport(log: ServerLLMLogEntry) {
        const meta = getServerLogMeta(log);
        return toJsonString({
            timestamp: log?.timestamp ?? null,
            requestId: log?.requestId ?? null,
            method: log?.method ?? null,
            path: log?.path ?? null,
            status: log?.status ?? null,
            ok: !!log?.ok,
            durationMs: log?.durationMs ?? null,
            meta,
            request: parseMaybeJson(log?.request),
            response: parseMaybeJson(log?.response),
            error: parseMaybeJson(log?.error),
        });
    }

    async function loadServerLogs() {
        if (!isNodeServer) {
            return;
        }
        serverLogsLoading = true;
        serverLogsError = "";
        try {
            serverLogs = await getServerLLMLogs({ limit: 100 });
        } catch (error) {
            serverLogs = [];
            serverLogsError = String(error);
        } finally {
            serverLogsLoading = false;
        }
    }

    onMount(() => {
        if (isNodeServer) {
            loadServerLogs().catch((error) => {
                requestLogsViewerLog("Failed to load server logs:", error);
            });
        }
    });

    $effect(() => {
        if (!isModal) {
            expandedLogs = new Set(logs.map((_, i) => i));
            allExpanded = true;
        }
    });

    $effect(() => {
        if (!isModal) {
            expandedServerLogs = new Set(serverLogs.map((_, i) => i));
            allServerExpanded = true;
        }
    });
</script>

<div
    class="alert-requestlog-overlay"
    class:alert-requestlog-overlay-page={!isModal}
>
    <div
        class="alert-requestlog-shell panel-shell"
        class:alert-requestlog-modal={isModal}
        class:alert-requestlog-page={!isModal}
    >
    <div class="alert-requestlog-header">
        <h1 class="alert-requestlog-title">{title}</h1>
        <div class="alert-requestlog-header-actions action-rail">
            {#if isModal}
                <Button size="sm" onclick={() => {
                    if (allExpanded) {
                        expandedLogs = new Set();
                    } else {
                        expandedLogs = new Set(logs.map((_, i) => i));
                    }
                    allExpanded = !allExpanded;
                }}>
                    {allExpanded ? language.collapseAll : language.expandAll}
                </Button>
            {/if}
            {#if isModal}
                <button
                    type="button"
                    class="alert-requestlog-close icon-btn icon-btn--sm"
                    title="Close request logs"
                    aria-label="Close request logs"
                    onclick={handleClose}
                >
                    <XIcon />
                </button>
            {/if}
        </div>
    </div>
    <div class="alert-requestlog-body">
        <div class="alert-requestlog-section-title">
            Client Request Logs ({logs.length})
        </div>
        {#if logs.length === 0}
            <div class="alert-requestlog-empty empty-state">
                {language.noRequestLogs}
            </div>
        {:else}
            <div class="alert-requestlog-list list-shell">
                {#each logs as log, i (i)}
                    {@const isExpanded = expandedLogs.has(i)}
                    {@const showDetail = isModal ? isExpanded : true}
                    {@const meta = getClientLogMeta(log)}
                    <div class="alert-requestlog-card panel-shell">
                        <button
                            type="button"
                            class="alert-requestlog-toggle"
                            class:alert-requestlog-toggle-static={!isModal}
                            title={isModal ? (isExpanded ? "Collapse log entry" : "Expand log entry") : "Request log entry"}
                            aria-label={isModal ? (isExpanded ? "Collapse request log entry" : "Expand request log entry") : "Request log entry"}
                            aria-expanded={isModal ? isExpanded : true}
                            onclick={() => {
                                if (!isModal) {
                                    return;
                                }
                                const newSet = new Set(expandedLogs);
                                if (isExpanded) {
                                    newSet.delete(i);
                                } else {
                                    newSet.add(i);
                                }
                                expandedLogs = newSet;
                            }}
                        >
                            <div class="alert-requestlog-toggle-main">
                                <span
                                    class="request-log-status-badge control-chip"
                                    class:request-log-status-success={log.success}
                                    class:request-log-status-error={!log.success}
                                >
                                    {log.status ?? (log.success ? "OK" : "ERR")}
                                </span>
                                <div class="alert-requestlog-main-content">
                                    <span class="alert-requestlog-url" title={log.url}>
                                        {log.url}
                                    </span>
                                    <div class="alert-requestlog-meta-row">
                                        {#if meta.endpoint}
                                            <span class="request-log-meta-badge control-chip">endpoint: {meta.endpoint}</span>
                                        {/if}
                                        {#if meta.mode}
                                            <span class="request-log-meta-badge control-chip">mode: {meta.mode}</span>
                                        {/if}
                                        {#if meta.provider}
                                            <span class="request-log-meta-badge control-chip">provider: {meta.provider}</span>
                                        {/if}
                                        {#if meta.model}
                                            <span class="request-log-meta-badge request-log-meta-badge-model control-chip" title={meta.model}>model: {meta.model}</span>
                                        {/if}
                                        {#if meta.chatId}
                                            <span class="request-log-meta-badge control-chip">chat: {shortId(meta.chatId)}</span>
                                        {/if}
                                    </div>
                                </div>
                                <span class="alert-requestlog-date">{log.date}</span>
                            </div>
                            <div class="alert-requestlog-chevron">
                                {#if isModal}
                                    {#if isExpanded}
                                        <ChevronUpIcon size={20} />
                                    {:else}
                                        <ChevronDownIcon size={20} />
                                    {/if}
                                {/if}
                            </div>
                        </button>
                        {#if showDetail}
                            <div class="alert-requestlog-detail">
                                <div class="alert-requestlog-detail-stack">
                                    <div>
                                        <div class="alert-requestlog-detail-header">
                                            <span class="alert-requestlog-detail-label">Summary</span>
                                            <button
                                                type="button"
                                                class="request-log-copy-btn icon-btn icon-btn--sm"
                                                class:request-log-copy-btn-copied={copiedKey === `${i}-entry`}
                                                aria-label="Copy full client log entry"
                                                onclick={(e) => { e.stopPropagation(); copyToClipboard(getClientLogExport(log), `${i}-entry`); }}
                                                title="Copy Full Log"
                                            >
                                                {#if copiedKey === `${i}-entry`}
                                                    <CheckIcon size={14} />
                                                {:else}
                                                    <CopyIcon size={14} />
                                                {/if}
                                            </button>
                                        </div>
                                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                                        <pre class="request-log-code hljs">{@html highlightJson(toJsonString({
                                            endpoint: meta.endpoint,
                                            mode: meta.mode,
                                            provider: meta.provider,
                                            model: meta.model,
                                            chatId: meta.chatId,
                                            status: log.status ?? null,
                                            success: !!log.success,
                                        }))}</pre>
                                    </div>
                                    <div>
                                        <div class="alert-requestlog-detail-header">
                                            <span class="alert-requestlog-detail-label">URL</span>
                                            <button
                                                type="button"
                                                class="request-log-copy-btn icon-btn icon-btn--sm"
                                                class:request-log-copy-btn-copied={copiedKey === `${i}-url`}
                                                aria-label="Copy request URL"
                                                onclick={(e) => { e.stopPropagation(); copyToClipboard(log.url, `${i}-url`); }}
                                                title="Copy"
                                            >
                                                {#if copiedKey === `${i}-url`}
                                                    <CheckIcon size={14} />
                                                {:else}
                                                    <CopyIcon size={14} />
                                                {/if}
                                            </button>
                                        </div>
                                        <pre class="request-log-code hljs alert-text-sm">{log.url}</pre>
                                    </div>
                                    <div>
                                        <div class="alert-requestlog-detail-header">
                                            <span class="alert-requestlog-detail-label">Request Body</span>
                                            <button
                                                type="button"
                                                class="request-log-copy-btn icon-btn icon-btn--sm"
                                                class:request-log-copy-btn-copied={copiedKey === `${i}-body`}
                                                aria-label="Copy request body"
                                                onclick={(e) => { e.stopPropagation(); copyToClipboard(toJsonString(log.body), `${i}-body`); }}
                                                title="Copy"
                                            >
                                                {#if copiedKey === `${i}-body`}
                                                    <CheckIcon size={14} />
                                                {:else}
                                                    <CopyIcon size={14} />
                                                {/if}
                                            </button>
                                        </div>
                                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                                        <pre class="request-log-code hljs">{@html highlightJson(log.body)}</pre>
                                    </div>
                                    <div>
                                        <div class="alert-requestlog-detail-header">
                                            <span class="alert-requestlog-detail-label">Request Header</span>
                                            <button
                                                type="button"
                                                class="request-log-copy-btn icon-btn icon-btn--sm"
                                                class:request-log-copy-btn-copied={copiedKey === `${i}-header`}
                                                aria-label="Copy request header"
                                                onclick={(e) => { e.stopPropagation(); copyToClipboard(toJsonString(log.header), `${i}-header`); }}
                                                title="Copy"
                                            >
                                                {#if copiedKey === `${i}-header`}
                                                    <CheckIcon size={14} />
                                                {:else}
                                                    <CopyIcon size={14} />
                                                {/if}
                                            </button>
                                        </div>
                                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                                        <pre class="request-log-code hljs request-log-code-max-32">{@html highlightJson(log.header)}</pre>
                                    </div>
                                    <div>
                                        <div class="alert-requestlog-detail-header">
                                            <span class="alert-requestlog-detail-label">Response</span>
                                            <button
                                                type="button"
                                                class="request-log-copy-btn icon-btn icon-btn--sm"
                                                class:request-log-copy-btn-copied={copiedKey === `${i}-response`}
                                                aria-label="Copy response body"
                                                onclick={(e) => { e.stopPropagation(); copyToClipboard(toJsonString(log.response), `${i}-response`); }}
                                                title="Copy"
                                            >
                                                {#if copiedKey === `${i}-response`}
                                                    <CheckIcon size={14} />
                                                {:else}
                                                    <CopyIcon size={14} />
                                                {/if}
                                            </button>
                                        </div>
                                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                                        <pre class="request-log-code hljs request-log-code-max-64">{@html highlightJson(log.response)}</pre>
                                    </div>
                                </div>
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        {/if}

        {#if isNodeServer}
                    <div class="alert-requestlog-server-section">
                <div class="alert-requestlog-server-header">
                    <div class="alert-requestlog-section-title">Server LLM Logs (Durable) ({serverLogs.length})</div>
                    <div class="alert-requestlog-header-actions action-rail">
                        {#if isModal}
                            <Button size="sm" onclick={() => {
                                if (allServerExpanded) {
                                    expandedServerLogs = new Set();
                                } else {
                                    expandedServerLogs = new Set(serverLogs.map((_, i) => i));
                                }
                                allServerExpanded = !allServerExpanded;
                            }}>
                                {allServerExpanded ? language.collapseAll : language.expandAll}
                            </Button>
                        {/if}
                        <Button size="sm" onclick={loadServerLogs} disabled={serverLogsLoading}>
                            {serverLogsLoading ? "Loading..." : "Refresh"}
                        </Button>
                    </div>
                </div>

                {#if serverLogsError}
                    <div class="alert-note-danger alert-text-sm break-any alert-requestlog-error">{serverLogsError}</div>
                {/if}

                {#if serverLogsLoading && serverLogs.length === 0}
                    <div class="alert-requestlog-empty empty-state">Loading server logs...</div>
                {:else if serverLogs.length === 0}
                    <div class="alert-requestlog-empty empty-state">No server LLM logs yet.</div>
                {:else}
                    <div class="alert-requestlog-list list-shell">
                        {#each serverLogs as log, i (i)}
                            {@const isExpanded = expandedServerLogs.has(i)}
                            {@const showDetail = isModal ? isExpanded : true}
                            {@const meta = getServerLogMeta(log)}
                            <div class="alert-requestlog-card panel-shell">
                                <button
                                    type="button"
                                    class="alert-requestlog-toggle"
                                    class:alert-requestlog-toggle-static={!isModal}
                                    title={isModal ? (isExpanded ? "Collapse server log entry" : "Expand server log entry") : "Server log entry"}
                                    aria-label={isModal ? (isExpanded ? "Collapse server log entry" : "Expand server log entry") : "Server log entry"}
                                    aria-expanded={isModal ? isExpanded : true}
                                    onclick={() => {
                                        if (!isModal) {
                                            return;
                                        }
                                        const next = new Set(expandedServerLogs);
                                        if (isExpanded) {
                                            next.delete(i);
                                        } else {
                                            next.add(i);
                                        }
                                        expandedServerLogs = next;
                                    }}
                                >
                                    <div class="alert-requestlog-toggle-main">
                                        <span
                                            class="request-log-status-badge control-chip"
                                            class:request-log-status-success={!!log.ok}
                                            class:request-log-status-error={!log.ok}
                                        >
                                            {log.status ?? (log.ok ? "OK" : "ERR")}
                                        </span>
                                        <div class="alert-requestlog-main-content">
                                            <span class="alert-requestlog-url" title={String(log.path ?? log.endpoint ?? "")}>
                                                {log.path ?? log.endpoint ?? "LLM Request"}
                                            </span>
                                            <div class="alert-requestlog-meta-row">
                                                {#if meta.endpoint}
                                                    <span class="request-log-meta-badge control-chip">endpoint: {meta.endpoint}</span>
                                                {/if}
                                                {#if meta.mode}
                                                    <span class="request-log-meta-badge control-chip">mode: {meta.mode}</span>
                                                {/if}
                                                {#if meta.provider}
                                                    <span class="request-log-meta-badge control-chip">provider: {meta.provider}</span>
                                                {/if}
                                                {#if meta.model}
                                                    <span class="request-log-meta-badge request-log-meta-badge-model control-chip" title={meta.model}>model: {meta.model}</span>
                                                {/if}
                                                {#if meta.chatId}
                                                    <span class="request-log-meta-badge control-chip">chat: {shortId(meta.chatId)}</span>
                                                {/if}
                                                {#if meta.requestId}
                                                    <span class="request-log-meta-badge control-chip">req: {shortId(meta.requestId)}</span>
                                                {/if}
                                                {#if typeof log.durationMs === "number"}
                                                    <span class="request-log-meta-badge control-chip">time: {log.durationMs}ms</span>
                                                {/if}
                                            </div>
                                        </div>
                                        <span class="alert-requestlog-date">{log.timestamp ?? "-"}</span>
                                    </div>
                                    <div class="alert-requestlog-chevron">
                                        {#if isModal}
                                            {#if isExpanded}
                                                <ChevronUpIcon size={20} />
                                            {:else}
                                                <ChevronDownIcon size={20} />
                                            {/if}
                                        {/if}
                                    </div>
                                </button>
                                {#if showDetail}
                                    <div class="alert-requestlog-detail">
                                        <div class="alert-requestlog-detail-stack">
                                            <div>
                                                <div class="alert-requestlog-detail-header">
                                                    <span class="alert-requestlog-detail-label">Summary</span>
                                                    <button
                                                        type="button"
                                                        class="request-log-copy-btn icon-btn icon-btn--sm"
                                                        class:request-log-copy-btn-copied={copiedKey === `server-${i}-entry`}
                                                        aria-label="Copy full server log entry"
                                                        onclick={(e) => { e.stopPropagation(); copyToClipboard(getServerLogExport(log), `server-${i}-entry`); }}
                                                        title="Copy Full Log"
                                                    >
                                                        {#if copiedKey === `server-${i}-entry`}
                                                            <CheckIcon size={14} />
                                                        {:else}
                                                            <CopyIcon size={14} />
                                                        {/if}
                                                    </button>
                                                </div>
                                                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                                                <pre class="request-log-code hljs">{@html highlightJson(toJsonString({
                                                    requestId: log.requestId,
                                                    endpoint: log.endpoint,
                                                    mode: log.mode,
                                                    provider: log.provider,
                                                    characterId: log.characterId,
                                                    chatId: log.chatId,
                                                    streaming: log.streaming,
                                                    status: log.status,
                                                    ok: log.ok,
                                                    durationMs: log.durationMs,
                                                }))}</pre>
                                            </div>
                                            <div>
                                                <div class="alert-requestlog-detail-header">
                                                    <span class="alert-requestlog-detail-label">Request</span>
                                                    <button
                                                        type="button"
                                                        class="request-log-copy-btn icon-btn icon-btn--sm"
                                                        class:request-log-copy-btn-copied={copiedKey === `server-${i}-request`}
                                                        aria-label="Copy server request payload"
                                                        onclick={(e) => { e.stopPropagation(); copyToClipboard(toJsonString(log.request), `server-${i}-request`); }}
                                                        title="Copy"
                                                    >
                                                        {#if copiedKey === `server-${i}-request`}
                                                            <CheckIcon size={14} />
                                                        {:else}
                                                            <CopyIcon size={14} />
                                                        {/if}
                                                    </button>
                                                </div>
                                                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                                                <pre class="request-log-code hljs request-log-code-max-64">{@html highlightJson(toJsonString(log.request))}</pre>
                                            </div>
                                            {#if log.response !== undefined}
                                                <div>
                                                    <div class="alert-requestlog-detail-header">
                                                        <span class="alert-requestlog-detail-label">Response</span>
                                                        <button
                                                            type="button"
                                                            class="request-log-copy-btn icon-btn icon-btn--sm"
                                                            class:request-log-copy-btn-copied={copiedKey === `server-${i}-response`}
                                                            aria-label="Copy server response payload"
                                                            onclick={(e) => { e.stopPropagation(); copyToClipboard(toJsonString(log.response), `server-${i}-response`); }}
                                                            title="Copy"
                                                        >
                                                            {#if copiedKey === `server-${i}-response`}
                                                                <CheckIcon size={14} />
                                                            {:else}
                                                                <CopyIcon size={14} />
                                                            {/if}
                                                        </button>
                                                    </div>
                                                    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                                                    <pre class="request-log-code hljs request-log-code-max-64">{@html highlightJson(toJsonString(log.response))}</pre>
                                                </div>
                                            {/if}
                                            {#if log.error !== undefined}
                                                <div>
                                                    <div class="alert-requestlog-detail-header">
                                                        <span class="alert-requestlog-detail-label">Error</span>
                                                        <button
                                                            type="button"
                                                            class="request-log-copy-btn icon-btn icon-btn--sm"
                                                            class:request-log-copy-btn-copied={copiedKey === `server-${i}-error`}
                                                            aria-label="Copy server error payload"
                                                            onclick={(e) => { e.stopPropagation(); copyToClipboard(toJsonString(log.error), `server-${i}-error`); }}
                                                            title="Copy"
                                                        >
                                                            {#if copiedKey === `server-${i}-error`}
                                                                <CheckIcon size={14} />
                                                            {:else}
                                                                <CopyIcon size={14} />
                                                            {/if}
                                                        </button>
                                                    </div>
                                                    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                                                    <pre class="request-log-code hljs request-log-code-max-64">{@html highlightJson(toJsonString(log.error))}</pre>
                                                </div>
                                            {/if}
                                        </div>
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        {/if}
    </div>
    </div>
</div>

<style>
    .request-log-status-badge.control-chip {
        padding: 0.25rem 0.5rem;
        border-radius: var(--ds-radius-sm);
        border-width: 1px;
        border-style: solid;
        border-color: transparent;
        font-size: var(--ds-font-size-xs);
        font-weight: var(--ds-font-weight-bold);
        font-family: "Consolas", "Monaco", "Courier New", monospace;
        color: var(--ds-text-primary);
    }

    .request-log-status-success {
        background: color-mix(
            in srgb,
            var(--alert-info-success, var(--risu-theme-success-500)) 35%,
            var(--ds-surface-2) 65%
        );
        border-color: color-mix(
            in srgb,
            var(--alert-info-success, var(--risu-theme-success-500)) 48%,
            var(--ds-border-subtle) 52%
        );
    }

    .request-log-status-error {
        background: color-mix(
            in srgb,
            var(--alert-info-danger, var(--ds-text-danger, var(--risu-theme-danger-500))) 40%,
            var(--ds-surface-2) 60%
        );
        border-color: color-mix(
            in srgb,
            var(--alert-info-danger, var(--ds-text-danger, var(--risu-theme-danger-500))) 58%,
            var(--ds-border-subtle) 42%
        );
    }

    .request-log-copy-btn.icon-btn.icon-btn--sm {
        padding: 0;
        border-radius: var(--ds-radius-sm);
        color: var(--ds-text-secondary);
        transition: background-color var(--ds-motion-fast) var(--ds-ease-standard),
            color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .request-log-copy-btn.icon-btn.icon-btn--sm:hover {
        background: var(--ds-surface-2);
        color: var(--ds-text-primary);
    }

    .request-log-copy-btn-copied {
        color: var(--alert-info-success, var(--risu-theme-success-500));
    }

    .alert-requestlog-overlay {
        position: fixed;
        inset: 0;
        z-index: 2000;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow-y: auto;
        background: color-mix(in srgb, #000 80%, transparent);
        padding: var(--ds-space-2);
    }

    .alert-requestlog-overlay-page {
        position: static;
        inset: auto;
        z-index: auto;
        display: block;
        overflow: visible;
        background: transparent;
        padding: 0;
    }

    .alert-requestlog-shell.panel-shell {
        margin: 0;
        display: flex;
        flex-direction: column;
        border-radius: var(--ds-radius-lg);
        background: var(--ds-surface-2);
        border: 1px solid var(--ds-border-subtle);
        box-shadow: 0 16px 40px color-mix(in srgb, #000 42%, transparent);
    }

    .alert-requestlog-modal.panel-shell {
        width: min(88rem, calc(100vw - var(--ds-space-4)));
        max-height: calc(100vh - var(--ds-space-4));
    }

    .alert-requestlog-page.panel-shell {
        width: 100%;
        max-height: none;
        border: 0;
        background: transparent;
        box-shadow: none;
    }

    .alert-requestlog-header {
        position: sticky;
        top: 0;
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid var(--ds-border-subtle);
        background: var(--ds-surface-2);
        padding: var(--ds-space-4);
    }

    .alert-requestlog-title {
        margin: 0;
        color: var(--ds-text-primary);
        font-size: var(--ds-font-size-lg);
        font-weight: var(--ds-font-weight-semibold);
    }

    .alert-requestlog-header-actions.action-rail {
        display: flex;
        align-items: center;
        gap: var(--ds-space-2);
    }

    .alert-requestlog-close.icon-btn.icon-btn--sm {
        padding: 0;
        color: var(--ds-text-secondary);
        transition: color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .alert-requestlog-close.icon-btn.icon-btn--sm:hover {
        color: var(--ds-text-primary);
    }

    .alert-requestlog-body {
        flex: 1 1 auto;
        overflow-y: auto;
        padding: var(--ds-space-4);
    }

    .alert-requestlog-page .alert-requestlog-header {
        position: static;
        padding: 0 0 var(--ds-space-3) 0;
        margin-bottom: var(--ds-space-1);
        border-bottom: 0;
        background: transparent;
    }

    .alert-requestlog-page .alert-requestlog-body {
        overflow: visible;
        padding: 0;
    }

    .alert-requestlog-page .alert-requestlog-title {
        font-size: var(--ds-font-size-xl);
    }

    .alert-requestlog-section-title {
        color: var(--ds-text-primary);
        font-size: var(--ds-font-size-md);
        font-weight: var(--ds-font-weight-semibold);
        margin-bottom: var(--ds-space-3);
    }

    .alert-requestlog-empty.empty-state {
        padding: var(--ds-space-6) 0;
        color: var(--ds-text-secondary);
        text-align: center;
        background: transparent;
    }

    .alert-requestlog-list.list-shell {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
        border: 0;
        border-radius: 0;
        background: transparent;
        overflow: visible;
    }

    .alert-requestlog-page .alert-requestlog-list.list-shell {
        gap: var(--ds-space-3);
    }

    .alert-requestlog-card.panel-shell {
        overflow: hidden;
        border-radius: var(--ds-radius-md);
        -webkit-backdrop-filter: none;
        backdrop-filter: none;
        background: transparent;
    }

    .alert-requestlog-page .alert-requestlog-card.panel-shell {
        background: color-mix(in srgb, var(--ds-surface-2) 90%, transparent);
        border: 1px solid var(--ds-border-subtle);
    }

    .alert-requestlog-toggle {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--ds-space-2);
        padding: var(--ds-space-3);
        color: var(--ds-text-primary);
        background: transparent;
        transition: background-color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .alert-requestlog-page .alert-requestlog-toggle {
        align-items: flex-start;
        padding: var(--ds-space-3) var(--ds-space-4);
    }

    .alert-requestlog-toggle:hover {
        background: color-mix(in srgb, var(--ds-surface-1) 50%, transparent);
    }

    .alert-requestlog-toggle-static {
        cursor: default;
    }

    .alert-requestlog-toggle-static:hover {
        background: transparent;
    }

    .alert-requestlog-toggle-main {
        min-width: 0;
        flex: 1 1 auto;
        display: flex;
        align-items: center;
        gap: var(--ds-space-3);
    }

    .alert-requestlog-main-content {
        min-width: 0;
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-1);
    }

    .alert-requestlog-meta-row {
        min-width: 0;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--ds-space-1);
    }

    .request-log-meta-badge.control-chip {
        display: inline-flex;
        align-items: center;
        max-width: 28rem;
        padding: 0.15rem 0.45rem;
        border-width: 1px;
        border-style: solid;
        border-color: var(--ds-border-subtle);
        border-radius: var(--ds-radius-sm);
        color: var(--ds-text-secondary);
        font-size: 0.7rem;
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        background: color-mix(in srgb, var(--ds-surface-1) 72%, transparent);
    }

    .request-log-meta-badge-model {
        max-width: 42rem;
    }

    .alert-requestlog-url {
        min-width: 0;
        flex: 1 1 auto;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        text-align: left;
        color: var(--ds-text-primary);
        font-size: var(--ds-font-size-sm);
        font-family: "Consolas", "Monaco", "Courier New", monospace;
    }

    .alert-requestlog-page .alert-requestlog-url {
        white-space: normal;
        overflow: visible;
        text-overflow: clip;
        line-height: 1.45;
        font-size: 0.84rem;
    }

    .alert-requestlog-date {
        color: var(--ds-text-secondary);
        font-size: var(--ds-font-size-xs);
        white-space: nowrap;
    }

    .alert-requestlog-chevron {
        margin-left: var(--ds-space-2);
        color: var(--ds-text-primary);
    }

    .alert-requestlog-detail {
        border-top: 1px solid var(--ds-border-subtle);
        padding: var(--ds-space-4);
        background: color-mix(in srgb, var(--ds-surface-1) 30%, transparent);
    }

    .alert-requestlog-page .alert-requestlog-detail {
        padding: var(--ds-space-4) var(--ds-space-4) var(--ds-space-5);
    }

    .alert-requestlog-detail-stack {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
    }

    .alert-requestlog-detail-header {
        margin-bottom: var(--ds-space-2);
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .alert-requestlog-detail-label {
        color: var(--ds-text-primary);
        font-size: var(--ds-font-size-sm);
        font-weight: var(--ds-font-weight-semibold);
    }

    .alert-requestlog-server-section {
        margin-top: var(--ds-space-6);
        padding-top: var(--ds-space-4);
        border-top: 1px solid var(--ds-border-subtle);
    }

    .alert-requestlog-server-header {
        margin-bottom: var(--ds-space-3);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--ds-space-2);
    }

    .alert-requestlog-error {
        margin-top: var(--ds-space-2);
    }

    .request-log-code {
        background-color: color-mix(in srgb, var(--ds-surface-1) 92%, black 8%);
        color: var(--ds-text-primary);
        border: 1px solid var(--ds-border-subtle);
        border-radius: 0.375rem;
        padding: 0.75rem;
        font-family: "Consolas", "Monaco", "Courier New", monospace;
        font-size: 0.75rem;
        line-height: 1.35;
        white-space: pre-wrap;
        word-break: break-word;
        max-height: 12rem;
        overflow: auto;
    }

    .alert-requestlog-page .request-log-code {
        max-height: 26rem;
        font-size: 0.82rem;
        line-height: 1.5;
    }

    .request-log-code-max-32 {
        max-height: 8rem;
    }

    .request-log-code-max-64 {
        max-height: 16rem;
    }

    .break-any {
        word-break: normal;
        overflow-wrap: anywhere;
    }

    @media (max-width: 768px) {
        .alert-requestlog-modal.panel-shell {
            width: calc(100vw - var(--ds-space-2));
            max-height: calc(100vh - var(--ds-space-2));
        }

        .alert-requestlog-page.panel-shell {
            max-height: none;
        }
    }
</style>
