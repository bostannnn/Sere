<script lang="ts">
     

    import Suggestion from './Suggestion.svelte';
    import { CameraIcon, DatabaseIcon, DicesIcon, GlobeIcon, ImagePlusIcon, LanguagesIcon, Laugh, MenuIcon, MicOffIcon, PackageIcon, RefreshCcwIcon, ReplyIcon, Send, StepForwardIcon, XIcon, ArrowDown } from "@lucide/svelte";
    import { selectedCharID, createSimpleCharacter, ScrollToMessageStore, comfyProgressStore } from "../../ts/stores.svelte";
    import { tick } from 'svelte';
    import Chat from "./Chat.svelte";
    import { getDatabase, type Message } from "../../ts/storage/database.svelte";
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
    import { saveServerDatabase } from "src/ts/storage/serverDb";
    import { resolveServerAuthToken } from "src/ts/storage/serverAuth";
    import Chats from './Chats.svelte';
    import Button from '../UI/GUI/Button.svelte';
    import GameStateHud from '../SideBars/GameStateHUD.svelte';
    import { runComfyTemplateById } from 'src/ts/integrations/comfy/execute';
    const defaultChatScreenLog = (..._args: unknown[]) => {};
    
    interface Props {
        onOpenModuleList?: () => void;
        onOpenChatList?: () => void;
        customStyle?: string;
    }

    let messageInput:string = $state('')
    let messageInputTranslate:string = $state('')
    let openMenu = $state(false)
    let loadPages = $state(30)
    let autoMode = $state(false)
    let rerolls:Message[][] = []
    let rerollid = -1
    let lastCharId = -1
    const isDoingChatInputTranslate = false
    let toggleStickers:boolean = $state(false)
    let fileInput:string[] = $state([])
    let showNewMessageButton = $state(false)
    let chatsInstance: unknown = $state()
    let isScrollingToMessage = $state(false)
    let {
        onOpenModuleList = () => {},
        onOpenChatList = () => {},
        customStyle = ''
    }: Props = $props();
    const currentCharacter = $derived(DBState.db.characters[$selectedCharID])
    const currentChat = $derived(currentCharacter?.chats[currentCharacter.chatPage]?.message ?? [])
    const canContinueResponse = $derived.by(() => {
        const messages = currentCharacter?.chats?.[currentCharacter.chatPage]?.message ?? [];
        if (messages.length < 2) return false;
        return messages[messages.length - 1]?.role === 'char';
    })
    const comfyMenuTemplates = $derived.by(() => {
        const templates = DBState.db.comfyCommander?.templates ?? []
        return templates.filter((template) => template.showInChatMenu)
    })

    function extractHttpStatusFromError(error: unknown): number | null {
        const message = `${(error as Error | undefined)?.message ?? error ?? ''}`
        const match = message.match(/\((\d{3})\)/)
        if(!match){
            return null
        }
        return parseInt(match[1])
    }

    function getUserMessagePersistFailureMessage(error: unknown) {
        const status = extractHttpStatusFromError(error)
        if(status === 429){
            return 'Message was not sent: authentication is rate-limited. Wait and retry.'
        }
        if(status === 401 || status === 403){
            return 'Message was not sent: authentication failed. Re-enter password and retry.'
        }
        return 'Message was not sent because it could not be saved to server. Retry after server restart.'
    }

    async function flushUserMessageBeforeGeneration(selectedChar: number) {
        const activeChar = DBState.db.characters[selectedChar]
        const activeChat = activeChar?.chats?.[activeChar.chatPage]
        if (!activeChar?.chaId || !activeChat?.id) {
            return
        }
        try {
            await saveServerDatabase(getDatabase(), {
                character: [activeChar.chaId],
                chat: [[activeChar.chaId, activeChat.id]],
            })
            return
        } catch (error) {
            const status = extractHttpStatusFromError(error)
            if(status !== 401 && status !== 403){
                throw error
            }
            await resolveServerAuthToken({ interactive: true })
            await saveServerDatabase(getDatabase(), {
                character: [activeChar.chaId],
                chat: [[activeChar.chaId, activeChat.id]],
            })
        }
    }

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
        const selectedChar = $selectedCharID
        if(selectedChar < 0){
            return
        }
        const selectedCharacter = DBState.db.characters?.[selectedChar]
        if(!selectedCharacter || !Array.isArray(selectedCharacter.chats) || selectedCharacter.chats.length === 0){
            return
        }
        if(typeof selectedCharacter.chatPage !== 'number' || selectedCharacter.chatPage < 0){
            selectedCharacter.chatPage = 0
        }
        if(selectedCharacter.chatPage >= selectedCharacter.chats.length){
            selectedCharacter.chatPage = Math.max(0, selectedCharacter.chats.length - 1)
        }
        const activeChat = selectedCharacter.chats[selectedCharacter.chatPage]
        if(!activeChat || !Array.isArray(activeChat.message)){
            return
        }
        if($isDoingChat){
            return
        }
        if(lastCharId !== $selectedCharID){
            rerolls = []
            rerollid = -1
        }

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
            if(DBState.db.characters[selectedChar].type !== 'group'){
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
            const char = DBState.db.characters[selectedChar]
            if(char.type === 'character'){
                const triggerResult = await runTrigger(char,'input', {chat: char.chats[char.chatPage]})
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
        DBState.db.characters[selectedChar].chats[DBState.db.characters[selectedChar].chatPage].message = cha
        if (isNodeServer && appendedUserMessage) {
            try {
                await flushUserMessageBeforeGeneration(selectedChar)
            } catch (error) {
                DBState.db.characters[selectedChar].chats[DBState.db.characters[selectedChar].chatPage].message = beforeSendMessages
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
        await sendChatMain(continueResponse)

    }

    async function reroll() {
        if($isDoingChat){
            return
        }
        if(lastCharId !== $selectedCharID){
            rerolls = []
            rerollid = -1
        }
        const genId = DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message.at(-1)?.generationInfo?.generationId
        if(genId){
            const r = Prereroll(genId)
            if(r){
                DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message[DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message.length - 1].data = r
                return
            }
        }
        if(rerollid < rerolls.length - 1){
            if(Array.isArray(rerolls[rerollid + 1])){
                rerollid += 1
                const rerollData = safeStructuredClone(rerolls[rerollid])
                const msgs = DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message
                for(let i = 0; i < rerollData.length; i++){
                    msgs[msgs.length - rerollData.length + i] = rerollData[i]
                }
                DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message = msgs
            }
            return
        }
        if(rerolls.length === 0){
            rerolls.push(safeStructuredClone([DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message.at(-1)]))
            rerollid = rerolls.length - 1
        }
        const cha = safeStructuredClone(DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message)
        if(cha.length === 0 ){
            return
        }
        openMenu = false
        const saying = cha[cha.length - 1].saying
        let sayingQu = 2
        while(cha[cha.length - 1].role !== 'user'){
            if(cha[cha.length - 1].saying === saying){
                sayingQu -= 1
                if(sayingQu === 0){
                    break
                }
            }
            const msg = cha.pop()
            if(!msg){
                return
            }
        }
        DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message = cha
        await sendChatMain()
    }

    async function unReroll() {
        if($isDoingChat){
            return
        }
        if(lastCharId !== $selectedCharID){
            rerolls = []
            rerollid = -1
        }
        const genId = DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message.at(-1)?.generationInfo?.generationId
        if(genId){
            const r = PreUnreroll(genId)
            if(r){
                DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message[DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message.length - 1].data = r
                return
            }
        }
        if(rerollid <= 0){
            return
        }
        if(Array.isArray(rerolls[rerollid - 1])){
            rerollid -= 1
            const rerollData = safeStructuredClone(rerolls[rerollid])
            const msgs = DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message
            for(let i = 0; i < rerollData.length; i++){
                msgs[msgs.length - rerollData.length + i] = rerollData[i]
            }
            DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message = msgs
        }
    }

    let abortController:null|AbortController = null

    async function sendChatMain(continued:boolean = false) {

        const previousLength = DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message.length
        messageInput = ''
        abortController = new AbortController()
        try {
            await sendChat(-1, {
                signal:abortController.signal,
                continue:continued
            })
            if(previousLength < DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message.length){
                rerolls.push(safeStructuredClone(DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message).slice(previousLength))
                rerollid = rerolls.length - 1
            }
            // Guard against occasional scroll drift after long-running generation/RAG.
            await tick()
            scrollToBottom()
        } catch (error) {
            defaultChatScreenLog(error)
            alertError(error)
        }
        lastCharId = $selectedCharID
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
        const selectedChar = $selectedCharID
        autoMode = true
        while(autoMode){
            await sendChatMain()
            if(selectedChar !== $selectedCharID){
                autoMode = false
            }
        }
    }

    const { userIconPortrait, currentUsername, userIcon } = $derived.by(() => {
        const bindedPersona = DBState?.db?.characters?.[$selectedCharID]?.chats?.[DBState?.db?.characters?.[$selectedCharID]?.chatPage]?.bindedPersona

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
    
    {#if showNewMessageButton}
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
    {:else}
        <div class="ds-chat-floating-actions action-rail">
            <button
                type="button"
                class="ds-chat-floating-action-btn icon-btn icon-btn--sm"
                title="Open chat actions"
                aria-label="Open chat actions"
                aria-haspopup="menu"
                aria-expanded={openMenu}
                aria-controls="ds-chat-side-menu"
                onclick={(e) => {
                    openMenu = !openMenu
                    e.stopPropagation()
                }}
            >
                <MenuIcon size={16} />
            </button>
        </div>
        <div class="ds-chat-main-shell">
            <div class="ds-chat-scroll-shell default-chat-screen"
                onscroll={(e) => {
            //@ts-expect-error scrollHeight/clientHeight/scrollTop don't exist on EventTarget, but target is HTMLElement here
            const scrolled = (e.target.scrollHeight - e.target.clientHeight + e.target.scrollTop)
            if(scrolled < 100 && DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message.length > loadPages){
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

            {#if DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message.length <= loadPages}
                {#if DBState.db.characters[$selectedCharID].type !== 'group' }
                    <Chat
                        character={createSimpleCharacter(DBState.db.characters[$selectedCharID])}
                        name={DBState.db.characters[$selectedCharID].name}
                        message={DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].fmIndex === -1 ? DBState.db.characters[$selectedCharID].firstMessage :
                            DBState.db.characters[$selectedCharID].alternateGreetings[DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].fmIndex]}
                        role='char'
                        img={getCharImage(DBState.db.characters[$selectedCharID].image, 'css')}
                        idx={-1}
                        altGreeting={DBState.db.characters[$selectedCharID].alternateGreetings.length > 0}
                        largePortrait={DBState.db.characters[$selectedCharID].largePortrait}
                        firstMessage={true}
                        onReroll={() => {
                            const cha = DBState.db.characters[$selectedCharID]
                            const chat = DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage]
                            if(cha.type !== 'group'){
                                if (chat.fmIndex >= (cha.alternateGreetings.length - 1)){
                                    chat.fmIndex = -1
                                }
                                else{
                                    chat.fmIndex += 1
                                }
                            }
                            DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage] = chat
                        }}
                        unReroll={() => {
                            const cha = DBState.db.characters[$selectedCharID]
                            const chat = DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage]
                            if(cha.type !== 'group'){
                                if (chat.fmIndex === -1){
                                    chat.fmIndex = (cha.alternateGreetings.length - 1)
                                }
                                else{
                                    chat.fmIndex -= 1
                                }
                            }
                            DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage] = chat
                        }}
                        isLastMemory={false}
                        currentPage={(DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].fmIndex ?? -1) + 2}
                        totalPages={DBState.db.characters[$selectedCharID].alternateGreetings.length + 1}

                    />
                    {#if (aiLawApplies() && DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message.length === 0)}
                        <div class="ds-chat-ai-warning">
                            {language.aiGenerationWarning}
                        </div>
                    {/if}
                    {#if !DBState.db.characters[$selectedCharID].removedQuotes && DBState.db.characters[$selectedCharID].creatorNotes.length >= 2}
                        <CreatorQuote quote={DBState.db.characters[$selectedCharID].creatorNotes} onRemove={() => {
                            const cha = DBState.db.characters[$selectedCharID]
                            if(cha.type !== 'group'){
                                cha.removedQuotes = true
                            }
                            DBState.db.characters[$selectedCharID] = cha
                        }} />
                    {/if}
                {/if}
            {/if}

            {#if openMenu}
                <div class="ds-chat-side-menu panel-shell ds-ui-menu"
                    id="ds-chat-side-menu"
                    role="menu"
                    aria-label="Chat actions"
                    tabindex="-1"
                    class:ds-chat-side-menu-fixed={DBState.db.fixedChatTextarea}
                    class:ds-chat-side-menu-absolute={!DBState.db.fixedChatTextarea}
                    onclick={(e) => {
                    e.stopPropagation()
                }}>
                    {#if DBState.db.characters[$selectedCharID].type === 'group'}
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

                    
                    {#if DBState.db.characters[$selectedCharID].ttsMode === 'webspeech' || DBState.db.characters[$selectedCharID].ttsMode === 'elevenlab'}
                        <button
                            type="button"
                            class="ds-chat-side-menu-item ds-ui-menu-item"
                            title={language.ttsStop}
                            aria-label={language.ttsStop}
                            onclick={() => {
                            stopTTS()
                        }}>
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
                        }}>
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
                        }}>
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
                    }}>
                        <CameraIcon />
                        <span class="ds-chat-side-menu-label">{language.screenshot}</span>
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
                    }}>

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
                    }}>
                        <ReplyIcon />
                        <span class="ds-chat-side-menu-label">{language.autoSuggest}</span>
                    </button>


                    <button
                        type="button"
                        class="ds-chat-side-menu-item ds-ui-menu-item"
                        title={language.modules}
                        aria-label={language.modules}
                        onclick={() => {
                        DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].modules ??= []
                        onOpenModuleList()
                        openMenu = false
                    }}>
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
                        class="ds-chat-composer-action ds-chat-composer-action-end icon-btn icon-btn--sm"
                        class:is-active={openMenu}
                        style:height={inputHeight}
                >
                    <MenuIcon />
                </button>
            </div>
        </div>
    {/if}
</div>
