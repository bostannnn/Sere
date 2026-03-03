<script lang="ts">
    import { BookIcon, InfoIcon } from "@lucide/svelte";
    import Button from "../../UI/GUI/Button.svelte";

    interface Props {
        hasLoadedLibrary: boolean;
        loadErrorMessage: string;
        rulebookCount: number;
        filteredCount: number;
        shellSearchQuery: string;
        onRetry?: () => void;
        onSelectFiles?: () => void;
    }

    let {
        hasLoadedLibrary,
        loadErrorMessage,
        rulebookCount,
        filteredCount,
        shellSearchQuery,
        onRetry = () => {},
        onSelectFiles = () => {},
    }: Props = $props();
</script>

{#if !hasLoadedLibrary}
    <div class="rag-empty-state panel-shell empty-state" data-testid="rulebook-library-loading-state">
        <div class="ds-chat-spinner-sm"></div>
        <p>Loading library...</p>
    </div>
{:else if loadErrorMessage && rulebookCount === 0}
    <div class="rag-empty-state panel-shell empty-state" data-testid="rulebook-library-error-state">
        <InfoIcon size={42} />
        <p>Could not load your library.</p>
        <p class="rag-empty-state-detail">{loadErrorMessage}</p>
        <Button onclick={onRetry}>Retry</Button>
    </div>
{:else if filteredCount === 0}
    <div class="rag-empty-state panel-shell empty-state" data-testid="rulebook-library-empty-state">
        <BookIcon size={64} />
        <p>{shellSearchQuery ? "No rulebooks match your search." : "Your library is empty."}</p>
        {#if !shellSearchQuery}
            <Button onclick={onSelectFiles}>Upload your first PDF</Button>
        {/if}
    </div>
{/if}
