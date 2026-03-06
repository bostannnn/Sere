import { v4 as uuidv4 } from 'uuid';
import { get } from "svelte/store";
import { setDatabase, getDatabase } from "./storage/database.svelte";
import { MobileGUI, selectedCharID, loadedStore, DBState, LoadingStatusState } from "./stores.svelte";
import { loadPlugins } from "./plugins/plugins.svelte";
import { alertError, alertMd, alertTOS, waitAlert } from "./alert";
import { defaultJailbreak, defaultMainPrompt, oldJailbreak, oldMainPrompt } from "./storage/defaultPrompts";
import { updateAnimationSpeed } from "./gui/animation";
import { updateColorScheme, updateTextThemeAndCSS } from "./gui/colorscheme";
import { language } from "src/lang";
import { startObserveDom, stopObserveDom } from "./observer.svelte";
import { updateGuisize } from "./gui/guisize";
import { updateLorebooks } from "./characters";
import { moduleUpdate } from "./process/modules";
import {
    saveDb,
    checkCharOrder
} from "./globalApi.svelte";
import { isInStandaloneMode, isNodeServer } from "./platform";
import { loadServerDatabase, startServerRealtimeSync } from "./storage/serverDb";
const bootstrapLog = (..._args: unknown[]) => {};
let errorHandlingInstalled = false
let installedErrorHandler: ((event: ErrorEvent) => void) | null = null
let installedRejectHandler: ((event: PromiseRejectionEvent) => void) | null = null
let domObserverInstalled = false

/**
 * Loads the application data.
 */
export async function loadData() {
    const loaded = get(loadedStore)
    if (!loaded) {
        try {
            if (!isNodeServer) {
                throw new Error('Server-only runtime is required.');
            }
            LoadingStatusState.text = "Loading Server Storage..."
            await loadServerDatabase()
            startServerRealtimeSync()
            LoadingStatusState.text = "Loading Plugins..."
            try {
                await loadPlugins()
            } catch { }
            try {
                if (isInStandaloneMode) {
                    await navigator.storage.persist()
                }
            } catch {
            }
            LoadingStatusState.text = "Checking For Format Update..."
            await checkNewFormat()

            LoadingStatusState.text = "Updating States..."
            updateColorScheme()
            updateTextThemeAndCSS()
            updateAnimationSpeed()
            updateHeightMode()
            updateErrorHandling()
            updateGuisize()
            if (!localStorage.getItem('nightlyWarned') && window.location.hostname === 'nightly.risuai.xyz') {
                alertMd(language.nightlyWarning)
                await waitAlert()
                //for testing, leave empty
                localStorage.setItem('nightlyWarned', '')
            }
            const shouldUseMobileLayout = window.innerWidth <= 900;
            MobileGUI.set(shouldUseMobileLayout)
            loadedStore.set(true)
            selectedCharID.set(-1)
            if (!domObserverInstalled) {
                startObserveDom()
                domObserverInstalled = true
            }
            assignIds()
            saveDb()
            moduleUpdate()
            if (import.meta.env.VITE_RISU_TOS === 'TRUE') {
                alertTOS().then((a) => {
                    if (a === false) {
                        location.reload()
                    }
                })
            }
        } catch (error) {
            alertError(error)
        }
    }
}

let touchHardeningInstalled = false

export function installTouchHardening() {
    if (touchHardeningInstalled || typeof document === "undefined") {
        return
    }
    touchHardeningInstalled = true

    document.documentElement.style.setProperty("overscroll-behavior-x", "none")
    document.body.style.setProperty("overscroll-behavior-x", "none")
}


/**
 * Updates the error handling by adding custom handlers for errors and unhandled promise rejections.
 */
function updateErrorHandling() {
    if (errorHandlingInstalled) {
        return
    }
    const isIgnorableBrowserNoise = (message: string) => {
        const normalized = (message || '').trim();
        if (!normalized) return false;
        return normalized.includes('ResizeObserver loop completed with undelivered notifications.')
            || normalized.includes('ResizeObserver loop limit exceeded');
    };

    const errorHandler = (event: ErrorEvent) => {
        // Resource load failures often emit ErrorEvent with null `error`.
        // Do not surface modal alerts for those non-actionable cases.
        if (!event.error) {
            const target = event.target as (EventTarget & { src?: string; href?: string; tagName?: string }) | null;
            const isResourceTarget = !!target && target !== window && target !== document;
            if (isResourceTarget) {
                bootstrapLog('[ErrorEvent] Resource load error', {
                    tag: target?.tagName ?? 'unknown',
                    src: target?.src ?? '',
                    href: target?.href ?? '',
                    message: event.message ?? '',
                });
                return;
            }

            const fallback = (event.message ?? '').trim();
            if (isIgnorableBrowserNoise(fallback)) {
                bootstrapLog('[ErrorEvent] Ignored browser noise', { message: fallback });
                return;
            }
            if (fallback === 'Script error.') {
                bootstrapLog('[ErrorEvent] Ignored cross-origin script error', {
                    message: fallback,
                    filename: event.filename ?? '',
                });
                return;
            }
            if (fallback) {
                bootstrapLog(fallback, event);
                alertError(fallback);
                return;
            }

            bootstrapLog('[ErrorEvent] Missing error payload', event);
            return;
        }

        bootstrapLog(event.error);
        alertError(event.error);
    };
    const rejectHandler = (event: PromiseRejectionEvent) => {
        if (event.reason == null || event.reason === '') {
            bootstrapLog('[UnhandledRejection] Missing rejection reason', event);
            return;
        }
        if (typeof event.reason === 'string' && isIgnorableBrowserNoise(event.reason)) {
            bootstrapLog('[UnhandledRejection] Ignored browser noise', { message: event.reason });
            return;
        }
        bootstrapLog(event.reason);
        alertError(event.reason);
    };
    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', rejectHandler);
    installedErrorHandler = errorHandler
    installedRejectHandler = rejectHandler
    errorHandlingInstalled = true
}

function clearErrorHandling() {
    if (!errorHandlingInstalled || !installedErrorHandler || !installedRejectHandler) {
        return
    }
    window.removeEventListener('error', installedErrorHandler)
    window.removeEventListener('unhandledrejection', installedRejectHandler)
    installedErrorHandler = null
    installedRejectHandler = null
    errorHandlingInstalled = false
}

if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        clearErrorHandling()
        stopObserveDom()
        domObserverInstalled = false
    })
}

/**
 * Updates the height mode of the document based on the value stored in the database.
 */
function updateHeightMode() {
    const db = getDatabase()
    const root = document.querySelector(':root') as HTMLElement;
    switch (db.heightMode) {
        case 'auto':
            root.style.setProperty('--risu-height-size', '100%');
            break
        case 'vh':
            root.style.setProperty('--risu-height-size', '100vh');
            break
        case 'dvh':
            root.style.setProperty('--risu-height-size', '100dvh');
            break
        case 'lvh':
            root.style.setProperty('--risu-height-size', '100lvh');
            break
        case 'svh':
            root.style.setProperty('--risu-height-size', '100svh');
            break
        case 'percent':
            root.style.setProperty('--risu-height-size', '100%');
            break
    }
}

/**
 * Checks and updates the database format to the latest version.
 */
async function checkNewFormat(): Promise<void> {
    const db = getDatabase();

    // Check data integrity
    db.characters = db.characters.map((v) => {
        if (!v) {
            return null;
        }
        v.chaId ??= uuidv4();
        v.type ??= 'character';
        v.chatPage ??= 0;
        v.chats ??= [];
        v.customscript ??= [];
        v.firstMessage ??= '';
        v.globalLore ??= [];
        v.name ??= '';
        v.viewScreen ??= 'none';
        v.emotionImages = v.emotionImages ?? [];

        if (v.type === 'character') {
            v.bias ??= [];
            v.characterVersion ??= '';
            v.creator ??= '';
            v.desc ??= '';
            v.utilityBot ??= false;
            v.tags ??= [];
            v.systemPrompt ??= '';
            v.scenario ??= '';
        }
        return v;
    }).filter((v) => {
        return v !== null;
    });

    db.modules = (db.modules ?? []).map((v) => {
        if (v?.lorebook) {
            v.lorebook = updateLorebooks(v.lorebook);
        }
        return v
    }).filter((v) => {
        return v !== null && v !== undefined;
    });

    db.personas = (db.personas ?? []).map((v) => {
        v.id ??= uuidv4()
        return v
    }).filter((v) => {
        return v !== null && v !== undefined;
    });

    if (!db.formatversion) {
        function checkClean(data: string) {

            if (data.startsWith('assets') || (data.length < 3)) {
                return data
            }
            else {
                const d = 'assets/' + (data.replace(/\\/g, '/').split('assets/')[1])
                if (!d) {
                    return data
                }
                return d;
            }
        }

        db.customBackground = checkClean(db.customBackground);
        db.userIcon = checkClean(db.userIcon);

        for (let i = 0; i < db.characters.length; i++) {
            if (db.characters[i].image) {
                db.characters[i].image = checkClean(db.characters[i].image!);
            }
            if (db.characters[i].emotionImages) {
                for (let i2 = 0; i2 < db.characters[i].emotionImages.length; i2++) {
                    if (db.characters[i].emotionImages[i2] && db.characters[i].emotionImages[i2].length >= 2) {
                        db.characters[i].emotionImages[i2][1] = checkClean(db.characters[i].emotionImages[i2][1]);
                    }
                }
            }
        }

        db.formatversion = 2;
    }
    if (db.formatversion < 3) {
        db.formatversion = 3;
    }
    if (db.formatversion < 4) {
        //migration removed due to issues
        db.formatversion = 4;
    }
    if (db.formatversion < 5) {
        if (db.loreBookToken < 8000) {
            db.loreBookToken = 8000;
        }
        db.formatversion = 5;
    }
    if (!db.characterOrder) {
        db.characterOrder = [];
    }
    if (db.mainPrompt === oldMainPrompt) {
        db.mainPrompt = defaultMainPrompt;
    }
    if (db.jailbreak === oldJailbreak) {
        db.jailbreak = defaultJailbreak;
    }
    for (let i = 0; i < db.characters.length; i++) {
        const trashTime = db.characters[i].trashTime;
        const targetTrashTime = trashTime ? trashTime + 1000 * 60 * 60 * 24 * 3 : 0;
        if (trashTime && targetTrashTime < Date.now()) {
            db.characters.splice(i, 1);
            i--;
        }
    }
    setDatabase(db);
    checkCharOrder();
}

/**
 * Assigns unique IDs to characters and chats.
 */
function assignIds() {
    if (!DBState?.db?.characters) {
        return
    }
    const assignedIds = new Set<string>()
    for (let i = 0; i < DBState.db.characters.length; i++) {
        const cha = DBState.db.characters[i]
        if (!cha.chaId) {
            cha.chaId = uuidv4()
        }
        if (assignedIds.has(cha.chaId)) {
            bootstrapLog(`Duplicate chaId found: ${cha.chaId}. Assigning new ID.`);
            cha.chaId = uuidv4();
        }
        assignedIds.add(cha.chaId)
        for (let i2 = 0; i2 < cha.chats.length; i2++) {
            const chat = cha.chats[i2]
            if (!chat.id) {
                chat.id = uuidv4()
            }
            if (assignedIds.has(chat.id)) {
                bootstrapLog(`Duplicate chat ID found: ${chat.id}. Assigning new ID.`);
                chat.id = uuidv4();
            }
            assignedIds.add(chat.id)
        }
    }
}
