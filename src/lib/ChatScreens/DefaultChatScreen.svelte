<script lang="ts">
     

    import Suggestion from './Suggestion.svelte';
    import { ArrowDown } from "@lucide/svelte";
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
    import { isDoingChat, sendChat } from "../../ts/process/index.svelte";
    import { sleep } from "../../ts/util";
    import { language } from "../../lang";
    import { alertError, alertNormal, alertWait } from "../../ts/alert";
    import sendSound from '../../etc/send.mp3'
    import { processScript } from "src/ts/process/scripts";
    import CreatorQuote from "./CreatorQuote.svelte";
    import MainMenu from '../UI/MainMenu.svelte';
    import { aiLawApplies, chatFoldedState, chatFoldedStateMessageIndex, downloadFile } from 'src/ts/globalApi.svelte';
    import { runTrigger } from 'src/ts/process/triggers';
    import { v4 } from 'uuid';
    import { PreUnreroll, Prereroll } from 'src/ts/process/prereroll';
    import { processMultiCommand } from 'src/ts/process/command';
    import { isNodeServer } from "src/ts/platform";
    import Chats from './Chats.svelte';
    import Button from '../UI/GUI/Button.svelte';
    import GameStateHud from '../SideBars/GameStateHUD.svelte';
    import { runComfyTemplateById } from 'src/ts/integrations/comfy/execute';
    import { stopTTS } from 'src/ts/process/tts';
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
    import { createDefaultCharacterEvolutionState } from 'src/ts/character-evolution/schema';
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
    import { readChatScrollState, scrollToChatMessage } from './defaultChatScreen.scroll';
    import DefaultChatComposer from './DefaultChatComposer.svelte';
    import DefaultChatReviewShell from './DefaultChatReviewShell.svelte';
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
        await scrollToChatMessage({
            index,
            currentChatLength: currentChat.length,
            loadPages,
            setLoadPages: (nextLoadPages) => {
                loadPages = nextLoadPages
            },
            setScrollingToMessage: (active) => {
                isScrollingToMessage = active
            },
            sleep,
        })
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
            currentState: currentEvolutionSettings?.currentState ?? createDefaultCharacterEvolutionState(),
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
                const message = getUserMessagePersistFailureMessage(error)
                defaultChatScreenLog('[Sync] User message save failed. Blocking generation.', error)
                alertError(message)
                return
            }
        }
        rerolls = []
        await sleep(10)
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
                <DefaultChatReviewShell
                    evolutionSettings={currentEvolutionSettings}
                    bind:evolutionProposalDraft
                    {evolutionBusy}
                    onAccept={() => acceptEvolutionProposal(false)}
                    onAcceptAndCreate={() => acceptEvolutionProposal(true)}
                    onReject={rejectEvolutionProposal}
                    onClose={() => { showEvolutionProposal = false }}
                />
            {:else}
            <div class="ds-chat-scroll-shell default-chat-screen"
                onscroll={(e) => {
            const nextScrollState = readChatScrollState({
                event: e,
                currentChatLength: currentChat.length,
                loadPages,
            })
            loadPages = nextScrollState.nextLoadPages
            if(nextScrollState.shouldHideNewMessageButton){
                showNewMessageButton = false
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

            <DefaultChatComposer
                {currentCharacter}
                {currentEvolutionSettings}
                {evolutionBusy}
                {evolutionBusyLabel}
                {evolutionAction}
                {evolutionHandoffBlockedForCurrentChat}
                bind:messageInput
                bind:messageInputTranslate
                bind:fileInput
                bind:openMenu
                bind:toggleStickers
                {autoMode}
                isDoingChat={$isDoingChat}
                {isDoingChatInputTranslate}
                {canContinueResponse}
                {comfyMenuTemplates}
                onOpenEvolutionReview={() => { showEvolutionProposal = true }}
                onSend={() => { void send() }}
                onAbort={abortChat}
                onReroll={() => { void reroll() }}
                onRunAutoMode={() => { void runAutoMode() }}
                onStopTTS={stopTTS}
                onSendContinue={() => { void sendContinue() }}
                onOpenChatList={onOpenChatList}
                onRunComfyTemplate={(templateId) => {
                    void runComfyTemplateById(templateId)
                }}
                onScreenshot={() => { void screenShot() }}
                onRunEvolutionHandoff={() => {
                    void runEvolutionHandoff()
                }}
                onOpenModuleList={() => {
                    if (currentChatEntry) {
                        currentChatEntry.modules ??= []
                    }
                    onOpenModuleList()
                }}
            />
            {/if}
        </div>
    {/if}
</div>
