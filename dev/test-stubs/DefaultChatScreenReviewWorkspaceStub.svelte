<script lang="ts">
    interface Props {
        onAccept?: () => void
        onAcceptAndCreate?: () => void
        onReject?: () => void
        onClose?: () => void
    }

    let {
        onAccept = () => {},
        onAcceptAndCreate = () => {},
        onReject = () => {},
        onClose = () => {},
    }: Props = $props()
</script>

<div data-testid="default-chat-review-workspace-stub">
    <button data-testid="review-accept" onclick={onAccept}>Accept</button>
    <button data-testid="review-accept-create" onclick={onAcceptAndCreate}>Accept And Create</button>
    <button data-testid="review-reject" onclick={onReject}>Reject</button>
    <button data-testid="review-close" onclick={onClose}>Close</button>
</div>
