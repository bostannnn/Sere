const { filterActiveCharacterEvolutionState, CHARACTER_EVOLUTION_ITEM_SECTION_KEYS } = require('./items.cjs');
const { normalizeCharacterEvolutionState } = require('./normalizers.cjs');
const {
    compareCharacterEvolutionItemsForProjection,
    normalizeCharacterEvolutionPromptProjectionPolicy,
} = require('./projection_policy.cjs');

function sortProjectedItems(sectionKey, items, policy) {
    return [...(Array.isArray(items) ? items : [])]
        .sort((left, right) => compareCharacterEvolutionItemsForProjection({
            sectionKey,
            left,
            right,
            policy,
        }))
        .map((item) => ({ ...item }));
}

function projectCharacterEvolutionStateForPrompt(stateRaw, surface = 'generation', promptProjectionRaw = null) {
    const state = filterActiveCharacterEvolutionState(normalizeCharacterEvolutionState(stateRaw));
    const promptProjection = normalizeCharacterEvolutionPromptProjectionPolicy(promptProjectionRaw);
    const limits = promptProjection.limits[surface] || promptProjection.limits.generation;
    const nextState = {
        ...state,
        relationship: { ...state.relationship },
        lastInteractionEnded: { ...state.lastInteractionEnded },
    };

    for (const key of CHARACTER_EVOLUTION_ITEM_SECTION_KEYS) {
        nextState[key] = sortProjectedItems(key, state[key], promptProjection).slice(0, limits[key]);
    }

    return nextState;
}

module.exports = {
    projectCharacterEvolutionStateForPrompt,
};
