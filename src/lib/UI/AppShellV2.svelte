<script lang="ts">
    import { onMount } from "svelte";
    import {
        additionalHamburgerMenu,
        settingsOpen,
        openPresetList,
        openPersonaList,
        bookmarkListOpen,
        selectedCharID,
        PlaygroundStore,
        DBState,
        appRouteStore,
        openRulebookManager,
        hypaV3ModalOpen,
        type AppRoute,
    } from "src/ts/stores.svelte";
    import { addCharacter } from "src/ts/characters";
    import AppShellTopbar from "./AppShellTopbar.svelte";
    import AppShellStage from "./AppShellStage.svelte";

    let topbarOverflowOpen = $state(false);
    let uiShellRightSidebarTab = $state<"chat" | "character">("chat");
    const rightSidebarToggleKey = "risu:desktop-char-config-open";
    const rightSidebarPanelId = "chat-right-sidebar-drawer";

    function readRightSidebarDefault() {
        if (typeof window === "undefined") {
            return true;
        }
        const saved = window.localStorage.getItem(rightSidebarToggleKey);
        if (saved === "1") {
            return true;
        }
        if (saved === "0") {
            return false;
        }
        return window.innerWidth >= 1280;
    }

    let uiShellRightSidebarOpen = $state(readRightSidebarDefault());
    let uiShellRightSidebarVisible = $state(readRightSidebarDefault());
    let shellSearch = $state("");
    let characterDirectoryShowTrash = $state(false);

    function resolveWorkspace(): AppRoute["workspace"] {
        if ($settingsOpen) {
            return "settings";
        }
        if ($openRulebookManager) {
            return "library";
        }
        if ($selectedCharID >= 0) {
            return "chats";
        }
        if ($PlaygroundStore === 1) {
            return "playground";
        }
        return "characters";
    }

    function resolveSelectedCharacterId(): string | null {
        if ($selectedCharID < 0) {
            return null;
        }
        return DBState.db.characters?.[$selectedCharID]?.chaId ?? null;
    }

    function resolveSelectedChatId(): string | null {
        if ($selectedCharID < 0) {
            return null;
        }
        const selectedCharacter = DBState.db.characters?.[$selectedCharID];
        if (!selectedCharacter) {
            return null;
        }
        const chats = selectedCharacter.chats ?? [];
        if (chats.length === 0) {
            return null;
        }

        const currentChatPage = selectedCharacter.chatPage;
        const safeChatPage = Number.isInteger(currentChatPage) && currentChatPage >= 0 && currentChatPage < chats.length
            ? currentChatPage
            : 0;

        if (safeChatPage !== currentChatPage) {
            selectedCharacter.chatPage = safeChatPage;
        }

        return chats[safeChatPage]?.id ?? null;
    }

    const resolvedAppRoute = $derived.by((): AppRoute => {
        const workspace = resolveWorkspace();
        const inspector = workspace === "chats" && uiShellRightSidebarOpen && uiShellRightSidebarVisible
            ? (uiShellRightSidebarTab === "character" ? "character" : "chat")
            : "none";
        return {
            workspace,
            selectedCharacterId: resolveSelectedCharacterId(),
            selectedChatId: resolveSelectedChatId(),
            inspector,
        };
    });

    const showShellSearch = $derived.by(() => {
        return resolvedAppRoute.workspace === "characters" || resolvedAppRoute.workspace === "library";
    });

    function openHomeFromTopbar() {
        clearTransientOverlays();
        $settingsOpen = false;
        $openRulebookManager = false;
        PlaygroundStore.set(0);
        selectedCharID.set(-1);
        topbarOverflowOpen = false;
    }

    function openPlaygroundFromTopbar() {
        clearTransientOverlays();
        $settingsOpen = false;
        openRulebookManager.set(false);
        selectedCharID.set(-1);
        PlaygroundStore.set(1);
        topbarOverflowOpen = false;
    }

    function openRulebooksFromTopbar() {
        clearTransientOverlays();
        settingsOpen.set(false);
        selectedCharID.set(-1);
        PlaygroundStore.set(0);
        openRulebookManager.set(true);
        topbarOverflowOpen = false;
    }

    function openSettingsFromTopbar() {
        clearTransientOverlays();
        openRulebookManager.set(false);
        selectedCharID.set(-1);
        PlaygroundStore.set(0);
        settingsOpen.set(true);
        topbarOverflowOpen = false;
    }

    function toggleRightSidebar() {
        uiShellRightSidebarOpen = !uiShellRightSidebarOpen;
        if (typeof window !== "undefined") {
            window.localStorage.setItem(rightSidebarToggleKey, uiShellRightSidebarOpen ? "1" : "0");
        }
    }

    function showActiveCharacters() {
        characterDirectoryShowTrash = false;
    }

    function showTrashCharacters() {
        characterDirectoryShowTrash = true;
    }

    async function addCharacterFromTopbar() {
        await addCharacter();
    }

    function isSameRoute(left: AppRoute, right: AppRoute) {
        return left.workspace === right.workspace
            && left.selectedCharacterId === right.selectedCharacterId
            && left.selectedChatId === right.selectedChatId
            && left.inspector === right.inspector;
    }

    function clearTransientOverlays() {
        $openPresetList = false;
        $openPersonaList = false;
        $bookmarkListOpen = false;
        $hypaV3ModalOpen = false;
    }

    const showRightSidebarToggle = $derived.by(() => {
        return resolvedAppRoute.workspace === "chats";
    });

    const showCharacterDirectoryControls = $derived.by(() => {
        return resolvedAppRoute.workspace === "characters";
    });

    let lastWorkspace = $state<AppRoute["workspace"]>(resolveWorkspace());

    $effect(() => {
        const nextRoute = resolvedAppRoute;
        if (!isSameRoute($appRouteStore, nextRoute)) {
            appRouteStore.set(nextRoute);
        }

        if (nextRoute.workspace === lastWorkspace) {
            return;
        }

        lastWorkspace = nextRoute.workspace;

        if (nextRoute.workspace !== "characters") {
            characterDirectoryShowTrash = false;
        }

        clearTransientOverlays();
    });

    function closeActiveShellOverlay() {
        if ($openPresetList) {
            $openPresetList = false;
            return true;
        }
        if ($openPersonaList) {
            $openPersonaList = false;
            return true;
        }
        if ($bookmarkListOpen) {
            $bookmarkListOpen = false;
            return true;
        }
        if ($hypaV3ModalOpen) {
            $hypaV3ModalOpen = false;
            return true;
        }
        return false;
    }

    function handleShellKeydown(event: KeyboardEvent) {
        if (event.key !== "Escape") {
            return;
        }

        if (closeActiveShellOverlay()) {
            event.preventDefault();
            return;
        }

        if (showRightSidebarToggle && uiShellRightSidebarOpen) {
            uiShellRightSidebarOpen = false;
            if (typeof window !== "undefined") {
                window.localStorage.setItem(rightSidebarToggleKey, "0");
            }
            event.preventDefault();
            return;
        }

        if (topbarOverflowOpen) {
            topbarOverflowOpen = false;
            event.preventDefault();
        }
    }

    onMount(() => {
        window.addEventListener("keydown", handleShellKeydown, true);
        return () => {
            window.removeEventListener("keydown", handleShellKeydown, true);
        };
    });
</script>

<div class="ds-app-v2-shell">
    <AppShellTopbar
        workspace={resolvedAppRoute.workspace}
        onOpenHome={openHomeFromTopbar}
        onOpenPlayground={openPlaygroundFromTopbar}
        onOpenRulebooks={openRulebooksFromTopbar}
        onOpenSettings={openSettingsFromTopbar}
        overflowItems={additionalHamburgerMenu}
        bind:overflowOpen={topbarOverflowOpen}
        showShellSearch={showShellSearch}
        bind:shellSearchQuery={shellSearch}
        showRightSidebarToggle={showRightSidebarToggle}
        rightSidebarOpen={uiShellRightSidebarOpen}
        rightSidebarPanelId={rightSidebarPanelId}
        onToggleRightSidebar={toggleRightSidebar}
        showCharacterDirectoryControls={showCharacterDirectoryControls}
        characterDirectoryShowTrash={characterDirectoryShowTrash}
        onShowActiveCharacters={showActiveCharacters}
        onShowTrashCharacters={showTrashCharacters}
        onAddCharacter={() => {
            void addCharacterFromTopbar();
        }}
    />
    <AppShellStage
        workspace={resolvedAppRoute.workspace}
        bind:shellSearchQuery={shellSearch}
        characterDirectoryShowTrash={characterDirectoryShowTrash}
        bind:rightSidebarOpen={uiShellRightSidebarOpen}
        bind:rightSidebarTab={uiShellRightSidebarTab}
        bind:rightSidebarVisible={uiShellRightSidebarVisible}
        onOpenHome={openHomeFromTopbar}
    />
</div>

<style>
    .ds-app-v2-shell {
        width: 100%;
        height: 100%;
        min-width: 0;
        display: flex;
        flex-direction: column;
    }
</style>
