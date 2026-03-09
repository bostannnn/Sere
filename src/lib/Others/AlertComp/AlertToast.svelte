<script lang="ts">
    import { alertStore } from "src/ts/stores.svelte";
    import type { AlertState } from "./types";

    interface Props {
        alert: AlertState;
    }

    const { alert }: Props = $props();
</script>

<div
    class="ds-toast-anime ds-toast-shell break-any"
    onanimationend={() => {
        alertStore.set({
            type: "none",
            msg: "",
        });
    }}
>{alert.msg}</div>

<style>
    .break-any {
        word-break: normal;
        overflow-wrap: anywhere;
    }
</style>
