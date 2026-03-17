<script lang="ts">
    import type { character as CharacterRecord, groupChat as GroupCharacter } from "src/ts/storage/database.svelte";
    import { getFileSrc } from "src/ts/globalApi.svelte";
    import { formatMediaDate, getCharacterGeneratedImageItems, makeImageSrcCache, openCharacterMediaViewer } from "src/ts/chatMedia";

    interface Props {
        character?: CharacterRecord | GroupCharacter | null
    }

    let {
        character = null,
    }: Props = $props();

    const mediaItems = $derived(getCharacterGeneratedImageItems(character))
    const imageCache = makeImageSrcCache((path) => getFileSrc(path))

    $effect(() => {
        character?.chaId
        imageCache.clear()
        return () => imageCache.clear()
    })

    function openItem(path: string) {
        if (!character || character.type === "group") {
            return
        }
        openCharacterMediaViewer(character.chaId, path)
    }
</script>

<section class="ds-character-images-panel list-shell">
    {#if !character || character.type === "group"}
        <div class="ds-character-images-empty">
            Image history is only available for single characters.
        </div>
    {:else if mediaItems.length === 0}
        <div class="ds-character-images-empty">
            Generated images for this character will appear here.
        </div>
    {:else}
        <header class="ds-character-images-header">
            <div>
                <p class="ds-character-images-kicker">Generated media</p>
                <h3 class="ds-character-images-title">{mediaItems.length} image{mediaItems.length === 1 ? "" : "s"}</h3>
            </div>
            <p class="ds-character-images-caption">
                Tap any image to open the fullscreen gallery.
            </p>
        </header>

        <div class="ds-character-images-grid">
            {#each mediaItems as item (item.assetPath)}
                <button
                    type="button"
                    class="ds-character-images-card"
                    aria-label={`Open image from ${formatMediaDate(item.createdAt) || "unknown date"}`}
                    onclick={() => openItem(item.assetPath)}
                >
                    <div class="ds-character-images-thumb-shell">
                        {#await imageCache.get(item.assetPath) then src}
                            {#if src}
                                <img class="ds-character-images-thumb" src={src} alt="Generated artwork" loading="lazy" />
                            {:else}
                                <div class="ds-character-images-thumb ds-character-images-thumb-missing">Missing</div>
                            {/if}
                        {:catch}
                            <div class="ds-character-images-thumb ds-character-images-thumb-missing">Missing</div>
                        {/await}
                    </div>
                    <div class="ds-character-images-meta">
                        <span class="ds-character-images-date">{formatMediaDate(item.createdAt)}</span>
                        {#if item.finalPrompt}
                            <span class="ds-character-images-prompt">{item.finalPrompt}</span>
                        {/if}
                    </div>
                </button>
            {/each}
        </div>
    {/if}
</section>

<style>
    .ds-character-images-panel {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        height: 100%;
        padding: 1rem;
        overflow: auto;
        background:
            linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-0) 84%, rgba(8, 13, 24, 0.92) 16%) 0%, var(--ds-surface-0) 100%);
    }

    .ds-character-images-header {
        display: grid;
        gap: 0.5rem;
        padding-bottom: 0.75rem;
        border-bottom: 1px solid color-mix(in srgb, var(--ds-border-subtle) 82%, transparent 18%);
    }

    .ds-character-images-kicker {
        margin: 0;
        font-size: 0.7rem;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: color-mix(in srgb, var(--ds-text-subtle) 84%, #6ec5ff 16%);
    }

    .ds-character-images-title {
        margin: 0.15rem 0 0;
        font-size: 1.1rem;
        line-height: 1.2;
    }

    .ds-character-images-caption {
        margin: 0;
        font-size: 0.82rem;
        color: var(--ds-text-subtle);
    }

    .ds-character-images-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.75rem;
    }

    .ds-character-images-card {
        display: grid;
        gap: 0.55rem;
        padding: 0;
        border: 0;
        background: transparent;
        text-align: left;
        color: inherit;
        cursor: pointer;
    }

    .ds-character-images-thumb-shell {
        position: relative;
        aspect-ratio: 1 / 1.15;
        overflow: hidden;
        border-radius: 1rem;
        background: color-mix(in srgb, var(--ds-surface-2) 82%, black 18%);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ds-border-subtle) 70%, transparent 30%);
    }

    .ds-character-images-thumb {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        transition: transform 180ms ease, opacity 180ms ease;
    }

    .ds-character-images-card:hover .ds-character-images-thumb,
    .ds-character-images-card:focus-visible .ds-character-images-thumb {
        transform: scale(1.03);
    }

    .ds-character-images-meta {
        display: grid;
        gap: 0.2rem;
        min-width: 0;
    }

    .ds-character-images-date {
        font-size: 0.72rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: color-mix(in srgb, var(--ds-text-subtle) 88%, #9fd7ff 12%);
    }

    .ds-character-images-prompt {
        font-size: 0.82rem;
        line-height: 1.35;
        color: var(--ds-text);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .ds-character-images-empty {
        display: grid;
        place-items: center;
        min-height: 12rem;
        padding: 1.5rem;
        border-radius: 1rem;
        text-align: center;
        color: var(--ds-text-subtle);
        background: color-mix(in srgb, var(--ds-surface-1) 88%, black 12%);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ds-border-subtle) 70%, transparent 30%);
    }

    .ds-character-images-thumb-missing {
        display: grid;
        place-items: center;
        color: var(--ds-text-subtle);
    }

</style>
