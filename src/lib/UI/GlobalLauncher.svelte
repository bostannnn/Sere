<script lang="ts">
    import {
        BookIcon,
        HomeIcon,
        SettingsIcon,
        ShellIcon,
    } from "@lucide/svelte";
    import PluginDefinedIcon from "../Others/PluginDefinedIcon.svelte";
    import { DBState } from "src/ts/stores.svelte";
    import {
        additionalHamburgerMenu,
        openRulebookManager,
        PlaygroundStore,
        selectedCharID,
        settingsOpen,
    } from "src/ts/stores.svelte";

    interface Props {
        onOpenChatList?: () => void;
        onOpenCharacterCatalog?: () => void;
        onResetOverlays?: () => void;
        activeOverlay?: "none" | "chats" | "characters";
        visible?: boolean;
        railId?: string;
    }

    const {
        onResetOverlays = () => {},
        activeOverlay = "none",
        visible = true,
        railId = "global-navigation-rail",
    }: Props = $props();

    const selectedCharacter = $derived($selectedCharID >= 0 ? DBState.db.characters[$selectedCharID] : null);
    const inSettingsWorkspace = $derived($settingsOpen);
    const inLibraryWorkspace = $derived($openRulebookManager);
    const inPlaygroundWorkspace = $derived($PlaygroundStore === 1);
    const homeActive = $derived(!inSettingsWorkspace && !inLibraryWorkspace && !inPlaygroundWorkspace && $selectedCharID < 0 && activeOverlay === "none");
    const playgroundActive = $derived(inPlaygroundWorkspace);
    const libraryActive = $derived(inLibraryWorkspace);
    const settingsActive = $derived(inSettingsWorkspace);
    type RecentChatItem = {
        key: string;
        charId: string;
        chatId: string | null;
        charIndex: number;
        chatIndex: number;
        charName: string;
        chatName: string;
        lastTime: number;
    };

    function resolveTimestamp(value: number | string | null | undefined) {
        if (typeof value === "number" && Number.isFinite(value) && value > 0) {
            return value;
        }
        if (typeof value === "string" && value.trim().length > 0) {
            const parsed = Number(value);
            if (Number.isFinite(parsed) && parsed > 0) {
                return parsed;
            }
        }
        return 0;
    }

    function resolveChatLastTime(chat: { lastDate?: number | string; message?: Array<{ time?: number | string }> }) {
        const chatLastDate = resolveTimestamp(chat.lastDate);
        if (chatLastDate > 0) {
            return chatLastDate;
        }
        const messages = chat.message ?? [];
        for (let i = messages.length - 1; i >= 0; i -= 1) {
            const time = resolveTimestamp(messages[i]?.time);
            if (time > 0) {
                return time;
            }
        }
        return 0;
    }

    const recentChats = $derived.by((): RecentChatItem[] => {
        const characters = DBState.db.characters ?? [];
        const items: RecentChatItem[] = [];

        characters.forEach((char, charIndex) => {
            if (char?.trashTime) {
                return;
            }
            const chats = char?.chats ?? [];
            chats.forEach((chat, chatIndex) => {
                const lastTime = resolveChatLastTime(chat);
                if (lastTime <= 0) {
                    return;
                }
                const charId = char.chaId ?? `char-${charIndex}`;
                const chatId = chat.id ?? null;
                items.push({
                    key: `${charId}:${chatId ?? chatIndex}`,
                    charId,
                    chatId,
                    charIndex,
                    chatIndex,
                    charName: char.name ?? "Unnamed",
                    chatName: chat.name ?? `Chat ${chatIndex + 1}`,
                    lastTime,
                });
            });
        });

        items.sort((left, right) => {
            if (right.lastTime !== left.lastTime) {
                return right.lastTime - left.lastTime;
            }
            const byCharacter = left.charName.localeCompare(right.charName);
            if (byCharacter !== 0) {
                return byCharacter;
            }
            return left.chatName.localeCompare(right.chatName);
        });
        return items.slice(0, 5);
    });

    function goHome() {
        onResetOverlays();
        settingsOpen.set(false);
        openRulebookManager.set(false);
        selectedCharID.set(-1);
        PlaygroundStore.set(0);
    }

    function openSettings() {
        onResetOverlays();
        openRulebookManager.set(false);
        selectedCharID.set(-1);
        PlaygroundStore.set(0);
        settingsOpen.set(true);
    }

    function openPlayground() {
        onResetOverlays();
        settingsOpen.set(false);
        openRulebookManager.set(false);
        selectedCharID.set(-1);
        PlaygroundStore.set(1);
    }

    function openLibrary() {
        onResetOverlays();
        settingsOpen.set(false);
        selectedCharID.set(-1);
        PlaygroundStore.set(0);
        openRulebookManager.set(true);
    }

    function openRecentChat(item: RecentChatItem) {
        onResetOverlays();
        settingsOpen.set(false);
        openRulebookManager.set(false);
        PlaygroundStore.set(0);

        const characters = DBState.db.characters ?? [];
        let targetCharacterIndex = item.charIndex;
        const resolvedCharacterIndex = characters.findIndex((character) => character?.chaId === item.charId);
        if (resolvedCharacterIndex >= 0) {
            targetCharacterIndex = resolvedCharacterIndex;
        } else if (item.chatId) {
            const resolvedByChatIdCharacterIndex = characters.findIndex((character) => {
                const chats = character?.chats ?? [];
                return chats.some((chat) => chat?.id === item.chatId);
            });
            if (resolvedByChatIdCharacterIndex >= 0) {
                targetCharacterIndex = resolvedByChatIdCharacterIndex;
            }
        }

        const targetCharacter = characters[targetCharacterIndex];
        const chats = targetCharacter?.chats ?? [];
        if (!targetCharacter || chats.length === 0) {
            return;
        }

        let nextChatIndex = item.chatIndex;
        if (item.chatId) {
            const resolvedChatIndex = chats.findIndex((chat) => chat?.id === item.chatId);
            if (resolvedChatIndex >= 0) {
                nextChatIndex = resolvedChatIndex;
            }
        }
        if (nextChatIndex < 0) {
            const resolvedByNameIndex = chats.findIndex((chat) => chat?.name === item.chatName);
            if (resolvedByNameIndex >= 0) {
                nextChatIndex = resolvedByNameIndex;
            }
        }
        if (nextChatIndex < 0 || nextChatIndex >= chats.length) {
            nextChatIndex = 0;
        }

        targetCharacter.chatPage = nextChatIndex;
        selectedCharID.set(targetCharacterIndex);
    }

</script>

{#if visible}
    <aside
        id={railId}
        class="ds-global-nav drawer-elevation--left ds-global-nav-drawer"
        data-testid="global-navigation-rail"
    >
        <div class="ds-global-nav-group">
            <button
                type="button"
                class="ds-global-nav-item"
                class:ds-global-nav-item-active={homeActive}
                onclick={goHome}
                title="Home"
                aria-label="Home"
                aria-pressed={homeActive}
                data-testid="global-launcher-nav-home"
            >
                <HomeIcon size={18} />
                <span class="ds-global-nav-label">Home</span>
            </button>
            <button
                type="button"
                class="ds-global-nav-item"
                class:ds-global-nav-item-active={playgroundActive}
                onclick={openPlayground}
                title="Playground"
                aria-label="Playground"
                aria-pressed={playgroundActive}
                data-testid="global-launcher-nav-playground"
            >
                <ShellIcon size={18} />
                <span class="ds-global-nav-label">Playground</span>
            </button>
        </div>

        <div class="ds-global-nav-divider"></div>

        <div class="ds-global-nav-group">
            <button
                type="button"
                class="ds-global-nav-item"
                class:ds-global-nav-item-active={libraryActive}
                onclick={openLibrary}
                title="Rulebooks"
                aria-label="Rulebooks"
                aria-pressed={libraryActive}
                data-testid="global-launcher-nav-library"
            >
                <BookIcon size={18} />
                <span class="ds-global-nav-label">Rulebooks</span>
            </button>
            <button
                type="button"
                class="ds-global-nav-item"
                class:ds-global-nav-item-active={settingsActive}
                onclick={openSettings}
                title="Settings"
                aria-label="Settings"
                aria-pressed={settingsActive}
                data-testid="global-launcher-nav-settings"
            >
                <SettingsIcon size={18} />
                <span class="ds-global-nav-label">Settings</span>
            </button>
        </div>

        <div class="ds-global-nav-divider"></div>
        <section class="ds-global-nav-recent list-shell">
            <span class="ds-global-nav-section-title">Recent Chats</span>
            {#if recentChats.length === 0}
                <span class="ds-global-nav-empty empty-state">No recent chats yet</span>
            {:else}
                {#each recentChats as item (item.key)}
                    <button
                        type="button"
                        class="ds-global-nav-recent-item"
                        data-testid="global-launcher-recent-item"
                        data-char-index={String(item.charIndex)}
                        data-chat-index={String(item.chatIndex)}
                        data-char-id={item.charId}
                        data-chat-id={item.chatId ?? ""}
                        title={`${item.charName} · ${item.chatName}`}
                        aria-label={`${item.charName} ${item.chatName}`}
                        onclick={() => openRecentChat(item)}
                    >
                        <span class="ds-global-nav-recent-char">{item.charName}</span>
                        <span class="ds-global-nav-recent-chat">{item.chatName}</span>
                    </button>
                {/each}
            {/if}
        </section>

        {#if additionalHamburgerMenu.length > 0}
            <div class="ds-global-nav-divider"></div>
            <div class="ds-global-nav-group">
                {#each additionalHamburgerMenu as menu, i (`${menu.name}-${i}`)}
                    <button type="button" class="ds-global-nav-item" onclick={() => menu.callback()} title={menu.name} aria-label={menu.name}>
                        <PluginDefinedIcon ico={menu} />
                        <span class="ds-global-nav-label">{menu.name}</span>
                    </button>
                {/each}
            </div>
        {/if}

        {#if selectedCharacter}
            <div class="ds-global-nav-footer">
                <span class="ds-global-nav-footer-pill control-chip" title={selectedCharacter.name}>
                    {selectedCharacter.name}
                </span>
            </div>
        {/if}
    </aside>
{/if}

<style>
    .ds-global-nav {
        width: var(--ds-nav-rail-width);
        min-width: var(--ds-nav-rail-width);
        height: calc(100dvh - var(--topbar-h));
        position: fixed;
        top: var(--topbar-h);
        left: 0;
        z-index: var(--z-drawer);
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
        padding: var(--ds-space-2);
        border-right: 1px solid var(--ds-border-subtle);
        background: color-mix(in srgb, var(--surface-overlay) 90%, var(--ds-surface-2) 10%);
        -webkit-backdrop-filter: blur(8px);
        backdrop-filter: blur(8px);
        overflow: hidden;
    }

    .ds-global-nav-group {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
    }

    .ds-global-nav-item {
        width: 100%;
        height: var(--ds-height-control-md);
        border-radius: var(--ds-radius-md);
        border: 1px solid var(--ds-border-subtle);
        background: transparent;
        color: var(--ds-text-secondary);
        display: flex;
        align-items: center;
        gap: var(--ds-space-2);
        padding-inline: var(--ds-space-2);
        text-align: left;
        transition: background-color var(--ds-motion-base) var(--ds-ease-standard),
            color var(--ds-motion-base) var(--ds-ease-standard),
            border-color var(--ds-motion-base) var(--ds-ease-standard);
    }

    .ds-global-nav-item:hover,
    .ds-global-nav-item-active {
        background: var(--ds-surface-active);
        color: var(--ds-text-primary);
        border-color: var(--ds-border-strong);
    }

    .ds-global-nav-item:focus-visible,
    .ds-global-nav-recent-item:focus-visible {
        outline: none;
        border-color: var(--ds-border-strong);
        box-shadow: 0 0 0 2px var(--ds-focus-ring);
    }

    .ds-global-nav-label {
        font-size: var(--ds-font-size-sm);
        font-weight: var(--ds-font-weight-medium);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .ds-global-nav-divider {
        width: 100%;
        border-top: 1px solid var(--ds-border-subtle);
        margin-block: var(--ds-space-1);
    }

    .ds-global-nav-recent {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
        min-height: 0;
        flex: 1 1 auto;
        overflow-y: auto;
        overflow-x: hidden;
    }

    .ds-global-nav-section-title {
        color: var(--ds-text-tertiary);
        font-size: var(--ds-font-size-xs);
        font-weight: var(--ds-font-weight-semibold);
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .ds-global-nav-empty {
        color: var(--ds-text-tertiary);
        font-size: var(--ds-font-size-xs);
    }

    .ds-global-nav-recent-item {
        width: 100%;
        min-height: calc(var(--ds-height-control-md) + var(--ds-space-1));
        border-radius: var(--ds-radius-md);
        border: 1px solid var(--ds-border-subtle);
        background: transparent;
        color: var(--ds-text-secondary);
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;
        gap: 1px;
        padding: var(--ds-space-2);
        text-align: left;
        transition: background-color var(--ds-motion-base) var(--ds-ease-standard),
            border-color var(--ds-motion-base) var(--ds-ease-standard),
            color var(--ds-motion-base) var(--ds-ease-standard);
    }

    .ds-global-nav-recent-item:hover {
        background: var(--ds-surface-active);
        border-color: var(--ds-border-strong);
        color: var(--ds-text-primary);
    }

    .ds-global-nav-recent-char {
        max-width: 100%;
        font-size: var(--ds-font-size-sm);
        font-weight: var(--ds-font-weight-medium);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .ds-global-nav-recent-chat {
        max-width: 100%;
        font-size: var(--ds-font-size-xs);
        color: var(--ds-text-tertiary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .ds-global-nav-footer {
        margin-top: var(--ds-space-1);
        min-height: var(--ds-height-control-md);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .ds-global-nav-footer-pill {
        height: var(--ds-height-control-md);
        max-width: 100%;
        border-radius: var(--ds-radius-pill);
        border: 1px solid var(--ds-border-subtle);
        background: transparent;
        color: var(--ds-text-secondary);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding-inline: var(--ds-space-2);
        font-size: var(--ds-font-size-xs);
        font-weight: var(--ds-font-weight-medium);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

</style>
