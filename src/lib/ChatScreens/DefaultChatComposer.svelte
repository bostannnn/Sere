<script lang="ts">
    import { LanguagesIcon, Laugh, Send, XIcon } from "@lucide/svelte";
    import { onDestroy } from "svelte";
    import type { character, groupChat } from "src/ts/storage/database.svelte";
    import { isMobile } from "src/ts/platform";
    import { comfyProgressStore, DBState } from "src/ts/stores.svelte";
    import { chatProcessStage } from "src/ts/process/index.svelte";
    import { language } from "src/lang";
    import { postChatFile } from "src/ts/process/files/multisend";
    import { getInlayAsset } from "src/ts/process/files/inlays";
    import AssetInput from "./AssetInput.svelte";
    import DefaultChatActionMenu from "./DefaultChatActionMenu.svelte";
    import {
        resizeTextarea,
        shouldSendOnEnter,
        shouldSendTranslateOnEnter,
    } from "./defaultChatScreen.composer";
    import {
        resolveComposerTranslation,
        shouldClearComposerTranslation,
        isExperimentalComposerTranslator,
        usesDelayedExperimentalTranslation,
    } from "./defaultChatScreen.translation";
    import {
        appendStickerMarkup,
        applyPostChatFileResults,
        handleImagePasteUpload,
    } from "./defaultChatScreen.uploads";

    type EvolutionSettings = {
        pendingProposal?: unknown;
    } | null;

    type ComfyMenuTemplate = {
        id: string;
        buttonName?: string;
        trigger: string;
    };

    interface Props {
        currentCharacter: character | groupChat;
        currentEvolutionSettings?: EvolutionSettings;
        evolutionBusy?: boolean;
        evolutionBusyLabel?: string;
        evolutionAction?: string | null;
        evolutionHandoffBlockedForCurrentChat?: boolean;
        messageInput?: string;
        messageInputTranslate?: string;
        fileInput?: string[];
        openMenu?: boolean;
        toggleStickers?: boolean;
        autoMode?: boolean;
        isDoingChat?: boolean;
        isDoingChatInputTranslate?: boolean;
        canContinueResponse?: boolean;
        comfyMenuTemplates?: ComfyMenuTemplate[];
        onOpenEvolutionReview?: () => void;
        onSend?: () => void;
        onAbort?: () => void;
        onReroll?: () => void;
        onRunAutoMode?: () => void;
        onStopTTS?: () => void;
        onSendContinue?: () => void;
        onOpenChatList?: () => void;
        onRunComfyTemplate?: (templateId: string) => void;
        onScreenshot?: () => void;
        onRunEvolutionHandoff?: () => void;
        onOpenModuleList?: () => void;
    }

    let {
        currentCharacter,
        currentEvolutionSettings = null,
        evolutionBusy = false,
        evolutionBusyLabel = "",
        evolutionAction = null,
        evolutionHandoffBlockedForCurrentChat = false,
        messageInput = $bindable(""),
        messageInputTranslate = $bindable(""),
        fileInput = $bindable([]),
        openMenu = $bindable(false),
        toggleStickers = $bindable(false),
        autoMode = false,
        isDoingChat = false,
        isDoingChatInputTranslate = false,
        canContinueResponse = false,
        comfyMenuTemplates = [],
        onOpenEvolutionReview = () => {},
        onSend = () => {},
        onAbort = () => {},
        onReroll = () => {},
        onRunAutoMode = () => {},
        onStopTTS = () => {},
        onSendContinue = () => {},
        onOpenChatList = () => {},
        onRunComfyTemplate = () => {},
        onScreenshot = () => {},
        onRunEvolutionHandoff = () => {},
        onOpenModuleList = () => {},
    }: Props = $props();

    let inputEle: HTMLTextAreaElement | null = $state(null);
    let inputTranslateEle: HTMLTextAreaElement | null = $state(null);
    let inputHeight = $state("44px");
    let inputTranslateHeight = $state("44px");
    let translationTimeout: ReturnType<typeof setTimeout> | null = null;
    let translationRequestId = 0;

    function updateInputSizeAll() {
        inputHeight = resizeTextarea(inputEle);
        inputTranslateHeight = resizeTextarea(inputTranslateEle);
    }

    function applyTranslationResult(result: { messageInput?: string; messageInputTranslate?: string }) {
        if (typeof result.messageInput === "string") {
            messageInput = result.messageInput;
        }
        if (typeof result.messageInputTranslate === "string") {
            messageInputTranslate = result.messageInputTranslate;
        }
    }

    async function updateInputTranslateMessage(reverse: boolean) {
        if (!DBState.db.useAutoTranslateInput) {
            return;
        }

        if (!reverse && isExperimentalComposerTranslator()) {
            messageInputTranslate = "";
            return;
        }

        const clearedState = shouldClearComposerTranslation({
            reverse,
            messageInput,
            messageInputTranslate,
        });
        if (clearedState) {
            applyTranslationResult(clearedState);
            return;
        }

        const requestId = ++translationRequestId;
        if (translationTimeout) {
            clearTimeout(translationTimeout);
            translationTimeout = null;
        }

        const runTranslation = async () => {
            const result = await resolveComposerTranslation({
                reverse,
                messageInput,
                messageInputTranslate,
                requestId,
            });
            if (result.requestId !== translationRequestId) {
                return;
            }
            applyTranslationResult(result);
        };

        if (usesDelayedExperimentalTranslation(reverse)) {
            translationTimeout = setTimeout(() => {
                void runTranslation();
            }, 1500);
            return;
        }

        await runTranslation();
    }

    function handleComposerKeydown(event: KeyboardEvent, canSend: (event: KeyboardEvent) => boolean = (e) => shouldSendOnEnter(e, DBState.db.sendWithEnter)) {
        if (canSend(event)) {
            onSend();
            event.preventDefault();
            return;
        }
        if (event.key.toLocaleLowerCase() === "m" && event.ctrlKey) {
            onReroll();
            event.preventDefault();
        }
    }

    async function handlePaste(event: ClipboardEvent) {
        const nextState = await handleImagePasteUpload({
            event,
            uploadFile: postChatFile,
            messageInput,
            fileInput,
        });
        if (!nextState.handled) {
            return;
        }
        messageInput = nextState.messageInput;
        fileInput = nextState.fileInput;
        updateInputSizeAll();
    }

    async function handlePostFile() {
        const results = await postChatFile(messageInput);
        const nextState = applyPostChatFileResults({
            messageInput,
            fileInput,
            results,
        });
        messageInput = nextState.messageInput;
        fileInput = nextState.fileInput;
        updateInputSizeAll();
    }

    $effect(() => {
        void messageInput;
        void messageInputTranslate;
        void fileInput.length;
        void toggleStickers;
        void DBState.db.useAutoTranslateInput;
        updateInputSizeAll();
    });

    onDestroy(() => {
        if (translationTimeout) {
            clearTimeout(translationTimeout);
        }
    });
</script>

<div class="ds-chat-composer-stack">
    {#if currentEvolutionSettings?.pendingProposal}
        <button
            type="button"
            class="ds-chat-evolution-review-prompt"
            onclick={onOpenEvolutionReview}
        >
            <span class="ds-settings-label-muted-sm">Pending evolution proposal</span>
            <span class="ds-chat-evolution-review-prompt-action">Review</span>
        </button>
    {/if}

    {#if evolutionBusy}
        <div class="ds-chat-evolution-status-inline" role="status" aria-live="polite">
            <div class="ds-chat-inline-status">
                <div class="ds-chat-spinner ds-chat-spinner-aux"></div>
                <span>{evolutionBusyLabel}</span>
            </div>
            <div class="ds-chat-evolution-status-bar" aria-hidden="true"></div>
        </div>
    {/if}

    <div
        class="ds-chat-composer-shell"
        class:ds-chat-composer-shell-fixed={DBState.db.fixedChatTextarea}
        class:ds-chat-composer-shell-flow={!DBState.db.fixedChatTextarea}
    >
        {#if DBState.db.useChatSticker && currentCharacter.type !== "group"}
            <button
                type="button"
                title="Toggle stickers"
                aria-label="Toggle stickers"
                class="ds-chat-composer-icon-toggle icon-btn icon-btn--md"
                class:is-active={toggleStickers}
                onclick={() => {
                    toggleStickers = !toggleStickers;
                }}
            >
                <Laugh />
            </button>
        {/if}

        <div class="ds-ui-grow">
            {#if DBState.db.useAutoTranslateInput}
                <div class="ds-chat-translate-shell">
                    <label for="messageInputTranslate" class="ds-chat-translate-label">
                        <LanguagesIcon />
                    </label>
                    <textarea
                        id="messageInputTranslate"
                        class="ds-chat-translate-input control-field"
                        bind:value={messageInputTranslate}
                        bind:this={inputTranslateEle}
                        enterkeyhint={isMobile || !DBState.db.sendWithEnter ? "enter" : "send"}
                        placeholder={language.enterMessageForTranslateToEnglish}
                        style:height={inputTranslateHeight}
                        onkeydown={(event) => handleComposerKeydown(event, (e) => shouldSendTranslateOnEnter(e, DBState.db.sendWithEnter))}
                        oninput={() => {
                            updateInputSizeAll();
                            void updateInputTranslateMessage(true);
                        }}
                    ></textarea>
                </div>
            {/if}

            {#if fileInput.length > 0}
                <div class="ds-chat-inlay-list">
                    {#each fileInput as file, index (index)}
                        {#await getInlayAsset(file) then inlayAsset}
                            <div class="ds-chat-inlay-item">
                                {#if inlayAsset.type === "image"}
                                    <img src={inlayAsset.data} alt="Inlay" class="ds-chat-inlay-preview" />
                                {:else if inlayAsset.type === "video"}
                                    <video controls class="ds-chat-inlay-preview">
                                        <source src={inlayAsset.data} type="video/mp4" />
                                        <track kind="captions" />
                                        Your browser does not support the video tag.
                                    </video>
                                {:else if inlayAsset.type === "audio"}
                                    <audio controls class="ds-chat-inlay-preview ds-chat-inlay-preview-audio">
                                        <source src={inlayAsset.data} type="audio/mpeg" />
                                        Your browser does not support the audio tag.
                                    </audio>
                                {:else}
                                    <div class="ds-chat-inlay-fallback">{file}</div>
                                {/if}
                                <button
                                    type="button"
                                    class="ds-chat-inlay-remove icon-btn icon-btn--sm"
                                    title="Remove inlay asset"
                                    aria-label="Remove inlay asset"
                                    onclick={() => {
                                        fileInput.splice(index, 1);
                                        updateInputSizeAll();
                                    }}
                                >
                                    <XIcon size={18} />
                                </button>
                            </div>
                        {/await}
                    {/each}
                </div>
            {/if}

            {#if toggleStickers}
                <div class="ds-chat-sticker-strip">
                    <AssetInput
                        {currentCharacter}
                        onSelect={(additionalAsset) => {
                            messageInput = appendStickerMarkup(messageInput, additionalAsset);
                            updateInputSizeAll();
                        }}
                    />
                </div>
            {/if}

            <textarea
                class="ds-chat-composer-input control-field"
                bind:value={messageInput}
                bind:this={inputEle}
                enterkeyhint={isMobile || !DBState.db.sendWithEnter ? "enter" : "send"}
                style:height={inputHeight}
                onkeydown={handleComposerKeydown}
                onpaste={(event) => {
                    void handlePaste(event);
                }}
                oninput={() => {
                    updateInputSizeAll();
                    void updateInputTranslateMessage(false);
                }}
            ></textarea>
        </div>

        {#if isDoingChat || isDoingChatInputTranslate}
            <button
                type="button"
                title="Abort generation"
                aria-label="Abort generation"
                class="ds-chat-composer-action icon-btn icon-btn--sm"
                style:height={inputHeight}
                onclick={onAbort}
            >
                <div
                    class="ds-chat-spinner"
                    class:ds-chat-process-stage-1={$chatProcessStage === 1}
                    class:ds-chat-process-stage-2={$chatProcessStage === 2}
                    class:ds-chat-process-stage-3={$chatProcessStage === 3}
                    class:ds-chat-process-stage-4={$chatProcessStage === 4}
                    class:ds-chat-process-autoload={autoMode}
                ></div>
            </button>
        {:else}
            <button
                type="button"
                title="Send message"
                aria-label="Send message"
                class="ds-chat-composer-action icon-btn icon-btn--sm"
                style:height={inputHeight}
                onclick={onSend}
            >
                <Send />
            </button>
        {/if}

        {#if $comfyProgressStore.active}
            <div class="ds-chat-task-spinner-inline">
                <div
                    class="ds-chat-spinner ds-chat-spinner-aux"
                    style:--ds-chat-spinner-color={$comfyProgressStore.color}
                ></div>
            </div>
        {/if}

        <DefaultChatActionMenu
            bind:openMenu
            {inputHeight}
            {currentCharacter}
            {canContinueResponse}
            {comfyMenuTemplates}
            {currentEvolutionSettings}
            {evolutionBusy}
            {evolutionAction}
            {evolutionHandoffBlockedForCurrentChat}
            onRunAutoMode={onRunAutoMode}
            onStopTTS={onStopTTS}
            onSendContinue={onSendContinue}
            onOpenChatList={onOpenChatList}
            onRunComfyTemplate={onRunComfyTemplate}
            onScreenshot={onScreenshot}
            onRunEvolutionHandoff={onRunEvolutionHandoff}
            onPostFile={handlePostFile}
            onOpenModuleList={onOpenModuleList}
            onReroll={onReroll}
        />
    </div>
</div>

<style>
    .ds-chat-composer-stack {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: var(--ds-space-2);
        width: min(calc(100% - var(--ds-space-5)), 68rem);
        margin-inline: auto;
    }

    .ds-chat-evolution-review-prompt {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--ds-space-3);
        width: 100%;
        padding: var(--ds-space-2) var(--ds-space-3);
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-md);
        background: color-mix(in srgb, var(--ds-surface-2) 92%, transparent);
        color: inherit;
        cursor: pointer;
    }

    .ds-chat-evolution-review-prompt-action {
        color: var(--ds-text-primary);
        font-weight: var(--ds-font-weight-medium);
    }

    .ds-chat-evolution-status-inline {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
        padding: var(--ds-space-2) var(--ds-space-3);
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-md);
        background: var(--ds-surface-2);
    }

    @media (max-width: 720px) {
        .ds-chat-composer-stack,
        .ds-chat-evolution-status-inline,
        .ds-chat-evolution-review-prompt {
            width: 100%;
            min-width: 0;
        }

        .ds-chat-evolution-review-prompt {
            align-items: flex-start;
            flex-direction: column;
        }
    }
</style>
