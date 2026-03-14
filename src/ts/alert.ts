import { get, writable } from "svelte/store"
import { sleep } from "./util"
import { language } from "../lang"
import { isNodeServer } from "src/ts/platform"
import { getDatabase, type MessageGenerationInfo } from "./storage/database.svelte"
import { alertStore as alertStoreImported } from "./stores.svelte"
const alertLog = (..._args: unknown[]) => {};

export interface alertData{
    type: 'error'|'normal'|'none'|'ask'|'wait'|'selectChar'
            |'input'|'toast'|'wait2'|'markdown'|'select'|'login'
            |'tos'|'cardexport'|'requestdata'|'addchar'|'selectModule'
            |'chatOptions'|'pukmakkurit'|'branches'|'progress'|'requestlogs',
    msg: string,
    submsg?: string
    datalist?: [string, string][],
    stackTrace?: string;
    defaultValue?: string
}

type AlertGenerationInfoStoreData = {
    genInfo: MessageGenerationInfo,
    idx: number
}
export const alertGenerationInfoStore = writable<AlertGenerationInfoStoreData | null>(null)
export const alertStore = {
    set: (d:alertData) => {
        alertStoreImported.set(d)
    }
}

export function alertError(msg: unknown) {
    alertLog(msg)
    const db = getDatabase()

    let stackTrace: string | undefined = undefined; 

    let normalized = ''
    if (typeof msg === 'string') {
        normalized = msg
    } else if (msg instanceof Error) {
        stackTrace = msg.stack
        normalized = msg.message || msg.name || 'Unknown error'
    } else if (msg == null) {
        normalized = 'Unknown error'
    } else {
        try {
            normalized = JSON.stringify(msg)
        } catch {
            normalized = String(msg)
        }
    }

    normalized = normalized.trim()
    if (!normalized) {
        normalized = 'Unknown error'
    }

    const ignoredErrors = [
        '{}'
    ]

    if(ignoredErrors.includes(normalized)){
        return
    }

    let submsg = ''

    //check if it's a known error
    if(normalized.includes('Failed to fetch') || normalized.includes("NetworkError when attempting to fetch resource.")){
        submsg =    db.usePlainFetch ? language.errors.networkFetchPlain :
                    (!isNodeServer) ? language.errors.networkFetchWeb : language.errors.networkFetch
    }

    alertStoreImported.set({
        'type': 'error',
        'msg': normalized,
        'submsg': submsg,
        'stackTrace': stackTrace
    })
}

export async function waitAlert(){
    while(true){
        if (get(alertStoreImported).type === 'none'){
            break
        }
        await sleep(10)
    }
}

export function alertNormal(msg:string){
    alertStoreImported.set({
        'type': 'normal',
        'msg': msg
    })
}

export async function alertNormalWait(msg:string){
    alertStoreImported.set({
        'type': 'normal',
        'msg': msg
    })
    await waitAlert()
}

export async function alertAddCharacter() {
    alertStoreImported.set({
        'type': 'addchar',
        'msg': language.addCharacter
    })
    await waitAlert()

    return get(alertStoreImported).msg
}

export async function alertChatOptions() {
    alertStoreImported.set({
        'type': 'chatOptions',
        'msg': language.chatOptions
    })
    await waitAlert()

    return parseInt(get(alertStoreImported).msg)
}

export async function alertSelect(msg:string[], display?:string){
    const message = display !== undefined ? `__DISPLAY__${display}||${msg.join('||')}` : msg.join('||')
    alertStoreImported.set({
        'type': 'select',
        'msg': message
    })

    await waitAlert()

    return get(alertStoreImported).msg
}

export async function alertErrorWait(msg:string){
    alertStoreImported.set({
        'type': 'wait2',
        'msg': msg
    })
    await waitAlert()
}

export function alertMd(msg:string){
    alertStoreImported.set({
        'type': 'markdown',
        'msg': msg
    })
}

export function doingAlert(){
    return get(alertStoreImported).type !== 'none' && get(alertStoreImported).type !== 'toast' && get(alertStoreImported).type !== 'wait'
}

export function alertToast(msg:string){
    alertStoreImported.set({
        'type': 'toast',
        'msg': msg
    })
}

export function alertWait(msg:string){
    alertStoreImported.set({
        'type': 'wait',
        'msg': msg
    })

}


export function alertClear(){
    alertStoreImported.set({
        'type': 'none',
        'msg': ''
    })
}

export async function alertSelectChar(){
    alertStoreImported.set({
        'type': 'selectChar',
        'msg': ''
    })

    await waitAlert()

    return get(alertStoreImported).msg
}

export async function alertConfirm(msg:string){

    alertStoreImported.set({
        'type': 'ask',
        'msg': msg
    })

    await waitAlert()

    return get(alertStoreImported).msg === 'yes'
}

export async function alertCardExport(type:string = ''){

    alertStoreImported.set({
        'type': 'cardexport',
        'msg': '',
        'submsg': type
    })

    await waitAlert()

    return JSON.parse(get(alertStoreImported).msg) as {
        format: "png" | "json" | "charx" | "charxJpeg",
        includeChats: boolean,
        includeMemories: boolean,
        includeEvolution: boolean,
        cancelled: boolean,
    }
}

export async function alertTOS(){

    if(localStorage.getItem('tos2') === 'true'){
        return true
    }

    alertStoreImported.set({
        'type': 'tos',
        'msg': 'tos'
    })

    await waitAlert()

    if(get(alertStoreImported).msg === 'yes'){
        localStorage.setItem('tos2', 'true')
        return true
    }

    return false
}

export async function alertInput(msg:string, datalist?:[string, string][], defaultValue?:string) {

    alertStoreImported.set({
        'type': 'input',
        'msg': msg,
        'datalist': datalist ?? [],
        'defaultValue': defaultValue ?? ''
    })

    await waitAlert()

    return get(alertStoreImported).msg
}

export async function alertModuleSelect(){

    alertStoreImported.set({
        'type': 'selectModule',
        'msg': ''
    })

    while(true){
        if (get(alertStoreImported).type === 'none'){
            break
        }
        await sleep(20)
    }

    return get(alertStoreImported).msg
}

export function alertRequestData(info:AlertGenerationInfoStoreData){
    alertGenerationInfoStore.set(info)
    alertStoreImported.set({
        'type': 'requestdata',
        'msg': info.genInfo.generationId ?? 'none'
    })
}

export function alertRequestLogs(source: 'client' | 'server' = 'client'){
    alertStoreImported.set({
        'type': 'requestlogs',
        'msg': source
    })
}
