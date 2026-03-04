<script lang="ts">
    import { tick } from "svelte";
    import SideChatList from "../SideBars/SideChatList.svelte";
    import CharConfig from "../SideBars/CharConfig.svelte";
    import HypaV3Modal from "../Others/HypaV3Modal.svelte";
    import { DBState, selectedCharID } from "src/ts/stores.svelte";

    type RightPanelTab = "chat" | "character" | "memory";

    interface Props {
        rightSidebarTab?: RightPanelTab;
        chatTabLabel?: string;
        configTabLabel?: string;
        memoryTabLabel?: string;
        onSelectTab?: (tab: RightPanelTab) => void;
    }

    const {
        rightSidebarTab = "chat",
        chatTabLabel = "Chat",
        configTabLabel = "Character",
        memoryTabLabel = "Memory",
        onSelectTab = () => {},
    }: Props = $props();

    const rightPanelTabs: RightPanelTab[] = ["chat", "character", "memory"];
    const selectedCharacter = $derived($selectedCharID >= 0 ? DBState.db.characters[$selectedCharID] : null);
    const chatPanelId = "chat-sidebar-panel-chat";
    const characterPanelId = "chat-sidebar-panel-character";
    const memoryPanelId = "chat-sidebar-panel-memory";
    let chatTabButton: HTMLButtonElement | null = null;
    let characterTabButton: HTMLButtonElement | null = null;
    let memoryTabButton: HTMLButtonElement | null = null;

    const selectTab = (nextTab: RightPanelTab) => {
        onSelectTab(nextTab);
    };

    const focusTabButton = (tab: RightPanelTab) => {
        if (tab === "chat") {
            chatTabButton?.focus();
            return;
        }
        if (tab === "character") {
            characterTabButton?.focus();
            return;
        }
        memoryTabButton?.focus();
    };

    const selectTabAndFocus = async (nextTab: RightPanelTab) => {
        selectTab(nextTab);
        await tick();
        focusTabButton(nextTab);
    };

    const focusCharacterSubTab = async () => {
        await tick();
        const activeSubTab = document.querySelector(".char-config-tab.active") as HTMLButtonElement | null;
        activeSubTab?.focus();
    };

    const getHorizontalDirection = (key: string): 1 | -1 | 0 => {
        if (key === "ArrowRight" || key === "Right") {
            return 1;
        }
        if (key === "ArrowLeft" || key === "Left") {
            return -1;
        }
        return 0;
    };

    const handleRightPanelTabKeydown = async (event: KeyboardEvent, currentTab: RightPanelTab = rightSidebarTab) => {
        if (event.key === "Home") {
            await selectTabAndFocus("chat");
            event.preventDefault();
            return;
        }

        if (event.key === "End") {
            await selectTabAndFocus("memory");
            event.preventDefault();
            return;
        }

        const direction = getHorizontalDirection(event.key);
        if (direction === 0) {
            return;
        }

        const currentIndex = rightPanelTabs.indexOf(currentTab);
        const nextIndex = (currentIndex + direction + rightPanelTabs.length) % rightPanelTabs.length;
        await selectTabAndFocus(rightPanelTabs[nextIndex]);
        event.preventDefault();
    };

    const handleCharacterTabKeydown = async (event: KeyboardEvent) => {
        if (event.key === "Tab" && !event.shiftKey && rightSidebarTab === "character") {
            await focusCharacterSubTab();
            event.preventDefault();
            return;
        }
        await handleRightPanelTabKeydown(event, "character");
    };
</script>

<aside class="ds-chat-right-pane" data-testid="chat-sidebar-host">
    <div
        class="ds-chat-right-panel-tabs seg-tabs"
        role="tablist"
        aria-label="Inspector sections"
        tabindex="-1"
        onkeydown={(event) => {
            if (event.target !== event.currentTarget) {
                return;
            }
            handleRightPanelTabKeydown(event);
        }}
    >
        <button
            type="button"
            class="ds-chat-right-panel-tab seg-tab"
            data-testid="chat-sidebar-tab-chat"
            data-chat-sidebar-tab="chat"
            role="tab"
            id="chat-sidebar-tab-chat"
            bind:this={chatTabButton}
            aria-selected={rightSidebarTab === "chat"}
            aria-controls={chatPanelId}
            tabindex={rightSidebarTab === "chat" ? 0 : -1}
            class:ds-chat-right-panel-tab-active={rightSidebarTab === "chat"}
            class:active={rightSidebarTab === "chat"}
            class:is-active={rightSidebarTab === "chat"}
            onclick={() => selectTabAndFocus("chat")}
            onkeydown={(event) => handleRightPanelTabKeydown(event, "chat")}
        >{chatTabLabel}</button>
        <button
            type="button"
            class="ds-chat-right-panel-tab seg-tab"
            data-testid="chat-sidebar-tab-character"
            data-chat-sidebar-tab="character"
            role="tab"
            id="chat-sidebar-tab-character"
            bind:this={characterTabButton}
            aria-selected={rightSidebarTab === "character"}
            aria-controls={characterPanelId}
            tabindex={rightSidebarTab === "character" ? 0 : -1}
            class:ds-chat-right-panel-tab-active={rightSidebarTab === "character"}
            class:active={rightSidebarTab === "character"}
            class:is-active={rightSidebarTab === "character"}
            onclick={() => selectTabAndFocus("character")}
            onkeydown={handleCharacterTabKeydown}
        >{configTabLabel}</button>
        <button
            type="button"
            class="ds-chat-right-panel-tab seg-tab"
            data-testid="chat-sidebar-tab-memory"
            data-chat-sidebar-tab="memory"
            role="tab"
            id="chat-sidebar-tab-memory"
            bind:this={memoryTabButton}
            aria-selected={rightSidebarTab === "memory"}
            aria-controls={memoryPanelId}
            tabindex={rightSidebarTab === "memory" ? 0 : -1}
            class:ds-chat-right-panel-tab-active={rightSidebarTab === "memory"}
            class:active={rightSidebarTab === "memory"}
            class:is-active={rightSidebarTab === "memory"}
            onclick={() => selectTabAndFocus("memory")}
            onkeydown={(event) => handleRightPanelTabKeydown(event, "memory")}
        >{memoryTabLabel}</button>
    </div>
    <div class="ds-chat-right-panel-content">
        {#if rightSidebarTab === "chat"}
            <div
                class="ds-chat-right-panel-pane ds-chat-right-panel-pane-chat"
                data-testid="chat-sidebar-pane-chat"
                role="tabpanel"
                id={chatPanelId}
                aria-labelledby="chat-sidebar-tab-chat"
                tabindex={0}
                onkeydown={(event) => {
                    if (event.target !== event.currentTarget) {
                        return
                    }
                    handleRightPanelTabKeydown(event, "chat")
                }}
            >
                <SideChatList chara={selectedCharacter ?? undefined} />
            </div>
        {:else if rightSidebarTab === "character"}
            <div
                class="ds-chat-right-panel-pane ds-chat-right-panel-pane-character"
                data-testid="chat-sidebar-pane-character"
                role="tabpanel"
                id={characterPanelId}
                aria-labelledby="chat-sidebar-tab-character"
                tabindex={0}
                onkeydown={(event) => {
                    if (event.target !== event.currentTarget) {
                        return
                    }
                    handleRightPanelTabKeydown(event, "character")
                }}
            >
                <CharConfig />
            </div>
        {:else}
            <div
                class="ds-chat-right-panel-pane ds-chat-right-panel-pane-memory"
                data-testid="chat-sidebar-pane-memory"
                role="tabpanel"
                id={memoryPanelId}
                aria-labelledby="chat-sidebar-tab-memory"
                tabindex={0}
                onkeydown={(event) => {
                    if (event.target !== event.currentTarget) {
                        return
                    }
                    handleRightPanelTabKeydown(event, "memory")
                }}
            >
                <HypaV3Modal embedded />
            </div>
        {/if}
    </div>
</aside>
