<script lang="ts">
    import RulebookLibrarySidebar from "./RulebookLibrarySidebar.svelte";

    interface Props {
        systemTree: Array<[string, Set<string>]>;
        expandedSystems: Set<string>;
        selectedSystemFilter: string;
        selectedEditionFilter: string;
        rulebookCount: number;
        onToggleSystem?: (system: string) => void;
        onSelectSystem?: (system: string) => void;
        onSelectEdition?: (system: string, edition: string) => void;
        onClearFilters?: () => void;
    }

    let {
        systemTree,
        expandedSystems,
        selectedSystemFilter,
        selectedEditionFilter,
        rulebookCount,
        onToggleSystem = () => {},
        onSelectSystem = () => {},
        onSelectEdition = () => {},
        onClearFilters = () => {},
    }: Props = $props();
</script>

<aside class="rag-sidebar panel-shell panel-shell--raised">
    <RulebookLibrarySidebar
        section="library"
        mode="legacy"
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

    <div class="ds-settings-divider"></div>

    <RulebookLibrarySidebar section="settings" mode="legacy" />
</aside>
