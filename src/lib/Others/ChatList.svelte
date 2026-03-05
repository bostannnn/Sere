<script>
    import { alertConfirm, alertError } from "../../ts/alert";
    import { language } from "../../lang";
    
    import { DBState } from 'src/ts/stores.svelte';
    import { selectedCharID } from "../../ts/stores.svelte";
    import { DownloadIcon, SquarePenIcon, HardDriveUploadIcon, PlusIcon, TrashIcon, XIcon } from "@lucide/svelte";
    import { exportChat, importChat } from "../../ts/characters";
    import { findCharacterbyId } from "../../ts/util";
    import TextInput from "../UI/GUI/TextInput.svelte";
    import { changeChatTo } from "src/ts/globalApi.svelte";
    import { v4 } from "uuid";

    let editMode = $state(false)
    /** @type {{close?: any}} */
    const { close = () => {} } = $props();

    function createNewChatName(chats) {
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
</script>

<div class="ds-settings-modal-overlay">
    <div class="ds-settings-modal ds-chatlist-modal ds-settings-break-any">
        <div class="ds-settings-list-row">
            <h2 class="ds-settings-modal-title">{language.chatList}</h2>
            <div class="ds-settings-grow-min action-rail ds-ui-action-rail ds-ui-action-rail-end">
                <button
                    type="button"
                    class="ds-settings-icon-link icon-btn icon-btn--sm"
                    onclick={close}
                    title="Close chat list"
                    aria-label="Close chat list"
                >
                    <XIcon size={24}/>
                </button>
            </div>
        </div>
        {#each DBState.db.characters[$selectedCharID].chats as chat, i (chat.id ?? i)}
            <div
                role="button"
                tabindex="0"
                onclick={() => {
                if(!editMode){
                    changeChatTo(i)
                    close()
                }
                }}
                onkeydown={(event) => {
                    if ((event.key === 'Enter' || event.key === ' ') && !editMode) {
                        event.preventDefault()
                        changeChatTo(i)
                        close()
                    }
                }}
                class="ds-settings-list-row ds-settings-list-row-inset ds-chatlist-row"
                class:is-active={i === DBState.db.characters[$selectedCharID].chatPage}
                title={chat.name}
                aria-label={`Open ${chat.name}`}
                aria-current={i === DBState.db.characters[$selectedCharID].chatPage ? 'true' : undefined}
            >
                {#if editMode}
                    <TextInput bind:value={DBState.db.characters[$selectedCharID].chats[i].name} padding={false}/>
                {:else}
                    <span>{chat.name}</span>
                {/if}
                <div class="ds-settings-grow-min action-rail ds-ui-action-rail ds-ui-action-rail-end">
                    <button type="button" class="ds-settings-icon-link icon-btn icon-btn--sm" onclick={async (e) => {
                        e.stopPropagation()
                        exportChat(i)
                    }} title="Export chat" aria-label="Export chat">
                        <DownloadIcon size={18}/>
                    </button>
                    <button type="button" class="ds-settings-icon-link icon-btn icon-btn--sm" onclick={async (e) => {
                        e.stopPropagation()
                        if(DBState.db.characters[$selectedCharID].chats.length === 1){
                            alertError(language.errors.onlyOneChat)
                            return
                        }
                        const d = await alertConfirm(`${language.removeConfirm}${chat.name}`)
                        if(d){
                            changeChatTo(0)
                            const chats = DBState.db.characters[$selectedCharID].chats
                            chats.splice(i, 1)
                            DBState.db.characters[$selectedCharID].chats = chats
                        }
                    }} title="Delete chat" aria-label="Delete chat">
                        <TrashIcon size={18}/>
                    </button>
                </div>
            </div>
        {/each}
        <div class="action-rail ds-ui-action-rail ds-chatlist-footer">
            <button type="button" class="ds-settings-icon-link icon-btn icon-btn--sm" onclick={() => {
                const cha = DBState.db.characters[$selectedCharID]
                const chats = DBState.db.characters[$selectedCharID].chats
                const newChat = {
                    message: [],
                    note: '',
                    name: createNewChatName(chats),
                    localLore: [],
                    fmIndex: -1,
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
                DBState.db.characters[$selectedCharID].chats = chats
                changeChatTo(0)
                close()
            }} title="Add chat" aria-label="Add chat">
                <PlusIcon/>
            </button>
            <button type="button" class="ds-settings-icon-link icon-btn icon-btn--sm" onclick={() => {
                importChat()
            }} title="Import chat" aria-label="Import chat">
                <HardDriveUploadIcon size={18}/>
            </button>
            <button type="button" class="ds-settings-icon-link icon-btn icon-btn--sm" onclick={() => {
                editMode = !editMode
            }} title="Rename chats" aria-label="Rename chats" aria-pressed={editMode}>
                <SquarePenIcon size={18}/>
            </button>
        </div>
    </div>
</div>
