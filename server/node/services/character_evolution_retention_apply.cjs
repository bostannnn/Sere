const {
    normalizeCharacterEvolutionDefaults,
    normalizeCharacterEvolutionSettings,
} = require('../llm/character_evolution.cjs');
const { compactCharacterEvolutionCurrentState } = require('../llm/character_evolution/decay.cjs');

function createCharacterEvolutionRetentionApplyService(arg = {}) {
    const fs = arg.fs;
    const existsSync = arg.existsSync;
    const path = arg.path;
    const dataDirs = arg.dataDirs || {};
    const normalizeDefaults = typeof arg.normalizeCharacterEvolutionDefaults === 'function'
        ? arg.normalizeCharacterEvolutionDefaults
        : normalizeCharacterEvolutionDefaults;
    const normalizeEvolutionSettings = typeof arg.normalizeCharacterEvolutionSettings === 'function'
        ? arg.normalizeCharacterEvolutionSettings
        : normalizeCharacterEvolutionSettings;
    const compactCurrentState = typeof arg.compactCharacterEvolutionCurrentState === 'function'
        ? arg.compactCharacterEvolutionCurrentState
        : compactCharacterEvolutionCurrentState;

    function isSafeCharacterId(value) {
        return typeof value === 'string' && /^[a-zA-Z0-9._-]+$/.test(value);
    }

    async function readJsonDocument(filePath, fallback) {
        try {
            return JSON.parse(await fs.readFile(filePath, 'utf-8'));
        } catch {
            return fallback;
        }
    }

    function unwrapDocument(document) {
        if (document && typeof document === 'object') {
            if (document.character && typeof document.character === 'object') {
                return {
                    envelopeKey: 'character',
                    entity: document.character,
                };
            }
            if (document.data && typeof document.data === 'object') {
                return {
                    envelopeKey: 'data',
                    entity: document.data,
                };
            }
        }
        return {
            envelopeKey: null,
            entity: (document && typeof document === 'object') ? document : {},
        };
    }

    function wrapDocument(document, envelopeKey, entity) {
        if (envelopeKey) {
            return {
                ...(document && typeof document === 'object' ? document : {}),
                [envelopeKey]: entity,
            };
        }
        return entity;
    }

    function summarizeChangedSections(report) {
        return Object.entries(report?.sections || {})
            .filter(([, section]) => (
                Number(section?.archivedByDecay || 0) > 0
                || Number(section?.deletedByDecay || 0) > 0
                || Number(section?.archivedByCap || 0) > 0
                || Number(section?.deletedByCap || 0) > 0
            ))
            .map(([sectionKey, section]) => ({
                sectionKey,
                archivedByDecay: Number(section.archivedByDecay || 0),
                deletedByDecay: Number(section.deletedByDecay || 0),
                archivedByCap: Number(section.archivedByCap || 0),
                deletedByCap: Number(section.deletedByCap || 0),
                before: section.before,
                after: section.after,
            }));
    }

    function buildResultFromCompaction(arg = {}) {
        const changedSections = summarizeChangedSections(arg.report);
        const beforeTotal = Number(arg.report?.totals?.before?.total || 0);
        const afterTotal = Number(arg.report?.totals?.after?.total || 0);
        const removedTotal = Math.max(0, beforeTotal - afterTotal);
        return {
            characterId: arg.characterId,
            name: arg.name,
            status: changedSections.length > 0 ? 'changed' : 'unchanged',
            currentStateVersion: Number(arg.report?.currentStateVersion || 0),
            totals: arg.report?.totals || {
                before: { total: 0, active: 0, archived: 0, corrected: 0 },
                after: { total: 0, active: 0, archived: 0, corrected: 0 },
            },
            removedTotal,
            changedSections,
            report: arg.report,
        };
    }

    function buildPublicResult(result) {
        return {
            characterId: result.characterId,
            name: result.name,
            status: result.status,
            ...(result.reason ? { reason: result.reason } : {}),
            currentStateVersion: result.currentStateVersion,
            totals: result.totals,
            removedTotal: result.removedTotal,
            changedSections: result.changedSections,
            ...(result.report ? { report: result.report } : {}),
            ...(result.backupPath ? { backupPath: result.backupPath } : {}),
        };
    }

    async function readDefaults() {
        const settingsPath = path.join(dataDirs.root || '', 'settings.json');
        if (!settingsPath || !existsSync(settingsPath)) {
            return normalizeDefaults({});
        }
        const settingsDocument = await readJsonDocument(settingsPath, {});
        const settings = unwrapDocument(settingsDocument).entity;
        return normalizeDefaults(settings?.characterEvolutionDefaults);
    }

    async function listCharacterIds(characterIds = null) {
        if (Array.isArray(characterIds) && characterIds.length > 0) {
            return characterIds.filter((value) => isSafeCharacterId(value));
        }
        if (!existsSync(dataDirs.characters || '')) {
            return [];
        }
        const entries = await fs.readdir(dataDirs.characters, { withFileTypes: true });
        return entries
            .filter((entry) => entry?.isDirectory?.())
            .map((entry) => entry.name)
            .filter((value) => isSafeCharacterId(value))
            .sort((left, right) => left.localeCompare(right));
    }

    async function analyzeCharacter(characterId, defaults = null) {
        if (!isSafeCharacterId(characterId)) {
            throw new Error(`Invalid character id: ${characterId}`);
        }
        const characterPath = path.join(dataDirs.characters || '', characterId, 'character.json');
        if (!characterPath || !existsSync(characterPath)) {
            return null;
        }

        const document = await readJsonDocument(characterPath, {});
        const documentText = await fs.readFile(characterPath, 'utf-8');
        const { envelopeKey, entity: rawCharacter } = unwrapDocument(document);
        const evolution = normalizeEvolutionSettings(rawCharacter?.characterEvolution);
        const effectiveDefaults = defaults ?? await readDefaults();
        const name = typeof rawCharacter?.name === 'string' ? rawCharacter.name : '';

        if (evolution?.pendingProposal) {
            return {
                characterId,
                name,
                status: 'skipped',
                reason: 'pending_proposal',
                currentStateVersion: Number(evolution.currentStateVersion || 0),
                totals: {
                    before: { total: 0, active: 0, archived: 0, corrected: 0 },
                    after: { total: 0, active: 0, archived: 0, corrected: 0 },
                },
                removedTotal: 0,
                changedSections: [],
                report: null,
                characterPath,
                documentText,
            };
        }

        const compacted = compactCurrentState({
            state: evolution.currentState,
            currentStateVersion: evolution.currentStateVersion || 0,
            retentionPolicy: effectiveDefaults?.retention ?? null,
            promptProjectionPolicy: effectiveDefaults?.promptProjection ?? null,
        });
        const nextCharacter = {
            ...rawCharacter,
            characterEvolution: {
                ...evolution,
                currentState: compacted.state,
            },
        };
        const nextDocument = wrapDocument(document, envelopeKey, nextCharacter);

        return {
            ...buildResultFromCompaction({
                characterId,
                name,
                report: compacted.report,
            }),
            characterPath,
            documentText,
            nextDocument,
        };
    }

    async function collectCharacterAnalyses(characterIds = null) {
        const defaults = await readDefaults();
        const ids = await listCharacterIds(characterIds);
        const results = [];

        for (const characterId of ids) {
            try {
                const result = await analyzeCharacter(characterId, defaults);
                if (result) {
                    results.push(result);
                }
            } catch (error) {
                results.push({
                    characterId,
                    name: '',
                    status: 'error',
                    reason: error instanceof Error ? error.message : String(error),
                    currentStateVersion: 0,
                    totals: {
                        before: { total: 0, active: 0, archived: 0, corrected: 0 },
                        after: { total: 0, active: 0, archived: 0, corrected: 0 },
                    },
                    removedTotal: 0,
                    changedSections: [],
                    report: null,
                });
            }
        }

        return results;
    }

    async function analyzeCharacters(characterIds = null) {
        const results = await collectCharacterAnalyses(characterIds);
        return {
            scannedAt: Date.now(),
            charactersScanned: results.length,
            charactersChanged: results.filter((entry) => entry.status === 'changed').length,
            charactersSkipped: results.filter((entry) => entry.status === 'skipped').length,
            errorCount: results.filter((entry) => entry.status === 'error').length,
            totalItemsBefore: results.reduce((sum, entry) => sum + Number(entry?.totals?.before?.total || 0), 0),
            totalItemsAfter: results.reduce((sum, entry) => sum + Number(entry?.totals?.after?.total || 0), 0),
            totalRemoved: results.reduce((sum, entry) => sum + Number(entry?.removedTotal || 0), 0),
            results: results.map((entry) => buildPublicResult(entry)),
        };
    }

    async function applyCharacters(characterIds = null) {
        const results = await collectCharacterAnalyses(characterIds);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const runDirectory = path.join(
            dataDirs.logs || path.join(dataDirs.root || '', 'logs'),
            'character-evolution-retention-cleanup',
            timestamp,
        );
        const backupsDirectory = path.join(runDirectory, 'backups');
        const manifestPath = path.join(runDirectory, 'manifest.json');

        await fs.mkdir(runDirectory, { recursive: true });

        for (const result of results) {
            if (result.status !== 'changed') {
                continue;
            }
            try {
                await fs.mkdir(backupsDirectory, { recursive: true });
                const backupPath = path.join(backupsDirectory, `${result.characterId}.character.json`);
                await fs.writeFile(backupPath, result.documentText, 'utf-8');
                await fs.writeFile(result.characterPath, JSON.stringify(result.nextDocument, null, 2), 'utf-8');
                result.backupPath = backupPath;
            } catch (error) {
                result.status = 'error';
                result.reason = error instanceof Error ? error.message : String(error);
                delete result.backupPath;
            }
        }

        const finalSummary = {
            scannedAt: Date.now(),
            charactersScanned: results.length,
            charactersChanged: results.filter((entry) => entry.status === 'changed').length,
            charactersSkipped: results.filter((entry) => entry.status === 'skipped').length,
            errorCount: results.filter((entry) => entry.status === 'error').length,
            totalItemsBefore: results.reduce((sum, entry) => sum + Number(entry?.totals?.before?.total || 0), 0),
            totalItemsAfter: results.reduce((sum, entry) => sum + Number(entry?.totals?.after?.total || 0), 0),
            totalRemoved: results.reduce((sum, entry) => sum + Number(entry?.removedTotal || 0), 0),
            runDirectory,
            manifestPath,
            results: results.map((entry) => buildPublicResult(entry)),
        };

        await fs.writeFile(manifestPath, JSON.stringify(finalSummary, null, 2), 'utf-8');

        return finalSummary;
    }

    return {
        analyzeCharacter,
        analyzeCharacters,
        applyCharacters,
    };
}

module.exports = {
    createCharacterEvolutionRetentionApplyService,
};
