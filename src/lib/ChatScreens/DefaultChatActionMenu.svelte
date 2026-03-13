<script lang="ts">
    import { CameraIcon, DatabaseIcon, DicesIcon, GlobeIcon, ImagePlusIcon, GitBranch, MenuIcon, MicOffIcon, PackageIcon, RefreshCcwIcon, ReplyIcon, StepForwardIcon } from "@lucide/svelte";
    import { getEvolutionHandoffButtonA11yLabel, getEvolutionHandoffButtonLabel } from "src/ts/character-evolution/reviewFlow";
    import type { character, groupChat } from "src/ts/storage/database.svelte";
    import { DBState } from "src/ts/stores.svelte";
    import { language } from "src/lang";

    type EvolutionSettings = {
        pendingProposal?: unknown;
    } | null;

    type ComfyMenuTemplate = {
        id: string;
        buttonName?: string;
        trigger: string;
    };

    interface Props {
        openMenu?: boolean;
        inputHeight?: string;
        currentCharacter: character | groupChat;
        canContinueResponse: boolean;
        comfyMenuTemplates?: ComfyMenuTemplate[];
        currentEvolutionSettings?: EvolutionSettings;
        evolutionBusy?: boolean;
        evolutionAction?: string | null;
        evolutionHandoffBlockedForCurrentChat?: boolean;
        onRunAutoMode?: () => void;
        onStopTTS?: () => void;
        onSendContinue?: () => void;
        onOpenChatList?: () => void;
        onRunComfyTemplate?: (templateId: string) => void;
        onScreenshot?: () => void;
        onRunEvolutionHandoff?: () => void;
        onPostFile?: () => void | Promise<void>;
        onOpenModuleList?: () => void;
        onReroll?: () => void;
    }

    let {
        openMenu = $bindable(false),
        inputHeight = "44px",
        currentCharacter,
        canContinueResponse,
        comfyMenuTemplates = [],
        currentEvolutionSettings = null,
        evolutionBusy = false,
        evolutionAction = null,
        evolutionHandoffBlockedForCurrentChat = false,
        onRunAutoMode = () => {},
        onStopTTS = () => {},
        onSendContinue = () => {},
        onOpenChatList = () => {},
        onRunComfyTemplate = () => {},
        onScreenshot = () => {},
        onRunEvolutionHandoff = () => {},
        onPostFile = async () => {},
        onOpenModuleList = () => {},
        onReroll = () => {},
    }: Props = $props();

    function closeMenu() {
        openMenu = false;
    }

    const handoffButtonState = $derived({
        action: (evolutionAction as "handoff" | "accept" | "reject" | null) ?? null,
        hasPendingProposal: !!currentEvolutionSettings?.pendingProposal,
        blockedForCurrentChat: evolutionHandoffBlockedForCurrentChat,
    });
</script>

<div
    class="ds-chat-floating-actions action-rail"
    class:ds-chat-composer-menu-anchor={true}
>
    <button
        type="button"
        title="Open chat actions"
        aria-label="Open chat actions"
        aria-haspopup="menu"
        aria-expanded={openMenu}
        aria-controls="ds-chat-side-menu"
        class="ds-chat-floating-action-btn icon-btn icon-btn--sm"
        class:ds-chat-composer-action={true}
        class:ds-chat-composer-action-end={true}
        class:is-active={openMenu}
        style:height={inputHeight}
        onclick={(event) => {
            openMenu = !openMenu;
            event.stopPropagation();
        }}
    >
        <MenuIcon />
    </button>

    {#if openMenu}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
            class="ds-chat-side-menu panel-shell ds-ui-menu"
            class:ds-chat-side-menu-composer={true}
            id="ds-chat-side-menu"
            role="menu"
            aria-label="Chat actions"
            tabindex="-1"
            onclick={(event) => {
                event.stopPropagation();
            }}
        >
            {#if currentCharacter.type === "group"}
                <button
                    type="button"
                    class="ds-chat-side-menu-item ds-ui-menu-item"
                    title={language.autoMode}
                    aria-label={language.autoMode}
                    onclick={onRunAutoMode}
                >
                    <DicesIcon />
                    <span class="ds-chat-side-menu-label">{language.autoMode}</span>
                </button>
            {/if}

            {#if currentCharacter.ttsMode === "webspeech" || currentCharacter.ttsMode === "elevenlab"}
                <button
                    type="button"
                    class="ds-chat-side-menu-item ds-ui-menu-item"
                    title={language.ttsStop}
                    aria-label={language.ttsStop}
                    onclick={onStopTTS}
                >
                    <MicOffIcon />
                    <span class="ds-chat-side-menu-label">{language.ttsStop}</span>
                </button>
            {/if}

            <button
                type="button"
                class="ds-chat-side-menu-item ds-ui-menu-item"
                class:ds-chat-side-menu-item-disabled={!canContinueResponse}
                title={language.continueResponse}
                aria-label={language.continueResponse}
                aria-disabled={!canContinueResponse}
                onclick={() => {
                    if (!canContinueResponse) {
                        return;
                    }
                    onSendContinue();
                }}
            >
                <StepForwardIcon />
                <span class="ds-chat-side-menu-label">{language.continueResponse}</span>
            </button>

            {#if DBState.db.showMenuChatList}
                <button
                    type="button"
                    class="ds-chat-side-menu-item ds-ui-menu-item"
                    title={language.chatList}
                    aria-label={language.chatList}
                    onclick={() => {
                        onOpenChatList();
                        closeMenu();
                    }}
                >
                    <DatabaseIcon />
                    <span class="ds-chat-side-menu-label">{language.chatList}</span>
                </button>
            {/if}

            {#each comfyMenuTemplates as template (`comfy-template-${template.id}`)}
                <div class="ds-chat-side-menu-divider"></div>
                <button
                    type="button"
                    class="ds-chat-side-menu-item ds-ui-menu-item"
                    title={template.buttonName || template.trigger}
                    aria-label={template.buttonName || template.trigger}
                    onclick={() => {
                        onRunComfyTemplate(template.id);
                        closeMenu();
                    }}
                >
                    <ImagePlusIcon />
                    <span class="ds-chat-side-menu-label">{template.buttonName || template.trigger}</span>
                </button>
            {/each}

            {#if DBState.db.translator !== ""}
                <button
                    type="button"
                    class="ds-chat-side-menu-item ds-ui-menu-item"
                    class:ds-chat-side-menu-item-active={DBState.db.useAutoTranslateInput}
                    title={language.autoTranslateInput}
                    aria-label={language.autoTranslateInput}
                    aria-pressed={DBState.db.useAutoTranslateInput}
                    onclick={() => {
                        DBState.db.useAutoTranslateInput = !DBState.db.useAutoTranslateInput;
                    }}
                >
                    <GlobeIcon />
                    <span class="ds-chat-side-menu-label">{language.autoTranslateInput}</span>
                </button>
            {/if}

            <button
                type="button"
                class="ds-chat-side-menu-item ds-ui-menu-item"
                title={language.screenshot}
                aria-label={language.screenshot}
                onclick={onScreenshot}
            >
                <CameraIcon />
                <span class="ds-chat-side-menu-label">{language.screenshot}</span>
            </button>

            <button
                type="button"
                class="ds-chat-side-menu-item ds-ui-menu-item"
                title={getEvolutionHandoffButtonA11yLabel(handoffButtonState)}
                aria-label={getEvolutionHandoffButtonA11yLabel(handoffButtonState)}
                disabled={evolutionBusy || currentCharacter.type === "group" || !!currentEvolutionSettings?.pendingProposal}
                onclick={onRunEvolutionHandoff}
            >
                <GitBranch />
                <span class="ds-chat-side-menu-label">{getEvolutionHandoffButtonLabel(handoffButtonState)}</span>
            </button>

            <button
                type="button"
                class="ds-chat-side-menu-item ds-ui-menu-item"
                title={language.postFile}
                aria-label={language.postFile}
                onclick={onPostFile}
            >
                <ImagePlusIcon />
                <span class="ds-chat-side-menu-label">{language.postFile}</span>
            </button>

            <button
                type="button"
                class="ds-chat-side-menu-item ds-ui-menu-item"
                class:ds-chat-side-menu-item-active={DBState.db.useAutoSuggestions}
                title={language.autoSuggest}
                aria-label={language.autoSuggest}
                aria-pressed={DBState.db.useAutoSuggestions}
                onclick={() => {
                    DBState.db.useAutoSuggestions = !DBState.db.useAutoSuggestions;
                }}
            >
                <ReplyIcon />
                <span class="ds-chat-side-menu-label">{language.autoSuggest}</span>
            </button>

            <button
                type="button"
                class="ds-chat-side-menu-item ds-ui-menu-item"
                title={language.modules}
                aria-label={language.modules}
                onclick={() => {
                    onOpenModuleList();
                    closeMenu();
                }}
            >
                <PackageIcon />
                <span class="ds-chat-side-menu-label">{language.modules}</span>
            </button>

            {#if DBState.db.sideMenuRerollButton}
                <button
                    type="button"
                    class="ds-chat-side-menu-item ds-ui-menu-item"
                    title={language.reroll}
                    aria-label={language.reroll}
                    onclick={onReroll}
                >
                    <RefreshCcwIcon />
                    <span class="ds-chat-side-menu-label">{language.reroll}</span>
                </button>
            {/if}
        </div>
    {/if}
</div>

<style>
    .ds-chat-composer-menu-anchor {
        position: relative;
        display: inline-flex;
        align-items: stretch;
    }

    .ds-chat-side-menu-composer {
        position: absolute;
        right: 0;
        bottom: calc(100% + var(--ds-space-2));
        min-width: min(20rem, calc(100vw - (var(--ds-space-4) * 2)));
        z-index: 35;
    }

    @media (max-width: 720px) {
        .ds-chat-side-menu-composer {
            width: 100%;
            min-width: 0;
        }
    }
</style>
