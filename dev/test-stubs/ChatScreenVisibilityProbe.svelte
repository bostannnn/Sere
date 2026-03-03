<script lang="ts">
  import ChatScreen from "src/lib/ChatScreens/ChatScreen.svelte";

  interface Props {
    rightSidebarOpen?: boolean;
  }

  let {
    rightSidebarOpen = $bindable(true),
  }: Props = $props();

  let rightSidebarVisible = $state(false);
</script>

<div
  data-testid="chat-sidebar-visible-probe"
  data-visible={rightSidebarVisible ? "1" : "0"}
></div>
<div
  data-testid="chat-sidebar-open-probe"
  data-open={rightSidebarOpen ? "1" : "0"}
></div>

<button
  type="button"
  data-testid="chat-sidebar-open-false"
  onclick={() => {
    rightSidebarOpen = false;
  }}
>
  close
</button>
<button
  type="button"
  data-testid="chat-sidebar-open-true"
  onclick={() => {
    rightSidebarOpen = true;
  }}
>
  open
</button>

<ChatScreen
  bind:rightSidebarOpen={rightSidebarOpen}
  bind:rightSidebarVisible={rightSidebarVisible}
/>
