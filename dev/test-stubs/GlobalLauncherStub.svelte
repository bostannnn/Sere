<script lang="ts">
  interface Props {
    onOpenChatList?: () => void;
    onOpenCharacterCatalog?: () => void;
    onResetOverlays?: () => void;
    visible?: boolean;
    railId?: string;
  }

  const {
    onOpenChatList = () => {},
    onOpenCharacterCatalog = () => {},
    onResetOverlays = () => {},
    visible = true,
    railId = "global-navigation-rail",
  }: Props = $props();
</script>

{#if visible}
  <div id={railId} data-testid="global-launcher-stub">
    <button data-testid="launcher-open-chat" onclick={onOpenChatList}>open-chat</button>
    <button data-testid="launcher-open-characters" onclick={onOpenCharacterCatalog}>open-characters</button>
    <button data-testid="launcher-reset" onclick={onResetOverlays}>reset</button>
  </div>
{/if}
