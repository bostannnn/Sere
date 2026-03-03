<script lang="ts">
    import { LayoutGridIcon, ListIcon, UploadIcon } from "@lucide/svelte";
    import Button from "../../UI/GUI/Button.svelte";
    import IconButton from "../../UI/GUI/IconButton.svelte";

    interface Props {
        filteredCount: number;
        viewMode?: "grid" | "list";
        onSelectFiles?: () => void;
    }

    let {
        filteredCount,
        viewMode = $bindable("grid"),
        onSelectFiles = () => {},
    }: Props = $props();
</script>

<div class="rag-toolbar">
    <div class="rag-toolbar-left">
        <span class="rag-toolbar-info">Showing {filteredCount} rulebooks</span>
    </div>
    <div class="rag-toolbar-right action-rail" data-testid="rulebook-library-toolbar-actions">
        <div class="rag-view-toggle seg-tabs" data-testid="rulebook-library-view-toggle">
            <IconButton
                onclick={() => (viewMode = "grid")}
                className={`rag-view-toggle-btn seg-tab ${viewMode === "grid" ? "active" : ""}`}
                title="Grid view"
                ariaLabel="Grid view"
                ariaPressed={viewMode === 'grid'}
            >
                <LayoutGridIcon size={18} />
            </IconButton>
            <IconButton
                onclick={() => (viewMode = "list")}
                className={`rag-view-toggle-btn seg-tab ${viewMode === "list" ? "active" : ""}`}
                title="List view"
                ariaLabel="List view"
                ariaPressed={viewMode === 'list'}
            >
                <ListIcon size={18} />
            </IconButton>
        </div>
        <Button onclick={onSelectFiles} styled="primary">
            <UploadIcon size={18} />
            <span>Add Documents</span>
        </Button>
    </div>
</div>
