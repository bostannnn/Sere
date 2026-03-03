<script lang="ts">
    import ChatScreen from "../ChatScreens/ChatScreen.svelte";
    import Settings from "../Setting/Settings.svelte";
    import RulebookLibrary from "../Others/RulebookManager/RulebookLibrary.svelte";
    import HomeCharacterDirectory from "./HomeCharacterDirectory.svelte";

    type Workspace = "home" | "characters" | "chats" | "library" | "playground" | "settings";

    interface Props {
        workspace: Workspace;
        shellSearchQuery?: string;
        characterDirectoryShowTrash?: boolean;
        rightSidebarOpen?: boolean;
        rightSidebarTab?: "chat" | "character";
        rightSidebarVisible?: boolean;
        librarySidebarOpen?: boolean;
        librarySidebarTab?: "library" | "settings";
        libraryViewMode?: "grid" | "list";
        onLibrarySidebarTabChange?: (tab: "library" | "settings") => void;
        onRegisterLibraryShellActions?: (actions: { selectFiles: () => Promise<void> } | null) => void;
        onOpenHome?: () => void;
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
            {#key workspace}
                <ChatScreen
                    bind:rightSidebarOpen={rightSidebarOpen}
                    bind:rightSidebarTab={rightSidebarTab}
                    bind:rightSidebarVisible={rightSidebarVisible}
                />
            {/key}
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

    .ds-app-v2-stage-view :global(.rag-dashboard) {
        position: relative;
        inset: auto;
        z-index: auto;
        height: 100%;
    }
</style>
