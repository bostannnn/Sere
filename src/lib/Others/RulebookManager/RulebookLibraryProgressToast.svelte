<script lang="ts">
    import { XIcon } from "@lucide/svelte";
    import { slide } from "svelte/transition";

    interface ProgressState {
        active?: boolean;
        status?: string;
        totalFiles?: number;
        currentFileIndex?: number;
        file?: string;
        percent?: number;
        current?: number;
        total?: number;
    }

    interface Props {
        progress: ProgressState;
        onCancel?: () => void;
    }

    let {
        progress,
        onCancel = () => {},
    }: Props = $props();

    const shouldShowProgressBar = $derived(
        progress.status === "downloading" || progress.status === "embedding"
    );

    const progressPercent = $derived.by(() => {
        if (!shouldShowProgressBar) {
            return 0;
        }
        const rawVal = progress.status === "downloading"
            ? (progress.percent ?? 0)
            : ((progress.current ?? 0) / Math.max(1, progress.total ?? 1) * 100);
        if (isNaN(rawVal)) {
            return 0;
        }
        return Math.max(0, Math.min(100, rawVal));
    });
</script>

{#if progress.active}
    <div class="rag-status-toast" transition:slide={{ axis: "y", duration: 300 }}>
        <div class="rag-status-card panel-shell">
            <div class="rag-status-header">
                <div class="rag-status-title-row">
                    <div class="ds-chat-spinner-sm"></div>
                    <span class="rag-status-label">{(progress.status ?? "pending").toUpperCase()}</span>
                </div>
                {#if (progress.totalFiles ?? 0) > 1}
                    <span class="rag-status-counter">File {progress.currentFileIndex} of {progress.totalFiles}</span>
                {/if}
            </div>

            <div class="rag-status-body">
                <span class="rag-status-filename" title={progress.file}>{progress.file || "Processing..."}</span>

                {#if shouldShowProgressBar}
                    <div class="rag-mini-bar-track">
                        <div class="rag-mini-bar-fill" style:width="{progressPercent}%"></div>
                    </div>
                    <div class="rag-status-meta">
                        <span>{Math.round(progressPercent)}%</span>
                        {#if progress.status === "embedding"}
                            <span>{progress.current}/{progress.total}</span>
                        {/if}
                    </div>
                {/if}
            </div>

            <button class="rag-status-cancel icon-btn icon-btn--sm" onclick={onCancel} title="Cancel Ingestion">
                <XIcon size={14} />
            </button>
        </div>
    </div>
{/if}
