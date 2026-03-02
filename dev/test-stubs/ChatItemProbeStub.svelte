<script lang="ts">
  interface Props {
    idx?: number;
    role?: string;
    message?: string;
    name?: string;
  }

  const {
    idx = -1,
    role = "",
    message = "",
    name = "",
  }: Props = $props();
</script>

<article
  data-testid="chat-item-probe"
  data-idx={String(idx)}
  data-role={role}
  data-name={name}
>
  {message}
</article>
