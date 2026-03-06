import { globalFetch } from "./globalApi.svelte";

let bgmElement:HTMLAudioElement|null = null;
let domObserveStarted = false;
let domObserveInterval: ReturnType<typeof setInterval> | null = null;
let domMutationObserver: MutationObserver | null = null;

async function safeCopyToClipboard(text: string) {
    try {
        if (navigator?.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return;
        }
    } catch {
        // fall through to execCommand
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
}

function nodeObserve(node:HTMLElement){
    const hlLang = node.getAttribute('x-hl-lang');
    const ctrlName = node.getAttribute('risu-ctrl');

    if(hlLang){
        node.addEventListener('contextmenu', (e)=>{
            e.preventDefault()

            const prevContextMenu = document.getElementById('code-contextmenu')
            if(prevContextMenu){
                prevContextMenu.remove()
            }

            const menu = document.createElement('div')
            menu.id = 'code-contextmenu'
            menu.setAttribute('class', 'fixed z-50 min-w-[160px] py-2 bg-gray-800 rounded-lg border border-gray-700')

            const copyOption = document.createElement('div')
            copyOption.textContent = 'Copy'
            copyOption.setAttribute('class', 'px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 cursor-pointer')
            copyOption.addEventListener('click', async ()=>{
                await safeCopyToClipboard(node.textContent ?? '')
                menu.remove()
            })

            const downloadOption = document.createElement('div');
            downloadOption.textContent = 'Download';
            downloadOption.setAttribute('class', 'px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 cursor-pointer')
            downloadOption.addEventListener('click', ()=>{
                const a = document.createElement('a')
                a.href = URL.createObjectURL(new Blob([node.textContent], {type: 'text/plain'}))
                a.download = 'code.' + hlLang
                a.click()
                menu.remove()
            })

            menu.appendChild(copyOption)
            menu.appendChild(downloadOption)

            menu.style.left = e.clientX + 'px'
            menu.style.top = e.clientY + 'px'

            document.body.appendChild(menu)
            
            document.addEventListener('click', ()=>{
                menu?.remove()
            }, {once: true})
        })
    }

    if(ctrlName){
        const split = ctrlName.split('___');

        switch(split[0]){
            case 'bgm':{
                const volume = split[1] === 'auto' ? 0.5 : parseFloat(split[1]);
                if(!bgmElement){
                    bgmElement = new Audio(split[2]);
                    bgmElement.volume = volume
                    bgmElement.addEventListener('ended', (event)=>{
                        const endedAudio = event.currentTarget as HTMLAudioElement | null
                        endedAudio?.remove();
                        if(bgmElement === endedAudio){
                            bgmElement = null;
                        }
                    })
                    bgmElement.play();
                }
                break
            }
        }
    }
}

export function startObserveDom(){
    if (domObserveStarted || typeof document === 'undefined') {
        return
    }
    domObserveStarted = true

    const scanNodes = () => {
        document.querySelectorAll('[x-hl-lang], [risu-ctrl]').forEach(nodeObserve)
    }

    // For codeblock controls and risu-ctrl nodes, scan incremental insertions plus periodic fallback.
    domMutationObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if(node instanceof HTMLElement){
                    nodeObserve(node)
                }
            })
        })
    })
    domMutationObserver.observe(document.documentElement, { childList: true, subtree: true })

    scanNodes()
    domObserveInterval = setInterval(scanNodes, 250)
}

export function stopObserveDom() {
    if (!domObserveStarted) {
        return
    }
    domObserveStarted = false
    domMutationObserver?.disconnect()
    domMutationObserver = null
    if (domObserveInterval) {
        clearInterval(domObserveInterval)
        domObserveInterval = null
    }
}


let claudeObserverRunning = false;
let lastClaudeObserverLoad = 0;
let lastClaudeRequestTimes = 0;
let lastClaudeObserverPayload: Record<string, unknown> | null = null;
let lastClaudeObserverHeaders: Record<string, string> | null = null;
let lastClaudeObserverURL: string | null = null;
let claudeObserverInterval: ReturnType<typeof setInterval> | null = null;

export function stopClaudeObserver() {
    if (claudeObserverInterval) {
        clearInterval(claudeObserverInterval);
        claudeObserverInterval = null;
    }
    claudeObserverRunning = false;
}

export function registerClaudeObserver(arg:{
    url:string,
    body:Record<string, unknown>,
    headers:Record<string, string>,
}) {
    lastClaudeRequestTimes = 0;
    lastClaudeObserverLoad = Date.now();
    lastClaudeObserverPayload = safeStructuredClone(arg.body)
    lastClaudeObserverHeaders = arg.headers;
    lastClaudeObserverURL = arg.url;
    if (lastClaudeObserverPayload) {
        lastClaudeObserverPayload.max_tokens = 10;
    }
    claudeObserver()
}

function claudeObserver(){
    if(claudeObserverRunning){
        return
    }
    claudeObserverRunning = true;

    const fetchIt = async (tries = 0)=>{
        const res = await globalFetch(lastClaudeObserverURL, {
            body: lastClaudeObserverPayload,
            headers: lastClaudeObserverHeaders,
            method: "POST"
        })
        if(res.status >= 400){
            if(tries < 3){
                fetchIt(tries + 1)
            }
        }
    }

    const func = ()=>{       
        //request every 4 minutes and 30 seconds
        if(lastClaudeObserverLoad > Date.now() - 1000 * 60 * 4.5){
            return
        }
        
        if(lastClaudeRequestTimes > 4){
            return
        }
        fetchIt()
        lastClaudeObserverLoad = Date.now();
        lastClaudeRequestTimes += 1;
    }
    
    claudeObserverInterval = setInterval(func, 20000)
}

if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        stopObserveDom();
        stopClaudeObserver();
    });
}
