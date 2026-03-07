<script lang="ts">
    import defaultWallpaper from '../../etc/bg.jpg'
    import { language } from '../../lang'
    import { getFileSrc } from '../../ts/globalApi.svelte'
    import { DBState } from '../../ts/stores.svelte'
    import { saveImage, type Chat, type ChatBackgroundMode, resolveChatBackgroundMode } from '../../ts/storage/database.svelte'
    import { selectSingleFile } from '../../ts/util'

    interface Props {
        chat: Chat
    }

    const { chat }: Props = $props()

    const activeMode = $derived(resolveChatBackgroundMode(chat.backgroundMode, chat.backgroundImage))
    const hasCustomImage = $derived(typeof chat.backgroundImage === 'string' && chat.backgroundImage.trim().length > 0)
    const statusLabel = $derived.by(() => {
        switch (activeMode) {
            case 'default':
                return language.chatBackgroundDefault
            case 'custom':
                return language.chatBackgroundCustom
            default:
                return language.chatBackgroundInherit
        }
    })

    function setMode(mode: ChatBackgroundMode) {
        if (mode === 'custom' && !hasCustomImage) {
            return
        }
        chat.backgroundMode = mode
    }

    async function handleCustomTileClick() {
        if (hasCustomImage) {
            if (activeMode === 'custom') {
                await uploadBackground()
                return
            }
            setMode('custom')
            return
        }
        await uploadBackground()
    }

    async function uploadBackground() {
        const selected = await selectSingleFile(['png', 'webp', 'gif', 'jpg', 'jpeg'])
        if (!selected) {
            return
        }
        chat.backgroundImage = await saveImage(selected.data)
        chat.backgroundMode = 'custom'
    }

    async function getInheritedPreviewSrc() {
        const globalBackground = DBState.db.customBackground?.trim() ?? ''
        if (globalBackground && globalBackground !== '-') {
            return await getFileSrc(globalBackground)
        }
        return defaultWallpaper
    }

    async function getCustomPreviewSrc() {
        if (!hasCustomImage) {
            return ''
        }
        return await getFileSrc(chat.backgroundImage!)
    }
</script>

<div class="chat-bg-picker">
    <div class="chat-bg-header">
        <span class="chat-bg-title">{language.chatBackground}</span>
        <span class="chat-bg-status">{statusLabel}</span>
    </div>

    <div class="chat-bg-grid">
        <button
            type="button"
            class="chat-bg-tile"
            class:is-active={activeMode === 'inherit'}
            onclick={() => setMode('inherit')}
        >
            {#await getInheritedPreviewSrc() then inheritedSrc}
                <span class="chat-bg-preview" style={`background-image: url('${inheritedSrc}')`}></span>
            {:catch}
                <span class="chat-bg-preview chat-bg-preview-fallback"></span>
            {/await}
            <span class="chat-bg-label">{language.chatBackgroundInherit}</span>
        </button>

        <button
            type="button"
            class="chat-bg-tile"
            class:is-active={activeMode === 'default'}
            onclick={() => setMode('default')}
        >
            <span class="chat-bg-preview" style={`background-image: url('${defaultWallpaper}')`}></span>
            <span class="chat-bg-label">{language.chatBackgroundDefault}</span>
        </button>

        <button
            type="button"
            class="chat-bg-tile chat-bg-tile-upload"
            class:is-active={activeMode === 'custom'}
            onclick={handleCustomTileClick}
        >
            {#if hasCustomImage}
                {#await getCustomPreviewSrc() then customSrc}
                    <span class="chat-bg-preview" style={`background-image: url('${customSrc}')`}></span>
                {:catch}
                    <span class="chat-bg-preview chat-bg-preview-fallback"></span>
                {/await}
            {:else}
                <span class="chat-bg-preview chat-bg-preview-upload">
                    <span class="chat-bg-upload-copy">{language.chatBackgroundUpload}</span>
                </span>
            {/if}
            <span class="chat-bg-label">
                {hasCustomImage
                    ? (activeMode === 'custom' ? language.chatBackgroundReplace : language.chatBackgroundCustom)
                    : language.chatBackgroundUpload}
            </span>
        </button>
    </div>
</div>

<style>
    .chat-bg-picker {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
        padding: var(--ds-space-2);
        border: 1px solid color-mix(in srgb, var(--ds-border-subtle) 75%, transparent);
        border-radius: calc(var(--ds-radius-md) + 0.125rem);
        background:
            linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-2) 86%, transparent), color-mix(in srgb, var(--ds-surface-1) 92%, transparent));
    }

    .chat-bg-header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--ds-space-2);
    }

    .chat-bg-title {
        font-size: var(--ds-font-size-xs);
        font-weight: var(--ds-font-weight-semibold);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--ds-text-secondary);
    }

    .chat-bg-status {
        font-size: var(--ds-font-size-xs);
        color: var(--ds-text-primary);
    }

    .chat-bg-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: var(--ds-space-2);
    }

    .chat-bg-tile {
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-md);
        padding: var(--ds-space-1);
        display: grid;
        gap: var(--ds-space-1);
        background: color-mix(in srgb, var(--ds-surface-2) 72%, transparent);
        color: var(--ds-text-primary);
        text-align: left;
        transition:
            border-color var(--ds-motion-fast) var(--ds-ease-standard),
            background-color var(--ds-motion-fast) var(--ds-ease-standard),
            transform var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .chat-bg-tile:hover {
        transform: translateY(-1px);
        background: color-mix(in srgb, var(--ds-surface-active) 65%, transparent);
    }

    .chat-bg-tile.is-active {
        border-color: color-mix(in srgb, var(--risu-theme-selected) 70%, white 6%);
        background: color-mix(in srgb, var(--risu-theme-selected) 16%, var(--ds-surface-2) 84%);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--risu-theme-selected) 34%, transparent);
    }

    .chat-bg-preview {
        display: block;
        width: 100%;
        aspect-ratio: 1.25;
        border-radius: calc(var(--ds-radius-sm) + 0.05rem);
        background-color: color-mix(in srgb, var(--ds-surface-3) 78%, transparent);
        background-size: cover;
        background-position: center;
    }

    .chat-bg-preview-fallback {
        background:
            linear-gradient(135deg, color-mix(in srgb, var(--ds-surface-3) 85%, transparent), color-mix(in srgb, var(--ds-surface-active) 60%, transparent));
    }

    .chat-bg-preview-upload {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--ds-space-2);
        border: 1px dashed color-mix(in srgb, var(--ds-border-strong) 68%, transparent);
        background:
            linear-gradient(135deg, color-mix(in srgb, var(--ds-surface-3) 84%, transparent), color-mix(in srgb, var(--ds-surface-active) 48%, transparent));
    }

    .chat-bg-upload-copy {
        font-size: var(--ds-font-size-xs);
        font-weight: var(--ds-font-weight-semibold);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--ds-text-secondary);
    }

    .chat-bg-label {
        font-size: var(--ds-font-size-xs);
        font-weight: var(--ds-font-weight-medium);
    }

    @media (max-width: 480px) {
        .chat-bg-grid {
            grid-template-columns: 1fr;
        }
    }
</style>
