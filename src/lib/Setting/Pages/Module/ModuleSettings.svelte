<script lang="ts">
    import { language } from "src/lang";
    
    import { DBState } from 'src/ts/stores.svelte';
    import Button from "src/lib/UI/GUI/Button.svelte";
    import ModuleMenu from "src/lib/Setting/Pages/Module/ModuleMenu.svelte";
    import { exportModule, importModule, refreshModules, type RisuModule } from "src/ts/process/modules";
    import { SquarePen, TrashIcon, Globe, Share2Icon, PlusIcon, HardDriveUpload, Waypoints } from "@lucide/svelte";
    import { v4 } from "uuid";
    import { tooltip } from "src/ts/gui/tooltip";
    import { alertConfirm } from "src/ts/alert";
    import TextInput from "src/lib/UI/GUI/TextInput.svelte";
    import { onDestroy } from "svelte";
    import { importMCPModule } from "src/ts/process/mcp/mcp";
    let tempModule:RisuModule = $state({
        name: '',
        description: '',
        id: v4(),
    })
    let mode = $state(0)
    let editModuleIndex = $state(-1)
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

    onDestroy(() => {
        refreshModules()
    })
</script>
{#if mode === 0}
<div class="ds-settings-page">
    <h2 class="ds-settings-page-title">{language.modules}</h2>

    <TextInput size="sm" placeholder={language.search} bind:value={moduleSearch} className="control-field" />

    <div class="ds-settings-list-container ds-settings-list-shell ds-settings-list-shell-scroll list-shell">
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
                    <span class="ds-settings-text-lg">{rmodule.name}</span>
                    <div class="ds-settings-grow-min ds-settings-inline-actions ds-settings-inline-actions-end action-rail">
                        <div class="ds-settings-inline" use:tooltip={language.enableGlobal}>
                                <Button
                                    size="sm"
                                    className={"ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm " + ((DBState.db.enabledModules.includes(rmodule.id)) ?
                                        "ds-settings-icon-state-active" :
                                        rmodule.namespace &&
                                        DBState.db.moduleIntergration?.split(',').map((s) => s.trim()).includes(rmodule.namespace) ?
                                        "ds-settings-icon-state-integration" :
                                        "ds-settings-icon-state-muted-hover-success"
                                    )}
                                    onclick={async (e) => {
                                    e.stopPropagation()
                                    if(DBState.db.enabledModules.includes(rmodule.id)){
                                        DBState.db.enabledModules.splice(DBState.db.enabledModules.indexOf(rmodule.id), 1)
                                    }
                                    else{
                                        DBState.db.enabledModules.push(rmodule.id)
                                    }
                                    DBState.db.enabledModules = DBState.db.enabledModules
                                }}>
                                <Globe size={18}/>
                            </Button>
                        </div>
                        {#if !rmodule.mcp}
                            <div class="ds-settings-inline" use:tooltip={language.download}>
                                <Button
                                    size="sm"
                                    className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm ds-settings-icon-state-muted-hover-success"
                                    onclick={async (e) => {
                                        e.stopPropagation()
                                        exportModule(rmodule)
                                    }}>
                                    <Share2Icon size={18}/>
                                </Button>
                            </div>
                            <div class="ds-settings-inline" use:tooltip={language.edit}>
                                <Button
                                    size="sm"
                                    className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm ds-settings-icon-state-muted-hover-success"
                                    onclick={async (e) => {
                                        e.stopPropagation()
                                        const index = DBState.db.modules.findIndex((v) => v.id === rmodule.id)
                                        tempModule = rmodule
                                        editModuleIndex = index
                                        mode = 2
                                    }}>
                                    <SquarePen size={18}/>
                                </Button>
                            </div>
                        {:else}
                            <Button size="sm" disabled className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm ds-settings-icon-state-muted">
                                <Share2Icon size={18}/>
                            </Button>
                            <Button size="sm" disabled className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm ds-settings-icon-state-muted">
                                <SquarePen size={18}/>
                            </Button>
                        {/if}
                        <div class="ds-settings-inline" use:tooltip={language.remove}>
                                <Button
                                    size="sm"
                                    className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm ds-settings-icon-state-muted-hover-success"
                                    onclick={async (e) => {
                                        e.stopPropagation()
                                        const d = await alertConfirm(`${language.removeConfirm}` + rmodule.name)
                                    if(d){
                                        if(DBState.db.enabledModules.includes(rmodule.id)){
                                            DBState.db.enabledModules.splice(DBState.db.enabledModules.indexOf(rmodule.id), 1)
                                            DBState.db.enabledModules = DBState.db.enabledModules
                                        }
                                        const index = DBState.db.modules.findIndex((v) => v.id === rmodule.id)
                                        DBState.db.modules.splice(index, 1)
                                        DBState.db.modules = DBState.db.modules
                                    }
                                }}>
                                <TrashIcon size={18}/>
                            </Button>
                        </div>
                    </div>
                </div>
                <div class="ds-settings-list-row-meta">
                    <span class="ds-settings-label-muted-sm">{rmodule.description || 'No description provided'}</span>
                </div>
            {/each}
        {/if}
    </div>

    <div class="ds-settings-inline-actions action-rail">
        <Button size="sm" className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm" onclick={async () => {
            tempModule = {
                name: '',
                description: '',
                id: v4(),
            }
            DBState.db.modules.push(tempModule)
            mode = 1
        }}>
            <PlusIcon />
        </Button>
        <Button size="sm" className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm" onclick={async () => {
            importMCPModule()
        }}>
            <Waypoints />
        </Button>
        <Button size="sm" className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm" onclick={async () => {
            importModule()
        }}>
            <HardDriveUpload  />
        </Button>
    </div>
    </div>
{:else if mode === 1}
    <div class="ds-settings-page">
    <h2 class="ds-settings-page-title">{language.createModule}</h2>
    <ModuleMenu bind:currentModule={tempModule}/>
    <Button onclick={() => {
        DBState.db.modules.push(tempModule)
        mode = 0
    }}>{language.createModule}</Button>
    </div>
{:else if mode === 2}
    <div class="ds-settings-page">
    <h2 class="ds-settings-page-title">{language.editModule}</h2>
    <ModuleMenu bind:currentModule={tempModule}/>
    {#if tempModule.name !== ''}
        <Button onclick={() => {
            DBState.db.modules[editModuleIndex] = tempModule
            mode = 0
        }}>{language.editModule}</Button>
    {/if}
    </div>
{/if}
