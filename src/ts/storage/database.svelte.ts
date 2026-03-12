/* eslint-disable svelte/prefer-svelte-reactivity */
import { get } from 'svelte/store';
import { checkNullish, selectSingleFile } from '../util';
import { changeLanguage, language } from '../../lang';
import { downloadFile, saveAsset as saveImageGlobal } from '../globalApi.svelte';
import { defaultAutoSuggestPrompt, normalizePromptTemplate } from './defaultPrompts';
import { alertNormal } from '../alert';
import { prebuiltNAIpresets } from '../process/templates/templates';
import { defaultColorScheme } from '../gui/colorscheme';
import { LLMFormat } from '../model/modellist';
import type { HypaModel } from '../process/memory/hypamemory';
import { createMemoryPreset } from '../process/memory/memory'
import {
    setCharacterMemoryPromptOverride,
    setChatMemoryData,
    setDbMemoryDebug,
    setDbMemoryEnabled,
    setDbMemoryPresetId,
    setDbMemoryPresets,
    setDbMemorySettings,
} from '../process/memory/storage';
import { defaultHotkeys } from '../defaulthotkeys';
import { DBState, selectedCharID } from '../stores.svelte';
import { DEFAULT_EMOTION_PROMPT } from '../process/emotion/defaultPrompt';
import {
    ensureCharacterEvolution,
    ensureDatabaseEvolutionDefaults,
} from '../characterEvolution';
import type {
    Chat,
    Database,
    Message,
    botPreset,
    character,
    groupChat,
} from './database.types';
import {
    DEFAULT_GLOBAL_RAG_SETTINGS,
    DEFAULT_OPENROUTER_REQUEST_MODEL,
    ensureComfyCommanderStateShape,
    normalizeChatBackground,
    resolveChatBackgroundMode,
    resolveGlobalRagSettings,
    stripRemovedProviderFields,
    type ChatBackgroundMode,
} from './database.normalizers';
import {
    applyImportedPresetToDatabase,
    buildDownloadPresetForExport,
    changeToPresetInDatabase,
    copyPresetInDatabase,
    decodeImportedPresetFile,
    encodeDownloadPresetBuffer,
    presetTemplate,
    saveCurrentPresetInDatabase,
    setPresetOnDatabase,
    type PresetDownloadType,
} from './database.presets';
import { isNodeServer } from "src/ts/platform"
const dbStorageLog = (..._args: unknown[]) => {};

export {
    presetTemplate,
    DEFAULT_GLOBAL_RAG_SETTINGS,
    resolveChatBackgroundMode,
    resolveGlobalRagSettings,
};
export type { ChatBackgroundMode };
export type * from './database.types';

//APP_VERSION_POINT is to locate the app version in the database file for version bumping
export const appVer = "2026.1.184" //<APP_VERSION_POINT>
export const webAppSubVer = ''

const emotionEmbeddingModels: Set<HypaModel> = new Set([
    'MiniLM',
    'MiniLMGPU',
    'nomic',
    'nomicGPU',
    'bgeSmallEn',
    'bgeSmallEnGPU',
    'bgeLargeEn',
    'bgeLargeEnGPU',
    'bgem3',
    'bgem3GPU',
    'multiMiniLM',
    'multiMiniLMGPU',
    'bgeM3Ko',
    'bgeM3KoGPU',
    'openai3small',
    'openai3large',
    'ada',
    'custom'
])

export function setDatabase(data:Database){
    stripRemovedProviderFields(data as unknown as Record<string, unknown>)
    if(checkNullish(data.characters)){
        data.characters = []
    }
    ensureDatabaseEvolutionDefaults(data)
    for (const char of data.characters) {
        ensureCharacterEvolution(char)
        setCharacterMemoryPromptOverride(
            char,
            char.memoryPromptOverride ?? char.hypaV3PromptOverride ?? { summarizationPrompt: '' }
        )
        if (!Array.isArray(char?.chats)) {
            continue
        }
        for (const chat of char.chats) {
            normalizeChatBackground(chat)
            setChatMemoryData(chat, chat.memoryData ?? chat.hypaV3Data)
        }
    }
    if(checkNullish(data.apiType)){
        data.apiType = 'gemini-3-flash-preview'
    }
    if(checkNullish(data.openAIKey)){
        data.openAIKey = ''
    }
    data.promptTemplate = normalizePromptTemplate(data.promptTemplate)
    if(checkNullish(data.temperature)){
        data.temperature = 80
    }
    if(checkNullish(data.maxContext)){
        data.maxContext = 4000
    }
    if(checkNullish(data.maxResponse)){
        data.maxResponse = 500
    }
    if(checkNullish(data.frequencyPenalty)){
        data.frequencyPenalty = 70
    }
    if(checkNullish(data.PresensePenalty)){
        data.PresensePenalty = 70
    }
    if(checkNullish(data.aiModel)){
        data.aiModel = 'gemini-3-flash-preview'
    }
    if(checkNullish(data.loreBookDepth)){
        data.loreBookDepth = 5
    }
    if(checkNullish(data.loreBookToken)){
        data.loreBookToken = 800
    }
    if(checkNullish(data.username)){
        data.username = 'User'
    }
    if(checkNullish(data.userIcon)){
        data.userIcon = ''
    }
    if (checkNullish(data.userNote)){
        data.userNote = ''
    }
    if(checkNullish(data.forceReplaceUrl)){
        data.forceReplaceUrl = ''
    }
    if(checkNullish(data.language)){
        data.language = 'en'
    }
    else if(data.language !== 'en'){
        data.language = 'en'
    }
    if(checkNullish(data.swipe)){
        data.swipe = true
    }
    if(checkNullish(data.translator)){
        data.translator = ''
    }
    if(checkNullish(data.translatorMaxResponse)){
        data.translatorMaxResponse = 1000
    }
    if(checkNullish(data.zoomsize)){
        data.zoomsize = 100
    }
    if(checkNullish(data.customBackground)){
        data.customBackground = ''
    }
    if(checkNullish(data.autoTranslate)){
        data.autoTranslate = false
    }
    if(checkNullish(data.fullScreen)){
        data.fullScreen = false
    }
    if(checkNullish(data.playMessage)){
        data.playMessage = false
    }
    if(checkNullish(data.iconsize)){
        data.iconsize = 100
    }
    if(checkNullish(data.theme)){
        data.theme = ''
    }
    const rawChatReadingMode = data.chatReadingMode as string | undefined
    if(rawChatReadingMode === 'focus' || rawChatReadingMode === 'normal'){
        data.chatReadingMode = rawChatReadingMode
    }
    else{
        data.chatReadingMode = 'normal'
    }
    if(checkNullish(data.subModel)){
        data.subModel = 'gemini-3-flash-preview'
    }
    if(checkNullish(data.waifuWidth)){
        data.waifuWidth = 100
    }
    if(checkNullish(data.waifuWidth2)){
        data.waifuWidth2 = 100
    }
    if(checkNullish(data.emotionPrompt)){
        data.emotionPrompt = ""
    }
    if(checkNullish(data.proxyKey)){
        data.proxyKey = ""
    }
    if(checkNullish(data.botPresets)){
        const defaultPreset = structuredClone(presetTemplate)
        defaultPreset.name = "Default"
        data.botPresets = [defaultPreset]
    }
    if(checkNullish(data.botPresetsId)){
        data.botPresetsId = 0
    }
    if(checkNullish(data.textTheme)){
        data.textTheme = "standard"
    }
    if(checkNullish(data.emotionPrompt2)){
        data.emotionPrompt2 = DEFAULT_EMOTION_PROMPT
    }
    if(checkNullish(data.requestRetrys)){
        data.requestRetrys = 2
    }
    if(checkNullish(data.useSayNothing)){
        data.useSayNothing = true
    }
    if(checkNullish(data.bias)){
        data.bias = []
    }
    if(checkNullish(data.showUnrecommended)){
        data.showUnrecommended = false
    }
    if(checkNullish(data.elevenLabKey)){
        data.elevenLabKey = ''
    }
    if(checkNullish(data.voicevoxUrl)){
        data.voicevoxUrl = ''
    }
    if(checkNullish(data.supaMemoryPrompt)){
        data.supaMemoryPrompt = ''
    }
    if(checkNullish(data.showMemoryLimit)){
        data.showMemoryLimit = false
    }
    if(checkNullish(data.showFirstMessagePages)){
        data.showFirstMessagePages = false
    }
    if(checkNullish(data.supaMemoryKey)){
        data.supaMemoryKey = ""
    }
    if(checkNullish(data.supaModelType)){
        data.supaModelType = "none"
    }
    if(checkNullish(data.askRemoval)){
        data.askRemoval = true
    }
    if(checkNullish(data.customTextTheme)){
        data.customTextTheme = {
            FontColorStandard: "#f8f8f2",
            FontColorBold: "#f8f8f2",
            FontColorItalic: "#8C8D93",
            FontColorItalicBold: "#8C8D93",
            FontColorQuote1: '#8BE9FD',
            FontColorQuote2: '#FFB86C'
        }
    }
    if(checkNullish(data.novelai)){
        data.novelai = {
            token: "",
            model: "clio-v1",
        }
    }
    if(checkNullish(data.loreBook)){
        data.loreBookPage = 0
        data.loreBook = [{
            name: "My First LoreBook",
            data: []
        }]
    }
    if(checkNullish(data.loreBookPage) || data.loreBook.length < data.loreBookPage){
        data.loreBookPage = 0
    }
    data.globalscript ??= []
    data.sendWithEnter ??= true
    data.autoSuggestPrompt ??= defaultAutoSuggestPrompt
    data.autoSuggestPrefix ??= ""
    data.OAIPrediction ??= ''
    data.autoSuggestClean ??= true
    data.imageCompression ??= true
    data.selectedPersona ??= 0
    data.personaPrompt ??= ''
    data.personas ??= [{
        name: data.username,
        personaPrompt: "",
        icon: data.userIcon,
        note: data.userNote,
        largePortrait: false
    }]
    data.classicMaxWidth ??= false
    data.openrouterKey ??= ''
    data.openrouterRequestModel ??= DEFAULT_OPENROUTER_REQUEST_MODEL
    data.openrouterSubRequestModel ??= data.openrouterRequestModel
    data.NAIsettings ??= safeStructuredClone(prebuiltNAIpresets)
    data.assetWidth ??= -1
    data.animationSpeed ??= 0.4
    data.colorScheme ??= safeStructuredClone(defaultColorScheme)
    data.colorSchemeName ??= 'default'
    data.NAIsettings.starter ??= ""
    data.hypaModel ??= 'MiniLM'
    const rawEmotionProcesser = data.emotionProcesser as string | undefined
    if(checkNullish(rawEmotionProcesser)){
        data.emotionProcesser = 'submodel'
    }
    else if(rawEmotionProcesser === 'embedding'){
        data.emotionProcesser = 'MiniLM'
    }
    else if(rawEmotionProcesser === 'submodel'){
        data.emotionProcesser = 'submodel'
    }
    else if(emotionEmbeddingModels.has(rawEmotionProcesser as HypaModel)){
        data.emotionProcesser = rawEmotionProcesser as HypaModel
    }
    else{
        data.emotionProcesser = 'submodel'
    }
    data.translatorType ??= 'google'
    data.htmlTranslation ??= false
    data.deeplOptions ??= {
        key:'',
        freeApi: false
    }
    data.deeplXOptions ??= {
        url:'',
        token:''
    } 
    data.NAIadventure ??= false
    data.NAIappendName ??= true
    data.NAIsettings.cfg_scale ??= 1
    data.NAIsettings.mirostat_tau ??= 0
    data.NAIsettings.mirostat_lr ??= 1
    data.autofillRequestUrl ??= true
    data.customProxyRequestModel ??= ''
    data.generationSeed ??= -1
    data.newOAIHandle ??= true
    data.gptVisionQuality ??= 'low'
    data.huggingfaceKey ??= ''
    data.fishSpeechKey ??= ''
    data.presetRegex ??= []
    data.reverseProxyOobaArgs ??= {
        mode: 'instruct'
    }
    data.top_p ??= 1
    if(typeof(data.top_p) !== 'number'){
        //idk why type changes, but it does so this is a fix
        data.top_p = 1
    }
    //@ts-expect-error data.google has required fields (accessToken, projectId), but we use empty object as default and populate below
    data.google ??= {}
    data.google.accessToken ??= ''
    data.google.projectId ??= ''
    data.genTime ??= 1
    data.promptSettings ??= {
        assistantPrefill: '',
        postEndInnerFormat: '',
        sendChatAsSystem: false,
        sendName: false,
        utilOverride: false,
        customChainOfThought: false,
        maxThoughtTagDepth: -1
    }
    data.keiServerURL ??= ''
    data.top_k ??= 0
    data.promptSettings.maxThoughtTagDepth ??= -1
    data.openrouterFallback ??= true
    data.openrouterMiddleOut ??= false
    data.openrouterAllowReasoningOnlyForDeepSeekV32Speciale ??= false
    data.removePunctuationHypa ??= true
    data.memoryLimitThickness ??= 1
    data.modules ??= []
    data.enabledModules ??= []
    data.additionalParams ??= []
    data.heightMode ??= 'normal'
    data.antiClaudeOverload ??= false
    data.maxSupaChunkSize ??= 1200
    data.ollamaURL ??= ''
    data.ollamaModel ??= ''
    data.autoContinueChat ??= false
    data.autoContinueMinTokens ??= 0
    data.repetition_penalty ??= 1
    data.min_p ??= 0
    data.top_a ??= 0
    data.customTokenizer ??= 'tik'
    data.instructChatTemplate ??= "chatml"
    // Migration: convert old string type into new provider object
    if (typeof data.openrouterProvider === 'string') {
        const oldProvider = data.openrouterProvider as unknown as string;
        data.openrouterProvider = {
            order: oldProvider ? [oldProvider] : [],
            only: [],
            ignore: []
        }
    }
    if (data.botPresets) {
        for (const preset of data.botPresets) {
            stripRemovedProviderFields(preset as unknown as Record<string, unknown>)
            preset.promptTemplate = normalizePromptTemplate(preset.promptTemplate)
            if (typeof preset.openrouterProvider === 'string') {
                const oldProvider = preset.openrouterProvider as unknown as string;
                preset.openrouterProvider = {
                    order: oldProvider ? [oldProvider] : [],
                    only: [],
                    ignore: []
                }
            }
        }
    }
    data.openrouterProvider ??= {
        order: [],
        only: [],
        ignore: []
    }
    data.useInstructPrompt ??= false
    data.textAreaSize ??= 0
    data.sideBarSize ??= 0
    data.textAreaTextSize ??= 0
    data.combineTranslation ??= false
    data.customPromptTemplateToggle ??= ''
    data.globalChatVariables ??= {}
    data.templateDefaultVariables ??= ''
    data.dallEQuality ??= 'standard'
    data.customTextTheme.FontColorQuote1 ??= '#8BE9FD'
    data.customTextTheme.FontColorQuote2 ??= '#FFB86C'
    data.font ??= 'default'
    data.customFont ??= ''
    data.lineHeight ??= 1.25
    data.stabilityModel ??= 'sd3-large'
    data.stabllityStyle ??= ''
    data.legacyTranslation ??= false
    data.comfyUiUrl ??= 'http://localhost:8188'
    data.comfyConfig ??= {
        workflow: '',
        posNodeID: '',
        posInputName: 'text',
        negNodeID: '',
        negInputName: 'text',
        timeout: 30
    }
    ensureComfyCommanderStateShape(data)
    data.hideApiKey ??= true
    data.unformatQuotes ??= false
    data.ttsAutoSpeech ??= false
    data.translatorInputLanguage ??= 'auto'
    data.falModel ??= 'fal-ai/flux/dev'
    data.falLoraScale ??= 1
    data.customCSS ??= ''
    data.strictJsonSchema ??= true
    data.statics ??= {
        messages: 0,
        imports: 0
    }
    data.customQuotes ??= false
    data.customQuotesData ??= ['“','”','‘','’']
    data.groupOtherBotRole ??= 'user'
    data.customGUI ??= ''
    data.customAPIFormat ??= LLMFormat.OpenAICompatible
    data.systemContentReplacement ??= `system: {{slot}}`
    data.systemRoleReplacement ??= 'user'
    data.seperateParametersEnabled ??= false
    data.seperateParameters ??= {
        memory: {},
        emotion: {},
        translate: {},
        otherAx: {}
    }
    data.customFlags ??= []
    data.enableCustomFlags ??= false
    data.assetMaxDifference ??= 4
    data.showSavingIcon ??= false
    data.banCharacterset ??= []
    data.showPromptComparison ??= false
    data.OaiCompAPIKeys ??= {}
    data.globalRagSettings = resolveGlobalRagSettings(data.globalRagSettings)
    data.reasoningEffort ??= 0
    const normalizedMemoryPresets = (data.memoryPresets ?? data.hypaV3Presets)?.length ? (data.memoryPresets ?? data.hypaV3Presets) : [
        createMemoryPreset("Default", {
            summarizationPrompt: data.supaMemoryPrompt ? data.supaMemoryPrompt : "",
            ...(data.memorySettings ?? data.hypaV3Settings)
        })
    ]
    const mappedMemoryPresets = normalizedMemoryPresets.map((preset, i) =>
        createMemoryPreset(
            preset.name || `Preset ${i + 1}`,
            preset.settings || {}
        )
    )
    for (const preset of mappedMemoryPresets) {
        // Periodic summarization is interval-driven; keep it enabled for migrated presets.
        preset.settings.periodicSummarizationEnabled = true
    }
    setDbMemoryPresets(data, mappedMemoryPresets)
    const normalizedMemoryPresetId = Math.min(
        Math.max(Number(data.memoryPresetId ?? data.hypaV3PresetId ?? 0) || 0, 0),
        Math.max(mappedMemoryPresets.length - 1, 0)
    )
    setDbMemoryPresetId(data, normalizedMemoryPresetId)
    setDbMemorySettings(
        data,
        mappedMemoryPresets[normalizedMemoryPresetId]?.settings
            ?? data.memorySettings
            ?? data.hypaV3Settings
            ?? createMemoryPreset('Default').settings
    )
    setDbMemoryDebug(data, data.memoryDebug ?? data.hypaV3Debug)
    // Keep runtime on the neutral memory contract while reading legacy fields during migration.
    setDbMemoryEnabled(data, data.memoryEnabled ?? data.hypaV3 ?? true)
    data.supaModelType = 'none'
    const legacyMemoryConfig = data as unknown as Record<string, unknown>
    delete legacyMemoryConfig.hypaMemoryKey
    delete legacyMemoryConfig.hypaMemory
    delete legacyMemoryConfig.memoryAlgorithmType
    delete legacyMemoryConfig.hanuraiEnable
    delete legacyMemoryConfig.hanuraiSplit
    delete legacyMemoryConfig.hanuraiTokens
    data.showDeprecatedTriggerV1 ??= false
    data.showDeprecatedTriggerV2 ??= false
    data.returnCSSError ??= true
    data.useExperimentalGoogleTranslator ??= false
    if(data.antiClaudeOverload){ //migration
        data.antiClaudeOverload = false
        data.antiServerOverloads = true
    }
    data.hypaCustomSettings = {
        url: data.hypaCustomSettings?.url ?? "",
        key: data.hypaCustomSettings?.key ?? "",
        model: data.hypaCustomSettings?.model ?? ""     
    }
    data.doNotChangeSeperateModels ??= false
    data.modelTools ??= []
    data.enableScrollToActiveChar ??= true
    
    // Merge existing hotkeys with new default hotkeys
    if (!data.hotkeys) {
        data.hotkeys = safeStructuredClone(defaultHotkeys)
    } else {
        const existingActions = new Set(data.hotkeys.map(h => h.action))
        const newHotkeys = defaultHotkeys.filter(h => !existingActions.has(h.action))
        if (newHotkeys.length > 0) {
            data.hotkeys.push(...safeStructuredClone(newHotkeys))
        }
    }
    
    // Remove scrollToActiveChar hotkey if feature is disabled
    if (data.enableScrollToActiveChar === false) {
        data.hotkeys = data.hotkeys.filter(h => h.action !== 'scrollToActiveChar')
    }
    
    data.fallbackModels ??= {
        memory: [],
        emotion: [],
        translate: [],
        otherAx: [],
        model: []
    }
    data.fallbackModels = {
        model: data.fallbackModels.model.filter((v) => v !== ''),
        memory: data.fallbackModels.memory.filter((v) => v !== ''),
        emotion: data.fallbackModels.emotion.filter((v) => v !== ''),
        translate: data.fallbackModels.translate.filter((v) => v !== ''),
        otherAx: data.fallbackModels.otherAx.filter((v) => v !== '')
    }
    data.customModels ??= []
    data.authRefreshes ??= []
    // Removed legacy anthropic/tool-behavior toggles:
    // - claude1HourCaching
    // - claudeBatching
    // - rememberToolUsage
    // - simplifiedToolUse
    const legacyToggleCleanup = data as unknown as Record<string, unknown>
    delete legacyToggleCleanup.claude1HourCaching
    delete legacyToggleCleanup.claudeBatching
    delete legacyToggleCleanup.rememberToolUsage
    delete legacyToggleCleanup.simplifiedToolUse
    data.streamGeminiThoughts ??= false
    data.sourcemapTranslate ??= false
    data.settingsCloseButtonSize ??= 24
    data.hideAllImages ??= false
    data.ImagenModel ??= 'imagen-4.0-generate-001'
    data.ImagenImageSize ??= '1K'
    data.ImagenAspectRatio ??= '1:1'
    data.ImagenPersonGeneration ??= 'allow_all'
    data.openaiCompatImage ??= {
        url: '',
        key: '',
        model: '',
        size: '1024x1024',
        quality: 'auto'
    }
    data.autoScrollToNewMessage ??= true
    data.alwaysScrollToNewMessage ??= false
    data.newMessageButtonStyle ??= 'bottom-center'
    if(!isNodeServer){
        //this is intended to forcely reduce the size of the database in web
        data.promptInfoInsideChat = false
    }
    data.createFolderOnBranch ??= true
    ensureComfyCommanderStateShape(data)
    const legacyPluginCleanup = data as unknown as Record<string, unknown>
    delete legacyPluginCleanup.plugins
    delete legacyPluginCleanup.currentPluginProvider
    delete legacyPluginCleanup.pluginV2
    delete legacyPluginCleanup.pluginCustomStorage
    changeLanguage(data.language)
    setDatabaseLite(data)
}

export function setDatabaseLite(data:Database){
    DBState.db = data
}

interface getDatabaseOptions{
    snapshot?:boolean
}

export function getDatabase(options:getDatabaseOptions = {}):Database{
    if(options.snapshot){
        return $state.snapshot(DBState.db) as Database
    }
    return DBState.db as Database
}

export function getCurrentCharacter(options:getDatabaseOptions = {}):character|groupChat{
    const db = getDatabase(options)
    // Do NOT mutate db.characters here — this function is called from inside
    // $derived computations (e.g. via getModules → getModuleToggles in Toggles.svelte)
    // and mutating $state inside $derived throws state_unsafe_mutation.
    // The optional chain below already handles a missing characters array safely.
    const char = db.characters?.[get(selectedCharID)]
    return char
}

export function resolveSelectedCharacter(
    characters: Array<character | groupChat> | undefined | null,
    selectedCharacterIndex: number,
): character | groupChat | null {
    if (!Array.isArray(characters) || selectedCharacterIndex < 0) {
        return null
    }
    return characters[selectedCharacterIndex] ?? null
}

export function resolveSafeChatIndex(
    chats: Chat[] | undefined | null,
    chatPage: number | undefined | null,
): number {
    if (!Array.isArray(chats) || chats.length === 0) {
        return -1
    }
    if (!Number.isInteger(chatPage) || chatPage < 0 || chatPage >= chats.length) {
        return 0
    }
    return chatPage
}

export function resolveSelectedChat(
    currentCharacter: character | groupChat | null | undefined,
): Chat | null {
    const chatIndex = resolveSafeChatIndex(currentCharacter?.chats, currentCharacter?.chatPage)
    if (chatIndex < 0) {
        return null
    }
    return currentCharacter?.chats?.[chatIndex] ?? null
}

export function resolveSelectedChatMessages(
    currentCharacter: character | groupChat | null | undefined,
): Message[] {
    return resolveSelectedChat(currentCharacter)?.message ?? []
}

export function resolveSelectedChatState(
    characters: Array<character | groupChat> | undefined | null,
    selectedCharacterIndex: number,
) {
    const character = resolveSelectedCharacter(characters, selectedCharacterIndex)
    const chatIndex = resolveSafeChatIndex(character?.chats, character?.chatPage)
    const chat = chatIndex >= 0 ? character?.chats?.[chatIndex] ?? null : null
    return {
        character,
        characterIndex: character ? selectedCharacterIndex : -1,
        chat,
        chatIndex,
        messages: chat?.message ?? [],
    }
}

export function repairCharacterChatPage(currentCharacter: character | groupChat | null | undefined): number {
    if (!currentCharacter) {
        return -1
    }
    const safeChatIndex = resolveSafeChatIndex(currentCharacter.chats, currentCharacter.chatPage)
    const nextChatPage = safeChatIndex < 0 ? 0 : safeChatIndex
    if (currentCharacter.chatPage !== nextChatPage) {
        currentCharacter.chatPage = nextChatPage
    }
    return safeChatIndex
}

export function setCurrentCharacter(char:character|groupChat){
    if(!DBState.db.characters){
        DBState.db.characters = []
    }
    DBState.db.characters[get(selectedCharID)] = char
}

export function getCharacterByIndex(index:number,options:getDatabaseOptions = {}):character|groupChat{
    const db = getDatabase(options)
    if(!db.characters){
        db.characters = []
    }
    const char = db.characters?.[index]
    return char
}

export function setCharacterByIndex(index:number,char:character|groupChat){
    if(!DBState.db.characters){
        DBState.db.characters = []
    }
    DBState.db.characters[index] = char
}

export function getCurrentChat(){
    const char = getCurrentCharacter()
    return resolveSelectedChat(char)
}

export function setCurrentChat(chat:Chat){
    const char = getCurrentCharacter()
    const safeChatIndex = resolveSafeChatIndex(char?.chats, char?.chatPage)
    if (!char || safeChatIndex < 0) {
        return
    }
    char.chats[safeChatIndex] = chat
    setCurrentCharacter(char)
}


export const saveImage = saveImageGlobal

export function saveCurrentPreset(){
    const db = getDatabase()
    saveCurrentPresetInDatabase(db)
    setDatabase(db)
}

export function copyPreset(id:number){
    const db = getDatabase()
    copyPresetInDatabase(db, id)
    setDatabase(db)
}

export function changeToPreset(id =0, savecurrent = true){
    const db = getDatabase()
    changeToPresetInDatabase(db, id, savecurrent)
    setDatabase(db)
}

export function setPreset(db:Database, newPres: botPreset){
    return setPresetOnDatabase(db, newPres)
}

export async function downloadPreset(id:number, type:PresetDownloadType = 'json'){
    saveCurrentPreset()
    const db = getDatabase()
    const pres = buildDownloadPresetForExport(db, id)
    dbStorageLog(pres)

    if(type === 'json'){
        downloadFile(pres.name + "_preset.json", Buffer.from(JSON.stringify(pres, null, 2)))
    }
    else if(type === 'risupreset' || type === 'return'){
        const buf2 = await encodeDownloadPresetBuffer(pres)

        if(type === 'risupreset'){
            downloadFile(pres.name + "_preset.risup", buf2)
        }
        else{
            return {
                data: pres,
                buf: buf2
            }
        }

    }

    alertNormal(language.successExport)


    return {
        data: pres,
        buf: null
    }
}


export async function importPreset(f:{
    name:string
    data:Uint8Array
}|null = null){
    if(!f){
        f = await selectSingleFile(["json", "preset", "risupreset", "risup"])
    }
    if(!f){
        return
    }
    const pre = await decodeImportedPresetFile(f)
    dbStorageLog(pre)
    if (!pre) {
        return
    }

    const db = getDatabase()
    applyImportedPresetToDatabase(db, pre, dbStorageLog)
    setDatabase(db)
}
