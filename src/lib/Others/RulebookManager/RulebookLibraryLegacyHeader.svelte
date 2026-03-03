<script lang="ts">
    import { BookIcon, SearchIcon, XIcon } from "@lucide/svelte";
    import IconButton from "../../UI/GUI/IconButton.svelte";

    interface Props {
        shellSearchQuery?: string;
        onClose?: () => void;
    }

    let {
        shellSearchQuery = $bindable(""),
        onClose = () => {},
    }: Props = $props();
</script>

<header class="rag-dashboard-header">
    <div class="rag-header-left">
        <BookIcon size={24} />
        <h1>Rulebook Library</h1>
    </div>
    <div class="rag-header-center">
        <div class="rag-search-wrapper">
            <SearchIcon size={18} class="rag-search-icon" />
            <input class="control-field" type="text" bind:value={shellSearchQuery} placeholder="Search by name, system, or edition..." />
        </div>
    </div>
    <div class="rag-header-right">
        <IconButton
            onclick={onClose}
            title="Close rulebook library"
            ariaLabel="Close rulebook library"
            id="rulebook-library-close"
        >
            <XIcon size={24} />
        </IconButton>
    </div>
</header>
