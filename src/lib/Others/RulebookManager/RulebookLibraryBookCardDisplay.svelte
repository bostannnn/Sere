<script lang="ts">
    import { BookIcon, MoreVerticalIcon, PencilIcon, StarIcon, Trash2Icon } from "@lucide/svelte";
    import IconButton from "../../UI/GUI/IconButton.svelte";

    type LibraryRulebook = {
        id: string;
        name: string;
        chunkCount?: number;
        thumbnail?: string;
        metadata?: import("../../../ts/process/rag/types").RagIndexMetadata;
        priority?: number;
    };

    interface Props {
        book: LibraryRulebook;
        viewMode: "grid" | "list";
        openBookMenuId: string | null;
        onTogglePriority?: (book: LibraryRulebook) => void;
        onToggleBookMenu?: (id: string) => void;
        onEdit?: (book: LibraryRulebook) => void;
        onDelete?: (id: string) => void;
        onPointerMove?: (event: PointerEvent) => void;
        onPointerLeave?: (event: PointerEvent) => void;
    }

    let {
        book,
        viewMode,
        openBookMenuId,
        onTogglePriority = () => {},
        onToggleBookMenu = () => {},
        onEdit = () => {},
        onDelete = () => {},
        onPointerMove = () => {},
        onPointerLeave = () => {},
    }: Props = $props();
</script>

<div
    class="rag-book-card-main"
    role="group"
    aria-label={`Rulebook ${book.name}`}
    onpointermove={onPointerMove}
    onpointerleave={onPointerLeave}
    onpointercancel={onPointerLeave}
>
    <div class="rag-book-icon">
        {#if book.thumbnail}
            <img src={book.thumbnail} alt="Cover" class="rag-book-thumb" draggable="false" />
        {:else}
            <BookIcon size={32} />
        {/if}
    </div>
    {#if viewMode === "grid"}
        <div class="rag-book-pin-wrap action-rail" data-rag-book-menu>
            <IconButton
                onclick={() => onTogglePriority(book)}
                className={`rag-book-pin-btn ${book.priority ? "is-priority" : ""}`}
                title={book.priority ? "Remove priority" : "Mark as priority"}
                ariaLabel={book.priority ? `Remove priority from ${book.name}` : `Mark ${book.name} as priority`}
                ariaPressed={Boolean(book.priority)}
            >
                <StarIcon size={16} fill={book.priority ? "currentColor" : "none"} />
            </IconButton>
        </div>
    {/if}
    <div class="rag-book-details">
        <div class="rag-book-head-row">
            <span class="rag-book-name" title={book.name}>{book.name}</span>
            <div class="rag-book-actions action-rail" data-testid="rulebook-library-book-actions" data-rag-book-menu>
                {#if viewMode !== "grid"}
                    <IconButton
                        onclick={() => onTogglePriority(book)}
                        className={`rag-book-action-btn ${book.priority ? "is-priority" : ""}`}
                        title={book.priority ? "Remove priority" : "Mark as priority"}
                        ariaLabel={book.priority ? `Remove priority from ${book.name}` : `Mark ${book.name} as priority`}
                        ariaPressed={Boolean(book.priority)}
                    >
                        <StarIcon size={16} fill={book.priority ? "currentColor" : "none"} />
                    </IconButton>
                {/if}
                <button
                    type="button"
                    class="rag-book-menu-trigger icon-btn icon-btn--sm icon-btn--bordered"
                    title="Rulebook actions"
                    aria-label={`Actions for ${book.name}`}
                    aria-haspopup="menu"
                    aria-expanded={openBookMenuId === book.id}
                    onclick={() => onToggleBookMenu(book.id)}
                >
                    <MoreVerticalIcon size={14} />
                </button>
                {#if openBookMenuId === book.id}
                    <div class="rag-book-menu ds-ui-menu" role="menu">
                        <button
                            type="button"
                            class="rag-book-menu-item ds-ui-menu-item"
                            role="menuitem"
                            title="Edit rulebook"
                            aria-label={`Edit ${book.name}`}
                            onclick={() => onEdit(book)}
                        >
                            <PencilIcon size={14} />
                            <span>Edit</span>
                        </button>
                        <button
                            type="button"
                            class="rag-book-menu-item ds-ui-menu-item ds-ui-menu-item--danger"
                            role="menuitem"
                            title="Delete rulebook"
                            aria-label={`Delete ${book.name}`}
                            onclick={() => onDelete(book.id)}
                        >
                            <Trash2Icon size={14} />
                            <span>Delete</span>
                        </button>
                    </div>
                {/if}
            </div>
        </div>
        <div class="rag-book-badges">
            {#if book.metadata?.system}
                <span class="rag-badge control-chip system">{book.metadata.system}</span>
            {/if}
            {#if book.metadata?.edition}
                <span class="rag-badge control-chip edition">{book.metadata.edition}</span>
            {/if}
            <span class="rag-badge control-chip chunks">{book.chunkCount ?? 0} chunks</span>
        </div>
    </div>
</div>
