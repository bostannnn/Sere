<script lang="ts">
    import { MoreVerticalIcon, TrashIcon, Undo2Icon, UserIcon, UsersIcon } from "@lucide/svelte";
    import { onMount } from "svelte";
    import { language } from "src/lang";
    import { changeChar, getCharImage, removeChar } from "src/ts/characters";
    import { checkCharOrder } from "src/ts/globalApi.svelte";
    import { selectedCharID, DBState } from "src/ts/stores.svelte";
    import type { Chat } from "src/ts/storage/database.svelte";
    import { createCardTiltController } from "./cardTilt";

    interface Props {
        shellSearchQuery?: string;
        showTrash?: boolean;
    }

    let {
        shellSearchQuery = $bindable(""),
        showTrash = false,
    }: Props = $props();

    let openMenuKey = $state<string | null>(null);
    type CharacterRow = {
        key: string;
        chaId: string;
        index: number;
        name: string;
        isGroup: boolean;
        isTrash: boolean;
        image: string;
        preview: string;
        chatCount: number;
        isActive: boolean;
    };

    function normalizeQuery(value: string) {
        return value.replace(/\s+/g, "").toLocaleLowerCase();
    }

    function resolveSafeChatIndex(chats: Chat[], index: number) {
        if (chats.length === 0) {
            return -1;
        }
        if (Number.isInteger(index) && index >= 0 && index < chats.length) {
            return index;
        }
        return 0;
    }

    function toPreviewText(value: string | undefined) {
        if (!value) {
            return "";
        }
        return value
            .replace(/<[^>]+>/g, " ")
            .replace(/\{\{[^}]+\}\}/g, " ")
            .replace(/[`*_>#]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function resolveCharacterPreview(personality: string | undefined, description: string | undefined) {
        return toPreviewText(personality) || toPreviewText(description) || language.noData;
    }

    function resolveEntryPreview(entry: (typeof DBState.db.characters)[number]) {
        const personality = typeof entry?.personality === "string" ? entry.personality : "";
        const description = entry && "desc" in entry && typeof entry.desc === "string" ? entry.desc : "";
        return resolveCharacterPreview(personality, description);
    }

    const rows = $derived.by((): CharacterRow[] => {
        const characters = DBState.db.characters ?? [];
        const normalizedSearch = normalizeQuery(shellSearchQuery);
        const results: CharacterRow[] = [];

        characters.forEach((entry, index) => {
            if (!entry) {
                return;
            }

            const isTrash = Boolean(entry.trashTime);
            if (showTrash ? !isTrash : isTrash) {
                return;
            }

            const name = entry.name?.trim() || "Unnamed";
            const normalizedName = normalizeQuery(name);
            if (normalizedSearch && !normalizedName.includes(normalizedSearch)) {
                return;
            }

            const chats = entry.chats ?? [];
            const safeChatIndex = resolveSafeChatIndex(chats, entry.chatPage);

            results.push({
                key: `${entry.chaId ?? index}:${safeChatIndex}:${isTrash ? "trash" : "active"}`,
                chaId: entry.chaId ?? "",
                index,
                name,
                isGroup: entry.type === "group",
                isTrash,
                image: entry.image ?? "",
                preview: resolveEntryPreview(entry),
                chatCount: chats.length,
                isActive: index === $selectedCharID,
            });
        });

        return results;
    });

    function closeOpenMenu() {
        openMenuKey = null;
    }

    function toggleMenu(rowKey: string) {
        openMenuKey = openMenuKey === rowKey ? null : rowKey;
    }

    function selectCharacter(index: number) {
        changeChar(index);
    }

    function resolveCurrentCharacterIndex(row: CharacterRow) {
        if (!row.chaId) {
            return -1;
        }
        const characters = DBState.db.characters ?? [];
        return characters.findIndex((entry) => entry?.chaId === row.chaId);
    }

    function isCardMenuTarget(target: EventTarget | null) {
        return (target as HTMLElement | null)?.closest("[data-home-card-menu]") != null;
    }

    function activateCharacterCard(index: number, isTrash: boolean, target: EventTarget | null) {
        if (isTrash || isCardMenuTarget(target)) {
            return;
        }
        selectCharacter(index);
    }

    function handleCharacterCardKeydown(event: KeyboardEvent, index: number, isTrash: boolean) {
        if (event.key !== "Enter" && event.key !== " " && event.key !== "Spacebar") {
            return;
        }
        if (isTrash || isCardMenuTarget(event.target)) {
            return;
        }
        event.preventDefault();
        selectCharacter(index);
    }

    /* Reactive reduced-motion: subscribe to the media query so that toggling the
       OS setting while on the page takes effect immediately without a reload. */
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

    const cardTiltController = createCardTiltController({
        hostSelector: "[data-home-tilt-card]",
        tiltVarX: "--home-card-tilt-x",
        tiltVarY: "--home-card-tilt-y",
        glareVarX: "--home-card-glare-x",
        glareVarY: "--home-card-glare-y",
        glareOpacityVar: "--home-card-glare-opacity",
        getReducedMotion: () => reducedMotion,
        maxTilt: 9,
        glareOpacityOnMove: "0.58",
    });

    function updateCardTilt(event: PointerEvent) {
        if (coarsePointer) {
            return;
        }
        cardTiltController.onPointerMove(event);
    }

    function resetCardTilt(target: EventTarget | null) {
        cardTiltController.resetFromTarget(target);
    }

    function handleCardPointerLeave(event: PointerEvent) {
        cardTiltController.onPointerLeave(event);
    }

    async function trashCharacter(row: CharacterRow) {
        const index = resolveCurrentCharacterIndex(row);
        if (index === -1) {
            closeOpenMenu();
            return;
        }
        await removeChar(index, row.name, "normal");
        closeOpenMenu();
    }

    async function deleteCharacter(row: CharacterRow) {
        const index = resolveCurrentCharacterIndex(row);
        if (index === -1) {
            closeOpenMenu();
            return;
        }
        await removeChar(index, row.name, "permanent");
        closeOpenMenu();
    }

    function restoreCharacter(row: CharacterRow) {
        const index = resolveCurrentCharacterIndex(row);
        if (index === -1) {
            closeOpenMenu();
            return;
        }
        const targetCharacter = DBState.db.characters[index];
        if (!targetCharacter) {
            return;
        }
        targetCharacter.trashTime = undefined;
        checkCharOrder();
        closeOpenMenu();
    }

    function handleDocumentPointerDown(event: PointerEvent) {
        const target = event.target as HTMLElement | null;
        if (target?.closest("[data-home-card-menu]")) {
            return;
        }
        closeOpenMenu();
    }

    function handleDocumentKeydown(event: KeyboardEvent) {
        if (event.key !== "Escape") {
            return;
        }
        closeOpenMenu();
    }

    const rowKeys = $derived.by(() => new Set(rows.map((row) => row.key)));

    $effect(() => {
        if (!openMenuKey) {
            return;
        }
        if (!rowKeys.has(openMenuKey)) {
            openMenuKey = null;
        }
    });

    onMount(() => {
        document.addEventListener("pointerdown", handleDocumentPointerDown);
        document.addEventListener("keydown", handleDocumentKeydown);

        const motionMq = window.matchMedia("(prefers-reduced-motion: reduce)");
        const coarsePointerMq = window.matchMedia("(hover: none), (pointer: coarse)");
        const handleMotionChange = (e: MediaQueryListEvent) => {
            reducedMotion = e.matches;
        };
        const handlePointerModeChange = (e: MediaQueryListEvent) => {
            coarsePointer = e.matches;
        };
        motionMq.addEventListener("change", handleMotionChange);
        coarsePointerMq.addEventListener("change", handlePointerModeChange);

        return () => {
            document.removeEventListener("pointerdown", handleDocumentPointerDown);
            document.removeEventListener("keydown", handleDocumentKeydown);
            motionMq.removeEventListener("change", handleMotionChange);
            coarsePointerMq.removeEventListener("change", handlePointerModeChange);
        };
    });
</script>

<section
    class="ds-home-directory"
    data-testid="app-home-grid-stub"
    data-shell-search={shellSearchQuery}
    data-show-trash={showTrash ? "1" : "0"}
>
    {#if rows.length === 0}
        <div class="ds-home-directory-empty panel-shell empty-state" data-testid="home-directory-empty-state">
            <h3 data-testid="home-directory-empty-title">{showTrash ? "No trashed characters" : "No characters found"}</h3>
            <p data-testid="home-directory-empty-description">{showTrash ? "Move a character to trash to manage it here." : "Try a different search or create a new character."}</p>
        </div>
    {:else}
        <div class="ds-home-directory-grid">
            {#each rows as row (row.key)}
                <article class="ds-home-character-card panel-shell" class:ds-home-character-card-active={row.isActive} data-home-tilt-card>
                    <div
                        class="ds-home-character-main"
                        role="button"
                        tabindex={row.isTrash ? -1 : 0}
                        aria-disabled={row.isTrash ? "true" : undefined}
                        aria-label={row.isTrash ? `${row.name} (trashed)` : `Open ${row.name}`}
                        onclick={(event) => {
                            activateCharacterCard(row.index, row.isTrash, event.target);
                        }}
                        onkeydown={(event) => {
                            handleCharacterCardKeydown(event, row.index, row.isTrash);
                        }}
                        onpointermove={updateCardTilt}
                        onpointerleave={handleCardPointerLeave}
                        onpointercancel={handleCardPointerLeave}
                        onblur={(event) => {
                            resetCardTilt(event.currentTarget);
                        }}
                        data-testid={`app-home-select-char-${row.index + 1}`}
                        title={row.name}
                    >
                        <div class="ds-home-character-avatar" aria-hidden="true">
                            {#if row.image}
                                {#await getCharImage(row.image, "plain")}
                                    <div class="ds-home-character-avatar-fallback">
                                        {#if row.isGroup}
                                            <UsersIcon size={22} />
                                        {:else}
                                            <UserIcon size={22} />
                                        {/if}
                                    </div>
                                {:then source}
                                    {#if source}
                                        <img src={source} alt="" loading="lazy" draggable="false" />
                                    {:else}
                                        <div class="ds-home-character-avatar-fallback">
                                            {#if row.isGroup}
                                                <UsersIcon size={22} />
                                            {:else}
                                                <UserIcon size={22} />
                                            {/if}
                                        </div>
                                    {/if}
                                {/await}
                            {:else}
                                <div class="ds-home-character-avatar-fallback">
                                    {#if row.isGroup}
                                        <UsersIcon size={22} />
                                    {:else}
                                        <UserIcon size={22} />
                                    {/if}
                                </div>
                            {/if}
                        </div>
                        <div class="ds-home-character-overlay">
                            <div class="ds-home-character-head">
                                <div class="ds-home-character-head-row">
                                    <h3>{row.name}</h3>
                                    <div class="ds-home-character-tools" data-home-card-menu>
                                        <button
                                            type="button"
                                            class="ds-home-character-menu-trigger icon-btn icon-btn--sm icon-btn--bordered"
                                            aria-label="Character actions"
                                            title="Character actions"
                                            aria-haspopup="menu"
                                            aria-expanded={openMenuKey === row.key}
                                            aria-controls={`home-directory-menu-${row.index + 1}`}
                                            onclick={() => {
                                                toggleMenu(row.key);
                                            }}
                                            data-testid={`home-directory-menu-char-${row.index + 1}`}
                                        >
                                            <MoreVerticalIcon size={14} />
                                        </button>

                                        {#if openMenuKey === row.key}
                                            <div
                                                id={`home-directory-menu-${row.index + 1}`}
                                                class="ds-home-character-menu ds-ui-menu"
                                                role="menu"
                                            >
                                                {#if row.isTrash}
                                                    <button
                                                        type="button"
                                                        class="ds-home-character-menu-item ds-ui-menu-item"
                                                        role="menuitem"
                                                        title="Restore character"
                                                        aria-label="Restore character"
                                                        onclick={() => {
                                                            restoreCharacter(row);
                                                        }}
                                                        data-testid={`home-directory-restore-char-${row.index + 1}`}
                                                    >
                                                        <Undo2Icon size={14} />
                                                        <span>Restore</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        class="ds-home-character-menu-item ds-ui-menu-item ds-ui-menu-item--danger ds-home-character-menu-item-danger"
                                                        role="menuitem"
                                                        title="Delete character permanently"
                                                        aria-label="Delete character permanently"
                                                        onclick={() => {
                                                            void deleteCharacter(row);
                                                        }}
                                                        data-testid={`home-directory-delete-char-${row.index + 1}`}
                                                    >
                                                        <TrashIcon size={14} />
                                                        <span>Delete</span>
                                                    </button>
                                                {:else}
                                                    <button
                                                        type="button"
                                                        class="ds-home-character-menu-item ds-ui-menu-item ds-ui-menu-item--danger ds-home-character-menu-item-danger"
                                                        role="menuitem"
                                                        title="Move character to trash"
                                                        aria-label="Move character to trash"
                                                        onclick={() => {
                                                            void trashCharacter(row);
                                                        }}
                                                        data-testid={`home-directory-trash-char-${row.index + 1}`}
                                                    >
                                                        <TrashIcon size={14} />
                                                        <span>Move To Trash</span>
                                                    </button>
                                                {/if}
                                            </div>
                                        {/if}
                                    </div>
                                </div>
                                <p class="ds-home-character-preview" data-testid={`home-directory-preview-char-${row.index + 1}`}>
                                    {row.preview}
                                </p>
                                <span class="ds-home-character-meta">{row.chatCount} {row.chatCount === 1 ? "chat" : "chats"}</span>
                            </div>
                        </div>
                    </div>
                </article>
            {/each}
        </div>
    {/if}
</section>

<style>
    .ds-home-directory {
        width: 100%;
        height: 100%;
        min-height: 0;
        overflow: auto;
        padding: var(--ds-space-4);
    }

    .ds-home-directory-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(13.5rem, 1fr));
        gap: var(--ds-space-3);
        align-content: start;
    }

    .ds-home-character-card {
        display: block;
        text-align: left;
        padding: 0;
        border-radius: 1.35rem;
        transform-style: preserve-3d;
        border: 1px solid color-mix(in srgb, var(--ds-border-subtle) 80%, rgb(255 255 255 / 16%));
        background: radial-gradient(160% 100% at 0% 100%, rgb(193 206 255 / 10%) 0%, transparent 55%),
            color-mix(in srgb, var(--surface-raised) 86%, rgb(12 15 28 / 34%));
        box-shadow: 0 16px 30px rgb(0 0 0 / 0.24), inset 0 1px 0 rgb(255 255 255 / 0.06);
        color: var(--ds-text-primary);
        transform: perspective(68rem) rotateX(var(--home-card-tilt-x, 0deg)) rotateY(var(--home-card-tilt-y, 0deg)) translateY(var(--home-card-lift, 0px));
        transition: transform var(--ds-motion-base) var(--ds-ease-emphasized),
            border-color var(--ds-motion-base) var(--ds-ease-emphasized),
            box-shadow var(--ds-motion-base) var(--ds-ease-emphasized);
        will-change: transform;
    }

    .ds-home-character-card:hover {
        border-color: color-mix(in srgb, var(--ds-border-strong) 72%, rgb(255 255 255 / 20%));
        box-shadow: 0 20px 34px rgb(0 0 0 / 0.3), inset 0 1px 0 rgb(255 255 255 / 0.1);
        --home-card-lift: -4px;
    }

    .ds-home-character-card-active {
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-strong) 65%, rgb(255 255 255 / 15%)),
            0 20px 34px rgb(0 0 0 / 0.3);
    }

    .ds-home-character-card:focus-within {
        border-color: color-mix(in srgb, var(--ds-border-strong) 72%, rgb(255 255 255 / 18%));
        box-shadow: 0 0 0 2px var(--ds-focus-ring), 0 20px 34px rgb(0 0 0 / 0.3);
    }

    .ds-home-character-card-active:focus-within {
        box-shadow:
            0 0 0 2px var(--ds-focus-ring),
            0 0 0 4px color-mix(in srgb, var(--accent-strong) 65%, rgb(255 255 255 / 15%)),
            0 20px 34px rgb(0 0 0 / 0.3);
    }

    .ds-home-character-main {
        position: relative;
        width: 100%;
        aspect-ratio: 3 / 4;
        display: flex;
        align-items: stretch;
        justify-content: stretch;
        text-align: left;
        background: transparent;
        border: none;
        color: inherit;
        padding: 0.6rem;
        transform-style: preserve-3d;
    }

    .ds-home-character-main[role="button"] {
        cursor: pointer;
    }

    .ds-home-character-main[role="button"]:focus-visible {
        outline: none;
        border-radius: var(--ds-radius-md);
        box-shadow: 0 0 0 2px var(--ds-focus-ring);
    }

    .ds-home-character-main[aria-disabled="true"] {
        cursor: default;
        opacity: 0.86;
    }

    .ds-home-character-overlay {
        position: absolute;
        inset: 0.6rem;
        border-radius: calc(1.35rem - 0.6rem);
        display: flex;
        align-items: flex-end;
        padding: 0.85rem 0.85rem 0.75rem;
        background: linear-gradient(180deg, rgb(4 7 15 / 0%) 31%, rgb(8 12 24 / 56%) 61%, rgb(8 10 18 / 84%) 100%);
        pointer-events: none;
    }

    .ds-home-character-head {
        display: grid;
        gap: 0.38rem;
        min-width: 0;
        width: 100%;
    }

    .ds-home-character-head-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--ds-space-2);
    }

    .ds-home-character-avatar {
        position: absolute;
        inset: 0.6rem;
        width: auto;
        aspect-ratio: auto;
        border-radius: calc(1.35rem - 0.6rem);
        border: 1px solid color-mix(in srgb, var(--ds-border-subtle) 72%, rgb(255 255 255 / 10%));
        background: linear-gradient(160deg, rgb(20 24 36 / 96%) 0%, rgb(16 18 27 / 98%) 100%);
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .ds-home-character-avatar::after {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: radial-gradient(
            circle at var(--home-card-glare-x, 50%) var(--home-card-glare-y, 50%),
            rgb(255 255 255 / 0.28) 0%,
            rgb(255 255 255 / 0.09) 18%,
            transparent 46%
        );
        opacity: var(--home-card-glare-opacity, 0);
        transition: opacity var(--ds-motion-base) var(--ds-ease-emphasized);
    }

    .ds-home-character-avatar img {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: cover;
        -webkit-user-drag: none;
        user-select: none;
        -webkit-touch-callout: none;
        pointer-events: none;
    }

    .ds-home-character-avatar-fallback {
        color: var(--ds-text-secondary);
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }

    .ds-home-character-head h3 {
        margin: 0;
        font-size: clamp(1rem, 0.9rem + 0.25vw, 1.2rem);
        font-weight: var(--ds-font-weight-semibold);
        line-height: 1.25;
        min-width: 0;
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: rgb(244 248 255 / 96%);
        text-shadow: 0 1px 2px rgb(0 0 0 / 0.45);
    }

    .ds-home-character-preview {
        margin: 0;
        color: rgb(226 232 249 / 83%);
        font-size: calc(var(--ds-font-size-sm) - 1px);
        line-height: 1.35;
        text-wrap: pretty;
        overflow: hidden;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        min-height: calc(1.35em * 2);
        text-shadow: 0 1px 2px rgb(0 0 0 / 0.35);
    }

    .ds-home-character-meta {
        display: inline-flex;
        align-items: center;
        font-size: var(--ds-font-size-xs);
        color: rgb(224 233 255 / 78%);
        line-height: 1;
        letter-spacing: 0.02em;
        text-transform: uppercase;
    }

    .ds-home-character-tools {
        position: relative;
        display: inline-flex;
        align-items: center;
        pointer-events: auto;
    }

    .ds-home-character-menu-trigger {
        width: 1.7rem;
        height: 1.7rem;
        border-radius: 999px;
        border: 1px solid rgb(243 248 255 / 24%);
        background: linear-gradient(180deg, rgb(255 255 255 / 18%) 0%, rgb(182 194 220 / 5%) 100%);
        color: rgb(236 242 255 / 88%);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        opacity: 0.76;
        transform: translateY(2px);
        backdrop-filter: blur(8px);
        transition: opacity var(--ds-motion-fast) var(--ds-ease-standard),
            transform var(--ds-motion-fast) var(--ds-ease-standard),
            border-color var(--ds-motion-fast) var(--ds-ease-standard),
            background-color var(--ds-motion-fast) var(--ds-ease-standard),
            box-shadow var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .ds-home-character-card:hover .ds-home-character-menu-trigger,
    .ds-home-character-menu-trigger:focus-visible {
        opacity: 1;
        transform: translateY(0);
    }

    .ds-home-character-menu-trigger:focus-visible {
        outline: none;
        box-shadow: 0 0 0 2px var(--ds-focus-ring);
    }

    .ds-home-character-menu-trigger:hover {
        color: rgb(255 255 255 / 98%);
        border-color: rgb(255 255 255 / 36%);
        background: linear-gradient(180deg, rgb(255 255 255 / 26%) 0%, rgb(190 203 227 / 14%) 100%);
        transform: translateY(0) scale(1.06);
    }

    .ds-home-character-menu {
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        z-index: 4;
    }

    .ds-home-character-menu-item {
        height: 1.875rem;
        font-size: var(--ds-font-size-xs);
        font-weight: var(--ds-font-weight-medium);
    }

    @media (prefers-reduced-motion: reduce) {
        .ds-home-character-card,
        .ds-home-character-main,
        .ds-home-character-menu-trigger,
        .ds-home-character-avatar::after {
            transition: none;
        }

        .ds-home-character-card {
            will-change: auto;
        }

        .ds-home-character-main {
            transform: none !important;
        }

        .ds-home-character-avatar::after {
            display: none;
        }
    }

    .ds-home-directory-empty {
        width: min(32rem, 100%);
        margin: var(--ds-space-4) auto;
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-lg);
        background: var(--surface-raised);
        padding: var(--ds-space-5);
        text-align: center;
        color: var(--ds-text-secondary);
    }

    .ds-home-directory-empty h3 {
        margin: 0 0 var(--ds-space-2);
        color: var(--ds-text-primary);
        font-size: var(--ds-font-size-lg);
    }

    .ds-home-directory-empty p {
        margin: 0;
        font-size: var(--ds-font-size-sm);
    }

    @media (max-width: 48rem) {
        .ds-home-directory {
            padding: var(--ds-space-3);
        }

        .ds-home-directory-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: var(--ds-space-2);
        }

        .ds-home-character-card {
            border-radius: 1.05rem;
        }

        .ds-home-character-main {
            aspect-ratio: 4 / 5;
            padding: 0.45rem;
        }

        .ds-home-character-avatar,
        .ds-home-character-overlay {
            inset: 0.45rem;
            border-radius: calc(1.05rem - 0.45rem);
        }

        .ds-home-character-overlay {
            padding: 0.7rem 0.7rem 0.6rem;
        }

        .ds-home-character-head h3 {
            font-size: 1.03rem;
        }

        .ds-home-character-preview {
            -webkit-line-clamp: 1;
            line-clamp: 1;
            min-height: 1.35em;
        }
    }

    @media (max-width: 23rem) {
        .ds-home-directory-grid {
            grid-template-columns: minmax(0, 1fr);
        }
    }

    @media (hover: none), (pointer: coarse) {
        .ds-home-character-card,
        .ds-home-character-main {
            transform: none !important;
        }

        .ds-home-character-card {
            will-change: auto;
        }

        .ds-home-character-card:hover {
            --home-card-lift: 0px;
            box-shadow: 0 16px 30px rgb(0 0 0 / 0.24), inset 0 1px 0 rgb(255 255 255 / 0.06);
        }

        .ds-home-character-avatar::after {
            display: none;
        }

        .ds-home-character-menu-trigger {
            opacity: 1;
            transform: none;
        }
    }
</style>
