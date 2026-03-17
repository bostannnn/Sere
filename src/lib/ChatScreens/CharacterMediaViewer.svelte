<script lang="ts">
    import { ChevronLeftIcon, ChevronRightIcon, ImageIcon, XIcon } from "@lucide/svelte";
    import { tick } from "svelte";
    import Portal from "src/lib/UI/GUI/Portal.svelte";
    import { DBState } from "src/ts/stores.svelte";
    import { chatMediaViewerState } from "src/ts/chatMediaViewerState.svelte";
    import { getFileSrc } from "src/ts/globalApi.svelte";
    import { closeCharacterMediaViewer, formatMediaDate, getCharacterGeneratedImageItems, makeImageSrcCache } from "src/ts/chatMedia";
    import { findSingleCharacterById } from "src/ts/storage/characterList";

    const imageCache = makeImageSrcCache((path) => getFileSrc(path))
    let lastCachedCharacterId = ""
    let currentIndex = $state(0)
    let touchStartX = $state<number | null>(null)
    let touchStartY = $state<number | null>(null)
    let lastRequestId = -1
    let thumbnailStripElement = $state<HTMLDivElement | null>(null)

    const selectedCharacter = $derived(findSingleCharacterById(
        DBState.db.characters,
        chatMediaViewerState.characterId ?? "",
    ))
    const mediaItems = $derived(getCharacterGeneratedImageItems(selectedCharacter))
    const currentItem = $derived(mediaItems[currentIndex] ?? null)

    function syncCurrentIndex() {
        if (!chatMediaViewerState.open) {
            return
        }
        if (!selectedCharacter || mediaItems.length === 0) {
            // Defer the close to avoid writing reactive state mid-flush
            tick().then(closeCharacterMediaViewer)
            return
        }
        if (chatMediaViewerState.requestId !== lastRequestId) {
            const requestedPath = chatMediaViewerState.mediaPath ?? ""
            const requestedIndex = mediaItems.findIndex((item) => item.assetPath === requestedPath)
            currentIndex = requestedIndex >= 0 ? requestedIndex : 0
            lastRequestId = chatMediaViewerState.requestId
        } else if (currentIndex >= mediaItems.length) {
            currentIndex = mediaItems.length - 1
        }
    }

    function move(delta: number) {
        if (mediaItems.length <= 1) {
            return
        }
        currentIndex = (currentIndex + delta + mediaItems.length) % mediaItems.length
        chatMediaViewerState.mediaPath = mediaItems[currentIndex]?.assetPath ?? chatMediaViewerState.mediaPath
    }

    function selectIndex(index: number) {
        if (index < 0 || index >= mediaItems.length) {
            return
        }
        currentIndex = index
        chatMediaViewerState.mediaPath = mediaItems[index]?.assetPath ?? chatMediaViewerState.mediaPath
    }

    function handleWindowKeydown(event: KeyboardEvent) {
        if (!chatMediaViewerState.open) {
            return
        }
        if (event.key === "Escape") {
            closeCharacterMediaViewer()
            return
        }
        if (event.key === "ArrowLeft") {
            move(-1)
            event.preventDefault()
            return
        }
        if (event.key === "ArrowRight") {
            move(1)
            event.preventDefault()
        }
    }

    function handleTouchStart(event: TouchEvent) {
        if (event.touches.length !== 1) {
            touchStartX = null
            touchStartY = null
            return
        }
        touchStartX = event.touches[0].clientX
        touchStartY = event.touches[0].clientY
    }

    function handleTouchEnd(event: TouchEvent) {
        if (touchStartX === null || touchStartY === null || event.changedTouches.length !== 1) {
            touchStartX = null
            touchStartY = null
            return
        }
        const deltaX = event.changedTouches[0].clientX - touchStartX
        const deltaY = event.changedTouches[0].clientY - touchStartY
        touchStartX = null
        touchStartY = null
        if (Math.abs(deltaX) < 44 || Math.abs(deltaX) <= Math.abs(deltaY)) {
            return
        }
        move(deltaX < 0 ? 1 : -1)
    }

    $effect(() => {
        const id = chatMediaViewerState.characterId ?? ""
        if (id !== lastCachedCharacterId) {
            imageCache.clear()
            lastCachedCharacterId = id
        }
    })

    $effect(() => {
        syncCurrentIndex()
    })

    $effect(() => {
        if (!currentItem || !thumbnailStripElement) {
            return
        }
        const thumbnailButton = thumbnailStripElement.querySelectorAll<HTMLButtonElement>(".ds-character-media-thumb-button")[currentIndex]
        thumbnailButton?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "center",
        })
    })
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#if chatMediaViewerState.open && selectedCharacter && currentItem}
    <Portal>
        <div
            class="ds-character-media-viewer"
            role="presentation"
            onclick={closeCharacterMediaViewer}
        >
            <div
                class="ds-character-media-dialog"
                role="dialog"
                aria-modal="true"
                aria-label="Character image viewer"
                tabindex="-1"
                onclick={(event) => {
                    event.stopPropagation()
                }}
                onkeydown={(event) => {
                    event.stopPropagation()
                }}
            >
                <div class="ds-character-media-viewer-topbar">
                    <div class="ds-character-media-viewer-meta">
                        <span class="ds-character-media-viewer-kicker">{selectedCharacter.name}</span>
                        <strong class="ds-character-media-viewer-title">
                            {currentIndex + 1} / {mediaItems.length}
                        </strong>
                        {#if currentItem.createdAt}
                            <span class="ds-character-media-viewer-date">{formatMediaDate(currentItem.createdAt)}</span>
                        {/if}
                    </div>
                    <button
                        type="button"
                        class="ds-character-media-close icon-btn"
                        aria-label="Close image viewer"
                        onclick={closeCharacterMediaViewer}
                    >
                        <XIcon size={20} />
                    </button>
                </div>

                <div class="ds-character-media-stage">
                    {#if mediaItems.length > 1}
                        <button
                            type="button"
                            class="ds-character-media-nav ds-character-media-nav-prev icon-btn"
                            aria-label="Previous image"
                            onclick={() => move(-1)}
                        >
                            <ChevronLeftIcon size={22} />
                        </button>
                    {/if}

                    <div
                        class="ds-character-media-frame"
                        role="presentation"
                        ontouchstart={handleTouchStart}
                        ontouchend={handleTouchEnd}
                    >
                        {#await imageCache.get(currentItem.assetPath) then src}
                            {#if src}
                                <img class="ds-character-media-image" src={src} alt="Generated artwork" />
                            {:else}
                                <div class="ds-character-media-missing">
                                    <ImageIcon size={28} />
                                    <span>Image file is missing.</span>
                                </div>
                            {/if}
                        {:catch}
                            <div class="ds-character-media-missing">
                                <ImageIcon size={28} />
                                <span>Image file is missing.</span>
                            </div>
                        {/await}
                    </div>

                    {#if mediaItems.length > 1}
                        <button
                            type="button"
                            class="ds-character-media-nav ds-character-media-nav-next icon-btn"
                            aria-label="Next image"
                            onclick={() => move(1)}
                        >
                            <ChevronRightIcon size={22} />
                        </button>
                    {/if}
                </div>

                <div class="ds-character-media-bottom">
                    {#if currentItem.finalPrompt}
                        <p class="ds-character-media-prompt">{currentItem.finalPrompt}</p>
                    {/if}

                    <div class="ds-character-media-strip" data-mobile-gesture-ignore bind:this={thumbnailStripElement}>
                        {#each mediaItems as item, index (item.assetPath)}
                            <button
                                type="button"
                                class="ds-character-media-thumb-button"
                                class:is-active={index === currentIndex}
                                aria-label={`Open image ${index + 1}`}
                                onclick={() => selectIndex(index)}
                            >
                                {#await imageCache.get(item.assetPath) then src}
                                    {#if src}
                                        <img class="ds-character-media-thumb" src={src} alt="Preview" loading="lazy" />
                                    {:else}
                                        <span class="ds-character-media-thumb-fallback">Missing</span>
                                    {/if}
                                {:catch}
                                    <span class="ds-character-media-thumb-fallback">Missing</span>
                                {/await}
                            </button>
                        {/each}
                    </div>
                </div>
            </div>
        </div>
    </Portal>
{/if}

<style>
    .ds-character-media-viewer {
        position: fixed;
        inset: 0;
        z-index: 2000;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: max(1rem, env(safe-area-inset-top, 0px)) 1rem max(1rem, env(safe-area-inset-bottom, 0px));
        background: rgba(0, 0, 0, 0.94);
        backdrop-filter: blur(10px);
    }

    .ds-character-media-dialog {
        width: min(100%, 96rem);
        flex: 1 1 0;
        min-height: 0;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr) auto;
        gap: 1rem;
    }

    .ds-character-media-viewer-topbar {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
    }

    .ds-character-media-viewer-meta {
        display: grid;
        gap: 0.25rem;
    }

    .ds-character-media-viewer-kicker {
        font-size: 0.72rem;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.5);
    }

    .ds-character-media-viewer-title {
        font-size: clamp(1rem, 1.7vw, 1.25rem);
        line-height: 1.15;
    }

    .ds-character-media-viewer-date {
        font-size: 0.86rem;
        color: rgba(230, 238, 250, 0.66);
    }

    .ds-character-media-stage {
        min-height: 0;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 0.75rem;
        position: relative;
    }

    .ds-character-media-frame {
        min-width: 0;
        min-height: 0;
        display: grid;
        place-items: center;
        overflow: hidden;
        border-radius: 1.4rem;
        background: rgba(10, 10, 10, 0.98);
        box-shadow:
            0 18px 60px rgba(0, 0, 0, 0.45),
            inset 0 0 0 1px rgba(255, 255, 255, 0.08);
    }

    .ds-character-media-image {
        max-width: 100%;
        max-height: calc(100dvh - 22rem);
        object-fit: contain;
        display: block;
        user-select: none;
        -webkit-user-drag: none;
    }

    .ds-character-media-nav {
        width: 2.75rem;
        height: 2.75rem;
        border-radius: 999px;
        background: rgba(18, 18, 18, 0.9);
        color: rgba(255, 255, 255, 0.92);
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
    }

    .ds-character-media-bottom {
        display: grid;
        gap: 0.75rem;
    }

    .ds-character-media-prompt {
        margin: 0;
        max-width: min(64rem, 100%);
        font-size: 0.95rem;
        line-height: 1.45;
        color: rgba(255, 255, 255, 0.84);
    }

    .ds-character-media-strip {
        display: flex;
        gap: 0.6rem;
        overflow-x: auto;
        padding: 0.2rem;
        scrollbar-width: thin;
    }

    .ds-character-media-thumb-button {
        flex: 0 0 auto;
        width: 4.4rem;
        height: 4.4rem;
        overflow: hidden;
        padding: 0;
        border: 0;
        border-radius: 1rem;
        background: rgba(18, 18, 18, 0.9);
        cursor: pointer;
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
    }

    .ds-character-media-thumb-button.is-active {
        box-shadow:
            0 0 0 2px rgba(255, 255, 255, 0.82),
            inset 0 0 0 1px rgba(255, 255, 255, 0.1);
    }

    .ds-character-media-thumb {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }

    .ds-character-media-thumb-fallback,
    .ds-character-media-missing {
        display: grid;
        place-items: center;
        text-align: center;
        color: rgba(255, 255, 255, 0.72);
    }

    .ds-character-media-missing {
        gap: 0.5rem;
        min-height: min(28rem, 60vh);
        padding: 1.5rem;
    }

    @media (max-width: 720px) {
        .ds-character-media-viewer {
            padding-inline: 0.75rem;
        }

        .ds-character-media-stage {
            grid-template-columns: minmax(0, 1fr);
        }

        .ds-character-media-nav {
            position: absolute;
            bottom: 7.5rem;
            z-index: 1;
        }

        .ds-character-media-nav-prev {
            left: 1rem;
        }

        .ds-character-media-nav-next {
            right: 1rem;
        }

        .ds-character-media-image {
            max-height: calc(100dvh - 20rem);
        }

        .ds-character-media-thumb-button {
            width: 3.7rem;
            height: 3.7rem;
        }
    }
</style>
