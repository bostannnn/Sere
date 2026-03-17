const { CHARACTER_EVOLUTION_ITEM_SECTION_KEYS } = require('./items.cjs');
const { normalizeCharacterEvolutionSectionConfigs } = require('./normalizers.cjs');
const {
    normalizeCharacterEvolutionPromptProjectionPolicy,
} = require('./projection_policy.cjs');
const {
    getCharacterEvolutionRetentionBucket,
    normalizeCharacterEvolutionRetentionPolicy,
} = require('./retention_policy.cjs');
const { createDefaultCharacterEvolutionState } = require('./schema.cjs');
const {
    applyStoredCapsToSection,
    buildRetentionTotals,
    createEmptySectionReport,
    createRetentionCounts,
    createRetentionDecision,
    createTraceSectionReport,
    normalizeVersionNumber,
} = require('./decay_shared.cjs');

function normalizeUnseenAcceptedHandoffs(item) {
    if (!Number.isFinite(Number(item?.unseenAcceptedHandoffs)) || Number(item?.unseenAcceptedHandoffs) < 0) {
        return 0;
    }
    return Math.max(0, Math.floor(Number(item.unseenAcceptedHandoffs)));
}

function isReinforcedOnAcceptedHandoff(item, acceptedVersion) {
    return Number.isFinite(item?.lastSeenVersion)
        && Number(item.lastSeenVersion) === acceptedVersion
        && (item?.status || 'active') === 'active';
}

function getEffectiveCompactionUnseenAcceptedHandoffs(item, currentStateVersion) {
    const storedUnseenAcceptedHandoffs = normalizeUnseenAcceptedHandoffs(item);
    if ((item?.status || 'active') === 'active') {
        return storedUnseenAcceptedHandoffs;
    }
    const lastSeenVersion = normalizeVersionNumber(item?.lastSeenVersion);
    if (lastSeenVersion === null || lastSeenVersion > currentStateVersion) {
        return storedUnseenAcceptedHandoffs;
    }
    return Math.max(storedUnseenAcceptedHandoffs, currentStateVersion - lastSeenVersion);
}

function shouldArchiveAfterDecay(sectionKey, item, unseenAcceptedHandoffs, retentionPolicy) {
    if ((item?.status || 'active') !== 'active') {
        return false;
    }
    const bucket = getCharacterEvolutionRetentionBucket(sectionKey, retentionPolicy);
    const threshold = retentionPolicy.thresholds.archive[bucket];
    const confidence = item?.confidence || 'suspected';
    if (bucket === 'slow' && confidence === 'confirmed') {
        return false;
    }
    return unseenAcceptedHandoffs >= threshold;
}

function shouldDeleteAfterDecay(sectionKey, item, unseenAcceptedHandoffs, retentionPolicy) {
    const status = item?.status || 'active';
    if (status === 'active') {
        return false;
    }
    const bucket = getCharacterEvolutionRetentionBucket(sectionKey, retentionPolicy);
    if (bucket === 'permanent') {
        return false;
    }
    const confidence = item?.confidence || 'suspected';
    const isSlowConfirmed = (
        bucket === 'slow'
        && (
            sectionKey === 'userFacts'
            || sectionKey === 'characterLikes'
            || sectionKey === 'characterDislikes'
            || sectionKey === 'userLikes'
            || sectionKey === 'userDislikes'
            || sectionKey === 'characterIntimatePreferences'
            || sectionKey === 'userIntimatePreferences'
        )
    ) && confidence === 'confirmed';
    if (isSlowConfirmed) {
        return unseenAcceptedHandoffs >= retentionPolicy.thresholds.deleteConfirmedSlow;
    }
    return unseenAcceptedHandoffs >= retentionPolicy.thresholds.deleteNonActive[bucket];
}

function applyDecayToSection(arg = {}) {
    const retentionPolicy = normalizeCharacterEvolutionRetentionPolicy(arg.retentionPolicy);
    const promptProjectionPolicy = normalizeCharacterEvolutionPromptProjectionPolicy(arg.promptProjectionPolicy);
    const protectedNonActiveItems = new Set();
    const includeTrace = arg.includeTrace === true;
    const report = includeTrace
        ? createTraceSectionReport(arg.sectionKey, Array.isArray(arg.items) ? arg.items : [], retentionPolicy)
        : createEmptySectionReport(Array.isArray(arg.items) ? arg.items : []);
    const pendingDecisionsByItem = new Map();
    const decayedItems = (Array.isArray(arg.items) ? arg.items : []).flatMap((item) => {
        const status = item?.status || 'active';
        const reinforced = status === 'active' && isReinforcedOnAcceptedHandoff(item, arg.acceptedVersion);
        const nextUnseenAcceptedHandoffs = reinforced
            ? 0
            : normalizeUnseenAcceptedHandoffs(item) + 1;
        const nextItem = {
            ...item,
            unseenAcceptedHandoffs: nextUnseenAcceptedHandoffs,
        };

        if (shouldArchiveAfterDecay(arg.sectionKey, item, nextUnseenAcceptedHandoffs, retentionPolicy)) {
            const archivedItem = {
                ...item,
                status: 'archived',
                unseenAcceptedHandoffs: nextUnseenAcceptedHandoffs,
            };
            if (shouldDeleteAfterDecay(arg.sectionKey, archivedItem, nextUnseenAcceptedHandoffs, retentionPolicy)) {
                report.deletedByDecay += 1;
                if (includeTrace) {
                    report.decisions.push(createRetentionDecision({
                        beforeItem: item,
                        reason: 'decay_delete',
                    }));
                }
                return [];
            }
            report.archivedByDecay += 1;
            protectedNonActiveItems.add(archivedItem);
            if (includeTrace) {
                report.decisions.push(createRetentionDecision({
                    beforeItem: item,
                    afterItem: archivedItem,
                    reason: 'decay_archive',
                }));
            }
            return [archivedItem];
        }

        if (shouldDeleteAfterDecay(arg.sectionKey, nextItem, nextUnseenAcceptedHandoffs, retentionPolicy)) {
            report.deletedByDecay += 1;
            if (includeTrace) {
                report.decisions.push(createRetentionDecision({
                    beforeItem: item,
                    reason: 'decay_delete',
                }));
            }
            return [];
        }

        if (includeTrace) {
            pendingDecisionsByItem.set(nextItem, {
                beforeItem: item,
                keepReason: reinforced ? 'reinforced' : null,
            });
        }
        return [nextItem];
    });

    const cappedResult = applyStoredCapsToSection({
        sectionKey: arg.sectionKey,
        items: decayedItems,
        protectedNonActiveItems,
        retentionPolicy,
        promptProjectionPolicy,
    });
    report.archivedByCap = cappedResult.archivedByCap;
    report.deletedByCap = cappedResult.deletedByCap;
    report.after = createRetentionCounts(cappedResult.items);

    if (includeTrace) {
        for (const [item, pendingDecision] of pendingDecisionsByItem.entries()) {
            if (cappedResult.archivedOverflowBySource?.has(item)) {
                report.decisions.push(createRetentionDecision({
                    beforeItem: pendingDecision.beforeItem,
                    afterItem: cappedResult.archivedOverflowBySource.get(item),
                    reason: 'cap_archive',
                }));
                continue;
            }
            if (cappedResult.deletedOverflowItems?.has(item)) {
                report.decisions.push(createRetentionDecision({
                    beforeItem: pendingDecision.beforeItem,
                    reason: 'cap_delete',
                }));
                continue;
            }
            if (cappedResult.keptItems?.has(item)) {
                if (pendingDecision.keepReason) {
                    report.decisions.push(createRetentionDecision({
                        beforeItem: pendingDecision.beforeItem,
                        afterItem: item,
                        reason: pendingDecision.keepReason,
                    }));
                }
            }
        }
    }

    return {
        items: cappedResult.items,
        report,
    };
}

function isSectionEnabled(sectionConfigs, key) {
    return normalizeCharacterEvolutionSectionConfigs(sectionConfigs)
        .some((section) => section.key === key && section.enabled);
}

function applyLastInteractionEndedOverwrite(arg = {}) {
    const nextState = structuredClone(arg.proposedState || {});
    if (!isSectionEnabled(arg.sectionConfigs, 'lastInteractionEnded')) {
        return nextState;
    }

    nextState.lastInteractionEnded = Object.prototype.hasOwnProperty.call(nextState, 'lastInteractionEnded')
        ? structuredClone(nextState.lastInteractionEnded || createDefaultCharacterEvolutionState().lastInteractionEnded)
        : structuredClone(createDefaultCharacterEvolutionState().lastInteractionEnded);

    return nextState;
}

function applyCharacterEvolutionDecay(arg = {}) {
    return applyCharacterEvolutionDecayWithReport(arg).state;
}

function applyCharacterEvolutionDecayWithReport(arg = {}) {
    const nextState = structuredClone(arg.state || {});
    const sections = {};

    for (const key of CHARACTER_EVOLUTION_ITEM_SECTION_KEYS) {
        const result = applyDecayToSection({
            sectionKey: key,
            items: Array.isArray(nextState[key]) ? nextState[key] : [],
            acceptedVersion: arg.acceptedVersion,
            retentionPolicy: arg.retentionPolicy,
            promptProjectionPolicy: arg.promptProjectionPolicy,
            includeTrace: true,
        });
        nextState[key] = result.items;
        sections[key] = result.report;
    }

    return {
        state: nextState,
        report: {
            acceptedVersion: Math.max(0, Math.floor(Number(arg.acceptedVersion) || 0)),
            totals: buildRetentionTotals(sections),
            sections,
        },
    };
}

function previewCharacterEvolutionRetentionDryRun(arg = {}) {
    const nextState = structuredClone(arg.state || {});
    const currentStateVersion = Math.max(0, Math.floor(Number(arg.currentStateVersion) || 0));
    const simulatedAcceptedVersion = currentStateVersion + 1;
    const sections = {};

    for (const key of CHARACTER_EVOLUTION_ITEM_SECTION_KEYS) {
        const result = applyDecayToSection({
            sectionKey: key,
            items: Array.isArray(nextState[key]) ? nextState[key] : [],
            acceptedVersion: simulatedAcceptedVersion,
            retentionPolicy: arg.retentionPolicy,
            promptProjectionPolicy: arg.promptProjectionPolicy,
        });
        nextState[key] = result.items;
        sections[key] = result.report;
    }

    const totals = buildRetentionTotals(sections);

    return {
        currentStateVersion,
        simulatedAcceptedVersion,
        totals,
        sections,
    };
}

function compactSectionForCurrentState(arg = {}) {
    const retentionPolicy = normalizeCharacterEvolutionRetentionPolicy(arg.retentionPolicy);
    const promptProjectionPolicy = normalizeCharacterEvolutionPromptProjectionPolicy(arg.promptProjectionPolicy);
    const protectedNonActiveItems = new Set();
    const report = createEmptySectionReport(Array.isArray(arg.items) ? arg.items : []);

    const compactedItems = (Array.isArray(arg.items) ? arg.items : []).flatMap((item) => {
        const status = item?.status || 'active';
        const effectiveUnseenAcceptedHandoffs = getEffectiveCompactionUnseenAcceptedHandoffs(
            item,
            arg.currentStateVersion
        );

        if (status === 'active') {
            const nextItem = {
                ...item,
                unseenAcceptedHandoffs: effectiveUnseenAcceptedHandoffs,
            };
            if (shouldArchiveAfterDecay(arg.sectionKey, item, effectiveUnseenAcceptedHandoffs, retentionPolicy)) {
                const archivedItem = {
                    ...item,
                    status: 'archived',
                    unseenAcceptedHandoffs: effectiveUnseenAcceptedHandoffs,
                };
                report.archivedByDecay += 1;
                protectedNonActiveItems.add(archivedItem);
                return [archivedItem];
            }
            return [nextItem];
        }

        const nextItem = {
            ...item,
            unseenAcceptedHandoffs: effectiveUnseenAcceptedHandoffs,
        };
        if (shouldDeleteAfterDecay(arg.sectionKey, nextItem, effectiveUnseenAcceptedHandoffs, retentionPolicy)) {
            report.deletedByDecay += 1;
            return [];
        }
        return [nextItem];
    });

    const cappedResult = applyStoredCapsToSection({
        sectionKey: arg.sectionKey,
        items: compactedItems,
        protectedNonActiveItems,
        retentionPolicy,
        promptProjectionPolicy,
    });
    report.archivedByCap = cappedResult.archivedByCap;
    report.deletedByCap = cappedResult.deletedByCap;
    report.after = createRetentionCounts(cappedResult.items);

    return {
        items: cappedResult.items,
        report,
    };
}

function compactCharacterEvolutionCurrentState(arg = {}) {
    const nextState = structuredClone(arg.state || {});
    const currentStateVersion = Math.max(0, Math.floor(Number(arg.currentStateVersion) || 0));
    const sections = {};

    for (const key of CHARACTER_EVOLUTION_ITEM_SECTION_KEYS) {
        const result = compactSectionForCurrentState({
            sectionKey: key,
            items: Array.isArray(nextState[key]) ? nextState[key] : [],
            currentStateVersion,
            retentionPolicy: arg.retentionPolicy,
            promptProjectionPolicy: arg.promptProjectionPolicy,
        });
        nextState[key] = result.items;
        sections[key] = result.report;
    }

    return {
        state: nextState,
        report: {
            currentStateVersion,
            totals: buildRetentionTotals(sections),
            sections,
        },
    };
}

module.exports = {
    applyCharacterEvolutionDecay,
    applyCharacterEvolutionDecayWithReport,
    applyLastInteractionEndedOverwrite,
    compactCharacterEvolutionCurrentState,
    previewCharacterEvolutionRetentionDryRun,
};
