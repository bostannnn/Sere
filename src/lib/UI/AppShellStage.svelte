<script lang="ts">
    import ChatScreen from "../ChatScreens/ChatScreen.svelte";
    import ChatRightSidebarHost from "../ChatScreens/ChatRightSidebarHost.svelte";
    import Settings from "../Setting/Settings.svelte";
    import RulebookLibrary from "../Others/RulebookManager/RulebookLibrary.svelte";
    import HomeCharacterDirectory from "./HomeCharacterDirectory.svelte";

    type Workspace = "home" | "characters" | "chats" | "library" | "playground" | "settings";

    type LibraryFilterSnapshot = {
        systems: string[];
        editionsBySystem: Record<string, string[]>;
        selectedSystem: string;
        selectedEdition: string;
    };

    type LibraryShellActions = {
        selectFiles: () => Promise<void>;
        setSystemFilter: (system: string) => void;
        setEditionFilter: (system: string, edition: string) => void;
        clearFilters: () => void;
        getFilterSnapshot: () => LibraryFilterSnapshot;
    };

    interface Props {
        workspace: Workspace;
        shellSearchQuery?: string;
        characterDirectoryShowTrash?: boolean;
        rightSidebarOpen?: boolean;
        rightSidebarTab?: "chat" | "character" | "memory";
        rightSidebarVisible?: boolean;
        librarySidebarOpen?: boolean;
        librarySidebarTab?: "library" | "settings";
        libraryViewMode?: "grid" | "list";
        onLibrarySidebarTabChange?: (tab: "library" | "settings") => void;
        onRegisterLibraryShellActions?: (actions: LibraryShellActions | null) => void;
        onOpenHome?: () => void;
        isMobileShell?: boolean;
        isMobileChatWorkspace?: boolean;
        mobileChatPanelOpen?: boolean;
    }

    let {
        workspace,
        shellSearchQuery = $bindable(""),
        characterDirectoryShowTrash = false,
        rightSidebarOpen = $bindable(true),
        rightSidebarTab = $bindable("chat"),
        rightSidebarVisible = $bindable(false),
        librarySidebarOpen = $bindable(true),
        librarySidebarTab = $bindable("library"),
        libraryViewMode = $bindable("grid"),
        onLibrarySidebarTabChange = () => {},
        onRegisterLibraryShellActions = () => {},
        onOpenHome = () => {},
        isMobileShell = false,
        isMobileChatWorkspace = false,
        mobileChatPanelOpen = $bindable(false),
    }: Props = $props();

    let hasMountedLibraryWorkspace = $state(false);
    const shouldRenderLibraryWorkspace = $derived.by(() => {
        return workspace === "library" || hasMountedLibraryWorkspace;
    });

    $effect(() => {
        if (workspace === "library") {
            hasMountedLibraryWorkspace = true;
        }
    });
</script>

<div class="ds-app-v2-stage">
    {#if workspace === "characters"}
        <div class="ds-app-v2-stage-view ds-app-v2-stage-view-content">
            <HomeCharacterDirectory bind:shellSearchQuery={shellSearchQuery} showTrash={characterDirectoryShowTrash} />
        </div>
    {:else if workspace === "settings"}
        <div class="ds-app-v2-stage-view ds-app-v2-stage-view-content">
            <Settings />
        </div>
    {:else if workspace !== "library"}
        <div class="ds-app-v2-stage-view">
            {#if isMobileChatWorkspace && mobileChatPanelOpen}
                <div class="ds-app-v2-stage-mobile-chat-panel">
                    <ChatRightSidebarHost
                        rightSidebarTab={rightSidebarTab}
                        onSelectTab={(nextTab) => {
                            rightSidebarTab = nextTab;
                        }}
                    />
                </div>
            {:else}
                {#key workspace}
                    <ChatScreen
                        bind:rightSidebarOpen={rightSidebarOpen}
                        bind:rightSidebarTab={rightSidebarTab}
                        bind:rightSidebarVisible={rightSidebarVisible}
                    />
                {/key}
            {/if}
        </div>
    {/if}

    {#if shouldRenderLibraryWorkspace}
        <div
            class="ds-app-v2-stage-view ds-app-v2-stage-view-content"
            class:ds-app-v2-stage-view-hidden={workspace !== "library"}
        >
            <RulebookLibrary
                bind:shellSearchQuery={shellSearchQuery}
                bind:rightSidebarOpen={librarySidebarOpen}
                bind:rightSidebarTab={librarySidebarTab}
                bind:viewMode={libraryViewMode}
                useShellChrome={true}
                isMobileShell={isMobileShell}
                registerShellActions={onRegisterLibraryShellActions}
                onRightSidebarTabChange={onLibrarySidebarTabChange}
                onClose={onOpenHome}
            />
        </div>
    {/if}
</div>

<style>
    .ds-app-v2-stage {
        position: relative;
        z-index: var(--z-view, 10);
        display: flex;
        flex: 1 1 auto;
        min-height: 0;
        min-width: 0;
    }

    .ds-app-v2-stage-view {
        flex: 1 1 auto;
        min-height: 0;
        min-width: 0;
        overflow: hidden;
    }

    .ds-app-v2-stage-view-content {
        flex: 1 1 auto;
        min-width: 0;
        min-height: 0;
        overflow: hidden;
    }

    .ds-app-v2-stage-view-hidden {
        display: none;
    }

    .ds-app-v2-stage-mobile-chat-panel {
        width: 100%;
        height: 100%;
        min-height: 0;
        min-width: 0;
        overflow: hidden;
    }

    .ds-app-v2-stage-mobile-chat-panel :global(.ds-chat-right-pane) {
        width: 100%;
        height: 100%;
        border: none;
        border-radius: 0;
    }

    .ds-app-v2-stage-view :global(.rag-dashboard) {
        position: relative;
        inset: auto;
        z-index: auto;
        height: 100%;
    }
</style>
