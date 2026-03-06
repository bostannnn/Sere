import { writable } from "svelte/store";
import type { character, Database, groupChat } from "./storage/database.svelte";
import { type simpleCharacterArgument } from "./parser.svelte";
import type { alertData } from "./alert";
import { moduleUpdate } from "./process/modules";
import { resetScriptCache } from "./process/scripts";
import type { PluginSafetyErrors } from "./plugins/pluginSafety";
import { comfyProgressDefault } from "./integrations/comfy/types";

function shouldUseMobileGUI(){
    return window.innerWidth <= 900;
}

function updateSize(){
    SizeStore.set({
        w: window.innerWidth,
        h: window.innerHeight
    })
    DynamicGUI.set(window.innerWidth <= 1024)
    MobileGUI.set(shouldUseMobileGUI())
}
let sizeListenerAttached = false;
export function attachWindowSizeListener(){
    if (typeof window === 'undefined' || sizeListenerAttached) return;
    updateSize();
    window.addEventListener("resize", updateSize);
    sizeListenerAttached = true;
}
export function detachWindowSizeListener(){
    if (typeof window === 'undefined' || !sizeListenerAttached) return;
    window.removeEventListener("resize", updateSize);
    sizeListenerAttached = false;
}

export const SizeStore = writable({
    w: 0,
    h: 0
})

export type AppWorkspace = "home" | "characters" | "chats" | "library" | "playground" | "settings"
export type AppInspector = "none" | "details" | "chat" | "character" | "memory"

export interface AppRoute {
    workspace: AppWorkspace
    selectedCharacterId: string | null
    selectedChatId: string | null
    inspector: AppInspector
}

export const appRouteStore = writable<AppRoute>({
    workspace: "characters",
    selectedCharacterId: null,
    selectedChatId: null,
    inspector: "none",
})

export const loadedStore = writable(false)
export const DynamicGUI = writable(false)
export const sideBarClosing = writable(false)
export const sideBarStore = writable(window.innerWidth > 1024)
export const selectedCharID = writable(-1)
export const CurrentTriggerIdStore = writable<string | null>(null)
export const CharEmotion = writable({} as {[key:string]: [string, string, number][]})
export const ViewBoxsize = writable({ width: 12 * 16, height: 12 * 16 }); // Default width and height in pixels
export const settingsOpen = writable(false)
export const moduleBackgroundEmbedding = writable('')
export const openPresetList = writable(false)
export const openPersonaList = writable(false)
export const bookmarkListOpen = writable(false)
export const MobileGUI = writable(false)
export const MobileGUIStack = writable(0)
export const MobileSideBar = writable(0)
export const SettingsMenuIndex = writable(-1)
export const ReloadGUIPointer = writable(0)
export const ReloadChatPointer = writable({} as Record<number, number>)
export const ScrollToMessageStore = $state({ value: -1 })
export const PlaygroundStore = writable(0)
export const HideIconStore = writable(false)
export const CustomCSSStore = writable('')
export const SafeModeStore = writable(false)
export const MobileSearch = writable('')
export const CharConfigSubMenu = writable(0)
export const CustomGUISettingMenuStore = writable(false)
export const alertStore = writable({
    type: 'none',
    msg: 'n',
} as alertData)
export const hypaV3ModalOpen = writable(false)
export const hypaV3ProgressStore = writable({
    open: false,
    miniMsg: '',
    msg: '',
    subMsg: '',
})
export const openRulebookManager = writable(false)
export const pluginProgressStore = writable({
    active: false,
    label: '',
    color: '#22c55e',
})
export const comfyProgressStore = writable({
    ...comfyProgressDefault,
})
export interface RagProgress {
    active: boolean;
    status: string;
    message: string;
    current: number;
    total: number;
    file?: string;
    percent?: number;
    currentFileIndex?: number;
    totalFiles?: number;
}

export const ragProgressStore = writable<RagProgress>({
    active: false,
    status: '',
    message: '',
    current: 0,
    total: 1,
    currentFileIndex: 0,
    totalFiles: 0
});

export const ragLastResult = writable({
    query: '',
    results: [] as { content: string, score: number, source: string }[]
})
export const selIdState = $state({
    selId: -1
})

let storesRuntimeInitialized = false
let customCssUnsubscribe: (() => void) | null = null

function applyCustomCss(css: string) {
    if (typeof document === 'undefined') {
        return
    }
    const q = document.querySelector('#customcss')
    if(q){
        q.textContent = css
    }
    else{
        const s = document.createElement('style')
        s.id = 'customcss'
        s.textContent = css
        document.body.appendChild(s)
    }
}

export function initStoresRuntime() {
    if (storesRuntimeInitialized || typeof window === 'undefined') {
        return
    }
    storesRuntimeInitialized = true
    attachWindowSizeListener()
    if (!customCssUnsubscribe) {
        customCssUnsubscribe = CustomCSSStore.subscribe(applyCustomCss)
    }
}

export function disposeStoresRuntime() {
    if (!storesRuntimeInitialized) {
        return
    }
    storesRuntimeInitialized = false
    detachWindowSizeListener()
    customCssUnsubscribe?.()
    customCssUnsubscribe = null
}

export function createSimpleCharacter(char:character|groupChat){
    if((!char) || char.type === 'group'){
        return null
    }

    const simpleChar:simpleCharacterArgument = {
        type: "simple",
        customscript: char.customscript,
        chaId: char.chaId,
        additionalAssets: char.additionalAssets,
        virtualscript: char.virtualscript,
        emotionImages: char.emotionImages,
        triggerscript: char.triggerscript,
    }

    return simpleChar

}

if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        disposeStoresRuntime()
    })
}

export const DBState = $state({
    db: {} as unknown as Database
});

$effect.root(() => {
    $effect(() => {
    });
});

export const LoadingStatusState = $state({
    text: '',
})

export const QuickSettings = $state({
    open: false,
    index: 0
})

export const pluginAlertModalStore = $state({
    open: false,
    errors: [] as PluginSafetyErrors[]
})

export const disableHighlight = writable(true)

export type MenuDef = {
    name: string,
    icon: string,
    iconType:'html'|'img'|'none',
    callback: (...args: unknown[]) => unknown,
    id: string,
}

export const additionalSettingsMenu = $state([] as MenuDef[])
export const additionalFloatingActionButtons = $state([] as MenuDef[])
export const additionalHamburgerMenu = $state([] as MenuDef[])
export const additionalChatMenu = $state([] as MenuDef[])
export const stateEditorActive = writable(false);
export const popupStore = $state({
    children: null as null | import("svelte").Snippet,
    mouseX: 0,
    mouseY: 0,
openId: 0,
})

//Set might be more ideal, however since Svelte doesn't support reactive Sets, using array for now
export const hotReloading = $state<string[]>([])

ReloadGUIPointer.subscribe(() => {
    ReloadChatPointer.set({})
    resetScriptCache()
})

$effect.root(() => {
    selectedCharID.subscribe((v) => {
        selIdState.selId = v

        if (DBState?.db?.characters?.[selIdState.selId]) {
            if (DBState.db.hypaV3 && DBState.db.hypaV3Presets?.[DBState.db.hypaV3PresetId]?.settings?.alwaysToggleOn) {
                DBState.db.characters[selIdState.selId].supaMemory = true;
            }
        }
    })
    $effect(() => {
        $state.snapshot(DBState.db.modules)
        $state.snapshot({
            enabledModules: DBState?.db?.enabledModules,
            enabledModulesLength: DBState?.db?.enabledModules?.length,
            chatModulesLength: DBState?.db?.characters?.[selIdState.selId]?.chats?.[DBState?.db?.characters?.[selIdState.selId]?.chatPage]?.modules?.length,
            hideChatIcon: DBState?.db?.characters?.[selIdState.selId]?.hideChatIcon,
            backgroundHTML: DBState?.db?.characters?.[selIdState.selId]?.backgroundHTML,
            moduleIntergration: DBState?.db?.moduleIntergration
        })
        moduleUpdate()
    })
})
