<script lang="ts">
    import { alertGenerationInfoStore } from "../../ts/alert";
    
    import { DBState } from 'src/ts/stores.svelte';
    import { getCharImage } from '../../ts/characters';
    import { ParseMarkdown } from '../../ts/parser.svelte';
    import BarIcon from '../SideBars/BarIcon.svelte';
    import { CheckIcon, ChevronRightIcon, CopyIcon, User } from '@lucide/svelte';
    import { isCharacterHasAssets } from 'src/ts/characterCards';
    import TextInput from '../UI/GUI/TextInput.svelte';
    import { aiLawApplies, getFetchData, getServerLLMLogs, openURL, type ServerLLMLogEntry } from 'src/ts/globalApi.svelte';
    import Button from '../UI/GUI/Button.svelte';
    import { XIcon } from "@lucide/svelte";
    import SelectInput from "../UI/GUI/SelectInput.svelte";
    import OptionInput from "../UI/GUI/OptionInput.svelte";
    import { language } from 'src/lang';
    import { alertStore, selectedCharID } from "src/ts/stores.svelte";
    import { tokenize } from "src/ts/tokenizer";
    import TextAreaInput from "../UI/GUI/TextAreaInput.svelte";
    import ModuleChatMenu from "../Setting/Pages/Module/ModuleChatMenu.svelte";
    import { ColorSchemeTypeStore } from "src/ts/gui/colorscheme";
    import { getChatBranches } from "src/ts/gui/branches";
    import { getCurrentCharacter } from "src/ts/storage/database.svelte";
    import { translateStackTrace } from "../../ts/sourcemap";
    import RequestLogsViewer from "./RequestLogsViewer.svelte";
    import { isNodeServer } from "src/ts/platform";

    let showDetails = $state(false);
    let translatedStackTrace = $state('');
    let isTranslated = $state(false);
    let isTranslating = $state(false);

    let btn
    let cardExportType = $state('')
    let cardExportType2 = $state('')
    let generationInfoMenuIndex = $state(0)
    let requestDataCopiedKey:string|null = $state(null)
    let branchHover:null|{
        x:number,
        y:number,
        content:string,
    } = $state(null)
    const alertCompLog = (..._args: unknown[]) => {};

    $effect.pre(() => {
        showDetails = false;
        translatedStackTrace = '';
        isTranslated = false;
        isTranslating = false;
        if(btn){
            btn.focus()
        }
        if($alertStore.type !== 'branches'){
            branchHover = null
        }
        if($alertStore.type !== 'cardexport'){
            cardExportType = ''
            cardExportType2 = ''
        }
    });

    $effect(() => {
        if (showDetails) {
            const shouldAutoTranslate = DBState.db.sourcemapTranslate;
            isTranslated = shouldAutoTranslate;
            if (shouldAutoTranslate && !translatedStackTrace) {
                loadTranslatedTrace();
            }
        }
    });


    async function loadTranslatedTrace() {
        if (isTranslating || translatedStackTrace) return;
        isTranslating = true;
        try {
            translatedStackTrace = await translateStackTrace($alertStore.stackTrace);
        } catch (e) {
            alertCompLog("Failed to translate stack trace:", e);
            isTranslated = false;
        } finally {
            isTranslating = false;
        }
    }

    async function handleToggleTranslate() {
        if (!isTranslated && !translatedStackTrace) {
            await loadTranslatedTrace();
        }
        isTranslated = !isTranslated;
    }

    const beautifyJSON = (data:string) =>{
        try {
            return JSON.stringify(JSON.parse(data), null, 2)
        } catch {
            return data
        }
    }

    type RequestDataPayload = {
        source: "client" | "server"
        url: string
        body: string
        response: string
    }

    const requestDataCache: Record<string, Promise<RequestDataPayload | null>> = {};

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

    const copyToClipboardSafe = async (text: string) => {
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                return;
            }
        } catch {
            // Fallback for non-secure contexts and unsupported clipboard APIs.
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
    };

    async function copyRequestData(text: string, key: string) {
        await copyToClipboardSafe(text);
        requestDataCopiedKey = key;
        setTimeout(() => {
            if (requestDataCopiedKey === key) {
                requestDataCopiedKey = null;
            }
        }, 1500);
    }

    function formatCombinedRequestData(payload: RequestDataPayload): string {
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

    function getCurrentChatState() {
        if ($selectedCharID === -1) {
            return null;
        }
        const character = DBState.db.characters[$selectedCharID];
        if (!character) {
            return null;
        }
        const chat = character.chats[character.chatPage];
        if (!chat) {
            return null;
        }
        return chat;
    }

    function getLastUserMessageContent(messages: unknown[], startIndex: number): string {
        for (let idx = startIndex; idx >= 0; idx--) {
            const msg = messages[idx] as { role?: unknown, data?: unknown } | undefined;
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
        const nested = (root.request && typeof root.request === "object")
            ? root.request as Record<string, unknown>
            : root;

        if (Array.isArray(nested.messages)) {
            return nested.messages;
        }

        const requestBody = (nested.requestBody && typeof nested.requestBody === "object")
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
            const msg = messages[idx] as { role?: unknown, content?: unknown } | undefined;
            if (msg?.role !== "user") {
                continue;
            }
            if (typeof msg.content === "string" && msg.content.trim()) {
                return msg.content.trim();
            }
            if (Array.isArray(msg.content)) {
                const joined = msg.content
                    .map((part) => {
                        if (typeof part === "string") return part;
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
        const nested = (root.request && typeof root.request === "object")
            ? root.request as Record<string, unknown>
            : root;

        if (typeof nested.model === "string" && nested.model.trim()) {
            return nested.model.trim();
        }
        const requestBody = (nested.requestBody && typeof nested.requestBody === "object")
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
                // Message time is set when generation starts; matching durable log should be shortly after.
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

    async function loadRequestData(
        generationId: string,
        info: { idx: number, genInfo?: { model?: string } } | null
    ): Promise<RequestDataPayload | null> {
        const cacheKey = `${generationId}::${$selectedCharID}::${info?.idx ?? -1}`;
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

            if (!isNodeServer || !info) {
                return null;
            }

            const chat = getCurrentChatState();
            if (!chat || !Array.isArray(chat.message) || !chat.id) {
                return null;
            }

            const message = chat.message[info.idx] as { time?: unknown } | undefined;
            const targetTimeMs = Number.isFinite(Number(message?.time)) ? Number(message?.time) : Date.now();
            const targetUserMessage = getLastUserMessageContent(chat.message, info.idx - 1);
            const targetModel = typeof info.genInfo?.model === "string" ? info.genInfo.model : "";

            const logs = await getServerLLMLogs({ limit: 200, chatId: chat.id });
            if (!Array.isArray(logs) || logs.length === 0) {
                return null;
            }

            const best = pickBestDurableLog(logs, targetTimeMs, targetUserMessage, targetModel);
            if (!best) {
                return null;
            }

            const path = (typeof best.path === "string" && best.path) ? best.path : "/data/llm/generate";
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
    }
</script>

<svelte:window onmessage={async (e) => {
    if(e.origin.startsWith("https://sv.risuai.xyz") || e.origin.startsWith("https://nightly.sv.risuai.xyz") || e.origin.startsWith("http://127.0.0.1") || e.origin === window.location.origin){
        if(e.data.msg?.data?.vaild && $alertStore.type === 'login'){
            $alertStore = {
                type: 'none',
                msg: JSON.stringify(e.data.msg)
            }
        }
    }
}}></svelte:window>

{#if $alertStore.type !== 'none' &&  $alertStore.type !== 'toast' &&  $alertStore.type !== 'cardexport' && $alertStore.type !== 'branches' && $alertStore.type !== 'selectModule' && $alertStore.type !== 'pukmakkurit' && $alertStore.type !== 'requestlogs'}
    <div class="alert-overlay" class:vis={ $alertStore.type === 'wait2'}>
        <div class="alert-modal-base break-any">
            {#if $alertStore.type === 'error'}
                <h2 class="alert-heading alert-heading-error">Error</h2>
            {:else if $alertStore.type === 'ask'}
                <h2 class="alert-heading">Confirm</h2>
            {:else if $alertStore.type === 'pluginconfirm'}
                <h2 class="alert-heading">Plugin Import</h2>
            {:else if $alertStore.type === 'selectChar'}
                <h2 class="alert-heading">Select</h2>
            {:else if $alertStore.type === 'input'}
                <h2 class="alert-heading">Input</h2>
            {/if}
            {#if $alertStore.type === 'markdown'}
                <div class="alert-scroll-y">
                        <span class="alert-markdown chattext prose chattext2" class:prose-invert={$ColorSchemeTypeStore}>
                            {#await ParseMarkdown($alertStore.msg) then msg}
                                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                                {@html msg}                        
                            {/await}
                        </span>
                </div>
            {:else if $alertStore.type === 'tos'}
                <div class="alert-text-primary">You should accept <a href="https://sv.risuai.xyz/hub/tos" class="alert-tos-link" onclick={(e) => {
                    e.preventDefault();
                    openURL('https://sv.risuai.xyz/hub/tos');
                }}>Terms of Service</a> to continue</div>
            {:else if $alertStore.type === 'pluginconfirm'}
                {@const parts = $alertStore.msg.split('\n\n')}
                {@const mainPart = parts[0]}
                {@const confirmMessage = parts[1]}
                {@const mainParts = mainPart.split('\n')}
                {@const pluginName = mainParts[0]}
                {@const warnings = mainParts.slice(1)}
                <div class="plugin-confirm-content">
                    <p class="plugin-name">{pluginName}</p>
                    {#if warnings.length > 0}
                        <ul class="warnings-list">
                            {#each warnings as warning (warning)}
                                <li class="warning-item">{warning}</li>
                            {/each}
                        </ul>
                    {/if}
                    <p class="confirm-message">{confirmMessage}</p>
                </div>
            {:else if $alertStore.type !== 'select' && $alertStore.type !== 'requestdata' && $alertStore.type !== 'addchar' && $alertStore.type !== 'hypaV2' && $alertStore.type !== 'chatOptions'}
                <span class="alert-body-message alert-prewrap">{$alertStore.msg}</span>
                {#if $alertStore.submsg && $alertStore.type !== 'progress'}
                    <span class="alert-body-submessage alert-text-sm">{$alertStore.submsg}</span>
                {/if}

                {#if $alertStore.type === 'error' && $alertStore.stackTrace}
                    <div class="alert-section-gap-top">
                        <Button styled="outlined" size="sm" onclick={() => showDetails = !showDetails}>
                            {showDetails ? language.hideErrorDetails : language.showErrorDetails}
                            {#if showDetails}
                                <XIcon class="alert-inline-icon" />
                            {:else}
                                <ChevronRightIcon class="alert-inline-icon" />
                            {/if}
                        </Button>
                        {#if showDetails}
                            <Button styled="outlined" size="sm" onclick={handleToggleTranslate} disabled={isTranslating} className="alert-inline-button-gap">
                                {#if isTranslating}
                                    {language.translating}
                                {:else if isTranslated}
                                    {language.showOriginal}
                                {:else}
                                    {language.translateCode}
                                {/if}
                            </Button>
                            <pre class="stack-trace">{isTranslated ? translatedStackTrace : $alertStore.stackTrace}</pre>
                        {/if}
                    </div>
                {/if}
            {/if}
            {#if $alertStore.type === 'progress'}
                <div class="alert-progress-track">
                    <div class="alert-progress-indicator alert-progress-fill saving-animation" style:width={$alertStore.submsg + '%'}></div>
                </div>
                <div class="alert-progress-row">
                    <span class="alert-progress-value alert-text-sm">{$alertStore.submsg + '%'}</span>
                </div>
            {/if}

            {#if $alertStore.type === 'ask' || $alertStore.type === 'pluginconfirm'}
                <div class="alert-action-row">
                    <Button className="alert-action-button" onclick={() => {
                        alertStore.set({
                            type: 'none',
                            msg: 'yes'
                        })
                    }}>YES</Button>
                    <Button className="alert-action-button" onclick={() => {
                        alertStore.set({
                            type: 'none',
                            msg: 'no'
                        })
                    }}>NO</Button>
                </div>
            {:else if $alertStore.type === 'tos'}
                <div class="alert-action-row">
                    <Button className="alert-action-button" onclick={() => {
                        alertStore.set({
                            type: 'none',
                            msg: 'yes'
                        })
                    }}>Accept</Button>
                    <Button styled="outlined" className="alert-action-button" onclick={() => {
                        alertStore.set({
                            type: 'none',
                            msg: 'no'
                        })
                    }}>Do not Accept</Button>
                </div>
            {:else if $alertStore.type === 'select'}
                {@const hasDisplay = $alertStore.msg.startsWith('__DISPLAY__')}
                {#if hasDisplay}
                    {@const parts = $alertStore.msg.substring(11).split('||')}
                    <div class="alert-display-message">{parts[0]}</div>
                    {#each parts.slice(1) as n, i (i)}
                        <Button className="alert-option-button" onclick={() => {
                            alertStore.set({
                                type: 'none',
                                msg: i.toString()
                            })
                        }}>{n}</Button>
                    {/each}
                {:else}
                    {@const parts = $alertStore.msg.split('||')}
                    {#each parts as n, i (i)}
                        <Button className="alert-option-button" onclick={() => {
                            alertStore.set({
                                type: 'none',
                                msg: i.toString()
                            })
                        }}>{n}</Button>
                    {/each}
                {/if}
            {:else if $alertStore.type === 'error' || $alertStore.type === 'normal' || $alertStore.type === 'markdown'}
               <Button className="alert-option-button" onclick={() => {
                    alertStore.set({
                        type: 'none',
                        msg: ''
                    })
                }}>OK</Button>
            {:else if $alertStore.type === 'input'}
                <TextInput value={$alertStore.defaultValue} id="alert-input" autocomplete="off" marginTop list="alert-input-list" />
                <Button className="alert-option-button" onclick={() => {
                    alertStore.set({
                        type: 'none',
                        //@ts-expect-error 'value' doesn't exist on Element, but target is HTMLInputElement here
                        msg: document.querySelector('#alert-input')?.value
                    })
                }}>OK</Button>
                {#if $alertStore.datalist}
                    <datalist id="alert-input-list">
                        {#each $alertStore.datalist as item (item[0])}
                            <option
                                value={item[0]}
                                label={item[1] ? item[1] : item[0]}
                            >{item[1] ? item[1] : item[0]}</option>
                        {/each}
                    </datalist>
                {/if}
            {:else if $alertStore.type === 'selectChar'}
                <div class="alert-select-char-grid">
                    {#each DBState.db.characters as char, i (char.chaId ?? i)}
                        {#if char.type !== 'group'}
                            {#if char.image}
                                {#await getCharImage(DBState.db.characters[i].image, 'css')}
                                    <BarIcon onClick={() => {
                                        alertStore.set({type: 'none',msg: char.chaId})
                                    }}>
                                        <User/>
                                    </BarIcon>
                                {:then im} 
                                    <BarIcon onClick={() => {
                                        alertStore.set({type: 'none',msg: char.chaId})
                                    }} additionalStyle={im} />
                                    
                                {/await}
                            {:else}
                                <BarIcon onClick={() => {
                                    alertStore.set({type: 'none',msg: char.chaId})
                                }}>
                                <User/>
                                </BarIcon>
                            {/if}
                        {/if}
                    {/each}
                </div>
            {:else if $alertStore.type === 'requestdata'}
                {#if aiLawApplies()}
                <div>
                    {language.generatedByAIDisclaimer}
                </div>
                {/if}
                <div class="alert-inline-toolbar">
                    <Button selected={generationInfoMenuIndex === 0} size="sm" onclick={() => {generationInfoMenuIndex = 0}}>
                        {language.tokens}
                    </Button>
                    <Button selected={generationInfoMenuIndex === 1} size="sm" onclick={() => {generationInfoMenuIndex = 1}}>
                        {language.metaData}
                    </Button>
                    <Button selected={generationInfoMenuIndex === 2} size="sm" onclick={() => {generationInfoMenuIndex = 2}}>
                        {language.log}
                    </Button>
                    <Button selected={generationInfoMenuIndex === 3} size="sm" onclick={() => {generationInfoMenuIndex = 3}}>
                        {language.prompt}
                    </Button>
                    <button
                        type="button"
                        class="alert-toolbar-close"
                        title="Close request data"
                        aria-label="Close request data"
                        onclick={() => {
                        alertStore.set({
                            type: 'none',
                            msg: ''
                        })
                    }}>✖</button>
                </div>
                {#if generationInfoMenuIndex === 0}
                    <div class="alert-requestdata-chart-row">
                        <div class="alert-requestdata-chart" style:background={
                            `linear-gradient(0deg,
                            var(--alert-info-primary) 0%,
                            var(--alert-info-primary) ${($alertGenerationInfoStore.genInfo.inputTokens / $alertGenerationInfoStore.genInfo.maxContext) * 100}%,
                            var(--alert-info-success) ${($alertGenerationInfoStore.genInfo.inputTokens / $alertGenerationInfoStore.genInfo.maxContext) * 100}%,
                            var(--alert-info-success) ${(($alertGenerationInfoStore.genInfo.outputTokens + $alertGenerationInfoStore.genInfo.inputTokens) / $alertGenerationInfoStore.genInfo.maxContext) * 100}%,
                            var(--alert-info-muted) ${(($alertGenerationInfoStore.genInfo.outputTokens + $alertGenerationInfoStore.genInfo.inputTokens) / $alertGenerationInfoStore.genInfo.maxContext) * 100}%,
                            var(--alert-info-muted) 100%)`
                        }>

                        </div>
                    </div>
                    <div class="alert-info-grid">
                        <span class="alert-info-primary">{language.inputTokens}</span>
                        <span class="alert-info-primary alert-grid-end">{$alertGenerationInfoStore.genInfo.inputTokens ?? '?'} {language.tokens}</span>
                        <span class="alert-info-success">{language.outputTokens}</span>
                        <span class="alert-info-success alert-grid-end">{$alertGenerationInfoStore.genInfo.outputTokens ?? '?'} {language.tokens}</span>
                        <span class="alert-info-muted">{language.maxContextSize}</span>
                        <span class="alert-info-muted alert-grid-end">{$alertGenerationInfoStore.genInfo.maxContext ?? '?'} {language.tokens}</span>
                    </div>
                    <span class="alert-body-submessage alert-text-sm">{language.tokenWarning}</span>
                {/if}
                {#if generationInfoMenuIndex === 1}
                <div class="alert-info-grid">
                    <span class="alert-info-primary">Index</span>
                    <span class="alert-info-primary alert-grid-end">{$alertGenerationInfoStore.idx}</span>
                    <span class="alert-info-warning">Model</span>
                    <span class="alert-info-warning alert-grid-end">{$alertGenerationInfoStore.genInfo.model}</span>
                    <span class="alert-info-success">ID</span>
                    <span class="alert-info-success alert-grid-end">{DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message[$alertGenerationInfoStore.idx].chatId ?? "None"}</span>
                    <span class="alert-info-danger">GenID</span>
                    <span class="alert-info-danger alert-grid-end">{$alertGenerationInfoStore.genInfo.generationId}</span>
                    <span class="alert-info-accent">Saying</span>
                    <span class="alert-info-accent alert-grid-end">{DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message[$alertGenerationInfoStore.idx].saying}</span>
                    <span class="alert-info-secondary">Size</span>
                    <span class="alert-info-secondary alert-grid-end">{JSON.stringify(DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message[$alertGenerationInfoStore.idx]).length} Bytes</span>
                    <span class="alert-info-warning">Time</span>
                    <span class="alert-info-warning alert-grid-end">{(new Date(DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message[$alertGenerationInfoStore.idx].time ?? 0)).toLocaleString()}</span>
                    {#if $alertGenerationInfoStore.genInfo.stageTiming}
                        {@const stage1 = parseFloat(((($alertGenerationInfoStore.genInfo.stageTiming.stage1 ?? 0) / 1000).toFixed(1)))}
                        {@const stage2 = parseFloat(((($alertGenerationInfoStore.genInfo.stageTiming.stage2 ?? 0) / 1000).toFixed(1)))}
                        {@const stage3 = parseFloat(((($alertGenerationInfoStore.genInfo.stageTiming.stage3 ?? 0) / 1000).toFixed(1)))}
                        {@const stage4 = parseFloat(((($alertGenerationInfoStore.genInfo.stageTiming.stage4 ?? 0) / 1000).toFixed(1)))}
                        {@const totalRounded = (stage1 + stage2 + stage3 + stage4).toFixed(1)}
                        <span class="alert-info-muted">Timing</span>
                        <span class="alert-info-muted alert-grid-end">
                            <span class="alert-timing-stage-1">{stage1}</span> +
                            <span class="alert-timing-stage-2">{stage2}</span> +
                            <span class="alert-timing-stage-3">{stage3}</span> +
                            <span class="alert-timing-stage-4">{stage4}</span> =
                            <span class="alert-timing-total">{totalRounded}s</span>
                        </span>
                    {/if}

                    <span class="alert-info-success">Tokens</span>
                    {#await tokenize(DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message[$alertGenerationInfoStore.idx].data)}
                        <span class="alert-info-success alert-grid-end">Loading</span>
                    {:then tokens} 
                        <span class="alert-info-success alert-grid-end">{tokens}</span>
                    {/await}
                </div>
                {/if}
                {#if generationInfoMenuIndex === 2}
                    {#await loadRequestData($alertStore.msg, $alertGenerationInfoStore) then data} 
                        {#if !data}
                            <span class="alert-body-message-lg">{language.errors.requestLogRemoved}</span>
                            <span class="alert-body-submessage">{language.errors.requestLogRemovedDesc}</span>
                        {:else}
                            <h1 class="alert-section-title">Log Source</h1>
                            <code class="alert-code-block alert-prewrap">{data.source === "client" ? "Client request log (in-memory)" : "Server durable log fallback"}</code>
                            <h1 class="alert-section-title">URL</h1>
                            <code class="alert-code-block alert-prewrap">{data.url}</code>
                            <div class="alert-requestdata-actions">
                                <Button
                                    size="sm"
                                    styled="outlined"
                                    onclick={() => copyRequestData(data.body, "request")}
                                >
                                    {#if requestDataCopiedKey === "request"}
                                        <CheckIcon class="alert-copy-icon" />
                                        {language.copied}
                                    {:else}
                                        <CopyIcon class="alert-copy-icon" />
                                        {language.copy} Request
                                    {/if}
                                </Button>
                                <Button
                                    size="sm"
                                    styled="outlined"
                                    onclick={() => copyRequestData(data.response, "response")}
                                >
                                    {#if requestDataCopiedKey === "response"}
                                        <CheckIcon class="alert-copy-icon" />
                                        {language.copied}
                                    {:else}
                                        <CopyIcon class="alert-copy-icon" />
                                        {language.copy} Response
                                    {/if}
                                </Button>
                                <Button
                                    size="sm"
                                    styled="outlined"
                                    onclick={() => copyRequestData(formatCombinedRequestData(data), "both")}
                                >
                                    {#if requestDataCopiedKey === "both"}
                                        <CheckIcon class="alert-copy-icon" />
                                        {language.copied}
                                    {:else}
                                        <CopyIcon class="alert-copy-icon" />
                                        {language.copy} Both
                                    {/if}
                                </Button>
                            </div>
                            <h1 class="alert-section-title">Request Body</h1>
                            <code class="alert-code-block alert-prewrap">{data.body}</code>
                            <h1 class="alert-section-title">Response</h1>
                            <code class="alert-code-block alert-prewrap">{data.response}</code>
                        {/if}
                    {/await}
                {/if}
                {#if generationInfoMenuIndex === 3}
                    {#if Object.keys(DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message[$alertGenerationInfoStore.idx].promptInfo || {}).length === 0}
                        <div class="alert-body-message-lg">{language.promptInfoEmptyMessage}</div>
                    {:else}
                        <div class="alert-info-grid">
                            <span class="alert-info-primary">Preset Name</span>
                            <span class="alert-info-primary alert-grid-end">{DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message[$alertGenerationInfoStore.idx].promptInfo.promptName}</span>
                            <span class="alert-info-secondary">Toggles</span>
                            <div class="alert-grid-span-full alert-prompt-pane alert-prompt-pane-sm">
                                {#if DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message[$alertGenerationInfoStore.idx].promptInfo.promptToggles.length === 0}
                                    <div class="alert-prompt-empty">{language.promptInfoEmptyToggle}</div>
                                {:else}
                                    <div class="alert-info-grid alert-info-grid-no-top">
                                        {#each DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message[$alertGenerationInfoStore.idx].promptInfo.promptToggles as toggle, i (i)}
                                        <span class="alert-prompt-key alert-truncate">{toggle.key}</span>
                                        <span class="alert-prompt-key alert-grid-end alert-truncate">{toggle.value}</span>
                                        {/each}
                                    </div>
                                {/if}
                            </div>
                            <span class="alert-info-danger">Prompt Text</span>
                            <div class="alert-grid-span-full alert-prompt-pane alert-prompt-pane-lg">
                                {#if !DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message[$alertGenerationInfoStore.idx].promptInfo.promptText}
                                    <div class="alert-prompt-empty">{language.promptInfoEmptyText}</div>
                                {:else}
                                    {#each DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message[$alertGenerationInfoStore.idx].promptInfo.promptText as block, i (i)}
                                        <div class="alert-block-gap-sm">
                                            <div class="alert-prompt-role">{block.role}</div>
                                            <pre class="alert-prompt-content">{block.content}</pre>
                                        </div>
                                    {/each}
                                {/if}
                            </div>
                        </div>
                    {/if}
                {/if}
            {:else if $alertStore.type === 'hypaV2'}
                <div class="alert-hypav2-toolbar">
                    <Button selected={generationInfoMenuIndex === 0} size="sm" onclick={() => {generationInfoMenuIndex = 0}}>
                        Chunks
                    </Button>
                    <Button selected={generationInfoMenuIndex === 1} size="sm" onclick={() => {generationInfoMenuIndex = 1}}>
                        Summarized
                    </Button>
                    <button
                        type="button"
                        class="alert-toolbar-close"
                        title="Close HypaV2 details"
                        aria-label="Close HypaV2 details"
                        onclick={() => {
                        alertStore.set({
                            type: 'none',
                            msg: ''
                        })
                    }}>✖</button>
                </div>
                {#if generationInfoMenuIndex === 0}
                    <div class="alert-stack-col">
                        {#each DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].hypaV2Data.chunks as chunk, _i (_i)}
                            <TextAreaInput bind:value={chunk.text} />
                        {/each}

                        <!-- Adding non-bound chunk is not okay, change the user flow to edit existing ones. -->
                    </div>
                {:else}
                    {#each DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].hypaV2Data.mainChunks as chunk, i (i)} <!-- Summarized should be mainChunks, afaik. Be aware of that chunks are created with mainChunks, however this editing would not change related chunks. -->
                        <div class="alert-summary-card">
                            {#if i === 0}
                                <span class="alert-info-success">Active</span>
                            {:else}
                                <span>Inactive</span>
                            {/if}
                            <TextAreaInput bind:value={chunk.text} />
                        </div>
                    {/each}
                {/if}
            {:else if $alertStore.type === 'addchar'}
                <div class="alert-wide-panel">

                    <button
                        type="button"
                        class="alert-choice-button"
                        title={language.importCharacter}
                        aria-label={language.importCharacter}
                        onclick={((e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        alertStore.set({
                            type: 'none',
                            msg: 'importCharacter'
                        })
                    })}>
                        <div class="alert-choice-content">
                            <span>{language.importCharacter}</span>
                        </div>
                        <div class="alert-choice-arrow">
                            <ChevronRightIcon />
                        </div>
                    </button>
                    <button
                        type="button"
                        class="alert-choice-button"
                        title={language.createfromScratch}
                        aria-label={language.createfromScratch}
                        onclick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        alertStore.set({
                            type: 'none',
                            msg: 'createfromScratch'
                        })
                    }}>
                        <div class="alert-choice-content">
                            <span>{language.createfromScratch}</span>
                        </div>
                        <div class="alert-choice-arrow">
                            <ChevronRightIcon />
                        </div>
                    </button>
                    <button
                        type="button"
                        class="alert-choice-button"
                        title={language.createGroup}
                        aria-label={language.createGroup}
                        onclick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        alertStore.set({
                            type: 'none',
                            msg: 'createGroup'
                        })
                    }}>
                        <div class="alert-choice-content">
                            <span>{language.createGroup}</span>
                        </div>
                        <div class="alert-choice-arrow">
                            <ChevronRightIcon />
                        </div>
                    </button>
                    <button
                        type="button"
                        class="alert-choice-button"
                        title={language.cancel}
                        aria-label={language.cancel}
                        onclick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        alertStore.set({
                            type: 'none',
                            msg: 'cancel'
                        })
                    }}>
                        <div class="alert-choice-content">
                            <span>{language.cancel}</span>
                        </div>
                    </button>
                </div>
            {:else if $alertStore.type === 'chatOptions'}
                <div class="alert-wide-panel">
                    <h1 class="alert-panel-title">
                        {language.chatOptions}
                    </h1>
                    <button
                        type="button"
                        class="alert-choice-button"
                        title={language.createCopy}
                        aria-label={language.createCopy}
                        onclick={() => {
                        alertStore.set({
                            type: 'none',
                            msg: '0'
                        })
                    }}>
                        <div class="alert-choice-content">
                            <span>{language.createCopy}</span>
                        </div>
                        <div class="alert-choice-arrow">
                            <ChevronRightIcon />
                        </div>
                    </button>
                    <button
                        type="button"
                        class="alert-choice-button"
                        title={language.bindPersona}
                        aria-label={language.bindPersona}
                        onclick={() => {
                        alertStore.set({
                            type: 'none',
                            msg: '1'
                        })
                    }}>
                        <div class="alert-choice-content">
                            <span>{language.bindPersona}</span>
                        </div>
                        <div class="alert-choice-arrow">
                            <ChevronRightIcon />
                        </div>
                    </button>
                    <button
                        type="button"
                        class="alert-choice-button"
                        title={language.cancel}
                        aria-label={language.cancel}
                        onclick={() => {
                        alertStore.set({
                            type: 'none',
                            msg: 'cancel'
                        })
                    }}>
                        <div class="alert-choice-content">
                            <span>{language.cancel}</span>
                        </div>
                    </button>
                </div>
            {/if}
        </div>
    </div>

{:else if $alertStore.type === 'cardexport'}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="alert-cardexport-overlay" role="button" tabindex="0" aria-label="Close export dialog" onclick={close} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); close(); } }}>
        <div class="alert-cardexport-modal" role="dialog" aria-modal="true" aria-label="Export options" tabindex="-1" onclick={(e) => {
            e.stopPropagation()
        }}>
            <h1 class="alert-cardexport-title">
                <span>
                    {language.shareExport}
                </span>
                <button
                    type="button"
                    class="alert-close-button"
                    title="Close export modal"
                    aria-label="Close export modal"
                    onclick={() => {
                    alertStore.set({
                        type: 'none',
                        msg: JSON.stringify({
                            type: 'cancel',
                            type2: cardExportType2
                        })
                    })
                }}>
                    <XIcon />
                </button>
            </h1>
            <span class="alert-cardexport-subtitle">{language.type}</span>
            {#if cardExportType === ''}
                {#if $alertStore.submsg === 'module'}
                    <span class="alert-cardexport-desc">{language.risuMDesc}</span>
                {:else if $alertStore.submsg === 'preset'}
                    <span class="alert-cardexport-desc">{language.risupresetDesc}</span>
                    {#if cardExportType2 === 'preset' && (DBState.db.botPresets[DBState.db.botPresetsId].image || DBState.db.botPresets[DBState.db.botPresetsId].regex?.length > 0)}
                        <span class="alert-note-danger alert-text-sm">Preset with image or regexes cannot be exported for now.</span>
                    {/if}
                {:else}
                    <span class="alert-cardexport-desc">{language.ccv3Desc}</span>
                    {#if cardExportType2 !== 'charx' && cardExportType2 !== 'charxJpeg' && isCharacterHasAssets(DBState.db.characters[$selectedCharID])}
                        <span class="alert-note-danger alert-text-sm">{language.notCharxWarn}</span>
                    {/if}
                {/if}
            {:else if cardExportType === 'json'}
                <span class="alert-cardexport-desc">{language.jsonDesc}</span>
            {:else if cardExportType === 'ccv2'}
                <span class="alert-cardexport-desc">{language.ccv2Desc}</span>
                <span class="alert-note-danger alert-text-sm">{language.v2Warning}</span>
            {/if}
            <div class="alert-cardexport-type-row">
                {#if $alertStore.submsg === 'preset'}
                    <button
                        type="button"
                        class="alert-cardexport-type-button"
                        class:alert-cardexport-type-button-active={cardExportType === ''}
                        title="Risupreset"
                        aria-label="Select Risupreset export"
                        aria-pressed={cardExportType === ''}
                        onclick={() => {cardExportType = ''}}
                    >Risupreset</button>
                {:else if $alertStore.submsg === 'module'}
                    <button
                        type="button"
                        class="alert-cardexport-type-button"
                        class:alert-cardexport-type-button-active={cardExportType === ''}
                        title="RisuM"
                        aria-label="Select RisuM export"
                        aria-pressed={cardExportType === ''}
                        onclick={() => {cardExportType = ''}}
                    >RisuM</button>
                {:else}
                    <button
                        type="button"
                        class="alert-cardexport-type-button"
                        class:alert-cardexport-type-button-active={cardExportType === ''}
                        title="Character Card V3"
                        aria-label="Select Character Card V3 export"
                        aria-pressed={cardExportType === ''}
                        onclick={() => {
                        cardExportType = ''
                        cardExportType2 = 'charxJpeg'
                    }}>Character Card V3</button>
                    <button
                        type="button"
                        class="alert-cardexport-type-button"
                        class:alert-cardexport-type-button-active={cardExportType === 'ccv2'}
                        title="Character Card V2"
                        aria-label="Select Character Card V2 export"
                        aria-pressed={cardExportType === 'ccv2'}
                        onclick={() => {cardExportType = 'ccv2'}}
                    >Character Card V2</button>
                {/if}
            </div>
            {#if $alertStore.submsg === '' && cardExportType === ''}
                <span class="alert-cardexport-subtitle">{language.format}</span>
                <SelectInput bind:value={cardExportType2} className="alert-cardexport-select">
                    <OptionInput value="charx">CHARX</OptionInput>
                    <OptionInput value="charxJpeg">CHARX-JPEG</OptionInput>
                    <OptionInput value="">PNG</OptionInput>
                    <OptionInput value="json">JSON</OptionInput>
                </SelectInput>
            {/if}
            <Button className="alert-cardexport-submit" onclick={() => {
                alertStore.set({
                    type: 'none',
                    msg: JSON.stringify({
                        type: cardExportType,
                        type2: cardExportType2
                    })
                })
            }}>{language.export}</Button>
        </div>
    </div>

{:else if $alertStore.type === 'toast'}
    <div class="ds-toast-anime ds-toast-shell break-any"
        onanimationend={() => {
            alertStore.set({
                type: 'none',
                msg: ''
            })
        }}
    >{$alertStore.msg}</div>
{:else if $alertStore.type === 'selectModule'}
    <ModuleChatMenu alertMode close={(d) => {
        alertStore.set({
            type: 'none',
            msg: d
        })
    }} />
{:else if $alertStore.type === 'pukmakkurit'}
    <!-- Log Generator by dootaang, GPL3 -->
    <!-- Svelte, Typescript version by Kwaroran -->
    
    <div class="alert-overlay">
        <div class="alert-modal-base break-any">
            <h2 class="alert-heading">{language.preview}</h2>

        </div>
    </div>
{:else if $alertStore.type === 'branches'}
    <div class="alert-branches-overlay">
        {#if branchHover !== null}
            <div class="alert-branch-tooltip" style="top: {branchHover.y * 80 + 24}px; left: {(branchHover.x + 1) * 80 + 24}px">
                {branchHover.content}
            </div>
        {/if}

        <div class="alert-branch-close-anchor">
            <button
                type="button"
                class="alert-branch-close-button"
                title="Close branches"
                aria-label="Close branches"
                onclick={() => {
                alertStore.set({
                    type: 'none',
                    msg: ''
                })
            }}>
                <XIcon />
            </button>
        </div>

        {#each getChatBranches() as obj, i (i)}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
            <div
                role="table"
                class="alert-branch-node"
                style="top: {obj.y * 80 + 24}px; left: {obj.x * 80 + 24}px"
                onmouseenter={() => {
                    if(branchHover === null){
                        const char = getCurrentCharacter()
                        branchHover = {
                            x: obj.x,
                            y: obj.y,
                            content: char.chats[obj.chatId].message[obj.y - 1].data
                        }
                    }
                }}
                onclick={() => {
                    if(branchHover === null){
                        const char = getCurrentCharacter()
                        branchHover = {
                            x: obj.x,
                            y: obj.y,
                            content: char.chats[obj.chatId].message[obj.y - 1].data
                        }
                    }
                }}
                onmouseleave={() => {
                    branchHover = null
                }}
            >
                
            </div>
            {#if obj.connectX === obj.x}
                {#if obj.multiChild}
                    <div class="alert-branch-line-vertical alert-branch-line-tall alert-branch-line-danger" style="top: {(obj.y-1) * 80 + 24}px; left: {obj.x * 80 + 45}px">

                    </div>
                {:else}
                    <div class="alert-branch-line-vertical alert-branch-line-tall alert-branch-line-primary" style="top: {(obj.y-1) * 80 + 24}px; left: {obj.x * 80 + 45}px">

                    </div>
                {/if}
            {:else if obj.connectX !== -1}
                <div class="alert-branch-line-vertical alert-branch-line-short alert-branch-line-danger" style="top: {(obj.y) * 80}px; left: {obj.x * 80 + 45}px">

                </div>
                <div class="alert-branch-line-horizontal alert-branch-line-danger" style="top: {(obj.y) * 80}px; left: {obj.connectX * 80 + 46}px" style:width={Math.abs((obj.x - obj.connectX) * 80) + 'px'}>

                </div>
            {/if}
        {/each}
    </div>
{:else if $alertStore.type === 'requestlogs'}
    <RequestLogsViewer mode="modal" />
{/if}

<style>
    :global(:root) {
        --alert-info-primary: var(--risu-theme-primary-500);
        --alert-info-success: var(--risu-theme-success-500);
        --alert-info-danger: var(--ds-text-danger, var(--risu-theme-danger-500));
        --alert-info-warning: color-mix(in srgb, var(--ds-text-primary) 82%, var(--ds-border-strong) 18%);
        --alert-info-accent: var(--ds-border-strong);
        --alert-info-secondary: color-mix(in srgb, var(--ds-text-primary) 68%, var(--ds-border-strong) 32%);
        --alert-info-muted: var(--ds-text-secondary);
    }

    .alert-overlay {
        position: absolute;
        inset: 0;
        z-index: 2000;
        display: flex;
        align-items: center;
        justify-content: center;
        background: color-mix(in srgb, #000 50%, transparent);
    }

    .alert-modal-base {
        display: flex;
        flex-direction: column;
        max-width: 48rem;
        max-height: 100%;
        overflow-y: auto;
        border-radius: var(--ds-radius-md);
        background: var(--ds-surface-2);
        padding: var(--ds-space-4);
        color: var(--ds-text-primary);
    }

    .alert-scroll-y {
        overflow-y: auto;
    }

    .alert-text-primary {
        color: var(--ds-text-primary);
    }

    .alert-prewrap {
        white-space: pre-wrap;
    }

    .alert-text-sm {
        font-size: var(--ds-font-size-sm);
    }

    .alert-select-char-grid {
        width: 100%;
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        justify-content: flex-start;
        gap: var(--ds-space-2);
    }

    .alert-inline-toolbar {
        width: 100%;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--ds-space-2);
    }

    .alert-hypav2-toolbar {
        width: min(31rem, 100%);
        max-width: 100%;
        margin-bottom: var(--ds-space-4);
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--ds-space-2);
    }

    .alert-toolbar-close {
        margin-left: auto;
        color: var(--ds-text-secondary);
        transition: color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .alert-toolbar-close:hover {
        color: var(--ds-text-primary);
    }

    .alert-section-gap-top {
        margin-top: var(--ds-space-4);
    }

    :global(.alert-inline-icon) {
        display: inline;
        margin-left: var(--ds-space-2);
    }

    :global(.alert-inline-button-gap) {
        margin-left: var(--ds-space-2);
    }

    .alert-progress-track {
        width: 100%;
        min-width: 16rem;
        max-width: 34.5rem;
        height: 0.5rem;
        margin-top: var(--ds-space-6);
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-md);
        background: var(--ds-surface-1);
    }

    .alert-progress-indicator {
        height: 100%;
        transition: width var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .alert-progress-row {
        width: 100%;
        margin-top: var(--ds-space-6);
        display: flex;
        justify-content: center;
    }

    .alert-action-row {
        width: 100%;
        display: flex;
        gap: var(--ds-space-2);
    }

    :global(.alert-action-button) {
        margin-top: var(--ds-space-4);
        flex: 1 1 0;
    }

    .alert-display-message {
        margin-bottom: var(--ds-space-4);
        color: var(--ds-text-primary);
    }

    .alert-body-message-lg {
        margin-top: var(--ds-space-2);
        color: var(--ds-text-primary);
        font-size: var(--ds-font-size-lg);
    }

    .alert-section-title {
        margin: var(--ds-space-4) 0;
        color: var(--ds-text-primary);
        font-size: var(--ds-font-size-xl);
        font-weight: var(--ds-font-weight-semibold);
    }

    .alert-block-gap-sm {
        margin-bottom: var(--ds-space-2);
    }

    .alert-stack-col {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
    }

    .alert-summary-card {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-md);
        padding: var(--ds-space-2);
        background: color-mix(in srgb, var(--ds-surface-2) 85%, var(--ds-surface-1) 15%);
    }

    .alert-wide-panel {
        width: min(32rem, 100%);
        max-width: 100%;
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
    }

    .alert-choice-button {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--ds-space-2);
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-md);
        padding: var(--ds-space-2) var(--ds-space-6);
        background: var(--ds-surface-1);
        color: var(--ds-text-primary);
        transition: box-shadow var(--ds-motion-fast) var(--ds-ease-standard),
            border-color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .alert-choice-button:hover {
        border-color: var(--ds-border-strong);
        box-shadow: 0 0 0 1px color-mix(in srgb, var(--ds-border-strong) 35%, transparent);
    }

    .alert-choice-content {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: flex-start;
        gap: var(--ds-space-1);
        min-width: 0;
        text-align: left;
    }

    .alert-choice-arrow {
        margin-left: var(--ds-space-4);
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--ds-text-secondary);
    }

    .alert-panel-title {
        margin: 0 0 var(--ds-space-4);
        color: var(--ds-text-primary);
        font-size: var(--ds-font-size-lg);
        font-weight: var(--ds-font-weight-semibold);
    }

    :global(.alert-option-button) {
        margin-top: var(--ds-space-4);
    }

    .alert-cardexport-overlay {
        position: fixed;
        inset: 0;
        z-index: 2000;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: color-mix(in srgb, #000 50%, transparent);
    }

    .alert-cardexport-modal {
        width: min(42rem, 100%);
        max-width: 100%;
        display: flex;
        flex-direction: column;
        border-radius: var(--ds-radius-md);
        background: var(--ds-surface-2);
        padding: var(--ds-space-4);
    }

    .alert-cardexport-title {
        margin: 0;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--ds-space-2);
        font-size: var(--ds-font-size-xl);
        font-weight: var(--ds-font-weight-bold);
        color: var(--ds-text-primary);
    }

    .alert-cardexport-subtitle {
        margin-top: var(--ds-space-4);
        color: var(--ds-text-primary);
    }

    .alert-cardexport-desc {
        color: var(--ds-text-secondary);
        font-size: var(--ds-font-size-sm);
    }

    .alert-cardexport-type-row {
        margin-top: var(--ds-space-2);
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--ds-space-2);
    }

    .alert-cardexport-type-button {
        flex: 1 1 0;
        min-width: 0;
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-md);
        background: var(--ds-surface-1);
        padding: var(--ds-space-2) var(--ds-space-2);
        color: var(--ds-text-primary);
        transition: border-color var(--ds-motion-fast) var(--ds-ease-standard),
            box-shadow var(--ds-motion-fast) var(--ds-ease-standard),
            background-color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .alert-cardexport-type-button-active {
        border-color: var(--ds-border-strong);
        background: color-mix(in srgb, var(--ds-surface-active) 35%, var(--ds-surface-1) 65%);
        box-shadow: 0 0 0 1px color-mix(in srgb, var(--ds-border-strong) 35%, transparent);
    }

    :global(.alert-cardexport-select) {
        margin-top: var(--ds-space-2);
    }

    :global(.alert-cardexport-submit) {
        margin-top: var(--ds-space-4);
    }

    .alert-branches-overlay {
        position: absolute;
        inset: 0;
        z-index: 50;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow-x: auto;
        overflow-y: auto;
        background: color-mix(in srgb, #000 80%, transparent);
    }

    .alert-branch-tooltip {
        position: absolute;
        z-index: 30;
        white-space: pre-wrap;
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-md);
        background: var(--ds-surface-2);
        padding: var(--ds-space-4);
        color: var(--ds-text-primary);
    }

    .alert-branch-close-anchor {
        position: absolute;
        top: var(--ds-space-2);
        right: var(--ds-space-2);
    }

    .alert-branch-close-button {
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-md);
        background: var(--ds-surface-2);
        padding: var(--ds-space-2);
        color: var(--ds-text-primary);
    }

    .alert-branch-node {
        position: absolute;
        width: 3rem;
        height: 3rem;
        z-index: 20;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow-y: auto;
        border: 1px solid var(--ds-border-subtle);
        border-radius: 9999px;
        background: var(--ds-surface-1);
    }

    .alert-branch-line-vertical {
        position: absolute;
        width: 0;
        border-left-width: 1px;
        border-right-width: 1px;
    }

    .alert-branch-line-horizontal {
        position: absolute;
        height: 0;
        border-top-width: 1px;
        border-bottom-width: 1px;
    }

    .alert-branch-line-tall {
        height: 5rem;
    }

    .alert-branch-line-short {
        height: 2.5rem;
    }

    .alert-heading {
        margin: 0 0 0.5rem;
        width: 10rem;
        max-width: 100%;
        color: var(--alert-info-success);
    }

    .alert-heading-error {
        color: var(--alert-info-danger);
    }

    .alert-markdown {
        color: var(--ds-text-primary);
    }

    .alert-tos-link {
        color: var(--alert-info-success);
        cursor: pointer;
        transition: color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .alert-tos-link:hover {
        color: color-mix(in srgb, var(--alert-info-success) 82%, var(--ds-text-primary) 18%);
    }

    .alert-body-message {
        color: var(--ds-text-primary);
    }

    .alert-body-submessage {
        color: var(--ds-text-secondary);
    }

    .alert-progress-fill {
        background: linear-gradient(
            to right,
            var(--alert-info-primary),
            color-mix(in srgb, var(--alert-info-primary) 55%, var(--alert-info-secondary) 45%)
        );
    }

    .alert-progress-value {
        color: var(--ds-text-secondary);
    }

    .alert-info-primary {
        color: var(--alert-info-primary);
    }

    .alert-info-success {
        color: var(--alert-info-success);
    }

    .alert-info-danger {
        color: var(--alert-info-danger);
    }

    .alert-info-warning {
        color: var(--alert-info-warning);
    }

    .alert-info-accent {
        color: var(--alert-info-accent);
    }

    .alert-info-secondary {
        color: var(--alert-info-secondary);
    }

    .alert-info-muted {
        color: var(--alert-info-muted);
    }

    .alert-timing-stage-1 {
        color: color-mix(in srgb, var(--alert-info-primary) 78%, var(--ds-text-primary) 22%);
    }

    .alert-timing-stage-2 {
        color: color-mix(in srgb, var(--alert-info-danger) 75%, var(--ds-text-primary) 25%);
    }

    .alert-timing-stage-3 {
        color: color-mix(in srgb, var(--alert-info-success) 78%, var(--ds-text-primary) 22%);
    }

    .alert-timing-stage-4 {
        color: color-mix(in srgb, var(--alert-info-accent) 80%, var(--ds-text-primary) 20%);
    }

    .alert-timing-total {
        color: var(--ds-text-primary);
        font-weight: var(--ds-font-weight-bold);
    }

    .alert-requestdata-chart-row {
        width: 100%;
        margin-top: var(--ds-space-4);
        display: flex;
        justify-content: center;
    }

    .alert-requestdata-chart {
        width: 8rem;
        height: 8rem;
        border: 4px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-md);
        background: var(--ds-surface-1);
    }

    .alert-requestdata-actions {
        margin-top: var(--ds-space-3);
        display: flex;
        flex-wrap: wrap;
        gap: var(--ds-space-2);
    }

    :global(.alert-copy-icon) {
        width: 0.9rem;
        height: 0.9rem;
        margin-right: var(--ds-space-1);
    }

    .alert-info-grid {
        width: 100%;
        margin-top: var(--ds-space-4);
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        row-gap: var(--ds-space-2);
        column-gap: var(--ds-space-4);
    }

    .alert-info-grid-no-top {
        margin-top: 0;
    }

    .alert-grid-end {
        justify-self: end;
    }

    .alert-grid-span-full {
        grid-column: 1 / -1;
    }

    .alert-truncate {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .alert-code-block {
        color: var(--ds-text-primary);
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-md);
        padding: var(--ds-space-2);
    }

    .alert-prompt-pane {
        overflow-y: auto;
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-sm);
        background: color-mix(in srgb, var(--ds-surface-1) 86%, var(--ds-surface-2) 14%);
    }

    .alert-prompt-pane-sm {
        max-height: 8rem;
        padding: var(--ds-space-2);
    }

    .alert-prompt-pane-lg {
        max-height: 20rem;
        padding: var(--ds-space-3);
    }

    .alert-prompt-empty {
        color: var(--ds-text-secondary);
        font-style: italic;
        text-align: center;
        padding: var(--ds-space-4) 0;
    }

    .alert-prompt-key {
        color: var(--ds-text-primary);
    }

    .alert-prompt-role {
        color: var(--ds-text-secondary);
        font-weight: var(--ds-font-weight-bold);
    }

    .alert-prompt-content {
        white-space: pre-wrap;
        font-size: var(--ds-font-size-sm);
        background: color-mix(in srgb, var(--ds-surface-1) 90%, black 10%);
        padding: var(--ds-space-2);
        border-radius: var(--ds-radius-sm);
        border: 1px solid var(--ds-border-subtle);
    }

    .alert-close-button {
        color: var(--ds-text-secondary);
        transition: color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .alert-close-button:hover {
        color: var(--alert-info-success);
    }

    .alert-note-danger {
        color: var(--alert-info-danger);
    }

    .alert-branch-line-danger {
        border-color: color-mix(in srgb, var(--alert-info-danger) 72%, var(--ds-text-primary) 28%);
    }

    .alert-branch-line-primary {
        border-color: color-mix(in srgb, var(--alert-info-primary) 72%, var(--ds-text-primary) 28%);
    }


    .plugin-confirm-content .plugin-name {
        font-size: 1.25rem;
        font-weight: bold;
        color: var(--ds-text-primary);
    }
    .plugin-confirm-content .warnings-list {
        list-style-type: disc;
        list-style-position: inside;
        margin-top: 0.5rem;
        margin-bottom: 0.5rem;
        padding-left: 1rem;
        color: var(--alert-info-danger);
    }
    .plugin-confirm-content .warning-item {
        margin-bottom: 0.25rem;
    }
    .plugin-confirm-content .confirm-message {
        margin-top: 1rem;
        color: var(--ds-text-secondary);
    }
    .break-any{
        word-break: normal;
        overflow-wrap: anywhere;
    }

    .vis{
        opacity: 1 !important;
        --tw-bg-opacity: 1 !important;
    }

    .stack-trace {
        background-color: var(--risu-theme-bgcolor);
        color: var(--risu-theme-textcolor2);
        border: 1px solid var(--risu-theme-darkborderc);
        border-radius: 0.25rem;
        padding: 0.5rem;
        margin-top: 0.5rem;
        font-family: monospace;
        font-size: 0.75rem;
        white-space: pre-wrap;
        word-break: break-all;
        max-height: 200px;
        overflow-y: auto;
    }
</style>
