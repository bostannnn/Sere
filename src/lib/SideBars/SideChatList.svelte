<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import { v4 } from "uuid";
    import Sortable from 'sortablejs/modular/sortable.core.esm.js';
    import { DownloadIcon, PencilIcon, HardDriveUploadIcon, MenuIcon, TrashIcon, SplitIcon, FolderPlusIcon, BookmarkCheckIcon, ImageIcon } from "@lucide/svelte";

    import { type Chat, type ChatFolder, type character, type groupChat, resolveChatBackgroundMode } from "src/ts/storage/database.svelte";
    import { DBState, ReloadGUIPointer, bookmarkListOpen, selectedCharID } from 'src/ts/stores.svelte';

    import CheckInput from "../UI/GUI/CheckInput.svelte";
    import Button from "../UI/GUI/Button.svelte";
    import TextInput from "../UI/GUI/TextInput.svelte";
    import ChatBackgroundPicker from "../Others/ChatBackgroundPicker.svelte";

    import { exportChat, importChat, exportAllChats, getNewChatFirstMessageIndex } from "src/ts/characters";
    import { alertChatOptions, alertConfirm, alertError, alertNormal, alertSelect, alertStore } from "src/ts/alert";
    import { findCharacterbyId, sleep, sortableOptions } from "src/ts/util";
    import { language } from "src/lang";
    import Toggles from "./Toggles.svelte";
    import { changeChatTo, createChatCopyName } from "src/ts/globalApi.svelte";

    interface Props {
        chara: character|groupChat;
    }

    const { chara }: Props = $props();
    let editMode = $state(false)

    const chatsStb: Sortable[] = []
    let folderStb: Sortable = null

    let folderEles: HTMLDivElement = $state()
    let listEle: HTMLDivElement = $state()
    let sorted = $state(0)
    let backgroundPickerChatId = $state<string | null>(null)
    const sideChatListLog = (..._args: unknown[]) => {};
    void ReloadGUIPointer;
    const hasUnfolderedChats = $derived(chara.chats.some((chat) => chat.folderId == null))

    const createStb = () => {
        for (const chat of listEle.querySelectorAll('.risu-chat')) {
            chatsStb.push(new Sortable(chat, {
                group: 'chats',
                ...sortableOptions,
                // Prioritize single-click chat switching over accidental drag start.
                // A short hold still allows intentional reordering.
                delay: 120,
                delayOnTouchOnly: false,
                onEnd: async () => {
                    const currentChatPage = chara.chatPage
                    const newChats: Chat[] = []

                    // const chats: HTMLElement = event.to
                    // chats.querySelectorAll()
                    
                    listEle.querySelectorAll('[data-risu-chat-folder-idx]').forEach(folder => {
                        const folderIdx = parseInt(folder.getAttribute('data-risu-chat-folder-idx'))
                        folder.querySelectorAll('[data-risu-chat-idx]').forEach(chatInFolder => {
                            const chatIdx = parseInt(chatInFolder.getAttribute('data-risu-chat-idx'))
                            const newChat = chara.chats[chatIdx]
                            newChat.folderId = chara.chatFolders[folderIdx].id
                            newChats.push(newChat)
                        })
                    })

                    listEle.querySelectorAll('[data-risu-chat-idx]').forEach(chatEle => {
                        const idx = parseInt(chatEle.getAttribute('data-risu-chat-idx'))
                        const newChat = chara.chats[idx]
                        if (newChats.includes(newChat) == false) {
                            if (newChat.folderId != null)
                                newChat.folderId = null
                            newChats.push(newChat)
                        }
                    })

                    changeChatTo(newChats.indexOf(chara.chats[currentChatPage]))
                    chara.chats = newChats

                    try {
                        this.destroy()
                    } catch {}
                    sorted += 1
                    await sleep(1)
                    createStb()
                },
            }))
        }
        folderStb = Sortable.create(folderEles, {
            group: 'folders',
            ...sortableOptions,
            // Keep folder drag behavior consistent with row drag threshold.
            delay: 120,
            delayOnTouchOnly: false,
            onEnd: async (event) => {
                const newFolders: ChatFolder[] = []
                const newChats: Chat[] = []
                const folders: HTMLElement[] = Array.from<HTMLElement>(event.to.children)

                const currentChatPage = chara.chatPage

                folders.forEach(folder => {
                    const folderIdx = parseInt(folder.getAttribute('data-risu-chat-folder-idx'))
                    newFolders.push(chara.chatFolders[folderIdx])

                    folder.querySelectorAll('[data-risu-chat-idx]').forEach(chatEle => {
                        const idx = parseInt(chatEle.getAttribute('data-risu-chat-idx'))
                        newChats.push(chara.chats[idx])
                    })
                })

                listEle.querySelectorAll('[data-risu-chat-idx]').forEach(chatEle => {
                    const idx = parseInt(chatEle.getAttribute('data-risu-chat-idx'))
                    if (newChats.includes(chara.chats[idx]) == false) {
                        newChats.push(chara.chats[idx])
                    }
                })
                
                chara.chatFolders = newFolders
                changeChatTo(newChats.indexOf(chara.chats[currentChatPage]))
                chara.chats = newChats
                try {
                    folderStb.destroy()
                } catch {}
                sorted += 1
                await sleep(1)
                createStb()
            },
        })
    }

    onMount(createStb)

    onDestroy(() => {
        if (folderStb) {
            try {
                folderStb.destroy()
            } catch {}
        }
        chatsStb.map(stb => {
            try {
                stb.destroy()
            } catch {}
        })
    })

    function handleActionKeydown(event: KeyboardEvent) {
        if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
            event.preventDefault()
            ;(event.currentTarget as HTMLElement).click()
        }
    }

    function createNewChatName(chats: Chat[]) {
        let maxSuffix = 0
        for (const chat of chats) {
            const name = typeof chat?.name === 'string' ? chat.name.trim() : ''
            const match = /^New Chat\s+(\d+)$/i.exec(name)
            if (!match) continue
            const parsed = Number(match[1])
            if (!Number.isFinite(parsed)) continue
            if (parsed > maxSuffix) maxSuffix = parsed
        }
        return `New Chat ${maxSuffix + 1}`
    }

    function getStableChatId(chat: Chat, index: number) {
        return chat.id ?? `chat-${index}`
    }

    function isBackgroundPickerOpen(chat: Chat, index: number) {
        return backgroundPickerChatId === getStableChatId(chat, index)
    }

    function hasBackgroundOverride(chat: Chat) {
        return resolveChatBackgroundMode(chat.backgroundMode, chat.backgroundImage) !== 'inherit'
    }

    function toggleBackgroundPicker(chat: Chat, chatIndex: number, event: MouseEvent) {
        event.stopPropagation()
        const stableId = getStableChatId(chat, chatIndex)
        if (chara.chatPage !== chatIndex) {
            changeChatTo(chatIndex)
            $ReloadGUIPointer += 1
        }
        backgroundPickerChatId = backgroundPickerChatId === stableId ? null : stableId
    }
</script>
<div class="side-chat-list-root">
    <Button className="side-new-chat-button" type="button" onclick={() => {
        const cha = chara
        const chats = chara.chats
        const newChat: Chat = {
            message: [],
            note: '',
            name: createNewChatName(chats),
            localLore: [],
            fmIndex: getNewChatFirstMessageIndex(cha),
            id: v4(),
        }
        chats.unshift(newChat)
        if(cha.type === 'group'){
            cha.characters.map((c) => {
                newChat.message.push({
                    saying: c,
                    role: 'char',
                    data: findCharacterbyId(c).firstMessage
                })
            })
        }
        chara.chats = chats
        changeChatTo(0)
        $ReloadGUIPointer += 1
    }}>{language.newChat}</Button>

    {#snippet chatRow(chat, chatIndex)}
        <div class="side-chat-item" data-risu-chat-idx={chatIndex}>
            <button
                type="button"
                onclick={() => {
                    if(!editMode){
                        changeChatTo(chatIndex)
                        $ReloadGUIPointer += 1
                    }
                }}
                class="side-row side-chat-row ds-ui-list-row"
                class:side-row-selected={chatIndex === chara.chatPage}
            >
                {#if editMode}
                    <TextInput
                        value={chat.name ?? ''}
                        oninput={(event) => {
                            chat.name = event.currentTarget.value
                        }}
                        className="side-input-grow"
                        padding={false}
                    />
                {:else}
                    <span class="side-row-text">{chat.name}</span>
                {/if}
                <div class="side-row-actions action-rail">
                    <div
                        role="button"
                        tabindex="0"
                        aria-label={language.chatBackground}
                        title={language.chatBackground}
                        onkeydown={handleActionKeydown}
                        class="side-action-btn icon-btn icon-btn--sm"
                        class:side-action-btn-active={hasBackgroundOverride(chat)}
                        onclick={(event) => toggleBackgroundPicker(chat, chatIndex, event)}
                    >
                        <ImageIcon size={18}/>
                    </div>
                    <div role="button" tabindex="0" aria-label="Chat options" title="Chat options" onkeydown={handleActionKeydown} class="side-action-btn icon-btn icon-btn--sm" onclick={async (event) => {
                        event.stopPropagation()
                        const option = await alertChatOptions()
                        switch(option){
                            case 0:{
                                const newChat = $state.snapshot(chara.chats[chatIndex])
                                newChat.name = createChatCopyName(newChat.name, 'Copy')
                                newChat.id = v4()
                                chara.chats.unshift(newChat)
                                changeChatTo(0)
                                chara.chats = [...chara.chats]
                                break
                            }
                            case 1:{
                                if(chat.bindedPersona){
                                    const confirm = await alertConfirm(language.doYouWantToUnbindCurrentPersona)
                                    if(confirm){
                                        chat.bindedPersona = ''
                                        alertNormal(language.personaUnbindedSuccess)
                                    }
                                }
                                else{
                                    const confirm = await alertConfirm(language.doYouWantToBindCurrentPersona)
                                    if(confirm){
                                        if(!DBState.db.personas[DBState.db.selectedPersona].id){
                                            DBState.db.personas[DBState.db.selectedPersona].id = v4()
                                        }
                                        chat.bindedPersona = DBState.db.personas[DBState.db.selectedPersona].id
                                        sideChatListLog(DBState.db.personas[DBState.db.selectedPersona])
                                        alertNormal(language.personaBindedSuccess)
                                    }
                                }
                                break
                            }
                        }
                    }}>
                        <MenuIcon size={18}/>
                    </div>
                    <div role="button" tabindex="0" aria-label="Rename chat" title="Rename chat" onkeydown={handleActionKeydown} class="side-action-btn icon-btn icon-btn--sm" onclick={(event) => {
                        event.stopPropagation()
                        editMode = !editMode
                    }}>
                        <PencilIcon size={18}/>
                    </div>
                    <div role="button" tabindex="0" aria-label="Export chat" title="Export chat" onkeydown={handleActionKeydown} class="side-action-btn icon-btn icon-btn--sm" onclick={async (event) => {
                        event.stopPropagation()
                        exportChat(chatIndex)
                    }}>
                        <DownloadIcon size={18}/>
                    </div>
                    <div role="button" tabindex="0" aria-label="Delete chat" title="Delete chat" onkeydown={handleActionKeydown} class="side-action-btn icon-btn icon-btn--sm" onclick={async (event) => {
                        event.stopPropagation()
                        if(chara.chats.length === 1){
                            alertError(language.errors.onlyOneChat)
                            return
                        }
                        const d = await alertConfirm(`${language.removeConfirm}${chat.name}`)
                        if(d){
                            changeChatTo(0)
                            $ReloadGUIPointer += 1
                            const chats = chara.chats
                            chats.splice(chatIndex, 1)
                            chara.chats = chats
                            if (backgroundPickerChatId === getStableChatId(chat, chatIndex)) {
                                backgroundPickerChatId = null
                            }
                        }
                    }}>
                        <TrashIcon size={18}/>
                    </div>
                </div>
            </button>

            {#if isBackgroundPickerOpen(chat, chatIndex)}
                <div class="side-chat-background-panel">
                    <ChatBackgroundPicker chat={chat} />
                </div>
            {/if}
        </div>
    {/snippet}

    {#key sorted}
    <div class="side-chat-list-scroll list-shell" data-testid="side-chat-list-shell" bind:this={listEle}>
        <!-- folder div -->
        <div class="side-folder-list" bind:this={folderEles}>
            <!-- chat folder -->
            {#each chara.chatFolders as folder, i (folder.id ?? i)}
            <div data-risu-chat-folder-idx={i}
                class="side-folder-card panel-shell"
                data-testid="side-folder-card">
                <!-- folder header -->
                <button
                    type="button"
                    onclick={() => {
                        if(!editMode) {
                            chara.chatFolders[i].folded = !folder.folded
                            $ReloadGUIPointer += 1
                        }
                    }}
                    class="side-row side-folder-header ds-ui-list-row"
                    class:side-folder-color-red={folder.color === 'red'}
                    class:side-folder-color-yellow={folder.color === 'yellow'}
                    class:side-folder-color-green={folder.color === 'green'}
                    class:side-folder-color-blue={folder.color === 'blue'}
                    class:side-folder-color-indigo={folder.color === 'indigo'}
                    class:side-folder-color-purple={folder.color === 'purple'}
                    class:side-folder-color-pink={folder.color === 'pink'}
                >
                    {#if editMode}
                        <TextInput
                            value={chara.chatFolders[i].name ?? ''}
                            oninput={(event) => {
                                chara.chatFolders[i].name = event.currentTarget.value
                            }}
                            className="side-input-grow"
                            padding={false}
                        />
                    {:else}
                        <span class="side-row-text">{folder.name}</span>
                    {/if}
                    <div class="side-row-actions action-rail">
                        <div role="button" tabindex="0" aria-label="Folder actions" title="Folder actions" onkeydown={handleActionKeydown} class="side-action-btn icon-btn icon-btn--sm" onclick={async (e) => {
                            e.stopPropagation()
                            const sel = parseInt(await alertSelect([language.changeFolderColor, language.cancel]))
                            switch (sel) {
                                case 0: {
                                    const colors = ["red", "green", "blue", "yellow", "indigo", "purple", "pink", "default"]
                                    const selectedColorIndex = parseInt(await alertSelect(colors))
                                    if (!Number.isNaN(selectedColorIndex) && colors[selectedColorIndex]) {
                                        folder.color = colors[selectedColorIndex]
                                    }
                                    break
                                }
                            }
                        }}>
                            <MenuIcon size={18}/>
                        </div>
                        <div role="button" tabindex="0" aria-label="Rename folder" title="Rename folder" onkeydown={handleActionKeydown} class="side-action-btn icon-btn icon-btn--sm" onclick={() => {
                            editMode = !editMode
                        }}>
                            <PencilIcon size={18}/>
                        </div>
                        <div role="button" tabindex="0" aria-label="Delete folder" title="Delete folder" onkeydown={handleActionKeydown} class="side-action-btn icon-btn icon-btn--sm" onclick={async (e) => {
                            e.stopPropagation()
                            const d = await alertConfirm(`${language.removeConfirm}${folder.name}`)
                            if (d) {
                                $ReloadGUIPointer += 1
                                const folders = chara.chatFolders
                                folders.splice(i, 1)
                                chara.chats.forEach(chat => {
                                    if (chat.folderId == folder.id) {
                                        chat.folderId = null
                                    }
                                })
                                chara.chatFolders = folders
                            }
                        }}>
                            <TrashIcon size={18}/>
                        </div>
                    </div>
                </button>
                <!-- chats in folder -->
                <div class="risu-chat side-chat-group" class:side-hidden={folder.folded}>
                    {#if chara.chats.filter(chat => chat.folderId == chara.chatFolders[i].id).length == 0}
                    <span class="no-sort side-chat-empty empty-state" data-testid="side-chat-empty">Empty</span>
                    <div></div>
                    {:else}
                    {#each chara.chats.filter(chat => chat.folderId == chara.chatFolders[i].id) as chat (chat.id)}
                    {@render chatRow(chat, chara.chats.indexOf(chat))}
                    {/each}
                    {/if}
                </div>
            </div>
            {/each}
        </div>
        <!-- chat without folder div -->
        <div class="risu-chat side-chat-group side-chat-group--flat">
            {#if !hasUnfolderedChats}
                <span class="no-sort side-chat-empty side-chat-empty-global empty-state" data-testid="side-chat-empty-global">No chats yet</span>
            {:else}
            {#each chara.chats as chat, i (chat.id ?? i)}
            {#if chat.folderId == null}
            {@render chatRow(chat, i)}
            {/if}
            {/each}
            {/if}
        </div>
    </div>
    {/key}

    <div class="side-footer">
        <div class="side-footer-actions action-rail">
            <button type="button" aria-label="Export all chats" title="Export all chats" class="side-action-btn icon-btn icon-btn--sm" onclick={() => {
                exportAllChats()
            }}>
                <DownloadIcon size={18}/>
            </button>
            <button type="button" aria-label="Import chat" title="Import chat" class="side-action-btn icon-btn icon-btn--sm" onclick={() => {
                importChat()
            }}>
                <HardDriveUploadIcon size={18}/>
            </button>
            <button type="button" aria-label="Toggle edit mode" title="Toggle edit mode" class="side-action-btn icon-btn icon-btn--sm" onclick={() => {
                editMode = !editMode
            }}>
                <PencilIcon size={18}/>
            </button>
            <button type="button" aria-label="Open branch actions" title="Open branch actions" class="side-action-btn icon-btn icon-btn--sm" onclick={() => {
                alertStore.set({
                  type: "branches",
                  msg: ""
                })
            }}>
                <SplitIcon size={18}/>
            </button>
            <button type="button" aria-label="Open bookmarks" title="Open bookmarks" class="side-action-btn icon-btn icon-btn--sm" onclick={() => {
                $bookmarkListOpen = true;
            }}>
                <BookmarkCheckIcon size={18}/>
            </button>
            <button type="button" aria-label="Add folder" title="Add folder" class="side-action-btn icon-btn icon-btn--sm side-action-btn-end" onclick={() => {
                if (!chara.chatFolders) {
                    chara.chatFolders = []
                }
                const folders = chara.chatFolders
                const length = chara.chatFolders.length
                folders.unshift({
                    id: v4(),
                    name: `New Folder ${length + 1}`,
                    folded: false,
                })
                chara.chatFolders = folders
                $ReloadGUIPointer += 1
            }}>
                <FolderPlusIcon size={18}/>
            </button>
        </div>

        {#if DBState.db.characters[$selectedCharID]?.chaId !== '§playground'}            
            <Toggles chara={chara} />
        {/if}
    </div>
    {#if chara.type === 'group'}
    <div class="side-order-row">
        <CheckInput
            check={chara.orderByOrder}
            name={language.orderByOrder}
            onChange={(check) => {
                chara.orderByOrder = check
            }}
        />
    </div>
    {/if}
</div>

<style>
    .side-chat-list-root {
        width: 100%;
        height: 100%;
        max-height: 100%;
        display: flex;
        flex-direction: column;
        padding: var(--ds-space-2);
        gap: var(--ds-space-2);
    }

    .side-chat-list-scroll {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
        margin-top: var(--ds-space-1);
    }

    .side-folder-list {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
    }

    .side-folder-card {
        display: flex;
        flex-direction: column;
        cursor: pointer;
    }

    .side-chat-group {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-1);
        width: 100%;
        padding: var(--ds-space-2);
        border-radius: var(--ds-radius-md);
        color: var(--ds-text-primary);
        cursor: pointer;
    }

    .side-chat-group--flat {
        padding: 0;
    }

    .side-chat-item {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-1);
    }

    .side-hidden {
        display: none;
    }

    .side-folder-color-red {
        background: var(--color-red-900);
    }

    .side-folder-color-yellow {
        background: var(--color-yellow-900);
    }

    .side-folder-color-green {
        background: var(--color-green-900);
    }

    .side-folder-color-blue {
        background: var(--color-blue-900);
    }

    .side-folder-color-indigo {
        background: var(--color-indigo-900);
    }

    .side-folder-color-purple {
        background: var(--color-purple-900);
    }

    .side-folder-color-pink {
        background: var(--color-pink-900);
    }

    .side-chat-empty {
        display: flex;
        justify-content: center;
        color: var(--ds-text-secondary);
    }

    .side-chat-empty-global {
        width: 100%;
        min-height: calc(var(--ds-height-list-row) * 1.5);
        align-items: center;
        margin-block: var(--ds-space-2);
    }

    .side-row {
        position: relative;
        min-height: var(--ds-height-list-row);
        padding: 0 var(--ds-space-3);
        border: 0;
        border-radius: var(--ds-radius-md);
        display: flex;
        align-items: center;
        gap: var(--ds-space-2);
        color: var(--ds-text-primary);
        background: transparent;
        text-align: left;
    }

    .side-folder-header {
        font-size: var(--ds-font-size-sm);
        font-weight: var(--ds-font-weight-medium);
    }

    .side-chat-row {
        font-size: var(--ds-font-size-md);
        font-weight: var(--ds-font-weight-semibold);
    }

    .side-row:hover {
        background: var(--ds-surface-active);
    }

    .side-row:focus-visible {
        z-index: 1;
        outline: 1px solid var(--ds-border-strong);
        outline-offset: 1px;
        background: var(--ds-surface-active);
    }

    .side-row-selected {
        background: var(--ds-surface-active);
    }

    .side-row-text {
        flex: 1 1 auto;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .side-row-actions {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: var(--ds-space-1);
        flex: 0 0 auto;
    }

    :global(.side-input-grow) {
        flex: 1 1 auto;
        min-width: 0;
    }

    :global(.side-new-chat-button) {
        min-height: var(--ds-height-control-md);
        height: var(--ds-height-control-md);
    }

    .side-action-btn {
        width: var(--ds-icon-action-size);
        height: var(--ds-icon-action-size);
        min-width: var(--ds-icon-action-size);
        min-height: var(--ds-icon-action-size);
        border-radius: var(--ds-radius-sm);
        border: 0;
        padding: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: var(--ds-text-secondary);
        background: transparent;
        transition: color var(--ds-motion-fast) var(--ds-ease-standard),
            background-color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .side-action-btn:hover {
        color: var(--ds-text-primary);
        background: var(--ds-surface-active);
    }

    .side-action-btn-active {
        color: var(--ds-text-primary);
        background: color-mix(in srgb, var(--risu-theme-selected) 18%, transparent);
    }

    .side-chat-background-panel {
        padding-inline: var(--ds-space-2);
        padding-bottom: var(--ds-space-1);
    }

    .side-action-btn-end {
        margin-left: auto;
    }

    .side-footer {
        border-top: 1px solid var(--ds-border-subtle);
        padding-top: var(--ds-space-2);
    }

    .side-footer-actions {
        display: flex;
        align-items: center;
        gap: var(--ds-space-1);
        padding: 0 var(--ds-space-1);
    }

    .side-order-row {
        display: flex;
        align-items: center;
        margin-top: var(--ds-space-2);
    }
</style>
