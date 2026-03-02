<script lang="ts">
    import { onMount } from "svelte";
    import { XIcon, TrashIcon, PencilIcon, BookOpenCheckIcon, BookLockIcon, ArrowRightIcon } from "@lucide/svelte";
    import Chat from "../ChatScreens/Chat.svelte";
    import { getCharImage } from "src/ts/characters";
    import { findCharacterbyId, getUserName, getUserIcon } from "src/ts/util";
    import { createSimpleCharacter, bookmarkListOpen, DBState, selectedCharID, ScrollToMessageStore } from "src/ts/stores.svelte";
    import { language } from "src/lang";
    import { alertInput } from "src/ts/alert";
    import { SvelteMap, SvelteSet } from "svelte/reactivity";
    type BookmarkMessage = {
        chatId: string
        saying?: string
        originalIndex: number
        data: string
        role: string
        generationInfo?: unknown
    };
    type BookmarkedMessage = BookmarkMessage & {
        speaker: ReturnType<typeof findCharacterbyId> | null
    };

    const close = () => $bookmarkListOpen = false;
    const chara = $derived(DBState.db.characters[$selectedCharID]);
    const simpleChar = $derived(createSimpleCharacter(chara));

    const messageMap = $derived.by((): SvelteMap<string, BookmarkMessage> => {
        if (!chara) return new SvelteMap<string, BookmarkMessage>();

        const chat = chara.chats[chara.chatPage];
        const allMessages = chat.message as Array<{
            chatId: string
            saying?: string
            data: string
            role: string
            generationInfo?: unknown
            [key: string]: unknown
        }>;
        const map = new SvelteMap<string, BookmarkMessage>();
        
        allMessages.forEach((m, index) => {
            map.set(m.chatId, { ...m, originalIndex: index, saying: m.saying ?? '' });
        });

        return map;
    });

    const bookmarkedMessages = $derived.by(() => {
        if (!chara) return [];

        const chat = chara.chats[chara.chatPage];
        const bookmarkIds = chat.bookmarks ?? [];
        const map = messageMap; 

        const messages = bookmarkIds
            .map(id => {
                const message = map.get(id); 
                if (!message) return null;

                let speaker = null;
                if (chara.type === 'group' && message.saying) {
                    speaker = findCharacterbyId(message.saying);
                }
                
                return { ...message, speaker };
            })
            .filter((message): message is BookmarkedMessage => message !== null);

        return messages;
    });

    let expandedBookmarks = $state(new Set<string>());
    let expandAll = $state(false);

    onMount(() => {
        const handleKeydown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                close();
            }
        };
        window.addEventListener('keydown', handleKeydown);
        return () => {
            window.removeEventListener('keydown', handleKeydown);
        };
    });

    function toggleExpand(chatId: string) {
        if (expandAll) {
            expandAll = false;
            const allIds = bookmarkedMessages.map(m => m.chatId);
            const newSet = new SvelteSet(allIds);
            newSet.delete(chatId);
            expandedBookmarks = newSet;
        } else {
            const newSet = new SvelteSet(expandedBookmarks);
            if (newSet.has(chatId)) {
                newSet.delete(chatId);
            } else {
                newSet.add(chatId);
            }
            expandedBookmarks = newSet;
        }
    }

    function toggleExpandAll() {
        expandAll = !expandAll;
        if (expandAll) {
            expandedBookmarks.clear();
        }
    }

    async function editName(chatId: string) {
        const chat = chara.chats[chara.chatPage];
        const newName = await alertInput(language.bookmarkAskNameOrCancel, [], chat.bookmarkNames?.[chatId] || '');
        if (newName && newName.trim() !== '') {
            chat.bookmarkNames[chatId] = newName;
        }
    }

    function removeBookmark(chatId: string) {
        const chat = chara.chats[chara.chatPage];
        const index = chat.bookmarks.indexOf(chatId);
        if (index > -1) {
            chat.bookmarks.splice(index, 1);
            delete chat.bookmarkNames[chatId];
        }
    }

    function goToChat(index: number) {
        ScrollToMessageStore.value = index;
        close();
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="ds-bookmark-overlay"
    onclick={(event) => {
        if (event.target === event.currentTarget) {
            close();
        }
    }}
    onkeydown={(event) => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
            close();
        }
    }}
>
    <div class="ds-settings-modal ds-settings-modal--xl ds-bookmark-modal">
        <div class="ds-bookmark-header">
            <h2 class="ds-bookmark-title">{language.bookmarks}</h2>
            <div class="ds-bookmark-header-actions action-rail ds-ui-action-rail">
                <button 
                    type="button"
                    class="ds-settings-icon-link icon-btn icon-btn--md ds-settings-icon-state-muted-hover-success"
                    onclick={toggleExpandAll}
                    title={expandAll ? language.collapseAll : language.expandAll}
                    aria-label={expandAll ? language.collapseAll : language.expandAll}
                    aria-pressed={expandAll}
                >
                    {#if expandAll}
                        <BookLockIcon size={20} />
                    {:else}
                        <BookOpenCheckIcon size={20} />
                    {/if}   
                </button>
                <button
                    type="button"
                    class="ds-settings-icon-link icon-btn icon-btn--md ds-settings-icon-state-muted-hover-success"
                    onclick={close}
                    title="Close bookmarks"
                    aria-label="Close bookmarks"
                >
                    <XIcon size={24}/>
                </button>
            </div>
        </div>
        
        {#if bookmarkedMessages.length === 0}
            <p class="ds-bookmark-empty empty-state">{language.noBookmarks}</p>
        {:else}
            <div class="ds-bookmark-list">
                {#each bookmarkedMessages as msg (msg.chatId)}
                    <div class="ds-bookmark-item panel-shell">
                        <div 
                            class="ds-bookmark-toggle"
                            onclick={() => toggleExpand(msg.chatId)}
                            onkeydown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    toggleExpand(msg.chatId)
                                }
                            }}
                            role="button"
                            tabindex="0"
                            aria-expanded={expandAll || expandedBookmarks.has(msg.chatId)}
                            title={chara.chats[chara.chatPage].bookmarkNames?.[msg.chatId] || msg.data.substring(0, 30) + '...'}
                        >
                            <span class="ds-bookmark-row-title">{chara.chats[chara.chatPage].bookmarkNames?.[msg.chatId] || msg.data.substring(0, 30) + '...'}</span>
                            <div class="ds-bookmark-row-actions action-rail ds-ui-action-rail">
                                <button type="button" class="ds-settings-icon-link icon-btn icon-btn--sm ds-settings-icon-state-muted-hover-accent" title={language.goToChat} aria-label={language.goToChat} onclick={(e) => { e.stopPropagation(); goToChat(msg.originalIndex); }}>
                                    <ArrowRightIcon size={20} />
                                </button>
                                <button type="button" class="ds-settings-icon-link icon-btn icon-btn--sm ds-settings-icon-state-muted-hover-success" title="Rename bookmark" aria-label="Rename bookmark" onclick={(e) => { e.stopPropagation(); editName(msg.chatId); }}>
                                    <PencilIcon size={16} />
                                </button>
                                <button type="button" class="ds-settings-icon-link icon-btn icon-btn--sm ds-bookmark-icon-danger" title="Remove bookmark" aria-label="Remove bookmark" onclick={(e) => { e.stopPropagation(); removeBookmark(msg.chatId); }}>
                                    <TrashIcon size={16} />
                                </button>
                            </div>
                        </div>

                        {#if expandAll || expandedBookmarks.has(msg.chatId)}
                            <div class="ds-bookmark-preview">
                                {#if chara.type === 'group'}
                                    <Chat
                                        idx={msg.originalIndex}
                                        message={msg.data}
                                        name={msg.speaker?.name}
                                        img={getCharImage(msg.speaker?.image, 'css')}
                                        role={msg.role}
                                        messageGenerationInfo={msg.generationInfo}
                                        rerollIcon={false}
                                        largePortrait={msg.speaker?.largePortrait}
                                        character={msg.saying}
                                        isLastMemory={false}
                                    />
                                {:else}
                                    <Chat
                                        idx={msg.originalIndex}
                                        message={msg.data}
                                        name={msg.role === 'user' ? getUserName() : chara.name}
                                        img={msg.role === 'user' ? getCharImage(getUserIcon(), 'css') : getCharImage(chara.image, 'css')}
                                        role={msg.role}
                                        messageGenerationInfo={msg.generationInfo}
                                        rerollIcon={false}
                                        largePortrait={chara.largePortrait}
                                        character={simpleChar}
                                        isLastMemory={false}
                                    />
                                {/if}
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>
