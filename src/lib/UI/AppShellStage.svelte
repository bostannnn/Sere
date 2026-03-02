<script lang="ts">
    import ChatScreen from "../ChatScreens/ChatScreen.svelte";
    import Settings from "../Setting/Settings.svelte";
    import RulebookLibrary from "../Others/RulebookManager/RulebookLibrary.svelte";
    import HomeCharacterDirectory from "./HomeCharacterDirectory.svelte";
    import GlobalLauncher from "./GlobalLauncher.svelte";

    type Workspace = "home" | "characters" | "chats" | "library" | "playground" | "settings";

    interface Props {
        workspace: Workspace;
        showShellHostedGlobalRail?: boolean;
        shellSearchQuery?: string;
        characterDirectoryShowTrash?: boolean;
        showGlobalLauncher?: boolean;
        globalRailPanelId?: string;
        rightSidebarOpen?: boolean;
        rightSidebarTab?: "chat" | "character";
        rightSidebarVisible?: boolean;
        onOpenChatList?: () => void;
        onOpenCharacterCatalog?: () => void;
        onResetOverlays?: () => void;
    }

    let {
        workspace,
        showShellHostedGlobalRail = false,
        shellSearchQuery = $bindable(""),
        characterDirectoryShowTrash = false,
        showGlobalLauncher = true,
        globalRailPanelId = "global-navigation-rail",
        rightSidebarOpen = $bindable(true),
        rightSidebarTab = $bindable("chat"),
        rightSidebarVisible = $bindable(false),
        onOpenChatList = () => {},
        onOpenCharacterCatalog = () => {},
        onResetOverlays = () => {},
    }: Props = $props();
</script>

<div class="ds-app-v2-stage">
    {#if workspace === "characters"}
        <div class="ds-app-v2-stage-view ds-app-v2-stage-view-layout">
            <GlobalLauncher
                railId={globalRailPanelId}
                visible={showShellHostedGlobalRail}
                activeOverlay="none"
                onOpenChatList={onOpenChatList}
                onOpenCharacterCatalog={onOpenCharacterCatalog}
                onResetOverlays={onResetOverlays}
            />
            <div class="ds-app-v2-stage-view-content">
                <HomeCharacterDirectory bind:shellSearchQuery={shellSearchQuery} showTrash={characterDirectoryShowTrash} />
            </div>
        </div>
    {:else if workspace === "settings"}
        <div class="ds-app-v2-stage-view ds-app-v2-stage-view-layout">
            <GlobalLauncher
                railId={globalRailPanelId}
                visible={showShellHostedGlobalRail}
                activeOverlay="none"
                onOpenChatList={onOpenChatList}
                onOpenCharacterCatalog={onOpenCharacterCatalog}
                onResetOverlays={onResetOverlays}
            />
            <div class="ds-app-v2-stage-view-content">
                <Settings />
            </div>
        </div>
    {:else if workspace === "library"}
        <div class="ds-app-v2-stage-view ds-app-v2-stage-view-layout">
            <GlobalLauncher
                railId={globalRailPanelId}
                visible={showShellHostedGlobalRail}
                activeOverlay="none"
                onOpenChatList={onOpenChatList}
                onOpenCharacterCatalog={onOpenCharacterCatalog}
                onResetOverlays={onResetOverlays}
            />
            <div class="ds-app-v2-stage-view-content">
                <RulebookLibrary bind:shellSearchQuery={shellSearchQuery} />
            </div>
        </div>
    {:else}
        <div class="ds-app-v2-stage-view">
            {#key workspace}
                <ChatScreen
                    showGlobalLauncher={showGlobalLauncher}
                    globalRailPanelId={globalRailPanelId}
                    bind:rightSidebarOpen={rightSidebarOpen}
                    bind:rightSidebarTab={rightSidebarTab}
                    bind:rightSidebarVisible={rightSidebarVisible}
                />
            {/key}
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

    .ds-app-v2-stage-view-layout {
        display: flex;
        align-items: stretch;
    }

    .ds-app-v2-stage-view-content {
        flex: 1 1 auto;
        min-width: 0;
        min-height: 0;
        overflow: hidden;
    }

    .ds-app-v2-stage-view :global(.rag-dashboard) {
        position: relative;
        inset: auto;
        z-index: auto;
        height: 100%;
    }
</style>
