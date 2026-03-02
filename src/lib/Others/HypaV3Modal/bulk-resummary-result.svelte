<script lang="ts">
  import {
    LanguagesIcon,
    RefreshCw,
    CheckIcon,
    XIcon,
  } from "@lucide/svelte";
  import { language } from "src/lang";
  import type { BulkResummaryState } from "./types";
  import { handleDualAction } from "./utils";

  interface Props {
    bulkResummaryState: BulkResummaryState | null;
    onToggleTranslation: (regenerate: boolean) => void;
    onReroll: () => void;
    onApply: () => void;
    onCancel: () => void;
  }

  const {
    bulkResummaryState,
    onToggleTranslation,
    onReroll,
    onApply,
    onCancel,
  }: Props = $props();
</script>

<!-- Bulk Resummarize Result Section -->
{#if bulkResummaryState}
  <div class="hypa-resummary-shell">
    <div class="hypa-resummary-content">
      <div class="hypa-resummary-header">
        <h3 class="hypa-resummary-title">{language.hypaV3Modal.reSummarizeResult}</h3>
        <div class="hypa-resummary-actions action-rail">
          <!-- Translate Button -->
          <button
            class="hypa-resummary-icon-btn icon-btn icon-btn--sm"
            class:is-disabled={bulkResummaryState.isProcessing || !bulkResummaryState.result}
            disabled={bulkResummaryState.isProcessing || !bulkResummaryState.result}
            title={language.hypaV3Modal.translate}
            use:handleDualAction={{
              onMainAction: () => onToggleTranslation(false),
              onAlternativeAction: () => onToggleTranslation(true),
            }}
          >
            <LanguagesIcon size={16} />
          </button>
          
          <!-- Reroll Button -->
          <button
            class="hypa-resummary-icon-btn hypa-resummary-icon-btn-warning icon-btn icon-btn--sm"
            class:is-disabled={bulkResummaryState.isProcessing}
            onclick={onReroll}
            disabled={bulkResummaryState.isProcessing}
            title={language.hypaV3Modal.retry}
          >
            <RefreshCw size={16} />
          </button>
          
          <!-- Apply Button -->
          <button
            class="hypa-resummary-icon-btn hypa-resummary-icon-btn-accent icon-btn icon-btn--sm"
            class:is-disabled={bulkResummaryState.isProcessing || !bulkResummaryState.result}
            onclick={onApply}
            disabled={bulkResummaryState.isProcessing || !bulkResummaryState.result}
            title={language.apply}
          >
            <CheckIcon size={16} />
          </button>
          
          <!-- Cancel Button -->
          <button
            class="hypa-resummary-icon-btn icon-btn icon-btn--sm"
            onclick={onCancel}
            title={language.cancel}
          >
            <XIcon size={16} />
          </button>
        </div>
      </div>
      
      <!-- Result Content -->
      {#if bulkResummaryState.isProcessing}
        <div class="hypa-resummary-loading">
          <span class="hypa-resummary-loading-spinner"><RefreshCw size={24} /></span>
          {language.hypaV3Modal.reSummarizing}
        </div>
      {:else if bulkResummaryState.result}
        <textarea
          class="hypa-resummary-textarea control-field"
          readonly
          value={bulkResummaryState.result}
        ></textarea>
        
        <!-- Translation Result -->
        {#if bulkResummaryState.translation}
          <div class="hypa-resummary-translation">
            <div class="hypa-resummary-translation-label">
              {language.hypaV3Modal.translationLabel}
            </div>
            <textarea
              class="hypa-resummary-textarea control-field"
              readonly
              value={bulkResummaryState.translation}
            ></textarea>
          </div>
        {/if}
      {/if}
    </div>
  </div>
{/if}

<style>
  .hypa-resummary-shell {
    position: sticky;
    bottom: 0;
    border-top: 1px solid var(--ds-border-subtle);
    border-radius: 0 0 var(--ds-radius-md) var(--ds-radius-md);
    background: var(--ds-surface-2);
    padding: var(--ds-space-4);
  }

  .hypa-resummary-content {
    display: flex;
    flex-direction: column;
    gap: var(--ds-space-3);
  }

  .hypa-resummary-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ds-space-2);
  }

  .hypa-resummary-actions.action-rail {
    display: flex;
    align-items: center;
    gap: var(--ds-space-2);
  }

  .hypa-resummary-title {
    margin: 0;
    color: var(--ds-text-primary);
    font-size: var(--ds-font-size-sm);
    font-weight: var(--ds-font-weight-medium);
  }

  .hypa-resummary-icon-btn.icon-btn.icon-btn--sm {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--ds-space-2);
    border-radius: var(--ds-radius-sm);
    color: var(--ds-text-secondary);
    transition: color var(--ds-motion-fast) var(--ds-ease-standard),
      background-color var(--ds-motion-fast) var(--ds-ease-standard),
      opacity var(--ds-motion-fast) var(--ds-ease-standard);
  }

  .hypa-resummary-icon-btn.icon-btn.icon-btn--sm:hover {
    color: var(--ds-text-primary);
    background: color-mix(in srgb, var(--ds-surface-active) 35%, transparent);
  }

  .hypa-resummary-icon-btn-warning.icon-btn.icon-btn--sm:hover {
    color: color-mix(in srgb, var(--color-yellow-300) 92%, var(--ds-text-primary));
  }

  .hypa-resummary-icon-btn-accent.icon-btn.icon-btn--sm:hover {
    color: color-mix(in srgb, var(--color-green-300) 92%, var(--ds-text-primary));
  }

  .hypa-resummary-icon-btn.icon-btn.icon-btn--sm.is-disabled,
  .hypa-resummary-icon-btn.icon-btn.icon-btn--sm:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .hypa-resummary-icon-btn.icon-btn.icon-btn--sm.is-disabled:hover,
  .hypa-resummary-icon-btn.icon-btn.icon-btn--sm:disabled:hover {
    background: transparent;
    color: var(--ds-text-secondary);
  }

  .hypa-resummary-loading {
    text-align: center;
    color: var(--ds-text-secondary);
    padding-block: var(--ds-space-4);
  }

  .hypa-resummary-loading-spinner {
    display: inline-block;
    margin-right: var(--ds-space-2);
    animation: spin 1s linear infinite;
    vertical-align: middle;
  }

  .hypa-resummary-textarea.control-field {
    width: 100%;
    min-height: 8rem;
    resize: vertical;
    border: 1px solid var(--ds-border-subtle);
    border-radius: var(--ds-radius-sm);
    background: var(--ds-surface-1);
    color: var(--ds-text-primary);
    padding: var(--ds-space-3);
    outline: none;
    transition: border-color var(--ds-motion-fast) var(--ds-ease-standard);
  }

  .hypa-resummary-textarea:focus {
    border-color: var(--ds-border-strong);
  }

  .hypa-resummary-translation {
    margin-top: var(--ds-space-3);
  }

  .hypa-resummary-translation-label {
    margin-bottom: var(--ds-space-2);
    color: var(--ds-text-secondary);
    font-size: var(--ds-font-size-sm);
  }
</style>
