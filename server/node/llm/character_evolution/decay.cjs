const { CHARACTER_EVOLUTION_ITEM_SECTION_KEYS } = require('./items.cjs');
const { normalizeCharacterEvolutionSectionConfigs } = require('./normalizers.cjs');
const {
    compareCharacterEvolutionItemsForProjection,
    normalizeCharacterEvolutionPromptProjectionPolicy,
} = require('./projection_policy.cjs');
const { normalizeCharacterEvolutionRetentionPolicy } = require('./retention_policy.cjs');
const { createDefaultCharacterEvolutionState } = require('./schema.cjs');

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

function getBucketKeyForSection(sectionKey) {
    if (sectionKey === 'activeThreads' || sectionKey === 'runningJokes' || sectionKey === 'keyMoments') {
        return 'fast';
    }
    if (sectionKey === 'userRead' || sectionKey === 'characterHabits' || sectionKey === 'characterBoundariesPreferences') {
        return 'medium';
    }
    return 'slow';
}

function normalizeVersionNumber(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue < 0) {
        return null;
    }
    return Math.floor(numericValue);
}

function buildRetentionTotals(sections) {
    return CHARACTER_EVOLUTION_ITEM_SECTION_KEYS.reduce((acc, key) => {
        const section = sections[key];
        acc.before.total += section.before.total;
        acc.before.active += section.before.active;
        acc.before.archived += section.before.archived;
        acc.before.corrected += section.before.corrected;
        acc.after.total += section.after.total;
        acc.after.active += section.after.active;
        acc.after.archived += section.after.archived;
        acc.after.corrected += section.after.corrected;
        return acc;
    }, {
        before: {
            total: 0,
            active: 0,
            archived: 0,
            corrected: 0,
        },
        after: {
            total: 0,
            active: 0,
            archived: 0,
            corrected: 0,
        },
    });
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
    const bucket = getBucketKeyForSection(sectionKey);
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
    const confidence = item?.confidence || 'suspected';
    const isSlowConfirmed = (
        sectionKey === 'userFacts'
        || sectionKey === 'characterLikes'
        || sectionKey === 'characterDislikes'
        || sectionKey === 'userLikes'
        || sectionKey === 'userDislikes'
        || sectionKey === 'characterIntimatePreferences'
        || sectionKey === 'userIntimatePreferences'
    ) && confidence === 'confirmed';
    if (isSlowConfirmed) {
        return unseenAcceptedHandoffs >= retentionPolicy.thresholds.deleteConfirmedSlow;
    }
    return unseenAcceptedHandoffs >= retentionPolicy.thresholds.deleteNonActive[getBucketKeyForSection(sectionKey)];
}

function sortItemsByProjectionRank(sectionKey, items, promptProjectionPolicy) {
    return [...items].sort((left, right) => compareCharacterEvolutionItemsForProjection({
        sectionKey,
        left,
        right,
        policy: promptProjectionPolicy,
    }));
}

function createRetentionCounts(items) {
    const counts = {
        total: 0,
        active: 0,
        archived: 0,
        corrected: 0,
    };
    for (const item of items) {
        const status = item?.status || 'active';
        counts.total += 1;
        if (status === 'archived') {
            counts.archived += 1;
            continue;
        }
        if (status === 'corrected') {
            counts.corrected += 1;
            continue;
        }
        counts.active += 1;
    }
    return counts;
}

function createEmptySectionReport(items) {
    return {
        before: createRetentionCounts(items),
        after: {
            total: 0,
            active: 0,
            archived: 0,
            corrected: 0,
        },
        archivedByDecay: 0,
        deletedByDecay: 0,
        archivedByCap: 0,
        deletedByCap: 0,
    };
}

function applyStoredCapsToSection(arg = {}) {
    const cap = arg.retentionPolicy?.caps?.[arg.sectionKey];
    if (!cap) {
        return {
            items: (Array.isArray(arg.items) ? arg.items : []).map((item) => ({ ...item })),
            archivedByCap: 0,
            deletedByCap: 0,
        };
    }

    const activeItems = arg.items.filter((item) => (item?.status || 'active') === 'active');
    const nonActiveItems = arg.items.filter((item) => (item?.status || 'active') !== 'active');
    const protectedNonActiveItems = nonActiveItems.filter((item) => arg.protectedNonActiveItems?.has(item));
    const trimmableNonActiveItems = nonActiveItems.filter((item) => !arg.protectedNonActiveItems?.has(item));
    const keptActive = new Set(
        sortItemsByProjectionRank(arg.sectionKey, activeItems, arg.promptProjectionPolicy).slice(0, cap.active)
    );
    const archivedOverflowByItem = new Map(
        activeItems
            .filter((item) => !keptActive.has(item))
            .map((item) => [item, {
                ...item,
                status: 'archived',
            }])
    );
    const archivedOverflow = [...archivedOverflowByItem.values()];
    const trimmableNonActiveCapacity = Math.max(0, cap.nonActive - protectedNonActiveItems.length - archivedOverflow.length);
    const keptTrimmableNonActive = sortItemsByProjectionRank(
        arg.sectionKey,
        trimmableNonActiveItems,
        arg.promptProjectionPolicy
    ).slice(0, trimmableNonActiveCapacity);
    const keptNonActiveSet = new Set([
        ...protectedNonActiveItems,
        ...keptTrimmableNonActive,
    ]);

    return {
        items: arg.items.flatMap((item) => {
            const status = item?.status || 'active';
            if (status === 'active') {
                if (keptActive.has(item)) {
                    return [{ ...item }];
                }
                const archivedOverflowItem = archivedOverflowByItem.get(item);
                if (archivedOverflowItem) {
                    return [{ ...archivedOverflowItem }];
                }
                return [];
            }
            if (keptNonActiveSet.has(item)) {
                return [{ ...item }];
            }
            return [];
        }),
        archivedByCap: archivedOverflow.length,
        deletedByCap: Math.max(0, trimmableNonActiveItems.length - keptTrimmableNonActive.length),
    };
}

function applyDecayToSection(arg = {}) {
    const retentionPolicy = normalizeCharacterEvolutionRetentionPolicy(arg.retentionPolicy);
    const promptProjectionPolicy = normalizeCharacterEvolutionPromptProjectionPolicy(arg.promptProjectionPolicy);
    const protectedNonActiveItems = new Set();
    const report = createEmptySectionReport(Array.isArray(arg.items) ? arg.items : []);
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
                return [];
            }
            report.archivedByDecay += 1;
            protectedNonActiveItems.add(archivedItem);
            return [archivedItem];
        }

        if (shouldDeleteAfterDecay(arg.sectionKey, nextItem, nextUnseenAcceptedHandoffs, retentionPolicy)) {
            report.deletedByDecay += 1;
            return [];
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
    const nextState = structuredClone(arg.state || {});

    for (const key of CHARACTER_EVOLUTION_ITEM_SECTION_KEYS) {
        nextState[key] = applyDecayToSection({
            sectionKey: key,
            items: Array.isArray(nextState[key]) ? nextState[key] : [],
            acceptedVersion: arg.acceptedVersion,
            retentionPolicy: arg.retentionPolicy,
            promptProjectionPolicy: arg.promptProjectionPolicy,
        }).items;
    }

    return nextState;
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
    applyLastInteractionEndedOverwrite,
    compactCharacterEvolutionCurrentState,
    previewCharacterEvolutionRetentionDryRun,
};
