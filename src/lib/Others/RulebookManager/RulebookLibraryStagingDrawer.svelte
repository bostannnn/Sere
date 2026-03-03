<script lang="ts">
    import { InfoIcon, PlayIcon, Trash2Icon, XIcon } from "@lucide/svelte";
    import { slide } from "svelte/transition";
    import Button from "../../UI/GUI/Button.svelte";
    import IconButton from "../../UI/GUI/IconButton.svelte";
    import TextInput from "../../UI/GUI/TextInput.svelte";

    interface PendingFile {
        name: string;
        data: Uint8Array;
        system: string;
        edition: string;
    }

    interface Props {
        pendingFiles?: PendingFile[];
        globalMetadata?: { system: string; edition: string };
        onApplyGlobalMetadata?: () => void;
        onStartIngestion?: () => void;
        onClearPending?: () => void;
        onRemovePendingFile?: (index: number) => void;
    }

    let {
        pendingFiles = [],
        globalMetadata = { system: "", edition: "" },
        onApplyGlobalMetadata = () => {},
        onStartIngestion = () => {},
        onClearPending = () => {},
        onRemovePendingFile = () => {},
    }: Props = $props();
</script>

{#if pendingFiles.length > 0}
    <div class="rag-staging-drawer panel-shell panel-shell--overlay" transition:slide={{ axis: "y" }}>
        <div class="rag-staging-header">
            <div class="rag-staging-title">
                <InfoIcon size={20} />
                <span>Staging Area: {pendingFiles.length} files pending</span>
            </div>
            <div class="rag-staging-batch-meta">
                <TextInput bind:value={globalMetadata.system} placeholder="Batch System" size="sm" oninput={onApplyGlobalMetadata} />
                <TextInput bind:value={globalMetadata.edition} placeholder="Batch Edition" size="sm" oninput={onApplyGlobalMetadata} />
            </div>
            <div class="rag-staging-actions action-rail">
                <Button onclick={onStartIngestion} styled="primary">
                    <PlayIcon size={18} />
                    <span>Start Ingestion</span>
                </Button>
                <IconButton onclick={onClearPending} title="Clear staged files" ariaLabel="Clear staged files">
                    <XIcon size={20} />
                </IconButton>
            </div>
        </div>
        <div class="rag-staging-list list-shell">
            {#each pendingFiles as file, i (i)}
                <div class="rag-staging-item panel-shell">
                    <span class="rag-staging-filename">{file.name}</span>
                    <div class="rag-staging-item-meta">
                        <TextInput bind:value={file.system} placeholder="System" size="sm" className="rag-staging-input" />
                        <TextInput bind:value={file.edition} placeholder="Edition" size="sm" className="rag-staging-input" />
                    </div>
                    <IconButton
                        onclick={() => onRemovePendingFile(i)}
                        className="rag-staging-remove-btn"
                        title="Remove from staging"
                        ariaLabel={`Remove ${file.name} from staging`}
                    >
                        <Trash2Icon size={14} />
                    </IconButton>
                </div>
            {/each}
        </div>
    </div>
{/if}
