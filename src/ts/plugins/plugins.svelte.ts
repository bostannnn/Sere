/* eslint-disable svelte/prefer-svelte-reactivity */

import { get, writable } from "svelte/store";
import { language } from "../../lang";
import { getCurrentCharacter, getDatabase, setDatabase, setDatabaseLite, type character, type groupChat } from "../storage/database.svelte";
import { alertConfirm, alertError } from "../alert";
import { selectSingleFile } from "../util";
import type { OpenAIChat } from "../process/index.svelte";
import { requestChatData } from "../process/request/request";
import { registerCommandHandler, unregisterCommandHandler, type CommandHandlerArg } from "../process/command";
import { fetchNative, globalFetch, readImage, saveAsset, toGetter } from "../globalApi.svelte";
import { postInlayAsset } from "../process/files/inlays";
import { DBState, hotReloading, selectedCharID, pluginProgressStore } from "../stores.svelte";
import type { ScriptMode } from "../process/scripts";
import { SafeDocument, SafeIdbFactory, SafeLocalStorage } from "./pluginSafeClass";
import { loadV3Plugins } from "./apiV3/v3.svelte";
import { pluginCodeTranspiler } from "./apiV3/transpiler";
import { isNodeServer } from "../platform";
import { fetchWithServerAuth } from "../storage/serverAuth";
const pluginLog = (..._args: unknown[]) => {};

export const customProviderStore = writable([] as string[])

interface ProviderPlugin {
    name: string
    displayName?: string
    script?: string
    fileId?: string
    arguments: { [key: string]: 'int' | 'string' | string[] }
    realArg: { [key: string]: number | string }
    version?: 1 | 2 | '2.1' | '3.0'
    customLink: ProviderPluginCustomLink[]
    argMeta: { [key: string]: {[key:string]:string} }
    versionOfPlugin?: string
    updateURL?: string
    enabled?: boolean
}
interface ProviderPluginCustomLink {
    link: string
    hoverText?: string
}

export type RisuPlugin = ProviderPlugin

type ServerPluginManifestEntry = {
    name: string
    fileId: string
    displayName?: string
    version?: 1 | 2 | '2.1' | '3.0'
    versionOfPlugin?: string
    updateURL?: string
    enabled?: boolean
    updatedAt: number
}

type ServerPluginManifest = {
    plugins: ServerPluginManifestEntry[]
    version?: number
    updatedAt?: number
}

function hashStringBase36(input: string) {
    let h = 2166136261 >>> 0
    for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i)
        h = Math.imul(h, 16777619)
    }
    return (h >>> 0).toString(36)
}

function toPluginFileId(name: string) {
    const normalized = String(name || '').trim().toLowerCase()
    const slug = normalized
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64)
    const safeSlug = slug || 'plugin'
    const hash = hashStringBase36(normalized || 'plugin')
    return `${safeSlug}-${hash}`
}

async function getServerPluginManifest(): Promise<{ manifest: ServerPluginManifest, etag: string | null }> {
    const res = await fetchWithServerAuth('/data/plugins/manifest', { cache: 'no-store' })
    if (res.status === 404) {
        return { manifest: { plugins: [] }, etag: null }
    }
    if (res.status < 200 || res.status >= 300) {
        throw new Error(`Failed to read plugin manifest (${res.status})`)
    }
    const etag = res.headers.get('etag')
    const json = await res.json()
    const manifest = (json && typeof json === 'object') ? json as ServerPluginManifest : { plugins: [] }
    manifest.plugins ??= []
    return { manifest, etag }
}

async function putServerPluginManifest(manifest: ServerPluginManifest, ifMatch: string | null) {
    const headers: Record<string, string> = {
        'content-type': 'application/json',
        'if-match': ifMatch ?? '*',
    }
    const res = await fetchWithServerAuth('/data/plugins/manifest', {
        method: 'PUT',
        headers,
        body: JSON.stringify(manifest),
    })
    if (res.status < 200 || res.status >= 300) {
        throw new Error(`Failed to write plugin manifest (${res.status})`)
    }
}

async function getServerPluginFileEtag(fileId: string): Promise<string | null> {
    const res = await fetchWithServerAuth(`/data/plugins/${encodeURIComponent(fileId)}`, { cache: 'no-store' })
    if (res.status === 404) return null
    if (res.status < 200 || res.status >= 300) {
        throw new Error(`Failed to read plugin file metadata (${res.status})`)
    }
    return res.headers.get('etag')
}

async function putServerPluginFile(fileId: string, code: string) {
    let etag = await getServerPluginFileEtag(fileId)
    let res = await fetchWithServerAuth(`/data/plugins/${encodeURIComponent(fileId)}`, {
        method: 'PUT',
        headers: {
            'if-match': etag ?? '*',
            'content-type': 'text/plain; charset=utf-8',
        },
        body: code,
    })
    if (res.status === 409 || res.status === 412) {
        etag = await getServerPluginFileEtag(fileId)
        res = await fetchWithServerAuth(`/data/plugins/${encodeURIComponent(fileId)}`, {
            method: 'PUT',
            headers: {
                'if-match': etag ?? '*',
                'content-type': 'text/plain; charset=utf-8',
            },
            body: code,
        })
    }
    if (res.status < 200 || res.status >= 300) {
        throw new Error(`Failed to write plugin file (${res.status})`)
    }
}

async function upsertPluginManifestEntry(entry: ServerPluginManifestEntry) {
    const initial = await getServerPluginManifest()
    let { manifest } = initial
    const { etag } = initial
    const plugins = Array.isArray(manifest.plugins) ? manifest.plugins : []
    const idx = plugins.findIndex((p) => p.name === entry.name)
    if (idx >= 0) {
        plugins[idx] = entry
    } else {
        plugins.push(entry)
    }
    manifest = { ...manifest, plugins }

    try {
        await putServerPluginManifest(manifest, etag)
    } catch {
        const latest = await getServerPluginManifest()
        const latestPlugins = Array.isArray(latest.manifest.plugins) ? latest.manifest.plugins : []
        const latestIdx = latestPlugins.findIndex((p) => p.name === entry.name)
        if (latestIdx >= 0) {
            latestPlugins[latestIdx] = entry
        } else {
            latestPlugins.push(entry)
        }
        await putServerPluginManifest({ ...latest.manifest, plugins: latestPlugins }, latest.etag)
    }
}

async function removePluginManifestEntry(pluginName: string, fileId?: string) {
    const buildManifestWithoutPlugin = (manifest: ServerPluginManifest) => {
        const plugins = (Array.isArray(manifest.plugins) ? manifest.plugins : []).filter((p) => {
            if (p.name === pluginName) return false
            if (fileId && p.fileId === fileId) return false
            return true
        })
        return { ...manifest, plugins }
    }

    const current = await getServerPluginManifest()
    try {
        await putServerPluginManifest(buildManifestWithoutPlugin(current.manifest), current.etag)
    } catch {
        const latest = await getServerPluginManifest()
        await putServerPluginManifest(buildManifestWithoutPlugin(latest.manifest), latest.etag)
    }
}

async function syncPluginToServerStorage(plugin: RisuPlugin) {
    if (!isNodeServer) return
    const fileId = plugin.fileId || toPluginFileId(plugin.name)
    await putServerPluginFile(fileId, plugin.script || '')
    await upsertPluginManifestEntry({
        name: plugin.name,
        fileId,
        displayName: plugin.displayName,
        version: plugin.version,
        versionOfPlugin: plugin.versionOfPlugin,
        updateURL: plugin.updateURL,
        enabled: plugin.enabled,
        updatedAt: Date.now(),
    })
}

async function syncAllPluginsToServerStorage(plugins: RisuPlugin[]) {
    if (!isNodeServer) return { plugins, changed: false as boolean }
    const migrated: RisuPlugin[] = []
    let changed = false
    for (const plugin of plugins) {
        const next = safeStructuredClone(plugin)
        const fileId = next.fileId || toPluginFileId(next.name)
        if (next.fileId !== fileId) {
            next.fileId = fileId
            changed = true
        }
        const hasInlineScript = typeof next.script === 'string' && next.script.length > 0
        if (hasInlineScript) {
            try {
                await syncPluginToServerStorage(next)
                delete next.script
                changed = true
            } catch (error) {
                pluginLog(`Failed to backfill plugin "${next?.name || 'unknown'}" to server storage:`, error)
            }
        }
        migrated.push(next)
    }
    return { plugins: migrated, changed }
}

export async function removePluginFromServerStorage(pluginName: string) {
    if (!isNodeServer) return
    const atomicDeleteRes = await fetchWithServerAuth(`/data/plugins/by-name/${encodeURIComponent(pluginName)}`, {
        method: 'DELETE',
    })
    if (atomicDeleteRes.status >= 200 && atomicDeleteRes.status < 300) {
        return
    }

    const db = getDatabase({ snapshot: true })
    const found = (Array.isArray(db?.plugins) ? db.plugins : []).find((p) => p?.name === pluginName)
    const fileId = found?.fileId || toPluginFileId(pluginName)
    let pluginDeleteError: Error | null = null
    let etag = await getServerPluginFileEtag(fileId)
    if (etag) {
        let res = await fetchWithServerAuth(`/data/plugins/${encodeURIComponent(fileId)}`, {
            method: 'DELETE',
            headers: {
                'if-match': etag,
            },
        })
        if (res.status === 409 || res.status === 412) {
            etag = await getServerPluginFileEtag(fileId)
            if (etag) {
                res = await fetchWithServerAuth(`/data/plugins/${encodeURIComponent(fileId)}`, {
                    method: 'DELETE',
                    headers: {
                        'if-match': etag,
                    },
                })
            }
        }
        if (res && res.status !== 404 && (res.status < 200 || res.status >= 300) && res.status !== 204) {
            pluginDeleteError = new Error(`Failed to delete plugin file (${res.status})`)
        }
    }
    await removePluginManifestEntry(pluginName, fileId)

    if (pluginDeleteError) {
        pluginLog(pluginDeleteError.message)
    }
}

async function readServerPluginFile(fileId: string): Promise<string | null> {
    const res = await fetchWithServerAuth(`/data/plugins/${encodeURIComponent(fileId)}`, { cache: 'no-store' })
    if (res.status === 404) return null
    if (res.status < 200 || res.status >= 300) {
        throw new Error(`Failed to read plugin file (${res.status})`)
    }
    return await res.text()
}

async function hydratePluginScripts(plugins: RisuPlugin[]): Promise<RisuPlugin[]> {
    if (!isNodeServer) {
        return plugins.filter((p) => typeof p?.script === 'string' && p.script.length > 0)
    }
    const hydrated: RisuPlugin[] = []
    for (const plugin of plugins) {
        const next = safeStructuredClone(plugin)
        const fileId = next.fileId || toPluginFileId(next.name)
        next.fileId = fileId
        if (!next.script) {
            try {
                next.script = await readServerPluginFile(fileId) || ''
            } catch (error) {
                pluginLog(`Failed to load plugin script "${next.name}" from file storage:`, error)
                next.script = ''
            }
        }
        if (typeof next.script === 'string' && next.script.length > 0) {
            hydrated.push(next)
        } else {
            pluginLog(`Skipping plugin "${next.name}" because no script is available in file storage.`)
        }
    }
    return hydrated
}

export async function createBlankPlugin(){
    await importPlugin(
`
//@name New Plugin
//@display-name New Plugin Display Name
//@api 3.0
//@arg example_arg string

Risuai.log("Hello from New Plugin!");
`.trim()
    )
}

const compareVersions = (v1: string, v2: string): 0|1|-1 => {
    const v1parts = v1.split('.').map(Number);
    const v2parts = v2.split('.').map(Number);
    const len = Math.max(v1parts.length, v2parts.length);
    for (let i = 0; i < len; i++) {
        const part1 = v1parts[i] || 0;
        const part2 = v2parts[i] || 0;
        if (part1 > part2) return 1;
        if (part1 < part2) return -1;
    }
    return 0;
}

const updateCache = new Map<string, { version: string, updateURL: string } | undefined>();

export const checkPluginUpdate = async (plugin: RisuPlugin) => {
    try {
        if(!plugin.updateURL){
            return
        }

        if(updateCache.has(plugin.name)){
            const cached = updateCache.get(plugin.name)
            if(compareVersions(cached.version, plugin.versionOfPlugin || '0.0.0') === 1){
                return cached
            }
        }

        const response = (await fetch(plugin.updateURL, {
            method: 'GET',
            headers: {
                'Range': 'bytes=0-512'
            }
        }))

        if(response.status >= 200 && response.status < 300){
            const text = await response.text()
            const versioRegex = /\/\/@version\s+([^\s]+)/;
            const match = text.match(versioRegex);
            if(match && match[1]){
                const latestVersion = match[1].trim()
                if(compareVersions(latestVersion, plugin.versionOfPlugin || '0.0.0') === 1){
                    updateCache.set(plugin.name, {
                        version: latestVersion,
                        updateURL: plugin.updateURL
                    })
                    return {
                        version: latestVersion,
                        updateURL: plugin.updateURL
                    }
                }
            }
        }
    } catch (error) {
        pluginLog('Failed to check plugin update:', error)
    }
}

export async function updatePlugin(plugin: RisuPlugin) {
    try {
        if(!plugin.updateURL){
            return false
        }
        const response = await fetch(plugin.updateURL)
        if(response.status >= 200 && response.status < 300){
            const jsFile = await response.text()
            await importPlugin(jsFile, {
                isUpdate: true,
                originalPluginName: plugin.name
            })
            return true
        }
    } catch (error) {
        pluginLog('Failed to update plugin:', error)
    }
    return false
}

export async function importPlugin(code:string|null = null, argu:{
    isUpdate?: boolean
    originalPluginName?: string
    isHotReload?: boolean
    isTypescript?: boolean
} = {}) {
    try {
        let jsFile = ''
        const db = getDatabase()
        const isUpdate = argu.isUpdate || false
        const originalPluginName = argu.originalPluginName || ''
        let isTypescript = argu.isTypescript || false
        
        if(!code){
            const f = await selectSingleFile(['js','ts'])
            if (!f) {
                return
            }
            if(f.name.endsWith('.ts')){
                isTypescript = true
            }
            //support utf-8 with BOM or without BOM
            jsFile = Buffer.from(f.data).toString('utf-8').replace(/^\uFEFF/gm, "");
        }
        else{
            jsFile = code
        }

        const splitedJs = jsFile.split('\n')
        let name = ''
        for (const line of splitedJs) {
            if (line.startsWith('//@name')) {
                name = line.slice(7).trim()
                break
            }
        }

        const showError = (msg: string) => {
            if(argu.isHotReload){
                pluginLog(`Hot-reload plugin "${name}" error: ${msg}`)
            }
            else{
                alertError(msg)
            }
        }

        let displayName: string = undefined
        const arg: { [key: string]: 'int' | 'string' | string[] } = {}
        const realArg: { [key: string]: number | string } = {}
        const argMeta: { [key: string]: {[key:string]:string} } = {}
        const customLink: ProviderPluginCustomLink[] = []
        let updateURL: string = ''
        let versionOfPlugin: string = '' //This is the version of the plugin itself, not the API version
        let apiVersion = '2.0'
        for (const line of splitedJs) {
            if (line.startsWith('//@name')) {
                const provied = line.slice(7)
                if (provied === '') {
                    showError('plugin name must be longer than 0, did you put it correctly?')
                    return
                }
                name = provied.trim()
            }
            if(line.startsWith('//@api')){
                const proviedVersions = line.slice(6).trim().split(' ')
                const supportedVersions = ['2.0','2.1','3.0']
                for(const ver of proviedVersions){
                    if(supportedVersions.includes(ver)){
                        apiVersion = ver
                        break
                    }
                    else{
                        pluginLog(`Plugin API version "${ver}" is not supported.`)
                    }
                }
            }
            if (line.startsWith('//@display-name')) {
                const provied = line.slice('//@display-name'.length + 1)
                if (provied === '') {
                    showError('plugin display name must be longer than 0, did you put it correctly?')
                    return
                }
                displayName = provied.trim()
            }

            if (line.startsWith('//@link')) {
                const link = line.split(" ")[1]
                if (!link || link === '') {
                    showError('plugin link is empty, did you put it correctly?')
                    return
                }
                if (!link.startsWith('https')) {
                    showError('plugin link must start with https, did you check it?')
                    return
                }
                const hoverText = line.split(' ').slice(2).join(' ').trim()
                if (hoverText === '') {
                    // OK, no hover text. It's fine.
                    customLink.push({
                        link: link,
                        hoverText: undefined
                    });
                }
                else
                    customLink.push({
                        link: link,
                        hoverText: hoverText || undefined
                    });
            }
            if (line.startsWith('//@risu-arg') || line.startsWith('//@arg')) {
                const provied = line.trim().split(' ')
                if (provied.length < 3) {
                    showError('plugin argument is incorrect, did you put space in argument name?')
                    return
                }
                const provKey = provied[1]

                if (provied[2] !== 'int' && provied[2] !== 'string') {
                    showError(`plugin argument type is "${provied[2]}", which is an unknown type.`)
                    return
                }
                if (provied[2] === 'int') {
                    arg[provKey] = 'int'
                    realArg[provKey] = 0
                }
                else if (provied[2] === 'string') {
                    arg[provKey] = 'string'
                    realArg[provKey] = ''
                }

                if(provied.length > 3){
                    const meta: {[key:string]:string} = {}
                    //Compatibility layer for unofficial meta
                    const metaStr = provied.slice(3).join(' ').replace(
                        /{{(.+?)(::?(.+?))?}}/g,
                        (a,g1:string,g2,g3:string) => {
                            pluginLog(g1,g3)
                            meta[g1] = g3 || '1'
                            return ''
                        }
                    ).trim()

                    if(metaStr){
                        meta['description'] = metaStr
                    }

                    argMeta[provKey] = meta
                }
            }

            if(line.startsWith('//@update-url')){
                updateURL = line.split(' ')[1]

                try {
                    const url = new URL(updateURL)
                    if(url.protocol !== 'https:'){
                        showError('plugin update URL must start with https, did you put it correctly?')
                        return
                    }
                } catch {
                    showError('plugin update URL is not a valid URL, did you put it correctly?')
                    return
                }
            }

            if(line.startsWith('//@version')){
                versionOfPlugin = line.split(' ').slice(1).join(' ').trim()

                const versionLocation = jsFile.indexOf('//@version')
                const numberOfBytesBefore = new TextEncoder().encode(jsFile.slice(0, versionLocation) + line).length
                if(numberOfBytesBefore > 500){
                    showError('plugin version declaration must be within the first 512 Bytes of the file for proper parsing. move //@version line to the top of the file.')
                    return
                }
            }
        }

        if (name.length === 0) {
            showError('plugin name not found, did you put it correctly?')
            return
        }

        if(updateURL && versionOfPlugin.length === 0){
            showError('plugin version not found, did you put it correctly? It is required when update URL is provided.')
            return
        }

        if(versionOfPlugin && compareVersions(versionOfPlugin, '0.0.1') === -1){
            showError('plugin version must be at least 0.0.1')
            return
        }

        
        if(isTypescript){
            try {
                jsFile = await pluginCodeTranspiler(jsFile)                
            } catch (error) {
                showError('Failed to transpile TypeScript code: ' + error.message)
            }
        }

        const apiInternalVersion = '3.0' as const

        if(apiVersion === '2.1' || apiVersion === '2.0'){
            showError('Legacy plugin APIs (2.0/2.1) are disabled for security. Please migrate this plugin to API version 3.0.')
            return
        }
        else if(apiVersion !== '3.0'){
            showError(`Unsupported plugin API version: ${apiVersion}. Please use API version 3.0.`)
            return
        }

        if(apiInternalVersion !== '3.0' && argu.isHotReload){
            showError('Only API version 3.0 plugins can be hot-reloaded.')
            return
        }
        
        const pluginData: RisuPlugin = {
            name: name,
            script: jsFile,
            fileId: toPluginFileId(name),
            realArg: realArg,
            arguments: arg,
            displayName: displayName,
            version: apiInternalVersion,
            customLink: customLink,
            argMeta: argMeta,
            versionOfPlugin: versionOfPlugin,
            updateURL: updateURL,
            enabled: true
        }

        db.plugins ??= []

        const oldPluginIndex = db.plugins.findIndex((p: RisuPlugin) => p.name === pluginData.name);

        if(originalPluginName && originalPluginName !== pluginData.name){
            showError(`When updating plugin "${originalPluginName}", the plugin name cannot be changed to "${pluginData.name}". Please keep the original name to update.`)
            return
        }


        if(!isUpdate && oldPluginIndex !== -1){
            const c = await alertConfirm(language.duplicatePluginFoundUpdateIt)
            if(!c){
                return
            }
        }

        if (isNodeServer) {
            try {
                await syncPluginToServerStorage(pluginData)
                // File-backed source of truth in node-server mode.
                delete pluginData.script
            } catch (error) {
                pluginLog('Failed to sync plugin to server storage:', error)
            }
        }

        if(oldPluginIndex !== -1){
            db.plugins[oldPluginIndex] = pluginData;
        }
        else if(!isUpdate || argu.isHotReload){
            db.plugins.push(pluginData)
        }

        if(argu.isHotReload && !hotReloading.includes(pluginData.name)){
            hotReloading.push(pluginData.name)
        }

        pluginLog(`Imported plugin: ${pluginData.name} (API v${apiVersion})`)
        setDatabaseLite(db)

        loadPlugins()
        
    } catch (error) {
        pluginLog(error)
        alertError(language.errors.noData)
    }
}

const _pluginTranslator = false

export async function loadPlugins() {
    pluginLog('Loading plugins...')
    const db = getDatabase()
    if (Array.isArray(db.plugins) && db.plugins.length > 0) {
        const migration = await syncAllPluginsToServerStorage(db.plugins)
        if (migration.changed) {
            db.plugins = migration.plugins
            setDatabaseLite(db)
        }
    }

    const enabledPlugins = safeStructuredClone(db.plugins).filter((p: RisuPlugin) => p.enabled)
    const hydratedEnabledPlugins = await hydratePluginScripts(enabledPlugins)
    const pluginV2 = hydratedEnabledPlugins.filter((a: RisuPlugin) => a.version === 2 || a.version === '2.1')
    const pluginV3 = hydratedEnabledPlugins.filter((a: RisuPlugin) => a.version === '3.0')

    await loadV2Plugin(pluginV2)
    await loadV3Plugins(pluginV3)
}

type PluginV2ProviderArgument = {
    prompt_chat: OpenAIChat[]
    frequency_penalty: number
    min_p: number
    presence_penalty: number
    repetition_penalty: number
    top_k: number
    top_p: number
    temperature: number
    mode: string
    max_tokens: number
}

type PluginV2ProviderOptions = {
    tokenizer?: string
    tokenizerFunc?: (content: string) => number[] | Promise<number[]>
}

type EditFunction = (content: string) => string | null | undefined | Promise<string | null | undefined>
type ReplacerFunction = (content: OpenAIChat[], type: string) => OpenAIChat[] | Promise<OpenAIChat[]>

export const pluginV2 = {
    providers: new Map<string, (arg: PluginV2ProviderArgument, abortSignal?: AbortSignal) => Promise<{ success: boolean, content: string | ReadableStream<string> }>>(),
    providerOptions: new Map<string, PluginV2ProviderOptions>(),
    editdisplay: new Set<EditFunction>(),
    editoutput: new Set<EditFunction>(),
    editprocess: new Set<EditFunction>(),
    editinput: new Set<EditFunction>(),
    replacerbeforeRequest: new Set<ReplacerFunction>(),
    replacerafterRequest: new Set<(content: string, type: string) => string | Promise<string>>(),
    unload: new Set<() => void | Promise<void>>(),
    loaded: false
}

export const allowedDbKeys = [
    'characters',
    'modules',
    'enabledModules',
    'moduleIntergration',
    'pluginV2',
    'personas',
    'plugins',
    'pluginCustomStorage',
    'temperature',
    'askRemoval',
    'maxContext',
    'maxResponse',
    'frequencyPenalty',
    'PresensePenalty',
    'theme',
    'textTheme',
    'lineHeight',
    'seperateModelsForAxModels',
    'seperateModels',
    'customCSS',
    'guiHTML',
    'colorSchemeName',
    'selectedPersona',
    'characterOrder'
]

export const getV2PluginAPIs = () => {
    return {
        risuFetch: globalFetch,
        nativeFetch: fetchNative,
        getArg: (arg: string) => {
            const db = getDatabase()
            const [name, realArg] = arg.split('::')
            for (const plugin of db.plugins) {
                if (plugin.name === name) {
                    return plugin.realArg[realArg]
                }
            }
        },
        getChar: () => {
            return getCurrentCharacter({ snapshot: true })
        },
        setChar: (char: character | groupChat) => {
            const db = getDatabase()
            const charid = get(selectedCharID)
            db.characters[charid] = char
            setDatabaseLite(db)
        },
        addProvider: (name: string, func: (arg: PluginV2ProviderArgument, abortSignal?: AbortSignal) => Promise<{ success: boolean, content: string }>, options?: PluginV2ProviderOptions) => {
            const provs = get(customProviderStore)
            provs.push(name)
            pluginV2.providers.set(name, func)
            pluginV2.providerOptions.set(name, options ?? {})
            customProviderStore.set(provs)
        },
        addRisuScriptHandler: (name: ScriptMode, func: EditFunction) => {
            if (pluginV2['edit' + name]) {
                pluginV2['edit' + name].add(func)
            }
            else {
                throw (`script handler named ${name} not found`)
            }
        },
        removeRisuScriptHandler: (name: ScriptMode, func: EditFunction) => {
            if (pluginV2['edit' + name]) {
                pluginV2['edit' + name].delete(func)
            }
            else {
                throw (`script handler named ${name} not found`)
            }
        },
        addRisuReplacer: (name: string, func: ReplacerFunction) => {
            if (pluginV2['replacer' + name]) {
                pluginV2['replacer' + name].add(func)
            }
            else {
                throw (`replacer handler named ${name} not found`)
            }
        },
        setPluginProgress: (active: boolean, label: string = '', color: string = '#22c55e') => {
            pluginProgressStore.set({ active, label, color })
        },
        registerCommandHandler: (name: string, func: (arg: CommandHandlerArg) => Promise<string | false | undefined> | string | false | undefined) => {
            registerCommandHandler(name, func)
        },
        unregisterCommandHandler: (name: string, func: (arg: CommandHandlerArg) => Promise<string | false | undefined> | string | false | undefined) => {
            unregisterCommandHandler(name, func)
        },
        runMainLLM: async (prompt: string, options?: {
            system?: string
            temperature?: number
            maxTokens?: number
        }) => {
            const formated: OpenAIChat[] = []
            if(options?.system){
                formated.push({
                    role: 'system',
                    content: options.system
                })
            }
            formated.push({
                role: 'user',
                content: prompt
            })
            const res = await requestChatData({
                formated,
                bias: {},
                currentChar: getCurrentCharacter({ snapshot: true }) as character,
                useStreaming: false,
                temperature: options?.temperature,
                maxTokens: options?.maxTokens,
            }, 'model', null)
            if(res.type === 'success'){
                return res.result
            }
            if(res.type === 'fail'){
                throw new Error(res.result)
            }
            throw new Error('Unexpected response type')
        },
        removeRisuReplacer: (name: string, func: ReplacerFunction) => {
            if (pluginV2['replacer' + name]) {
                pluginV2['replacer' + name].delete(func)
            }
            else {
                throw (`replacer handler named ${name} not found`)
            }
        },
        onUnload: (func: () => void | Promise<void>) => {
            pluginV2.unload.add(func)
        },
        setArg: (arg: string, value: string | number) => {
            const db = getDatabase();
            const [name, realArg] = arg.split("::");
            for (const plugin of db.plugins) {
                if (plugin.name === name) {
                    plugin.realArg[realArg] = value;
                }
            }
        },
        safeGlobalThis: {} as Record<string, unknown>,
        getSafeGlobalThis: () => {
            if(Object.keys(globalThis.__pluginApis__.safeGlobalThis).length > 0){
                return globalThis.__pluginApis__.safeGlobalThis;
            }
            //safeGlobalThis
            const keys = Object.keys(globalThis);
            const safeGlobal: Record<string, unknown> = {};
            const allowedKeys = [
                'console',
                'TextEncoder',
                'TextDecoder',
                'URL',
                'URLSearchParams',
            ]
            for (const key of keys) {
                if(allowedKeys.includes(key)){
                    safeGlobal[key] = (globalThis as Record<string, unknown>)[key];
                }
            }

            //compatibility layer with old unsafe APIs

            //from PBV2
            safeGlobal.showDirectoryPicker = window.showDirectoryPicker

            safeGlobal.DBState = {
                db: toGetter(
                    globalThis.__pluginApis__.getDatabase
                )
            }
            safeGlobal.setInterval = (...args: unknown[]) => {
                //@ts-expect-error spreading any[] into setInterval params causes type mismatch with TimerHandler signature
                return globalThis.setInterval(...args);
            }
            safeGlobal.setTimeout = (...args: unknown[]) => {
                //@ts-expect-error spreading any[] into setTimeout params causes type mismatch with TimerHandler signature
                return globalThis.setTimeout(...args);
            }
            safeGlobal.clearInterval = (...args: unknown[]) => {
                //@ts-expect-error spreading any[] into clearInterval - first arg should be number | undefined
                return globalThis.clearInterval(...args);
            }
            safeGlobal.clearTimeout = (...args: unknown[]) => {
                //@ts-expect-error spreading any[] into clearTimeout - first arg should be number | undefined
                return globalThis.clearTimeout(...args);
            }
            safeGlobal.alert = globalThis.alert;
            safeGlobal.confirm = globalThis.confirm;
            safeGlobal.prompt = globalThis.prompt;
            safeGlobal.innerWidth = window.innerWidth;
            safeGlobal.innerHeight = window.innerHeight;
            safeGlobal.getComputedStyle = window.getComputedStyle
            safeGlobal.navigator = window.navigator;
            safeGlobal.localStorage = globalThis.__pluginApis__.safeLocalStorage;
            safeGlobal.indexedDB = globalThis.__pluginApis__.safeIdbFactory;
            safeGlobal.__pluginApis__ = globalThis.__pluginApis__
            safeGlobal.Object = Object;
            safeGlobal.Array = Array;
            safeGlobal.String = String;
            safeGlobal.Number = Number;
            safeGlobal.Boolean = Boolean;
            safeGlobal.Math = Math;
            safeGlobal.Date = Date;
            safeGlobal.RegExp = RegExp;
            safeGlobal.Error = Error;
            safeGlobal.Function = globalThis.__pluginApis__.SafeFunction;
            safeGlobal.document = globalThis.__pluginApis__.safeDocument;
            safeGlobal.addEventListener = (...args: unknown[]) => {
                //@ts-expect-error spreading any[] into addEventListener - expects (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions)
                window.addEventListener(...args);
            }
            safeGlobal.removeEventListener = (...args: unknown[]) => {
                //@ts-expect-error spreading any[] into removeEventListener - expects (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions)
                window.removeEventListener(...args);
            }
            return safeGlobal;
        },
        safeLocalStorage: new SafeLocalStorage(),
        safeIdbFactory: SafeIdbFactory,
        safeDocument: SafeDocument,
        alertStore: {
            set: (_msg: string) => {}
        },
        apiVersion: "2.1",
        apiVersionCompatibleWith: ["2.0","2.1"],
        getDatabase: () => {
            const db = DBState?.db
            if(!db){
                return {}
            }
            return new Proxy(db, {
                get(target, prop) {
                    if (typeof prop === 'string' && allowedDbKeys.includes(prop)) {
                        return (target as unknown as Record<string, unknown>)[prop as string];
                    }
                    else if(target.pluginCustomStorage){
                        pluginLog('Getting custom db property', prop.toString());
                        return target.pluginCustomStorage[prop.toString()];
                    }
                    return undefined;
                },
                set(target, prop, value) {
                    if (typeof prop === 'string' && allowedDbKeys.includes(prop)) {
                        (target as unknown as Record<string, unknown>)[prop] = value;
                        return true;
                    }
                    else{
                        pluginLog('Setting custom db property', prop.toString(), value);
                        target.pluginCustomStorage ??= {}
                        target.pluginCustomStorage[prop.toString()] = value;
                        return true;
                    }
                },
                ownKeys(target) {
                    const keys = Reflect.ownKeys(target).filter(key => typeof key === 'string' && allowedDbKeys.includes(key));
                    if(target.pluginCustomStorage){
                        keys.push(...Object.keys(target.pluginCustomStorage));
                    }
                    return keys;
                },
                deleteProperty(target, prop) {
                    pluginLog('Attempt to delete db.' + String(prop) + ' denied in safe database proxy.');
                    return false;
                },
                getPrototypeOf(target) {
                    return Reflect.getPrototypeOf(target);
                },
            })
        },
        pluginStorage: {
            getItem: (key: string) => {
                const db = getDatabase({ snapshot: true });
                db.pluginCustomStorage ??= {}
                return db.pluginCustomStorage[key] || null;
            },
            setItem: (key: string, value: string) => {
                const db = getDatabase();
                db.pluginCustomStorage ??= {}
                db.pluginCustomStorage[key] = value;
            },
            removeItem: (key: string) => {
                const db = getDatabase();
                db.pluginCustomStorage ??= {}
                delete db.pluginCustomStorage[key];
            },
            clear: () => {
                const db = getDatabase();
                db.pluginCustomStorage = {};
            },
            key: (index: number) => {
                const db = getDatabase();
                db.pluginCustomStorage ??= {}
                const keys = Object.keys(db.pluginCustomStorage);
                return keys[index] || null;
            },
            keys: () => {
                const db = getDatabase();
                db.pluginCustomStorage ??= {}
                return Object.keys(db.pluginCustomStorage);
            },
            length: () => {
                const db = getDatabase();
                db.pluginCustomStorage ??= {}
                return Object.keys(db.pluginCustomStorage).length;
            }
        },
        setDatabaseLite: (newDb: Record<string, unknown>) => {
            const db = getDatabase();
            db.pluginCustomStorage ??= {}
            for (const key of Object.keys(newDb)) {
                if (allowedDbKeys.includes(key)) {
                    (db as unknown as Record<string, unknown>)[key] = newDb[key];
                }
                else{
                    db.pluginCustomStorage[key] = newDb[key];
                }
            }
            DBState.db = db;
        },
        setDatabase: (newDb: Record<string, unknown>) => {
            const db = getDatabase();
            db.pluginCustomStorage ??= {}
            for (const key of Object.keys(newDb)) {
                if (allowedDbKeys.includes(key)) {
                    (db as unknown as Record<string, unknown>)[key] = newDb[key];
                }
                else{
                    db.pluginCustomStorage[key] = newDb[key];
                }
            }
            setDatabase(db);
        },
        SafeFunction: new Proxy(Function, {
            construct(_target, _args) {
                return function() {
                    return globalThis.__pluginApis__.getSafeGlobalThis();
                }
            },
            
            //call too
            apply(_target, _thisArg, _args) {
                return function() {
                    return globalThis.__pluginApis__.getSafeGlobalThis();
                }
            }

        }),
        loadPlugins: loadPlugins,
        readImage: (path:string) => {
            if(path.startsWith('assets/')){
                //trim assets/ prefix temporarily
                path = path.slice(7);
            }
            if(path.includes('/') || path.includes('\\')){
                throw new Error("readImage path cannot contain '/' or '\\' for security reasons, except assets/ prefix.");
            }
            //re-add assets/ prefix
            return readImage('assets/' + path);
        },
        saveAsset: (data:Uint8Array) => {
            return saveAsset(data);
        },
        saveInlayAsset: async (data:Uint8Array, fileName: string = '') => {
            const name = fileName || `inlay-${Date.now()}.png`
            return await postInlayAsset({ name, data });
        },

    }
}

export async function loadV2Plugin(plugins: RisuPlugin[]) {

    if (pluginV2.loaded) {
        for (const unload of pluginV2.unload) {
            await unload()
        }

        pluginV2.providers.clear()
        pluginV2.editdisplay.clear()
        pluginV2.editoutput.clear()
        pluginV2.editprocess.clear()
        pluginV2.editinput.clear()
    }

    pluginV2.loaded = true

    globalThis.__pluginApis__ = getV2PluginAPIs()

    if (plugins.length > 0) {
        pluginLog(
            `[RisuAI Plugin] Skipping ${plugins.length} legacy plugin(s): API v2.0/v2.1 execution is disabled for security.`
        )
    }
}

export async function translatorPlugin(_text: string, _from: string, _to: string) {
    return false
}

export async function pluginProcess(_arg: {
    prompt_chat: OpenAIChat[],
    temperature: number,
    max_tokens: number,
    presence_penalty: number
    frequency_penalty: number
    bias: [string, number][]
} | Record<string, never>) {
    return {
        success: false,
        content: language.pluginProviderNotFound
    }
}
