<script lang="ts">
  interface Props {
    chara?: {
      chaId?: string;
    };
  }

  const { chara = null }: Props = $props();
</script>

<div data-testid="side-chat-list-stub" data-char-id={chara?.chaId ?? "none"}>
  side-chat-list
</div>
