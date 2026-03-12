/* eslint-disable @typescript-eslint/no-explicit-any */
import type { triggerscript as triggerscriptMain } from '../process/triggers';
import type { NAISettings } from '../process/models/nai';
import type { ColorScheme } from '../gui/colorscheme';
import type { PromptItem, PromptSettings } from '../process/prompt';
import type { OobaChatCompletionRequestParams } from '../model/ooba';
import type { MemorySettings, MemoryPreset, SerializableMemoryData } from '../process/memory/memory';
import type { OnnxModelFiles } from '../process/transformers';
import type { RisuModule } from '../process/modules';
import type { SerializableHypaV2Data } from '../process/memory/hypav2';
import type { LLMFlags, LLMFormat, LLMTokenizer } from '../model/modellist';
import type { HypaModel } from '../process/memory/hypamemory';
import type { Hotkey } from '../defaulthotkeys';
import type { OpenAIChat } from '../process/index.svelte';

export interface DynamicOutput {
    autoAdjustSchema: boolean
    dynamicMessages: boolean
    dynamicMemory: boolean
    dynamicResponseTiming: boolean
    dynamicOutputPrompt: boolean
    showTypingEffect: boolean
    dynamicRequest: boolean
}

export interface Database{
    characters: (character|groupChat)[],
    characterEvolutionDefaults?: CharacterEvolutionDefaults
    apiType: string
    openAIKey: string
    proxyKey:string
    temperature: number
    askRemoval:boolean
    maxContext: number
    maxResponse: number
    frequencyPenalty: number
    PresensePenalty: number
    aiModel: string
    loreBookDepth: number
    loreBookToken: number,
    cipherChat: boolean,
    loreBook: {
        name:string
        data:loreBook[]
    }[]
    loreBookPage: number
    supaMemoryPrompt: string
    username: string
    userIcon: string
    userNote: string
    forceReplaceUrl: string
    language: string
    translator: string
    zoomsize:number
    customBackground:string
    autoTranslate: boolean
    fullScreen:boolean
    playMessage:boolean
    iconsize:number
    theme: string
    subModel:string
    emotionPrompt: string,
    formatversion:number
    waifuWidth:number
    waifuWidth2:number
    botPresets:botPreset[]
    botPresetsId:number
    ttsAutoSpeech?:boolean
    bias: [string, number][]
    swipe:boolean
    instantRemove:boolean
    textTheme: string
    customTextTheme: {
        FontColorStandard: string,
        FontColorBold : string,
        FontColorItalic : string,
        FontColorItalicBold : string,
        FontColorQuote1 : string,
        FontColorQuote2 : string
    }
    requestRetrys:number
    emotionPrompt2:string
    useSayNothing:boolean
    didFirstSetup: boolean
    showUnrecommended:boolean
    elevenLabKey:string
    voicevoxUrl:string
    useExperimental:boolean
    showMemoryLimit:boolean
    roundIcons:boolean
    useStreaming:boolean
    supaMemoryKey:string
    supaModelType:string
    textScreenColor?:string
    textBorder?:boolean
    textScreenRounded?:boolean
    textScreenBorder?:string
    characterOrder:(string|folder)[]
    novelai:{
        token:string,
        model:string
    }
    globalscript: customscript[],
    sendWithEnter:boolean
    fixedChatTextarea:boolean
    clickToEdit: boolean
    chatReadingMode?: 'normal' | 'focus'
    koboldURL:string
    useAutoSuggestions:boolean
    autoSuggestPrompt:string
    autoSuggestPrefix:string
    autoSuggestClean:boolean
    claudeAPIKey:string,
    useChatCopy:boolean,
    useAutoTranslateInput:boolean
    imageCompression:boolean
    classicMaxWidth: boolean,
    useChatSticker:boolean,
    useAdditionalAssetsPreview:boolean,
    usePlainFetch:boolean
    proxyRequestModel:string
    personaPrompt:string
    openrouterRequestModel:string
    openrouterSubRequestModel:string
    openrouterKey:string
    openrouterMiddleOut:boolean
    openrouterFallback:boolean
    openrouterAllowReasoningOnlyForDeepSeekV32Speciale:boolean
    selectedPersona:number
    personas:{
        personaPrompt:string
        name:string
        icon:string
        largePortrait?:boolean
        id?:string
        note?:string
    }[]
    assetWidth:number
    animationSpeed:number
    NAIsettings:NAISettings
    colorScheme:ColorScheme
    colorSchemeName:string
    promptTemplate:PromptItem[]
    hypaModel:HypaModel
    saveTime?:number
    emotionProcesser:'submodel'|HypaModel,
    showMenuChatList?:boolean,
    translatorType:'google'|'deepl'|'none'|'llm'|'deeplX'|'bergamot',
    translatorInputLanguage?:string
    htmlTranslation?:boolean,
    NAIadventure?:boolean,
    NAIappendName?:boolean,
    deeplOptions:{
        key:string,
        freeApi:boolean
    }
    deeplXOptions:{
        url:string,
        token:string    
    }
    localStopStrings?:string[]
    autofillRequestUrl:boolean
    customProxyRequestModel:string
    generationSeed:number
    newOAIHandle:boolean
    gptVisionQuality:string
    reverseProxyOobaMode:boolean
    reverseProxyOobaArgs: OobaChatCompletionRequestParams
    huggingfaceKey:string
    fishSpeechKey:string
    allowAllExtentionFiles?:boolean
    translatorPrompt:string
    translatorMaxResponse:number
    top_p: number,
    google: {
        accessToken: string
        projectId: string
    }
    chainOfThought?:boolean
    genTime:number
    promptSettings: PromptSettings
    keiServerURL:string
    top_k:number
    repetition_penalty:number
    min_p:number
    top_a:number
    lastPatchNoteCheckVersion?:string,
    removePunctuationHypa?:boolean
    memoryLimitThickness?:number
    modules: RisuModule[]
    enabledModules: string[]
    sideMenuRerollButton?:boolean
    requestInfoInsideChat?:boolean
    additionalParams:[string, string][]
    heightMode:string
    noWaitForTranslate:boolean
    antiClaudeOverload:boolean
    maxSupaChunkSize:number
    ollamaURL:string
    ollamaModel:string
    autoContinueChat:boolean
    autoContinueMinTokens:number
    removeIncompleteResponse:boolean
    customTokenizer:string
    instructChatTemplate:string
    JinjaTemplate:string
    openrouterProvider: {
        order: string[]
        only: string[]
        ignore: string[]
    }
    useInstructPrompt:boolean
    textAreaSize:number
    sideBarSize:number
    textAreaTextSize:number
    combineTranslation:boolean
    dynamicAssets:boolean
    dynamicAssetsEditDisplay:boolean
    customPromptTemplateToggle:string
    globalChatVariables:{[key:string]:string}
    templateDefaultVariables:string
    dallEQuality:string
    font: string
    customFont: string
    lineHeight: number
    stabilityModel: string
    stabilityKey: string
    stabllityStyle: string
    legacyTranslation: boolean
    comfyConfig: ComfyConfig
    comfyUiUrl: string
    comfyCommander: ComfyCommanderState
    claudeCachingExperimental: boolean
    hideApiKey: boolean
    unformatQuotes: boolean
    enableDevTools: boolean
    falToken: string
    falModel: string
    falLora: string
    falLoraName: string
    falLoraScale: number
    moduleIntergration: string
    customCSS: string
    jsonSchemaEnabled:boolean
    jsonSchema:string
    strictJsonSchema:boolean
    extractJson:string
    statics: {
        messages: number
        imports: number
    }
    customQuotes:boolean
    customQuotesData?:[string, string, string, string]
    groupTemplate?:string
    groupOtherBotRole?:string
    customGUI:string
    guiHTML:string
    OAIPrediction:string
    customAPIFormat:LLMFormat
    systemContentReplacement:string
    systemRoleReplacement:'user'|'assistant'
    seperateParametersEnabled:boolean
    seperateParameters:{
        memory: SeparateParameters,
        emotion: SeparateParameters,
        translate: SeparateParameters,
        otherAx: SeparateParameters
    }
    translateBeforeHTMLFormatting:boolean
    autoTranslateCachedOnly:boolean
    notification: boolean
    customFlags: LLMFlags[]
    enableCustomFlags: boolean
    googleClaudeTokenizing: boolean
    presetChain: string
    geminiStream?:boolean
    assetMaxDifference:number
    menuSideBar:boolean
    showSavingIcon:boolean
    presetRegex: customscript[]
    banCharacterset:string[]
    showPromptComparison:boolean
    memoryEnabled?:boolean
    memorySettings?: MemorySettings
    memoryPresets?: MemoryPreset[]
    memoryPresetId?: number
    hypaV3:boolean // migration-only legacy read path
    hypaV3Settings: MemorySettings // migration-only legacy read path
    hypaV3Presets: MemoryPreset[] // migration-only legacy read path
    hypaV3PresetId: number // migration-only legacy read path
    OaiCompAPIKeys: {[key:string]:string}
    inlayErrorResponse:boolean
    globalRagSettings: RagSettings
    reasoningEffort:number
    bulkEnabling:boolean
    showTranslationLoading: boolean
    showDeprecatedTriggerV1:boolean
    showDeprecatedTriggerV2:boolean
    returnCSSError:boolean
    useExperimentalGoogleTranslator:boolean
    thinkingTokens: number
    antiServerOverloads: boolean
    hypaCustomSettings: {
        url: string,
        key: string,
        model: string,       
    },
    localActivationInGlobalLorebook: boolean
    showFolderName: boolean
    automaticCachePoint: boolean
    chatCompression: boolean
    claudeRetrivalCaching: boolean
    outputImageModal: boolean
    playMessageOnTranslateEnd:boolean
    seperateModelsForAxModels:boolean
    seperateModels:{
        memory: string
        emotion: string
        translate: string
        otherAx: string
    }
    doNotChangeSeperateModels:boolean
    modelTools: string[]
    hotkeys:Hotkey[]
    fallbackModels: {
        memory: string[],
        emotion: string[],
        translate: string[],
        otherAx: string[]
        model: string[]
    }
    doNotChangeFallbackModels: boolean
    fallbackWhenBlankResponse: boolean
    customModels: {
        id: string
        internalId: string
        url: string
        format: LLMFormat
        tokenizer: LLMTokenizer
        key: string
        name: string
        params: string
        flags: LLMFlags[]
    }[]
    igpPrompt:string
    useTokenizerCaching:boolean
    authRefreshes:{
        url:string
        tokenUrl:string
        refreshToken:string
        clientId:string
        clientSecret:string
    }[]
    promptInfoInsideChat:boolean
    promptTextInfoInsideChat:boolean
    requestLocation:string
    newImageHandlingBeta?: boolean
    showFirstMessagePages:boolean
    streamGeminiThoughts:boolean
    verbosity:number
    dynamicOutput?:DynamicOutput
    hubServerType?:string
    ImagenModel:string
    ImagenImageSize:string
    ImagenAspectRatio:string
    ImagenPersonGeneration:string,
    enableScrollToActiveChar:boolean
    openaiCompatImage: {
        url: string
        key: string
        model: string
        size: string
        quality: string
    }
    sourcemapTranslate:boolean
    settingsCloseButtonSize:number
    promptDiffPrefs:PromptDiffPrefs
    enableBookmark?: boolean
    hideAllImages?: boolean
    autoScrollToNewMessage?: boolean
    alwaysScrollToNewMessage?: boolean
    newMessageButtonStyle?: string
    createFolderOnBranch?:boolean
    memoryDebug?:{
        timestamp:number
        model:string
        prompt:string
        input:string
        formatted:{role:string, content:string}[]
        rawResponse?:string
        characterId?:string
        chatId?:string
        start?:number
        end?:number
        source?:"manual"|"periodic"
        promptSource?:"request_override"|"character_override"|"preset_or_default"
        periodic?:{
            totalChats:number
            lastIndex:number
            newMessages:number
            interval:number
            toSummarizeCount:number
            skippedReason?:string
            chatName?:string
        }
    }
    hypaV3Debug?:{ // migration-only legacy read path
        timestamp:number
        model:string
        prompt:string
        input:string
        formatted:{role:string, content:string}[]
        rawResponse?:string
        characterId?:string
        chatId?:string
        start?:number
        end?:number
        source?:"manual"|"periodic"
        promptSource?:"request_override"|"character_override"|"preset_or_default"
        periodic?:{
            totalChats:number
            lastIndex:number
            newMessages:number
            interval:number
            toSummarizeCount:number
            skippedReason?:string
            chatName?:string
        }
    }
}

interface SeparateParameters{
    temperature?:number
    top_k?:number
    repetition_penalty?:number
    min_p?:number
    top_a?:number
    top_p?:number
    frequency_penalty?:number
    presence_penalty?:number
    reasoning_effort?:number
    thinking_tokens?:number
    outputImageModal?:boolean
    verbosity?:number
}

export interface customscript{
    comment: string;
    in:string
    out:string
    type:string
    flag?:string
    ableFlag?:boolean

}

export type triggerscript = triggerscriptMain

export interface loreBook{
    key:string
    secondkey:string
    insertorder: number
    comment: string
    content: string
    mode: 'multiple'|'constant'|'normal'|'child'|'folder',
    alwaysActive: boolean
    selective:boolean
    extentions?:{
        risu_case_sensitive:boolean
    }
    activationPercent?:number
    loreCache?:{
        key:string
        data:string[]
    },
    useRegex?:boolean
    bookVersion?:number
    id?:string
    folder?:string
}

export interface MemoryPromptOverride {
    summarizationPrompt?: string
}

export type CharacterEvolutionConfidence = 'suspected' | 'likely' | 'confirmed'
export type CharacterEvolutionStatus = 'active' | 'archived' | 'corrected'
export type CharacterEvolutionSectionKind = 'list' | 'string' | 'object'
export type CharacterEvolutionSectionKey =
    | 'relationship'
    | 'activeThreads'
    | 'runningJokes'
    | 'characterLikes'
    | 'characterDislikes'
    | 'characterHabits'
    | 'characterBoundariesPreferences'
    | 'userFacts'
    | 'userRead'
    | 'userLikes'
    | 'userDislikes'
    | 'lastChatEnded'
    | 'keyMoments'
    | 'characterIntimatePreferences'
    | 'userIntimatePreferences'

export interface CharacterEvolutionItem {
    value: string
    confidence?: CharacterEvolutionConfidence
    note?: string
    status?: CharacterEvolutionStatus
    sourceChatId?: string
    updatedAt?: number
}

export interface CharacterEvolutionRelationshipState {
    trustLevel: string
    dynamic: string
}

export interface CharacterEvolutionLastChatEndedState {
    state: string
    residue: string
}

export interface CharacterEvolutionState {
    relationship: CharacterEvolutionRelationshipState
    activeThreads: string[]
    runningJokes: string[]
    characterLikes: CharacterEvolutionItem[]
    characterDislikes: CharacterEvolutionItem[]
    characterHabits: CharacterEvolutionItem[]
    characterBoundariesPreferences: CharacterEvolutionItem[]
    userFacts: CharacterEvolutionItem[]
    userRead: string[]
    userLikes: CharacterEvolutionItem[]
    userDislikes: CharacterEvolutionItem[]
    lastChatEnded: CharacterEvolutionLastChatEndedState
    keyMoments: string[]
    characterIntimatePreferences: CharacterEvolutionItem[]
    userIntimatePreferences: CharacterEvolutionItem[]
}

export interface CharacterEvolutionSectionConfig {
    key: CharacterEvolutionSectionKey
    label: string
    enabled: boolean
    includeInPrompt: boolean
    instruction: string
    kind: CharacterEvolutionSectionKind
    sensitive?: boolean
}

export interface CharacterEvolutionPrivacySettings {
    allowCharacterIntimatePreferences: boolean
    allowUserIntimatePreferences: boolean
}

export interface CharacterEvolutionChange {
    sectionKey: CharacterEvolutionSectionKey
    summary: string
    evidence: string[]
}

export interface CharacterEvolutionVersionMeta {
    version: number
    chatId: string | null
    acceptedAt: number
}

export interface CharacterEvolutionPendingProposal {
    proposalId: string
    sourceChatId: string
    proposedState: CharacterEvolutionState
    changes: CharacterEvolutionChange[]
    createdAt: number
}

export interface CharacterEvolutionVersionFile {
    version: number
    chatId: string | null
    acceptedAt: number
    state: CharacterEvolutionState
    sectionConfigs?: CharacterEvolutionSectionConfig[]
    privacy?: CharacterEvolutionPrivacySettings
}

export interface CharacterEvolutionSettings {
    enabled: boolean
    useGlobalDefaults: boolean
    extractionProvider: string
    extractionModel: string
    extractionMaxTokens: number
    extractionPrompt: string
    sectionConfigs: CharacterEvolutionSectionConfig[]
    privacy: CharacterEvolutionPrivacySettings
    currentStateVersion: number
    currentState: CharacterEvolutionState
    pendingProposal?: CharacterEvolutionPendingProposal | null
    lastProcessedChatId?: string | null
    stateVersions: CharacterEvolutionVersionMeta[]
}

export interface CharacterEvolutionDefaults {
    extractionProvider: string
    extractionModel: string
    extractionMaxTokens: number
    extractionPrompt: string
    sectionConfigs: CharacterEvolutionSectionConfig[]
    privacy: CharacterEvolutionPrivacySettings
}

export interface character{
    type?:"character"
    name:string
    image?:string
    firstMessage:string
    desc:string
    notes:string
    chats:Chat[]
    chatFolders: ChatFolder[]
    chatPage: number
    viewScreen: 'emotion'|'none',
    bias: [string, number][]
    emotionImages: [string, string][]
    globalLore: loreBook[]
    chaId: string
    newGenData?: {
        prompt: string,
        negative: string,
        instructions: string,
        emotionInstructions: string,
    }
    customscript: customscript[]
    triggerscript: triggerscript[]
    utilityBot: boolean
    exampleMessage:string
    removedQuotes?:boolean
    creatorNotes:string
    systemPrompt:string
    postHistoryInstructions:string
    alternateGreetings:string[]
    tags:string[]
    creator:string
    characterVersion: string
    personality:string
    scenario:string
    firstMsgIndex:number
    randomAltFirstMessageOnNewChat?:boolean
    loreSettings?:loreSettings
    ragSettings?:RagSettings
    loreExt?:any
    additionalData?: {
        tag?:string[]
        creator?:string
        character_version?:string
    }
    ttsMode?:string
    ttsSpeech?:string
    voicevoxConfig?:{
        speaker?: string
        SPEED_SCALE?: number
        PITCH_SCALE?: number
        INTONATION_SCALE?: number
        VOLUME_SCALE?: number
    }
    naittsConfig?:{
        customvoice?: boolean
        voice?: string
        version?: string
    }
    gptSoVitsConfig?:{
        url?:string
        use_auto_path?:boolean
        ref_audio_path?:string
        use_long_audio?:boolean
        ref_audio_data?: {
            fileName:string
            assetId:string
        }
        volume?:number
        text_lang?: "auto" | "auto_yue" | "en" | "zh" | "ja" | "yue" | "ko" | "all_zh" | "all_ja" | "all_yue" | "all_ko"
        text?:string
        use_prompt?:boolean
        prompt?:string | null
        prompt_lang?: "auto" | "auto_yue" | "en" | "zh" | "ja" | "yue" | "ko" | "all_zh" | "all_ja" | "all_yue" | "all_ko"
        top_p?:number
        temperature?:number
        speed?:number
        top_k?:number
        text_split_method?: "cut0" | "cut1" | "cut2" | "cut3" | "cut4" | "cut5"
    }
    fishSpeechConfig?:{
        model?: {
            _id:string
            title:string
            description:string
        },
        chunk_length:number,
        normalize:boolean,

    }
    supaMemory?:boolean
    additionalAssets?:[string, string, string][]
    ttsReadOnlyQuoted?:boolean
    replaceGlobalNote:string
    backgroundHTML?:string
    reloadKeys?:number
    backgroundCSS?:string
    license?:string
    private?:boolean
    additionalText:string
    oaiVoice?:string
    virtualscript?:string
    scriptstate?:{[key:string]:string|number|boolean}
    depth_prompt?: { depth: number, prompt: string }
    extentions?:{[key:string]:unknown}
    largePortrait?:boolean
    lorePlus?:boolean
    inlayViewScreen?:boolean
    hfTTS?: {
        model: string
        language: string
    },
    vits?: OnnxModelFiles
    realmId?:string
    imported?:boolean
    trashTime?:number
    nickname?:string
    source?:string[]
    group_only_greetings?:string[]
    creation_date?:number
    modification_date?:number
    ccAssets?: Array<{
        type: string
        uri: string
        name: string
        ext: string
    }>
    defaultVariables?:string
    lowLevelAccess?:boolean
    hideChatIcon?:boolean
    lastInteraction?:number
    translatorNote?:string
    doNotChangeSeperateModels?:boolean
    escapeOutput?:boolean
    prebuiltAssetCommand?:boolean
    prebuiltAssetStyle?:string
    prebuiltAssetExclude?:string[]
    memoryPromptOverride?: MemoryPromptOverride
    hypaV3PromptOverride?: MemoryPromptOverride // migration-only legacy read path
    modules?:string[]
    gameState?: Record<string, any>
    characterEvolution?: CharacterEvolutionSettings
}


export interface loreSettings{
    tokenBudget: number
    scanDepth:number
    recursiveScanning: boolean
    fullWordMatching?: boolean
}

export interface RagSettings {
    enabled: boolean
    topK?: number
    minScore?: number
    budget?: number
    enabledRulebooks: string[]
    model?: string
}

export interface groupChat{ 
    type: 'group'
    image?:string
    firstMessage:string
    chats:Chat[]
    chatFolders: ChatFolder[]
    chatPage: number
    name:string
    viewScreen: 'single'|'multiple'|'none'|'emp',
    characters:string[]
    characterTalks:number[]
    characterActive:boolean[]
    globalLore: loreBook[]
    autoMode: boolean
    useCharacterLore :boolean
    emotionImages: [string, string][]
    customscript: customscript[],
    chaId: string
    alternateGreetings?: string[]
    creatorNotes?:string,
    removedQuotes?:boolean
    firstMsgIndex?:number,
    loreSettings?:loreSettings
    ragSettings?: RagSettings
    supaMemory?:boolean
    ttsMode?:string
    suggestMessages?:string[]
    orderByOrder?:boolean
    backgroundHTML?:string,
    reloadKeys?:number
    backgroundCSS?:string
    oneAtTime?:boolean
    virtualscript?:string
    lorePlus?:boolean
    trashTime?:number
    nickname?:string
    defaultVariables?:string
    lowLevelAccess?:boolean
    hideChatIcon?:boolean
    lastInteraction?:number

    //lazy hack for typechecking
    voicevoxConfig?:any
    ttsSpeech?:string
    naittsConfig?:any
    oaiVoice?:string
    hfTTS?: any
    vits?: OnnxModelFiles
    gptSoVitsConfig?:any
    fishSpeechConfig?:any
    ttsReadOnlyQuoted?:boolean
    exampleMessage?:string
    systemPrompt?:string
    replaceGlobalNote?:string
    additionalText?:string
    personality?:string
    scenario?:string
    translatorNote?:string
    additionalData?: any
    depth_prompt?: { depth: number, prompt: string }
    additionalAssets?:[string, string, string][]
    utilityBot?:boolean
    license?:string
    realmId:string
    prebuiltAssetCommand?:boolean
    prebuiltAssetStyle?:string
    prebuiltAssetExclude?:string[]
    memoryPromptOverride?: MemoryPromptOverride
    hypaV3PromptOverride?: MemoryPromptOverride // migration-only legacy read path
    modules?:string[]
    gameState?: Record<string, any>
    characterEvolution?: CharacterEvolutionSettings
}

export interface botPreset{
    name?:string
    apiType?: string
    openAIKey?: string
    temperature: number
    maxContext: number
    maxResponse: number
    frequencyPenalty: number
    PresensePenalty: number
    aiModel?: string
    subModel?:string
    forceReplaceUrl?:string
    forceReplaceUrl2?:string
    bias: [string, number][]
    proxyRequestModel?:string
    openrouterRequestModel?:string
    openrouterSubRequestModel?:string
    proxyKey?:string
    koboldURL?: string
    NAISettings?: NAISettings
    autoSuggestPrompt?: string
    autoSuggestPrefix?: string
    autoSuggestClean?: boolean
    promptTemplate?:PromptItem[]
    NAIadventure?: boolean
    NAIappendName?: boolean
    localStopStrings?: string[]
    customProxyRequestModel?: string
    reverseProxyOobaArgs?: OobaChatCompletionRequestParams
    top_p?: number
    promptSettings?: PromptSettings
    repetition_penalty?:number
    min_p?:number
    top_a?:number
    openrouterProvider?: {
        order: string[]
        only: string[]
        ignore: string[]
    }
    openrouterAllowReasoningOnlyForDeepSeekV32Speciale?: boolean
    useInstructPrompt?:boolean
    customPromptTemplateToggle?:string
    templateDefaultVariables?:string
    moduleIntergration?:string
    top_k?:number
    instructChatTemplate?:string
    JinjaTemplate?:string
    jsonSchemaEnabled?:boolean
    jsonSchema?:string
    strictJsonSchema?:boolean
    extractJson?:string
    groupTemplate?:string
    groupOtherBotRole?:string
    seperateParametersEnabled?:boolean
    seperateParameters?:{
        memory: SeparateParameters,
        emotion: SeparateParameters,
        translate: SeparateParameters,
        otherAx: SeparateParameters
    }
    customAPIFormat?:LLMFormat
    systemContentReplacement?: string
    systemRoleReplacement?: 'user'|'assistant'
    enableCustomFlags?: boolean
    customFlags?: LLMFlags[]
    image?:string
    regex?:customscript[]
    reasonEffort?:number
    thinkingTokens?:number
    outputImageModal?:boolean
    seperateModelsForAxModels?:boolean
    seperateModels?:{
        memory: string
        emotion: string
        translate: string
        otherAx: string
    }
    modelTools?:string[]
    fallbackModels?: {
        memory: string[],
        emotion: string[],
        translate: string[],
        otherAx: string[]
        model: string[]
    }
    fallbackWhenBlankResponse?: boolean
    verbosity?:number
    dynamicOutput?:DynamicOutput
}


export interface folder{
    name:string
    data:string[]
    color:string
    id:string
    imgFile?:string
    img?:string
}


interface ComfyConfig{
    workflow:string,
    posNodeID: string,
    posInputName:string,
    negNodeID: string,
    negInputName:string,
    timeout: number
}

export interface ComfyCommanderConfig {
    baseUrl: string
    debug: boolean
    timeoutSec: number
    pollIntervalMs: number
}

export interface ComfyCommanderWorkflow {
    id: string
    name: string
    workflow: string
}

export interface ComfyCommanderTemplate {
    id: string
    trigger: string
    prompt: string
    negativePrompt: string
    workflowId: string
    showInChatMenu: boolean
    buttonName: string
}

export interface ComfyCommanderState {
    version: 1
    config: ComfyCommanderConfig
    workflows: ComfyCommanderWorkflow[]
    templates: ComfyCommanderTemplate[]
}

export interface Chat{
    message: Message[]
    note:string
    name:string
    localLore: loreBook[]
    backgroundMode?: 'inherit' | 'default' | 'custom'
    backgroundImage?: string
    supaMemoryData?:string
    hypaV2Data?:SerializableHypaV2Data // migration-only legacy read path
    lastMemory?:string
    suggestMessages?:string[]
    isStreaming?:boolean
    scriptstate?:{[key:string]:string|number|boolean}
    modules?:string[]
    id?:string
    bindedPersona?:string
    fmIndex?:number
    memoryData?:SerializableMemoryData
    hypaV3Data?:SerializableMemoryData // migration-only legacy read path
    folderId?:string
    lastDate?:number
    bookmarks?: string[];
    bookmarkNames?: { [chatId: string]: string };
}

export interface ChatFolder{
    id:string
    name?:string
    color?:string
    folded:boolean
}

export interface Message{
    role: 'user'|'char'
    data: string
    attachments?: MessageAttachment[]
    saying?: string
    chatId?:string
    time?: number
    generationInfo?: MessageGenerationInfo
    promptInfo?: MessagePresetInfo
    name?:string
    otherUser?:boolean
    disabled?:false|true|'allBefore'
    isComment?:boolean
}

export interface MessageAttachment{
    type: 'image'|'video'|'audio'
    inlayId: string
    source?: 'inlay'|'dataUrl'|'asset'
}

export interface MessageGenerationInfo{
    model?: string
    generationId?: string
    inputTokens?: number
    outputTokens?: number
    maxContext?: number
    stageTiming?: {
        stage1?: number
        stage2?: number
        stage3?: number
        stage4?: number
    }
    ragResults?: {
        content: string
        score: number
        source: string
    }[]
}

export interface MessagePresetInfo{
    promptName?: string,
    promptToggles?: {key: string, value: string}[],
    promptText?: OpenAIChat[],
}

export interface PromptDiffPrefs {
    diffStyle: 'line' | 'intraline'
    formatStyle: 'raw' | 'card'
    viewStyle: 'unified' | 'split'
    isGrouped: boolean
    showOnlyChanges: boolean
    contextRadius: number
}
