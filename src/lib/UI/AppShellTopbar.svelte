<script lang="ts">
    import {
        ArrowLeft,
        BookIcon,
        EllipsisIcon,
        HomeIcon,
        LayoutGridIcon,
        ListIcon,
        MenuIcon,
        PanelRightIcon,
        PlusIcon,
        SettingsIcon,
    } from "@lucide/svelte";
    import { onDestroy, onMount } from "svelte";
    import type { MenuDef } from "src/ts/stores.svelte";
    import PluginDefinedIcon from "../Others/PluginDefinedIcon.svelte";
    import "./AppShellTopbar.css";

    type Workspace = "home" | "characters" | "chats" | "library" | "settings";
    type MobileVariant = "desktop" | "mobile-chat" | "mobile-settings-subpage" | "mobile-library" | "mobile-root";

    interface Props {
        workspace: Workspace;
        onOpenHome?: () => void;
        onOpenRulebooks?: () => void;
        onOpenSettings?: () => void;
        primaryNavPlacement?: "top" | "bottom";
        mobileBackToMenuVisible?: boolean;
        onMobileBackToMenu?: () => void;
        mobileVariant?: MobileVariant;
        mobileTitle?: string;
        showTopbarBack?: boolean;
        onTopbarBack?: () => void;
        showMobileMenuAction?: boolean;
        onMobileMenuAction?: () => void;
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
        mobileLibraryFilterVisible?: boolean;
        mobileLibrarySystemLabel?: string;
        mobileLibraryEditionLabel?: string;
        mobileLibraryCanReset?: boolean;
        onOpenSystemSelector?: () => void;
        onOpenEditionSelector?: () => void;
        onResetLibraryFilters?: () => void;
    }

    let {
        workspace,
        onOpenHome = () => {},
        onOpenRulebooks = () => {},
        onOpenSettings = () => {},
        primaryNavPlacement = "top",
        mobileBackToMenuVisible = false,
        onMobileBackToMenu = () => {},
        mobileVariant = "desktop",
        mobileTitle = "Risuai",
        showTopbarBack = false,
        onTopbarBack = () => {},
        showMobileMenuAction = false,
        onMobileMenuAction = () => {},
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
        mobileLibraryFilterVisible = false,
        mobileLibrarySystemLabel = "All",
        mobileLibraryEditionLabel = "All",
        mobileLibraryCanReset = false,
        onOpenSystemSelector = () => {},
        onOpenEditionSelector = () => {},
        onResetLibraryFilters = () => {},
    }: Props = $props();

    let overflowWrapEl = $state<HTMLElement | null>(null);

    const homeActive = $derived(workspace === "characters");
    const rulebooksActive = $derived(workspace === "library");
    const settingsActive = $derived(workspace === "settings");
    const hasOverflowItems = $derived(overflowItems.length > 0);

    const effectiveShowTopbarBack = $derived.by(() => {
        return showTopbarBack || (primaryNavPlacement === "bottom" && mobileBackToMenuVisible);
    });

    $effect(() => {
        if (!hasOverflowItems && overflowOpen) {
            overflowOpen = false;
        }
    });

    const openHome = () => {
        overflowOpen = false;
        onOpenHome();
    };

    const openRulebooks = () => {
        overflowOpen = false;
        onOpenRulebooks();
    };

    const openSettings = () => {
        overflowOpen = false;
        onOpenSettings();
    };

    const runTopbarBack = () => {
        if (showTopbarBack) {
            onTopbarBack();
            return;
        }
        onMobileBackToMenu();
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

<header
    class="ds-app-v2-topbar"
    class:ds-app-v2-topbar-has-search={showShellSearch}
    class:ds-app-v2-topbar-mobile-nav-bottom={primaryNavPlacement === "bottom"}
    class:ds-app-v2-topbar-has-mobile-back={effectiveShowTopbarBack}
    class:ds-app-v2-topbar-mobile-variant={mobileVariant !== "desktop"}
    data-workspace={workspace}
    data-mobile-variant={mobileVariant}
>
    <div class="ds-app-v2-topbar-left">
        {#if effectiveShowTopbarBack}
            <button
                type="button"
                class="ds-mobile-header-icon-btn icon-btn icon-btn--md"
                title="Back"
                aria-label="Back"
                onclick={runTopbarBack}
                data-testid="topbar-mobile-back-to-menu"
            >
                <ArrowLeft size={18} />
            </button>
            <span class="ds-mobile-header-title">{mobileTitle}</span>
        {:else if primaryNavPlacement === "top"}
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

                {#if hasOverflowItems}
                    <div class="ds-app-v2-topbar-overflow-wrap" bind:this={overflowWrapEl}>
                        <button
                            type="button"
                            class="ds-app-v2-topbar-btn ds-app-v2-topbar-icon-btn ds-app-v2-topbar-nav-btn icon-btn icon-btn--md icon-btn--bordered"
                            aria-label="More navigation actions"
                            title="More"
                            aria-pressed={overflowOpen}
                            aria-expanded={overflowOpen}
                            aria-controls="topbar-overflow-menu"
                            data-pressed={overflowOpen ? "1" : "0"}
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
                            </div>
                        {/if}
                    </div>
                {/if}
            </nav>
        {/if}
    </div>

    <div class="ds-app-v2-topbar-center">
        {#if !effectiveShowTopbarBack && showShellSearch}
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
        {#if showMobileMenuAction}
            <button
                type="button"
                class="ds-mobile-header-icon-btn icon-btn icon-btn--md"
                title="Open menu"
                aria-label="Open menu"
                onclick={onMobileMenuAction}
                data-testid="topbar-mobile-open-menu"
            >
                <MenuIcon size={18} />
            </button>
        {:else if mobileLibraryFilterVisible}
            <div class="ds-app-v2-topbar-segment seg-tabs ds-app-v2-topbar-mobile-library-filters" role="group" aria-label="Rulebook filters">
                <button
                    type="button"
                    class="ds-app-v2-topbar-segment-btn seg-tab"
                    title={`System: ${mobileLibrarySystemLabel}`}
                    aria-label={`System filter: ${mobileLibrarySystemLabel}`}
                    onclick={onOpenSystemSelector}
                    data-testid="topbar-library-mobile-system"
                >
                    System: {mobileLibrarySystemLabel}
                </button>
                <button
                    type="button"
                    class="ds-app-v2-topbar-segment-btn seg-tab"
                    title={`Edition: ${mobileLibraryEditionLabel}`}
                    aria-label={`Edition filter: ${mobileLibraryEditionLabel}`}
                    onclick={onOpenEditionSelector}
                    data-testid="topbar-library-mobile-edition"
                >
                    Edition: {mobileLibraryEditionLabel}
                </button>
                <button
                    type="button"
                    class="ds-app-v2-topbar-segment-btn seg-tab"
                    title="Reset filters"
                    aria-label="Reset filters"
                    onclick={onResetLibraryFilters}
                    disabled={!mobileLibraryCanReset}
                    data-testid="topbar-library-mobile-reset"
                >
                    All
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
        {:else if showLibraryControls}
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

{#if primaryNavPlacement === "bottom"}
    <div class="ds-app-v2-mobile-nav-shell">
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

            {#if hasOverflowItems}
                <div class="ds-app-v2-topbar-overflow-wrap" bind:this={overflowWrapEl}>
                    <button
                        type="button"
                        class="ds-app-v2-topbar-btn ds-app-v2-topbar-icon-btn ds-app-v2-topbar-nav-btn icon-btn icon-btn--md icon-btn--bordered"
                        aria-label="More navigation actions"
                        title="More"
                        aria-pressed={overflowOpen}
                        aria-expanded={overflowOpen}
                        aria-controls="topbar-overflow-menu"
                        data-pressed={overflowOpen ? "1" : "0"}
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
                        </div>
                    {/if}
                </div>
            {/if}
        </nav>
    </div>
{/if}
