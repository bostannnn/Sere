#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LEGACY_ROOT = "/Users/andrewbostan/Documents/RisuAII";
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function resolveProjectPath(file) {
  if (!file.startsWith(LEGACY_ROOT)) {
    return file;
  }
  return path.join(PROJECT_ROOT, path.relative(LEGACY_ROOT, file));
}

function readFile(file) {
  return fs.readFileSync(resolveProjectPath(file), "utf-8");
}

function ensureIncludes(content, file, pattern, failures) {
  if (!content.includes(pattern)) {
    failures.push(`[chat-sidebar-contract] Missing pattern in ${file}: ${pattern}`);
  }
}

function ensureNotIncludes(content, file, pattern, failures) {
  if (content.includes(pattern)) {
    failures.push(`[chat-sidebar-contract] Forbidden pattern in ${file}: ${pattern}`);
  }
}

const failures = [];

const chatScreenFile = "/Users/andrewbostan/Documents/RisuAII/src/lib/ChatScreens/ChatScreen.svelte";
const hostFile = "/Users/andrewbostan/Documents/RisuAII/src/lib/ChatScreens/ChatRightSidebarHost.svelte";
const sideChatListFile = "/Users/andrewbostan/Documents/RisuAII/src/lib/SideBars/SideChatList.svelte";
const chatScreenContent = readFile(chatScreenFile);
const hostContent = readFile(hostFile);
const sideChatListContent = readFile(sideChatListFile);

ensureIncludes(chatScreenContent, chatScreenFile, "rightSidebarOpen = $bindable(true)", failures);
ensureIncludes(chatScreenContent, chatScreenFile, "rightSidebarTab = $bindable(\"chat\")", failures);
ensureIncludes(chatScreenContent, chatScreenFile, "rightSidebarVisible = $bindable(false)", failures);
ensureIncludes(chatScreenContent, chatScreenFile, "type RightPanelTab = \"chat\" | \"character\" | \"memory\";", failures);
ensureIncludes(chatScreenContent, chatScreenFile, "const rightPanelTabKey = \"risu:desktop-right-panel-tab\"", failures);
ensureIncludes(chatScreenContent, chatScreenFile, "const rightSidebarPanelId = \"chat-right-sidebar-drawer\"", failures);
ensureIncludes(chatScreenContent, chatScreenFile, "window.localStorage.getItem(rightPanelTabKey)", failures);
ensureIncludes(chatScreenContent, chatScreenFile, "window.localStorage.setItem(rightPanelTabKey, nextTab)", failures);
ensureIncludes(chatScreenContent, chatScreenFile, "const configTabLabel = $derived(currentCharacter?.type === \"group\" ? language.group : language.character)", failures);
ensureIncludes(chatScreenContent, chatScreenFile, "const setRightPanelTab = (nextTab: RightPanelTab) => {", failures);
ensureIncludes(chatScreenContent, chatScreenFile, "const showDesktopSidePanel = $derived(", failures);
ensureIncludes(chatScreenContent, chatScreenFile, "!openChatList &&", failures);
ensureIncludes(chatScreenContent, chatScreenFile, "!openModuleList", failures);
ensureIncludes(chatScreenContent, chatScreenFile, "if (viewportWidth < 1024) {", failures);
ensureIncludes(chatScreenContent, chatScreenFile, "rightSidebarOpen = false", failures);
ensureIncludes(chatScreenContent, chatScreenFile, "rightSidebarVisible = showDesktopSidePanel && rightSidebarOpen", failures);
ensureIncludes(chatScreenContent, chatScreenFile, "{#if showDesktopSidePanel && rightSidebarOpen}", failures);
ensureIncludes(chatScreenContent, chatScreenFile, "id={rightSidebarPanelId}", failures);
ensureIncludes(chatScreenContent, chatScreenFile, "data-testid=\"chat-right-sidebar-drawer\"", failures);
ensureIncludes(chatScreenContent, chatScreenFile, "import ChatRightSidebarHost from \"./ChatRightSidebarHost.svelte\";", failures);
ensureIncludes(chatScreenContent, chatScreenFile, "<ChatRightSidebarHost", failures);
ensureIncludes(chatScreenContent, chatScreenFile, "rightSidebarTab={rightSidebarTab}", failures);
ensureIncludes(chatScreenContent, chatScreenFile, "chatTabLabel={language.Chat}", failures);
ensureIncludes(chatScreenContent, chatScreenFile, "configTabLabel={configTabLabel}", failures);
ensureIncludes(chatScreenContent, chatScreenFile, "memoryTabLabel={language.memoryTab}", failures);
ensureIncludes(chatScreenContent, chatScreenFile, "onSelectTab={setRightPanelTab}", failures);

ensureIncludes(hostContent, hostFile, "import { tick } from \"svelte\";", failures);
ensureIncludes(hostContent, hostFile, "const selectTabAndFocus = async (nextTab: RightPanelTab) => {", failures);
ensureIncludes(hostContent, hostFile, "const rightPanelTabs: RightPanelTab[] = [\"chat\", \"character\", \"memory\"];", failures);
ensureIncludes(hostContent, hostFile, "await tick();", failures);
ensureIncludes(hostContent, hostFile, "const focusCharacterSubTab = async () => {", failures);
ensureIncludes(hostContent, hostFile, "const getHorizontalDirection = (key: string): 1 | -1 | 0 => {", failures);
ensureIncludes(hostContent, hostFile, "key === \"ArrowRight\" || key === \"Right\"", failures);
ensureIncludes(hostContent, hostFile, "key === \"ArrowLeft\" || key === \"Left\"", failures);
ensureIncludes(hostContent, hostFile, "const handleRightPanelTabKeydown = async (event: KeyboardEvent, currentTab: RightPanelTab = rightSidebarTab) => {", failures);
ensureIncludes(hostContent, hostFile, "const handleCharacterTabKeydown = async (event: KeyboardEvent) => {", failures);
ensureIncludes(hostContent, hostFile, "if (event.key === \"Tab\" && !event.shiftKey && rightSidebarTab === \"character\") {", failures);
ensureIncludes(hostContent, hostFile, "await focusCharacterSubTab();", failures);
ensureIncludes(hostContent, hostFile, "if (event.key === \"Home\") {", failures);
ensureIncludes(hostContent, hostFile, "if (event.key === \"End\") {", failures);
ensureIncludes(hostContent, hostFile, "await selectTabAndFocus(\"memory\");", failures);
ensureIncludes(hostContent, hostFile, "const direction = getHorizontalDirection(event.key);", failures);
ensureIncludes(hostContent, hostFile, "if (direction === 0) {", failures);
ensureIncludes(hostContent, hostFile, "const currentIndex = rightPanelTabs.indexOf(currentTab);", failures);
ensureIncludes(hostContent, hostFile, "<aside class=\"ds-chat-right-pane\" data-testid=\"chat-sidebar-host\">", failures);
ensureIncludes(hostContent, hostFile, "class=\"ds-chat-right-panel-tabs seg-tabs\"", failures);
ensureIncludes(hostContent, hostFile, "role=\"tablist\"", failures);
ensureIncludes(hostContent, hostFile, "aria-label=\"Inspector sections\"", failures);
ensureIncludes(hostContent, hostFile, "tabindex=\"-1\"", failures);
ensureIncludes(hostContent, hostFile, "if (event.target !== event.currentTarget) {", failures);
ensureIncludes(hostContent, hostFile, "handleRightPanelTabKeydown(event);", failures);
ensureIncludes(hostContent, hostFile, "data-testid=\"chat-sidebar-tab-chat\"", failures);
ensureIncludes(hostContent, hostFile, "data-testid=\"chat-sidebar-tab-character\"", failures);
ensureIncludes(hostContent, hostFile, "data-testid=\"chat-sidebar-tab-memory\"", failures);
ensureIncludes(hostContent, hostFile, "class=\"ds-chat-right-panel-tab seg-tab\"", failures);
ensureIncludes(hostContent, hostFile, "type=\"button\"", failures);
ensureIncludes(hostContent, hostFile, "role=\"tab\"", failures);
ensureIncludes(hostContent, hostFile, "id=\"chat-sidebar-tab-chat\"", failures);
ensureIncludes(hostContent, hostFile, "id=\"chat-sidebar-tab-character\"", failures);
ensureIncludes(hostContent, hostFile, "id=\"chat-sidebar-tab-memory\"", failures);
ensureIncludes(hostContent, hostFile, "aria-selected={rightSidebarTab === \"chat\"}", failures);
ensureIncludes(hostContent, hostFile, "aria-selected={rightSidebarTab === \"character\"}", failures);
ensureIncludes(hostContent, hostFile, "aria-selected={rightSidebarTab === \"memory\"}", failures);
ensureIncludes(hostContent, hostFile, "aria-controls={chatPanelId}", failures);
ensureIncludes(hostContent, hostFile, "aria-controls={characterPanelId}", failures);
ensureIncludes(hostContent, hostFile, "aria-controls={memoryPanelId}", failures);
ensureIncludes(hostContent, hostFile, "tabindex={rightSidebarTab === \"chat\" ? 0 : -1}", failures);
ensureIncludes(hostContent, hostFile, "tabindex={rightSidebarTab === \"character\" ? 0 : -1}", failures);
ensureIncludes(hostContent, hostFile, "tabindex={rightSidebarTab === \"memory\" ? 0 : -1}", failures);
ensureIncludes(hostContent, hostFile, "onclick={() => selectTabAndFocus(\"chat\")}", failures);
ensureIncludes(hostContent, hostFile, "onclick={() => selectTabAndFocus(\"character\")}", failures);
ensureIncludes(hostContent, hostFile, "onclick={() => selectTabAndFocus(\"memory\")}", failures);
ensureIncludes(hostContent, hostFile, "onkeydown={(event) => handleRightPanelTabKeydown(event, \"chat\")}", failures);
ensureIncludes(hostContent, hostFile, "onkeydown={handleCharacterTabKeydown}", failures);
ensureIncludes(hostContent, hostFile, "onkeydown={(event) => handleRightPanelTabKeydown(event, \"memory\")}", failures);
ensureIncludes(hostContent, hostFile, "class:ds-chat-right-panel-tab-active={rightSidebarTab === \"chat\"}", failures);
ensureIncludes(hostContent, hostFile, "class:ds-chat-right-panel-tab-active={rightSidebarTab === \"character\"}", failures);
ensureIncludes(hostContent, hostFile, "class:ds-chat-right-panel-tab-active={rightSidebarTab === \"memory\"}", failures);
ensureIncludes(hostContent, hostFile, "class:active={rightSidebarTab === \"chat\"}", failures);
ensureIncludes(hostContent, hostFile, "class:active={rightSidebarTab === \"character\"}", failures);
ensureIncludes(hostContent, hostFile, "class:active={rightSidebarTab === \"memory\"}", failures);
ensureIncludes(hostContent, hostFile, "class:is-active={rightSidebarTab === \"chat\"}", failures);
ensureIncludes(hostContent, hostFile, "class:is-active={rightSidebarTab === \"character\"}", failures);
ensureIncludes(hostContent, hostFile, "class:is-active={rightSidebarTab === \"memory\"}", failures);
ensureIncludes(hostContent, hostFile, ">{configTabLabel}</button>", failures);
ensureIncludes(hostContent, hostFile, "data-testid=\"chat-sidebar-pane-chat\"", failures);
ensureIncludes(hostContent, hostFile, "data-testid=\"chat-sidebar-pane-character\"", failures);
ensureIncludes(hostContent, hostFile, "data-testid=\"chat-sidebar-pane-memory\"", failures);
ensureIncludes(hostContent, hostFile, "role=\"tabpanel\"", failures);
ensureIncludes(hostContent, hostFile, "aria-labelledby=\"chat-sidebar-tab-chat\"", failures);
ensureIncludes(hostContent, hostFile, "aria-labelledby=\"chat-sidebar-tab-character\"", failures);
ensureIncludes(hostContent, hostFile, "aria-labelledby=\"chat-sidebar-tab-memory\"", failures);
ensureIncludes(hostContent, hostFile, "onkeydown={(event) => handleRightPanelTabKeydown(event, \"chat\")}", failures);
ensureIncludes(hostContent, hostFile, "handleRightPanelTabKeydown(event, \"character\")", failures);
ensureIncludes(hostContent, hostFile, "handleRightPanelTabKeydown(event, \"memory\")", failures);
ensureIncludes(hostContent, hostFile, "<SideChatList chara={selectedCharacter ?? undefined} />", failures);
ensureIncludes(hostContent, hostFile, "<CharConfig />", failures);
ensureIncludes(hostContent, hostFile, "<HypaV3Modal embedded />", failures);
ensureNotIncludes(hostContent, hostFile, "data-testid=\"chat-sidebar-toggle\"", failures);
ensureNotIncludes(hostContent, hostFile, "data-testid=\"chat-sidebar-close\"", failures);

ensureIncludes(sideChatListContent, sideChatListFile, "class=\"side-chat-list-scroll list-shell\"", failures);
ensureIncludes(sideChatListContent, sideChatListFile, "<Button className=\"side-new-chat-button\" type=\"button\" onclick={() => {", failures);
ensureIncludes(sideChatListContent, sideChatListFile, "{#snippet chatRow(chat, chatIndex)}", failures);
ensureIncludes(sideChatListContent, sideChatListFile, "<div class=\"side-chat-item\" data-risu-chat-idx={chatIndex}>", failures);
ensureIncludes(sideChatListContent, sideChatListFile, "changeChatTo(chatIndex)", failures);
ensureIncludes(sideChatListContent, sideChatListFile, "{@render chatRow(chat, chara.chats.indexOf(chat))}", failures);
ensureIncludes(sideChatListContent, sideChatListFile, "{#if chat.folderId == null}", failures);
ensureIncludes(sideChatListContent, sideChatListFile, "type=\"button\" aria-label=\"Export all chats\"", failures);
ensureIncludes(sideChatListContent, sideChatListFile, "type=\"button\" aria-label=\"Add folder\"", failures);
ensureIncludes(sideChatListContent, sideChatListFile, "class=\"no-sort side-chat-empty empty-state\"", failures);
ensureIncludes(sideChatListContent, sideChatListFile, "class=\"no-sort side-chat-empty side-chat-empty-global empty-state\"", failures);
ensureIncludes(sideChatListContent, sideChatListFile, "class=\"side-row-actions action-rail\"", failures);
ensureIncludes(sideChatListContent, sideChatListFile, "class=\"side-footer-actions action-rail\"", failures);
ensureIncludes(sideChatListContent, sideChatListFile, "class=\"side-action-btn icon-btn icon-btn--sm\"", failures);
ensureIncludes(sideChatListContent, sideChatListFile, "class=\"side-action-btn icon-btn icon-btn--sm side-action-btn-end\"", failures);
ensureIncludes(sideChatListContent, sideChatListFile, "class=\"side-folder-card panel-shell\"", failures);
ensureIncludes(sideChatListContent, sideChatListFile, "function handleActionKeydown(event: KeyboardEvent) {", failures);
ensureIncludes(sideChatListContent, sideChatListFile, "event.key === \"Enter\" || event.key === \" \" || event.key === \"Spacebar\"", failures);
ensureIncludes(sideChatListContent, sideChatListFile, "onkeydown={handleActionKeydown}", failures);
ensureIncludes(sideChatListContent, sideChatListFile, "aria-label=\"Chat options\"", failures);
ensureIncludes(sideChatListContent, sideChatListFile, "aria-label=\"Export all chats\"", failures);
ensureIncludes(sideChatListContent, sideChatListFile, "data-testid=\"side-chat-list-shell\"", failures);
ensureIncludes(sideChatListContent, sideChatListFile, "data-testid=\"side-chat-empty\"", failures);
ensureIncludes(sideChatListContent, sideChatListFile, "data-testid=\"side-chat-empty-global\"", failures);
ensureIncludes(sideChatListContent, sideChatListFile, "data-testid=\"side-folder-card\"", failures);

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

console.log("[chat-sidebar-contract] OK");
