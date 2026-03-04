<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import { getCustomBackground, getEmotion } from "../../ts/util";
    
    import { DBState } from 'src/ts/stores.svelte';
    import { CharEmotion, MobileGUI, selectedCharID } from "../../ts/stores.svelte";
    import { ConnectionOpenStore } from "src/ts/sync/multiuser";
    import ResizeBox from './ResizeBox.svelte'
    import DefaultChatScreen from "./DefaultChatScreen.svelte";
    import defaultWallpaper from '../../etc/bg.jpg'
    import ChatList from "../Others/ChatList.svelte";
    import TransitionImage from "./TransitionImage.svelte";
    import BackgroundDom from "./BackgroundDom.svelte";
    import ChatRightSidebarHost from "./ChatRightSidebarHost.svelte";
    import ModuleChatMenu from "../Setting/Pages/Module/ModuleChatMenu.svelte";
    import { language } from "../../lang";
    interface Props {
        rightSidebarOpen?: boolean;
        rightSidebarTab?: "chat" | "character" | "memory";
        rightSidebarVisible?: boolean;
    }

    let {
        rightSidebarOpen = $bindable(true),
        rightSidebarTab = $bindable("chat"),
        rightSidebarVisible = $bindable(false),
    }: Props = $props();

    let openChatList = $state(false)
    let openModuleList = $state(false)
    let viewportWidth = $state(typeof window !== "undefined" ? window.innerWidth : 1440)
    type RightPanelTab = "chat" | "character" | "memory";
    type PersistedRightPanelTab = Exclude<RightPanelTab, "memory">;
    const rightPanelTabKey = "risu:desktop-right-panel-tab"
    const rightSidebarPanelId = "chat-right-sidebar-drawer"
    const isPersistedRightPanelTab = (value: string | null): value is PersistedRightPanelTab => value === "chat" || value === "character"

    const currentCharacter = $derived($selectedCharID >= 0 ? DBState.db.characters[$selectedCharID] : null)
    const configTabLabel = $derived(currentCharacter?.type === "group" ? language.group : language.character)
    const resolvedReadingMode = $derived(DBState.db.chatReadingMode === "focus" ? "focus" : "normal")
    const chatThemeToken = $derived.by(() => {
        if (DBState.db.theme === "waifu") {
            return "waifu"
        }
        if (DBState.db.theme === "cardboard") {
            return "cardboard"
        }
        if (DBState.db.theme === "mobile" || DBState.db.theme === "waifuMobile") {
            return "mobilechat"
        }
        return "classic"
    })
    const effectiveReadingMode = $derived.by(() => {
        if (resolvedReadingMode !== "focus") {
            return "normal"
        }
        if (viewportWidth < 1024) {
            return "normal"
        }
        if (DBState.db.theme === "customHTML" || DBState.db.theme === "waifuMobile") {
            return "normal"
        }
        return "focus"
    })
    const showDesktopSidePanel = $derived(
        viewportWidth >= 1024 &&
        $selectedCharID >= 0 &&
        !!currentCharacter &&
        !$MobileGUI &&
        !$ConnectionOpenStore &&
        !openChatList &&
        !openModuleList
    )

    const updateViewport = () => {
        viewportWidth = window.innerWidth
    }

    onMount(() => {
        updateViewport()
        window.addEventListener("resize", updateViewport)
        const savedTab = window.localStorage.getItem(rightPanelTabKey)
        if (isPersistedRightPanelTab(savedTab)) {
            rightSidebarTab = savedTab
        } else if (savedTab === "memory") {
            // Memory is intentionally not persisted across sessions; restore a safe explicit default.
            rightSidebarTab = "chat"
            window.localStorage.setItem(rightPanelTabKey, "chat")
        }
    })

    onDestroy(() => {
        window.removeEventListener("resize", updateViewport)
    })

    $effect(() => {
        if (viewportWidth < 1024) {
            rightSidebarOpen = false
        }
    })

    $effect(() => {
        rightSidebarVisible = showDesktopSidePanel && rightSidebarOpen
    })

    const openGlobalChatList = () => {
        openModuleList = false
        openChatList = true
    }

    const openGlobalModuleList = () => {
        openChatList = false
        openModuleList = true
    }

    const setRightPanelTab = (nextTab: RightPanelTab) => {
        rightSidebarTab = nextTab
        if (typeof window !== "undefined") {
            if (nextTab === "memory") {
                return
            }
            window.localStorage.setItem(rightPanelTabKey, nextTab)
        }
    }

    const closeChatList = () => {
        openChatList = false
    }

    const closeModuleList = () => {
        openModuleList = false
    }

    const isSafeCssColorValue = (value: unknown) => {
        if (typeof value !== 'string') return false
        const trimmed = value.trim()
        if (!trimmed || trimmed.length > 64) return false
        return /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|[a-zA-Z]+)$/i.test(trimmed)
    }
    const normalizeScreenBackgroundColor = (value: unknown) => {
        if (!isSafeCssColorValue(value)) {
            return 'rgba(0,0,0,0.8)'
        }
        const trimmed = String(value).trim()
        if (/^#[0-9a-fA-F]{3}$/i.test(trimmed)) {
            return `${trimmed}8`
        }
        if (/^#[0-9a-fA-F]{6}$/i.test(trimmed)) {
            return `${trimmed}80`
        }
        return trimmed
    }
    const normalizeBorderColor = (value: unknown) => {
        if (!isSafeCssColorValue(value)) return ''
        return String(value).trim()
    }

    const wallPaper = `background: url(${defaultWallpaper})`
    const externalStyles = $derived(
            ("background: " + normalizeScreenBackgroundColor(DBState.db.textScreenColor) + ';\n')
        +   (DBState.db.textBorder ? "text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;" : '')
        +   (DBState.db.textScreenRounded ? "border-radius: 2rem; padding: 1rem;" : '')
        +   (normalizeBorderColor(DBState.db.textScreenBorder) ? `border: 0.3rem solid ${normalizeBorderColor(DBState.db.textScreenBorder)};` : '')
    )
    let bgImg= $state('')
    let lastBg = ''
    let emotionSrc = $state<string[]>([])
    let emotionRequestId = 0
    $effect(() => {
        const requestedBackground = DBState.db.customBackground
        if (requestedBackground === lastBg) {
            return
        }
        lastBg = requestedBackground
        ;(async () => {
            bgImg = await getCustomBackground(requestedBackground)
        })()
    });
    $effect(() => {
        const selected = $selectedCharID
        const emotionSnapshot = $CharEmotion
        const currentTheme = DBState.db.theme
        if (selected < 0 || (currentTheme !== 'waifu' && currentTheme !== 'waifuMobile')) {
            emotionSrc = []
            return
        }
        const selectedCharacter = DBState.db.characters[selected]
        if (!selectedCharacter || selectedCharacter.viewScreen === 'none') {
            emotionSrc = []
            return
        }
        const requestId = ++emotionRequestId
        ;(async () => {
            const nextEmotionSrc = await getEmotion(DBState.db, emotionSnapshot, 'plain')
            if (requestId === emotionRequestId) {
                emotionSrc = nextEmotionSrc
            }
        })()
    })
</script>

<div
    class="ds-chat-screen-shell"
    data-reading-mode={effectiveReadingMode}
    data-chat-theme={chatThemeToken}
>
    <div class="ds-chat-screen-main">
        {#if DBState.db.theme === 'waifu'}
            <div class="ds-chat-theme-waifu-shell" style="{bgImg.length < 4 ? wallPaper : bgImg}">
                <BackgroundDom />
                {#if $selectedCharID >= 0}
                    {#if DBState.db.characters[$selectedCharID].viewScreen !== 'none'}
                        <div class="ds-chat-waifu-side-shell ds-chat-waifu-side-image" style:width="{42 * (DBState.db.waifuWidth2 / 100)}rem">
                            <TransitionImage classType="waifu" src={emotionSrc}/>
                        </div>
                    {/if}
                {/if}
                <div class="ds-chat-waifu-main-shell" style:width="{42 * (DBState.db.waifuWidth / 100)}rem" class:ds-chat-waifu-main-half={$selectedCharID >= 0 && DBState.db.characters[$selectedCharID].viewScreen !== 'none'}>
                    <DefaultChatScreen
                        customStyle={`${externalStyles}backdrop-filter: blur(4px);`}
                        onOpenChatList={openGlobalChatList}
                        onOpenModuleList={openGlobalModuleList}
                    />
                </div>
            </div>
        {:else if DBState.db.theme === 'waifuMobile'}
            <div class="ds-chat-theme-waifu-mobile-shell" style={bgImg.length < 4 ? wallPaper : bgImg}>
                <BackgroundDom />
                <div class="ds-chat-waifu-mobile-overlay"
                    class:ds-chat-waifu-mobile-third={$selectedCharID >= 0 && DBState.db.characters[$selectedCharID].viewScreen !== 'none'}
                    class:ds-chat-waifu-mobile-full={!($selectedCharID >= 0 && DBState.db.characters[$selectedCharID].viewScreen !== 'none')}
                >
                    <DefaultChatScreen
                        customStyle={`${externalStyles}backdrop-filter: blur(4px);`}
                        onOpenChatList={openGlobalChatList}
                        onOpenModuleList={openGlobalModuleList}
                    />
                </div>
                {#if $selectedCharID >= 0}
                    {#if DBState.db.characters[$selectedCharID].viewScreen !== 'none'}
                        <div class="ds-chat-waifu-mobile-image-shell">
                            <TransitionImage classType="mobile" src={emotionSrc}/>
                        </div>
                    {/if}
                {/if}
            </div>
        {:else}
            <div class="ds-chat-theme-classic-shell">
                <BackgroundDom />
                <div style={bgImg} class="ds-chat-theme-classic-main" class:ds-chat-theme-classic-main-max={DBState.db.classicMaxWidth}>
                    {#if $selectedCharID >= 0}
                        {#if DBState.db.characters[$selectedCharID].viewScreen !== 'none' && (DBState.db.characters[$selectedCharID].type === 'group' || (!DBState.db.characters[$selectedCharID].inlayViewScreen))}
                            <ResizeBox />
                        {/if}
                    {/if}
                    <DefaultChatScreen
                        customStyle={bgImg.length > 2 ? `${externalStyles}`: ''}
                        onOpenChatList={openGlobalChatList}
                        onOpenModuleList={openGlobalModuleList}
                    />
                </div>
            </div>
        {/if}
    </div>

    {#if showDesktopSidePanel && rightSidebarOpen}
        <div
            id={rightSidebarPanelId}
            class="ds-chat-right-drawer drawer-elevation--right"
            data-testid="chat-right-sidebar-drawer"
        >
            <ChatRightSidebarHost
                rightSidebarTab={rightSidebarTab}
                chatTabLabel={language.Chat}
                configTabLabel={configTabLabel}
                memoryTabLabel={language.memoryTab}
                onSelectTab={setRightPanelTab}
            />
        </div>
    {/if}
</div>

{#if openChatList}
    <ChatList close={closeChatList}/>
{:else if openModuleList}
    <ModuleChatMenu close={closeModuleList}/>
{/if}

<style>
    .ds-chat-right-drawer {
        position: fixed;
        top: var(--topbar-h);
        right: 0;
        bottom: 0;
        width: clamp(280px, 24vw, 360px);
        max-width: min(360px, 100vw);
        z-index: var(--z-drawer);
        display: flex;
        animation: ds-drawer-slide-in-right var(--ds-motion-base) var(--ds-ease-standard);
    }

    @media (max-width: 1279px) {
        .ds-chat-right-drawer {
            width: clamp(280px, 28vw, 360px);
            max-width: min(360px, 100vw);
        }
    }

</style>
