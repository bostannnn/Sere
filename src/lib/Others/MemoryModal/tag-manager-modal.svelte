<script lang="ts">
  import { untrack } from "svelte";
  import {
    XIcon,
    SquarePenIcon,
    Trash2Icon,
    CheckIcon,
  } from "@lucide/svelte";
  import { language } from "src/lang";
  import { DBState, selectedCharID } from "src/ts/stores.svelte";
  import type { SerializableMemoryData } from "src/ts/process/memory/memory";
  import { getChatMemoryData, setChatMemoryData } from "src/ts/process/memory/storage";
  import type { TagManagerState } from "./types";

  interface Props {
    tagManagerState: TagManagerState;
  }

  let {
    tagManagerState = $bindable(),
  }: Props = $props();
  let editingTag = $state(tagManagerState.editingTag ?? "");
  let editingTagIndex = $state(
    Number.isInteger(tagManagerState.editingTagIndex) ? tagManagerState.editingTagIndex : -1
  );

  function syncTagManagerState() {
    tagManagerState.editingTag = editingTag;
    tagManagerState.editingTagIndex = editingTagIndex;
  }

  function getOrInitMemoryData(): SerializableMemoryData {
    const chat = getActiveChat();
    const nextData = getChatMemoryData(chat) ?? {
      summaries: [],
      categories: [{ id: "", name: language.memoryModal.unclassified }],
      lastSelectedSummaries: [],
    };
    nextData.categories ??= [
      { id: "", name: language.memoryModal.unclassified },
    ];
    nextData.lastSelectedSummaries ??= [];
    return nextData;
  }

  function getActiveChat() {
    return DBState.db.characters[$selectedCharID].chats[
      DBState.db.characters[$selectedCharID].chatPage
    ];
  }

  function commitMemoryData() {
    setChatMemoryData(getActiveChat(), memoryData);
  }

  let memoryData = $state<SerializableMemoryData>({
    summaries: [],
    categories: [{ id: "", name: language.memoryModal.unclassified }],
    lastSelectedSummaries: [],
  });
  $effect.pre(() => {
    const chat =
      DBState.db.characters[$selectedCharID].chats[
        DBState.db.characters[$selectedCharID].chatPage
      ];
    const nextData = untrack(() => getOrInitMemoryData());
    if (getChatMemoryData(chat) !== nextData) {
      untrack(() => {
        setChatMemoryData(chat, nextData);
      });
    }
    memoryData = nextData;
  });
  const currentSummary = $derived(
    tagManagerState.currentSummaryIndex >= 0
      ? memoryData.summaries[tagManagerState.currentSummaryIndex]
      : undefined
  );
  const currentTags = $derived(currentSummary?.tags ?? []);

  function closeTagManager() {
    tagManagerState.isOpen = false;
    tagManagerState.currentSummaryIndex = -1;
    editingTag = "";
    editingTagIndex = -1;
    syncTagManagerState();
  }

  function addTag(summaryIndex: number, tagName: string) {
    if (!tagName.trim()) return;

    const summary = memoryData.summaries[summaryIndex];
    if (!summary.tags) {
      summary.tags = [];
    }

    if (!summary.tags.includes(tagName.trim())) {
      summary.tags.push(tagName.trim());
    }

    commitMemoryData();
  }

  function removeTag(summaryIndex: number, tagIndex: number) {
    const summary = memoryData.summaries[summaryIndex];
    if (summary.tags && tagIndex >= 0 && tagIndex < summary.tags.length) {
      summary.tags.splice(tagIndex, 1);
      commitMemoryData();
    }
  }

  function startEditTag(tagIndex: number, tagName: string) {
    editingTagIndex = tagIndex;
    editingTag = tagName;
    syncTagManagerState();
  }

  function saveEditingTag() {
    if (editingTagIndex === -1 || !editingTag.trim()) return;

    const summary = memoryData.summaries[tagManagerState.currentSummaryIndex];
    if (summary.tags && editingTagIndex < summary.tags.length) {
      summary.tags[editingTagIndex] = editingTag.trim();
      commitMemoryData();
    }

    editingTag = "";
    editingTagIndex = -1;
    syncTagManagerState();
  }

  function cancelEditingTag() {
    editingTag = "";
    editingTagIndex = -1;
    syncTagManagerState();
  }

  function handleAddTagEnter() {
    addTag(tagManagerState.currentSummaryIndex, editingTag);
    editingTag = "";
    syncTagManagerState();
  }

  function handleEditTagKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      saveEditingTag();
    } else if (e.key === 'Escape') {
      cancelEditingTag();
    }
  }

  function handleAddTagKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      handleAddTagEnter();
    }
  }
</script>

<!-- Tag Manager Modal -->
{#if tagManagerState.isOpen && tagManagerState.currentSummaryIndex >= 0}
  <div class="ds-memory-tag-overlay">
    <div class="ds-memory-tag-modal panel-shell">
      <div class="ds-memory-tag-header">
        <h2 class="ds-memory-tag-title">
          {language.memoryModal.tagManagerTitle.replace("{0}", (tagManagerState.currentSummaryIndex + 1).toString())}
        </h2>
        <button
          class="ds-memory-tag-close icon-btn icon-btn--sm"
          onclick={closeTagManager}
        >
          <XIcon size={20} />
        </button>
      </div>

      <!-- Add New Tag -->
      <div class="ds-memory-tag-add">
        <div class="ds-memory-tag-add-row action-rail">
          <input
            type="text"
            class="ds-memory-tag-input control-field"
            placeholder={language.memoryModal.newTagName}
            value={editingTag}
            oninput={(event) => {
              editingTag = event.currentTarget.value;
              syncTagManagerState();
            }}
            onkeydown={handleAddTagKeydown}
          />
          <button
            class="ds-memory-tag-add-btn"
            onclick={handleAddTagEnter}
          >
            {language.add}
          </button>
        </div>
      </div>

      <!-- Tag List -->
      <div class="ds-memory-tag-list list-shell">
        {#if currentTags.length > 0}
          {#each currentTags as tag, tagIndex (tagIndex)}
            <div class="ds-memory-tag-item">
              {#if editingTagIndex === tagIndex}
                <input
                  type="text"
                  class="ds-memory-tag-edit-input control-field"
                  value={editingTag}
                  oninput={(event) => {
                    editingTag = event.currentTarget.value;
                    syncTagManagerState();
                  }}
                  onkeydown={handleEditTagKeydown}
                />
                <button
                  class="ds-memory-tag-icon-btn ds-memory-tag-icon-btn-save icon-btn icon-btn--sm"
                  onclick={saveEditingTag}
                >
                  <CheckIcon size={16} />
                </button>
                <button
                  class="ds-memory-tag-icon-btn ds-memory-tag-icon-btn-cancel icon-btn icon-btn--sm"
                  onclick={cancelEditingTag}
                >
                  <XIcon size={16} />
                </button>
              {:else}
                <span class="ds-memory-tag-label">#{tag}</span>
                <button
                  class="ds-memory-tag-icon-btn ds-memory-tag-icon-btn-edit icon-btn icon-btn--sm"
                  onclick={() => startEditTag(tagIndex, tag)}
                >
                  <SquarePenIcon size={16} />
                </button>
                <button
                  class="ds-memory-tag-icon-btn ds-memory-tag-icon-btn-delete icon-btn icon-btn--sm"
                  onclick={() => removeTag(tagManagerState.currentSummaryIndex, tagIndex)}
                >
                  <Trash2Icon size={16} />
                </button>
              {/if}
            </div>
          {/each}
        {:else}
          <div class="ds-memory-tag-empty empty-state">
            {language.memoryModal.noTagsYet}<br>
            <span class="ds-memory-tag-empty-hint">{language.memoryModal.addNewTagHint}</span>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
