<script lang="ts">
    import { DBState, openRulebookManager, ragProgressStore } from 'src/ts/stores.svelte';
    import { Trash2Icon, UploadIcon, BookIcon, XIcon, SearchIcon, PlayIcon, InfoIcon, LayoutGridIcon, ListIcon, ChevronRightIcon, PencilIcon, StarIcon, MoreVerticalIcon } from "@lucide/svelte";
    import { rulebookRag } from "../../../ts/process/rag/rag";
    import { rulebookStorage } from "../../../ts/process/rag/storage";
    import { selectMultipleFile } from "src/ts/util";
    import { alertStore } from "src/ts/alert";
    import { fade, slide } from "svelte/transition";
    import { SvelteMap, SvelteSet } from "svelte/reactivity";
    import NumberInput from "../../UI/GUI/NumberInput.svelte";
    import TextInput from "../../UI/GUI/TextInput.svelte";
    import EmbeddingModelSelect from '../../UI/GUI/EmbeddingModelSelect.svelte';
    import Button from '../../UI/GUI/Button.svelte';
    import IconButton from '../../UI/GUI/IconButton.svelte';
    import { createCardTiltController } from "../../UI/cardTilt";
    import type { HypaModel } from 'src/ts/process/memory/hypamemory';
    const rulebookLibraryLog = (..._args: unknown[]) => {};

    interface PendingFile {
        name: string;
        data: Uint8Array;
        system: string;
        edition: string;
    }
    type LibraryRulebook = {
        id: string;
        name: string;
        chunkCount?: number;
        thumbnail?: string;
        metadata?: import("../../../ts/process/rag/types").RagIndexMetadata;
        priority?: number;
    };

    interface Props {
        shellSearchQuery?: string;
        onClose?: () => void;
    }

    let { shellSearchQuery = $bindable(""), onClose = () => openRulebookManager.set(false) }: Props = $props();

    let pendingFiles = $state<PendingFile[]>([]);
    let viewMode = $state<'grid' | 'list'>('grid');
    let selectedSystemFilter = $state('All');
    let selectedEditionFilter = $state('All');
    let expandedSystems = $state<Set<string>>(new Set());
    
    // Server-authoritative list
    let rulebooks = $state<LibraryRulebook[]>([]);

    async function refreshLibrary() {
        try {
            const res = await rulebookStorage.listRulebooks();
            rulebookLibraryLog("[RAG] Library Refresh Result:", res);
            rulebooks = res;
        } catch (e) {
            rulebookLibraryLog("Failed to fetch rulebooks:", e);
            alertStore.set({ type: 'error', msg: `Failed to fetch rulebooks: ${e.message}` });
        }
    }

    import { onMount } from 'svelte';

    let reducedMotion = $state(
        typeof window !== "undefined"
            ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
            : false
    );

    onMount(() => {
        void refreshLibrary();
        if (typeof window === "undefined") {
            return;
        }
        document.addEventListener("pointerdown", handleDocumentPointerDown);
        document.addEventListener("keydown", handleDocumentKeydown);
        const motionMq = window.matchMedia("(prefers-reduced-motion: reduce)");
        const handleMotionChange = (event: MediaQueryListEvent) => {
            reducedMotion = event.matches;
        };
        motionMq.addEventListener("change", handleMotionChange);
        return () => {
            document.removeEventListener("pointerdown", handleDocumentPointerDown);
            document.removeEventListener("keydown", handleDocumentKeydown);
            motionMq.removeEventListener("change", handleMotionChange);
        };
    });

    const globalMetadata = $state({
        system: '',
        edition: ''
    });

    let editingBookId = $state<string | null>(null);
    let editingBookData = $state({
        name: '',
        system: '',
        edition: '',
    });
    let openBookMenuId = $state<string | null>(null);

    const systemTree = $derived(() => {
        const tree = new SvelteMap<string, Set<string>>();
        for (const book of rulebooks) {
            const system = book.metadata?.system || 'Unknown';
            const edition = book.metadata?.edition || 'Standard';
            if (!tree.has(system)) tree.set(system, new SvelteSet());
            tree.get(system)!.add(edition);
        }
        return Array.from(tree.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    });

    const filteredRulebooks = $derived(
        rulebooks.filter(b => {
            const normalizedQuery = shellSearchQuery.toLowerCase();
            const matchesSearch = b.name.toLowerCase().includes(normalizedQuery) ||
                                b.metadata?.system?.toLowerCase().includes(normalizedQuery) ||
                                b.metadata?.edition?.toLowerCase().includes(normalizedQuery);
            
            const matchesSystem = selectedSystemFilter === 'All' || b.metadata?.system === selectedSystemFilter;
            const matchesEdition = selectedEditionFilter === 'All' || b.metadata?.edition === selectedEditionFilter;
            
            return matchesSearch && matchesSystem && matchesEdition;
        })
    );

    function toggleSystem(system: string) {
        if (expandedSystems.has(system)) {
            expandedSystems.delete(system);
        } else {
            expandedSystems.add(system);
        }
        expandedSystems = new SvelteSet(expandedSystems);
    }

    function selectSystem(system: string) {
        selectedSystemFilter = system;
        selectedEditionFilter = 'All'; // Reset edition when system changes
    }

    function selectEdition(system: string, edition: string) {
        selectedSystemFilter = system;
        selectedEditionFilter = edition;
    }

    function clearFilters() {
        selectedSystemFilter = 'All';
        selectedEditionFilter = 'All';
    }

    async function selectFiles() {
        const files = await selectMultipleFile(['txt', 'md', 'pdf']);
        if (!files || files.length === 0) return;

        const newPending = files.map(f => ({
            name: f.name,
            data: f.data,
            system: globalMetadata.system,
            edition: globalMetadata.edition
        }));

        pendingFiles = [...pendingFiles, ...newPending];
    }

    function removePendingFile(index: number) {
        pendingFiles = pendingFiles.filter((_, i) => i !== index);
    }

    async function startIngestion() {
        if (pendingFiles.length === 0) return;
        
        const filesToIngest = [...pendingFiles];
        pendingFiles = []; 
        
        try {
            await rulebookRag.batchIngest(filesToIngest);
            await refreshLibrary(); // Sync with server after ingestion
        } catch (e) {
            rulebookLibraryLog("Batch ingestion failed:", e);
        }
    }

    function cancelIngestion() {
        rulebookRag.cancelIngestion();
    }

    async function deleteRulebook(id: string) {
        if (!confirm('Are you sure you want to delete this rulebook? It will be removed from all characters.')) return;
        
        await rulebookStorage.deleteRulebook(id);
        
        // Deep clean characters and groups (selection is still in client DB)
        for (const char of DBState.db.characters) {
            if (char.ragSettings?.enabledRulebooks) {
                char.ragSettings.enabledRulebooks = char.ragSettings.enabledRulebooks.filter(bid => bid !== id);
            }
        }
        
        // Force refresh character state
        DBState.db.characters = [...DBState.db.characters];
        
        await refreshLibrary(); // Sync with server filesystem
    }

    function startEdit(book: LibraryRulebook) {
        editingBookId = book.id;
        editingBookData = {
            name: book.name,
            system: book.metadata?.system || '',
            edition: book.metadata?.edition || '',
        };
    }

    async function saveEdit() {
        if (!editingBookId) return;
        try {
            await rulebookStorage.updateRulebookMetadata(editingBookId, editingBookData.name, {
                system: editingBookData.system,
                edition: editingBookData.edition,
            });
            await refreshLibrary();
            alertStore.set({ type: 'normal', msg: 'Rulebook updated!' });
        } catch (e) {
            rulebookLibraryLog(e);
            alertStore.set({ type: 'error', msg: 'Failed to update rulebook' });
        } finally {
            editingBookId = null;
        }
    }

    async function togglePriority(book: LibraryRulebook) {
        const newPriority = book.priority ? 0 : 1;
        
        // Optimistic UI update
        const index = rulebooks.findIndex(b => b.id === book.id);
        if (index !== -1) {
            rulebooks[index].priority = newPriority;
            rulebooks = [...rulebooks];
        }

        try {
            const updated = await rulebookStorage.updateRulebookMetadata(book.id, undefined, undefined, newPriority);
            if (updated) {
                // Use the updated data directly to avoid a race condition with refreshLibrary
                const idx = rulebooks.findIndex(b => b.id === book.id);
                if (idx !== -1) {
                    rulebooks[idx] = updated;
                    rulebooks = [...rulebooks];
                }
            }
        } catch (e) {
            rulebookLibraryLog(e);
            alertStore.set({ type: 'error', msg: `Failed to update priority` });
            await refreshLibrary(); // Revert on actual error
        }
    }

    function applyGlobalMetadata() {
        pendingFiles = pendingFiles.map(f => ({
            ...f,
            system: globalMetadata.system,
            edition: globalMetadata.edition
        }));
    }

    function toggleBookMenu(id: string) {
        openBookMenuId = openBookMenuId === id ? null : id;
    }

    function closeBookMenu() {
        openBookMenuId = null;
    }

    function handleDocumentPointerDown(event: PointerEvent) {
        const target = event.target as HTMLElement | null;
        if (target?.closest("[data-rag-book-menu]")) {
            return;
        }
        closeBookMenu();
    }

    function handleDocumentKeydown(event: KeyboardEvent) {
        if (event.key === "Escape") {
            closeBookMenu();
        }
    }

    const cardTiltController = createCardTiltController({
        hostSelector: "[data-rag-tilt-card]",
        tiltVarX: "--rag-card-tilt-x",
        tiltVarY: "--rag-card-tilt-y",
        glareVarX: "--rag-card-glare-x",
        glareVarY: "--rag-card-glare-y",
        glareOpacityVar: "--rag-card-glare-opacity",
        getReducedMotion: () => reducedMotion,
        maxTilt: 9,
        glareOpacityOnMove: "0.58",
    });

    function updateRulebookCardTilt(event: PointerEvent) {
        cardTiltController.onPointerMove(event);
    }

    function handleRulebookCardPointerLeave(event: PointerEvent) {
        cardTiltController.onPointerLeave(event);
    }

    function close() {
        onClose();
    }
</script>

<div class="rag-dashboard">
    <!-- Dashboard Header -->
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
            <IconButton onclick={close} title="Close rulebook library" ariaLabel="Close rulebook library" id="rulebook-library-close">
                <XIcon size={24} />
            </IconButton>
        </div>
    </header>

    <div class="rag-dashboard-body">
        <!-- Sidebar -->
        <aside class="rag-sidebar panel-shell panel-shell--raised">
            <section class="rag-sidebar-section">
                <h3 class="rag-sidebar-title">Library</h3>
                <div class="rag-system-list list-shell" data-testid="rulebook-library-system-list">
                    <button 
                        class="rag-system-item" 
                        class:is-active={selectedSystemFilter === 'All'}
                        onclick={clearFilters}
                    >
                        <LayoutGridIcon size={14} />
                        <span>All Documents</span>
                    </button>

                    <div class="rag-sidebar-separator"></div>
                    
                    {#each systemTree() as [system, editions] (system)}
                        <div class="rag-tree-node">
                            <div class="rag-system-row" class:is-active={selectedSystemFilter === system && selectedEditionFilter === 'All'}>
                                <button
                                    class="rag-tree-toggle icon-btn icon-btn--sm"
                                    onclick={() => toggleSystem(system)}
                                    title={expandedSystems.has(system) ? `Collapse ${system}` : `Expand ${system}`}
                                    aria-label={expandedSystems.has(system) ? `Collapse ${system} editions` : `Expand ${system} editions`}
                                    aria-expanded={expandedSystems.has(system)}
                                    type="button"
                                >
                                    <span class="rag-tree-icon-wrap" style:transform={expandedSystems.has(system) ? 'rotate(90deg)' : ''}>
                                        <ChevronRightIcon size={14} />
                                    </span>
                                </button>
                                <button class="rag-system-name" onclick={() => selectSystem(system)}>
                                    <span>{system}</span>
                                </button>
                            </div>

                            {#if expandedSystems.has(system)}
                                <div class="rag-edition-list" transition:slide={{ duration: 150 }}>
                                    {#each Array.from(editions).sort() as edition (edition)}
                                        <button 
                                            class="rag-edition-item" 
                                            class:is-active={selectedSystemFilter === system && selectedEditionFilter === edition}
                                            onclick={() => selectEdition(system, edition)}
                                        >
                                            <span>{edition}</span>
                                        </button>
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    {/each}
                </div>
            </section>

            <div class="ds-settings-divider"></div>

            <section class="rag-sidebar-section">
                <h3 class="rag-sidebar-title">RAG Defaults</h3>
                <div class="rag-sidebar-config">
                    <div class="rag-setting-field">
                        <span class="rag-label">Embedding Model</span>
                        <EmbeddingModelSelect bind:value={DBState.db.globalRagSettings.model as HypaModel} />
                    </div>
                    <div class="rag-setting-field">
                        <span class="rag-label">Top K Chunks</span>
                        <NumberInput size="sm" min={1} max={10} bind:value={DBState.db.globalRagSettings.topK as number} />
                    </div>
                    <div class="rag-setting-field">
                        <span class="rag-label">Min Similarity</span>
                        <NumberInput size="sm" min={0} max={1} bind:value={DBState.db.globalRagSettings.minScore as number} />
                    </div>
                    <div class="rag-setting-field">
                        <span class="rag-label">Token Budget</span>
                        <NumberInput size="sm" min={0} max={4096} bind:value={DBState.db.globalRagSettings.budget as number} />
                    </div>
                </div>
            </section>

            <div class="rag-sidebar-footer">
                <div class="rag-stats">
                    <span>{rulebooks.length} Books</span>
                </div>
            </div>
        </aside>

        <!-- Main Content -->
        <main class="rag-main-content panel-shell">
            <div class="rag-toolbar">
                <div class="rag-toolbar-left">
                    <span class="rag-toolbar-info">Showing {filteredRulebooks.length} rulebooks</span>
                </div>
                <div class="rag-toolbar-right action-rail" data-testid="rulebook-library-toolbar-actions">
                    <div class="rag-view-toggle seg-tabs" data-testid="rulebook-library-view-toggle">
                        <IconButton
                            onclick={() => viewMode = 'grid'}
                            className={`rag-view-toggle-btn seg-tab ${viewMode === 'grid' ? 'active' : ''}`}
                            title="Grid view"
                            ariaLabel="Grid view"
                            ariaPressed={viewMode === 'grid'}
                        >
                            <LayoutGridIcon size={18} />
                        </IconButton>
                        <IconButton
                            onclick={() => viewMode = 'list'}
                            className={`rag-view-toggle-btn seg-tab ${viewMode === 'list' ? 'active' : ''}`}
                            title="List view"
                            ariaLabel="List view"
                            ariaPressed={viewMode === 'list'}
                        >
                            <ListIcon size={18} />
                        </IconButton>
                    </div>
                    <Button onclick={selectFiles} styled="primary">
                        <UploadIcon size={18} />
                        <span>Add Documents</span>
                    </Button>
                </div>
            </div>

            <div class="rag-content-area list-shell" class:is-grid={viewMode === 'grid'} class:is-list={viewMode === 'list'}>
                {#each filteredRulebooks as book (book.id)}
                    <div
                        class="ds-settings-card panel-shell rag-book-card"
                        class:is-editing={editingBookId === book.id}
                        transition:fade={{duration: 150}}
                        data-rag-tilt-card
                    >
                        {#if editingBookId === book.id}
                            <div class="rag-book-edit-form">
                                <div class="rag-edit-field">
                                    <span class="rag-label">Name</span>
                                    <TextInput bind:value={editingBookData.name} size="sm" />
                                </div>
                                <div class="rag-edit-meta-grid">
                                    <div class="rag-edit-field">
                                        <span class="rag-label">System</span>
                                        <TextInput bind:value={editingBookData.system} size="sm" />
                                    </div>
                                    <div class="rag-edit-field">
                                        <span class="rag-label">Edition</span>
                                        <TextInput bind:value={editingBookData.edition} size="sm" />
                                    </div>
                                </div>
                                <div class="rag-edit-actions action-rail">
                                    <Button size="sm" onclick={saveEdit}>Save</Button>
                                    <Button size="sm" styled="outlined" onclick={() => editingBookId = null}>Cancel</Button>
                                </div>
                            </div>
                        {:else}
                            <div
                                class="rag-book-card-main"
                                role="group"
                                aria-label={`Rulebook ${book.name}`}
                                onpointermove={updateRulebookCardTilt}
                                onpointerleave={handleRulebookCardPointerLeave}
                                onpointercancel={handleRulebookCardPointerLeave}
                            >
                                <div class="rag-book-icon">
                                    {#if book.thumbnail}
                                        <img src={book.thumbnail} alt="Cover" class="rag-book-thumb" />
                                    {:else}
                                        <BookIcon size={32} />
                                    {/if}
                                </div>
                                {#if viewMode === 'grid'}
                                    <div class="rag-book-pin-wrap action-rail" data-rag-book-menu>
                                        <IconButton
                                            onclick={() => togglePriority(book)}
                                            className={`rag-book-pin-btn ${book.priority ? 'is-priority' : ''}`}
                                            title={book.priority ? "Remove priority" : "Mark as priority"}
                                            ariaLabel={book.priority ? `Remove priority from ${book.name}` : `Mark ${book.name} as priority`}
                                            ariaPressed={Boolean(book.priority)}
                                        >
                                            <StarIcon size={16} fill={book.priority ? 'currentColor' : 'none'} />
                                        </IconButton>
                                    </div>
                                {/if}
                                <div class="rag-book-details">
                                    <div class="rag-book-head-row">
                                        <span class="rag-book-name" title={book.name}>{book.name}</span>
                                        <div class="rag-book-actions action-rail" data-testid="rulebook-library-book-actions" data-rag-book-menu>
                                            {#if viewMode !== 'grid'}
                                                <IconButton
                                                    onclick={() => togglePriority(book)}
                                                    className={`rag-book-action-btn ${book.priority ? 'is-priority' : ''}`}
                                                    title={book.priority ? "Remove priority" : "Mark as priority"}
                                                    ariaLabel={book.priority ? `Remove priority from ${book.name}` : `Mark ${book.name} as priority`}
                                                    ariaPressed={Boolean(book.priority)}
                                                >
                                                    <StarIcon size={16} fill={book.priority ? 'currentColor' : 'none'} />
                                                </IconButton>
                                            {/if}
                                            <button
                                                type="button"
                                                class="rag-book-menu-trigger icon-btn icon-btn--sm icon-btn--bordered"
                                                title="Rulebook actions"
                                                aria-label={`Actions for ${book.name}`}
                                                aria-haspopup="menu"
                                                aria-expanded={openBookMenuId === book.id}
                                                onclick={() => toggleBookMenu(book.id)}
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
                                                        onclick={() => {
                                                            closeBookMenu();
                                                            startEdit(book);
                                                        }}
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
                                                        onclick={() => {
                                                            closeBookMenu();
                                                            void deleteRulebook(book.id);
                                                        }}
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
                        {/if}
                    </div>
                {/each}

                {#if filteredRulebooks.length === 0}
                    <div class="rag-empty-state panel-shell empty-state" data-testid="rulebook-library-empty-state">
                        <BookIcon size={64} />
                        <p>{shellSearchQuery ? 'No rulebooks match your search.' : 'Your library is empty.'}</p>
                        {#if !shellSearchQuery}
                            <Button onclick={selectFiles}>Upload your first PDF</Button>
                        {/if}
                    </div>
                {/if}
            </div>
        </main>
    </div>

    <!-- Staging Area Drawer -->
    {#if pendingFiles.length > 0}
        <div class="rag-staging-drawer panel-shell panel-shell--overlay" transition:slide={{ axis: 'y' }}>
            <div class="rag-staging-header">
                <div class="rag-staging-title">
                    <InfoIcon size={20} />
                    <span>Staging Area: {pendingFiles.length} files pending</span>
                </div>
                <div class="rag-staging-batch-meta">
                    <TextInput bind:value={globalMetadata.system} placeholder="Batch System" size="sm" oninput={applyGlobalMetadata} />
                    <TextInput bind:value={globalMetadata.edition} placeholder="Batch Edition" size="sm" oninput={applyGlobalMetadata} />
                </div>
                <div class="rag-staging-actions action-rail">
                    <Button onclick={startIngestion} styled="primary">
                        <PlayIcon size={18} />
                        <span>Start Ingestion</span>
                    </Button>
                    <IconButton onclick={() => pendingFiles = []} title="Clear staged files" ariaLabel="Clear staged files">
                        <XIcon size={20} />
                    </IconButton>
                </div>
            </div>
            <div class="rag-staging-list list-shell">
                {#each pendingFiles as file, i (i)}
                    <div class="rag-staging-item panel-shell">
                        <span class="rag-staging-filename">{file.name}</span>
                        <div class="rag-staging-item-meta">
                            <TextInput bind:value={file.system} placeholder="System" size="sm" className="rag-staging-input" />
                            <TextInput bind:value={file.edition} placeholder="Edition" size="sm" className="rag-staging-input" />
                        </div>
                        <IconButton
                            onclick={() => removePendingFile(i)}
                            className="rag-staging-remove-btn"
                            title="Remove from staging"
                            ariaLabel={`Remove ${file.name} from staging`}
                        >
                            <Trash2Icon size={14} />
                        </IconButton>
                    </div>
                {/each}
            </div>
        </div>
    {/if}

    <!-- Background Progress Status Toast -->
    {#if $ragProgressStore.active}
        <div class="rag-status-toast" transition:slide={{ axis: 'y', duration: 300 }}>
            <div class="rag-status-card panel-shell">
                <div class="rag-status-header">
                    <div class="rag-status-title-row">
                        <div class="ds-chat-spinner-sm"></div>
                        <span class="rag-status-label">{$ragProgressStore.status.toUpperCase()}</span>
                    </div>
                    {#if ($ragProgressStore.totalFiles ?? 0) > 1}
                        <span class="rag-status-counter">File {$ragProgressStore.currentFileIndex} of {$ragProgressStore.totalFiles}</span>
                    {/if}
                </div>
                
                <div class="rag-status-body">
                    <span class="rag-status-filename" title={$ragProgressStore.file}>{$ragProgressStore.file || 'Processing...'}</span>
                    
                    {#if $ragProgressStore.status === 'downloading' || $ragProgressStore.status === 'embedding'}
                        {@const rawVal = $ragProgressStore.status === 'downloading'
                            ? ($ragProgressStore.percent ?? 0)
                            : (($ragProgressStore.current ?? 0) / Math.max(1, $ragProgressStore.total ?? 1) * 100)}
                        {@const val = isNaN(rawVal) ? 0 : Math.max(0, Math.min(100, rawVal))}
                        <div class="rag-mini-bar-track">
                            <div class="rag-mini-bar-fill" style:width="{val}%"></div>
                        </div>
                        <div class="rag-status-meta">
                            <span>{Math.round(val)}%</span>
                            {#if $ragProgressStore.status === 'embedding'}
                                <span>{$ragProgressStore.current}/{$ragProgressStore.total}</span>
                            {/if}
                        </div>
                    {/if}
                </div>

                <button class="rag-status-cancel icon-btn icon-btn--sm" onclick={cancelIngestion} title="Cancel Ingestion">
                    <XIcon size={14} />
                </button>
            </div>
        </div>
    {/if}
</div>

<style>
    .rag-dashboard {
        position: fixed;
        inset: 0;
        z-index: 100;
        background: var(--ds-surface-1);
        display: flex;
        flex-direction: column;
        color: var(--ds-text-primary);
    }

    .rag-dashboard-header {
        height: 64px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 var(--ds-space-6);
        background: var(--ds-surface-2);
        border-bottom: 1px solid var(--ds-border-subtle);
        flex-shrink: 0;
    }

    .rag-header-left {
        display: flex;
        align-items: center;
        gap: var(--ds-space-3);
        min-width: 200px;
    }

    .rag-header-left h1 {
        font-size: var(--ds-font-size-lg);
        font-weight: var(--ds-font-weight-bold);
        margin: 0;
    }

    .rag-header-center {
        flex: 1;
        max-width: 600px;
        margin: 0 var(--ds-space-6);
    }

    .rag-search-wrapper {
        position: relative;
        width: 100%;
        display: flex;
        align-items: center;
    }

    :global(.rag-search-icon) {
        position: absolute;
        left: var(--ds-space-3);
        color: var(--ds-text-secondary);
        pointer-events: none;
    }

    .rag-search-wrapper .control-field {
        width: 100%;
        height: 36px;
        background: var(--ds-surface-1);
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-md);
        padding: 0 var(--ds-space-4) 0 40px;
        color: var(--ds-text-primary);
        font-size: var(--ds-font-size-sm);
        transition: all var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .rag-search-wrapper .control-field:focus {
        border-color: var(--ds-border-strong);
        outline: none;
    }

    .rag-header-right {
        min-width: 200px;
        display: flex;
        justify-content: flex-end;
    }

    .rag-dashboard-body {
        flex: 1;
        display: flex;
        overflow: hidden;
    }

    .rag-sidebar {
        width: 220px;
        background: var(--ds-surface-2);
        border-right: 1px solid var(--ds-border-subtle);
        display: flex;
        flex-direction: column;
        padding: var(--ds-space-4);
        gap: var(--ds-space-6);
        flex-shrink: 0;
    }

    .rag-sidebar-section {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
    }

    .rag-sidebar-title {
        font-size: 10px;
        font-weight: var(--ds-font-weight-bold);
        text-transform: uppercase;
        color: var(--ds-text-secondary);
        letter-spacing: 1px;
        margin-bottom: var(--ds-space-1);
    }

    .rag-system-list {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .rag-system-list.list-shell {
        padding: 0;
        border: none;
        background: transparent;
        box-shadow: none;
    }

    .rag-system-item {
        display: flex;
        align-items: center;
        gap: var(--ds-space-2);
        padding: var(--ds-space-2) var(--ds-space-3);
        border-radius: var(--ds-radius-sm);
        background: transparent;
        border: none;
        color: var(--ds-text-secondary);
        cursor: pointer;
        text-align: left;
        font-size: var(--ds-font-size-sm);
        transition: all var(--ds-motion-fast) var(--ds-ease-standard);
        width: 100%;
    }

    .rag-system-item:hover {
        background: var(--ds-surface-active);
        color: var(--ds-text-primary);
    }

    .rag-system-item.is-active {
        background: var(--ds-surface-active);
        color: var(--ds-text-primary);
        font-weight: var(--ds-font-weight-medium);
    }

    .rag-system-item:focus-visible,
    .rag-tree-toggle:focus-visible,
    .rag-system-name:focus-visible,
    .rag-edition-item:focus-visible {
        outline: 2px solid var(--accent-strong);
        outline-offset: 1px;
    }

    .rag-sidebar-separator {
        height: 1px;
        background: var(--ds-border-subtle);
        margin: var(--ds-space-1) 0;
    }

    .rag-tree-node {
        display: flex;
        flex-direction: column;
    }

    .rag-system-row {
        display: flex;
        align-items: center;
        border-radius: var(--ds-radius-sm);
        transition: all var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .rag-system-row:hover {
        background: var(--ds-surface-active);
    }

    .rag-system-row.is-active {
        background: var(--ds-surface-active);
        color: var(--ds-text-primary);
        font-weight: var(--ds-font-weight-medium);
    }

    .rag-tree-toggle {
        padding: var(--ds-space-2) 0 var(--ds-space-2) var(--ds-space-2);
        background: transparent;
        border: none;
        color: var(--ds-text-secondary);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .rag-tree-toggle.icon-btn.icon-btn--sm {
        width: 1.5rem;
        height: 1.5rem;
        min-width: 1.5rem;
        min-height: 1.5rem;
        padding: 0;
        border: none;
        border-color: transparent;
        background: transparent;
        box-shadow: none;
    }

    .rag-tree-icon-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .rag-system-name {
        flex: 1;
        padding: var(--ds-space-2) var(--ds-space-3) var(--ds-space-2) var(--ds-space-1);
        background: transparent;
        border: none;
        color: var(--ds-text-secondary);
        cursor: pointer;
        text-align: left;
        font-size: var(--ds-font-size-sm);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .rag-system-row:hover .rag-system-name,
    .rag-system-row.is-active .rag-system-name {
        color: var(--ds-text-primary);
    }

    .rag-edition-list {
        display: flex;
        flex-direction: column;
        padding-left: 24px;
        margin-top: 2px;
        gap: 2px;
        border-left: 1px solid var(--ds-border-subtle);
        margin-left: 12px;
    }

    .rag-edition-item {
        padding: var(--ds-space-1) var(--ds-space-3);
        background: transparent;
        border: none;
        color: var(--ds-text-secondary);
        cursor: pointer;
        text-align: left;
        font-size: 11px;
        border-radius: var(--ds-radius-sm);
        transition: all var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .rag-edition-item:hover {
        background: var(--ds-surface-3);
        color: var(--ds-text-primary);
    }

    .rag-edition-item.is-active {
        color: var(--ds-text-primary);
        background: var(--ds-surface-3);
        font-weight: var(--ds-font-weight-bold);
    }

    .rag-sidebar-config {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
    }

    .rag-setting-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .rag-label {
        font-size: 11px;
        font-weight: var(--ds-font-weight-medium);
        color: var(--ds-text-secondary);
    }

    .rag-main-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        background: var(--ds-surface-1);
    }

    .rag-toolbar {
        height: 56px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 var(--ds-space-6);
        border-bottom: 1px solid var(--ds-border-subtle);
        background: var(--ds-surface-1);
        flex-shrink: 0;
    }

    .rag-main-content.panel-shell {
        padding: 0;
        border: none;
        border-radius: 0;
        box-shadow: none;
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
    }

    .rag-toolbar-info {
        font-size: var(--ds-font-size-sm);
        color: var(--ds-text-secondary);
    }

    .rag-toolbar-right {
        display: flex;
        align-items: center;
        gap: var(--ds-space-4);
    }

    .rag-toolbar-right.action-rail {
        justify-content: flex-end;
        margin-left: auto;
    }

    .rag-view-toggle.seg-tabs {
        display: flex;
        gap: var(--ds-space-1);
        background: var(--ds-surface-2);
        border-radius: var(--ds-radius-md);
        padding: 2px;
        border: 1px solid var(--ds-border-subtle);
    }

    :global(.rag-view-toggle-btn.seg-tab) {
        min-width: 32px;
        padding-inline: var(--ds-space-2);
    }

    :global(.rag-view-toggle .active) {
        background: var(--ds-surface-active) !important;
        color: var(--ds-text-primary) !important;
    }

    .rag-content-area {
        flex: 1;
        overflow-y: auto;
        padding: var(--ds-space-6);
    }

    .rag-content-area.list-shell {
        border: none;
        background: transparent;
        box-shadow: none;
        border-radius: 0;
    }

    .rag-content-area.is-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(13.5rem, 1fr));
        gap: var(--ds-space-3);
        align-content: start;
    }

    .rag-content-area.is-list {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
        max-width: 900px;
        margin: 0 auto;
        width: 100%;
    }

    .rag-book-card {
        display: block;
        padding: var(--ds-space-3) var(--ds-space-4);
        transition: border-color var(--ds-motion-fast) var(--ds-ease-standard);
        min-height: 80px;
    }

    .rag-book-card.is-editing {
        border-color: var(--ds-border-strong);
        background: var(--ds-surface-2);
    }

    .rag-book-edit-form {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-3);
        width: 100%;
    }

    .rag-edit-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .rag-edit-meta-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--ds-space-3);
    }

    .rag-edit-actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--ds-space-2);
    }

    .rag-edit-actions.action-rail {
        margin-left: auto;
    }

    .rag-book-card-main {
        display: flex;
        align-items: center;
        gap: var(--ds-space-4);
        width: 100%;
        min-width: 0;
    }

    .rag-book-icon {
        width: 48px;
        height: 64px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--ds-surface-3);
        border-radius: var(--ds-radius-sm);
        color: var(--ds-text-secondary);
        overflow: hidden;
        flex-shrink: 0;
        border: 1px solid var(--ds-border-subtle);
    }

    .rag-book-thumb {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .rag-book-details {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
        flex: 1;
    }

    .rag-book-head-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--ds-space-2);
        min-width: 0;
    }

    .rag-book-name {
        font-weight: var(--ds-font-weight-semibold);
        font-size: var(--ds-font-size-md);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
        flex: 1;
    }

    .rag-book-badges {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
    }

    .rag-badge {
        font-size: 10px;
        padding: 1px 6px;
        border-radius: var(--ds-radius-sm);
        border: 1px solid var(--ds-border-subtle);
        font-weight: var(--ds-font-weight-medium);
    }

    .rag-badge.system { background: var(--ds-surface-active); color: var(--ds-text-primary); }
    .rag-badge.edition { background: var(--ds-surface-3); color: var(--ds-text-secondary); }
    .rag-badge.chunks { color: var(--ds-text-secondary); border-style: dashed; }

    .rag-book-actions {
        display: inline-flex;
        align-items: center;
        gap: var(--ds-space-1);
        flex-shrink: 0;
        position: relative;
    }

    .rag-book-actions.action-rail {
        justify-content: flex-start;
    }

    .rag-book-menu-trigger {
        width: 1.7rem;
        height: 1.7rem;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }

    .rag-book-menu {
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        z-index: 5;
        min-width: 8.5rem;
    }

    .rag-book-menu-item {
        min-height: 1.875rem;
        font-size: var(--ds-font-size-xs);
        font-weight: var(--ds-font-weight-medium);
        gap: 0.5rem;
    }

    :global(.is-priority) {
        color: var(--ds-text-warning) !important;
        opacity: 1 !important;
        filter: drop-shadow(0 0 2px rgba(var(--ds-text-warning-rgb), 0.3));
    }

    .rag-book-actions.action-rail :global(.rag-book-action-btn:hover),
    .rag-book-actions.action-rail .rag-book-menu-trigger:hover {
        transform: scale(1.1);
        transition: transform var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .rag-content-area.is-grid .rag-book-card {
        text-align: left;
        padding: 0;
        min-height: 0;
        border-radius: 1.35rem;
        transform-style: preserve-3d;
        border: 1px solid color-mix(in srgb, var(--ds-border-subtle) 80%, rgb(255 255 255 / 16%));
        background:
            radial-gradient(160% 100% at 0% 100%, rgb(193 206 255 / 10%) 0%, transparent 55%),
            color-mix(in srgb, var(--surface-raised) 86%, rgb(12 15 28 / 34%));
        box-shadow: 0 16px 30px rgb(0 0 0 / 0.24), inset 0 1px 0 rgb(255 255 255 / 0.06);
        transform: perspective(68rem) rotateX(var(--rag-card-tilt-x, 0deg)) rotateY(var(--rag-card-tilt-y, 0deg)) translateY(0);
        will-change: transform;
        transition:
            transform var(--ds-motion-base) var(--ds-ease-emphasized),
            border-color var(--ds-motion-base) var(--ds-ease-emphasized),
            box-shadow var(--ds-motion-base) var(--ds-ease-emphasized);
    }

    .rag-content-area.is-grid .rag-book-card:hover {
        border-color: color-mix(in srgb, var(--ds-border-strong) 72%, rgb(255 255 255 / 20%));
        box-shadow: 0 20px 34px rgb(0 0 0 / 0.3), inset 0 1px 0 rgb(255 255 255 / 0.1);
        transform: perspective(68rem) rotateX(var(--rag-card-tilt-x, 0deg)) rotateY(var(--rag-card-tilt-y, 0deg)) translateY(-4px);
    }

    .rag-content-area.is-grid .rag-book-card.is-editing {
        padding: var(--ds-space-4);
    }

    .rag-content-area.is-grid .rag-book-card-main {
        position: relative;
        width: 100%;
        aspect-ratio: 3 / 4;
        display: flex;
        align-items: stretch;
        justify-content: stretch;
        text-align: left;
        background: transparent;
        color: inherit;
        padding: 0.6rem;
    }

    .rag-content-area.is-grid .rag-book-icon {
        position: absolute;
        inset: 0.6rem;
        width: auto;
        height: auto;
        border-radius: calc(1.35rem - 0.6rem);
        border: 1px solid color-mix(in srgb, var(--ds-border-subtle) 72%, rgb(255 255 255 / 10%));
        background: linear-gradient(160deg, rgb(20 24 36 / 96%) 0%, rgb(16 18 27 / 98%) 100%);
        overflow: hidden;
    }

    .rag-content-area.is-grid .rag-book-icon::after {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: radial-gradient(
            circle at var(--rag-card-glare-x, 50%) var(--rag-card-glare-y, 50%),
            rgb(255 255 255 / 0.28) 0%,
            rgb(255 255 255 / 0.09) 18%,
            transparent 46%
        );
        opacity: var(--rag-card-glare-opacity, 0);
        transition: opacity var(--ds-motion-base) var(--ds-ease-emphasized);
    }

    .rag-content-area.is-grid .rag-book-details {
        position: absolute;
        inset: 0.6rem;
        border-radius: calc(1.35rem - 0.6rem);
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        padding: 0.85rem 0.85rem 0.75rem;
        gap: 0.38rem;
        background: linear-gradient(180deg, rgb(4 7 15 / 0%) 31%, rgb(8 12 24 / 56%) 61%, rgb(8 10 18 / 84%) 100%);
        pointer-events: none;
    }

    .rag-content-area.is-grid .rag-book-pin-wrap {
        position: absolute;
        top: 1.05rem;
        right: 1.05rem;
        z-index: 4;
        pointer-events: auto;
    }

    .rag-content-area.is-grid .rag-book-pin-wrap :global(button) {
        width: 1.7rem;
        height: 1.7rem;
        min-width: 1.7rem;
        min-height: 1.7rem;
        border-radius: 999px;
        border: 1px solid rgb(243 248 255 / 24%);
        background: linear-gradient(180deg, rgb(255 255 255 / 18%) 0%, rgb(182 194 220 / 5%) 100%);
        color: rgb(236 242 255 / 88%);
        opacity: 0.82;
        backdrop-filter: blur(8px);
        transition:
            opacity var(--ds-motion-fast) var(--ds-ease-standard),
            transform var(--ds-motion-fast) var(--ds-ease-standard),
            border-color var(--ds-motion-fast) var(--ds-ease-standard),
            background-color var(--ds-motion-fast) var(--ds-ease-standard),
            color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .rag-content-area.is-grid .rag-book-card:hover .rag-book-pin-wrap :global(button),
    .rag-content-area.is-grid .rag-book-pin-wrap :global(button:focus-visible) {
        opacity: 1;
        transform: translateY(0);
    }

    .rag-content-area.is-grid .rag-book-name {
        margin: 0;
        font-size: clamp(1rem, 0.9rem + 0.25vw, 1.2rem);
        line-height: 1.25;
        color: rgb(244 248 255 / 96%);
        text-shadow: 0 1px 2px rgb(0 0 0 / 0.45);
    }

    .rag-content-area.is-grid .rag-book-badges {
        gap: 4px;
    }

    .rag-content-area.is-grid .rag-badge {
        font-size: 10px;
        padding: 1px 6px;
        border-radius: 999px;
        border-color: rgb(243 248 255 / 20%);
        background: rgb(20 25 40 / 56%);
        color: rgb(232 238 252 / 90%);
    }

    .rag-content-area.is-grid .rag-book-actions.action-rail {
        pointer-events: auto;
        gap: 6px;
    }

    .rag-content-area.is-grid .rag-book-actions.action-rail .rag-book-menu-trigger,
    .rag-content-area.is-grid .rag-book-actions.action-rail :global(.rag-book-action-btn) {
        width: 1.7rem;
        height: 1.7rem;
        min-width: 1.7rem;
        min-height: 1.7rem;
        border-radius: 999px;
        border: 1px solid rgb(243 248 255 / 24%);
        background: linear-gradient(180deg, rgb(255 255 255 / 18%) 0%, rgb(182 194 220 / 5%) 100%);
        color: rgb(236 242 255 / 88%);
        opacity: 0.76;
        backdrop-filter: blur(8px);
        transform: translateY(2px);
        transition:
            opacity var(--ds-motion-fast) var(--ds-ease-standard),
            transform var(--ds-motion-fast) var(--ds-ease-standard),
            border-color var(--ds-motion-fast) var(--ds-ease-standard),
            background-color var(--ds-motion-fast) var(--ds-ease-standard),
            color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .rag-content-area.is-grid .rag-book-card:hover .rag-book-actions.action-rail .rag-book-menu-trigger,
    .rag-content-area.is-grid .rag-book-actions.action-rail .rag-book-menu-trigger:focus-visible,
    .rag-content-area.is-grid .rag-book-card:hover .rag-book-actions.action-rail :global(.rag-book-action-btn),
    .rag-content-area.is-grid .rag-book-actions.action-rail :global(.rag-book-action-btn:focus-visible) {
        opacity: 1;
        transform: translateY(0);
    }

    .rag-content-area.is-grid .rag-book-actions.action-rail .rag-book-menu-trigger:hover,
    .rag-content-area.is-grid .rag-book-actions.action-rail :global(.rag-book-action-btn:hover) {
        border-color: rgb(243 248 255 / 34%);
        background: linear-gradient(180deg, rgb(255 255 255 / 24%) 0%, rgb(182 194 220 / 10%) 100%);
        color: rgb(246 249 255 / 96%);
        opacity: 1;
        transform: translateY(0) scale(1.06);
    }

    @media (prefers-reduced-motion: reduce) {
        .rag-content-area.is-grid .rag-book-card,
        .rag-content-area.is-grid .rag-book-icon::after,
        .rag-content-area.is-grid .rag-book-actions.action-rail :global(button) {
            transition: none;
        }

        .rag-content-area.is-grid .rag-book-card {
            will-change: auto;
            transform: none !important;
        }

        .rag-content-area.is-grid .rag-book-icon::after {
            display: none;
        }
    }

    .rag-empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 300px;
        color: var(--ds-text-secondary);
        gap: var(--ds-space-4);
        text-align: center;
    }

    .rag-empty-state.panel-shell {
        width: min(32rem, 100%);
        margin: 0 auto;
        border: 1px solid var(--ds-border-subtle);
        background: var(--surface-raised);
        border-radius: var(--ds-radius-lg);
        padding: var(--ds-space-6);
        box-shadow: var(--ds-shadow-sm);
    }

    /* Staging Drawer */
    .rag-staging-drawer {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: var(--ds-surface-2);
        border-top: 2px solid var(--ds-border-strong);
        max-height: 40%;
        display: flex;
        flex-direction: column;
        z-index: 110;
        box-shadow: var(--ds-shadow-xl);
    }

    .rag-staging-drawer.panel-shell {
        border-radius: 0;
        border-left: none;
        border-right: none;
        border-bottom: none;
    }

    .rag-staging-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--ds-space-3) var(--ds-space-6);
        background: var(--ds-surface-3);
        gap: var(--ds-space-6);
        flex-shrink: 0;
    }

    .rag-staging-title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: var(--ds-font-weight-bold);
        font-size: var(--ds-font-size-sm);
    }

    .rag-staging-batch-meta {
        display: flex;
        gap: var(--ds-space-3);
        flex: 1;
        max-width: 400px;
    }

    .rag-staging-actions {
        display: flex;
        align-items: center;
        gap: var(--ds-space-2);
    }

    .rag-staging-actions.action-rail {
        justify-content: flex-end;
    }

    .rag-staging-list {
        flex: 1;
        overflow-y: auto;
        padding: var(--ds-space-4);
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: var(--ds-space-2);
    }

    .rag-staging-list.list-shell {
        border: none;
        background: transparent;
        border-radius: 0;
        box-shadow: none;
    }

    .rag-staging-item {
        background: var(--ds-surface-1);
        padding: var(--ds-space-2) var(--ds-space-3);
        border-radius: var(--ds-radius-md);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--ds-space-3);
        border: 1px solid var(--ds-border-subtle);
    }

    .rag-staging-item.panel-shell {
        border-radius: var(--ds-radius-md);
    }

    .rag-staging-filename {
        font-size: var(--ds-font-size-xs);
        font-weight: var(--ds-font-weight-medium);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 1;
    }

    .rag-staging-item-meta {
        display: flex;
        gap: 4px;
    }

    :global(.rag-staging-input) {
        width: 70px !important;
    }

    /* Status Toast (Non-blocking) */
    .rag-status-toast {
        position: absolute;
        bottom: var(--ds-space-6);
        right: var(--ds-space-6);
        z-index: 200;
        width: 280px;
        pointer-events: auto;
    }

    .rag-status-card {
        background: var(--ds-surface-2);
        border: 1px solid var(--ds-border-strong);
        border-radius: var(--ds-radius-lg);
        padding: var(--ds-space-4);
        box-shadow: var(--ds-shadow-xl);
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-3);
        position: relative;
    }

    .rag-status-card.panel-shell {
        border-radius: var(--ds-radius-lg);
    }

    .rag-status-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .rag-status-title-row {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .rag-status-label {
        font-size: 10px;
        font-weight: var(--ds-font-weight-bold);
        color: var(--ds-text-success);
        letter-spacing: 0.5px;
    }

    .rag-status-counter {
        font-size: 10px;
        color: var(--ds-text-secondary);
        font-weight: var(--ds-font-weight-medium);
    }

    .rag-status-body {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
    }

    .rag-status-filename {
        font-size: var(--ds-font-size-xs);
        font-weight: var(--ds-font-weight-bold);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: var(--ds-text-primary);
    }

    .rag-mini-bar-track {
        height: 6px;
        background: var(--ds-surface-3);
        border-radius: var(--ds-radius-pill);
        overflow: hidden;
        border: 1px solid var(--ds-border-subtle);
    }

    .rag-mini-bar-fill {
        height: 100%;
        background: var(--ds-text-success);
        transition: width var(--ds-motion-slow) var(--ds-ease-standard);
    }

    .rag-status-meta {
        display: flex;
        justify-content: space-between;
        font-size: 10px;
        color: var(--ds-text-secondary);
    }

    .rag-status-cancel {
        position: absolute;
        top: 8px;
        right: 8px;
        background: transparent;
        border: none;
        color: var(--ds-text-secondary);
        cursor: pointer;
        padding: 4px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .rag-status-cancel.icon-btn.icon-btn--sm {
        width: 24px;
        height: 24px;
        min-height: 24px;
        min-width: 24px;
        padding: 0;
    }

    .rag-status-cancel:hover {
        background: var(--ds-surface-3);
        color: var(--ds-text-primary);
    }

    @media (max-width: 980px) {
        .rag-dashboard-header {
            height: auto;
            padding: var(--ds-space-3) var(--ds-space-4);
            flex-wrap: wrap;
            gap: var(--ds-space-3);
        }

        .rag-header-left,
        .rag-header-right {
            min-width: 0;
        }

        .rag-header-center {
            order: 3;
            flex: 1 0 100%;
            max-width: none;
            margin: 0;
        }

        .rag-dashboard-body {
            flex-direction: column;
        }

        .rag-sidebar {
            width: 100%;
            border-right: none;
            border-bottom: 1px solid var(--ds-border-subtle);
            max-height: 40vh;
            overflow-y: auto;
        }

        .rag-toolbar {
            height: auto;
            padding: var(--ds-space-3) var(--ds-space-4);
            gap: var(--ds-space-3);
            flex-wrap: wrap;
        }

        .rag-content-area {
            padding: var(--ds-space-4);
        }
    }

    @media (max-width: 720px) {
        .rag-toolbar-right {
            width: 100%;
            justify-content: space-between;
            gap: var(--ds-space-2);
        }

        .rag-content-area.is-grid {
            grid-template-columns: 1fr;
        }

        .rag-staging-header {
            padding: var(--ds-space-3) var(--ds-space-4);
            flex-wrap: wrap;
            gap: var(--ds-space-2);
        }

        .rag-staging-batch-meta {
            flex: 1 0 100%;
            max-width: none;
        }

        .rag-status-toast {
            left: var(--ds-space-3);
            right: var(--ds-space-3);
            bottom: var(--ds-space-3);
            width: auto;
        }
    }
</style>
