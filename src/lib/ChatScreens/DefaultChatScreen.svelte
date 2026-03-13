<script lang="ts">
     

    import Suggestion from './Suggestion.svelte';
    import { CameraIcon, DatabaseIcon, DicesIcon, GlobeIcon, ImagePlusIcon, LanguagesIcon, Laugh, MenuIcon, MicOffIcon, PackageIcon, RefreshCcwIcon, ReplyIcon, Send, StepForwardIcon, XIcon, ArrowDown, GitBranch } from "@lucide/svelte";
    import { selectedCharID, createSimpleCharacter, ScrollToMessageStore, comfyProgressStore, evolutionReviewOpenRequest } from "../../ts/stores.svelte";
    import { tick } from 'svelte';
    import Chat from "./Chat.svelte";
    import {
        getDatabase,
        mutateChatByTarget,
        repairCharacterChatPage,
        resolveChatStateByCharacterAndChatId,
        resolveSelectedChat,
        resolveSelectedChatState,
        type Message,
    } from "../../ts/storage/database.svelte";
    import { DBState } from 'src/ts/stores.svelte';
    import { getCharImage } from "../../ts/characters";
    import { chatProcessStage, isDoingChat, sendChat } from "../../ts/process/index.svelte";
    import { sleep } from "../../ts/util";
    import { language } from "../../lang";
    import { isExpTranslator, translate } from "../../ts/translator/translator";
    import { alertError, alertNormal, alertWait } from "../../ts/alert";
    import sendSound from '../../etc/send.mp3'
    import { processScript } from "src/ts/process/scripts";
    import CreatorQuote from "./CreatorQuote.svelte";
    import { stopTTS } from "src/ts/process/tts";
    import MainMenu from '../UI/MainMenu.svelte';
    import AssetInput from './AssetInput.svelte';
    import { aiLawApplies, chatFoldedState, chatFoldedStateMessageIndex, downloadFile } from 'src/ts/globalApi.svelte';
    import { runTrigger } from 'src/ts/process/triggers';
    import { v4 } from 'uuid';
    import { PreUnreroll, Prereroll } from 'src/ts/process/prereroll';
    import { processMultiCommand } from 'src/ts/process/command';
    import { postChatFile } from 'src/ts/process/files/multisend';
    import { getInlayAsset } from 'src/ts/process/files/inlays';
    import { isMobile, isNodeServer } from "src/ts/platform";
    import Chats from './Chats.svelte';
    import Button from '../UI/GUI/Button.svelte';
    import GameStateHud from '../SideBars/GameStateHUD.svelte';
    import { runComfyTemplateById } from 'src/ts/integrations/comfy/execute';
    import ReviewWorkspace from '../Evolution/ReviewWorkspace.svelte';
    import {
        appendRerollSnapshot,
        createInitialRerollHistory,
        getStableChatTargetKey,
        readNextRerollSnapshot,
        readPreviousRerollSnapshot,
        replaceMessageTailWithSnapshot,
        trimMessagesForRerollRequest,
    } from './defaultChatScreen.reroll';
    import {
        getCharacterEvolutionErrorMessage,
    } from 'src/ts/evolution';
    import {
        acceptEvolutionReviewFlow,
        getEvolutionBusyLabel,
        rejectEvolutionReviewFlow,
        runEvolutionHandoffFlow,
        syncEvolutionProposalDraft,
        type EvolutionBusyAction,
    } from 'src/ts/character-evolution/reviewFlow';
    import { getPendingProposalSourceRange } from 'src/ts/character-evolution/pendingProposal';
    import {
        ensureCharacterEvolution,
        getEffectiveCharacterEvolutionSettings,
        hasAcceptedEvolutionForChat,
    } from 'src/ts/characterEvolution';
    import { findSingleCharacterById, replaceCharacterById } from 'src/ts/storage/characterList';
    import {
        flushUserMessageBeforeGeneration,
        getUserMessagePersistFailureMessage,
    } from './defaultChatScreen.serverSync';
    const defaultChatScreenLog = (..._args: unknown[]) => {};
    
    interface Props {
        onOpenModuleList?: () => void;
        onOpenChatList?: () => void;
        customStyle?: string;
        onEvolutionReviewChange?: (active: boolean) => void;
    }

    let messageInput:string = $state('')
    let messageInputTranslate:string = $state('')
    let openMenu = $state(false)
    let loadPages = $state(30)
    let autoMode = $state(false)
    let rerolls:Message[][] = []
    let rerollid = -1
    let lastRerollTargetKey: string | null = null
    const isDoingChatInputTranslate = false
    let toggleStickers:boolean = $state(false)
    let fileInput:string[] = $state([])
    let showNewMessageButton = $state(false)
    let chatsInstance: unknown = $state()
    let isScrollingToMessage = $state(false)
    let showEvolutionProposal = $state(false)
    let evolutionBusy = $state(false)
    let evolutionAction: EvolutionBusyAction = $state(null)
    let evolutionProposalDraft = $state(null)
    let evolutionProposalDraftKey = $state<string | null>(null)
    let {
        onOpenModuleList = () => {},
        onOpenChatList = () => {},
        customStyle = '',
        onEvolutionReviewChange = () => {},
    }: Props = $props();
    const selectedChatState = $derived(resolveSelectedChatState(DBState.db.characters, $selectedCharID))
    const currentCharacter = $derived(selectedChatState.character)
    const currentChatEntry = $derived(selectedChatState.chat)
    const currentChat = $derived(selectedChatState.messages)
    const canContinueResponse = $derived.by(() => {
        const messages = currentChat;
        if (messages.length < 2) return false;
        return messages[messages.length - 1]?.role === 'char';
    })
    const comfyMenuTemplates = $derived.by(() => {
        const templates = DBState.db.comfyCommander?.templates ?? []
        return templates.filter((template) => template.showInChatMenu)
    })
    const currentEvolutionSettings = $derived.by(() => {
        const character = currentCharacter
        if (!character || character.type === 'group') {
            return null
        }
        return getEffectiveCharacterEvolutionSettings(DBState.db, character)
    })

    function resolveStableTargetFromSelection(options: { ensureChatId?: boolean } = {}) {
        const selectedState = resolveSelectedChatState(DBState.db.characters, $selectedCharID)
        const selectedCharacter = selectedState.character
        const selectedChat = selectedState.chat
        if (!selectedCharacter?.chaId || !selectedChat) {
            return null
        }
        if (options.ensureChatId && !selectedChat.id) {
            selectedChat.id = v4()
        }
        if (!selectedChat.id) {
            return null
        }
        return {
            characterId: selectedCharacter.chaId,
            chatId: selectedChat.id,
        }
    }

    function isSameStableTarget(
        left: { characterId: string; chatId: string } | null,
        right: { characterId: string; chatId: string } | null,
    ) {
        return !!left && !!right
            && left.characterId === right.characterId
            && left.chatId === right.chatId
    }

    function resolveStableTargetChatState(target: { characterId: string; chatId: string } | null) {
        if (!target) {
            return {
                character: null,
                characterIndex: -1,
                chat: null,
                chatIndex: -1,
                messages: [],
            }
        }
        return resolveChatStateByCharacterAndChatId(
            DBState.db.characters,
            target.characterId,
            target.chatId,
        )
    }

    function mutateStableTargetChat(
        target: { characterId: string; chatId: string } | null,
        mutate: Parameters<typeof mutateChatByTarget>[2],
    ) {
        if (!target) {
            return false
        }
        return mutateChatByTarget(DBState.db.characters, target, mutate)
    }

    function resetRerollsForTarget(target: { characterId: string; chatId: string } | null) {
        const targetKey = getStableChatTargetKey(target)
        if (targetKey && lastRerollTargetKey === targetKey) {
            return
        }
        rerolls = []
        rerollid = -1
        lastRerollTargetKey = targetKey
    }

    $effect(() => {
        repairCharacterChatPage(currentCharacter)
    })
    function findCharacterById(characterId: string) {
        return findSingleCharacterById(DBState.db.characters, characterId)
    }

    function commitCharacter(characterId: string, nextCharacter: NonNullable<ReturnType<typeof findCharacterById>>) {
        if (!characterId) {
            return
        }
        replaceCharacterById(DBState.db.characters, nextCharacter)
    }

    const evolutionHandoffBlockedForCurrentChat = $derived.by(() => {
        const character = currentCharacter
        if (!character || character.type === 'group') {
            return false
        }
        const activeChat = resolveSelectedChat(character)
        return !!activeChat?.id && hasAcceptedEvolutionForChat(
            character,
            activeChat.id,
            Array.isArray(activeChat.message) ? activeChat.message.length : 0,
        )
    })
    const isEvolutionReviewVisible = $derived(Boolean(showEvolutionProposal && currentEvolutionSettings?.pendingProposal))

    $effect(() => {
        const character = currentCharacter
        if (!character || character.type === 'group') {
            return
        }
        ensureCharacterEvolution(character)
    })

    function scrollToBottom() {
        (chatsInstance as { scrollToLatestMessage?: () => void } | null)?.scrollToLatestMessage?.();
    }

    $effect(() => {
        if(ScrollToMessageStore.value !== -1){
            const index = ScrollToMessageStore.value
            ScrollToMessageStore.value = -1
            scrollToMessage(index)
        }
    })

    async function scrollToMessage(index: number){
        // Forces the loading of past messages not rendered on the screen
        isScrollingToMessage = true
        try {
            const totalMessages = currentChat.length
            const neededLoadPages = totalMessages - index + 5

            if(loadPages < neededLoadPages){
                loadPages = neededLoadPages
                await tick()
            }

            let element: Element | null = null;
            // Poll for element existence (max 5 seconds)
            for(let i = 0; i < 50; i++){
                element = document.querySelector(`[data-chat-index="${index}"]`)
                if(element) break;
                await sleep(100)
            }

            const preIndex = Math.max(0, index - 3)
            const preElement = document.querySelector(`[data-chat-index="${preIndex}"]`)
            if(preElement){
                preElement.scrollIntoView({behavior: "instant", block: "start"})
            } else {
                element?.scrollIntoView({behavior: "instant", block: "start"})
            }
            await sleep(50)

            if(element){
                // Wait for images to load to prevent layout shift
                const chatContainer = document.querySelector('.default-chat-screen');
                if(chatContainer) {
                    const images = Array.from(chatContainer.querySelectorAll('img'));
                    const promises = images.map(img => {
                        if (img.complete) return Promise.resolve();
                        return new Promise(resolve => {
                            img.onload = () => resolve(null);
                            img.onerror = () => resolve(null);
                        });
                    });
                    // Wait for all images or timeout after 4 seconds
                    await Promise.race([
                        Promise.all(promises),
                        sleep(4000)
                    ]);
                }

                element.scrollIntoView({behavior: "instant", block: "start"})
                
                // Small delay and scroll again to ensure position is correct after any final layout adjustments
                await sleep(50)
                element.scrollIntoView({behavior: "instant", block: "start"})

                element.classList.add('ds-chat-scroll-highlight')
                setTimeout(() => {
                    element.classList.remove('ds-chat-scroll-highlight')
                }, 2000)
            }
        } finally {
            isScrollingToMessage = false
        }
    }

    async function send(){
        return sendMain(false)
    }
    async function sendContinue(){
        return sendMain(true)
    }

    async function runEvolutionHandoff(forceReplay = false) {
        if (!currentCharacter || currentCharacter.type === 'group') {
            return
        }
        const characterId = currentCharacter.chaId
        evolutionBusy = true
        evolutionAction = 'handoff'
        openMenu = false
        try {
            const result = await runEvolutionHandoffFlow({
                characterEntry: currentCharacter,
                chatId: currentChatEntry?.id ?? null,
                chatMessageCount: currentChat.length,
                forceReplay,
                resolveCharacterById: findCharacterById,
                confirmReplay: () => {
                    return typeof window === 'undefined'
                        || window.confirm("This chat was already accepted for evolution. Replay handoff for recovery?")
                },
            })
            if (result.cancelled || !result.nextCharacter) {
                return
            }
            commitCharacter(characterId, result.nextCharacter)
            if (currentCharacter?.chaId === characterId) {
                evolutionProposalDraft = result.proposalDraft
                evolutionProposalDraftKey = result.proposalDraftKey
                showEvolutionProposal = true
            }
            alertNormal(result.replayedAcceptedChat ? "Evolution proposal was regenerated for the accepted chat." : "Evolution proposal is ready for review.")
        } catch (error) {
            alertError(getCharacterEvolutionErrorMessage(error))
        } finally {
            evolutionBusy = false
            evolutionAction = null
        }
    }

    async function rejectEvolutionProposal() {
        if (!currentCharacter || currentCharacter.type === 'group' || !currentCharacter.chaId) {
            return
        }
        const characterId = currentCharacter.chaId
        evolutionBusy = true
        evolutionAction = 'reject'
        try {
            const nextCharacter = await rejectEvolutionReviewFlow(currentCharacter)
            commitCharacter(characterId, nextCharacter)
            if (currentCharacter?.chaId === characterId) {
                evolutionProposalDraft = null
                evolutionProposalDraftKey = null
                showEvolutionProposal = false
            }
            alertNormal("Evolution proposal rejected.")
        } catch (error) {
            alertError(getCharacterEvolutionErrorMessage(error))
        } finally {
            evolutionBusy = false
            evolutionAction = null
        }
    }

    async function acceptEvolutionProposal(createNextChat = false) {
        if (!currentCharacter || currentCharacter.type === 'group' || !currentCharacter.chaId || !evolutionProposalDraft) {
            return
        }
        const characterId = currentCharacter.chaId
        const proposedState = JSON.parse(JSON.stringify(evolutionProposalDraft))
        evolutionBusy = true
        evolutionAction = 'accept'
        try {
            const { nextCharacter, chatCreationError } = await acceptEvolutionReviewFlow({
                characterEntry: currentCharacter,
                proposedState,
                createNextChat,
                sourceRange: getPendingProposalSourceRange(currentCharacter.characterEvolution.pendingProposal),
                resolveCharacterById: findCharacterById,
            })
            commitCharacter(characterId, nextCharacter)
            if (currentCharacter?.chaId === characterId) {
                evolutionProposalDraft = null
                evolutionProposalDraftKey = null
                showEvolutionProposal = false
            }
            alertNormal(
                createNextChat
                    ? (chatCreationError
                        ? "Evolution accepted, but the new chat could not be created."
                        : "Evolution accepted and a new chat was created.")
                    : "Evolution accepted."
            )
            if (chatCreationError) {
                alertError(chatCreationError)
            }
        } catch (error) {
            alertError(getCharacterEvolutionErrorMessage(error))
        } finally {
            evolutionBusy = false
            evolutionAction = null
        }
    }

    $effect(() => {
        const nextDraftState = syncEvolutionProposalDraft({
            characterId: currentCharacter?.chaId,
            proposal: currentCharacter?.characterEvolution.pendingProposal,
        })
        if (!nextDraftState.proposalDraftKey) {
            evolutionProposalDraft = null
            evolutionProposalDraftKey = null
            return
        }
        if (!evolutionProposalDraft || evolutionProposalDraftKey !== nextDraftState.proposalDraftKey) {
            evolutionProposalDraft = nextDraftState.proposalDraft
            evolutionProposalDraftKey = nextDraftState.proposalDraftKey
        }
    })

    $effect(() => {
        if (evolutionAction === 'handoff' && currentEvolutionSettings?.pendingProposal) {
            evolutionBusy = false
            evolutionAction = null
        }
    })

    $effect(() => {
        if (showEvolutionProposal && !currentEvolutionSettings?.pendingProposal) {
            showEvolutionProposal = false
        }
    })

    $effect(() => {
        const requestedCharacterId = $evolutionReviewOpenRequest
        if (!requestedCharacterId || requestedCharacterId !== currentCharacter?.chaId) {
            return
        }

        if (currentEvolutionSettings?.pendingProposal) {
            showEvolutionProposal = true
        }

        evolutionReviewOpenRequest.set(null)
    })

    $effect(() => {
        onEvolutionReviewChange(isEvolutionReviewVisible)
    })

    $effect(() => {
        if (isEvolutionReviewVisible) {
            openMenu = false
            toggleStickers = false
        }
    })

    const evolutionBusyLabel = $derived.by(() => {
        return getEvolutionBusyLabel(evolutionAction)
    })

    function shouldSendOnEnter(e: KeyboardEvent){
        if(e.key.toLocaleLowerCase() !== "enter" || e.isComposing){
            return false
        }
        if(isMobile){
            return false
        }
        if(DBState.db.sendWithEnter){
            return !e.shiftKey
        }
        return e.shiftKey
    }

    function shouldSendTranslateOnEnter(e: KeyboardEvent){
        if(e.key.toLocaleLowerCase() !== "enter" || e.isComposing){
            return false
        }
        if(isMobile){
            return false
        }
        return DBState.db.sendWithEnter && !e.shiftKey
    }

    function handleComposerKeydown(e: KeyboardEvent, canSend:(event: KeyboardEvent) => boolean = shouldSendOnEnter){
        if(canSend(e)){
            void send()
            e.preventDefault()
            return
        }
        if(e.key.toLocaleLowerCase() === "m" && e.ctrlKey){
            reroll()
            e.preventDefault()
        }
    }

    async function sendMain(continueResponse:boolean) {
        const stableTarget = resolveStableTargetFromSelection({ ensureChatId: true })
        if(!stableTarget){
            return
        }
        const selectedState = resolveChatStateByCharacterAndChatId(
            DBState.db.characters,
            stableTarget.characterId,
            stableTarget.chatId,
        )
        const selectedCharacter = selectedState.character
        const activeChat = selectedState.chat
        if(!selectedCharacter){
            return
        }
        repairCharacterChatPage(selectedCharacter)
        if(!activeChat || !Array.isArray(activeChat.message)){
            return
        }
        if($isDoingChat){
            return
        }
        resetRerollsForTarget(stableTarget)

        let cha = activeChat.message

        if(messageInput.startsWith('/')){
            const commandProcessed = await processMultiCommand(messageInput)
            if(commandProcessed !== false){
                messageInput = ''
                return
            }
        }

        if(fileInput.length > 0){
            for(const file of fileInput){
                messageInput += `{{inlayed::${file}}}`
            }
            fileInput = []
        }
        const pendingInput = messageInput
        const beforeSendMessages = safeStructuredClone(cha)
        let appendedUserMessage = false

        if(messageInput === ''){
            if(selectedCharacter.type !== 'group'){
                if(cha.length === 0 || cha[cha.length - 1].role !== 'user'){
                    if(DBState.db.useSayNothing){
                        cha.push({
                            role: 'user',
                            data: '*says nothing*',
                            name: null
                        })
                        appendedUserMessage = true
                    }
                }
            }
        }
        else{
            const char = selectedCharacter
            if(char.type === 'character'){
                const triggerResult = await runTrigger(char,'input', {chat: activeChat})
                if(triggerResult){
                    cha = triggerResult.chat.message
                }

                cha.push({
                    role: 'user',
                    data: await processScript(char,messageInput,'editinput'),
                    time: Date.now(),
                    name: null
                })
                appendedUserMessage = true
            }
            else{
                cha.push({
                    role: 'user',
                    data: messageInput,
                    time: Date.now(),
                    name: null
                })
                appendedUserMessage = true
            }
        }
        messageInput = ''
        messageInputTranslate = ''
        activeChat.message = cha
        if (isNodeServer && appendedUserMessage) {
            try {
                await flushUserMessageBeforeGeneration({
                    database: getDatabase(),
                    character: selectedCharacter,
                    chat: activeChat,
                })
            } catch (error) {
                activeChat.message = beforeSendMessages
                messageInput = pendingInput
                messageInputTranslate = ''
                updateInputSizeAll()
                const message = getUserMessagePersistFailureMessage(error)
                defaultChatScreenLog('[Sync] User message save failed. Blocking generation.', error)
                alertError(message)
                return
            }
        }
        rerolls = []
        await sleep(10)
        updateInputSizeAll()
        await sendChatMain(continueResponse, stableTarget)

    }

    async function reroll() {
        if($isDoingChat){
            return
        }
        const stableTarget = resolveStableTargetFromSelection({ ensureChatId: true })
        const activeState = resolveStableTargetChatState(stableTarget)
        const activeChat = activeState.chat
        if(!stableTarget || !activeChat){
            return
        }
        resetRerollsForTarget(stableTarget)
        const genId = activeChat.message.at(-1)?.generationInfo?.generationId
        if(genId){
            const r = Prereroll(genId)
            const lastMessage = activeChat.message.at(-1)
            if(r && lastMessage){
                lastMessage.data = r
                return
            }
        }
        if(rerollid < rerolls.length - 1){
            const nextReroll = readNextRerollSnapshot(rerolls, rerollid)
            rerollid = nextReroll.index
            if(nextReroll.snapshot){
                if(!mutateStableTargetChat(stableTarget, (chat) => {
                    chat.message = replaceMessageTailWithSnapshot(chat.message, safeStructuredClone(nextReroll.snapshot))
                })){
                    return
                }
            }
            return
        }
        if(rerolls.length === 0){
            const initialHistory = createInitialRerollHistory(rerolls, safeStructuredClone(activeChat.message.at(-1)))
            rerolls = initialHistory.snapshots
            rerollid = initialHistory.index
        }
        const cha = trimMessagesForRerollRequest(safeStructuredClone(activeChat.message))
        if(cha.length === 0 ){
            return
        }
        openMenu = false
        if (!mutateStableTargetChat(stableTarget, (chat) => {
            chat.message = cha
        })) {
            return
        }
        await sendChatMain(false, stableTarget)
    }

    async function unReroll() {
        if($isDoingChat){
            return
        }
        const stableTarget = resolveStableTargetFromSelection({ ensureChatId: true })
        const activeState = resolveStableTargetChatState(stableTarget)
        const activeChat = activeState.chat
        if(!stableTarget || !activeChat){
            return
        }
        resetRerollsForTarget(stableTarget)
        const genId = activeChat.message.at(-1)?.generationInfo?.generationId
        if(genId){
            const r = PreUnreroll(genId)
            const lastMessage = activeChat.message.at(-1)
            if(r && lastMessage){
                lastMessage.data = r
                return
            }
        }
        if(rerollid <= 0){
            return
        }
        const previousReroll = readPreviousRerollSnapshot(rerolls, rerollid)
        rerollid = previousReroll.index
        if(previousReroll.snapshot){
            if(!mutateStableTargetChat(stableTarget, (chat) => {
                chat.message = replaceMessageTailWithSnapshot(chat.message, safeStructuredClone(previousReroll.snapshot))
            })){
                return
            }
        }
    }

    let abortController:null|AbortController = null

    async function sendChatMain(continued:boolean = false, target?: { characterId: string; chatId: string }) {
        const stableTarget = target ?? resolveStableTargetFromSelection({ ensureChatId: true })
        if(!stableTarget){
            return
        }
        const activeChatAtStart = resolveStableTargetChatState(stableTarget).chat
        if(!activeChatAtStart){
            return
        }
        const previousLength = activeChatAtStart.message.length
        messageInput = ''
        abortController = new AbortController()
        try {
            await sendChat(-1, {
                signal:abortController.signal,
                continue:continued,
                target: stableTarget,
            })
            const activeState = resolveChatStateByCharacterAndChatId(
                DBState.db.characters,
                stableTarget.characterId,
                stableTarget.chatId,
            )
            const isCurrentSelection = currentCharacter?.chaId === stableTarget.characterId
                && currentChatEntry?.id === stableTarget.chatId
            if(isCurrentSelection && activeState.chat && previousLength < activeState.chat.message.length){
                const nextRerollState = appendRerollSnapshot(
                    rerolls,
                    safeStructuredClone(activeState.chat.message).slice(previousLength),
                )
                rerolls = nextRerollState.snapshots
                rerollid = nextRerollState.index
            }
            // Guard against occasional scroll drift after long-running generation/RAG.
            if (isCurrentSelection) {
                await tick()
                scrollToBottom()
            }
        } catch (error) {
            defaultChatScreenLog(error)
            alertError(error)
        }
        lastRerollTargetKey = getStableChatTargetKey(stableTarget)
        $isDoingChat = false
        if(DBState.db.playMessage){
            const audio = new Audio(sendSound);
            audio.play();
        }
    }

    function abortChat(){
        if(abortController){
            abortController.abort()
        }
    }

    async function runAutoMode() {
        if(autoMode){
            autoMode = false
            return
        }
        const stableTarget = resolveStableTargetFromSelection({ ensureChatId: true })
        if(!stableTarget){
            return
        }
        autoMode = true
        while(autoMode){
            await sendChatMain(false, stableTarget)
            if(!isSameStableTarget(stableTarget, resolveStableTargetFromSelection())){
                autoMode = false
            }
        }
    }

    const { userIconPortrait, currentUsername, userIcon } = $derived.by(() => {
        const bindedPersona = currentChatEntry?.bindedPersona

        if(bindedPersona){
            const persona = DBState.db.personas.find((p) => p.id === bindedPersona)
            if(persona){
                return {
                    currentUsername: persona.name,
                    userIconPortrait: persona.largePortrait,
                    userIcon: persona.icon
                }
            }
        }

        const selectedPersonaIndex = DBState.db.selectedPersona
        return {
            currentUsername: DBState.db.username,
            userIconPortrait: DBState.db.personas[selectedPersonaIndex].largePortrait,
            userIcon: DBState.db.personas[selectedPersonaIndex].icon
        }
    })

    let inputHeight = $state("44px")
    let inputEle:HTMLTextAreaElement = $state()
    let inputTranslateHeight = $state("44px")
    let inputTranslateEle:HTMLTextAreaElement = $state()

    function updateInputSizeAll() {
        updateInputSize()
        updateInputTranslateSize()
    }

    function updateInputTranslateSize() {
        if(inputTranslateEle) {
            inputTranslateEle.style.height = "0";
            const nextHeight = (inputTranslateEle.scrollHeight) + "px";
            inputTranslateHeight = nextHeight;
            inputTranslateEle.style.height = nextHeight
        }
    }
    function updateInputSize() {
        if(inputEle){
            inputEle.style.height = "0";
            const nextHeight = (inputEle.scrollHeight) + "px";
            inputHeight = nextHeight;
            inputEle.style.height = nextHeight
        }
    }

    $effect(() => {
        updateInputSizeAll()
    });

    async function updateInputTransateMessage(reverse: boolean) {
        if(!DBState.db.useAutoTranslateInput){
            return
        }
        if(isExpTranslator()){
            if(!reverse){
                messageInputTranslate = ''
                return
            }
            if(messageInputTranslate === '') {
                messageInput = ''
                return
            }
            const lastMessageInputTranslate = messageInputTranslate
            await sleep(1500)
            if(lastMessageInputTranslate === messageInputTranslate){
                translate(reverse ? messageInputTranslate : messageInput, reverse).then((translatedMessage) => {
                    if(translatedMessage){
                        if(reverse)
                            messageInput = translatedMessage
                        else
                            messageInputTranslate = translatedMessage
                    }
                })
            }
            return

        }
        if(reverse && messageInputTranslate === '') {
            messageInput = ''
            return
        }
        if(!reverse && messageInput === '') {
            messageInputTranslate = ''
            return
        }
        translate(reverse ? messageInputTranslate : messageInput, reverse).then((translatedMessage) => {
            if(translatedMessage){
                if(reverse)
                    messageInput = translatedMessage
                else
                    messageInputTranslate = translatedMessage
            }
        })
    }

    async function screenShot(){
        try {
            loadPages = Infinity
            const html2canvas = await import('html-to-image');
            const chats = document.querySelectorAll('.default-chat-screen .risu-chat')
            alertWait("Preparing full chat screenshot. Scanning chat messages now; only 1 final image will be saved.")
            const canvases:HTMLCanvasElement[] = []

            for(let i = 0; i < chats.length; i++){
                const chat = chats[i]
                const cnv = await html2canvas.toCanvas(chat as HTMLElement)
                canvases.push(cnv)
                alertWait(`Scanning messages for full screenshot... ${i + 1}/${chats.length} (still building 1 final image)`)
            }

            canvases.reverse()

            alertWait(`Merging ${canvases.length} scanned message blocks into 1 final screenshot...`)

            const mergedCanvas = document.createElement('canvas');
            mergedCanvas.width = 0;
            mergedCanvas.height = 0;
            const mergedCtx = mergedCanvas.getContext('2d');

            let totalHeight = 0;
            let maxWidth = 0;
            for(let i = 0; i < canvases.length; i++) {
                const canvas = canvases[i];
                totalHeight += canvas.height;
                maxWidth = Math.max(maxWidth, canvas.width);

                mergedCanvas.width = maxWidth;
                mergedCanvas.height = totalHeight;
            }

            mergedCtx.fillStyle = 'var(--risu-theme-bgcolor)'
            mergedCtx.fillRect(0, 0, maxWidth, totalHeight);
            let indh = 0
            for(let i = 0; i < canvases.length; i++) {
                const canvas = canvases[i];
                indh += canvas.height
                mergedCtx.drawImage(canvas, 0, indh - canvas.height);
                canvases[i].remove();
            }

            if(mergedCanvas){
                await downloadFile(`chat-${v4()}.png`, Buffer.from(mergedCanvas.toDataURL('png').split(',').at(-1), 'base64'))
                mergedCanvas.remove();
            }
            alertNormal(language.screenshotSaved)
            loadPages = 10
        } catch (error) {
            defaultChatScreenLog(error)
            alertError("Error while taking screenshot")
        }
    }

    
</script>



<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="ds-chat-root" style={customStyle} onclick={() => {
    openMenu = false
}}>
    
    {#if showNewMessageButton && !isEvolutionReviewVisible}
        {#if (DBState.db.newMessageButtonStyle === 'bottom-center' || !DBState.db.newMessageButtonStyle)}
            <button
                type="button"
                class="ds-chat-jump-btn ds-chat-jump-btn-bottom-center"
                title={language.newMessage}
                aria-label={language.newMessage}
                onclick={scrollToBottom}
            >
                <ArrowDown size={16} />
                <span>{language.newMessage}</span>
            </button>
        {/if}

        {#if DBState.db.newMessageButtonStyle === 'bottom-right'}
            <button
                type="button"
                class="ds-chat-jump-btn ds-chat-jump-btn-bottom-right"
                title={language.newMessage}
                aria-label={language.newMessage}
                onclick={scrollToBottom}
            >
                <ArrowDown size={16} />
                <span>{language.newMessage}</span>
            </button>
        {/if}

        {#if DBState.db.newMessageButtonStyle === 'bottom-left'}
            <button
                type="button"
                class="ds-chat-jump-btn ds-chat-jump-btn-bottom-left"
                title={language.newMessage}
                aria-label={language.newMessage}
                onclick={scrollToBottom}
            >
                <ArrowDown size={16} />
                <span>{language.newMessage}</span>
            </button>
        {/if}

        {#if DBState.db.newMessageButtonStyle === 'floating-circle'}
            <button
                type="button"
                class="ds-chat-jump-btn ds-chat-jump-btn-bottom-right-float ds-chat-jump-btn-circle icon-btn icon-btn--md"
                onclick={scrollToBottom}
                title={language.newMessage}
                aria-label={language.newMessage}
            >
                <ArrowDown size={20} />
            </button>
        {/if}

        {#if DBState.db.newMessageButtonStyle === 'right-center'}
            <button
                type="button"
                class="ds-chat-jump-btn ds-chat-jump-btn-right-center"
                title={language.newMessage}
                aria-label={language.newMessage}
                onclick={scrollToBottom}
            >
                <ArrowDown size={14} />
                <span class="ds-chat-jump-btn-vertical-label">{language.newMessage}</span>
            </button>
        {/if}

        {#if DBState.db.newMessageButtonStyle === 'top-bar'}
            <button
                type="button"
                class="ds-chat-jump-btn ds-chat-jump-btn-top-bar"
                title={language.newMessage}
                aria-label={language.newMessage}
                onclick={scrollToBottom}
            >
                <ArrowDown size={14} />
                <span>{language.newMessage}</span>
            </button>
        {/if}
    {/if}
    {#if isScrollingToMessage}
        <div class="ds-chat-loading-overlay">
            Loading...
        </div>
    {/if}
    {#if $selectedCharID < 0}
        <MainMenu />
    {:else if !currentCharacter}
        <div class="ds-chat-main-shell">
            <div class="ds-chat-loading-overlay">
                Loading...
            </div>
        </div>
    {:else}
        <div class="ds-chat-main-shell">
            {#if isEvolutionReviewVisible && currentEvolutionSettings?.pendingProposal}
                <div class="ds-chat-review-mode">
                    <ReviewWorkspace
                        proposal={currentEvolutionSettings.pendingProposal}
                        currentState={currentEvolutionSettings.currentState}
                        sectionConfigs={currentEvolutionSettings.sectionConfigs}
                        privacy={currentEvolutionSettings.privacy}
                        bind:bindState={evolutionProposalDraft}
                        onAccept={() => acceptEvolutionProposal(false)}
                        onAcceptAndCreate={() => acceptEvolutionProposal(true)}
                        onReject={rejectEvolutionProposal}
                        onClose={() => { showEvolutionProposal = false }}
                        loading={evolutionBusy}
                    />
                </div>
            {:else}
            <div class="ds-chat-scroll-shell default-chat-screen"
                onscroll={(e) => {
            //@ts-expect-error scrollHeight/clientHeight/scrollTop don't exist on EventTarget, but target is HTMLElement here
            const scrolled = (e.target.scrollHeight - e.target.clientHeight + e.target.scrollTop)
            if(scrolled < 100 && currentChat.length > loadPages){
                loadPages += 15
            }
            const chatTarget = e.target as HTMLElement;
            const chatsContainer = chatTarget.querySelector('.ds-chat-list-stack');
            const lastEl = chatsContainer?.firstElementChild;
            const isAtBottom = lastEl ? lastEl.getBoundingClientRect().top <= chatTarget.getBoundingClientRect().bottom + 100 : true;
            if(isAtBottom){
                showNewMessageButton = false;
            }
        }}>
            <GameStateHud />
            {#if $comfyProgressStore.active}
                <div class="ds-chat-task-progress" style:--ds-chat-task-progress-color={$comfyProgressStore.color}>
                    <div class="ds-chat-task-progress-track">
                        <div class="ds-chat-task-progress-indicator"
                            style:--ds-chat-task-progress-value="60%"
                        ></div>
                    </div>
                    {#if $comfyProgressStore.label}
                        <div class="ds-chat-task-progress-label">{$comfyProgressStore.label}</div>
                    {/if}
                </div>
            {/if}
            {#if DBState.db.useAutoTranslateInput}
                <div class="ds-chat-translate-shell">
                    <label for='messageInputTranslate' class="ds-chat-translate-label">
                        <LanguagesIcon />
                    </label>
                    <textarea id = 'messageInputTranslate' class="ds-chat-translate-input control-field"
                              bind:value={messageInputTranslate}
                              bind:this={inputTranslateEle}
                              enterkeyhint={isMobile || !DBState.db.sendWithEnter ? "enter" : "send"}
                              onkeydown={(e) => handleComposerKeydown(e, shouldSendTranslateOnEnter)}
                              oninput={()=>{updateInputSizeAll();updateInputTransateMessage(true)}}
                              placeholder={language.enterMessageForTranslateToEnglish}
                              style:height={inputTranslateHeight}
                    ></textarea>
                </div>
            {/if}

            {#if fileInput.length > 0}
                <div class="ds-chat-inlay-list">
                    {#each fileInput as file, i (i)}
                        {#await getInlayAsset(file) then inlayAsset}
                            <div class="ds-chat-inlay-item">
                                {#if inlayAsset.type === 'image'}
                                    <img src={inlayAsset.data} alt="Inlay" class="ds-chat-inlay-preview">
                                {:else if inlayAsset.type === 'video'}
                                    <video controls class="ds-chat-inlay-preview">
                                        <source src={inlayAsset.data} type="video/mp4" />
                                        <track kind="captions" />
                                        Your browser does not support the video tag.
                                    </video>
                                {:else if inlayAsset.type === 'audio'}
                                    <audio controls class="ds-chat-inlay-preview ds-chat-inlay-preview-audio">
                                        <source src={inlayAsset.data} type="audio/mpeg" />
                                        Your browser does not support the audio tag.
                                    </audio>
                                {:else}
                                    <div class="ds-chat-inlay-fallback">{file}</div>
                                {/if}
                                <button
                                    type="button"
                                    class="ds-chat-inlay-remove icon-btn icon-btn--sm"
                                    title="Remove inlay asset"
                                    aria-label="Remove inlay asset"
                                    onclick={() => {
                                    fileInput.splice(i, 1)
                                    updateInputSizeAll()
                                }}>
                                    <XIcon size={18} />
                                </button>
                            </div>
                        {/await}
                    {/each}
                </div>

            {/if}

            {#if toggleStickers}
                <div class="ds-chat-sticker-strip">
                    <AssetInput currentCharacter={currentCharacter} onSelect={(additionalAsset)=>{
                        let fileType = 'img'
                        if(additionalAsset.length > 2 && additionalAsset[2]) {
                            const fileExtension = additionalAsset[2]
                            if(fileExtension === 'mp4' || fileExtension === 'webm')
                                fileType = 'video'
                            else if(fileExtension === 'mp3' || fileExtension === 'wav')
                                fileType = 'audio'
                        }
                        messageInput += `<span class='notranslate' translate='no'>{{${fileType}::${additionalAsset[0]}}}</span> *${additionalAsset[0]} added*`
                        updateInputSizeAll()
                    }}/>
                </div>
            {/if}

            {#if DBState.db.useAutoSuggestions}
                <Suggestion messageInput={(msg)=>messageInput=(
                    (DBState.db.subModel === "textgen_webui" || DBState.db.subModel === "mancer" || DBState.db.subModel.startsWith('local_')) && DBState.db.autoSuggestClean
                    ? msg.replace(/ +\(.+?\) *$| - [^"'*]*?$/, '')
                    : msg
                )} {send}/>
            {/if}

            {#if chatFoldedStateMessageIndex.index !== -1}
                <div class="ds-chat-load-more-row">
                    <Button className="ds-chat-load-more-button" onclick={() => {
                        loadPages += chatFoldedStateMessageIndex.index + 1
                        chatFoldedState.data = null
                    }}>
                        {language.loadMore}
                    </Button>
                </div>
            {/if}
            
            <Chats
                bind:this={chatsInstance}
                messages={currentChat}
                loadPages={loadPages}
                onReroll={reroll}
                unReroll={unReroll}
                currentCharacter={currentCharacter}
                currentUsername={currentUsername}
                userIcon={userIcon}
                userIconPortrait={userIconPortrait}
                bind:hasNewUnreadMessage={showNewMessageButton}
            />

            {#if currentChat.length <= loadPages}
                {#if currentCharacter.type !== 'group' }
                    <Chat
                        character={createSimpleCharacter(currentCharacter)}
                        name={currentCharacter.name}
                        message={(currentChatEntry?.fmIndex ?? -1) === -1
                            ? currentCharacter.firstMessage
                            : (currentCharacter.alternateGreetings[currentChatEntry?.fmIndex ?? -1] ?? currentCharacter.firstMessage)}
                        role='char'
                        img={getCharImage(currentCharacter.image, 'css')}
                        idx={-1}
                        altGreeting={currentCharacter.alternateGreetings.length > 0}
                        largePortrait={currentCharacter.largePortrait}
                        firstMessage={true}
                        onReroll={() => {
                            if(currentChatEntry){
                                if ((currentChatEntry.fmIndex ?? -1) >= (currentCharacter.alternateGreetings.length - 1)){
                                    currentChatEntry.fmIndex = -1
                                }
                                else{
                                    currentChatEntry.fmIndex = (currentChatEntry.fmIndex ?? -1) + 1
                                }
                            }
                        }}
                        unReroll={() => {
                            if(currentChatEntry){
                                if ((currentChatEntry.fmIndex ?? -1) === -1){
                                    currentChatEntry.fmIndex = currentCharacter.alternateGreetings.length - 1
                                }
                                else{
                                    currentChatEntry.fmIndex = (currentChatEntry.fmIndex ?? -1) - 1
                                }
                            }
                        }}
                        isLastMemory={false}
                        currentPage={(currentChatEntry?.fmIndex ?? -1) + 2}
                        totalPages={currentCharacter.alternateGreetings.length + 1}

                    />
                    {#if (aiLawApplies() && currentChat.length === 0)}
                        <div class="ds-chat-ai-warning">
                            {language.aiGenerationWarning}
                        </div>
                    {/if}
                    {#if !currentCharacter.removedQuotes && currentCharacter.creatorNotes.length >= 2}
                        <CreatorQuote quote={currentCharacter.creatorNotes} onRemove={() => {
                            currentCharacter.removedQuotes = true
                        }} />
                    {/if}
                {/if}
            {/if}

            </div>

            <div class="ds-chat-composer-stack">
                {#if currentEvolutionSettings?.pendingProposal}
                    <button
                        type="button"
                        class="ds-chat-evolution-review-prompt"
                        onclick={() => { showEvolutionProposal = true }}
                    >
                        <span class="ds-settings-label-muted-sm">Pending evolution proposal</span>
                        <span class="ds-chat-evolution-review-prompt-action">Review</span>
                    </button>
                {/if}

                {#if evolutionBusy}
                    <div class="ds-chat-evolution-status-inline" role="status" aria-live="polite">
                        <div class="ds-chat-inline-status">
                            <div class="ds-chat-spinner ds-chat-spinner-aux"></div>
                            <span>{evolutionBusyLabel}</span>
                        </div>
                        <div class="ds-chat-evolution-status-bar" aria-hidden="true"></div>
                    </div>
                {/if}

                <div class="ds-chat-composer-shell"
                    class:ds-chat-composer-shell-fixed={DBState.db.fixedChatTextarea}
                    class:ds-chat-composer-shell-flow={!DBState.db.fixedChatTextarea}
                >
                {#if DBState.db.useChatSticker && currentCharacter.type !== 'group'}
                    <button
                        type="button"
                        title="Toggle stickers"
                        aria-label="Toggle stickers"
                        onclick={()=>{toggleStickers = !toggleStickers}}
                        class="ds-chat-composer-icon-toggle icon-btn icon-btn--md"
                        class:is-active={toggleStickers}
                    >
                        <Laugh/>
                    </button>
                {/if}

                <textarea class="ds-chat-composer-input control-field"
                          bind:value={messageInput}
                          bind:this={inputEle}
                          enterkeyhint={isMobile || !DBState.db.sendWithEnter ? "enter" : "send"}
                          onkeydown={handleComposerKeydown}
                          onpaste={(e) => {
                        const items = e.clipboardData?.items
                        if(!items){
                            return
                        }
                        let canceled = false

                        for(const item of items){
                            if(item.kind === 'file' && item.type.startsWith('image')){
                                if(!canceled){
                                    e.preventDefault()
                                    canceled = true
                                }
                                const file = item.getAsFile()
                                if(file){
                                    const reader = new FileReader()
                                    reader.onload = async (e) => {
                                        const buf = e.target?.result as ArrayBuffer
                                        const uint8 = new Uint8Array(buf)
                                        const results = await postChatFile({
                                            name: file.name,
                                            data: uint8
                                        })
                                        if(!results) return
                                        for(const res of results){
                                            if(res?.type === 'asset'){
                                                fileInput.push(res.data)
                                            }
                                            if(res?.type === 'text'){
                                                messageInput += `{{file::${res.name}::${res.data}}}`
                                            }
                                        }
                                        updateInputSizeAll()
                                    }
                                    reader.readAsArrayBuffer(file)
                                }
                            }
                        }
                    }}
                          oninput={()=>{updateInputSizeAll();updateInputTransateMessage(false)}}
                          style:height={inputHeight}
                ></textarea>


                {#if $isDoingChat || isDoingChatInputTranslate}
                    <button
                            type="button"
                            title="Abort generation"
                            aria-label="Abort generation"
                            class="ds-chat-composer-action icon-btn icon-btn--sm" onclick={abortChat}
                            style:height={inputHeight}
                    >
                        <div
                            class="ds-chat-spinner"
                            class:ds-chat-process-stage-1={$chatProcessStage === 1}
                            class:ds-chat-process-stage-2={$chatProcessStage === 2}
                            class:ds-chat-process-stage-3={$chatProcessStage === 3}
                            class:ds-chat-process-stage-4={$chatProcessStage === 4}
                            class:ds-chat-process-autoload={autoMode}
                        ></div>
                    </button>
                {:else}
                    <button
                            type="button"
                            title="Send message"
                            aria-label="Send message"
                            onclick={send}
                            class="ds-chat-composer-action icon-btn icon-btn--sm"
                            style:height={inputHeight}
                    >
                        <Send />
                    </button>
                {/if}
                {#if $comfyProgressStore.active}
                    <div class="ds-chat-task-spinner-inline">
                        <div class="ds-chat-spinner ds-chat-spinner-aux"
                            style:--ds-chat-spinner-color={$comfyProgressStore.color}
                        ></div>
                    </div>
                {/if}
                <div
                    class="ds-chat-floating-actions action-rail"
                    class:ds-chat-composer-menu-anchor={true}
                >
                    <button
                            type="button"
                            title="Open chat actions"
                            aria-label="Open chat actions"
                            aria-haspopup="menu"
                            aria-expanded={openMenu}
                            aria-controls="ds-chat-side-menu"
                            onclick={(e) => {
                            openMenu = !openMenu
                            e.stopPropagation()
                        }}
                            class="ds-chat-floating-action-btn icon-btn icon-btn--sm"
                            class:ds-chat-composer-action={true}
                            class:ds-chat-composer-action-end={true}
                            class:is-active={openMenu}
                            style:height={inputHeight}
                    >
                        <MenuIcon />
                    </button>

                    {#if !isEvolutionReviewVisible && openMenu}
                        <div
                            class="ds-chat-side-menu panel-shell ds-ui-menu"
                            class:ds-chat-side-menu-composer={true}
                            id="ds-chat-side-menu"
                            role="menu"
                            aria-label="Chat actions"
                            tabindex="-1"
                            onclick={(e) => {
                                e.stopPropagation()
                            }}
                        >
                            {#if currentCharacter.type === 'group'}
                                <button
                                    type="button"
                                    class="ds-chat-side-menu-item ds-ui-menu-item"
                                    title={language.autoMode}
                                    aria-label={language.autoMode}
                                    onclick={runAutoMode}
                                >
                                    <DicesIcon />
                                    <span class="ds-chat-side-menu-label">{language.autoMode}</span>
                                </button>
                            {/if}

                            {#if currentCharacter.ttsMode === 'webspeech' || currentCharacter.ttsMode === 'elevenlab'}
                                <button
                                    type="button"
                                    class="ds-chat-side-menu-item ds-ui-menu-item"
                                    title={language.ttsStop}
                                    aria-label={language.ttsStop}
                                    onclick={() => {
                                        stopTTS()
                                    }}
                                >
                                    <MicOffIcon />
                                    <span class="ds-chat-side-menu-label">{language.ttsStop}</span>
                                </button>
                            {/if}

                            <button
                                type="button"
                                class="ds-chat-side-menu-item ds-ui-menu-item"
                                class:ds-chat-side-menu-item-disabled={!canContinueResponse}
                                title={language.continueResponse}
                                aria-label={language.continueResponse}
                                aria-disabled={!canContinueResponse}
                                onclick={() => {
                                    if(!canContinueResponse){
                                        return
                                    }
                                    sendContinue();
                                }}
                            >
                                <StepForwardIcon />
                                <span class="ds-chat-side-menu-label">{language.continueResponse}</span>
                            </button>

                            {#if DBState.db.showMenuChatList}
                                <button
                                    type="button"
                                    class="ds-chat-side-menu-item ds-ui-menu-item"
                                    title={language.chatList}
                                    aria-label={language.chatList}
                                    onclick={() => {
                                        onOpenChatList()
                                        openMenu = false
                                    }}
                                >
                                    <DatabaseIcon />
                                    <span class="ds-chat-side-menu-label">{language.chatList}</span>
                                </button>
                            {/if}

                            {#each comfyMenuTemplates as template (`comfy-template-${template.id}`)}
                                <div class="ds-chat-side-menu-divider"></div>
                                <button
                                    type="button"
                                    class="ds-chat-side-menu-item ds-ui-menu-item"
                                    title={template.buttonName || template.trigger}
                                    aria-label={template.buttonName || template.trigger}
                                    onclick={() => {
                                        void runComfyTemplateById(template.id)
                                        openMenu = false
                                    }}
                                >
                                    <ImagePlusIcon />
                                    <span class="ds-chat-side-menu-label">{template.buttonName || template.trigger}</span>
                                </button>
                            {/each}

                            {#if DBState.db.translator !== ''}
                                <button
                                    type="button"
                                    class="ds-chat-side-menu-item ds-ui-menu-item"
                                    class:ds-chat-side-menu-item-active={DBState.db.useAutoTranslateInput}
                                    title={language.autoTranslateInput}
                                    aria-label={language.autoTranslateInput}
                                    aria-pressed={DBState.db.useAutoTranslateInput}
                                    onclick={() => {
                                        DBState.db.useAutoTranslateInput = !DBState.db.useAutoTranslateInput
                                    }}
                                >
                                    <GlobeIcon />
                                    <span class="ds-chat-side-menu-label">{language.autoTranslateInput}</span>
                                </button>
                            {/if}

                            <button
                                type="button"
                                class="ds-chat-side-menu-item ds-ui-menu-item"
                                title={language.screenshot}
                                aria-label={language.screenshot}
                                onclick={() => {
                                    screenShot()
                                }}
                            >
                                <CameraIcon />
                                <span class="ds-chat-side-menu-label">{language.screenshot}</span>
                            </button>

                            <button
                                type="button"
                                class="ds-chat-side-menu-item ds-ui-menu-item"
                                title="Character evolution handoff"
                                aria-label="Character evolution handoff"
                                onclick={() => {
                                    void runEvolutionHandoff()
                                }}
                                disabled={evolutionBusy || currentCharacter?.type === 'group' || !!currentEvolutionSettings?.pendingProposal}
                            >
                                <GitBranch />
                                <span class="ds-chat-side-menu-label">
                                    {#if evolutionAction === 'handoff'}
                                        {#if evolutionHandoffBlockedForCurrentChat}
                                            Replaying Accepted Chat
                                        {:else}
                                            Running Handoff
                                        {/if}
                                    {:else if currentEvolutionSettings?.pendingProposal}
                                        Review Pending Proposal
                                    {:else if evolutionHandoffBlockedForCurrentChat}
                                        Replay Accepted Chat
                                    {:else}
                                        Handoff
                                    {/if}
                                </span>
                            </button>

                            <button
                                type="button"
                                class="ds-chat-side-menu-item ds-ui-menu-item"
                                title={language.postFile}
                                aria-label={language.postFile}
                                onclick={async () => {
                                    const results = await postChatFile(messageInput)
                                    if(!results) return
                                    for(const res of results){
                                        if(res?.type === 'asset'){
                                            fileInput.push(res.data)
                                        }
                                        if(res?.type === 'text'){
                                            messageInput += `{{file::${res.name}::${res.data}}}`
                                        }
                                    }
                                    updateInputSizeAll()
                                }}
                            >
                                <ImagePlusIcon />
                                <span class="ds-chat-side-menu-label">{language.postFile}</span>
                            </button>

                            <button
                                type="button"
                                class="ds-chat-side-menu-item ds-ui-menu-item"
                                class:ds-chat-side-menu-item-active={DBState.db.useAutoSuggestions}
                                title={language.autoSuggest}
                                aria-label={language.autoSuggest}
                                aria-pressed={DBState.db.useAutoSuggestions}
                                onclick={async () => {
                                    DBState.db.useAutoSuggestions = !DBState.db.useAutoSuggestions
                                }}
                            >
                                <ReplyIcon />
                                <span class="ds-chat-side-menu-label">{language.autoSuggest}</span>
                            </button>

                            <button
                                type="button"
                                class="ds-chat-side-menu-item ds-ui-menu-item"
                                title={language.modules}
                                aria-label={language.modules}
                                onclick={() => {
                                    if (currentChatEntry) {
                                        currentChatEntry.modules ??= []
                                    }
                                    onOpenModuleList()
                                    openMenu = false
                                }}
                            >
                                <PackageIcon />
                                <span class="ds-chat-side-menu-label">{language.modules}</span>
                            </button>

                            {#if DBState.db.sideMenuRerollButton}
                                <button
                                    type="button"
                                    class="ds-chat-side-menu-item ds-ui-menu-item"
                                    title={language.reroll}
                                    aria-label={language.reroll}
                                    onclick={reroll}
                                >
                                    <RefreshCcwIcon />
                                    <span class="ds-chat-side-menu-label">{language.reroll}</span>
                                </button>
                            {/if}
                        </div>
                    {/if}
                </div>
                </div>
            </div>
            {/if}
        </div>
    {/if}
</div>

<style>
    .ds-chat-review-mode {
        display: flex;
        flex: 1 1 auto;
        min-height: 0;
        width: 100%;
        background: var(--ds-surface-1);
    }

    .ds-chat-composer-stack {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: var(--ds-space-2);
        width: min(calc(100% - var(--ds-space-5)), 68rem);
        margin-inline: auto;
    }

    .ds-chat-evolution-review-prompt {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--ds-space-3);
        width: 100%;
        padding: var(--ds-space-2) var(--ds-space-3);
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-md);
        background: color-mix(in srgb, var(--ds-surface-2) 92%, transparent);
        color: inherit;
        cursor: pointer;
    }

    .ds-chat-evolution-review-prompt-action {
        color: var(--ds-text-primary);
        font-weight: var(--ds-font-weight-medium);
    }

    .ds-chat-evolution-status-inline {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
        padding: var(--ds-space-2) var(--ds-space-3);
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-md);
        background: var(--ds-surface-2);
    }

    .ds-chat-composer-menu-anchor {
        position: relative;
        display: inline-flex;
        align-items: stretch;
    }

    .ds-chat-side-menu-composer {
        position: absolute;
        right: 0;
        bottom: calc(100% + var(--ds-space-2));
        min-width: min(20rem, calc(100vw - (var(--ds-space-4) * 2)));
        z-index: 35;
    }

    @media (max-width: 720px) {
        .ds-chat-composer-stack,
        .ds-chat-evolution-status-inline,
        .ds-chat-side-menu-composer,
        .ds-chat-evolution-review-prompt {
            width: 100%;
            min-width: 0;
        }

        .ds-chat-evolution-review-prompt {
            align-items: flex-start;
            flex-direction: column;
        }
    }
</style>
