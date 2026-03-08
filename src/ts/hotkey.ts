import { get } from "svelte/store"
import { alertMd, alertSelect, alertToast, alertWait, doingAlert, alertRequestLogs, alertError } from "./alert"
import { changeToPreset as changeToPreset2, getDatabase  } from "./storage/database.svelte"
import { alertStore, openPersonaList, openPresetList, QuickSettings, SafeModeStore, selectedCharID, settingsOpen } from "./stores.svelte"
import { language } from "src/lang"
import { updateTextThemeAndCSS } from "./gui/colorscheme"
import { defaultHotkeys } from "./defaulthotkeys"
import { isDoingChat, previewBody, sendChat } from "./process/index.svelte"
import { isEditableTouchTarget, shouldPreventHorizontalSwipe } from "./mobileGestureGuard"

const HOTKEY_INIT_FLAG = "__risu_hotkey_init__"

export function initHotkey(){
    if (typeof window === 'undefined') {
        return
    }
    const w = window as Window & { __risu_hotkey_init__?: boolean }
    if (w[HOTKEY_INIT_FLAG]) {
        return
    }
    w[HOTKEY_INIT_FLAG] = true

    document.addEventListener('keydown', async (ev) => {
        const activeElement = document.activeElement as HTMLElement | null
        if(
            !ev.ctrlKey &&
            !ev.altKey &&
            !ev.shiftKey &&
            activeElement &&
            (['INPUT', 'TEXTAREA'].includes(activeElement.tagName) ||
            activeElement.getAttribute('contenteditable'))
        ){
            return
        }


        const database = getDatabase()

        const hotKeys = database?.hotkeys ?? defaultHotkeys

        let hotkeyRan = false
        for(const hotkey of hotKeys){
            let hotKeyRanThisTime = true
            
            
            hotkey.ctrl = hotkey.ctrl ?? false
            hotkey.alt = hotkey.alt ?? false
            hotkey.shift = hotkey.shift ?? false

            if(hotkey.ctrl !== ev.ctrlKey){
                continue
            }
            if(hotkey.alt !== ev.altKey){
                continue
            }
            if(hotkey.shift !== ev.shiftKey){
                continue
            }
            if(hotkey.key.toLowerCase() !== ev.key.toLowerCase()){
                continue
            }
            if(!hotkey.ctrl && !hotkey.alt && !hotkey.shift){
                if(activeElement && ['INPUT', 'TEXTAREA'].includes(activeElement.tagName)){
                    continue
                }
            }
            switch(hotkey.action){
                case 'reroll':{
                    clickQuery('.button-icon-reroll')
                    break
                }
                case 'unreroll':{
                    clickQuery('.button-icon-unreroll')
                    break
                }
                case 'translate':{
                    clickQuery('.button-icon-translate')
                    break
                }
                case 'remove':{
                    clickQuery('.button-icon-remove')
                    break
                }
                case 'edit':{
                    clickQuery('.button-icon-edit')
                    setTimeout(() => {
                        focusQuery('.message-edit-area')
                    }, 100)
                    break
                }
                case 'copy':{
                    clickQuery('.button-icon-copy')
                    break
                }
                case 'focusInput':{
                    focusQuery('.text-input-area')
                    break
                }
                case 'send':{
                    clickQuery('.button-icon-send')
                    break
                }
                case 'settings':{
                    settingsOpen.set(!get(settingsOpen))
                    break
                }
                case 'home':{
                    selectedCharID.set(-1)
                    break
                }
                case 'presets':{
                    openPresetList.set(!get(openPresetList))
                    break
                }
                case 'persona':{
                    openPersonaList.set(!get(openPersonaList))
                    break
                }
                case 'toggleCSS':{
                    SafeModeStore.set(!get(SafeModeStore))
                    updateTextThemeAndCSS()
                    break
                }
                case 'prevChar':{
                    const sorted = database.characters.map((v, i) => {
                        return {name: v.name, i}
                    }).sort((a, b) => a.name.localeCompare(b.name))
                    const currentIndex = sorted.findIndex(v => v.i === get(selectedCharID))
                    if(currentIndex <= 0){
                        return
                    }
                    selectedCharID.set(sorted[currentIndex - 1].i)
                    break
                }
                case 'nextChar':{
                    const sorted = database.characters.map((v, i) => {
                        return {name: v.name, i}
                    }).sort((a, b) => a.name.localeCompare(b.name))
                    const currentIndex = sorted.findIndex(v => v.i === get(selectedCharID))
                    if(currentIndex >= sorted.length - 1){
                        return
                    }
                    if(currentIndex < 0){
                        return
                    }
                    selectedCharID.set(sorted[currentIndex + 1].i)
                    break
                }
                case 'quickMenu':{
                    quickMenu()
                    break
                }
                case 'previewRequest':{
                    if(get(isDoingChat)){
                        return false
                    }
                    if(get(selectedCharID) === -1){
                        return false
                    }
                    alertWait("Loading...")
                    ev.preventDefault()
                    ev.stopPropagation()
                    try{
                        await sendChat(-1, {
                            previewPrompt: true
                        })
                        if(!previewBody || previewBody.trim() === ''){
                            throw new Error('Preview returned empty response.')
                        }
                        let md = ''
                        md += '### Prompt\n'
                        md += '```json\n' + JSON.stringify(JSON.parse(previewBody), null, 2).replaceAll('```', '\\`\\`\\`') + '\n```\n'
                        alertMd(md)
                    }catch (err){
                        alertError(`Preview failed: ${err?.message ?? err}`)
                    }finally{
                        isDoingChat.set(false)
                    }
                    return
                }
                case 'toggleLog':{
                    alertRequestLogs()
                    break
                }
                case 'quickSettings':{
                    QuickSettings.open = !QuickSettings.open
                    QuickSettings.index = 0
                    break
                }
                case 'scrollToActiveChar':{
                    if(database.enableScrollToActiveChar !== false){
                        window.dispatchEvent(new CustomEvent('scrollToActiveCharacter'))
                    }
                    break
                }
                default:{
                    hotKeyRanThisTime = false
                }
            }

            if(hotKeyRanThisTime){
                hotkeyRan = true
                break
            }
        }

        if(hotkeyRan){
            ev.preventDefault()
            ev.stopPropagation()
            return
        }


        if(ev.ctrlKey){
            switch (ev.key){
                case "1":{
                    changeToPreset(0)
                    ev.preventDefault()
                    ev.stopPropagation()
                    break
                }
                case "2":{
                    changeToPreset(1)
                    ev.preventDefault()
                    ev.stopPropagation()
                    break
                }
                case "3":{
                    changeToPreset(2)
                    ev.preventDefault()
                    ev.stopPropagation()
                    break
                }
                case "4":{
                    changeToPreset(3)
                    ev.preventDefault()
                    ev.stopPropagation()
                    break
                }
                case "5":{
                    changeToPreset(4)
                    ev.preventDefault()
                    ev.stopPropagation()
                    break
                }
                case "6":{
                    changeToPreset(5)
                    ev.preventDefault()
                    ev.stopPropagation()
                    break
                }
                case "7":{
                    changeToPreset(6)
                    ev.preventDefault()
                    ev.stopPropagation()
                    break
                }
                case "8":{
                    changeToPreset(7)
                    ev.preventDefault()
                    ev.stopPropagation()
                    break
                }
                case "9":{
                    changeToPreset(8)
                    ev.preventDefault()
                    ev.stopPropagation()
                    break
                }
            }
        }
        if(ev.key === 'Escape'){
            if(doingAlert()){
                alertToast('Alert Closed')
            }
            if(get(settingsOpen)){
                settingsOpen.set(false)
            }
            ev.preventDefault()
        }
        if(ev.key === 'Enter'){
            const alertType = get(alertStore).type 
            if(alertType === 'ask' || alertType === 'normal' || alertType === 'error'){
                alertStore.set({
                    type: 'none',
                    msg: 'yes'
                })
            }
        }
    })


    let touchs = 0
    let touchStartTime = 0
    //check for triple touch
    document.addEventListener('touchstart', () => {
        touchs++
        if(touchs > 2){
            if(Date.now() - touchStartTime > 300){
                return
            }
            touchs = 0
            if(doingAlert()){
                return
            }
            quickMenu()
        }
        if(touchs === 1){
            touchStartTime = Date.now()
        }
    })
    document.addEventListener('touchend', () => {
        touchs = 0
    })
    
    let lastScrollTime = 0
    const SCROLL_COOLDOWN = 500
    
    document.addEventListener('dragover', (ev) => {
        if (ev.ctrlKey && !ev.shiftKey && !ev.altKey) {
            const types = ev.dataTransfer?.types || []
            const isCharacterDrag = types.includes('application/x-risu-internal')
            
            if (isCharacterDrag) {
                const db = getDatabase()
                if(db.enableScrollToActiveChar !== false){
                    const now = Date.now()
                    if (now - lastScrollTime > SCROLL_COOLDOWN) {
                        lastScrollTime = now
                        window.dispatchEvent(new CustomEvent('scrollToActiveCharacter'))
                    }
                }
            }
        }
    }, true)
}

export function resetHotkeyInitForTests() {
    if (typeof window === 'undefined') {
        return
    }
    const w = window as Window & { __risu_hotkey_init__?: boolean }
    delete w[HOTKEY_INIT_FLAG]
}

async function quickMenu(){
    const selStr = await alertSelect([
        language.presets,
        language.persona,
        language.cancel
    ])
    const sel = parseInt(selStr)
    if(sel === 0){
        openPresetList.set(!get(openPresetList))
    }
    if(sel === 1){
        openPersonaList.set(!get(openPersonaList))
    }
}

function clickQuery(query:string){
    const ele = document.querySelector(query) as HTMLElement
    if(ele){
        ele.click()
    }
}

function focusQuery(query:string){
    const ele = document.querySelector(query) as HTMLElement
    if(ele){
        ele.focus()
    }
}



let mobileGestureGuardInitialized = false

export function initMobileGesture(){
    if(mobileGestureGuardInitialized || typeof document === 'undefined'){
        return
    }
    mobileGestureGuardInitialized = true

    let startX = 0
    let startY = 0
    let startTarget: EventTarget | null = null
    let tracking = false

    document.addEventListener('touchstart', (event) => {
        if(event.touches.length !== 1 || isEditableTouchTarget(event.target)){
            tracking = false
            startTarget = null
            return
        }
        const touch = event.touches[0]
        if(!touch){
            tracking = false
            startTarget = null
            return
        }
        startX = touch.clientX
        startY = touch.clientY
        startTarget = event.target
        tracking = true
    }, { passive: true })

    document.addEventListener('touchmove', (event) => {
        if(!tracking || event.touches.length !== 1 || isEditableTouchTarget(event.target)){
            return
        }
        const touch = event.touches[0]
        if(!touch){
            return
        }
        if(shouldPreventHorizontalSwipe({
            startX,
            startY,
            currentX: touch.clientX,
            currentY: touch.clientY,
            viewportWidth: window.innerWidth,
            target: startTarget,
        })){
            // Prevent horizontal swipe gestures from switching browser/app tabs on touch devices.
            event.preventDefault()
        }
    }, { passive: false })

    document.addEventListener('touchend', () => {
        tracking = false
        startTarget = null
    }, { passive: true })

    document.addEventListener('touchcancel', () => {
        tracking = false
        startTarget = null
    }, { passive: true })
}

function changeToPreset(num:number){
    if(!doingAlert()){
        const db = getDatabase()
        const pres = db.botPresets
        if(pres.length > num){
            alertToast(`Changed to Preset: ${pres[num].name}`)
            changeToPreset2(num)
        }
    }
}
