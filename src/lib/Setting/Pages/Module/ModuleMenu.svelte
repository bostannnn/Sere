<script lang="ts">
    import { language } from "src/lang";
    import TextInput from "src/lib/UI/GUI/TextInput.svelte";
    import Button from "src/lib/UI/GUI/Button.svelte";
    import type { loreBook } from "src/ts/storage/database.svelte";
    import LoreBookList from "src/lib/SideBars/LoreBook/LoreBookList.svelte";
    import { type CCLorebook, convertExternalLorebook } from "src/ts/process/lorebook.svelte";
    import type { RisuModule } from "src/ts/process/modules";
    import { DownloadIcon, FolderPlusIcon, HardDriveUploadIcon, PlusIcon, TrashIcon } from "@lucide/svelte";
    import RegexList from "src/lib/SideBars/Scripts/RegexList.svelte";
    import TriggerList from "src/lib/SideBars/Scripts/TriggerList.svelte";
    import Check from "src/lib/UI/GUI/CheckInput.svelte";
    import Help from "src/lib/Others/Help.svelte";
    import TextAreaInput from "src/lib/UI/GUI/TextAreaInput.svelte";
    import { getFileSrc, saveAsset, downloadFile } from "src/ts/globalApi.svelte";
    import { alertNormal, alertError } from "src/ts/alert";
    import { exportRegex, importRegex } from "src/ts/process/scripts";
    import { selectMultipleFile } from "src/ts/util";
    import SettingsSubTabs from "src/lib/Setting/SettingsSubTabs.svelte";
    
    import { DBState } from 'src/ts/stores.svelte';
  import { v4 } from "uuid";

    let submenu = $state(0)
    interface Props {
        currentModule: RisuModule;
    }

    let { currentModule = $bindable() }: Props = $props();
    const assetFileExtensions:string[] = $state([])
    const assetFilePath:string[] = $state([])

    $effect.pre(() => {
        currentModule.namespace ??= ''
        currentModule.customModuleToggle ??= ''
        currentModule.backgroundEmbedding ??= ''

        if(DBState.db.useAdditionalAssetsPreview){
            if(currentModule?.assets){
                for(let i = 0; i < currentModule.assets.length; i++){
                    const asset = currentModule.assets[i]
                    const assetPath = asset?.[1] ?? ''
                    if(!assetPath){
                        continue
                    }
                    if(asset.length > 2 && asset[2]) {
                        assetFileExtensions[i] = asset[2]
                    } else {
                        assetFileExtensions[i] = assetPath.split('.').pop() ?? ''
                    }
                    getFileSrc(assetPath).then((filePath) => {
                        assetFilePath[i] = filePath ?? ''
                    })
                }
            }
        }
    });

    function addLorebook(){
        if(Array.isArray(currentModule.lorebook)){
            currentModule.lorebook.push({
                key: '',
                comment: `New Lore`,
                content: '',
                mode: 'normal',
                insertorder: 100,
                alwaysActive: false,
                secondkey: "",
                selective: false
            })

            currentModule.lorebook = currentModule.lorebook
        }
    }

    function addLorebookFolder(){
        if(Array.isArray(currentModule.lorebook)){
            const id = v4()
            currentModule.lorebook.push({
                key: '\uf000folder:' + id,
                comment: `New Folder`,
                content: '',
                mode: 'folder',
                insertorder: 100,
                alwaysActive: false,
                secondkey: "",
                selective: false,
            })

            currentModule.lorebook = currentModule.lorebook
        }
    }

    async function exportLoreBook(){
        try {
            const lore = currentModule.lorebook        
            const stringl = Buffer.from(JSON.stringify({
                type: 'risu',
                ver: 1,
                data: lore
            }), 'utf-8')

            await downloadFile(`lorebook_export.json`, stringl)

            alertNormal(language.successExport)
        } catch (error) {
            alertError(`${error}`)
        }
    }

    async function importLoreBook(){
        currentModule.lorebook ??= []
        const lore = currentModule.lorebook
        const lorebook = (await selectMultipleFile(['json', 'lorebook']))
        if(!lorebook){
            return
        }
        try {
            for(const f of lorebook){
                const importedlore = JSON.parse(Buffer.from(f.data).toString('utf-8'))
                if(importedlore.type === 'risu' && importedlore.data){
                    const datas:loreBook[] = importedlore.data
                    for(const data of datas){
                        lore.push(data)
                    }
                }
                else if(importedlore.entries){
                    const entries:{[key:string]:CCLorebook} = importedlore.entries
                    lore.push(...convertExternalLorebook(entries))
                }
            }
        } catch (error) {
            alertError(`${error}`)
        }
    }

    function addRegex(){
        if(Array.isArray(currentModule.regex)){
            currentModule.regex.push({
                comment: "",
                in: "",
                out: "",
                type: "editinput"
            })

            currentModule.regex = currentModule.regex
        }
    }

    function selectSubmenu(id: number) {
        if (id === 1) {
            currentModule.lorebook ??= []
        } else if (id === 2) {
            currentModule.regex ??= []
        } else if (id === 3) {
            currentModule.trigger ??= [{
                comment: "",
                type: "manual",
                conditions: [],
                effect: [{
                    type: "v2Header",
                    code: "",
                    indent: 0
                }]
            }, {
                comment: "New Event",
                type: 'manual',
                conditions: [],
                effect: []
            }]
        } else if (id === 5) {
            currentModule.assets ??= []
        }
        submenu = id
    }
</script>

<SettingsSubTabs
    items={[
        { id: 0, label: language.basicInfo },
        { id: 1, label: language.loreBook },
        { id: 2, label: language.regexScript },
        { id: 3, label: language.triggerScript },
        { id: 5, label: language.additionalAssets },
    ]}
    selectedId={submenu}
    onSelect={selectSubmenu}
/>

{#if submenu === 0}
    <div class="ds-settings-section">
    <span class="ds-settings-label">{language.name}</span>
    <TextInput bind:value={currentModule.name} size="sm"/>
    <span class="ds-settings-label">{language.description}</span>
    <TextInput bind:value={currentModule.description} size="sm"/>
    <span class="ds-settings-label">{language.namespace} <Help key="namespace" /></span>
    <TextInput bind:value={currentModule.namespace!} size="sm"/>
    <div class="ds-settings-row-center">
        <Check bind:check={currentModule.hideIcon} name={language.hideChatIcon}/>
    </div>
    <span class="ds-settings-label">{language.customPromptTemplateToggle} <Help key='customPromptTemplateToggle' /></span>
    <TextAreaInput bind:value={currentModule.customModuleToggle!} />
    </div>
{/if}
{#if submenu === 1 && (Array.isArray(currentModule.lorebook))}
    <div class="ds-settings-section">
    <LoreBookList externalLoreBooks={currentModule.lorebook} />
    <div class="ds-settings-inline-actions action-rail">
        <Button size="sm" className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm" onclick={() => {addLorebook()}}>
            <PlusIcon />
        </Button>
        <Button size="sm" className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm" onclick={() => {exportLoreBook()}}>
            <DownloadIcon />
        </Button>
        <Button size="sm" className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm" onclick={() => {
            addLorebookFolder()
        }}>
            <FolderPlusIcon />
        </Button>
        <Button size="sm" className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm" onclick={() => {importLoreBook()}}>
            <HardDriveUploadIcon />
        </Button>
    </div>
    </div>
{/if}

{#if submenu === 2 && (Array.isArray(currentModule.regex))}
    <div class="ds-settings-section">
    <TextAreaInput bind:value={currentModule.backgroundEmbedding!} placeholder={language.backgroundHTML} size="sm"/>
    <RegexList bind:value={currentModule.regex}/>
    <div class="ds-settings-inline-actions action-rail">
        <Button size="sm" className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm" onclick={() => {
            addRegex()
        }}><PlusIcon /></Button>
        <Button size="sm" className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm" onclick={() => {
            exportRegex(currentModule.regex)
        }}><DownloadIcon /></Button>
        <Button size="sm" className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm" onclick={async () => {
            currentModule.regex = await importRegex(currentModule.regex)
        }}><HardDriveUploadIcon /></Button>
    </div>
    </div>
{/if}

{#if submenu === 5 && (Array.isArray(currentModule.assets))}
    <div class="ds-settings-section">
    <div class="ds-settings-card ds-settings-table-container">
        <table class="ds-settings-table">
            <tbody>
            <tr>
                <th class="ds-settings-table-head">{language.value}</th>
                <th class="ds-settings-table-action-head">
                    <Button size="sm" className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm" onclick={async () => {
                        const da = await selectMultipleFile(['png', 'webp', 'mp4', 'mp3', 'gif', 'jpeg', 'jpg', 'ttf', 'otf', 'css', 'webm', 'woff', 'woff2', 'svg', 'avif'])
                        currentModule.assets = currentModule.assets ?? []
                        if(!da){
                            return
                        }
                        for(const f of da){
                            const img = f.data
                            const name = f.name
                            const extension = name.split('.').pop()?.toLowerCase() ?? ''
                            const imgp = await saveAsset(img,'', extension)
                            currentModule.assets.push([name, imgp, extension])
                            currentModule.assets = currentModule.assets
                        }
                    }}>
                        <PlusIcon />
                    </Button>
                </th>
            </tr>
            {#if (!currentModule.assets) || currentModule.assets.length === 0}
                <tr>
                    <td class="ds-settings-empty-state empty-state" colspan="3">{language.noData}</td>
                </tr>
            {:else}
                {#each currentModule.assets as assets, i (i)}
                    <tr>
                        <td class="ds-settings-table-cell-truncate">
                                {#if assetFilePath[i] && DBState.db.useAdditionalAssetsPreview}
                                    {#if assetFileExtensions[i] === 'mp4'}
                                    <video controls class="ds-settings-asset-preview ds-settings-asset-preview-wide"><source src={assetFilePath[i]} type="video/mp4"></video>
                                {:else if assetFileExtensions[i] === 'mp3'}
                                    <audio controls class="ds-settings-asset-preview ds-settings-asset-preview-wide ds-settings-asset-preview-square" loop><source src={assetFilePath[i]} type="audio/mpeg"></audio>
                                {:else}
                                    <img src={assetFilePath[i]} class="ds-settings-asset-preview ds-settings-asset-preview-square" alt={assets[0]}/>
                                {/if}
                            {/if}
                            <TextInput fullwidth size="sm" bind:value={currentModule.assets[i][0]} placeholder="..." />
                        </td>
                        
                        <th class="ds-settings-table-action-head">
                            <Button styled="danger" size="sm" className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm" onclick={() => {
                                const additionalAssets = currentModule.assets ?? []
                                additionalAssets.splice(i, 1)
                                currentModule.assets = additionalAssets
                            }}>
                                <TrashIcon />
                            </Button>
                        </th>
                    </tr>
                {/each}
            {/if}
            </tbody>
        </table>
    </div>
    </div>
{/if}

{#if submenu === 3 && (Array.isArray(currentModule.trigger))}
    <div class="ds-settings-section">
    <TriggerList bind:value={currentModule.trigger} lowLevelAble={currentModule.lowLevelAccess} />

    <div class="ds-settings-row-center">
        <Check bind:check={currentModule.lowLevelAccess} name={language.lowLevelAccess}/>
        <span> <Help key="lowLevelAccess" name={language.lowLevelAccess}/></span>
    </div>
    </div>
{/if}
