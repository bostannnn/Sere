<script lang="ts">
  interface Props {
    hasNewUnreadMessage?: boolean;
    messages?: unknown[];
    loadPages?: number;
    onReroll?: () => void;
    unReroll?: () => void;
    currentCharacter?: unknown;
    currentUsername?: string;
    userIcon?: string;
    userIconPortrait?: boolean;
  }

  let {
    hasNewUnreadMessage = $bindable(false),
  }: Props = $props();

  let initialized = false;

  $effect(() => {
    if (!initialized) {
      hasNewUnreadMessage = true;
      initialized = true;
    }
  });

  export function scrollToLatestMessage() {}
</script>

<div data-testid="default-chat-screen-chats-stub">chats</div>
