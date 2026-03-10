const { clone } = require('./character_evolution/utils.cjs');
const {
    createDefaultCharacterEvolutionDefaults,
    createDefaultCharacterEvolutionSectionConfigs,
    createDefaultCharacterEvolutionState,
} = require('./character_evolution/schema.cjs');
const {
    getEffectiveCharacterEvolutionSettings,
    normalizeCharacterEvolutionDefaults,
    normalizeCharacterEvolutionPrivacy,
    normalizeCharacterEvolutionSectionConfigs,
    normalizeCharacterEvolutionSettings,
    normalizeCharacterEvolutionState,
} = require('./character_evolution/normalizers.cjs');
const { renderCharacterEvolutionStateForPrompt } = require('./character_evolution/render.cjs');
const { buildCharacterEvolutionPromptMessages } = require('./character_evolution/prompt_builder.cjs');
const {
    normalizeCharacterEvolutionProposal,
    safeParseEvolutionJson,
    sanitizeStateForEvolution,
} = require('./character_evolution/proposal.cjs');

module.exports = {
    buildCharacterEvolutionPromptMessages,
    clone,
    createDefaultCharacterEvolutionDefaults,
    createDefaultCharacterEvolutionSectionConfigs,
    createDefaultCharacterEvolutionState,
    getEffectiveCharacterEvolutionSettings,
    normalizeCharacterEvolutionDefaults,
    normalizeCharacterEvolutionPrivacy,
    normalizeCharacterEvolutionProposal,
    normalizeCharacterEvolutionSectionConfigs,
    normalizeCharacterEvolutionSettings,
    normalizeCharacterEvolutionState,
    renderCharacterEvolutionStateForPrompt,
    safeParseEvolutionJson,
    sanitizeStateForEvolution,
};
