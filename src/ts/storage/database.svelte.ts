/* eslint-disable svelte/prefer-svelte-reactivity */
import { get } from 'svelte/store';
import { checkNullish, selectSingleFile } from '../util';
import { changeLanguage, language } from '../../lang';
import { downloadFile, saveAsset as saveImageGlobal } from '../globalApi.svelte';
import { defaultAutoSuggestPrompt, defaultJailbreak, defaultMainPrompt } from './defaultPrompts';
import { alertNormal } from '../alert';
import { prebuiltNAIpresets } from '../process/templates/templates';
import { defaultColorScheme } from '../gui/colorscheme';
import { LLMFormat } from '../model/modellist';
import type { HypaModel } from '../process/memory/hypamemory';
import { createHypaV3Preset } from '../process/memory/hypav3'
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
    botPreset,
    character,
    groupChat,
} from './database.types';
import {
    DEFAULT_GLOBAL_RAG_SETTINGS,
    DEFAULT_OPENROUTER_REQUEST_MODEL,
    ensureComfyCommanderStateShape,
    migrateRemovedProviderSelections,
    normalizeChatBackground,
    resolveChatBackgroundMode,
    resolveGlobalRagSettings,
    type ChatBackgroundMode,
} from './database.normalizers';
import {
    applyImportedPresetToDatabase,
    buildDownloadPresetForExport,
    changeToPresetInDatabase,
    copyPresetInDatabase,
    decodeImportedPresetFile,
    defaultAIN,
    defaultOoba,
    encodeDownloadPresetBuffer,
    presetTemplate,
    REMOVED_PROVIDER_MIGRATION_NOTICE,
    saveCurrentPresetInDatabase,
    setPresetOnDatabase,
    type PresetDownloadType,
} from './database.presets';
import { isNodeServer } from "src/ts/platform"
const dbStorageLog = (..._args: unknown[]) => {};

export {
    defaultAIN,
    defaultOoba,
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
    if(checkNullish(data.characters)){
        data.characters = []
    }
    ensureDatabaseEvolutionDefaults(data)
    for (const char of data.characters) {
        ensureCharacterEvolution(char)
        if (!Array.isArray(char?.chats)) {
            continue
        }
        for (const chat of char.chats) {
            normalizeChatBackground(chat)
        }
    }
    if(checkNullish(data.apiType)){
        data.apiType = 'gemini-3-flash-preview'
    }
    if(checkNullish(data.openAIKey)){
        data.openAIKey = ''
    }
    if(checkNullish(data.mainPrompt)){
        data.mainPrompt = defaultMainPrompt
    }
    if(checkNullish(data.jailbreak)){
        data.jailbreak = defaultJailbreak
    }
    if(checkNullish(data.globalNote)){
        data.globalNote = ``
    }
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
    if(checkNullish(data.formatingOrder)){
        data.formatingOrder = ['main','description', 'personaPrompt','chats','lastChat','jailbreak','lorebook', 'rulebookRag', 'globalNote', 'authorNote']
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
    if(checkNullish(data.additionalPrompt)){
        data.additionalPrompt = 'The assistant must act as {{char}}. user is {{user}}.'
    }
    if(checkNullish(data.descriptionPrefix)){
        data.descriptionPrefix = 'description of {{char}}: '
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
    if(checkNullish(data.textgenWebUIStreamURL)){
        data.textgenWebUIStreamURL = 'wss://localhost/api/'
    }
    if(checkNullish(data.textgenWebUIBlockingURL)){
        data.textgenWebUIBlockingURL = 'https://localhost/api/'
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
        const defaultPreset = presetTemplate
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
    if(checkNullish(data.hypaMemoryKey)){
        data.hypaMemoryKey = ""
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
    if(checkNullish(data.hordeConfig)){
        data.hordeConfig = {
            apiKey: "",
            model: "",
            softPrompt: ""
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
    if(!data.formatingOrder.includes('personaPrompt')){
        data.formatingOrder.splice(data.formatingOrder.indexOf('main'),0,'personaPrompt')
    }
    if(!data.formatingOrder.includes('rulebookRag')){
        data.formatingOrder.splice(data.formatingOrder.indexOf('lorebook') + 1, 0, 'rulebookRag')
    }
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
    data.ooba ??= safeStructuredClone(defaultOoba)
    data.ainconfig ??= safeStructuredClone(defaultAIN)
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
    data.mancerHeader ??= ''
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
    data.removedModelMigrationNotice ??= []
    const removedModelMigrationNotices = new Set(data.removedModelMigrationNotice)
    if (migrateRemovedProviderSelections(data)) {
        removedModelMigrationNotices.add(REMOVED_PROVIDER_MIGRATION_NOTICE)
    }
    if (data.botPresets) {
        for (const preset of data.botPresets) {
            if (migrateRemovedProviderSelections(preset)) {
                removedModelMigrationNotices.add(REMOVED_PROVIDER_MIGRATION_NOTICE)
            }
        }
    }
    data.removedModelMigrationNotice = [...removedModelMigrationNotices]
    data.useInstructPrompt ??= false
    data.hanuraiEnable ??= false
    data.hanuraiSplit ??= false
    data.hanuraiTokens ??= 1000
    data.textAreaSize ??= 0
    data.sideBarSize ??= 0
    data.textAreaTextSize ??= 0
    data.combineTranslation ??= false
    data.customPromptTemplateToggle ??= ''
    data.globalChatVariables ??= {}
    data.templateDefaultVariables ??= ''
    data.hypaAllocatedTokens ??= 3000
    data.hypaChunkSize ??= 3000
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
    data.vertexAccessToken ??= ''
    data.vertexAccessTokenExpires ??= 0
    data.vertexClientEmail ??= ''
    data.vertexPrivateKey ??= ''
    data.vertexRegion ??= 'global'
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
    data.hypaV3Presets ??= [
        createHypaV3Preset("Default", {
            summarizationPrompt: data.supaMemoryPrompt ? data.supaMemoryPrompt : "",
            ...data.hypaV3Settings
        })
    ]
    if (data.hypaV3Presets.length > 0) {
        data.hypaV3Presets = data.hypaV3Presets.map((preset, i) =>
            createHypaV3Preset(
                preset.name || `Preset ${i + 1}`,
                preset.settings || {}
            )
        )
        for (const preset of data.hypaV3Presets) {
            // Periodic summarization is interval-driven; keep it enabled for migrated presets.
            preset.settings.periodicSummarizationEnabled = true
        }
    }
    data.hypaV3PresetId ??= 0
    // Long-term memory migration: keep runtime on HypaV3 only.
    data.hypaV3 = true
    data.hypav2 = false
    data.hanuraiEnable = false
    data.hanuraiSplit = false
    data.supaModelType = 'none'
    data.hypaMemory = false
    data.memoryAlgorithmType = 'hypaMemoryV3'
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
    data.echoMessage ??= "Echo Message"
    data.echoDelay ??= 0
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
    return char?.chats[char.chatPage]
}

export function setCurrentChat(chat:Chat){
    const char = getCurrentCharacter()
    char.chats[char.chatPage] = chat
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
