<script lang="ts">
    import { language } from "../../lang";
    import { tokenizeAccurate } from "../../ts/tokenizer";
    import {
        repairCharacterChatPage,
        resolveSelectedChat,
        resolveSelectedChatState,
        saveImage as saveAsset,
        type character,
        type groupChat,
    } from "../../ts/storage/database.svelte";
    import { DBState } from 'src/ts/stores.svelte';
    import { tick, untrack } from 'svelte';
    import { SvelteMap } from "svelte/reactivity";
    import { CharConfigSubMenu, MobileGUI, selectedCharID } from "../../ts/stores.svelte";
    import { PlusIcon, SmileIcon, TrashIcon, UserIcon, ActivityIcon, BookIcon, BookOpenCheckIcon, User, Braces, Volume2Icon, DownloadIcon, HardDriveUploadIcon, Share2Icon, ImageIcon, ImageOffIcon, ArrowUp, ArrowDown } from '@lucide/svelte'
    import Check from "../UI/GUI/CheckInput.svelte";
    import { addCharEmotion, addingEmotion, getCharImage, rmCharEmotion, selectCharImg, makeGroupImage, removeChar, changeCharImage } from "../../ts/characters";
    import LoreBook from "./LoreBook/LoreBookSetting.svelte";
    import RulebookRagSetting from "./LoreBook/RulebookRagSetting.svelte";
    import BarIcon from "./BarIcon.svelte";
    import { findCharacterbyId, getAuthorNoteDefaultText, selectMultipleFile, selectSingleFile } from "../../ts/util";
    import Help from "../Others/Help.svelte";
    import { exportChar } from "src/ts/characterCards";
    import { getElevenTTSVoices, getWebSpeechTTSVoices, getVOICEVOXVoices, oaiVoices, getNovelAIVoices } from "src/ts/process/tts";
    import { getFileSrc } from "src/ts/globalApi.svelte";
    import { addGroupChar, rmCharFromGroup } from "src/ts/process/group";
    import { getCharacterMemoryPromptOverride, setCharacterMemoryPromptOverride } from "src/ts/process/memory/storage";
    import TextInput from "../UI/GUI/TextInput.svelte";
    import NumberInput from "../UI/GUI/NumberInput.svelte";
    import TextAreaInput from "../UI/GUI/TextAreaInput.svelte";
    import Button from "../UI/GUI/Button.svelte";
    import SelectInput from "../UI/GUI/SelectInput.svelte";
    import OptionInput from "../UI/GUI/OptionInput.svelte";
    import RegexList from "./Scripts/RegexList.svelte";
    import TriggerList from "./Scripts/TriggerList.svelte";
    import CheckInput from "../UI/GUI/CheckInput.svelte";
    import { updateInlayScreen } from "src/ts/process/inlayScreen";
    import { registerOnnxModel } from "src/ts/process/transformers";
    import MultiLangInput from "../UI/GUI/MultiLangInput.svelte";
    import { applyModule } from "src/ts/process/modules";
    import { exportRegex, importRegex } from "src/ts/process/scripts";
    import SliderInput from "../UI/GUI/SliderInput.svelte";
    import Toggles from "./Toggles.svelte";
    import GameStateEditor from "./GameStateEditor.svelte";
    import { DatabaseIcon } from "@lucide/svelte";
    const charConfigLog = (..._args: unknown[]) => {};

    type CharacterEditorState = character & {
        additionalAssets: [string, string, string?][]
        prebuiltAssetStyle: string
        backgroundHTML: string
        virtualscript: string
        ttsMode: string
        ttsSpeech: string
        oaiVoice: string
        defaultVariables: string
        translatorNote: string
        nickname: string
        additionalData: {
            creator: string
            character_version: string
        }
        depth_prompt: {
            depth: number
            prompt: string
        }
        memoryPromptOverride: {
            summarizationPrompt: string
        }
        newGenData: {
            emotionInstructions: string
        }
        voicevoxConfig: {
            speaker: string
            SPEED_SCALE: number
            PITCH_SCALE: number
            VOLUME_SCALE: number
            INTONATION_SCALE: number
        }
        naittsConfig: {
            customvoice: boolean
            voice: string
            version: string
        }
        hfTTS: {
            model: string
            language: string
        }
        gptSoVitsConfig: {
            url: string
            use_auto_path: boolean
            ref_audio_path: string
            use_long_audio: boolean
            ref_audio_data: {
                fileName: string
                assetId: string
            }
            volume: number
            text_lang: string
            text: string
            use_prompt: boolean
            prompt_lang: string
            prompt: string
            top_p: number
            temperature: number
            speed: number
            top_k: number
            text_split_method: string
        }
        fishSpeechConfig: {
            model: {
                _id: string
                title: string
                description: string
            }
            chunk_length: number
            normalize: boolean
        }
    }

    let iconRemoveMode = $state(false)
    let viewSubMenu = $state(0)
    const selectedChatState = $derived(resolveSelectedChatState(DBState.db.characters, $selectedCharID))
    const currentCharacter = $derived(selectedChatState.character)
    const selectedChat = $derived(selectedChatState.chat)
    const emos: [string, string][] = $derived(currentCharacter?.emotionImages ?? [])
    const iconButtonSize = window.innerWidth > 360 ? 24 as const : 20 as const
    type CharConfigTabId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
    const charConfigTabsForCharacter: CharConfigTabId[] = [0, 1, 3, 8, 5, 4, 2, 7, 6]
    const charConfigTabsForGroup: CharConfigTabId[] = [0, 1, 3, 2, 7]
    const charConfigTabLabels: Record<CharConfigTabId, string> = {
        0: "Basics",
        1: "Display",
        2: "Advanced",
        3: "Lorebook",
        8: "Rulebooks",
        4: "Scripts",
        5: "Voice",
        6: "Share",
        7: "GameState"
    }

    const getVisibleCharConfigTabs = (): CharConfigTabId[] => {
        const selected = currentCharacter
        if (!selected) {
            return []
        }
        return selected.type === "character" ? charConfigTabsForCharacter : charConfigTabsForGroup
    }

    const focusCharConfigTab = (tab: CharConfigTabId) => {
        const tabButton = document.getElementById(`char-config-tab-${tab}`) as HTMLButtonElement | null
        tabButton?.focus()
    }

    const selectCharConfigSubMenu = (tab: CharConfigTabId) => {
        $CharConfigSubMenu = tab
    }

    const selectCharConfigSubMenuAndFocus = async (tab: CharConfigTabId) => {
        selectCharConfigSubMenu(tab)
        await tick()
        focusCharConfigTab(tab)
    }

    const getHorizontalDirection = (key: string): 1 | -1 | 0 => {
        if (key === "ArrowRight" || key === "Right") {
            return 1
        }
        if (key === "ArrowLeft" || key === "Left") {
            return -1
        }
        return 0
    }

    const handleCharConfigTabKeydown = async (event: KeyboardEvent, currentTab: CharConfigTabId = $CharConfigSubMenu as CharConfigTabId) => {
        const visibleTabs = getVisibleCharConfigTabs()
        if (visibleTabs.length === 0) {
            return
        }

        if (event.key === "Home") {
            await selectCharConfigSubMenuAndFocus(visibleTabs[0])
            event.preventDefault()
            return
        }

        if (event.key === "End") {
            await selectCharConfigSubMenuAndFocus(visibleTabs[visibleTabs.length - 1])
            event.preventDefault()
            return
        }

        const direction = getHorizontalDirection(event.key)
        if (direction === 0) {
            return
        }

        const currentIndex = visibleTabs.indexOf(currentTab)
        const safeIndex = currentIndex >= 0 ? currentIndex : 0
        const nextIndex = (safeIndex + direction + visibleTabs.length) % visibleTabs.length
        await selectCharConfigSubMenuAndFocus(visibleTabs[nextIndex])
        event.preventDefault()
    }

    const tokens = $state({
        name: 0,
        systemPrompt: 0,
        desc: 0,
        personality: 0,
        replaceGlobalNote: 0,
        firstMsg: 0,
        scenario: 0,
        bias: [] as number[],
        exampleMessage: 0,
        creatorNotes: 0,
        additionalText: 0,
        defaultVariables: 0,
        translatorNote: 0,
        creator: 0,
        charVersion: 0,
        nickname: 0,
        depthPrompt: 0,
        localNote: 0,
        charaNote: 0,
        altGreetings: [] as number[],
    })

    const lasttokens = {
        name: '',
        systemPrompt: '',
        desc: '',
        personality: '',
        replaceGlobalNote: '',
        firstMsg: '',
        scenario: '',
        bias: [] as string[],
        exampleMessage: '',
        creatorNotes: '',
        additionalText: '',
        defaultVariables: '',
        translatorNote: '',
        creator: '',
        charVersion: '',
        nickname: '',
        depthPrompt: '',
        localNote: '',
        charaNote: '',
        altGreetings: [] as string[],
    }

    type TokenScalarField =
        | 'name'
        | 'systemPrompt'
        | 'desc'
        | 'personality'
        | 'replaceGlobalNote'
        | 'firstMsg'
        | 'scenario'
        | 'exampleMessage'
        | 'creatorNotes'
        | 'additionalText'
        | 'defaultVariables'
        | 'translatorNote'
        | 'creator'
        | 'charVersion'
        | 'nickname'
        | 'depthPrompt'
        | 'localNote'

    const TOKEN_CACHE_LIMIT = 500
    const tokenCache = new SvelteMap<string, number>()
    let tokenizeRunId = 0

    function getCachedTokenCount(value:string):number|null {
        const cached = tokenCache.get(value)
        if (cached === undefined) {
            return null
        }
        // Refresh insertion order for simple LRU behavior.
        tokenCache.delete(value)
        tokenCache.set(value, cached)
        return cached
    }

    function setCachedTokenCount(value:string, count:number) {
        if (tokenCache.has(value)) {
            tokenCache.delete(value)
        }
        tokenCache.set(value, count)
        if (tokenCache.size > TOKEN_CACHE_LIMIT) {
            const oldestKey = tokenCache.keys().next().value
            if (typeof oldestKey === 'string') {
                tokenCache.delete(oldestKey)
            }
        }
    }

    async function tokenizeScalarField(
        field: TokenScalarField,
        value:string,
        runId:number,
    ) {
        if (lasttokens[field] === value) {
            return
        }
        lasttokens[field] = value

        const cached = getCachedTokenCount(value)
        if (cached !== null) {
            if (runId === tokenizeRunId && lasttokens[field] === value) {
                tokens[field] = cached
            }
            return
        }

        const count = await tokenizeAccurate(value)
        setCachedTokenCount(value, count)
        if (runId !== tokenizeRunId) {
            return
        }
        if (lasttokens[field] !== value) {
            return
        }
        tokens[field] = count
    }

    async function tokenizeIndexedField(
        field: 'altGreetings' | 'bias',
        index: number,
        value: string,
        runId: number,
    ) {
        if (lasttokens[field][index] === value) {
            return
        }
        lasttokens[field][index] = value

        const cached = getCachedTokenCount(value)
        if (cached !== null) {
            if (runId === tokenizeRunId && lasttokens[field][index] === value) {
                tokens[field][index] = cached
            }
            return
        }

        const count = await tokenizeAccurate(value)
        setCachedTokenCount(value, count)
        if (runId !== tokenizeRunId) {
            return
        }
        if (lasttokens[field][index] !== value) {
            return
        }
        tokens[field][index] = count
    }

    async function loadTokenize(chara: character | groupChat | undefined, runId:number) {
        if (!chara) {
            return
        }

        const jobs: Promise<void>[] = []
        jobs.push(tokenizeScalarField('name', chara.name ?? '', runId))

        if (chara.type !== 'group') {
            jobs.push(tokenizeScalarField('systemPrompt', chara.systemPrompt ?? '', runId))
            jobs.push(tokenizeScalarField('desc', chara.desc ?? '', runId))
            jobs.push(tokenizeScalarField('personality', chara.personality ?? '', runId))
            jobs.push(tokenizeScalarField('replaceGlobalNote', chara.replaceGlobalNote ?? '', runId))
            jobs.push(tokenizeScalarField('firstMsg', chara.firstMessage ?? '', runId))
            jobs.push(tokenizeScalarField('scenario', chara.scenario ?? '', runId))
            jobs.push(tokenizeScalarField('exampleMessage', chara.exampleMessage ?? '', runId))
            jobs.push(tokenizeScalarField('creatorNotes', chara.creatorNotes ?? '', runId))
            jobs.push(tokenizeScalarField('additionalText', chara.additionalText ?? '', runId))
            jobs.push(tokenizeScalarField('defaultVariables', chara.defaultVariables ?? '', runId))
            jobs.push(tokenizeScalarField('translatorNote', chara.translatorNote ?? '', runId))
            jobs.push(tokenizeScalarField('creator', chara.additionalData?.creator ?? '', runId))
            jobs.push(tokenizeScalarField('charVersion', chara.additionalData?.character_version ?? '', runId))
            jobs.push(tokenizeScalarField('nickname', chara.nickname ?? '', runId))
            jobs.push(tokenizeScalarField('depthPrompt', chara.depth_prompt?.prompt ?? '', runId))

            const altGreetings = Array.isArray(chara.alternateGreetings) ? chara.alternateGreetings : []
            if (tokens.altGreetings.length !== altGreetings.length) {
                tokens.altGreetings = tokens.altGreetings.slice(0, altGreetings.length)
            }
            if (lasttokens.altGreetings.length !== altGreetings.length) {
                lasttokens.altGreetings = lasttokens.altGreetings.slice(0, altGreetings.length)
            }
            for (let i = 0; i < altGreetings.length; i++) {
                const altGreeting = altGreetings[i] ?? ''
                jobs.push(tokenizeIndexedField('altGreetings', i, altGreeting, runId))
            }

            const biasKeywords = Array.isArray(chara.bias) ? chara.bias.map((entry) => entry?.[0] ?? '') : []
            if (tokens.bias.length !== biasKeywords.length) {
                tokens.bias = tokens.bias.slice(0, biasKeywords.length)
            }
            if (lasttokens.bias.length !== biasKeywords.length) {
                lasttokens.bias = lasttokens.bias.slice(0, biasKeywords.length)
            }
            for (let i = 0; i < biasKeywords.length; i++) {
                jobs.push(tokenizeIndexedField('bias', i, biasKeywords[i], runId))
            }
        } else {
            if (tokens.altGreetings.length > 0) {
                tokens.altGreetings = []
                lasttokens.altGreetings = []
            }
            if (tokens.bias.length > 0) {
                tokens.bias = []
                lasttokens.bias = []
            }
        }

        const localNote = resolveSelectedChat(chara)?.note ?? ''
        jobs.push(tokenizeScalarField('localNote', localNote, runId))

        await Promise.all(jobs)
    }


    const assetFileExtensions:string[] = $state([])
    const assetFilePath:string[] = $state([])
    const licensed = $derived(currentCharacter?.type === 'character' ? currentCharacter.license : '')

    function ensureEditorCharacter(): CharacterEditorState | null {
        const selected = currentCharacter
        if (!selected || selected.type !== 'character') {
            return null
        }
        const char = selected as character
        char.additionalAssets = Array.isArray(char.additionalAssets) ? char.additionalAssets : []
        char.prebuiltAssetStyle = typeof char.prebuiltAssetStyle === 'string' ? char.prebuiltAssetStyle : ''
        char.backgroundHTML = typeof char.backgroundHTML === 'string' ? char.backgroundHTML : ''
        char.virtualscript = typeof char.virtualscript === 'string' ? char.virtualscript : ''
        char.ttsMode = typeof char.ttsMode === 'string' ? char.ttsMode : ''
        char.ttsSpeech = typeof char.ttsSpeech === 'string' ? char.ttsSpeech : ''
        char.oaiVoice = typeof char.oaiVoice === 'string' ? char.oaiVoice : ''
        char.defaultVariables = typeof char.defaultVariables === 'string' ? char.defaultVariables : ''
        char.translatorNote = typeof char.translatorNote === 'string' ? char.translatorNote : ''
        char.nickname = typeof char.nickname === 'string' ? char.nickname : ''
        char.bias = Array.isArray(char.bias) ? char.bias : []
        char.ccAssets = Array.isArray(char.ccAssets) ? char.ccAssets : []
        char.additionalData ??= {
            creator: '',
            character_version: ''
        }
        char.additionalData.creator = typeof char.additionalData.creator === 'string' ? char.additionalData.creator : ''
        char.additionalData.character_version = typeof char.additionalData.character_version === 'string' ? char.additionalData.character_version : ''
        char.depth_prompt ??= {
            depth: 0,
            prompt: ''
        }
        char.depth_prompt.depth = typeof char.depth_prompt.depth === 'number' ? char.depth_prompt.depth : 0
        char.depth_prompt.prompt = typeof char.depth_prompt.prompt === 'string' ? char.depth_prompt.prompt : ''
        setCharacterMemoryPromptOverride(char, {
            summarizationPrompt: typeof getCharacterMemoryPromptOverride(char)?.summarizationPrompt === 'string'
                ? getCharacterMemoryPromptOverride(char)?.summarizationPrompt
                : ''
        })
        char.newGenData ??= {
            prompt: '',
            negative: '',
            instructions: '',
            emotionInstructions: ''
        }
        char.newGenData.emotionInstructions = typeof char.newGenData.emotionInstructions === 'string' ? char.newGenData.emotionInstructions : ''
        char.voicevoxConfig ??= {
            speaker: '',
            SPEED_SCALE: 1,
            PITCH_SCALE: 0,
            VOLUME_SCALE: 1,
            INTONATION_SCALE: 1
        }
        char.voicevoxConfig.speaker = typeof char.voicevoxConfig.speaker === 'string' ? char.voicevoxConfig.speaker : ''
        char.voicevoxConfig.SPEED_SCALE = typeof char.voicevoxConfig.SPEED_SCALE === 'number' ? char.voicevoxConfig.SPEED_SCALE : 1
        char.voicevoxConfig.PITCH_SCALE = typeof char.voicevoxConfig.PITCH_SCALE === 'number' ? char.voicevoxConfig.PITCH_SCALE : 0
        char.voicevoxConfig.VOLUME_SCALE = typeof char.voicevoxConfig.VOLUME_SCALE === 'number' ? char.voicevoxConfig.VOLUME_SCALE : 1
        char.voicevoxConfig.INTONATION_SCALE = typeof char.voicevoxConfig.INTONATION_SCALE === 'number' ? char.voicevoxConfig.INTONATION_SCALE : 1
        char.naittsConfig ??= {
            customvoice: false,
            voice: 'Aini',
            version: 'v2'
        }
        char.naittsConfig.customvoice = typeof char.naittsConfig.customvoice === 'boolean' ? char.naittsConfig.customvoice : false
        char.naittsConfig.voice = typeof char.naittsConfig.voice === 'string' ? char.naittsConfig.voice : 'Aini'
        char.naittsConfig.version = typeof char.naittsConfig.version === 'string' ? char.naittsConfig.version : 'v2'
        char.hfTTS ??= {
            model: '',
            language: 'en'
        }
        char.hfTTS.model = typeof char.hfTTS.model === 'string' ? char.hfTTS.model : ''
        char.hfTTS.language = typeof char.hfTTS.language === 'string' ? char.hfTTS.language : 'en'
        char.gptSoVitsConfig ??= {
            url: '',
            use_auto_path: false,
            ref_audio_path: '',
            use_long_audio: false,
            ref_audio_data: {
                fileName: '',
                assetId: ''
            },
            volume: 1.0,
            text_lang: 'auto',
            text: 'en',
            use_prompt: false,
            prompt_lang: 'en',
            prompt: '',
            top_p: 1,
            temperature: 0.7,
            speed: 1,
            top_k: 5,
            text_split_method: 'cut0',
        }
        char.gptSoVitsConfig.url = typeof char.gptSoVitsConfig.url === 'string' ? char.gptSoVitsConfig.url : ''
        char.gptSoVitsConfig.use_auto_path = typeof char.gptSoVitsConfig.use_auto_path === 'boolean' ? char.gptSoVitsConfig.use_auto_path : false
        char.gptSoVitsConfig.ref_audio_path = typeof char.gptSoVitsConfig.ref_audio_path === 'string' ? char.gptSoVitsConfig.ref_audio_path : ''
        char.gptSoVitsConfig.use_long_audio = typeof char.gptSoVitsConfig.use_long_audio === 'boolean' ? char.gptSoVitsConfig.use_long_audio : false
        char.gptSoVitsConfig.ref_audio_data ??= {
            fileName: '',
            assetId: ''
        }
        char.gptSoVitsConfig.ref_audio_data.fileName = typeof char.gptSoVitsConfig.ref_audio_data.fileName === 'string' ? char.gptSoVitsConfig.ref_audio_data.fileName : ''
        char.gptSoVitsConfig.ref_audio_data.assetId = typeof char.gptSoVitsConfig.ref_audio_data.assetId === 'string' ? char.gptSoVitsConfig.ref_audio_data.assetId : ''
        char.gptSoVitsConfig.volume = typeof char.gptSoVitsConfig.volume === 'number' ? char.gptSoVitsConfig.volume : 1.0
        char.gptSoVitsConfig.text_lang = typeof char.gptSoVitsConfig.text_lang === 'string' ? char.gptSoVitsConfig.text_lang : 'auto'
        char.gptSoVitsConfig.text = typeof char.gptSoVitsConfig.text === 'string' ? char.gptSoVitsConfig.text : 'en'
        char.gptSoVitsConfig.use_prompt = typeof char.gptSoVitsConfig.use_prompt === 'boolean' ? char.gptSoVitsConfig.use_prompt : false
        char.gptSoVitsConfig.prompt_lang = typeof char.gptSoVitsConfig.prompt_lang === 'string' ? char.gptSoVitsConfig.prompt_lang : 'en'
        char.gptSoVitsConfig.prompt = typeof char.gptSoVitsConfig.prompt === 'string' ? char.gptSoVitsConfig.prompt : ''
        char.gptSoVitsConfig.top_p = typeof char.gptSoVitsConfig.top_p === 'number' ? char.gptSoVitsConfig.top_p : 1
        char.gptSoVitsConfig.temperature = typeof char.gptSoVitsConfig.temperature === 'number' ? char.gptSoVitsConfig.temperature : 0.7
        char.gptSoVitsConfig.speed = typeof char.gptSoVitsConfig.speed === 'number' ? char.gptSoVitsConfig.speed : 1
        char.gptSoVitsConfig.top_k = typeof char.gptSoVitsConfig.top_k === 'number' ? char.gptSoVitsConfig.top_k : 5
        char.gptSoVitsConfig.text_split_method = typeof char.gptSoVitsConfig.text_split_method === 'string' ? char.gptSoVitsConfig.text_split_method : 'cut0'
        char.fishSpeechConfig ??= {
            model: {
                _id: '',
                title: '',
                description: ''
            },
            chunk_length: 200,
            normalize: false,
        }
        char.fishSpeechConfig.model ??= {
            _id: '',
            title: '',
            description: ''
        }
        char.fishSpeechConfig.model._id = typeof char.fishSpeechConfig.model._id === 'string' ? char.fishSpeechConfig.model._id : ''
        char.fishSpeechConfig.model.title = typeof char.fishSpeechConfig.model.title === 'string' ? char.fishSpeechConfig.model.title : ''
        char.fishSpeechConfig.model.description = typeof char.fishSpeechConfig.model.description === 'string' ? char.fishSpeechConfig.model.description : ''
        char.fishSpeechConfig.chunk_length = typeof char.fishSpeechConfig.chunk_length === 'number' ? char.fishSpeechConfig.chunk_length : 200
        char.fishSpeechConfig.normalize = typeof char.fishSpeechConfig.normalize === 'boolean' ? char.fishSpeechConfig.normalize : false
        return char as CharacterEditorState
    }

    let editorCharacter = $state<CharacterEditorState | null>(null)
    let editorCharacterKey = $state<string | null>(null)

    $effect(() => {
        repairCharacterChatPage(currentCharacter)
    })

    $effect(() => {
        const selectedIndex = $selectedCharID
        const selected = currentCharacter
        const nextEditorCharacterKey = selected && selected.type === 'character'
            ? (selected.chaId ?? `character-${selectedIndex}`)
            : null

        if (editorCharacterKey === nextEditorCharacterKey) {
            return
        }

        editorCharacterKey = nextEditorCharacterKey
        editorCharacter = untrack(() => ensureEditorCharacter())
    })

    $effect(() => {
        const chara = currentCharacter
        const runId = ++tokenizeRunId
        untrack(() => {
            void loadTokenize(chara, runId)
        })
    });

    $effect(() => {
        const selected = currentCharacter
        if(!selected || selected.type !== 'character' || !DBState.db.useAdditionalAssetsPreview || !editorCharacter){
            return
        }
        const additionalAssets = editorCharacter?.additionalAssets
        if(!additionalAssets){
            return
        }
        for(let i = 0; i < additionalAssets.length; i++){
            const asset = additionalAssets[i]
            if(!asset){
                continue
            }
            const extension = asset[2] || asset[1].split('.').pop() || ''
            assetFileExtensions[i] = extension
            getFileSrc(asset[1]).then((filePath) => {
                assetFilePath[i] = filePath ?? ''
            })
        }
    });

    $effect(() => {
        if (!editorCharacter) {
            return
        }
        if (editorCharacter.ttsMode === 'novelai' && editorCharacter.naittsConfig === undefined) {
            editorCharacter.naittsConfig = {
                customvoice: false,
                voice: 'Aini',
                version: 'v2'
            };
        }
    });
    $effect(() => {
        if (!editorCharacter) {
            return
        }
        if (editorCharacter.ttsMode === 'gptsovits' && editorCharacter.gptSoVitsConfig === undefined) {
            editorCharacter.gptSoVitsConfig = {
                url: '',
                use_auto_path: false,
                ref_audio_path: '',
                use_long_audio: false,
                ref_audio_data: {
                    fileName: '',
                    assetId: ''  
                },
                volume: 1.0,
                text_lang: 'auto',
                text: 'en',
                use_prompt: false,
                prompt_lang: 'en',
                prompt: '',
                top_p: 1,
                temperature: 0.7,
                speed: 1,
                top_k: 5,
                text_split_method: 'cut0',
            };
        }
    });

    let fishSpeechModels:{
        _id:string,
        title:string,
        description:string
    }[] = $state([])

    $effect(() => {
        if (!editorCharacter) {
            return
        }
        if (editorCharacter.ttsMode === 'fishspeech' && editorCharacter.fishSpeechConfig === undefined) {
            editorCharacter.fishSpeechConfig = {
                model: {
                    _id: '',
                    title: '',
                    description: ''
                },
                chunk_length: 200,
                normalize: false,
            };
        }
    });

    $effect(() => {
        const selected = currentCharacter
        if(!selected){
            return
        }
        if(selected.type === 'group' && ($CharConfigSubMenu === 4 || $CharConfigSubMenu === 5 || $CharConfigSubMenu === 6 || $CharConfigSubMenu === 8)){
            $CharConfigSubMenu = 0
        }

    });

    async function getFishSpeechModels() {
        try {
            const res = await fetch(`https://api.fish.audio/model?self=true`, {
                headers: {
                    'Authorization': `Bearer ${DBState.db.fishSpeechKey}`
                }
            });
            const data = await res.json();
            charConfigLog(data.items);
            charConfigLog(currentCharacter)
            
            if (Array.isArray(data.items)) {
                fishSpeechModels = data.items.map((item: { _id?: string; title?: string; description?: string }) => ({
                    _id: item?._id || '',
                    title: item?.title || '',
                    description: item?.description || ''
                }));
            } else {
                charConfigLog('Expected an array of items, but received:', data.items);
                fishSpeechModels = [];
            }
        } catch (error) {
            charConfigLog('Error fetching fish speech models:', error);
            fishSpeechModels = [];
        }
    }

    function moveAlternateGreetingUp(index: number) {
        const selected = currentCharacter
        if(index === 0) return
        if(selected?.type === 'character'){
            const alternateGreetings = selected.alternateGreetings
            const temp = alternateGreetings[index]
            alternateGreetings[index] = alternateGreetings[index - 1]
            alternateGreetings[index - 1] = temp
            selected.alternateGreetings = alternateGreetings
        }
    }

    function moveAlternateGreetingDown(index: number) {
        const selected = currentCharacter
        if(!selected || selected.type !== 'character'){
            return
        }
        const alternateGreetings = selected.alternateGreetings
        if(index === alternateGreetings.length - 1) return
        if(selected.type === 'character'){
            if(alternateGreetings[index] === undefined || alternateGreetings[index + 1] === undefined){
                return
            }
            const temp = alternateGreetings[index]
            alternateGreetings[index] = alternateGreetings[index + 1]
            alternateGreetings[index + 1] = temp
            selected.alternateGreetings = alternateGreetings
        }
    }

</script>

<div class="char-config-root">
{#if currentCharacter}
{@const selectedCharacter = currentCharacter}
{#if selectedCharacter.type === 'character' && !editorCharacter}
    <div class="char-config-empty empty-state">Loading character...</div>
{:else}
{#if licensed !== 'private'}
    <div
        class="char-config-tabs seg-tabs"
        role="tablist"
        aria-label="Character settings sections"
        tabindex="-1"
        onkeydown={(event) => {
            if (event.target !== event.currentTarget) {
                return
            }
            handleCharConfigTabKeydown(event)
        }}
    >
        <button
            type="button"
            class="char-config-tab seg-tab"
            class:active={$CharConfigSubMenu === 0}
            id="char-config-tab-0"
            data-testid="char-config-subtab-0"
            role="tab"
            aria-label={charConfigTabLabels[0]}
            aria-selected={$CharConfigSubMenu === 0}
            aria-controls="char-config-panel-0"
            tabindex={$CharConfigSubMenu === 0 ? 0 : -1}
            onclick={() => selectCharConfigSubMenuAndFocus(0)}
            onkeydown={(event) => handleCharConfigTabKeydown(event, 0)}
        >
            <UserIcon size={iconButtonSize} />
        </button>
        <button
            type="button"
            class="char-config-tab seg-tab"
            class:active={$CharConfigSubMenu === 1}
            id="char-config-tab-1"
            data-testid="char-config-subtab-1"
            role="tab"
            aria-label={charConfigTabLabels[1]}
            aria-selected={$CharConfigSubMenu === 1}
            aria-controls="char-config-panel-1"
            tabindex={$CharConfigSubMenu === 1 ? 0 : -1}
            onclick={() => selectCharConfigSubMenuAndFocus(1)}
            onkeydown={(event) => handleCharConfigTabKeydown(event, 1)}
        >
            <SmileIcon size={iconButtonSize} />
        </button>
        <button
            type="button"
            class="char-config-tab seg-tab"
            class:active={$CharConfigSubMenu === 3}
            id="char-config-tab-3"
            data-testid="char-config-subtab-3"
            role="tab"
            aria-label={charConfigTabLabels[3]}
            aria-selected={$CharConfigSubMenu === 3}
            aria-controls="char-config-panel-3"
            tabindex={$CharConfigSubMenu === 3 ? 0 : -1}
            onclick={() => selectCharConfigSubMenuAndFocus(3)}
            onkeydown={(event) => handleCharConfigTabKeydown(event, 3)}
        >
            <BookIcon size={iconButtonSize} />
        </button>
        {#if selectedCharacter.type === 'character'}
            <button
                type="button"
                class="char-config-tab seg-tab"
                class:active={$CharConfigSubMenu === 8}
                id="char-config-tab-8"
                data-testid="char-config-subtab-8"
                role="tab"
                aria-label={charConfigTabLabels[8]}
                aria-selected={$CharConfigSubMenu === 8}
                aria-controls="char-config-panel-8"
                tabindex={$CharConfigSubMenu === 8 ? 0 : -1}
                onclick={() => selectCharConfigSubMenuAndFocus(8)}
                onkeydown={(event) => handleCharConfigTabKeydown(event, 8)}
            >
                <BookOpenCheckIcon size={iconButtonSize} />
            </button>
            <button
                type="button"
                class="char-config-tab seg-tab"
                class:active={$CharConfigSubMenu === 5}
                id="char-config-tab-5"
                data-testid="char-config-subtab-5"
                role="tab"
                aria-label={charConfigTabLabels[5]}
                aria-selected={$CharConfigSubMenu === 5}
                aria-controls="char-config-panel-5"
                tabindex={$CharConfigSubMenu === 5 ? 0 : -1}
                onclick={() => selectCharConfigSubMenuAndFocus(5)}
                onkeydown={(event) => handleCharConfigTabKeydown(event, 5)}
            >
                <Volume2Icon size={iconButtonSize} />
            </button>
            <button
                type="button"
                class="char-config-tab seg-tab"
                class:active={$CharConfigSubMenu === 4}
                id="char-config-tab-4"
                data-testid="char-config-subtab-4"
                role="tab"
                aria-label={charConfigTabLabels[4]}
                aria-selected={$CharConfigSubMenu === 4}
                aria-controls="char-config-panel-4"
                tabindex={$CharConfigSubMenu === 4 ? 0 : -1}
                onclick={() => selectCharConfigSubMenuAndFocus(4)}
                onkeydown={(event) => handleCharConfigTabKeydown(event, 4)}
            >
                <Braces size={iconButtonSize} />
            </button>
        {/if}
        <button
            type="button"
            class="char-config-tab seg-tab"
            class:active={$CharConfigSubMenu === 2}
            id="char-config-tab-2"
            data-testid="char-config-subtab-2"
            role="tab"
            aria-label={charConfigTabLabels[2]}
            aria-selected={$CharConfigSubMenu === 2}
            aria-controls="char-config-panel-2"
            tabindex={$CharConfigSubMenu === 2 ? 0 : -1}
            onclick={() => selectCharConfigSubMenuAndFocus(2)}
            onkeydown={(event) => handleCharConfigTabKeydown(event, 2)}
        >
            <ActivityIcon size={iconButtonSize} />
        </button>
        <button
            type="button"
            class="char-config-tab seg-tab"
            class:active={$CharConfigSubMenu === 7}
            id="char-config-tab-7"
            data-testid="char-config-subtab-7"
            role="tab"
            aria-label={charConfigTabLabels[7]}
            aria-selected={$CharConfigSubMenu === 7}
            aria-controls="char-config-panel-7"
            tabindex={$CharConfigSubMenu === 7 ? 0 : -1}
            onclick={() => selectCharConfigSubMenuAndFocus(7)}
            onkeydown={(event) => handleCharConfigTabKeydown(event, 7)}
        >
            <DatabaseIcon size={iconButtonSize} />
        </button>
        {#if selectedCharacter.type === 'character'}
            <button
                type="button"
                class="char-config-tab seg-tab"
                class:active={$CharConfigSubMenu === 6}
                id="char-config-tab-6"
                data-testid="char-config-subtab-6"
                role="tab"
                aria-label={charConfigTabLabels[6]}
                aria-selected={$CharConfigSubMenu === 6}
                aria-controls="char-config-panel-6"
                tabindex={$CharConfigSubMenu === 6 ? 0 : -1}
                onclick={() => selectCharConfigSubMenuAndFocus(6)}
                onkeydown={(event) => handleCharConfigTabKeydown(event, 6)}
            >
                <Share2Icon size={iconButtonSize} />
            </button>
        {/if}
    </div>
{/if}


{#if $CharConfigSubMenu === 0}
    <div class="char-config-section" role="tabpanel" id="char-config-panel-0" aria-labelledby="char-config-tab-0" tabindex="0">
    {#if selectedCharacter.type !== 'group' && licensed !== 'private'}
        <TextInput size="xl" placeholder="Character Name" bind:value={selectedCharacter.name} />
        <span class="char-config-token-note">{tokens.name} {language.tokens}</span>
        <span class="char-config-label">{language.systemPrompt} <Help key="systemPrompt"/></span>
        <TextAreaInput highlight margin="both" autocomplete="off" bind:value={selectedCharacter.systemPrompt}></TextAreaInput>
        <span class="char-config-token-note">{tokens.systemPrompt} {language.tokens}</span>
        <span class="char-config-label">{language.description} <Help key="charDesc"/></span>
        <TextAreaInput highlight margin="both" autocomplete="off" bind:value={editorCharacter!.desc}></TextAreaInput>
        <span class="char-config-token-note">{tokens.desc} {language.tokens}</span>
        <span class="char-config-label">{language.personality} <Help key="personality" unrecommended/></span>
        <TextAreaInput highlight margin="both" autocomplete="off" bind:value={selectedCharacter.personality}></TextAreaInput>
        <span class="char-config-token-note">{tokens.personality} {language.tokens}</span>
        <span class="char-config-label">{language.replaceGlobalNote} <Help key="replaceGlobalNote"/></span>
        <TextAreaInput highlight margin="both" autocomplete="off" bind:value={selectedCharacter.replaceGlobalNote}></TextAreaInput>
        <span class="char-config-token-note">{tokens.replaceGlobalNote} {language.tokens}</span>
        <span class="char-config-label">{language.firstMessage} <Help key="charFirstMessage"/></span>
        <TextAreaInput highlight margin="both" autocomplete="off" bind:value={selectedCharacter.firstMessage}></TextAreaInput>
        <span class="char-config-token-note">{tokens.firstMsg} {language.tokens}</span>

        <span class="char-config-label">{language.altGreet}</span>
        <div class="char-config-card panel-shell">
            <table class="char-config-table-contained char-config-table-fixed char-config-table char-config-table-full">
                <tbody>
                <tr>
                    <th class="char-config-table-head">{language.value}</th>
                    <th class="char-config-table-head char-config-table-action-head">
                        <button class="char-config-icon-action icon-btn icon-btn--sm char-config-icon-action--success" onclick={() => {
                            if(selectedCharacter.type === 'character'){
                                const alternateGreetings = selectedCharacter.alternateGreetings
                                alternateGreetings.push('')
                                selectedCharacter.alternateGreetings = alternateGreetings
                            }
                        }} type="button" title="Add alternate greeting" aria-label="Add alternate greeting">
                            <PlusIcon />
                        </button>
                    </th>
                </tr>
                {#if selectedCharacter.alternateGreetings.length === 0}
                    <tr>
                        <td class="char-config-empty-cell" colspan="3">{language.noData}</td>
                    </tr>
                {/if}
                {#each selectedCharacter.alternateGreetings as _bias, i (i)}
                    <tr>
                        <td class="char-config-table-value-cell">
                            <TextAreaInput highlight bind:value={selectedCharacter.alternateGreetings[i]} placeholder="..." fullwidth />
                            <span class="char-config-token-note">{tokens.altGreetings[i] ?? 0} {language.tokens}</span>
                        </td>
                        <th class="char-config-table-action-cell">
                            <div class="char-config-altgreet-actions action-rail">
                                <button class="char-config-icon-action icon-btn icon-btn--sm char-config-icon-action--accent char-config-icon-action--compact" onclick={() => moveAlternateGreetingUp(i)} disabled={i === 0} type="button" title="Move greeting up" aria-label={`Move alternate greeting ${i + 1} up`}>
                                    <ArrowUp size={16} />
                                </button>
                                <button class="char-config-icon-action icon-btn icon-btn--sm char-config-icon-action--accent char-config-icon-action--compact" onclick={() => moveAlternateGreetingDown(i)} disabled={i === selectedCharacter.alternateGreetings.length - 1} type="button" title="Move greeting down" aria-label={`Move alternate greeting ${i + 1} down`}>
                                    <ArrowDown size={16} />
                                </button>
                                <button class="char-config-icon-action icon-btn icon-btn--sm char-config-icon-action--danger char-config-icon-action--compact" onclick={() => {
                                    if(selectedCharacter.type === 'character'){
                                        if (selectedChat) {
                                            selectedChat.fmIndex = -1
                                        }
                                        const alternateGreetings = selectedCharacter.alternateGreetings
                                        alternateGreetings.splice(i, 1)
                                        selectedCharacter.alternateGreetings = alternateGreetings
                                    }
                                }} type="button" title="Remove greeting" aria-label={`Remove alternate greeting ${i + 1}`}>
                                    <TrashIcon size={16} />
                                </button>
                            </div>
                        </th>
                    </tr>
                {/each}
            </tbody>
            </table>
        </div>

        <div class="char-config-check-row">
            <Check bind:check={selectedCharacter.randomAltFirstMessageOnNewChat} name={language.randomAltFirstMessageOnNewChat}/>
        </div>

        <span class="char-config-label">{language.scenario} <Help key="scenario" unrecommended/></span>
        <TextAreaInput highlight margin="both" autocomplete="off" bind:value={selectedCharacter.scenario}></TextAreaInput>
        <span class="char-config-token-note">{tokens.scenario} {language.tokens}</span>

    {:else if licensed !== 'private' && selectedCharacter.type === 'group'}
        <TextInput size="xl" placeholder="Group Name" bind:value={selectedCharacter.name} />
        <span class="char-config-token-note">{tokens.name} {language.tokens}</span>
        <span class="char-config-label">{language.character}</span>
        <div class="char-config-group-grid char-config-group-layout panel-shell">
            {#if (selectedCharacter as groupChat).characters.length === 0}
                <span class="char-config-label-muted">No Character</span>
            {:else}
                <div></div>
                <div class="char-config-group-header">{language.talkness}</div>
                <div class="char-config-group-header">{language.active}</div>
                {#each (selectedCharacter as groupChat).characters as char, i (char ?? i)}
                    {@const matchedChar = findCharacterbyId(char)}
                    {#await getCharImage(matchedChar?.image ?? '', 'css')}
                        <BarIcon onClick={() => {
                            rmCharFromGroup(i)
                        }}>
                            <User/>
                        </BarIcon>
                    {:then im} 
                        <BarIcon onClick={() => {
                            rmCharFromGroup(i)
                        }} additionalStyle={im ?? undefined} />
                    {/await}
                    <div class="char-config-group-talk-row">
                        {#each [1,2,3,4,5,6] as barIndex (barIndex)}
                            <button class="char-config-group-talk-segment"
                                type="button"
                                title={`Set talk weight to ${barIndex} of 6`}
                                aria-label={`Set talk weight to ${barIndex} of 6`}
                                class:is-active={(selectedCharacter as groupChat).characterTalks[i] >= (1 / 6 * barIndex)}
                                class:is-first={barIndex === 1}
                                class:is-last={barIndex === 6}
                                onclick={() => {
                                    if(selectedCharacter.type === 'group'){
                                        (selectedCharacter as groupChat).characterTalks[i] = (1 / 6 * barIndex)
                                    }
                                }}
                            ></button>
                        {/each}
                    </div>
                    <div class="char-config-group-check-wrap">
                        <Check margin={false} bind:check={(selectedCharacter as groupChat).characterActive[i]} />
                    </div>
                {/each}
            {/if}
        </div>
        <div class="char-config-group-add-row">
            <button onclick={addGroupChar} class="char-config-group-add-button icon-btn icon-btn--sm" type="button" title="Add character to group" aria-label="Add character to group">
                <PlusIcon />
            </button>
        </div>

    {/if}
    <span class="char-config-label">{language.chatNotes} <Help key="chatNote"/></span>
    {#if selectedChat}
        <TextAreaInput
            margin="both"
            autocomplete="off"
            bind:value={selectedChat.note}
            highlight
            placeholder={getAuthorNoteDefaultText()}
        />
    {:else}
        <div class="char-config-empty empty-state">No chat selected.</div>
    {/if}
    <span class="char-config-token-note">{tokens.localNote} {language.tokens}</span>

    {#if !$MobileGUI}
        <Toggles chara={selectedCharacter} noContainer />

        {#if selectedCharacter.type === 'group'}
            <div class="char-config-check-row">
                <Check bind:check={(selectedCharacter as groupChat).orderByOrder} name={language.orderByOrder}/>
            </div>
        {/if}
    {/if}
    </div>
{:else if licensed === 'private'}
    <span>You are not allowed</span>
    {(() => {
        $CharConfigSubMenu = 0
    })()}
{:else if $CharConfigSubMenu === 1}
    <div class="char-config-section" role="tabpanel" id="char-config-panel-1" aria-labelledby="char-config-tab-1" tabindex="0">
        {#if !$MobileGUI}
            <h2 class="char-config-title">{language.characterDisplay}</h2>
        {/if}

        <div class="char-config-subtabs seg-tabs">
            <button
                type="button"
                title={selectedCharacter.type !== 'group' ? language.charIcon : language.groupIcon}
                aria-label={selectedCharacter.type !== 'group' ? language.charIcon : language.groupIcon}
                aria-pressed={viewSubMenu === 0}
                onclick={() => {
                viewSubMenu = 0
            }} class="char-config-subtab seg-tab" class:active={viewSubMenu === 0}>
                <span>{selectedCharacter.type !== 'group' ? language.charIcon : language.groupIcon}</span>
            </button>
            <button
                type="button"
                title={language.viewScreen}
                aria-label={language.viewScreen}
                aria-pressed={viewSubMenu === 1}
                onclick={() => {
                viewSubMenu = 1
            }} class="char-config-subtab seg-tab" class:active={viewSubMenu === 1}>
                <span>{language.viewScreen}</span>
            </button>
            <button
                type="button"
                title={language.additionalAssets}
                aria-label={language.additionalAssets}
                aria-pressed={viewSubMenu === 2}
                onclick={() => {
                viewSubMenu = 2
            }} class="char-config-subtab seg-tab" class:active={viewSubMenu === 2}>
                <span>{language.additionalAssets}</span>
            </button>
        </div>

        {#if viewSubMenu === 0}
        {#if selectedCharacter.type === 'group'}
            <button onclick={async () => {await selectCharImg($selectedCharID)}} type="button" title="Select group icon" aria-label="Select group icon">
                {#await getCharImage(selectedCharacter.image ?? '', 'css')}
                    <div class="char-config-icon-tile char-config-icon-tile-selected"></div>
                {:then im}
                    <div class="char-config-icon-tile char-config-icon-tile-selected" style={im}></div>
                {/await}
            </button>
        {:else}
            <div class="char-config-icon-gallery panel-shell">
                {#if selectedCharacter.image !== '' && selectedCharacter.image}
                    <button
                        onclick={() => {
                        if(
                            selectedCharacter.type === 'character' &&
                            selectedCharacter.image !== '' &&
                            selectedCharacter.image &&
                            iconRemoveMode
                        ){
                            selectedCharacter.image = ''
                            if(editorCharacter!.ccAssets && editorCharacter!.ccAssets.length > 0){
                                changeCharImage($selectedCharID, 0)
                            }
                            iconRemoveMode = false
                        }
                    }} type="button" title={iconRemoveMode ? "Remove selected icon" : "Current icon"} aria-label={iconRemoveMode ? "Remove selected icon" : "Current icon"}>
                        {#await getCharImage(selectedCharacter.image, editorCharacter!.largePortrait ? 'lgcss' : 'css')}
                            <div
                                class="char-config-icon-tile char-config-icon-tile-selected"
                                class:is-remove-mode={iconRemoveMode}
                            ></div>
                        {:then im}
                            <div
                                class="char-config-icon-tile char-config-icon-tile-selected"
                                class:is-remove-mode={iconRemoveMode}
                                style={im}
                            ></div>
                        {/await}
                    </button>
                {/if}
                {#if editorCharacter!.ccAssets}
                    {#each editorCharacter!.ccAssets as assets, i (i)}
                        <button onclick={async () => {
                            if(!iconRemoveMode){
                                changeCharImage($selectedCharID, i)
                            }
                            else if(selectedCharacter.type === 'character'){
                                if(editorCharacter!.ccAssets){
                                    editorCharacter!.ccAssets.splice(i, 1)
                                }
                                iconRemoveMode = false
                            }
                        }} type="button" title={iconRemoveMode ? "Remove icon asset" : "Select icon asset"} aria-label={iconRemoveMode ? `Remove icon asset ${i + 1}` : `Select icon asset ${i + 1}`}>
                            {#await getCharImage(assets.uri, editorCharacter!.largePortrait ? 'lgcss' : 'css')}
                                <div
                                    class="char-config-icon-tile char-config-icon-tile-hover"
                                    class:is-remove-mode={iconRemoveMode}
                                ></div>
                            {:then im}
                                <div
                                    class="char-config-icon-tile char-config-icon-tile-hover"
                                    class:is-remove-mode={iconRemoveMode}
                                    style={im}
                                ></div>
                            {/await}
                        </button>
                    {/each}
                {/if}
                <button onclick={async () => {await selectCharImg($selectedCharID);}} type="button" title="Add icon asset" aria-label="Add icon asset">
                    <div
                        class="char-config-icon-add-tile"
                        class:is-large={editorCharacter!.largePortrait}
                    >
                        <PlusIcon />
                    </div>
                </button>
            </div>
            <div class="char-config-icon-remove-row">
                <button
                    class="char-config-icon-remove-button icon-btn icon-btn--sm"
                    class:is-active={iconRemoveMode}
                    type="button"
                    title={iconRemoveMode ? "Disable icon remove mode" : "Enable icon remove mode"}
                    aria-label="Toggle icon remove mode"
                    onclick={() => {
                    iconRemoveMode = !iconRemoveMode
                }}>
                    <TrashIcon size="18" />
                </button>
            </div>
        {/if}

        {#if selectedCharacter.type === 'character' && selectedCharacter.image !== ''}
            <div class="char-config-check-row">
                <Check bind:check={editorCharacter!.largePortrait} name={language.largePortrait}/>
            </div>
        {/if}

        {#if selectedCharacter.type === 'group'}
            <Button onclick={makeGroupImage}>
                {language.createGroupImg}
            </Button>
        {/if}


        {:else if viewSubMenu === 1}
        {#if selectedCharacter.type !== 'group'}
            <SelectInput className="char-config-control" bind:value={selectedCharacter.viewScreen} onchange={() => {
                if(selectedCharacter.type === 'character'){
                    Object.assign(selectedCharacter, updateInlayScreen(editorCharacter!))
                }
            }}>
                <OptionInput value="none">{language.none}</OptionInput>
                <OptionInput value="emotion">{language.emotionImage}</OptionInput>
            </SelectInput>
        {:else}
            <SelectInput className="char-config-control" bind:value={selectedCharacter.viewScreen}>
                <OptionInput value="none">{language.none}</OptionInput>
                <OptionInput value="single">{language.singleView}</OptionInput>
                <OptionInput value="multiple">{language.SpacedView}</OptionInput>
                <OptionInput value="emp">{language.emphasizedView}</OptionInput>

            </SelectInput>
        {/if}

        {#if selectedCharacter.viewScreen === 'emotion'}
            <span class="char-config-label">{language.emotionImage} <Help key="emotion"/></span>
            <span class="char-config-note-xs">{language.emotionWarn}</span>

            <div class="char-config-card panel-shell">

                <table class="char-config-table-fixed char-config-table char-config-table-full">
                    <tbody>
                    <tr>
                        <th class="char-config-table-head char-config-table-col-image">{language.image}</th>
                        <th class="char-config-table-head char-config-table-col-emotion">{language.emotion}</th>
                        <th class="char-config-table-head"></th>
                    </tr>
                    {#if selectedCharacter.emotionImages.length === 0}
                        <tr>
                            <td class="char-config-empty-cell" colspan="3">{language.noImages}</td>
                        </tr>
                    {:else}
                        {#each emos as emo, i (i)}
                            <tr>
                                {#await getCharImage(emo[1], 'plain')}
                                    <td class="char-config-table-image-cell"></td>
                                {:then im}
                                    <td class="char-config-table-image-cell"><img src={im} alt="img" class="char-config-table-image" /></td>
                                {/await}
                                <td class="char-config-table-value-cell">
                                    <TextInput className="char-config-control" size='lg' bind:value={selectedCharacter.emotionImages[i][0]} />
                                </td>
                                <td class="char-config-table-action-cell">
                                    <button class="char-config-icon-action icon-btn icon-btn--sm char-config-icon-action--danger" onclick={() => {
                                        rmCharEmotion($selectedCharID,i)
                                    }} type="button" title="Remove emotion image" aria-label={`Remove emotion image ${i + 1}`}><TrashIcon /></button>
                                </td>

                            </tr>
                        {/each}
                    {/if}
                    </tbody>
                </table>

            </div>

            <div class="char-config-emotion-actions action-rail">
                {#if !$addingEmotion}
                    <button
                        class="char-config-icon-action icon-btn icon-btn--sm char-config-icon-action--success"
                        onclick={() => {addCharEmotion($selectedCharID)}}
                        type="button"
                        title="Add emotion image"
                        aria-label="Add emotion image"
                    >
                        <PlusIcon />
                    </button>
                {:else}
                    <span class="char-config-loading-text">Loading...</span>
                {/if}
            </div>

            {#if editorCharacter!.inlayViewScreen}
                <span class="char-config-label">{language.imgGenInstructions}</span>
                <TextAreaInput highlight bind:value={editorCharacter!.newGenData.emotionInstructions} />
            {/if}

            <CheckInput bind:check={editorCharacter!.inlayViewScreen} name={language.inlayViewScreen} onChange={() => {
                if(selectedCharacter.type === 'character'){
                    if(editorCharacter!.inlayViewScreen && editorCharacter!.additionalAssets === undefined){
                        editorCharacter!.additionalAssets = []
                    }else if(!editorCharacter!.inlayViewScreen && editorCharacter!.additionalAssets.length === 0){
                        editorCharacter!.additionalAssets = []
                    }
                    
                    Object.assign(selectedCharacter, updateInlayScreen(editorCharacter!))
                }
            }}/>
        {/if}
        {:else if viewSubMenu === 2}

            {#if DBState.db.newImageHandlingBeta}
            <CheckInput bind:check={selectedCharacter.prebuiltAssetCommand} name={language.insertAssetPrompt}/>

            {#if selectedCharacter.prebuiltAssetCommand}

            <span class="char-config-label">{language.assetStyle}</span>
            <SelectInput className="char-config-control" bind:value={editorCharacter!.prebuiltAssetStyle}>
                <OptionInput value="">{language.static}</OptionInput>
                <OptionInput value="dynamic">{language.dynamic}</OptionInput>
            </SelectInput>
            {/if}
            {/if}
            <div class="char-config-card panel-shell">
                <table class="char-config-table-contained char-config-table-fixed char-config-table char-config-table-full">
                <tbody>
                    <tr>
                        <th class="char-config-table-head">{language.value}</th>
                        <th class="char-config-table-head char-config-table-action-head">
                            <button class="char-config-icon-action icon-btn icon-btn--sm char-config-icon-action--success" onclick={async () => {
                                if(selectedCharacter.type === 'character'){
                                    const da = await selectMultipleFile(['png', 'webp', 'mp4', 'mp3', 'gif', 'jpeg', 'jpg', 'ttf', 'otf', 'css', 'webm', 'woff', 'woff2', 'svg', 'avif'])
                                    editorCharacter!.additionalAssets = editorCharacter!.additionalAssets ?? []
                                    if(!da){
                                        return
                                    }
                                    for(const f of da){
                                        const img = f.data
                                        const name = f.name
                                        const extension = name.split('.').pop()?.toLowerCase() ?? ''
                                        const imgp = await saveAsset(img,'', extension)
                                        editorCharacter!.additionalAssets.push([name, imgp, extension])
                                        editorCharacter!.additionalAssets = editorCharacter!.additionalAssets
                                    }
                                }
                            }} type="button" title="Add additional assets" aria-label="Add additional assets">
                                <PlusIcon />
                            </button>
                        </th>
                    </tr>
                    {#if (!editorCharacter!.additionalAssets) || editorCharacter!.additionalAssets.length === 0}
                        <tr>
                            <td class="char-config-empty-cell">No Assets</td>
                        </tr>
                    {:else}
                        {#each editorCharacter!.additionalAssets as assets, i (i)}
                            <tr>
                                <td class="char-config-table-value-cell">
                                    {#if assetFilePath[i] && DBState.db.useAdditionalAssetsPreview}
                                        {#if assetFileExtensions[i] === 'mp4'}
                                            <video controls class="char-config-media-preview char-config-media-preview-video"><source src={assetFilePath[i]} type="video/mp4"></video>
                                        {:else if assetFileExtensions[i] === 'mp3'}
                                            <audio controls class="char-config-media-preview char-config-media-preview-audio" loop><source src={assetFilePath[i]} type="audio/mpeg"></audio>
                                        {:else if ['png', 'webp', 'jpeg', 'jpg', 'gif'].includes(assetFileExtensions[i])}
                                            <img src={assetFilePath[i]} class="char-config-media-preview char-config-media-preview-image" alt={assets[0]}/>
                                        {/if}
                                    {/if}
                                    <TextInput className="char-config-control" size="sm" bind:value={editorCharacter!.additionalAssets[i][0]} placeholder="..." />
                                </td>
                                
                                <th class="char-config-table-action-cell">
                                    <button class="char-config-icon-action icon-btn icon-btn--sm char-config-icon-action--accent" onclick={() => {
                                        if(selectedCharacter.type === 'character'){
                                            if (selectedChat) {
                                                selectedChat.fmIndex = -1
                                            }
                                            const additionalAssets = editorCharacter!.additionalAssets ?? []
                                            additionalAssets.splice(i, 1)
                                            editorCharacter!.additionalAssets = additionalAssets
                                        }
                                    }} type="button" title="Remove additional asset" aria-label={`Remove additional asset ${assets[0]}`}>
                                        <TrashIcon />
                                    </button>
                                    {#if DBState.db.useAdditionalAssetsPreview}
                                        <button class="char-config-icon-action icon-btn icon-btn--sm char-config-icon-action--accent" class:is-muted={selectedCharacter.prebuiltAssetExclude?.includes?.(assets[1])} onclick={() => {
                                            selectedCharacter.prebuiltAssetExclude ??= []
                                            if(selectedCharacter.prebuiltAssetExclude.includes(assets[1])){
                                                selectedCharacter.prebuiltAssetExclude = selectedCharacter.prebuiltAssetExclude.filter((e) => e !== assets[1])
                                            }
                                            else {
                                                selectedCharacter.prebuiltAssetExclude.push(assets[1])
                                            }
                                        }} type="button" title="Toggle additional asset visibility" aria-label={`Toggle additional asset visibility for ${assets[0]}`}>
                                            {#if DBState.db.characters[$selectedCharID]?.prebuiltAssetExclude?.includes?.(assets[1])}
                                                <ImageOffIcon />
                                            {:else}
                                                <ImageIcon />
                                            {/if}
                                        </button>
                                    {/if}
                                </th>
                            </tr>
                        {/each}
                    {/if}
                </tbody>
                </table>
            </div>
        {/if}
    </div>
{:else if $CharConfigSubMenu === 3}
    <div class="char-config-section" role="tabpanel" id="char-config-panel-3" aria-labelledby="char-config-tab-3" tabindex="0">
        {#if !$MobileGUI}
            <h2 class="char-config-title">{language.loreBook} <Help key="lorebook"/></h2>
        {/if}
        <LoreBook includeRulebookTab={false} />
    </div>
{:else if $CharConfigSubMenu === 8}
    <div class="char-config-section" role="tabpanel" id="char-config-panel-8" aria-labelledby="char-config-tab-8" tabindex="0">
        {#if !$MobileGUI}
            <h2 class="char-config-title">Rulebooks</h2>
        {/if}
        {#if selectedCharacter.type === 'character'}
            <RulebookRagSetting />
        {/if}
    </div>
{:else if $CharConfigSubMenu === 4}
    <div class="char-config-section" role="tabpanel" id="char-config-panel-4" aria-labelledby="char-config-tab-4" tabindex="0">
        {#if selectedCharacter.type === 'character'}
            {#if !$MobileGUI}
                <h2 class="char-config-title">{language.scripts}</h2>
            {/if}

            <span class="char-config-label">{language.backgroundHTML} <Help key="backgroundHTML" /></span>
            <TextAreaInput highlight margin="both" autocomplete="off" bind:value={editorCharacter!.backgroundHTML}></TextAreaInput>

            <span class="char-config-label">{language.regexScript} <Help key="regexScript"/></span>
            <RegexList bind:value={selectedCharacter.customscript} />
            <div class="char-config-script-actions action-rail">
                <button class="char-config-icon-action icon-btn icon-btn--sm char-config-icon-action--success" onclick={() => {
                    if(selectedCharacter.type === 'character'){
                        const script = selectedCharacter.customscript
                        script.push({
                        comment: "",
                        in: "",
                        out: "",
                        type: "editinput"
                        })
                        selectedCharacter.customscript = script
                    }
                }} type="button" title="Add regex script row" aria-label="Add regex script row"><PlusIcon /></button>
                <button class="char-config-icon-action icon-btn icon-btn--sm char-config-icon-action--success" onclick={() => {
                    exportRegex(selectedCharacter.customscript)
                }} type="button" title="Export regex scripts" aria-label="Export regex scripts"><DownloadIcon /></button>
                <button class="char-config-icon-action icon-btn icon-btn--sm char-config-icon-action--success" onclick={async () => {
                    selectedCharacter.customscript = await importRegex(selectedCharacter.customscript)
                }} type="button" title="Import regex scripts" aria-label="Import regex scripts"><HardDriveUploadIcon /></button>
            </div>

            <span class="char-config-label">{language.triggerScript} <Help key="triggerScript"/></span>
            <TriggerList bind:value={editorCharacter!.triggerscript} lowLevelAble={selectedCharacter.lowLevelAccess} />


            {#if editorCharacter!.virtualscript || DBState.db.showUnrecommended}
                <span class="char-config-label">{language.charjs} <Help key="charjs" unrecommended/></span>
                <TextAreaInput margin="both" autocomplete="off" bind:value={editorCharacter!.virtualscript}></TextAreaInput>
            {/if}
        {/if}
    </div>
{:else if $CharConfigSubMenu === 6}
    <div class="char-config-section" role="tabpanel" id="char-config-panel-6" aria-labelledby="char-config-tab-6" tabindex="0">
        {#if selectedCharacter.license !== 'CC BY-NC-SA 4.0'
            && selectedCharacter.license !== 'CC BY-SA 4.0'
            && selectedCharacter.license !== 'CC BY-ND 4.0'
            && selectedCharacter.license !== 'CC BY-NC-ND 4.0'
            }
            <Button size="sm" onclick={async () => {
                await exportChar($selectedCharID)
            }} className="char-config-control">{language.exportCharacter}</Button>
        {/if}

        <Button onclick={async () => {
            removeChar($selectedCharID, selectedCharacter.name)
        }} className="char-config-control" size="sm">{ selectedCharacter.type === 'group' ? language.removeGroup : language.removeCharacter}</Button>
    </div>
    
{:else if $CharConfigSubMenu === 5}
    <div class="char-config-section" role="tabpanel" id="char-config-panel-5" aria-labelledby="char-config-tab-5" tabindex="0">
    {#if selectedCharacter.type === 'character'}
        {#if !$MobileGUI}
            <h2 class="char-config-title">TTS</h2>
        {/if}
        <span class="char-config-label">{language.provider}</span>
        <SelectInput className="char-config-control" bind:value={editorCharacter!.ttsMode} onchange={(_e) => {
            if(selectedCharacter.type === 'character'){
                editorCharacter!.ttsSpeech = ''
            }
        }}>
            <OptionInput value="">{language.disabled}</OptionInput>
            <OptionInput value="elevenlab">ElevenLabs</OptionInput>
            <OptionInput value="webspeech">Web Speech</OptionInput>
            <OptionInput value="VOICEVOX">VOICEVOX</OptionInput>
            <OptionInput value="openai">OpenAI</OptionInput>
            <OptionInput value="novelai">NovelAI</OptionInput>
            <OptionInput value="huggingface">Huggingface</OptionInput>
            <OptionInput value="vits">VITS</OptionInput>
            <OptionInput value="gptsovits">GPT-SoVITS</OptionInput>
            <OptionInput value="fishspeech">fish-speech</OptionInput>
        </SelectInput>
        

        {#if editorCharacter!.ttsMode === 'webspeech'}
            {#if !speechSynthesis}
                <span class="char-config-label">Web Speech isn't supported in your browser or OS</span>
            {:else}
                <span class="char-config-label">{language.Speech}</span>
                <SelectInput className="char-config-control" bind:value={editorCharacter!.ttsSpeech}>
                    <OptionInput value="">Auto</OptionInput>
                    {#each getWebSpeechTTSVoices() as voice (voice)}
                        <OptionInput value={voice}>{voice}</OptionInput>
                    {/each}
                </SelectInput>
                {#if editorCharacter!.ttsSpeech !== ''}
                    <span class="char-config-note-danger">If you do not set it to Auto, it may not work properly when importing from another OS or browser.</span>
                {/if}
            {/if}
        {:else if editorCharacter!.ttsMode === 'elevenlab'}
            <span class="char-config-note-sm">Please set the ElevenLabs API key in "global Settings → Bot Settings → Others → ElevenLabs API key"</span>
            {#await getElevenTTSVoices() then voices}
                <span class="char-config-label">{language.Speech}</span>
                <SelectInput className="char-config-control" bind:value={editorCharacter!.ttsSpeech}>
                    <OptionInput value="">Unset</OptionInput>
                        {#each voices as voice (voice.voice_id)}
                            <OptionInput value={voice.voice_id}>{voice.name}</OptionInput>
                        {/each}
                </SelectInput>
            {/await}
         {:else if editorCharacter!.ttsMode === 'VOICEVOX'}
                <span class="char-config-label">Speaker</span>
                <SelectInput className="char-config-control" bind:value={editorCharacter!.voicevoxConfig.speaker}>
                    {#await getVOICEVOXVoices() then voices}
                        {#each voices as voice (voice.list)}
                            <OptionInput value={voice.list}  selected={editorCharacter!.voicevoxConfig.speaker === voice.list}>{voice.name}</OptionInput>
                        {/each}
                    {/await}
                </SelectInput>
                {#if editorCharacter!.voicevoxConfig.speaker}
                <span class="char-config-label-muted">Style</span>
                <SelectInput className="char-config-control" bind:value={editorCharacter!.ttsSpeech}>
                {#each JSON.parse(editorCharacter!.voicevoxConfig.speaker) as styles (styles.id)}
                        <OptionInput value={styles.id} selected={editorCharacter!.ttsSpeech === styles.id}>{styles.name}</OptionInput>
                {/each}
                </SelectInput>
                {/if}
                <span class="char-config-label">Speed scale</span>
                <NumberInput className="char-config-control" size="sm" bind:value={editorCharacter!.voicevoxConfig.SPEED_SCALE}/>

                <span class="char-config-label">Pitch scale</span>
                <NumberInput className="char-config-control" size="sm" bind:value={editorCharacter!.voicevoxConfig.PITCH_SCALE}/>

                <span class="char-config-label">Volume scale</span>
                <NumberInput className="char-config-control" size="sm" bind:value={editorCharacter!.voicevoxConfig.VOLUME_SCALE}/>

                <span class="char-config-label">Intonation scale</span>
                <NumberInput className="char-config-control" size="sm" bind:value={editorCharacter!.voicevoxConfig.INTONATION_SCALE}/>
                <span class="char-config-note-sm">To use VOICEVOX, you need to run a colab and put the localtunnel URL in "Settings → Other Bots". https://colab.research.google.com/drive/1tyeXJSklNfjW-aZJAib1JfgOMFarAwze</span>
        {:else if editorCharacter!.ttsMode === 'novelai'}
            <span class="char-config-label">Custom Voice Seed</span>
            <Check bind:check={editorCharacter!.naittsConfig.customvoice}/>
            {#if !editorCharacter!.naittsConfig.customvoice}
                <span class="char-config-label">Voice</span>
                    <SelectInput className="char-config-control" bind:value={editorCharacter!.naittsConfig.voice}>
                    {#await getNovelAIVoices() then voices}
                        {#each voices as voiceGroup, voiceGroupIndex (voiceGroupIndex)}
                            <optgroup label={voiceGroup.gender} class="char-config-optgroup">
                                {#each voiceGroup.voices as voice (voice)}
                                    <OptionInput value={voice} selected={editorCharacter!.naittsConfig.voice === voice}>{voice}</OptionInput>
                                {/each}
                            </optgroup>
                        {/each}
                    {/await}
                </SelectInput>
            {:else}
                <span class="char-config-label">Voice</span>
                <TextInput size="sm" bind:value={editorCharacter!.naittsConfig.voice}/>
            {/if}
            <span class="char-config-label">Version</span>
            <SelectInput className="char-config-control" bind:value={editorCharacter!.naittsConfig.version}>
                <OptionInput value="v1">v1</OptionInput>
                <OptionInput value="v2">v2</OptionInput>
            </SelectInput>
        {:else if editorCharacter!.ttsMode === 'openai'}
            <SelectInput className="char-config-control" bind:value={editorCharacter!.oaiVoice}>
                <OptionInput value="">Unset</OptionInput>
                {#each oaiVoices as voice (voice)}
                    <OptionInput value={voice}>{voice}</OptionInput>
                {/each}
            </SelectInput>
        {:else if editorCharacter!.ttsMode === 'huggingface'}
            <span class="char-config-label">Model</span>
            <TextInput className="char-config-control" bind:value={editorCharacter!.hfTTS.model} />

            <span class="char-config-label">Language</span>
            <TextInput className="char-config-control" bind:value={editorCharacter!.hfTTS.language} placeholder="en" />
        {:else if editorCharacter!.ttsMode === 'vits'}
            {#if selectedCharacter.vits}
                <span class="char-config-label">{selectedCharacter.vits.name ?? 'Unnamed VitsModel'}</span>
            {:else}
                <span class="char-config-label">No Model</span>
            {/if}
            <Button onclick={async () => {
                const model = await registerOnnxModel()
                if(model && selectedCharacter.type === 'character'){
                    selectedCharacter.vits = model
                }
            }}>{language.selectModel}</Button>
        {:else if editorCharacter!.ttsMode === 'gptsovits'}
            <span class="char-config-label">Volume</span>
            <SliderInput min={0.0} max={1.0} step={0.01} fixed={2} bind:value={editorCharacter!.gptSoVitsConfig.volume}/>
            <span class="char-config-label">URL</span>
            <TextInput className="char-config-control" bind:value={editorCharacter!.gptSoVitsConfig.url}/>

            <span class="char-config-label">Use Auto Path</span>
            <Check bind:check={editorCharacter!.gptSoVitsConfig.use_auto_path}/>

            {#if !editorCharacter!.gptSoVitsConfig.use_auto_path}
                <span class="char-config-label">Reference Audio Path (e.g. C:/Users/user/Downloads/GPT-SoVITS-v2-240821)</span>
                <TextInput className="char-config-control" bind:value={editorCharacter!.gptSoVitsConfig.ref_audio_path}/>
            {/if}

            <span class="char-config-label">Use Long Audio</span>
            <Check bind:check={editorCharacter!.gptSoVitsConfig.use_long_audio}/>

            <span class="char-config-label">Reference Audio Data (3~10s audio file)</span>
            <Button onclick={async () => {
                const audio = await selectSingleFile([
                    'wav',
                    'ogg',
                    'aac',
                    'mp3'
                ])
                if(!audio){
                    return null
                }
                const saveId = await saveAsset(audio.data)
                editorCharacter!.gptSoVitsConfig.ref_audio_data = {
                    fileName: audio.name,
                    assetId: saveId
                }

            }}
            className="char-config-control char-config-file-button">
                
                {#if editorCharacter!.gptSoVitsConfig.ref_audio_data.assetId === '' || editorCharacter!.gptSoVitsConfig.ref_audio_data.assetId === undefined}
                    {language.selectFile}
                {:else}
                    {editorCharacter!.gptSoVitsConfig.ref_audio_data.fileName}
                {/if}
            </Button>
            <span class="char-config-label">Text Language</span>
            <SelectInput className="char-config-control" bind:value={editorCharacter!.gptSoVitsConfig.text_lang}>
                <OptionInput value="auto">Multi-language Mixed</OptionInput>
                <OptionInput value="auto_yue">Multi-language Mixed (Cantonese)</OptionInput>
                <OptionInput value="en">English</OptionInput>
                <OptionInput value="zh">Chinese-English Mixed</OptionInput>
                <OptionInput value="ja">Japanese-English Mixed</OptionInput>
                <OptionInput value="yue">Cantonese-English Mixed</OptionInput>
                <OptionInput value="ko">Korean-English Mixed</OptionInput>
                <OptionInput value="all_zh">Chinese</OptionInput>
                <OptionInput value="all_ja">Japanese</OptionInput>
                <OptionInput value="all_yue">Cantonese</OptionInput>
                <OptionInput value="all_ko">Korean</OptionInput>
            </SelectInput>

            {#if !editorCharacter!.gptSoVitsConfig.use_long_audio}
                <span class="char-config-label">Use Reference Audio Script</span>
                <Check bind:check={editorCharacter!.gptSoVitsConfig.use_prompt}/>
            {/if}

            {#if editorCharacter!.gptSoVitsConfig.use_prompt && !editorCharacter!.gptSoVitsConfig.use_long_audio}
                <span class="char-config-label">Reference Audio Script</span>
                <TextAreaInput className="char-config-control" bind:value={editorCharacter!.gptSoVitsConfig.prompt}/>
            {/if}

            <span class="char-config-label">Reference Audio Language</span>
            <SelectInput className="char-config-control" bind:value={editorCharacter!.gptSoVitsConfig.prompt_lang}>
                <OptionInput value="auto">Multi-language Mixed</OptionInput>
                <OptionInput value="auto_yue">Multi-language Mixed (Cantonese)</OptionInput>
                <OptionInput value="en">English</OptionInput>
                <OptionInput value="zh">Chinese-English Mixed</OptionInput>
                <OptionInput value="ja">Japanese-English Mixed</OptionInput>
                <OptionInput value="yue">Cantonese-English Mixed</OptionInput>
                <OptionInput value="ko">Korean-English Mixed</OptionInput>
                <OptionInput value="all_zh">Chinese</OptionInput>
                <OptionInput value="all_ja">Japanese</OptionInput>
                <OptionInput value="all_yue">Cantonese</OptionInput>
                <OptionInput value="all_ko">Korean</OptionInput>
            </SelectInput>
            <span class="char-config-label">Top P</span>
            <SliderInput min={0.0} max={1.0} step={0.05} fixed={2} bind:value={editorCharacter!.gptSoVitsConfig.top_p}/>

            <span class="char-config-label">Temperature</span>
            <SliderInput min={0.0} max={1.0} step={0.05} fixed={2} bind:value={editorCharacter!.gptSoVitsConfig.temperature}/>

            <span class="char-config-label">Speed</span>
            <SliderInput min={0.6} max={1.65} step={0.05} fixed={2} bind:value={editorCharacter!.gptSoVitsConfig.speed}/>

            <span class="char-config-label">Top K</span>
            <SliderInput min={1} max={100} step={1} bind:value={editorCharacter!.gptSoVitsConfig.top_k}/>

            <span class="char-config-label">Text Split Method</span>
            <SelectInput className="char-config-control" bind:value={editorCharacter!.gptSoVitsConfig.text_split_method}>
                <OptionInput value="cut0">Cut 0 (No splitting)</OptionInput>
                <OptionInput value="cut1">Cut 1 (Split every 4 sentences)</OptionInput>
                <OptionInput value="cut2">Cut 2 (Split every 50 characters)</OptionInput>
                <OptionInput value="cut3">Cut 3 (Split by Chinese periods)</OptionInput>
                <OptionInput value="cut4">Cut 4 (Split by English periods)</OptionInput>
                <OptionInput value="cut5">Cut 5 (Split by various punctuation marks)</OptionInput>
            </SelectInput>        
        {:else if editorCharacter!.ttsMode === 'fishspeech'}
            {#await getFishSpeechModels()}
                <span class="char-config-label">Loading...</span>
            {:then}
                <span class="char-config-label">Model</span>
                <SelectInput className="char-config-control" bind:value={editorCharacter!.fishSpeechConfig.model._id}>
                    <OptionInput value="">Not selected</OptionInput>
                    {#each fishSpeechModels as model (model._id)}
                        <OptionInput value={model._id}>
                            <div class="char-config-option-row">
                                <span>{model.title}</span>
                                <span class="char-config-option-description">{model.description}</span>
                            </div>
                        </OptionInput>
                    {/each}
                </SelectInput>
            {:catch}
                <span class="char-config-label">An error occurred while fetching the models.</span>
            {/await}

            <span class="char-config-label">Chunk Length</span>
            <NumberInput className="char-config-control" bind:value={editorCharacter!.fishSpeechConfig.chunk_length}/>

            <span class="char-config-label">Normalize</span>
            <Check className="char-config-control" bind:check={editorCharacter!.fishSpeechConfig.normalize}/>
        {/if}
        {#if editorCharacter!.ttsMode}
            <div class="char-config-check-row">
                <Check bind:check={selectedCharacter.ttsReadOnlyQuoted} name={language.ttsReadOnlyQuoted}/>
            </div>
        {/if}
    {/if}
    </div>
{:else if $CharConfigSubMenu === 2}
    <div class="char-config-section" role="tabpanel" id="char-config-panel-2" aria-labelledby="char-config-tab-2" tabindex="0">
        {#if !$MobileGUI}
            <h2 class="char-config-title">{language.advancedSettings}</h2>
        {/if}
        {#if selectedCharacter.type !== 'group'}
        <span class="char-config-label">Bias <Help key="bias"/></span>
        <div class="char-config-card panel-shell">

        <table class="char-config-table-fixed char-config-table char-config-table-full">
            <tbody>
            <tr>
                <th class="char-config-table-head">Bias</th>
                <th class="char-config-table-head char-config-table-col-image">{language.value}</th>
                <th class="char-config-table-head char-config-table-action-head">
                    <button class="char-config-icon-action icon-btn icon-btn--sm char-config-icon-action--success" onclick={() => {
                        if(selectedCharacter.type === 'character'){
                            editorCharacter!.bias.push(['', 0])
                        }
                    }} type="button" title="Add bias row" aria-label="Add bias row"><PlusIcon /></button>
                </th>
            </tr>
            {#if editorCharacter!.bias.length === 0}
                <tr>
                    <td class="char-config-empty-cell" colspan="3">{language.noBias}</td>

                </tr>
            {/if}
                {#each editorCharacter!.bias as _bias, i (i)}
                    <tr class="char-config-table-center-row">
                        <td class="char-config-table-value-cell">
                            <TextInput fullh fullwidth bind:value={editorCharacter!.bias[i][0]} placeholder="string" />
                            <span class="char-config-token-note">{tokens.bias[i] ?? 0} {language.tokens}</span>
                        </td> 
                        <td class="char-config-table-value-cell">
                            <NumberInput fullh fullwidth bind:value={editorCharacter!.bias[i][1]} max={100} min={-100} />
                    </td>
                    <td class="char-config-table-action-cell">
                        <button class="char-config-icon-action icon-btn icon-btn--sm char-config-icon-action--success" onclick={() => {
                            if(selectedCharacter.type === 'character'){
                                editorCharacter!.bias.splice(i, 1)
                            }
                        }} type="button" title="Remove bias row" aria-label={`Remove bias row ${i + 1}`}><TrashIcon /></button>
                    </td>
                </tr>
            {/each}
            </tbody>
            
        </table>
        </div>

        <span class="char-config-label">{language.exampleMessage} <Help key="exampleMessage"/></span>
        <TextAreaInput highlight margin="both" autocomplete="off" bind:value={selectedCharacter.exampleMessage}></TextAreaInput>
        <span class="char-config-token-note">{tokens.exampleMessage} {language.tokens}</span>

        <span class="char-config-label">{language.creatorNotes} <Help key="creatorQuotes"/></span>
        <MultiLangInput bind:value={selectedCharacter.creatorNotes} className="char-config-control" onInput={() => {
            selectedCharacter.removedQuotes = false
        }}></MultiLangInput>
        <span class="char-config-token-note">{tokens.creatorNotes} {language.tokens}</span>

        <span class="char-config-label">{language.additionalText} <Help key="additionalText" /></span>
        <TextAreaInput highlight margin="both" autocomplete="off" bind:value={selectedCharacter.additionalText}></TextAreaInput>
        <span class="char-config-token-note">{tokens.additionalText} {language.tokens}</span>

        <span class="char-config-label">{language.defaultVariables} <Help key="defaultVariables" /></span>
        <TextAreaInput margin="both" autocomplete="off" bind:value={editorCharacter!.defaultVariables}></TextAreaInput>
        <span class="char-config-token-note">{tokens.defaultVariables} {language.tokens}</span>

        <span class="char-config-label">{language.translatorNote} <Help key="translatorNote" /></span>
        <TextAreaInput margin="both" autocomplete="off" bind:value={editorCharacter!.translatorNote}></TextAreaInput>
        <span class="char-config-token-note">{tokens.translatorNote} {language.tokens}</span>

        <span class="char-config-label">{language.creator}</span>
        <TextInput size="sm" autocomplete="off" bind:value={editorCharacter!.additionalData.creator} />
        <span class="char-config-token-note">{tokens.creator} {language.tokens}</span>

        <span class="char-config-label">{language.CharVersion}</span>
        <TextInput size="sm" bind:value={editorCharacter!.additionalData.character_version}/>
        <span class="char-config-token-note">{tokens.charVersion} {language.tokens}</span>

        <span class="char-config-label">{language.nickname} <Help key="nickname" /></span>
        <TextInput size="sm" bind:value={editorCharacter!.nickname}/>
        <span class="char-config-token-note">{tokens.nickname} {language.tokens}</span>

        <span class="char-config-label">{language.depthPrompt}</span>
        <div class="char-config-depth-row">
            <NumberInput size="sm" bind:value={editorCharacter!.depth_prompt.depth} className="char-config-control char-config-depth-number"/>
            <TextInput size="sm" bind:value={editorCharacter!.depth_prompt.prompt} className="char-config-control char-config-depth-text"/>
        </div>
        <span class="char-config-token-note">{tokens.depthPrompt} {language.tokens}</span>

        <div class="char-config-check-row">
            <Check bind:check={selectedCharacter.lowLevelAccess} name={language.lowLevelAccess}/>
            <span> <Help key="lowLevelAccess" name={language.lowLevelAccess}/></span>
        </div>

        <div class="char-config-check-row">
            <Check bind:check={selectedCharacter.hideChatIcon} name={language.hideChatIcon}/>
        </div>

        <div class="char-config-check-row">
            <Check bind:check={selectedCharacter.utilityBot} name={language.utilityBot}/>
            <span> <Help key="utilityBot" name={language.utilityBot}/></span>
        </div>

        <div class="char-config-check-row">
            <Check bind:check={selectedCharacter.escapeOutput} name={language.escapeOutput}/>
        </div>

        <Button
            onclick={applyModule}
            className="char-config-control"
        >
            {language.applyModule}
        </Button>

    {:else}
        <div class="char-config-check-row">
            <Check bind:check={selectedCharacter.lowLevelAccess} name={language.lowLevelAccess}/>
            <span> <Help key="lowLevelAccess" name={language.lowLevelAccess}/></span>
        </div>
    {/if}
    </div>
{:else if $CharConfigSubMenu === 7}
    <div class="char-config-section" role="tabpanel" id="char-config-panel-7" aria-labelledby="char-config-tab-7" tabindex="0">
        {#if !$MobileGUI}
            <h2 class="char-config-title">Game State</h2>
        {/if}
        <GameStateEditor />
    </div>
{/if}

{/if}
{/if}
</div>

<style>
    .char-config-root {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
        width: 100%;
        box-sizing: border-box;
        min-width: 0;
        min-height: 100%;
        overflow-x: hidden;
    }

    .char-config-tabs {
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: minmax(0, 1fr);
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        align-items: center;
        gap: 2px;
        padding: 4px;
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-md);
        background: var(--ds-surface-2);
        overflow-x: hidden;
        overflow-y: hidden;
        flex-wrap: nowrap;
        scrollbar-width: thin;
    }

    .char-config-empty {
        color: var(--ds-text-secondary);
        padding: var(--ds-space-3);
    }

    .char-config-tab {
        width: 100%;
        height: 24px;
        min-width: 0;
        min-height: 24px;
        padding: 0;
        border: 0;
        border-radius: var(--ds-radius-sm);
        color: var(--ds-text-secondary);
        background: transparent;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: color var(--ds-motion-fast) var(--ds-ease-standard),
            background-color var(--ds-motion-fast) var(--ds-ease-standard),
            border-color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .char-config-tab:hover {
        color: var(--ds-text-primary);
        background: var(--ds-surface-active);
    }

    .char-config-tab.active {
        color: var(--ds-text-primary);
        background: var(--ds-surface-active);
    }

    .char-config-section {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
        padding-block: var(--ds-space-1);
        width: 100%;
        max-width: 100%;
        min-width: 0;
        box-sizing: border-box;
    }

    .char-config-title {
        margin: 0;
        font-size: var(--ds-font-size-xl);
        font-weight: var(--ds-font-weight-semibold);
        color: var(--ds-text-primary);
    }

    .char-config-section > :not(style) {
        margin-top: 0;
        margin-bottom: 0;
    }

    .char-config-section :global(.mt-1),
    .char-config-section :global(.mt-2),
    .char-config-section :global(.mt-4),
    .char-config-section :global(.mt-6),
    .char-config-section :global(.my-2) {
        margin-top: 0 !important;
    }

    .char-config-section :global(.mb-2),
    .char-config-section :global(.mb-4),
    .char-config-section :global(.mb-6),
    .char-config-section :global(.my-2) {
        margin-bottom: 0 !important;
    }

    .char-config-section :global(.ds-input-margin-top),
    .char-config-section :global(.ds-input-margin-top-sm),
    .char-config-section :global(.ds-input-margin-bottom),
    .char-config-section :global(.ds-input-margin-bottom-sm) {
        margin-top: 0 !important;
        margin-bottom: 0 !important;
    }

    :global(.char-config-control) {
        margin-top: 0 !important;
        margin-bottom: 0 !important;
    }

    .char-config-card {
        width: 100%;
        max-width: 100%;
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-md);
        background: var(--ds-surface-1);
        padding: var(--ds-space-2);
    }

    .char-config-table {
        margin-top: 0;
    }

    .char-config-check-row {
        display: flex;
        align-items: center;
        gap: var(--ds-space-2);
        margin: 0;
    }

    .char-config-icon-action {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: var(--ds-height-control-sm);
        min-width: var(--ds-height-control-sm);
        height: var(--ds-height-control-sm);
        border-radius: var(--ds-radius-sm);
        color: var(--ds-text-secondary);
        transition: color var(--ds-motion-fast) var(--ds-ease-standard),
            background-color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .char-config-icon-action:hover {
        color: var(--ds-text-primary);
        background: var(--ds-surface-active);
    }

    .char-config-icon-action:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .char-config-icon-action--compact {
        width: calc(var(--ds-height-control-sm) - var(--ds-space-1));
        min-width: calc(var(--ds-height-control-sm) - var(--ds-space-1));
        height: calc(var(--ds-height-control-sm) - var(--ds-space-1));
    }

    .char-config-icon-action--success:hover {
        color: var(--risu-theme-draculagreen);
    }

    .char-config-icon-action--accent:hover {
        color: var(--risu-theme-draculacyan);
    }

    .char-config-icon-action--danger:hover {
        color: var(--risu-theme-draculared);
    }

    .char-config-media-preview {
        border-radius: var(--ds-radius-sm);
        display: block;
    }

    .char-config-media-preview-video {
        width: 100%;
        margin: var(--ds-space-1);
        padding-inline: var(--ds-space-2);
    }

    .char-config-media-preview-audio {
        width: 100%;
        height: 4rem;
        margin: var(--ds-space-1);
        padding-inline: var(--ds-space-2);
    }

    .char-config-media-preview-image {
        width: 4rem;
        height: 4rem;
        margin: var(--ds-space-1);
    }

    .char-config-subtabs {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        width: 100%;
        margin-top: 0;
        margin-bottom: 0;
        gap: 0;
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-md);
        background: var(--ds-surface-2);
        overflow: hidden;
    }

    .char-config-subtab {
        min-width: 0;
        min-height: var(--ds-height-control-sm);
        padding: var(--ds-space-2);
        border: 0;
        border-right: 1px solid var(--ds-border-subtle);
        border-radius: 0;
        color: var(--ds-text-secondary);
        background: transparent;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        transition: color var(--ds-motion-fast) var(--ds-ease-standard),
            background-color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .char-config-subtab:last-child {
        border-right: 0;
    }

    .char-config-subtab:hover {
        color: var(--ds-text-primary);
    }

    .char-config-subtab.active {
        color: var(--ds-text-primary);
        background: var(--ds-surface-active);
    }

    :global(.char-config-tab :global(svg)) {
        width: 14px;
        height: 14px;
        flex: 0 0 auto;
    }

    @media (min-width: 1400px) {
        .char-config-tabs {
            gap: var(--ds-space-2);
        }

        .char-config-tab {
            width: 100%;
            height: 36px;
            min-width: 0;
            min-height: 36px;
        }

        :global(.char-config-tab :global(svg)) {
            width: 20px;
            height: 20px;
        }
    }

    :global(.ds-mobile-sidepanel-shell) .char-config-root {
        gap: var(--ds-space-3);
        padding-bottom: calc(var(--ds-space-4) + env(safe-area-inset-bottom));
    }

    :global(.ds-mobile-sidepanel-shell) .char-config-root > :not(style) {
        width: 100%;
        min-width: 0;
    }

    :global(.ds-mobile-sidepanel-shell) .char-config-section {
        gap: var(--ds-space-3);
        padding-block: var(--ds-space-1);
    }

    :global(.ds-mobile-sidepanel-shell) .char-config-section > :not(style) {
        margin-top: 0 !important;
        margin-bottom: 0 !important;
    }

    :global(.ds-mobile-sidepanel-shell) .char-config-section :global(.mt-1),
    :global(.ds-mobile-sidepanel-shell) .char-config-section :global(.mt-2),
    :global(.ds-mobile-sidepanel-shell) .char-config-section :global(.mt-4),
    :global(.ds-mobile-sidepanel-shell) .char-config-section :global(.mt-6),
    :global(.ds-mobile-sidepanel-shell) .char-config-section :global(.my-2) {
        margin-top: 0 !important;
    }

    :global(.ds-mobile-sidepanel-shell) .char-config-section :global(.mb-2),
    :global(.ds-mobile-sidepanel-shell) .char-config-section :global(.mb-4),
    :global(.ds-mobile-sidepanel-shell) .char-config-section :global(.mb-6),
    :global(.ds-mobile-sidepanel-shell) .char-config-section :global(.my-2) {
        margin-bottom: 0 !important;
    }

    :global(.ds-mobile-sidepanel-shell) .char-config-section :global(.ds-input-margin-top),
    :global(.ds-mobile-sidepanel-shell) .char-config-section :global(.ds-input-margin-top-sm),
    :global(.ds-mobile-sidepanel-shell) .char-config-section :global(.ds-input-margin-bottom),
    :global(.ds-mobile-sidepanel-shell) .char-config-section :global(.ds-input-margin-bottom-sm) {
        margin-top: 0 !important;
        margin-bottom: 0 !important;
    }

    @media (max-width: 1023px) {
        .char-config-tabs {
            grid-auto-columns: minmax(2.5rem, max-content);
            justify-content: start;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
        }

        .char-config-tab {
            min-width: 2.5rem;
        }

        .char-config-root {
            gap: var(--ds-space-3);
            padding-bottom: calc(var(--ds-space-4) + env(safe-area-inset-bottom));
        }

        .char-config-root > :not(style) {
            width: 100%;
            min-width: 0;
        }

        .char-config-section {
            gap: var(--ds-space-3);
            padding-block: var(--ds-space-1);
        }

        .char-config-section > :not(style) {
            margin-top: 0 !important;
            margin-bottom: 0 !important;
        }

        /* Normalize legacy utility-margin drift across Character tabs on mobile. */
        .char-config-section :global(.mt-1),
        .char-config-section :global(.mt-2),
        .char-config-section :global(.mt-4),
        .char-config-section :global(.mt-6),
        .char-config-section :global(.my-2) {
            margin-top: 0 !important;
        }

        .char-config-section :global(.mb-2),
        .char-config-section :global(.mb-4),
        .char-config-section :global(.mb-6),
        .char-config-section :global(.my-2) {
            margin-bottom: 0 !important;
        }

        /* Normalize primitive-level margin helpers to shared section gaps on mobile. */
        .char-config-section :global(.ds-input-margin-top),
        .char-config-section :global(.ds-input-margin-top-sm),
        .char-config-section :global(.ds-input-margin-bottom),
        .char-config-section :global(.ds-input-margin-bottom-sm) {
            margin-top: 0 !important;
            margin-bottom: 0 !important;
        }

    }

    :global(.char-config-file-button) {
        min-height: calc(var(--ds-height-control-sm) + var(--ds-space-1));
        height: calc(var(--ds-height-control-sm) + var(--ds-space-1));
    }

    .char-config-table-fixed {
        table-layout: fixed;
    }

    .char-config-table-fixed td {
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .char-config-table-contained {
        contain: content;
    }

    .char-config-table-full {
        width: 100%;
        max-width: 100%;
    }

    .char-config-table-head {
        font-weight: var(--ds-font-weight-medium);
        text-align: left;
    }

    .char-config-table-col-image {
        width: 33.3333%;
    }

    .char-config-table-col-emotion {
        width: 50%;
    }

    .char-config-table-image-cell {
        width: 33.3333%;
        font-weight: var(--ds-font-weight-medium);
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .char-config-table-image {
        width: 100%;
        display: block;
    }

    .char-config-table-value-cell {
        font-weight: var(--ds-font-weight-medium);
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .char-config-table-action-head {
        width: calc(var(--ds-space-4) * 2.5);
        text-align: center;
        cursor: pointer;
    }

    .char-config-table-action-cell {
        width: calc(var(--ds-space-4) * 2.5);
        text-align: center;
        vertical-align: middle;
        cursor: pointer;
    }

    .char-config-empty-cell {
        color: var(--ds-text-secondary);
    }

    .char-config-table-center-row {
        text-align: center;
        vertical-align: middle;
    }

    .char-config-group-layout {
        display: grid;
        grid-template-columns: auto 1fr auto;
    }

    .char-config-group-grid {
        gap: var(--ds-space-2);
        padding: var(--ds-space-4);
        border-radius: var(--ds-radius-md);
        background: var(--ds-surface-1);
    }

    .char-config-group-header {
        text-align: center;
    }

    .char-config-group-talk-row {
        display: flex;
        align-items: center;
        padding-inline: var(--ds-space-2);
        padding-block: var(--ds-space-3);
    }

    .char-config-group-talk-segment {
        height: 100%;
        flex: 1 1 0;
        border-right: 1px solid var(--ds-surface-1);
        background: var(--ds-surface-active);
    }

    .char-config-group-talk-segment.is-active {
        background: var(--color-success-500);
    }

    .char-config-group-talk-segment.is-first {
        border-top-left-radius: var(--ds-radius-md);
        border-bottom-left-radius: var(--ds-radius-md);
    }

    .char-config-group-talk-segment.is-last {
        border-right: 0;
        border-top-right-radius: var(--ds-radius-md);
        border-bottom-right-radius: var(--ds-radius-md);
    }

    .char-config-group-check-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .char-config-group-add-row {
        display: flex;
        color: var(--ds-text-secondary);
    }

    .char-config-group-add-button {
        cursor: pointer;
        transition: color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .char-config-group-add-button:hover {
        color: var(--ds-text-primary);
    }

    .char-config-script-actions {
        display: flex;
        gap: var(--ds-space-2);
        color: var(--ds-text-secondary);
    }

    .char-config-option-row {
        display: flex;
        align-items: center;
        gap: var(--ds-space-2);
    }

    .char-config-option-description {
        font-size: var(--ds-font-size-sm);
        color: var(--ds-text-secondary);
    }

    .char-config-label {
        display: block;
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        color: var(--ds-text-primary);
        overflow-wrap: anywhere;
        word-break: break-word;
    }

    .char-config-label-muted {
        color: var(--ds-text-secondary);
    }

    .char-config-optgroup {
        background: var(--ds-surface-2);
    }

    .char-config-token-note {
        font-size: var(--ds-font-size-sm);
        color: var(--ds-text-secondary);
    }

    .char-config-note-sm {
        font-size: var(--ds-font-size-sm);
        color: var(--ds-text-secondary);
    }

    .char-config-note-xs {
        font-size: var(--ds-font-size-xs);
        color: var(--ds-text-secondary);
    }

    .char-config-note-danger {
        font-size: var(--ds-font-size-sm);
        color: var(--ds-text-danger);
    }

    .char-config-depth-row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--ds-space-2);
    }

    :global(.char-config-depth-number) {
        width: 3rem !important;
        min-width: 3rem !important;
    }

    :global(.char-config-depth-text) {
        flex: 1 1 auto !important;
    }

    .char-config-altgreet-actions {
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .char-config-emotion-actions {
        display: flex;
        color: var(--ds-text-secondary);
    }

    .char-config-loading-text {
        color: var(--ds-text-secondary);
    }

    .char-config-icon-gallery {
        display: flex;
        flex-wrap: wrap;
        gap: var(--ds-space-2);
        padding: var(--ds-space-2);
    }

    .char-config-icon-tile {
        width: 6rem;
        height: 6rem;
        border-radius: var(--ds-radius-md);
        background: var(--ds-text-secondary);
        cursor: pointer;
        display: block;
        transition: box-shadow var(--ds-motion-fast) var(--ds-ease-standard),
            border-color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .char-config-icon-tile-selected {
        box-shadow: 0 0 0 3px var(--ds-border-strong);
    }

    .char-config-icon-tile-hover:hover {
        box-shadow: 0 0 0 3px var(--ds-border-strong);
    }

    .char-config-icon-tile.is-remove-mode {
        box-shadow: 0 0 0 3px var(--ds-text-danger);
    }

    .char-config-icon-add-tile {
        width: 6rem;
        height: 6rem;
        border: 1px dashed var(--ds-border-subtle);
        border-radius: var(--ds-radius-md);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: border-color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .char-config-icon-add-tile:hover {
        border-color: var(--color-blue-500);
    }

    .char-config-icon-add-tile.is-large {
        height: 10.66rem;
    }

    .char-config-icon-remove-row {
        width: 100%;
        display: flex;
        align-items: flex-end;
        justify-content: flex-end;
    }

    .char-config-icon-remove-button {
        color: var(--ds-text-secondary);
        transition: color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .char-config-icon-remove-button:hover {
        color: var(--ds-text-primary);
    }

    .char-config-icon-remove-button.is-active {
        color: var(--ds-text-danger);
    }

    .char-config-icon-action.is-muted {
        color: var(--ds-text-secondary);
    }
</style>
