<script lang="ts">
    import { onMount } from "svelte";
    import {
        settingsOpen,
        SettingsMenuIndex,
        openPresetList,
        openPersonaList,
        bookmarkListOpen,
        MobileGUI,
        selectedCharID,
        DBState,
        appRouteStore,
        openRulebookManager,
        popupStore,
        type AppRoute,
    } from "src/ts/stores.svelte";
    import { alertSelect } from "src/ts/alert";
    import { addCharacter } from "src/ts/characters";
    import {
        repairCharacterChatPage,
        resolveSelectedCharacter,
        resolveSelectedChat,
    } from "src/ts/storage/database.svelte";
    import AppShellTopbar from "./AppShellTopbar.svelte";
    import AppShellStage from "./AppShellStage.svelte";

    type RightSidebarTab = "chat" | "character" | "memory" | "evolution";

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

    let uiShellRightSidebarTab = $state<RightSidebarTab>("chat");
    let librarySidebarTab = $state<"library" | "settings">("library");
    let mobileChatPanelOpen = $state(false);

    const rightSidebarToggleKey = "risu:desktop-char-config-open";
    const librarySidebarToggleKey = "risu:desktop-library-sidebar-open";
    const librarySidebarTabKey = "risu:desktop-library-sidebar-tab";
    const chatRightSidebarPanelId = "chat-right-sidebar-drawer";
    const libraryRightSidebarPanelId = "rulebook-right-sidebar-drawer";

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

    function readLibrarySidebarDefault() {
        if (typeof window === "undefined") {
            return true;
        }
        const saved = window.localStorage.getItem(librarySidebarToggleKey);
        if (saved === "1") {
            return true;
        }
        if (saved === "0") {
            return false;
        }
        return window.innerWidth >= 1280;
    }

    function readLibrarySidebarTabDefault() {
        if (typeof window === "undefined") {
            return "library" as const;
        }
        const saved = window.localStorage.getItem(librarySidebarTabKey);
        return saved === "settings" ? "settings" : "library";
    }

    let uiShellRightSidebarOpen = $state(readRightSidebarDefault());
    let uiShellRightSidebarVisible = $state(readRightSidebarDefault());
    let librarySidebarOpen = $state(readLibrarySidebarDefault());
    librarySidebarTab = readLibrarySidebarTabDefault();
    let libraryViewMode = $state<"grid" | "list">("grid");
    let libraryShellActions = $state<LibraryShellActions | null>(null);
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
        return "characters";
    }

    function resolveSelectedCharacterId(): string | null {
        return resolveSelectedCharacter(DBState.db.characters, $selectedCharID)?.chaId ?? null;
    }

    $effect(() => {
        const selectedCharacter = resolveSelectedCharacter(DBState.db.characters, $selectedCharID);
        repairCharacterChatPage(selectedCharacter);
    });

    function resolveSelectedChatId(): string | null {
        const selectedCharacter = resolveSelectedCharacter(DBState.db.characters, $selectedCharID);
        if (!selectedCharacter) {
            return null;
        }
        return resolveSelectedChat(selectedCharacter)?.id ?? null;
    }

    const resolvedAppRoute = $derived.by((): AppRoute => {
        const workspace = resolveWorkspace();
        const isMobileShell = $MobileGUI;
        let inspector: AppRoute["inspector"] = "none";

        if (workspace === "chats") {
            if (isMobileShell) {
                if (mobileChatPanelOpen) {
                    if (uiShellRightSidebarTab === "character") {
                        inspector = "character";
                    } else if (uiShellRightSidebarTab === "memory") {
                        inspector = "memory";
                    } else if (uiShellRightSidebarTab === "evolution") {
                        inspector = "evolution";
                    } else {
                        inspector = "chat";
                    }
                }
            } else if (uiShellRightSidebarOpen && uiShellRightSidebarVisible) {
                if (uiShellRightSidebarTab === "character") {
                    inspector = "character";
                } else if (uiShellRightSidebarTab === "memory") {
                    inspector = "memory";
                } else if (uiShellRightSidebarTab === "evolution") {
                    inspector = "evolution";
                } else {
                    inspector = "chat";
                }
            }
        } else if (workspace === "library" && !isMobileShell && librarySidebarOpen) {
            inspector = "details";
        }

        return {
            workspace,
            selectedCharacterId: resolveSelectedCharacterId(),
            selectedChatId: resolveSelectedChatId(),
            inspector,
        };
    });

    const isMobileShell = $derived($MobileGUI);
    const isMobileChatWorkspace = $derived(isMobileShell && resolvedAppRoute.workspace === "chats");
    const isMobileSettingsSubpage = $derived(
        isMobileShell
            && resolvedAppRoute.workspace === "settings"
            && $SettingsMenuIndex !== -1,
    );
    const isMobileLibraryWorkspace = $derived(isMobileShell && resolvedAppRoute.workspace === "library");

    const showBottomPrimaryNav = $derived.by(() => {
        if (!isMobileShell) {
            return false;
        }
        if (isMobileChatWorkspace || isMobileSettingsSubpage) {
            return false;
        }
        return resolvedAppRoute.workspace === "characters"
            || resolvedAppRoute.workspace === "library"
            || resolvedAppRoute.workspace === "settings";
    });

    const showTopbarBack = $derived.by(() => {
        return isMobileChatWorkspace || isMobileSettingsSubpage;
    });

    const mobileTopbarVariant = $derived.by(() => {
        if (!isMobileShell) {
            return "desktop" as const;
        }
        if (isMobileChatWorkspace) {
            return "mobile-chat" as const;
        }
        if (isMobileSettingsSubpage) {
            return "mobile-settings-subpage" as const;
        }
        if (isMobileLibraryWorkspace) {
            return "mobile-library" as const;
        }
        return "mobile-root" as const;
    });

    const showShellSearch = $derived.by(() => {
        if (isMobileShell && isMobileChatWorkspace) {
            return false;
        }
        return resolvedAppRoute.workspace === "characters" || resolvedAppRoute.workspace === "library";
    });

    const showRightSidebarToggle = $derived.by(() => {
        if (isMobileShell) {
            return false;
        }
        return resolvedAppRoute.workspace === "chats" || resolvedAppRoute.workspace === "library";
    });

    const showCharacterDirectoryControls = $derived.by(() => {
        return resolvedAppRoute.workspace === "characters";
    });

    const showLibraryControls = $derived.by(() => {
        return resolvedAppRoute.workspace === "library" && !isMobileShell;
    });

    const rightSidebarOpenForWorkspace = $derived.by(() => {
        if (resolvedAppRoute.workspace === "library") {
            return librarySidebarOpen;
        }
        return uiShellRightSidebarOpen;
    });

    const rightSidebarPanelId = $derived.by(() => {
        if (resolvedAppRoute.workspace === "library") {
            return libraryRightSidebarPanelId;
        }
        return chatRightSidebarPanelId;
    });

    const selectedCharacterName = $derived.by(() => {
        if ($selectedCharID < 0) {
            return "Chat";
        }
        return DBState.db.characters?.[$selectedCharID]?.name ?? "Chat";
    });

    const mobileTopbarTitle = $derived.by(() => {
        if (isMobileSettingsSubpage) {
            return "Settings";
        }
        if (isMobileChatWorkspace) {
            return mobileChatPanelOpen ? "Menu" : selectedCharacterName;
        }
        if (isMobileLibraryWorkspace) {
            return "Rulebooks";
        }
        return "Risuai";
    });

    const libraryFilterSnapshot = $derived.by<LibraryFilterSnapshot>(() => {
        if (!libraryShellActions) {
            return {
                systems: [],
                editionsBySystem: {},
                selectedSystem: "All",
                selectedEdition: "All",
            };
        }
        return libraryShellActions.getFilterSnapshot();
    });

    const mobileLibraryFilterVisible = $derived.by(() => {
        return isMobileLibraryWorkspace && libraryShellActions !== null;
    });

    const mobileLibrarySystemLabel = $derived.by(() => {
        return libraryFilterSnapshot.selectedSystem || "All";
    });

    const mobileLibraryEditionLabel = $derived.by(() => {
        return libraryFilterSnapshot.selectedEdition || "All";
    });

    const mobileLibraryCanReset = $derived.by(() => {
        return libraryFilterSnapshot.selectedSystem !== "All" || libraryFilterSnapshot.selectedEdition !== "All";
    });

    function clearTransientOverlays() {
        $openPresetList = false;
        $openPersonaList = false;
        $bookmarkListOpen = false;
        popupStore.children = null;
        popupStore.openId = 0;
    }

    function openHomeFromTopbar() {
        clearTransientOverlays();
        $settingsOpen = false;
        $openRulebookManager = false;
        selectedCharID.set(-1);
        mobileChatPanelOpen = false;
    }

    function openRulebooksFromTopbar() {
        clearTransientOverlays();
        settingsOpen.set(false);
        openRulebookManager.set(true);
        selectedCharID.set(-1);
        mobileChatPanelOpen = false;
    }

    function openSettingsFromTopbar() {
        clearTransientOverlays();
        openRulebookManager.set(false);
        settingsOpen.set(true);
        selectedCharID.set(-1);
        mobileChatPanelOpen = false;
    }

    function handleTopbarBack() {
        if (isMobileSettingsSubpage) {
            SettingsMenuIndex.set(-1);
            return;
        }

        if (isMobileChatWorkspace) {
            if (mobileChatPanelOpen) {
                mobileChatPanelOpen = false;
                return;
            }
            openHomeFromTopbar();
        }
    }

    function openMobileChatMenu() {
        if (!isMobileChatWorkspace) {
            return;
        }
        mobileChatPanelOpen = true;
    }

    function toggleRightSidebar() {
        if (isMobileShell) {
            return;
        }
        if (resolvedAppRoute.workspace === "library") {
            librarySidebarOpen = !librarySidebarOpen;
            if (typeof window !== "undefined") {
                window.localStorage.setItem(librarySidebarToggleKey, librarySidebarOpen ? "1" : "0");
            }
            return;
        }
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
        if (popupStore.children || popupStore.openId !== 0) {
            popupStore.children = null;
            popupStore.openId = 0;
            return true;
        }
        return false;
    }

    async function openLibrarySystemSelector() {
        if (!libraryShellActions) {
            return;
        }
        const snapshot = libraryShellActions.getFilterSnapshot();
        const options = ["All", ...snapshot.systems];
        const selected = await alertSelect(options);
        const index = Number.parseInt(selected, 10);
        if (!Number.isInteger(index) || index < 0 || index >= options.length) {
            return;
        }
        const system = options[index] ?? "All";
        libraryShellActions.setSystemFilter(system);
    }

    async function openLibraryEditionSelector() {
        if (!libraryShellActions) {
            return;
        }

        const snapshot = libraryShellActions.getFilterSnapshot();
        type EditionOption = { label: string; system: string; edition: string };
        const editionOptions: EditionOption[] = [{ label: "All", system: snapshot.selectedSystem, edition: "All" }];

        if (snapshot.selectedSystem === "All") {
            for (const system of snapshot.systems) {
                const editions = snapshot.editionsBySystem[system] ?? [];
                for (const edition of editions) {
                    editionOptions.push({
                        label: `${system}: ${edition}`,
                        system,
                        edition,
                    });
                }
            }
        } else {
            const editions = snapshot.editionsBySystem[snapshot.selectedSystem] ?? [];
            for (const edition of editions) {
                editionOptions.push({
                    label: edition,
                    system: snapshot.selectedSystem,
                    edition,
                });
            }
        }

        if (editionOptions.length === 1) {
            return;
        }

        const selected = await alertSelect(editionOptions.map((option) => option.label));
        const index = Number.parseInt(selected, 10);
        if (!Number.isInteger(index) || index < 0 || index >= editionOptions.length) {
            return;
        }

        const option = editionOptions[index];
        if (!option) {
            return;
        }

        libraryShellActions.setEditionFilter(option.system, option.edition);
    }

    function resetLibraryFilters() {
        libraryShellActions?.clearFilters();
    }

    function handleShellKeydown(event: KeyboardEvent) {
        if (event.key !== "Escape") {
            return;
        }

        if (closeActiveShellOverlay()) {
            event.preventDefault();
            return;
        }

        if (showTopbarBack) {
            handleTopbarBack();
            event.preventDefault();
            return;
        }

        if (showRightSidebarToggle && rightSidebarOpenForWorkspace) {
            if (resolvedAppRoute.workspace === "library") {
                librarySidebarOpen = false;
                if (typeof window !== "undefined") {
                    window.localStorage.setItem(librarySidebarToggleKey, "0");
                }
            } else {
                uiShellRightSidebarOpen = false;
                if (typeof window !== "undefined") {
                    window.localStorage.setItem(rightSidebarToggleKey, "0");
                }
            }
            event.preventDefault();
            return;
        }

    }

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

        if (nextRoute.workspace !== "chats") {
            mobileChatPanelOpen = false;
        }

        clearTransientOverlays();
    });

    onMount(() => {
        window.addEventListener("keydown", handleShellKeydown, true);
        return () => {
            window.removeEventListener("keydown", handleShellKeydown, true);
        };
    });
</script>

<div class="ds-app-v2-shell" data-mobile-bottom-nav={showBottomPrimaryNav ? "1" : "0"}>
    <AppShellTopbar
        workspace={resolvedAppRoute.workspace}
        onOpenHome={openHomeFromTopbar}
        onOpenRulebooks={openRulebooksFromTopbar}
        onOpenSettings={openSettingsFromTopbar}
        primaryNavPlacement={showBottomPrimaryNav ? "bottom" : "top"}
        mobileVariant={mobileTopbarVariant}
        mobileTitle={mobileTopbarTitle}
        showTopbarBack={showTopbarBack}
        onTopbarBack={handleTopbarBack}
        showMobileMenuAction={isMobileChatWorkspace && !mobileChatPanelOpen}
        onMobileMenuAction={openMobileChatMenu}
        showShellSearch={showShellSearch}
        bind:shellSearchQuery={shellSearch}
        showRightSidebarToggle={showRightSidebarToggle}
        rightSidebarOpen={rightSidebarOpenForWorkspace}
        rightSidebarPanelId={rightSidebarPanelId}
        onToggleRightSidebar={toggleRightSidebar}
        showCharacterDirectoryControls={showCharacterDirectoryControls}
        showLibraryControls={showLibraryControls}
        libraryViewMode={libraryViewMode}
        onSetLibraryViewModeGrid={() => {
            libraryViewMode = "grid";
        }}
        onSetLibraryViewModeList={() => {
            libraryViewMode = "list";
        }}
        onAddLibraryDocuments={() => {
            void libraryShellActions?.selectFiles();
        }}
        characterDirectoryShowTrash={characterDirectoryShowTrash}
        onShowActiveCharacters={showActiveCharacters}
        onShowTrashCharacters={showTrashCharacters}
        onAddCharacter={() => {
            void addCharacterFromTopbar();
        }}
        mobileLibraryFilterVisible={mobileLibraryFilterVisible}
        mobileLibrarySystemLabel={mobileLibrarySystemLabel}
        mobileLibraryEditionLabel={mobileLibraryEditionLabel}
        mobileLibraryCanReset={mobileLibraryCanReset}
        onOpenSystemSelector={openLibrarySystemSelector}
        onOpenEditionSelector={openLibraryEditionSelector}
        onResetLibraryFilters={resetLibraryFilters}
    />
    <AppShellStage
        workspace={resolvedAppRoute.workspace}
        bind:shellSearchQuery={shellSearch}
        characterDirectoryShowTrash={characterDirectoryShowTrash}
        bind:rightSidebarOpen={uiShellRightSidebarOpen}
        bind:rightSidebarTab={uiShellRightSidebarTab}
        bind:rightSidebarVisible={uiShellRightSidebarVisible}
        bind:librarySidebarOpen={librarySidebarOpen}
        bind:librarySidebarTab={librarySidebarTab}
        bind:libraryViewMode={libraryViewMode}
        onLibrarySidebarTabChange={(nextTab) => {
            librarySidebarTab = nextTab;
            if (typeof window !== "undefined") {
                window.localStorage.setItem(librarySidebarTabKey, nextTab);
            }
        }}
        onRegisterLibraryShellActions={(actions) => {
            libraryShellActions = actions;
        }}
        onOpenHome={openHomeFromTopbar}
        isMobileShell={isMobileShell}
        isMobileChatWorkspace={isMobileChatWorkspace}
        bind:mobileChatPanelOpen
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

    .ds-app-v2-shell[data-mobile-bottom-nav="1"] {
        padding-bottom: calc(var(--ds-space-4) * 3 + env(safe-area-inset-bottom, 0px));
    }
</style>
