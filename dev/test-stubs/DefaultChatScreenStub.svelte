<script lang="ts">
  interface Props {
    onOpenModuleList?: () => void;
    onOpenChatList?: () => void;
    customStyle?: string;
  }

  const {
    onOpenModuleList = () => {},
    onOpenChatList = () => {},
    customStyle = "",
  }: Props = $props();
</script>

<div data-testid="default-chat-screen-stub" style={customStyle}>
  <button data-testid="default-open-chat" onclick={onOpenChatList}>chat-list</button>
  <button data-testid="default-open-module" onclick={onOpenModuleList}>module-list</button>
</div>
