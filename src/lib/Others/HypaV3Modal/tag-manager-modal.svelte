<script lang="ts">
  import {
    XIcon,
    SquarePenIcon,
    Trash2Icon,
    CheckIcon,
  } from "@lucide/svelte";
  import { language } from "src/lang";
  import { DBState, selectedCharID } from "src/ts/stores.svelte";
  import type { SerializableHypaV3Data } from "src/ts/process/memory/hypav3";
  import type { TagManagerState } from "./types";

  interface Props {
    tagManagerState: TagManagerState;
  }

  let {
    tagManagerState = $bindable(),
  }: Props = $props();

  function getOrInitHypaV3Data(): SerializableHypaV3Data {
    const chat =
      DBState.db.characters[$selectedCharID].chats[
        DBState.db.characters[$selectedCharID].chatPage
      ];
    chat.hypaV3Data ??= {
      summaries: [],
      categories: [{ id: "", name: language.hypaV3Modal.unclassified }],
      lastSelectedSummaries: [],
    };
    chat.hypaV3Data.categories ??= [
      { id: "", name: language.hypaV3Modal.unclassified },
    ];
    chat.hypaV3Data.lastSelectedSummaries ??= [];
    return chat.hypaV3Data;
  }

  const hypaV3Data = $derived(getOrInitHypaV3Data());
  const currentSummary = $derived(
    tagManagerState.currentSummaryIndex >= 0
      ? hypaV3Data.summaries[tagManagerState.currentSummaryIndex]
      : undefined
  );
  const currentTags = $derived(currentSummary?.tags ?? []);

  function closeTagManager() {
    tagManagerState.isOpen = false;
    tagManagerState.currentSummaryIndex = -1;
    tagManagerState.editingTag = "";
    tagManagerState.editingTagIndex = -1;
  }

  function addTag(summaryIndex: number, tagName: string) {
    if (!tagName.trim()) return;

    const summary = hypaV3Data.summaries[summaryIndex];
    if (!summary.tags) {
      summary.tags = [];
    }

    if (!summary.tags.includes(tagName.trim())) {
      summary.tags.push(tagName.trim());
    }
  }

  function removeTag(summaryIndex: number, tagIndex: number) {
    const summary = hypaV3Data.summaries[summaryIndex];
    if (summary.tags && tagIndex >= 0 && tagIndex < summary.tags.length) {
      summary.tags.splice(tagIndex, 1);
    }
  }

  function startEditTag(tagIndex: number, tagName: string) {
    tagManagerState.editingTagIndex = tagIndex;
    tagManagerState.editingTag = tagName;
  }

  function saveEditingTag() {
    if (tagManagerState.editingTagIndex === -1 || !tagManagerState.editingTag.trim()) return;

    const summary = hypaV3Data.summaries[tagManagerState.currentSummaryIndex];
    if (summary.tags && tagManagerState.editingTagIndex < summary.tags.length) {
      summary.tags[tagManagerState.editingTagIndex] = tagManagerState.editingTag.trim();
    }

    tagManagerState.editingTag = "";
    tagManagerState.editingTagIndex = -1;
  }

  function cancelEditingTag() {
    tagManagerState.editingTag = "";
    tagManagerState.editingTagIndex = -1;
  }

  function handleAddTagEnter() {
    addTag(tagManagerState.currentSummaryIndex, tagManagerState.editingTag);
    tagManagerState.editingTag = "";
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

  function updateEditingTag(event: Event) {
    tagManagerState.editingTag = (event.currentTarget as HTMLInputElement).value;
  }
</script>

<!-- Tag Manager Modal -->
{#if tagManagerState.isOpen && tagManagerState.currentSummaryIndex >= 0}
  <div class="ds-hypa-tag-overlay">
    <div class="ds-hypa-tag-modal panel-shell">
      <div class="ds-hypa-tag-header">
        <h2 class="ds-hypa-tag-title">
          {language.hypaV3Modal.tagManagerTitle.replace("{0}", (tagManagerState.currentSummaryIndex + 1).toString())}
        </h2>
        <button
          class="ds-hypa-tag-close icon-btn icon-btn--sm"
          onclick={closeTagManager}
        >
          <XIcon size={20} />
        </button>
      </div>

      <!-- Add New Tag -->
      <div class="ds-hypa-tag-add">
        <div class="ds-hypa-tag-add-row action-rail">
          <input
            type="text"
            class="ds-hypa-tag-input control-field"
            placeholder={language.hypaV3Modal.newTagName}
            value={tagManagerState.editingTag}
            onkeydown={handleAddTagKeydown}
            oninput={updateEditingTag}
          />
          <button
            class="ds-hypa-tag-add-btn"
            onclick={handleAddTagEnter}
          >
            {language.add}
          </button>
        </div>
      </div>

      <!-- Tag List -->
      <div class="ds-hypa-tag-list list-shell">
        {#if currentTags.length > 0}
          {#each currentTags as tag, tagIndex (tagIndex)}
            <div class="ds-hypa-tag-item">
              {#if tagManagerState.editingTagIndex === tagIndex}
                <input
                  type="text"
                  class="ds-hypa-tag-edit-input control-field"
                  value={tagManagerState.editingTag}
                  onkeydown={handleEditTagKeydown}
                  oninput={updateEditingTag}
                />
                <button
                  class="ds-hypa-tag-icon-btn ds-hypa-tag-icon-btn-save icon-btn icon-btn--sm"
                  onclick={saveEditingTag}
                >
                  <CheckIcon size={16} />
                </button>
                <button
                  class="ds-hypa-tag-icon-btn ds-hypa-tag-icon-btn-cancel icon-btn icon-btn--sm"
                  onclick={cancelEditingTag}
                >
                  <XIcon size={16} />
                </button>
              {:else}
                <span class="ds-hypa-tag-label">#{tag}</span>
                <button
                  class="ds-hypa-tag-icon-btn ds-hypa-tag-icon-btn-edit icon-btn icon-btn--sm"
                  onclick={() => startEditTag(tagIndex, tag)}
                >
                  <SquarePenIcon size={16} />
                </button>
                <button
                  class="ds-hypa-tag-icon-btn ds-hypa-tag-icon-btn-delete icon-btn icon-btn--sm"
                  onclick={() => removeTag(tagManagerState.currentSummaryIndex, tagIndex)}
                >
                  <Trash2Icon size={16} />
                </button>
              {/if}
            </div>
          {/each}
        {:else}
          <div class="ds-hypa-tag-empty empty-state">
            {language.hypaV3Modal.noTagsYet}<br>
            <span class="ds-hypa-tag-empty-hint">{language.hypaV3Modal.addNewTagHint}</span>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
