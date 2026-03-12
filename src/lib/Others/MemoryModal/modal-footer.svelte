<script lang="ts">
  import {
    type SerializableMemoryData,
    getCurrentMemoryPreset,
  } from "src/ts/process/memory/memory";
  import { type Message } from "src/ts/storage/database.svelte";
  import { DBState, selectedCharID } from "src/ts/stores.svelte";
  import { language } from "src/lang";
  import { getFirstMessage, processRegexScript } from "./utils";

  interface Props {
    memoryData: SerializableMemoryData;
  }

  const { memoryData }: Props = $props();

  async function getNextSummarizationTarget(): Promise<Message | null> {
    const char = DBState.db.characters[$selectedCharID];
    const chat = char.chats[DBState.db.characters[$selectedCharID].chatPage];
    const shouldProcess = getCurrentMemoryPreset().settings.processRegexScript;

    // Summaries exist
    if (memoryData.summaries.length > 0) {
      const lastSummary = memoryData.summaries.at(-1);
      if (!lastSummary) {
        return null;
      }
      const lastMessageIndex = chat.message.findIndex(
        (m) => m.chatId === lastSummary.chatMemos.at(-1)
      );

      if (lastMessageIndex !== -1) {
        const next = chat.message[lastMessageIndex + 1] ?? null;

        return next && shouldProcess
          ? await processRegexScript(next, lastMessageIndex + 1)
          : next;
      }
    }

    // When no summaries exist OR couldn't find last connected message,
    // check if first message is available
    const firstMessage = getFirstMessage();

    if (!firstMessage) {
      const next = chat.message[0] ?? null;

      return next && shouldProcess ? await processRegexScript(next, 0) : next;
    }

    // Will summarize first message
    const next: Message = { role: "char", chatId: "first", data: firstMessage };

    return shouldProcess ? await processRegexScript(next) : next;
  }
</script>

<!-- Next Summarization Target -->
<div class="memory-footer-section">
  {#await getNextSummarizationTarget() then nextMessage}
    {#if nextMessage}
      {@const chatId =
        nextMessage.chatId === "first"
          ? language.memoryModal.nextSummarizationFirstMessageLabel
          : nextMessage.chatId == null
            ? language.memoryModal.nextSummarizationNoMessageIdLabel
            : nextMessage.chatId}
      <div class="memory-footer-muted">
        {language.memoryModal.nextSummarizationLabel.replace("{0}", chatId)}
      </div>

      <textarea
        class="memory-footer-textarea control-field"
        readonly
        value={nextMessage.data}
      ></textarea>
    {:else}
      <span class="memory-footer-error"
        >{language.memoryModal.nextSummarizationNoMessagesFoundLabel}</span
      >
    {/if}
  {:catch error}
    <span class="memory-footer-error"
      >{language.memoryModal.nextSummarizationLoadingError.replace(
        "{0}",
        error.message
      )}</span
    >
  {/await}
</div>

<div class="memory-footer-section">
  <div class="memory-footer-muted">
    {language.memoryModal.summarizationConditionLabel}
  </div>

  <!-- No First Message -->
  {#if !getFirstMessage()}
    <span class="memory-footer-error"
      >{language.memoryModal.emptySelectedFirstMessageLabel}</span
    >
  {/if}
</div>

<style>
  .memory-footer-section {
    margin-top: var(--ds-space-2);
  }

  .memory-footer-muted {
    margin-bottom: var(--ds-space-2);
    color: var(--ds-text-secondary);
    font-size: var(--ds-font-size-sm);
  }

  .memory-footer-textarea.control-field {
    width: 100%;
    min-height: 10rem;
    resize: none;
    overflow-y: auto;
    border: 1px solid var(--ds-border-subtle);
    border-radius: var(--ds-radius-sm);
    background: var(--ds-surface-1);
    color: var(--ds-text-primary);
    padding: var(--ds-space-2);
    transition: border-color var(--ds-motion-fast) var(--ds-ease-standard);
    outline: none;
  }

  .memory-footer-textarea.control-field:focus {
    border-color: var(--ds-border-strong);
  }

  .memory-footer-error {
    color: var(--ds-text-danger);
    font-size: var(--ds-font-size-sm);
  }

  @media (min-width: 640px) {
    .memory-footer-section {
      margin-top: var(--ds-space-4);
    }

    .memory-footer-muted {
      margin-bottom: var(--ds-space-4);
    }

    .memory-footer-textarea.control-field {
      min-height: 14rem;
      padding: var(--ds-space-4);
    }
  }
</style>
