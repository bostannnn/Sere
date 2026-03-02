<script lang="ts">
	import { requestChatData } from "src/ts/process/request/request";
    import { isDoingChat, type OpenAIChat } from "../../ts/process/index.svelte";
    import { setDatabase, type character, type Message, type groupChat, type Database } from "../../ts/storage/database.svelte";
	import { DBState } from 'src/ts/stores.svelte';
    import { selectedCharID } from "../../ts/stores.svelte";
    import { translate } from "src/ts/translator/translator";
    import { CopyIcon, LanguagesIcon, RefreshCcwIcon } from "@lucide/svelte";
    import { alertConfirm } from "src/ts/alert";
    import { language } from "src/lang";
    import { getUserName, replacePlaceholders } from "../../ts/util";
    import { onDestroy } from 'svelte';
    import { ParseMarkdown } from "src/ts/parser.svelte";
    import {defaultAutoSuggestPrompt} from "../../ts/storage/defaultPrompts.js";

    interface Props {
        send: () => void;
        messageInput: (string:string) => void;
    }

    const { send, messageInput }: Props = $props();
    let suggestMessages:string[] = $state(DBState.db.characters[$selectedCharID]?.chats[DBState.db.characters[$selectedCharID].chatPage]?.suggestMessages)
    let suggestMessagesTranslated:string[] = $state()
    let toggleTranslate:boolean = $state(DBState.db.autoTranslate)
    let progress:boolean = $state();
    let progressChatPage=-1;
    let abortController:AbortController;
    let chatPage:number = $state()

    const updateSuggestions = () => {
        if($selectedCharID > -1 && !$isDoingChat) {
            if(progressChatPage > 0 && progressChatPage != chatPage){
                progress=false
                abortController?.abort()
            }
            const currentChar = DBState.db.characters[$selectedCharID];
            suggestMessages = currentChar?.chats[currentChar.chatPage].suggestMessages
        }
    }
    

    const unsub = isDoingChat.subscribe(async (v) => {
        if(v) {
            progress=false
            abortController?.abort()
            suggestMessages = []
        }
        if(!v && $selectedCharID > -1 && (!suggestMessages || suggestMessages.length === 0) && !progress){
            const currentChar:character|groupChat = DBState.db.characters[$selectedCharID];
            let messages:Message[] = []
            
            messages = [...messages, ...currentChar.chats[currentChar.chatPage].message];
            const lastMessages:Message[] = messages.slice(Math.max(messages.length - 10, 0));
            if(lastMessages.length === 0)
                return
            const prompt = DBState.db.autoSuggestPrompt && DBState.db.autoSuggestPrompt.length > 0 ? DBState.db.autoSuggestPrompt : defaultAutoSuggestPrompt
            let promptbody:OpenAIChat[] = [
            {
                role:'system',
                content: replacePlaceholders(prompt, currentChar.name)
            }
            ,{
                role: 'user', 
                content: lastMessages.map(b=>(b.role==='char'? currentChar.name : getUserName())+":"+b.data).reduce((a,b)=>a+','+b)
            }
            ]

            if(DBState.db.subModel === "textgen_webui" || DBState.db.subModel === 'mancer' || DBState.db.subModel.startsWith('local_')){
                promptbody = [
                    {
                        role: 'system',
                        content: replacePlaceholders(DBState.db.autoSuggestPrompt, currentChar.name)
                    },
                    ...lastMessages.map(({ role, data }) => ({
                        role: role === "user" ? "user" as const : "assistant" as const,
                        content: data,
                    })),
                ]
            }

            progress = true
            progressChatPage = chatPage
            abortController = new AbortController()
            requestChatData({
                formated: promptbody,
                bias: {},
                currentChar : currentChar as character
            }, 'submodel', abortController.signal).then(rq2=>{
                if(rq2.type !== 'fail' && rq2.type !== 'streaming' && rq2.type !== 'multiline' && progress){
                    var suggestMessagesNew = rq2.result.split('\n').filter(msg => msg.startsWith('-')).map(msg => msg.replace('-','').trim())
                    const db:Database = DBState.db;
                    db.characters[$selectedCharID].chats[currentChar.chatPage].suggestMessages = suggestMessagesNew
                    setDatabase(db)
                    suggestMessages = suggestMessagesNew
                }
                progress = false
            })
            }
    })

    const translateSuggest = async (toggle, messages)=>{
        if(toggle && messages && messages.length > 0) {
            suggestMessagesTranslated = []
            for(let i = 0; i < suggestMessages.length; i++){
                const msg = suggestMessages[i]
                const translated = await translate(msg, false)
                suggestMessagesTranslated[i] = translated
            }
        }
    }

    onDestroy(unsub)

    $effect(() => {
        void $selectedCharID
        //FIXME add selectedChatPage for optimize render
        chatPage = DBState.db.characters[$selectedCharID].chatPage
        updateSuggestions()
    });
    $effect(() => {translateSuggest(toggleTranslate, suggestMessages)});
</script>

<div class="ds-suggestion-row">
    {#if progress}
        <div class="ds-suggestion-progress">
            <div class="loadmove ds-suggestion-progress-spinner"></div>
            <div>{language.creatingSuggestions}</div>
        </div>        
    {:else if !$isDoingChat}
        {#if DBState.db.translator !== ''}
            <div class="ds-suggestion-item">
                <button
                    type="button"
                    class="ds-suggestion-icon-btn icon-btn icon-btn--sm"
                    class:ds-suggestion-icon-btn-active={toggleTranslate}
                    onclick={() => {
                        toggleTranslate = !toggleTranslate
                    }}
                    title={language.translate}
                    aria-label={language.translate}
                    aria-pressed={toggleTranslate}
                >
                    <LanguagesIcon/>
                </button>
            </div>    
        {/if}
        

        <div class="ds-suggestion-item">
            <button
                type="button"
                class="ds-suggestion-icon-btn icon-btn icon-btn--sm"
                onclick={() => {
                    alertConfirm(language.askReRollAutoSuggestions).then((result) => {
                        if(result) {
                            suggestMessages = []
                            isDoingChat.set(true)
                            isDoingChat.set(false)        
                        }
                    })
                }}
                title="Reroll suggestions"
                aria-label="Reroll suggestions"
            >
                <RefreshCcwIcon/>
            </button>
        </div>
        {#each suggestMessages??[] as suggest, i (i)}
            <div class="ds-suggestion-item">
                <button
                    type="button"
                    class="ds-suggestion-btn"
                    onclick={() => {
                    suggestMessages = []
                    messageInput(suggest)
                    send()
                    }}
                    title="Use suggestion"
                    aria-label="Use suggestion"
                >
                {#await ParseMarkdown((DBState.db.translator !== '' && toggleTranslate && suggestMessagesTranslated && suggestMessagesTranslated.length > 0) ? suggestMessagesTranslated[i]??suggest : suggest) then md}
                    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                    {@html md}
                {/await}
                </button>
                <button
                    type="button"
                    class="ds-suggestion-copy-btn icon-btn icon-btn--sm"
                    onclick={() => {
                        messageInput(suggest)
                    }}
                    title={language.copy}
                    aria-label={language.copy}
                >
                    <CopyIcon/>
                </button>
            </div>
        {/each}
        
    {/if}
</div>

<style>
    .ds-suggestion-row {
        margin-left: var(--ds-space-4);
        display: flex;
        flex-wrap: wrap;
    }

    .ds-suggestion-item {
        display: flex;
        margin-right: var(--ds-space-2);
        margin-bottom: var(--ds-space-2);
    }

    .ds-suggestion-progress {
        display: flex;
        align-items: center;
        gap: var(--ds-space-2);
        padding: var(--ds-space-2);
        border-radius: var(--ds-radius-md);
        background: var(--ds-surface-3);
        color: var(--ds-text-primary);
    }

    .ds-suggestion-progress-spinner {
        margin-inline: var(--ds-space-2);
    }

    .ds-suggestion-icon-btn,
    .ds-suggestion-btn,
    .ds-suggestion-copy-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-sm);
        background: var(--ds-surface-3);
        color: var(--ds-text-primary);
        font-weight: var(--ds-font-weight-bold);
        padding: var(--ds-space-2) var(--ds-space-4);
        transition: background-color var(--ds-motion-fast) var(--ds-ease-standard),
            border-color var(--ds-motion-fast) var(--ds-ease-standard),
            color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .ds-suggestion-icon-btn:hover,
    .ds-suggestion-btn:hover,
    .ds-suggestion-copy-btn:hover {
        background: var(--ds-surface-active);
        border-color: var(--ds-border-strong);
    }

    .ds-suggestion-icon-btn-active {
        color: var(--risu-theme-success-500);
        border-color: color-mix(in srgb, var(--risu-theme-success-500) 45%, var(--ds-border-subtle) 55%);
    }

    .ds-suggestion-copy-btn {
        margin-left: var(--ds-space-1);
    }

    .ds-suggestion-icon-btn.icon-btn,
    .ds-suggestion-copy-btn.icon-btn {
        width: var(--ds-height-control-sm);
        height: var(--ds-height-control-sm);
        min-width: var(--ds-height-control-sm);
        min-height: var(--ds-height-control-sm);
        padding: 0;
    }

    
    .loadmove {
        animation: spin 1s linear infinite;
        border-radius: 50%;
        border: 0.4rem solid rgba(0,0,0,0);
        width: 1rem;
        height: 1rem;
        border-top: 0.4rem solid var(--risu-theme-textcolor);
        border-left: 0.4rem solid var(--risu-theme-textcolor);
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
</style>
