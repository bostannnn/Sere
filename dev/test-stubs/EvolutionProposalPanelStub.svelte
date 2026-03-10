<script lang="ts">
    import type {
        CharacterEvolutionPendingProposal,
        CharacterEvolutionPrivacySettings,
        CharacterEvolutionSectionConfig,
        CharacterEvolutionState,
    } from "src/ts/storage/database.types"

    interface Props {
        proposal: CharacterEvolutionPendingProposal | null
        currentState?: CharacterEvolutionState
        sectionConfigs?: CharacterEvolutionSectionConfig[]
        privacy?: CharacterEvolutionPrivacySettings
        bindState?: CharacterEvolutionState
        onAccept?: () => void
        onAcceptAndCreate?: () => void
        onReject?: () => void
        loading?: boolean
    }

    let {
        proposal,
        bindState = $bindable(),
    }: Props = $props()
</script>

<div data-testid="proposal-panel-stub">
    <span data-testid="proposal-id">{proposal?.proposalId ?? "none"}</span>
    <span data-testid="proposal-trust-level">{bindState?.relationship?.trustLevel ?? ""}</span>
</div>
