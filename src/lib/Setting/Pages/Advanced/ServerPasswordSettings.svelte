<script lang="ts">
    import { onMount } from "svelte";
    import Button from "src/lib/UI/GUI/Button.svelte";
    import { alertError, alertNormal } from "src/ts/alert";
    import { isNodeServer } from "src/ts/platform";
    import { getServerPasswordStatus, upsertServerPasswordInteractive } from "src/ts/storage/serverAuth";

    let status: 'unset' | 'correct' | 'incorrect' | null = null;
    let busy = false;

    async function refreshStatus() {
        if (!isNodeServer) return;
        status = await getServerPasswordStatus();
    }

    async function setOrChangePassword() {
        if (busy) return;
        if (status === null) {
            await refreshStatus();
            return;
        }
        busy = true;
        try {
            const result = await upsertServerPasswordInteractive();
            if (!result.changed) return;
            alertNormal(result.mode === 'set' ? 'Server password set.' : 'Server password changed.');
            await refreshStatus();
        } catch (error) {
            alertError(error);
        } finally {
            busy = false;
        }
    }

    onMount(() => {
        void refreshStatus();
    });
</script>

{#if isNodeServer}
    <div class="ds-settings-section ds-settings-renderer-offset-md action-rail">
        <span class="ds-settings-renderer-label">
            Server password status:
            {status === 'unset' ? 'Not set' : status === 'correct' ? 'Configured' : status === 'incorrect' ? 'Password required' : 'Unknown'}
        </span>
        <Button size="sm" onclick={setOrChangePassword} disabled={busy}>
            {busy ? 'Saving...' : status === null ? 'Retry Status' : (status === 'unset' ? 'Set Server Password' : 'Change Server Password')}
        </Button>
    </div>
{/if}
