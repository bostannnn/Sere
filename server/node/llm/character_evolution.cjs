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
const {
    getCharacterEvolutionProcessedRanges,
    getChatLastMessageIndex,
    getLastProcessedMessageIndexForChat,
    isRangeFullyCoveredByProcessedRanges,
    normalizeCharacterEvolutionRangeRef,
    rangesOverlap,
} = require('./character_evolution/range.cjs');

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
    normalizeCharacterEvolutionRangeRef,
    normalizeCharacterEvolutionSectionConfigs,
    normalizeCharacterEvolutionSettings,
    normalizeCharacterEvolutionState,
    renderCharacterEvolutionStateForPrompt,
    safeParseEvolutionJson,
    sanitizeStateForEvolution,
    getCharacterEvolutionProcessedRanges,
    getChatLastMessageIndex,
    getLastProcessedMessageIndexForChat,
    isRangeFullyCoveredByProcessedRanges,
    rangesOverlap,
};
