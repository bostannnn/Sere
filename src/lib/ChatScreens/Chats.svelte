<script lang="ts">
     
    import type { character, groupChat, Message } from 'src/ts/storage/database.svelte';
    import { mount, onDestroy, unmount } from 'svelte';
    import Chat from './Chat.svelte';
    import { getCharImage } from 'src/ts/characters';
    import { createSimpleCharacter, DBState, selectedCharID, ReloadChatPointer } from 'src/ts/stores.svelte';
    import { chatFoldedStateMessageIndex } from 'src/ts/globalApi.svelte';
    import { get } from 'svelte/store';
    import { SvelteMap, SvelteSet } from 'svelte/reactivity';
    const chatsLog = (..._args: unknown[]) => {};
    
    const getCurrentChatRoomId = () => {
        const charId = get(selectedCharID);
        if (charId < 0) return null;
        const char = DBState.db.characters[charId];
        if (!char) return null;
        return char.chats?.[char.chatPage]?.id ?? null;
    };

    let {
        messages,
        currentCharacter,
        onReroll,
        unReroll,
        currentUsername,
        userIcon,
        loadPages,
        userIconPortrait,
        hasNewUnreadMessage = $bindable(false)
    }:{
        messages: Message[]
        currentCharacter: character|groupChat
        onReroll: () => void
        unReroll: () => void
        currentUsername: string
        userIcon: string
        loadPages: number
        userIconPortrait?: boolean
        hasNewUnreadMessage?: boolean
    } = $props();

    let chatBody: HTMLDivElement;
    let hashes: Set<number> = new SvelteSet();
    const mountInstances: Map<number, unknown> = new SvelteMap();

    //Non-cryptographic hash function to generate a unique hash for each message
    function hashCode(str:string):number {
        let hash = 0;
        for (let i = 0, len = str.length; i < len; i++) {
            const chr = str.charCodeAt(i);
            hash = (hash << 5) - hash + chr;
            hash |= 0; // Convert to 32bit integer
        }
        if(hash == 0){
            hash = 1; // Ensure hash is not zero
        }
        return hash;
    }

    const updateChatBody = () => {
        let nextHash = 0;
        const currentHashes: Set<number> = new SvelteSet();
        const charImage = getCharImage(currentCharacter.image, 'css')
        const userImage = getCharImage(userIcon, 'css')
        const simpleChar = createSimpleCharacter(currentCharacter);
        let loadStart = messages.length - 1
        let loadEnd = messages.length - loadPages

        if(chatFoldedStateMessageIndex.index !== -1){
            loadStart = chatFoldedStateMessageIndex.index
            loadEnd = Math.max(0, chatFoldedStateMessageIndex.index - loadPages)
        }

        const reloadPointerMap = get(ReloadChatPointer);

        for(let i=loadStart ; i >= loadEnd; i--){
            if(i < 0) break; // Prevent out of bounds
            const message = messages[i];
            const messageLargePortrait = message.role === 'user' ? (userIconPortrait ?? false) : ((currentCharacter as character).largePortrait ?? false);
            const reloadPointer = reloadPointerMap[i] ?? 0;
            const hashd = message.data + (message.chatId ?? '') + i.toString() + messageLargePortrait.toString() + message.disabled?.toString() + reloadPointer.toString();
            const currentHash = hashCode(hashd);
            currentHashes.add(currentHash);
            if(!hashes.has(currentHash)){
                const b = document.createElement('div');
                b.setAttribute('x-hashed', currentHash.toString());
                b.classList.add('chat-message-container');
                const inst = mount(Chat, {
                    target: b,
                    props: {
                        message: message.data,
                        isLastMemory: false,
                        idx: i,
                        totalLength: messages.length,
                        img: message.role === 'user' ? userImage : charImage,
                        onReroll: onReroll,
                        unReroll: unReroll,
                        rerollIcon: 'dynamic',
                        character: simpleChar,
                        largePortrait: message.role === 'user' ? (userIconPortrait ?? false) : ((currentCharacter as character).largePortrait ?? false),
                        messageGenerationInfo: message.generationInfo,
                        role: message.role,
                        name: message.role === 'user' ? currentUsername : currentCharacter.name,
                        isComment: message.isComment ?? false,
                        disabled: message.disabled ?? false,
                    },

                })
                mountInstances.set(currentHash, inst);
                const nextElement = document.querySelector(`[x-hashed="${nextHash}"]`);
                if(nextElement){
                    // eslint-disable-next-line svelte/no-dom-manipulating -- intentional direct DOM access for custom virtual list ordering
                    chatBody.insertBefore(b, nextElement?.nextSibling);
                }
                else{
                    // eslint-disable-next-line svelte/no-dom-manipulating -- intentional direct DOM access for custom virtual list ordering
                    chatBody.prepend(b);
                }
            }
            nextHash = currentHash;
            
        }

        //@ts-expect-error Set<T> requires type arg, and Set.difference needs 'esnext' lib (polyfilled by Core-js)
        const toRemove:Set = hashes.difference(currentHashes);
        toRemove.forEach((hash) => {
            const inst = mountInstances.get(hash);
            if(inst){
                unmount(inst);
                mountInstances.delete(hash);
            }
            const element = chatBody.querySelector(`[x-hashed="${hash}"]`);
            if(element){
                // eslint-disable-next-line svelte/no-dom-manipulating -- intentional direct DOM access for custom virtual list cleanup
                chatBody.removeChild(element);
            }
        });

        hashes = currentHashes;
        
    };

    onDestroy(() => {
        chatsLog('Unmounting Chats');
        hashes.clear();
        mountInstances.forEach((inst) => {
            unmount(inst);
        });
        mountInstances.clear();
    })

    function checkIfAtBottom() {
        if (!chatBody || !chatBody.parentElement) return true;
        const sc = chatBody.parentElement as HTMLElement;
        // The chat stack uses column-reverse; latest-message position is near scrollTop=0.
        if (Math.abs(sc.scrollTop) <= 8) return true;
        const lastEl = chatBody.firstElementChild;
        if (!lastEl) return true;
        const rect = lastEl.getBoundingClientRect();
        const scRect = sc.getBoundingClientRect();
        return rect.top <= scRect.bottom + 100;
    }

    export const scrollToLatestMessage = () => {
        if(!chatBody) return;
        hasNewUnreadMessage = false;
        const element = chatBody.firstElementChild;
        if(element){
             element.scrollIntoView({ behavior: 'instant', block: 'start' });
        }
    }

    let previousLength = 0;
    let previousChatRoomId: string | null = null;

    $effect(() => {
        chatsLog('Updating Chats');
        void $ReloadChatPointer; // Make $effect track ReloadChatPointer changes
        const wasAtBottom = checkIfAtBottom();
        updateChatBody()
        
        const currentChatRoomId = getCurrentChatRoomId();
        const isSameChat = currentChatRoomId === previousChatRoomId;
        
        // Only auto-scroll if it's the same chat and new messages were added
        if(isSameChat && messages.length > previousLength){
            const lastMsg = messages[messages.length - 1];
            if(lastMsg && lastMsg.role === 'char' && DBState.db.autoScrollToNewMessage){
                if(wasAtBottom || DBState.db.alwaysScrollToNewMessage){
                    const element = chatBody.firstElementChild;
                    if(element){
                        // Snap immediately, then once again after media/layout settle.
                        element.scrollIntoView({ behavior: 'instant', block: 'start' });
                        setTimeout(() => {
                            element.scrollIntoView({ behavior: 'instant', block: 'start' });
                        }, 700);
                    }
                } else {
                    hasNewUnreadMessage = true;
                }
            }
        }
        previousLength = messages.length;
        previousChatRoomId = currentChatRoomId;
    })

</script>

<div class="ds-chat-list-stack" bind:this={chatBody}></div>
