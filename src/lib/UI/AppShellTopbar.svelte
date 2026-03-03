<script lang="ts">
    import {
        BookIcon,
        EllipsisIcon,
        HomeIcon,
        PanelRightIcon,
        PlusIcon,
        SettingsIcon,
        ShellIcon,
    } from "@lucide/svelte";
    import { onDestroy, onMount } from "svelte";
    import type { MenuDef } from "src/ts/stores.svelte";
    import PluginDefinedIcon from "../Others/PluginDefinedIcon.svelte";

    type Workspace = "home" | "characters" | "chats" | "library" | "playground" | "settings";

    interface Props {
        workspace: Workspace;
        onOpenHome?: () => void;
        onOpenPlayground?: () => void;
        onOpenRulebooks?: () => void;
        onOpenSettings?: () => void;
        overflowItems?: MenuDef[];
        overflowOpen?: boolean;
        showShellSearch?: boolean;
        shellSearchQuery?: string;
        showRightSidebarToggle?: boolean;
        rightSidebarOpen?: boolean;
        rightSidebarPanelId?: string;
        onToggleRightSidebar?: () => void;
        showCharacterDirectoryControls?: boolean;
        characterDirectoryShowTrash?: boolean;
        onShowActiveCharacters?: () => void;
        onShowTrashCharacters?: () => void;
        onAddCharacter?: () => void;
    }

    let {
        workspace,
        onOpenHome = () => {},
        onOpenPlayground = () => {},
        onOpenRulebooks = () => {},
        onOpenSettings = () => {},
        overflowItems = [],
        overflowOpen = $bindable(false),
        showShellSearch = false,
        shellSearchQuery = $bindable(""),
        showRightSidebarToggle = false,
        rightSidebarOpen = false,
        rightSidebarPanelId = "chat-right-sidebar-drawer",
        onToggleRightSidebar = () => {},
        showCharacterDirectoryControls = false,
        characterDirectoryShowTrash = false,
        onShowActiveCharacters = () => {},
        onShowTrashCharacters = () => {},
        onAddCharacter = () => {},
    }: Props = $props();

    let overflowWrapEl = $state<HTMLElement | null>(null);

    const homeActive = $derived(workspace === "characters");
    const playgroundActive = $derived(workspace === "playground");
    const rulebooksActive = $derived(workspace === "library");
    const settingsActive = $derived(workspace === "settings");

    const openHome = () => {
        overflowOpen = false;
        onOpenHome();
    };

    const openPlayground = () => {
        overflowOpen = false;
        onOpenPlayground();
    };

    const openRulebooks = () => {
        overflowOpen = false;
        onOpenRulebooks();
    };

    const openSettings = () => {
        overflowOpen = false;
        onOpenSettings();
    };

    const toggleOverflow = () => {
        overflowOpen = !overflowOpen;
    };

    const runOverflowAction = (item: MenuDef) => {
        item.callback();
        overflowOpen = false;
    };

    const onDocumentPointerDown = (event: PointerEvent) => {
        if (!overflowOpen) {
            return;
        }
        const target = event.target;
        if (!(target instanceof Node)) {
            return;
        }
        if (overflowWrapEl?.contains(target)) {
            return;
        }
        overflowOpen = false;
    };

    onMount(() => {
        document.addEventListener("pointerdown", onDocumentPointerDown);
    });

    onDestroy(() => {
        document.removeEventListener("pointerdown", onDocumentPointerDown);
    });
</script>

<header class="ds-app-v2-topbar" class:ds-app-v2-topbar-has-search={showShellSearch}>
    <div class="ds-app-v2-topbar-left">
        <nav class="ds-app-v2-topbar-nav action-rail" aria-label="Primary navigation">
            <button
                type="button"
                id="globalMenuBtn"
                class="ds-app-v2-topbar-btn ds-app-v2-topbar-icon-btn ds-app-v2-topbar-nav-btn icon-btn icon-btn--md icon-btn--bordered"
                aria-label="Go to Home"
                title="Home"
                aria-pressed={homeActive}
                data-pressed={homeActive ? "1" : "0"}
                onclick={openHome}
                data-testid="topbar-nav-home"
            ><HomeIcon size={18} /></button>

            <button
                type="button"
                class="ds-app-v2-topbar-btn ds-app-v2-topbar-icon-btn ds-app-v2-topbar-nav-btn icon-btn icon-btn--md icon-btn--bordered"
                aria-label="Go to Rulebooks"
                title="Rulebooks"
                aria-pressed={rulebooksActive}
                data-pressed={rulebooksActive ? "1" : "0"}
                onclick={openRulebooks}
                data-testid="topbar-nav-rulebooks"
            ><BookIcon size={18} /></button>

            <button
                type="button"
                class="ds-app-v2-topbar-btn ds-app-v2-topbar-icon-btn ds-app-v2-topbar-nav-btn icon-btn icon-btn--md icon-btn--bordered"
                aria-label="Go to Settings"
                title="Settings"
                aria-pressed={settingsActive}
                data-pressed={settingsActive ? "1" : "0"}
                onclick={openSettings}
                data-testid="topbar-nav-settings"
            ><SettingsIcon size={18} /></button>

            <div class="ds-app-v2-topbar-overflow-wrap" bind:this={overflowWrapEl}>
                <button
                    type="button"
                    class="ds-app-v2-topbar-btn ds-app-v2-topbar-icon-btn ds-app-v2-topbar-nav-btn icon-btn icon-btn--md icon-btn--bordered"
                    aria-label="More navigation actions"
                    title="More"
                    aria-pressed={overflowOpen}
                    aria-expanded={overflowOpen}
                    aria-controls="topbar-overflow-menu"
                    data-pressed={overflowOpen || playgroundActive ? "1" : "0"}
                    onclick={toggleOverflow}
                    data-testid="topbar-nav-more"
                ><EllipsisIcon size={18} /></button>

                {#if overflowOpen}
                    <div
                        id="topbar-overflow-menu"
                        class="ds-app-v2-topbar-overflow panel-shell ds-ui-menu"
                        aria-label="More navigation actions"
                        data-testid="topbar-nav-more-menu"
                    >
                        <button
                            type="button"
                            class="ds-app-v2-topbar-overflow-item ds-ui-menu-item"
                            data-active={playgroundActive ? "1" : "0"}
                            onclick={openPlayground}
                            data-testid="topbar-nav-overflow-playground"
                        >
                            <ShellIcon size={16} />
                            <span>Playground</span>
                        </button>

                        {#if overflowItems.length > 0}
                            <div class="ds-app-v2-topbar-overflow-separator"></div>
                            {#each overflowItems as item (`${item.id}-${item.name}`)}
                                <button
                                    type="button"
                                    class="ds-app-v2-topbar-overflow-item ds-ui-menu-item"
                                    onclick={() => runOverflowAction(item)}
                                >
                                    <PluginDefinedIcon ico={item} />
                                    <span>{item.name}</span>
                                </button>
                            {/each}
                        {/if}
                    </div>
                {/if}
            </div>
        </nav>
    </div>

    <div class="ds-app-v2-topbar-center">
        {#if showShellSearch}
            <input
                id="shellSearchInput"
                type="search"
                class="ds-app-v2-topbar-search control-field"
                aria-label={workspace === "library" ? "Search library" : "Search characters"}
                placeholder={workspace === "library" ? "Search library..." : "Search characters..."}
                bind:value={shellSearchQuery}
            />
        {/if}
    </div>

    <div class="ds-app-v2-topbar-right">
        {#if showRightSidebarToggle}
            <button
                type="button"
                id="workspaceSidebarBtn"
                class="ds-app-v2-topbar-btn ds-app-v2-topbar-icon-btn icon-btn icon-btn--md icon-btn--bordered"
                aria-label={rightSidebarOpen ? "Hide workspace sidebar" : "Show workspace sidebar"}
                title={rightSidebarOpen ? "Hide workspace sidebar" : "Show workspace sidebar"}
                aria-pressed={rightSidebarOpen}
                aria-expanded={showRightSidebarToggle ? rightSidebarOpen : undefined}
                aria-controls={showRightSidebarToggle ? rightSidebarPanelId : undefined}
                onclick={onToggleRightSidebar}
                data-pressed={rightSidebarOpen ? "1" : "0"}
            ><PanelRightIcon size={18} /></button>
        {:else if showCharacterDirectoryControls}
            <div class="ds-app-v2-topbar-segment seg-tabs" role="tablist" aria-label="Character filter">
                <button
                    type="button"
                    class="ds-app-v2-topbar-segment-btn seg-tab"
                    class:ds-app-v2-topbar-segment-btn-active={!characterDirectoryShowTrash}
                    class:active={!characterDirectoryShowTrash}
                    role="tab"
                    aria-selected={!characterDirectoryShowTrash}
                    aria-label="Show active characters"
                    title="Show active characters"
                    tabindex={!characterDirectoryShowTrash ? 0 : -1}
                    onclick={onShowActiveCharacters}
                    data-testid="topbar-characters-active"
                >
                    Active
                </button>
                <button
                    type="button"
                    class="ds-app-v2-topbar-segment-btn seg-tab"
                    class:ds-app-v2-topbar-segment-btn-active={characterDirectoryShowTrash}
                    class:active={characterDirectoryShowTrash}
                    role="tab"
                    aria-selected={characterDirectoryShowTrash}
                    aria-label="Show trashed characters"
                    title="Show trashed characters"
                    tabindex={characterDirectoryShowTrash ? 0 : -1}
                    onclick={onShowTrashCharacters}
                    data-testid="topbar-characters-trash"
                >
                    Trash
                </button>
            </div>
            <button
                type="button"
                class="ds-app-v2-topbar-btn ds-app-v2-topbar-add-btn"
                onclick={onAddCharacter}
                data-testid="topbar-characters-add"
                title="Add character"
                aria-label="Add character"
            >
                <PlusIcon size={14} />
                <span>Add</span>
            </button>
        {/if}
    </div>
</header>

<style>
    .ds-app-v2-topbar {
        position: relative;
        z-index: var(--z-topbar, 30);
        flex: 0 0 var(--topbar-h, 4.125rem);
        min-height: var(--topbar-h, 4.125rem);
        display: flex;
        align-items: center;
        gap: 0.625rem;
        padding: 0.625rem 1.125rem;
        border-bottom: 1px solid color-mix(in srgb, var(--ds-border-subtle) 72%, var(--ds-text-primary) 28%);
        background:
            radial-gradient(
                160% 140% at 0% 0%,
                color-mix(in srgb, var(--ds-border-strong) 20%, transparent) 0%,
                transparent 56%
            ),
            radial-gradient(
                120% 180% at 100% 100%,
                color-mix(in srgb, var(--ds-surface-active) 26%, transparent) 0%,
                transparent 68%
            ),
            color-mix(in srgb, var(--surface-topbar, var(--surface-overlay)) 84%, var(--ds-surface-2) 16%);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        box-shadow: 0 14px 28px rgb(0 0 0 / 0.2), inset 0 1px 0 color-mix(in srgb, var(--ds-text-inverse) 5%, transparent);
        container-type: inline-size;
        container-name: ds-app-shell-topbar;
    }

    .ds-app-v2-topbar-left {
        display: flex;
        align-items: center;
        gap: 0.625rem;
        min-width: 0;
    }

    .ds-app-v2-topbar-nav {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
    }

    .ds-app-v2-topbar-overflow-wrap {
        position: relative;
    }

    .ds-app-v2-topbar-overflow {
        position: absolute;
        top: calc(100% + 0.5rem);
        left: 0;
        min-width: 13rem;
        max-width: min(20rem, 80vw);
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        padding: 0.375rem;
        z-index: var(--z-drawer, 50);
    }

    .ds-app-v2-topbar-overflow-item {
        width: 100%;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        border: 1px solid transparent;
        border-radius: var(--ds-radius-md);
        background: transparent;
        color: var(--ds-text-secondary);
        min-height: var(--ds-height-control-md);
        padding: 0 0.625rem;
        text-align: left;
    }

    .ds-app-v2-topbar-overflow-separator {
        height: 1px;
        background: color-mix(in srgb, var(--ds-border-subtle) 70%, transparent);
        margin: 0.125rem 0.125rem 0.25rem;
    }

    .ds-app-v2-topbar-overflow-item:hover {
        background: var(--ds-surface-active);
        color: var(--ds-text-primary);
        border-color: var(--ds-border-strong);
    }

    .ds-app-v2-topbar-center {
        flex: 1 1 auto;
        min-width: 0;
        display: flex;
        justify-content: center;
    }

    .ds-app-v2-topbar-search {
        width: clamp(20rem, 38vw, 42.5rem);
        max-width: 100%;
        min-height: var(--chrome-btn-h, 2.125rem);
        height: var(--chrome-btn-h, 2.125rem);
        border: 1px solid
            color-mix(in srgb, var(--ds-border-subtle) 82%, color-mix(in srgb, var(--ds-text-inverse) 14%, transparent));
        border-radius: var(--ds-radius-inset);
        background:
            radial-gradient(
                130% 130% at 0% 0%,
                color-mix(in srgb, var(--ds-border-strong) 12%, transparent) 0%,
                transparent 58%
            ),
            color-mix(in srgb, var(--surface-raised) 76%, transparent);
        color: var(--ds-text-primary);
        padding: 0 var(--ds-space-3);
        outline: none;
        box-shadow: inset 0 1px 0 color-mix(in srgb, var(--ds-text-inverse) 4%, transparent);
        transition: border-color var(--ds-motion-fast) var(--ds-ease-standard),
            box-shadow var(--ds-motion-fast) var(--ds-ease-standard),
            background-color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .ds-app-v2-topbar-search::placeholder {
        color: color-mix(in srgb, var(--ds-text-secondary) 82%, transparent);
    }

    .ds-app-v2-topbar-right {
        display: flex;
        align-items: center;
        gap: 0.625rem;
        overflow: visible;
        min-width: 0;
    }

    .ds-app-v2-topbar-segment {
        display: inline-flex;
        align-items: center;
        border: 1px solid
            color-mix(in srgb, var(--ds-border-subtle) 78%, color-mix(in srgb, var(--ds-text-inverse) 12%, transparent));
        border-radius: var(--ds-radius-md);
        background:
            radial-gradient(
                120% 140% at 0% 0%,
                color-mix(in srgb, var(--ds-border-strong) 10%, transparent) 0%,
                transparent 62%
            ),
            color-mix(in srgb, var(--surface-raised) 72%, transparent);
        padding: 2px;
        box-shadow: inset 0 1px 0 color-mix(in srgb, var(--ds-text-inverse) 5%, transparent);
    }

    .ds-app-v2-topbar-segment-btn {
        min-width: 4.5rem;
        height: calc(var(--chrome-btn-h, 2.125rem) - 4px);
        border-radius: calc(var(--ds-radius-md) - 2px);
        border: none;
        background: transparent;
        color: var(--ds-text-secondary);
        font-size: var(--ds-font-size-sm);
        padding-inline: 0.625rem;
    }

    .ds-app-v2-topbar-segment-btn-active {
        background:
            radial-gradient(
                140% 120% at 0% 0%,
                color-mix(in srgb, var(--ds-border-strong) 24%, transparent) 0%,
                transparent 62%
            ),
            color-mix(in srgb, var(--ds-surface-active) 86%, var(--surface-raised) 14%);
        color: var(--ds-text-primary);
        box-shadow: inset 0 1px 0 color-mix(in srgb, var(--ds-text-inverse) 8%, transparent);
    }

    .ds-app-v2-topbar-btn {
        flex: 0 0 auto;
        height: var(--chrome-btn-h, 2.125rem);
        border: 1px solid
            color-mix(in srgb, var(--ds-border-subtle) 78%, color-mix(in srgb, var(--ds-text-inverse) 12%, transparent));
        border-radius: var(--ds-radius-inset);
        background:
            radial-gradient(
                130% 120% at 0% 0%,
                color-mix(in srgb, var(--ds-border-strong) 12%, transparent) 0%,
                transparent 64%
            ),
            color-mix(in srgb, var(--surface-raised) 72%, transparent);
        color: var(--ds-text-secondary);
        font-size: var(--ds-font-size-sm);
        padding: 0 0.75rem;
        white-space: nowrap;
        box-shadow: inset 0 1px 0 color-mix(in srgb, var(--ds-text-inverse) 4%, transparent);
        transition: color var(--ds-motion-fast) var(--ds-ease-standard),
            background-color var(--ds-motion-fast) var(--ds-ease-standard),
            border-color var(--ds-motion-fast) var(--ds-ease-standard),
            box-shadow var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .ds-app-v2-topbar-icon-btn {
        width: var(--chrome-btn-h, 2.125rem);
        padding: 0;
        font-size: var(--ds-font-size-sm);
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }

    .ds-app-v2-topbar-add-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
    }

    .ds-app-v2-topbar-btn:hover {
        color: var(--ds-text-primary);
        background:
            radial-gradient(
                140% 120% at 0% 0%,
                color-mix(in srgb, var(--ds-border-strong) 22%, transparent) 0%,
                transparent 64%
            ),
            color-mix(in srgb, var(--ds-surface-active) 82%, var(--surface-raised) 18%);
        border-color: color-mix(in srgb, var(--ds-border-strong) 70%, var(--ds-border-subtle));
        box-shadow: 0 8px 18px rgb(0 0 0 / 0.18), inset 0 1px 0 color-mix(in srgb, var(--ds-text-inverse) 8%, transparent);
    }

    .ds-app-v2-topbar-btn[data-pressed='1'] {
        color: var(--ds-text-primary);
        background:
            radial-gradient(
                150% 130% at 0% 0%,
                color-mix(in srgb, var(--ds-border-strong) 28%, transparent) 0%,
                transparent 66%
            ),
            color-mix(in srgb, var(--ds-surface-active) 88%, var(--surface-raised) 12%);
        border-color: color-mix(in srgb, var(--ds-border-strong) 74%, var(--ds-border-subtle));
        box-shadow: 0 10px 20px rgb(0 0 0 / 0.2), inset 0 1px 0 color-mix(in srgb, var(--ds-text-inverse) 8%, transparent);
    }

    .ds-app-v2-topbar-btn:disabled {
        opacity: 0.45;
        cursor: not-allowed;
        background: transparent;
        color: var(--ds-text-secondary);
    }

    @container ds-app-shell-topbar (max-width: 74rem) {
        .ds-app-v2-topbar {
            gap: 0.5rem;
            padding-inline: 0.875rem;
        }

        .ds-app-v2-topbar-left,
        .ds-app-v2-topbar-right {
            gap: 0.5rem;
        }

        .ds-app-v2-topbar-search {
            width: clamp(15rem, 44%, 30rem);
        }
    }

    @container ds-app-shell-topbar (max-width: 58rem) {
        .ds-app-v2-topbar-search {
            width: clamp(12rem, 38%, 22rem);
        }

        .ds-app-v2-topbar-segment-btn {
            min-width: 3.75rem;
            padding-inline: 0.5rem;
            font-size: var(--ds-font-size-xs);
        }

        .ds-app-v2-topbar-btn {
            padding-inline: 0.625rem;
        }

        .ds-app-v2-topbar-add-btn {
            width: var(--chrome-btn-h, 2.125rem);
            padding: 0;
            justify-content: center;
        }

        .ds-app-v2-topbar-add-btn span {
            display: none;
        }
    }

    @container ds-app-shell-topbar (max-width: 48rem) {
        .ds-app-v2-topbar {
            padding-inline: 0.5rem;
        }

        .ds-app-v2-topbar-center {
            justify-content: flex-start;
        }

        .ds-app-v2-topbar-search {
            width: 100%;
        }

        .ds-app-v2-topbar-right {
            gap: 0.25rem;
        }

        .ds-app-v2-topbar-segment {
            min-width: 0;
        }

        .ds-app-v2-topbar-segment-btn {
            min-width: 0;
            padding-inline: 0.375rem;
        }
    }

    .ds-app-v2-topbar-btn:focus-visible,
    .ds-app-v2-topbar-segment-btn:focus-visible,
    .ds-app-v2-topbar-overflow-item:focus-visible,
    .ds-app-v2-topbar-search:focus-visible {
        outline: none;
        border-color: var(--ds-border-strong);
        box-shadow: 0 0 0 2px var(--ds-focus-ring, color-mix(in srgb, var(--ds-border-strong) 78%, transparent)),
            0 8px 16px rgb(0 0 0 / 0.16);
    }
</style>
