<div class="ds-chat-creator-quote-shell">
    <div class="ds-chat-creator-quote-card panel-shell">
        <h1 class="ds-chat-creator-quote-title">{language.creatorNotes}
            <button
                type="button"
                class="ds-chat-creator-quote-close icon-btn icon-btn--sm"
                onclick={onRemove}
                title={language.remove}
                aria-label={language.remove}
            >
                <XIcon />
            </button>
        </h1>
        <MultiLangDisplay value={quote} markdown={true} />
    </div>
</div>
<script lang="ts">
    import { XIcon } from "@lucide/svelte";
    import { language } from "src/lang";
    import MultiLangDisplay from "../UI/GUI/MultiLangDisplay.svelte";

    interface Props {
        onRemove: () => void;
        quote: string;
    }

    const { onRemove, quote }: Props = $props();
</script>
