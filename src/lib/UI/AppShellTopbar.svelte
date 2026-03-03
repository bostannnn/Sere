<script lang="ts">
    import {
        BookIcon,
        EllipsisIcon,
        HomeIcon,
        LayoutGridIcon,
        ListIcon,
        PanelRightIcon,
        PlusIcon,
        SettingsIcon,
        ShellIcon,
    } from "@lucide/svelte";
    import { onDestroy, onMount } from "svelte";
    import type { MenuDef } from "src/ts/stores.svelte";
    import PluginDefinedIcon from "../Others/PluginDefinedIcon.svelte";
    import "./AppShellTopbar.css";

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
        showLibraryControls?: boolean;
        libraryViewMode?: "grid" | "list";
        onSetLibraryViewModeGrid?: () => void;
        onSetLibraryViewModeList?: () => void;
        onAddLibraryDocuments?: () => void;
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
        showLibraryControls = false,
        libraryViewMode = "grid",
        onSetLibraryViewModeGrid = () => {},
        onSetLibraryViewModeList = () => {},
        onAddLibraryDocuments = () => {},
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
        {#if showLibraryControls}
            <div class="ds-app-v2-topbar-segment ds-app-v2-topbar-library-segment seg-tabs" role="tablist" aria-label="Rulebook view mode">
                <button
                    type="button"
                    class="ds-app-v2-topbar-segment-btn seg-tab"
                    class:ds-app-v2-topbar-segment-btn-active={libraryViewMode === "grid"}
                    class:active={libraryViewMode === "grid"}
                    role="tab"
                    aria-selected={libraryViewMode === "grid"}
                    aria-label="Grid view"
                    title="Grid view"
                    tabindex={libraryViewMode === "grid" ? 0 : -1}
                    onclick={onSetLibraryViewModeGrid}
                    data-testid="topbar-library-view-grid"
                >
                    <LayoutGridIcon size={14} />
                </button>
                <button
                    type="button"
                    class="ds-app-v2-topbar-segment-btn seg-tab"
                    class:ds-app-v2-topbar-segment-btn-active={libraryViewMode === "list"}
                    class:active={libraryViewMode === "list"}
                    role="tab"
                    aria-selected={libraryViewMode === "list"}
                    aria-label="List view"
                    title="List view"
                    tabindex={libraryViewMode === "list" ? 0 : -1}
                    onclick={onSetLibraryViewModeList}
                    data-testid="topbar-library-view-list"
                >
                    <ListIcon size={14} />
                </button>
            </div>
            <button
                type="button"
                class="ds-app-v2-topbar-btn ds-app-v2-topbar-add-btn"
                onclick={onAddLibraryDocuments}
                data-testid="topbar-library-add-documents"
                title="Add documents"
                aria-label="Add documents"
            >
                <PlusIcon size={14} />
                <span>Add</span>
            </button>
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
            {/if}
        {:else if showRightSidebarToggle}
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
