<script lang="ts">
    import RulebookLibrarySidebar from "./RulebookLibrarySidebar.svelte";

    interface Props {
        rightSidebarOpen: boolean;
        rightSidebarTab?: "library" | "settings";
        systemTree: Array<[string, Set<string>]>;
        expandedSystems: Set<string>;
        selectedSystemFilter: string;
        selectedEditionFilter: string;
        rulebookCount: number;
        onToggleSystem?: (system: string) => void;
        onSelectSystem?: (system: string) => void;
        onSelectEdition?: (system: string, edition: string) => void;
        onClearFilters?: () => void;
        onSelectSidebarTab?: (tab: "library" | "settings") => void;
    }

    let {
        rightSidebarOpen,
        rightSidebarTab = $bindable("library"),
        systemTree,
        expandedSystems,
        selectedSystemFilter,
        selectedEditionFilter,
        rulebookCount,
        onToggleSystem = () => {},
        onSelectSystem = () => {},
        onSelectEdition = () => {},
        onClearFilters = () => {},
        onSelectSidebarTab = () => {},
    }: Props = $props();

    function selectSidebarTab(tab: "library" | "settings") {
        rightSidebarTab = tab;
        onSelectSidebarTab(tab);
    }
</script>

{#if rightSidebarOpen}
    <div
        id="rulebook-right-sidebar-drawer"
        class="rag-right-drawer drawer-elevation--right"
        data-testid="rulebook-right-sidebar-drawer"
    >
        <aside class="ds-chat-right-pane" data-testid="rulebook-sidebar-host">
            <div class="ds-chat-right-panel-tabs seg-tabs" role="tablist" aria-label="Rulebook sidebar sections">
                <button
                    type="button"
                    class="ds-chat-right-panel-tab seg-tab"
                    role="tab"
                    id="rulebook-sidebar-tab-library"
                    aria-selected={rightSidebarTab === "library"}
                    aria-controls="rulebook-sidebar-panel-library"
                    tabindex={rightSidebarTab === "library" ? 0 : -1}
                    class:ds-chat-right-panel-tab-active={rightSidebarTab === "library"}
                    class:active={rightSidebarTab === "library"}
                    class:is-active={rightSidebarTab === "library"}
                    onclick={() => selectSidebarTab("library")}
                    data-testid="rulebook-sidebar-tab-library"
                >
                    Library
                </button>
                <button
                    type="button"
                    class="ds-chat-right-panel-tab seg-tab"
                    role="tab"
                    id="rulebook-sidebar-tab-settings"
                    aria-selected={rightSidebarTab === "settings"}
                    aria-controls="rulebook-sidebar-panel-settings"
                    tabindex={rightSidebarTab === "settings" ? 0 : -1}
                    class:ds-chat-right-panel-tab-active={rightSidebarTab === "settings"}
                    class:active={rightSidebarTab === "settings"}
                    class:is-active={rightSidebarTab === "settings"}
                    onclick={() => selectSidebarTab("settings")}
                    data-testid="rulebook-sidebar-tab-settings"
                >
                    Settings
                </button>
            </div>

            <div class="ds-chat-right-panel-content">
                {#if rightSidebarTab === "library"}
                    <div
                        class="ds-chat-right-panel-pane ds-chat-right-panel-pane-character"
                        role="tabpanel"
                        id="rulebook-sidebar-panel-library"
                        aria-labelledby="rulebook-sidebar-tab-library"
                        data-testid="rulebook-sidebar-pane-library"
                    >
                        <RulebookLibrarySidebar
                            section="library"
                            mode="drawer"
                            {systemTree}
                            {expandedSystems}
                            {selectedSystemFilter}
                            {selectedEditionFilter}
                            rulebookCount={rulebookCount}
                            onToggleSystem={onToggleSystem}
                            onSelectSystem={onSelectSystem}
                            onSelectEdition={onSelectEdition}
                            onClearFilters={onClearFilters}
                        />
                    </div>
                {:else}
                    <div
                        class="ds-chat-right-panel-pane ds-chat-right-panel-pane-character"
                        role="tabpanel"
                        id="rulebook-sidebar-panel-settings"
                        aria-labelledby="rulebook-sidebar-tab-settings"
                        data-testid="rulebook-sidebar-pane-settings"
                    >
                        <RulebookLibrarySidebar section="settings" mode="drawer" />
                    </div>
                {/if}
            </div>
        </aside>
    </div>
{/if}
