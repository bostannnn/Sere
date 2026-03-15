const {
    normalizeCharacterEvolutionDefaults,
    normalizeCharacterEvolutionSettings,
} = require('../llm/character_evolution.cjs');
const { previewCharacterEvolutionRetentionDryRun } = require('../llm/character_evolution/decay.cjs');

function createCharacterEvolutionRetentionDryRunService(arg = {}) {
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
    const previewRetention = typeof arg.previewCharacterEvolutionRetentionDryRun === 'function'
        ? arg.previewCharacterEvolutionRetentionDryRun
        : previewCharacterEvolutionRetentionDryRun;

    function isSafeCharacterId(value) {
        return typeof value === 'string' && /^[a-zA-Z0-9._-]+$/.test(value);
    }

    async function readJson(filePath, fallback) {
        try {
            const raw = JSON.parse(await fs.readFile(filePath, 'utf-8'));
            return raw?.character || raw?.data || raw || fallback;
        } catch {
            return fallback;
        }
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

    async function readDefaults() {
        const settingsPath = path.join(dataDirs.root || '', 'settings.json');
        if (!settingsPath || !existsSync(settingsPath)) {
            return normalizeDefaults({});
        }
        const raw = await readJson(settingsPath, {});
        return normalizeDefaults(raw?.characterEvolutionDefaults);
    }

    async function analyzeCharacter(characterId, defaults = null) {
        if (!isSafeCharacterId(characterId)) {
            throw new Error(`Invalid character id: ${characterId}`);
        }
        const characterPath = path.join(dataDirs.characters || '', characterId, 'character.json');
        if (!characterPath || !existsSync(characterPath)) {
            return null;
        }
        const rawCharacter = await readJson(characterPath, {});
        const evolution = normalizeEvolutionSettings(rawCharacter?.characterEvolution);
        const effectiveDefaults = defaults ?? await readDefaults();
        const report = previewRetention({
            state: evolution.currentState,
            currentStateVersion: evolution.currentStateVersion || 0,
            retentionPolicy: effectiveDefaults?.retention ?? null,
            promptProjectionPolicy: effectiveDefaults?.promptProjection ?? null,
        });
        const changedSections = summarizeChangedSections(report);
        return {
            characterId,
            name: typeof rawCharacter?.name === 'string' ? rawCharacter.name : '',
            currentStateVersion: report.currentStateVersion,
            simulatedAcceptedVersion: report.simulatedAcceptedVersion,
            totals: report.totals,
            removedTotal: Math.max(0, Number(report.totals.before.total || 0) - Number(report.totals.after.total || 0)),
            changedSections,
            report,
        };
    }

    async function analyzeCharacters(characterIds = null) {
        const defaults = await readDefaults();
        const ids = Array.isArray(characterIds) && characterIds.length > 0
            ? characterIds.filter((value) => isSafeCharacterId(value))
            : (existsSync(dataDirs.characters || '')
                ? (await fs.readdir(dataDirs.characters, { withFileTypes: true }))
                    .filter((entry) => entry?.isDirectory?.())
                    .map((entry) => entry.name)
                    .filter((value) => isSafeCharacterId(value))
                : []);

        const reports = [];
        for (const characterId of ids) {
            const report = await analyzeCharacter(characterId, defaults);
            if (report) {
                reports.push(report);
            }
        }

        return {
            scannedAt: Date.now(),
            charactersScanned: reports.length,
            charactersChanged: reports.filter((entry) => entry.changedSections.length > 0).length,
            totalItemsBefore: reports.reduce((sum, entry) => sum + Number(entry.totals.before.total || 0), 0),
            totalItemsAfter: reports.reduce((sum, entry) => sum + Number(entry.totals.after.total || 0), 0),
            totalRemoved: reports.reduce((sum, entry) => sum + Number(entry.removedTotal || 0), 0),
            reports,
        };
    }

    return {
        analyzeCharacter,
        analyzeCharacters,
    };
}

module.exports = {
    createCharacterEvolutionRetentionDryRunService,
};
