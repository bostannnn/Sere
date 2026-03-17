const {
    CHARACTER_EVOLUTION_ITEM_SECTION_KEYS,
} = require('./items.cjs');
const {
    compareCharacterEvolutionItemsForProjection,
} = require('./projection_policy.cjs');
const {
    getCharacterEvolutionRetentionBucket,
} = require('./retention_policy.cjs');

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
        const status = item.status ?? 'active';
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

function createRetentionTraceContext(sectionKey, retentionPolicy) {
    const bucket = getCharacterEvolutionRetentionBucket(sectionKey, retentionPolicy);
    return {
        bucket,
        archiveThreshold: retentionPolicy.thresholds.archive[bucket],
        deleteNonActiveThreshold: retentionPolicy.thresholds.deleteNonActive[bucket],
        deleteConfirmedSlowThreshold: retentionPolicy.thresholds.deleteConfirmedSlow,
    };
}

function createTraceSectionReport(sectionKey, items, retentionPolicy) {
    return {
        ...createEmptySectionReport(items),
        ...createRetentionTraceContext(sectionKey, retentionPolicy),
        decisions: [],
    };
}

function previewDecisionValue(item) {
    const rawValue = typeof item?.value === 'string' ? item.value.trim() : '';
    if (!rawValue) {
        return '';
    }
    if (rawValue.length <= 160) {
        return rawValue;
    }
    return `${rawValue.slice(0, 157)}...`;
}

function normalizeUnseenAcceptedHandoffsValue(value) {
    if (!Number.isFinite(Number(value)) || Number(value) < 0) {
        return 0;
    }
    return Math.max(0, Math.floor(Number(value)));
}

function createRetentionDecision(arg = {}) {
    const beforeItem = arg.beforeItem || {};
    const afterItem = arg.afterItem || null;
    const itemForPreview = afterItem || beforeItem;
    return {
        reason: arg.reason,
        valuePreview: previewDecisionValue(itemForPreview),
        confidence: itemForPreview.confidence ?? beforeItem.confidence ?? 'suspected',
        fromStatus: beforeItem.status ?? 'active',
        toStatus: afterItem ? (afterItem.status ?? 'active') : null,
        unseenBefore: normalizeUnseenAcceptedHandoffsValue(beforeItem.unseenAcceptedHandoffs),
        unseenAfter: afterItem ? normalizeUnseenAcceptedHandoffsValue(afterItem.unseenAcceptedHandoffs) : null,
        lastSeenVersion: normalizeVersionNumber(itemForPreview.lastSeenVersion),
        sourceChatId: typeof itemForPreview.sourceChatId === 'string' ? itemForPreview.sourceChatId : null,
        sourceRange: itemForPreview.sourceRange ? structuredClone(itemForPreview.sourceRange) : null,
    };
}

function applyStoredCapsToSection(arg = {}) {
    const cap = arg.retentionPolicy.caps[arg.sectionKey];
    if (!cap) {
        return {
            items: (Array.isArray(arg.items) ? arg.items : []).map((item) => ({ ...item })),
            archivedByCap: 0,
            deletedByCap: 0,
            keptItems: new Set(Array.isArray(arg.items) ? arg.items : []),
            archivedOverflowBySource: new Map(),
            deletedOverflowItems: new Set(),
        };
    }

    const items = Array.isArray(arg.items) ? arg.items : [];
    const activeItems = items.filter((item) => (item.status ?? 'active') === 'active');
    const nonActiveItems = items.filter((item) => (item.status ?? 'active') !== 'active');
    const protectedNonActiveItems = nonActiveItems.filter((item) => arg.protectedNonActiveItems?.has(item));
    const trimmableNonActiveItems = nonActiveItems.filter((item) => !arg.protectedNonActiveItems?.has(item));

    const keptActive = new Set(
        sortItemsByProjectionRank(arg.sectionKey, activeItems, arg.promptProjectionPolicy)
            .slice(0, cap.active),
    );
    const archivedOverflowByItem = new Map(
        activeItems
            .filter((item) => !keptActive.has(item))
            .map((item) => [item, {
                ...item,
                status: 'archived',
            }]),
    );
    const archivedOverflow = [...archivedOverflowByItem.values()];
    const trimmableNonActiveCapacity = Math.max(0, cap.nonActive - protectedNonActiveItems.length - archivedOverflow.length);
    const keptTrimmableNonActive = sortItemsByProjectionRank(
        arg.sectionKey,
        trimmableNonActiveItems,
        arg.promptProjectionPolicy,
    ).slice(0, trimmableNonActiveCapacity);
    const keptNonActiveSet = new Set([
        ...protectedNonActiveItems,
        ...keptTrimmableNonActive,
    ]);

    return {
        items: items.flatMap((item) => {
            const status = item.status ?? 'active';
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
        keptItems: new Set([
            ...activeItems.filter((item) => keptActive.has(item)),
            ...protectedNonActiveItems,
            ...keptTrimmableNonActive,
        ]),
        archivedOverflowBySource: archivedOverflowByItem,
        deletedOverflowItems: new Set(trimmableNonActiveItems.filter((item) => !keptNonActiveSet.has(item))),
    };
}

module.exports = {
    applyStoredCapsToSection,
    buildRetentionTotals,
    createEmptySectionReport,
    createRetentionCounts,
    createRetentionDecision,
    createTraceSectionReport,
    normalizeVersionNumber,
};
