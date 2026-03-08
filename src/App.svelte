    <script lang="ts">
    import {
            openPresetList,
            openPersonaList,
            CustomGUISettingMenuStore,
            loadedStore,
            alertStore,
            LoadingStatusState,
            bookmarkListOpen,
            popupStore,
        } from './ts/stores.svelte';
    import AlertComp from './lib/Others/AlertComp.svelte';
    
    import BookmarkList from './lib/Others/BookmarkList.svelte';
    import { importCharacterProcess } from './ts/characterCards';
    import { importPreset, getDatabase, setDatabase } from './ts/storage/database.svelte';
    import { readModule } from './ts/process/modules';
    import { alertNormal } from './ts/alert';
    import { language } from './lang';
    import SavePopupIconComp from './lib/Others/SavePopupIcon.svelte';
    import Botpreset from './lib/Setting/botpreset.svelte';
    import ListedPersona from './lib/Setting/listedPersona.svelte';
    import CustomGUISettingMenu from './lib/Setting/Pages/CustomGUISettingMenu.svelte';
    import { checkCharOrder } from './ts/globalApi.svelte';
    import { ArrowUpIcon, GlobeIcon, PlusIcon } from '@lucide/svelte';
    import { hypaV3ProgressStore } from "./ts/stores.svelte";
    import HypaV3Progress from './lib/Others/HypaV3Progress.svelte';
    import PopupList from './lib/UI/PopupList.svelte';
    import AppShellV2 from './lib/UI/AppShellV2.svelte';

  
    
    let aprilFools = $state(new Date().getMonth() === 3 && new Date().getDate() === 1)
    let aprilFoolsPage = $state(0)

    function closePresetList() {
        $openPresetList = false
    }

    function closePersonaList() {
        $openPersonaList = false
    }

</script>

<main class="ds-app-shell" ondragover={(e) => {
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'link'
}} ondrop={async (e) => {
    e.preventDefault()
    if (!e.dataTransfer) return
    if (e.dataTransfer.types.includes('application/x-risu-internal')) {
        return
    }
    const file = e.dataTransfer.files[0]
    if (file) {
        const name = file.name.toLowerCase()

        if (name.endsWith('.risup')) {
            const data = new Uint8Array(await file.arrayBuffer())
            await importPreset({ name: file.name, data })
            alertNormal(language.successImport)
        } else if (name.endsWith('.risum')) {
            const data = new Uint8Array(await file.arrayBuffer())
            const module = await readModule(Buffer.from(data))
            if (module) {
                const db = getDatabase()
                db.modules.push(module)
                setDatabase(db)
                alertNormal(language.successImport)
            }
        } else {
            await importCharacterProcess({
                name: file.name,
                data: file
            })
            checkCharOrder()
        }
    }
}}>
    {#if aprilFools}

        <div class="ds-app-april-shell">
            <div class="ds-app-april-center">
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="ds-app-april-content">
                    {#if aprilFoolsPage === 0}
                        <h1 class="ds-app-april-title">What can I help you?</h1>
                        <div class="ds-app-april-input-shell" placeholder="Ask me" onkeydown={(e) => {
                            if(e.key === 'Enter'){
                                aprilFoolsPage = 1
                            }
                        }}>
                            <textarea class="ds-app-april-input" placeholder="Ask me"></textarea>
                            <div class="ds-app-april-input-controls-left">
                                <button class="ds-app-april-icon-btn">
                                    <PlusIcon size={18} />
                                </button>
                                <button class="ds-app-april-icon-btn">
                                    <GlobeIcon size={18} />
                                </button>
                                
                            </div>
                            <div class="ds-app-april-input-controls-right">
                                <button class="ds-app-april-send-btn">
                                    <ArrowUpIcon size={18} />
                                </button>
                            </div>
                        </div>
                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                        <div class="ds-app-april-options" onclick={() => {
                            aprilFoolsPage = 1
                        }}>
                            <button class="ds-app-april-option-btn">
                                <span class="ds-app-april-option-emoji">🔍</span>
                                Search
                            </button>
                            <button class="ds-app-april-option-btn">
                                <span class="ds-app-april-option-emoji">🎮</span>
                                Games
                            </button>
                            <button class="ds-app-april-option-btn">
                                <span class="ds-app-april-option-emoji">🎨</span>
                                Roleplay
                            </button>
                            <button class="ds-app-april-option-btn">
                                More
                            </button>
                        </div>
                    {:else}
                    <h1 class="ds-app-april-title">
                        We do not have search results.
                    </h1>
                    <p class="ds-app-april-copy">
                        <!-- svelte-ignore a11y_missing_attribute -->
                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                        Go to <a class="ds-app-april-link" onclick={() => {
                            aprilFoolsPage = 0
                            aprilFools = false
                        }}>
                            Risuai  
                        </a>
                    </p>

                    {/if}
                </div>
            </div>
            <span class="ds-app-april-brand">RisyGTP-9</span>
        </div>
    {:else if !$loadedStore}
        <div class="ds-app-loading-shell">
            <div class="ds-app-loading-row">
                <svg class="ds-app-loading-spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="ds-app-loading-spinner-track" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="ds-app-loading-spinner-segment" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                <span>Loading...</span>
            </div>

            <span class="ds-app-loading-status">{LoadingStatusState.text}</span>
        </div>
    {:else if $CustomGUISettingMenuStore}
        <CustomGUISettingMenu />
    {:else}
        <AppShellV2 />
    {/if}
    {#if $alertStore.type !== 'none'}
        <AlertComp />
    {/if}
    {#if $openPresetList}
        <Botpreset close={closePresetList} />
    {/if}
    {#if $openPersonaList}
        <ListedPersona close={closePersonaList} />
    {/if}
    {#if $bookmarkListOpen}
        <BookmarkList />
    {/if}
    <SavePopupIconComp />
    {#if $hypaV3ProgressStore.open}
        <HypaV3Progress />
    {/if}
    {#if popupStore.children}
        <PopupList />
    {/if}
</main>
