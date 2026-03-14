<script lang="ts">
    import { DownloadIcon, MoreVerticalIcon, TrashIcon, Undo2Icon, UserIcon, UsersIcon } from "@lucide/svelte";
    import { onMount } from "svelte";
    import { language } from "src/lang";
    import { changeChar, getCharImage, removeChar } from "src/ts/characters";
    import { exportChar } from "src/ts/characterCards";
    import { checkCharOrder } from "src/ts/globalApi.svelte";
    import { selectedCharID, DBState } from "src/ts/stores.svelte";
    import { resolveSafeChatIndex } from "src/ts/storage/database.svelte";
    import { createCardTiltController } from "./cardTilt";
    import "./HomeCharacterDirectory.css";

    interface Props {
        shellSearchQuery?: string;
        showTrash?: boolean;
    }

    let {
        shellSearchQuery = $bindable(""),
        showTrash = false,
    }: Props = $props();

    let openMenuKey = $state<string | null>(null);
    let imageSources = $state<Record<string, string | null>>({});
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

    function getImageCacheKey(image: string, hideAllImages: boolean) {
        return `${hideAllImages ? "hidden" : "visible"}:${image}`;
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

    async function withResolvedCharacterIndex(
        row: CharacterRow,
        action: (index: number) => void | Promise<void>,
        options: {
            closeMenuBeforeAction?: boolean;
        } = {},
    ) {
        const index = resolveCurrentCharacterIndex(row);
        if (index === -1) {
            closeOpenMenu();
            return;
        }
        if (options.closeMenuBeforeAction) {
            closeOpenMenu();
        }
        await action(index);
        if (!options.closeMenuBeforeAction) {
            closeOpenMenu();
        }
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
        await withResolvedCharacterIndex(row, async (index) => {
            await removeChar(index, row.name, "normal");
        });
    }

    async function deleteCharacter(row: CharacterRow) {
        await withResolvedCharacterIndex(row, async (index) => {
            await removeChar(index, row.name, "permanent");
        });
    }

    async function exportCharacter(row: CharacterRow) {
        await withResolvedCharacterIndex(row, async (index) => {
            await exportChar(index);
        }, {
            closeMenuBeforeAction: true,
        });
    }

    function restoreCharacter(row: CharacterRow) {
        void withResolvedCharacterIndex(row, (index) => {
            const targetCharacter = DBState.db.characters[index];
            if (!targetCharacter) {
                return;
            }
            targetCharacter.trashTime = undefined;
            checkCharOrder();
        });
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
    const visibleImageEntries = $derived.by(() => {
        const hideAllImages = Boolean(DBState.db.hideAllImages);
        return Array.from(
            new Map(
                rows
                    .filter((row) => !!row.image)
                    .map((row) => [getImageCacheKey(row.image, hideAllImages), row.image])
            ).entries()
        );
    });

    $effect(() => {
        if (!openMenuKey) {
            return;
        }
        if (!rowKeys.has(openMenuKey)) {
            openMenuKey = null;
        }
    });

    $effect(() => {
        const nextKeys = new Set(visibleImageEntries.map(([cacheKey]) => cacheKey));
        const cachedEntries = Object.entries(imageSources).filter(([cacheKey]) => nextKeys.has(cacheKey));
        if (cachedEntries.length !== Object.keys(imageSources).length) {
            imageSources = Object.fromEntries(cachedEntries);
        }

        const missingEntries = visibleImageEntries.filter(([cacheKey]) => imageSources[cacheKey] === undefined);
        if (missingEntries.length === 0) {
            return;
        }

        let canceled = false;
        void Promise.all(
            missingEntries.map(async ([cacheKey, image]) => {
                const source = await getCharImage(image, "plain");
                return [cacheKey, source] as const;
            })
        ).then((resolvedEntries) => {
            if (canceled) {
                return;
            }
            imageSources = {
                ...imageSources,
                ...Object.fromEntries(resolvedEntries),
            };
        });

        return () => {
            canceled = true;
        };
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
                            {#if row.image && imageSources[getImageCacheKey(row.image, Boolean(DBState.db.hideAllImages))]}
                                <img
                                    src={imageSources[getImageCacheKey(row.image, Boolean(DBState.db.hideAllImages))] ?? ""}
                                    alt=""
                                    loading="lazy"
                                    draggable="false"
                                />
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
                                                    {#if !row.isGroup}
                                                        <button
                                                            type="button"
                                                            class="ds-home-character-menu-item ds-ui-menu-item"
                                                            role="menuitem"
                                                            title={language.exportCharacter}
                                                            aria-label={language.exportCharacter}
                                                            onclick={() => {
                                                                void exportCharacter(row);
                                                            }}
                                                            data-testid={`home-directory-export-char-${row.index + 1}`}
                                                        >
                                                            <DownloadIcon size={14} />
                                                            <span>{language.exportCharacter}</span>
                                                        </button>
                                                    {/if}
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
