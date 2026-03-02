<script lang="ts">
    import { FlaskConicalIcon, CircleQuestionMarkIcon } from "@lucide/svelte";
    import { language } from "src/lang";
    import { alertMd } from "src/ts/alert";

    interface Props {
        unrecommended?: boolean;
        key: (keyof (typeof language.help));
        name?: string;
    }

    const { unrecommended = false, key, name = '' }: Props = $props();

    function getHelpLabel() {
        return `${name ? `${name} ` : ""}${language.showHelp}`;
    }
</script>

<button
    type="button"
    title={getHelpLabel()}
    aria-label={getHelpLabel()}
    class="help ds-help-trigger icon-btn icon-btn--sm"
    onclick={() => {
        alertMd(language.help[key])
    }}
>
    {#if key === "experimental"}
        <div class="ds-help-trigger-experimental">
            <FlaskConicalIcon size={16} />
        </div>
    {:else if unrecommended}
        <CircleQuestionMarkIcon size={14} />
    {:else}
        <CircleQuestionMarkIcon size={14} />
    {/if}
</button>
