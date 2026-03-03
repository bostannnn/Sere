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
        onOpenHome?: () => void;
    }

    let {
        workspace,
        shellSearchQuery = $bindable(""),
        characterDirectoryShowTrash = false,
        rightSidebarOpen = $bindable(true),
        rightSidebarTab = $bindable("chat"),
        rightSidebarVisible = $bindable(false),
        onOpenHome = () => {},
    }: Props = $props();
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
    {:else if workspace === "library"}
        <div class="ds-app-v2-stage-view ds-app-v2-stage-view-content">
            <RulebookLibrary bind:shellSearchQuery={shellSearchQuery} onClose={onOpenHome} />
        </div>
    {:else}
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

    .ds-app-v2-stage-view :global(.rag-dashboard) {
        position: relative;
        inset: auto;
        z-index: auto;
        height: 100%;
    }
</style>
