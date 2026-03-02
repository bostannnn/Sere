<script lang="ts">
    import { CircleCheckIcon, Waypoints, XIcon } from "@lucide/svelte";
    import { language } from "src/lang";
    import Button from "src/lib/UI/GUI/Button.svelte";
    import TextInput from "src/lib/UI/GUI/TextInput.svelte";
    import type { RisuModule } from "src/ts/process/modules";
    
    import { DBState, ReloadGUIPointer } from 'src/ts/stores.svelte';
    import { selectedCharID } from "src/ts/stores.svelte";
    import { SettingsMenuIndex, settingsOpen } from "src/ts/stores.svelte";
    void ReloadGUIPointer

    interface Props {
        close?: (id: string) => void;
        alertMode?: boolean;
    }

    const { close = (_i:string) => {}, alertMode = false }: Props = $props();
    let moduleSearch = $state('')

    function sortModules(modules:RisuModule[], search:string){
        return modules.filter((v) => {
            if(search === '') return true
            return v.name.toLowerCase().includes(search.toLowerCase())
        
        }).sort((a, b) => {
            const score = a.name.toLowerCase().localeCompare(b.name.toLowerCase())
            return score
        })
    }

    function getSelectedCharacter() {
        return DBState.db.characters[$selectedCharID]
    }

    function getSelectedChat() {
        const character = getSelectedCharacter()
        if(!character){
            return undefined
        }
        return character.chats[character.chatPage]
    }

    function getSelectedChatModules() {
        const chat = getSelectedChat()
        if(!chat){
            return undefined
        }
        chat.modules ??= []
        return chat.modules
    }

</script>


<div class="ds-settings-modal-overlay">
    <div class="ds-settings-modal ds-settings-modal--xl ds-settings-break-any ds-settings-card-stack ds-settings-page">
        <div class="ds-settings-row-center ds-settings-label">
            <h2 class="ds-settings-page-title">{language.modules}</h2>
            <div class="ds-settings-grow-min ds-settings-inline-actions ds-settings-inline-actions-end action-rail">
                <Button size="sm" className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm ds-settings-icon-state-muted-hover-success" onclick={() => {
                    close('')
                }}>
                    <XIcon size={24}/>
                </Button>
            </div>
        </div>

        <span class="ds-settings-label-muted-sm">{language.chatModulesInfo}</span>

        <TextInput size="sm" placeholder={language.search} bind:value={moduleSearch} className="control-field" />

        <div class="ds-settings-list-container ds-settings-list-shell list-shell">
            {#if DBState.db.modules.length === 0}
                <div class="ds-settings-empty-state empty-state">{language.noModules}</div>
            {:else}
                {#each sortModules(DBState.db.modules, moduleSearch) as rmodule, i (rmodule.id)}
                    {#if i !== 0}
                        <div class="ds-settings-divider"></div>
                    {/if}
                    <div class="ds-settings-list-row ds-settings-list-row-inset">
                        {#if rmodule.mcp}
                            <Waypoints size={18} />
                        {/if}
                        {#if !alertMode && DBState.db.enabledModules.includes(rmodule.id)}
                            <span class="ds-settings-label-muted">{rmodule.name}</span>
                        {:else}
                            <span class="">{rmodule.name}</span>
                        {/if}
                        <div class="ds-settings-grow-min ds-settings-inline-actions ds-settings-inline-actions-end action-rail">

                            {#if alertMode}
                                <Button
                                    size="sm"
                                    className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm ds-settings-icon-state-muted-hover-accent"
                                    onclick={async (e) => {
                                    e.stopPropagation()

                                    close(rmodule.id)
                                }}>
                                    <CircleCheckIcon size={18}/>
                                </Button>
                            {:else if DBState.db.enabledModules.includes(rmodule.id)}
                                <Button size="sm" disabled className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm ds-settings-icon-state-muted ds-settings-icon-state-disabled" />
                            {:else}
                                <Button className={"ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm " + (
                                    (getSelectedChatModules()?.includes(rmodule.id)) ?
                                    "ds-settings-icon-state-chat" :
                                    (DBState.db.characters[$selectedCharID]?.modules?.includes(rmodule.id)) ?
                                    "ds-settings-icon-state-character" :
                                    "ds-settings-icon-state-muted-hover-chat"
                                )} size="sm" onclick={async (e) => {
                                    e.stopPropagation()
                                    const chatModules = getSelectedChatModules()
                                    const selectedChat = getSelectedChat()
                                    if(!chatModules || !selectedChat){
                                        return
                                    }
                                    const moduleIndex = chatModules.indexOf(rmodule.id)
                                    if(moduleIndex >= 0){
                                        chatModules.splice(moduleIndex, 1)
                                    } else {
                                        chatModules.push(rmodule.id)
                                    }
                                    selectedChat.modules = chatModules
                                    $ReloadGUIPointer += 1
                                }}
                                oncontextmenu={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    if(!DBState.db.characters[$selectedCharID].modules){
                                        DBState.db.characters[$selectedCharID].modules = []
                                    }
                                    if(DBState.db.characters[$selectedCharID].modules.includes(rmodule.id)){
                                        DBState.db.characters[$selectedCharID].modules.splice(DBState.db.characters[$selectedCharID].modules.indexOf(rmodule.id), 1)
                                    }
                                    else{
                                        DBState.db.characters[$selectedCharID].modules.push(rmodule.id)
                                    }
                                    $ReloadGUIPointer += 1
                                }}>
                                    <CircleCheckIcon size={18}/>
                                </Button>
                            {/if}
                        </div>
                    </div>
                {/each}
            {/if}
        </div>
        <div class="ds-settings-inline-actions action-rail">
            <Button size="sm" onclick={() => {
                $SettingsMenuIndex = 14
                $settingsOpen = true
                close('')
            }}>{language.edit}</Button>
        </div>
    </div>
</div>
