<script lang="ts">
  interface Props {
    submenu?: number;
    globalMode?: boolean;
  }

  const { submenu = 0, globalMode = false }: Props = $props();
</script>

<div
  data-testid="lorebook-list-stub"
  data-submenu={String(submenu)}
  data-global-mode={globalMode ? "1" : "0"}
>
  lorebook-list
</div>
