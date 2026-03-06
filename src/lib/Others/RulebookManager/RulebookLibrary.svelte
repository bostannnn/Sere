<script lang="ts">
    import { DBState, openRulebookManager, ragProgressStore } from 'src/ts/stores.svelte';
    import { rulebookRag } from "../../../ts/process/rag/rag";
    import { rulebookStorage } from "../../../ts/process/rag/storage";
    import { selectMultipleFile } from "src/ts/util";
    import { alertStore } from "src/ts/alert";
    import { fade } from "svelte/transition";
    import { SvelteMap, SvelteSet } from "svelte/reactivity";
    import TextInput from "../../UI/GUI/TextInput.svelte";
    import Button from '../../UI/GUI/Button.svelte';
    import { createCardTiltController } from "../../UI/cardTilt";
    import RulebookLibraryLegacyHeader from "./RulebookLibraryLegacyHeader.svelte";
    import RulebookLibraryToolbar from "./RulebookLibraryToolbar.svelte";
    import RulebookLibraryLegacySidebar from "./RulebookLibraryLegacySidebar.svelte";
    import RulebookLibraryBookCardDisplay from "./RulebookLibraryBookCardDisplay.svelte";
    import RulebookLibraryRightDrawer from "./RulebookLibraryRightDrawer.svelte";
    import RulebookLibraryEmptyState from "./RulebookLibraryEmptyState.svelte";
    import RulebookLibraryStagingDrawer from "./RulebookLibraryStagingDrawer.svelte";
    import RulebookLibraryProgressToast from "./RulebookLibraryProgressToast.svelte";
    import "./RulebookLibrary.css";
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

    interface Props {
        shellSearchQuery?: string;
        onClose?: () => void;
        useShellChrome?: boolean;
        isMobileShell?: boolean;
        rightSidebarOpen?: boolean;
        rightSidebarTab?: "library" | "settings";
        viewMode?: "grid" | "list";
        onRightSidebarTabChange?: (tab: "library" | "settings") => void;
        registerShellActions?: (actions: LibraryShellActions | null) => void;
    }

    let {
        shellSearchQuery = $bindable(""),
        onClose = () => openRulebookManager.set(false),
        useShellChrome = false,
        isMobileShell = false,
        rightSidebarOpen = $bindable(true),
        rightSidebarTab = $bindable("library"),
        viewMode = $bindable("grid"),
        onRightSidebarTabChange = () => {},
        registerShellActions = () => {},
    }: Props = $props();

    let pendingFiles = $state<PendingFile[]>([]);
    let hasLoadedLibrary = $state(false);
    let loadErrorMessage = $state("");
    let selectedSystemFilter = $state('All');
    let selectedEditionFilter = $state('All');
    let expandedSystems = $state<Set<string>>(new Set());
    
    // Server-authoritative list
    let rulebooks = $state<LibraryRulebook[]>([]);

    async function refreshLibrary() {
        loadErrorMessage = "";
        try {
            const res = await rulebookStorage.listRulebooks();
            rulebookLibraryLog("[RAG] Library Refresh Result:", res);
            rulebooks = res;
        } catch (e) {
            rulebookLibraryLog("Failed to fetch rulebooks:", e);
            const message = e instanceof Error ? e.message : String(e);
            loadErrorMessage = message;
            alertStore.set({ type: 'error', msg: `Failed to fetch rulebooks: ${message}` });
        } finally {
            hasLoadedLibrary = true;
        }
    }

    import { onMount } from 'svelte';

    let reducedMotion = $state(
        typeof window !== "undefined"
            ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
            : false
    );
    let coarsePointer = $state(
        typeof window !== "undefined"
            ? window.matchMedia("(hover: none), (pointer: coarse)").matches
            : false
    );

    onMount(() => {
        void refreshLibrary();
        if (typeof window === "undefined") {
            return () => {
                registerShellActions(null);
            };
        }
        document.addEventListener("pointerdown", handleDocumentPointerDown);
        document.addEventListener("keydown", handleDocumentKeydown);
        const motionMq = window.matchMedia("(prefers-reduced-motion: reduce)");
        const coarsePointerMq = window.matchMedia("(hover: none), (pointer: coarse)");
        const handleMotionChange = (event: MediaQueryListEvent) => {
            reducedMotion = event.matches;
        };
        const handlePointerModeChange = (event: MediaQueryListEvent) => {
            coarsePointer = event.matches;
        };
        motionMq.addEventListener("change", handleMotionChange);
        coarsePointerMq.addEventListener("change", handlePointerModeChange);
        return () => {
            registerShellActions(null);
            document.removeEventListener("pointerdown", handleDocumentPointerDown);
            document.removeEventListener("keydown", handleDocumentKeydown);
            motionMq.removeEventListener("change", handleMotionChange);
            coarsePointerMq.removeEventListener("change", handlePointerModeChange);
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
        if (system === "All") {
            clearFilters();
            return;
        }
        selectedSystemFilter = system;
        selectedEditionFilter = "All";
        expandedSystems.add(system);
        expandedSystems = new SvelteSet(expandedSystems);
    }

    function selectEdition(system: string, edition: string) {
        if (edition === "All") {
            selectedSystemFilter = system === "All" ? "All" : system;
            selectedEditionFilter = "All";
            return;
        }
        selectedSystemFilter = system;
        selectedEditionFilter = edition;
        expandedSystems.add(system);
        expandedSystems = new SvelteSet(expandedSystems);
    }

    function clearFilters() {
        selectedSystemFilter = 'All';
        selectedEditionFilter = 'All';
    }

    function getEditionsBySystem() {
        const editionsBySystem: Record<string, string[]> = {};
        for (const [system, editions] of systemTree()) {
            editionsBySystem[system] = Array.from(editions).sort((a, b) => a.localeCompare(b));
        }
        return editionsBySystem;
    }

    function getFilterSnapshot(): LibraryFilterSnapshot {
        return {
            systems: systemTree().map(([system]) => system),
            editionsBySystem: getEditionsBySystem(),
            selectedSystem: selectedSystemFilter,
            selectedEdition: selectedEditionFilter,
        };
    }

    $effect(() => {
        if (!useShellChrome) {
            registerShellActions(null);
            return;
        }

        // Re-register when filter state changes so shell topbar labels stay in sync.
        selectedSystemFilter;
        selectedEditionFilter;
        systemTree();

        registerShellActions({
            selectFiles,
            setSystemFilter: selectSystem,
            setEditionFilter: selectEdition,
            clearFilters,
            getFilterSnapshot,
        });
    });

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
        if (coarsePointer) {
            return;
        }
        cardTiltController.onPointerMove(event);
    }

    function handleRulebookCardPointerLeave(event: PointerEvent) {
        cardTiltController.onPointerLeave(event);
    }

</script>

<div
    class="rag-dashboard"
    class:rag-dashboard-shell={useShellChrome}
    class:rag-dashboard-shell-mobile={useShellChrome && isMobileShell}
>
    {#if !useShellChrome}
        <RulebookLibraryLegacyHeader bind:shellSearchQuery={shellSearchQuery} onClose={onClose} />
    {/if}

    <div class="rag-dashboard-body" class:rag-dashboard-body-shell={useShellChrome}>
        {#if !useShellChrome}
            <RulebookLibraryLegacySidebar
                systemTree={systemTree()}
                {expandedSystems}
                {selectedSystemFilter}
                {selectedEditionFilter}
                rulebookCount={rulebooks.length}
                onToggleSystem={toggleSystem}
                onSelectSystem={selectSystem}
                onSelectEdition={selectEdition}
                onClearFilters={clearFilters}
            />
        {/if}

        <main class="rag-main-content panel-shell" class:rag-main-content-shell={useShellChrome}>
            {#if !useShellChrome}
                <RulebookLibraryToolbar
                    filteredCount={filteredRulebooks.length}
                    bind:viewMode={viewMode}
                    onSelectFiles={selectFiles}
                />
            {/if}

            <div class="rag-content-area list-shell" class:rag-content-area-shell={useShellChrome} class:is-grid={viewMode === 'grid'} class:is-list={viewMode === 'list'}>
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
                            <RulebookLibraryBookCardDisplay
                                {book}
                                {viewMode}
                                {openBookMenuId}
                                onTogglePriority={togglePriority}
                                onToggleBookMenu={toggleBookMenu}
                                onEdit={(targetBook) => {
                                    closeBookMenu();
                                    startEdit(targetBook);
                                }}
                                onDelete={(targetId) => {
                                    closeBookMenu();
                                    void deleteRulebook(targetId);
                                }}
                                onPointerMove={updateRulebookCardTilt}
                                onPointerLeave={handleRulebookCardPointerLeave}
                            />
                        {/if}
                    </div>
                {/each}

                <RulebookLibraryEmptyState
                    {hasLoadedLibrary}
                    {loadErrorMessage}
                    rulebookCount={rulebooks.length}
                    filteredCount={filteredRulebooks.length}
                    {shellSearchQuery}
                    onRetry={() => void refreshLibrary()}
                    onSelectFiles={selectFiles}
                />
            </div>
        </main>
    </div>

    {#if useShellChrome && !isMobileShell}
        <RulebookLibraryRightDrawer
            rightSidebarOpen={rightSidebarOpen}
            bind:rightSidebarTab={rightSidebarTab}
            systemTree={systemTree()}
            {expandedSystems}
            {selectedSystemFilter}
            {selectedEditionFilter}
            rulebookCount={rulebooks.length}
            onToggleSystem={toggleSystem}
            onSelectSystem={selectSystem}
            onSelectEdition={selectEdition}
            onClearFilters={clearFilters}
            onSelectSidebarTab={onRightSidebarTabChange}
        />
    {/if}

    <RulebookLibraryStagingDrawer
        {pendingFiles}
        {globalMetadata}
        onApplyGlobalMetadata={applyGlobalMetadata}
        onStartIngestion={startIngestion}
        onClearPending={() => (pendingFiles = [])}
        onRemovePendingFile={removePendingFile}
    />

    <RulebookLibraryProgressToast progress={$ragProgressStore} onCancel={cancelIngestion} />
</div>
