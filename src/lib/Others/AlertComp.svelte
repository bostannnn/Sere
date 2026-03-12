<script lang="ts">
    import { alertStore } from "src/ts/stores.svelte";
    import RequestLogsViewer from "./RequestLogsViewer.svelte";
    import ModuleChatMenu from "../Setting/Pages/Module/ModuleChatMenu.svelte";
    import AlertBaseModal from "./AlertComp/AlertBaseModal.svelte";
    import AlertBranchesOverlay from "./AlertComp/AlertBranchesOverlay.svelte";
    import AlertCardExportModal from "./AlertComp/AlertCardExportModal.svelte";
    import AlertChoicePanels from "./AlertComp/AlertChoicePanels.svelte";
    import AlertRequestDataModal from "./AlertComp/AlertRequestDataModal.svelte";
    import AlertSelectCharModal from "./AlertComp/AlertSelectCharModal.svelte";
    import AlertToast from "./AlertComp/AlertToast.svelte";

    const baseTypes = new Set([
        "error",
        "normal",
        "ask",
        "wait",
        "input",
        "wait2",
        "markdown",
        "select",
        "login",
        "tos",
        "progress",
        "pukmakkurit",
    ]);

    function handleWindowMessage(event: MessageEvent) {
        if (
            !event.origin.startsWith("https://sv.risuai.xyz") &&
            !event.origin.startsWith("https://nightly.sv.risuai.xyz") &&
            !event.origin.startsWith("http://127.0.0.1") &&
            event.origin !== window.location.origin
        ) {
            return;
        }

        if (event.data.msg?.data?.vaild && $alertStore.type === "login") {
            alertStore.set({
                type: "none",
                msg: JSON.stringify(event.data.msg),
            });
        }
    }

    function closeModuleSelect(result: string) {
        alertStore.set({
            type: "none",
            msg: result,
        });
    }
</script>

<svelte:window onmessage={handleWindowMessage}></svelte:window>

{#if baseTypes.has($alertStore.type)}
    {@const alertKey = `${$alertStore.type}:${$alertStore.msg}:${$alertStore.stackTrace ?? ""}`}
    {#key alertKey}
        <AlertBaseModal alert={$alertStore} />
    {/key}
{:else if $alertStore.type === "selectChar"}
    <AlertSelectCharModal />
{:else if $alertStore.type === "requestdata"}
    <AlertRequestDataModal alert={$alertStore} />
{:else if $alertStore.type === "addchar" || $alertStore.type === "chatOptions"}
    <AlertChoicePanels alert={$alertStore} />
{:else if $alertStore.type === "cardexport"}
    <AlertCardExportModal alert={$alertStore} />
{:else if $alertStore.type === "toast"}
    <AlertToast alert={$alertStore} />
{:else if $alertStore.type === "selectModule"}
    <ModuleChatMenu alertMode close={closeModuleSelect} />
{:else if $alertStore.type === "branches"}
    <AlertBranchesOverlay />
{:else if $alertStore.type === "requestlogs"}
    {@const requestLogsKey = `requestlogs:${$alertStore.msg === "server" ? "server" : "client"}`}
    {#key requestLogsKey}
        <RequestLogsViewer mode="modal" source={$alertStore.msg === "server" ? "server" : "client"} />
    {/key}
{/if}
