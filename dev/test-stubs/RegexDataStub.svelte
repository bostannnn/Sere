<script lang="ts">
  interface Props {
    idx?: number;
    onOpen?: () => unknown;
    onClose?: () => unknown;
    onRemove?: () => unknown;
    value?: unknown;
  }

  let {
    idx = 0,
    onOpen: _onOpen = () => {},
    onClose: _onClose = () => {},
    onRemove: _onRemove = () => {},
    value = $bindable(),
  }: Props = $props();
</script>

<div data-testid="regex-data-stub" data-risu-idx={idx}></div>
