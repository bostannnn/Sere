<script lang="ts">
  interface Props {
    autoProcessAvailable?: boolean;
    activeChatId?: string | null;
    activeChatMessageCount?: number;
  }

  let {
    autoProcessAvailable = false,
    activeChatId = null,
    activeChatMessageCount = 0,
  }: Props = $props();
</script>

<div data-testid="setup-panel-stub">
  <span data-testid="setup-auto-process-available">{autoProcessAvailable ? "true" : "false"}</span>
  <span data-testid="setup-active-chat-id">{activeChatId ?? ""}</span>
  <span data-testid="setup-active-chat-count">{activeChatMessageCount}</span>
</div>
