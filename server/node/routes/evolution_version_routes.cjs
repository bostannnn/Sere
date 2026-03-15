function registerEvolutionVersionRoutes(arg = {}) {
    const {
        app,
        dataDirs,
        fs,
        isSafePathSegment,
        LLMHttpError,
        loadCharacterAndSettings,
        replaceCharacterWithRetry,
        normalizeCharacterEvolutionPrivacy,
        normalizeCharacterEvolutionRangeRef,
        normalizeCharacterEvolutionSectionConfigs,
        normalizeCharacterEvolutionSettings,
        normalizeCharacterEvolutionState,
        previewCharacterEvolutionRetentionDryRun = require('../llm/character_evolution/decay.cjs').previewCharacterEvolutionRetentionDryRun,
        readVersionMetasFromDisk,
        requirePasswordAuth,
        resolveVersionFilePath,
        safeResolve,
        sendJson,
        toStringOrEmpty,
        versionHistory,
        withAsyncRoute,
    } = arg;

    function normalizeVersionValue(value) {
        const version = Number(value);
        if (!Number.isFinite(version) || version < 0) {
            return null;
        }
        return Math.floor(version);
    }

    function rangesExactlyMatch(left, right) {
        return !!left
            && !!right
            && left.chatId === right.chatId
            && left.startMessageIndex === right.startMessageIndex
            && left.endMessageIndex === right.endMessageIndex;
    }

    function deriveLastProcessedMessageIndexByChat(processedRanges) {
        const cursors = {};
        for (const entry of Array.isArray(processedRanges) ? processedRanges : []) {
            const range = normalizeCharacterEvolutionRangeRef(entry?.range);
            if (!range) {
                continue;
            }
            cursors[range.chatId] = Math.max(
                Number.isFinite(Number(cursors[range.chatId])) ? Number(cursors[range.chatId]) : -1,
                range.endMessageIndex
            );
        }
        return cursors;
    }

    function deriveLastProcessedChatId(processedRanges) {
        const ordered = [...(Array.isArray(processedRanges) ? processedRanges : [])]
            .filter((entry) => normalizeCharacterEvolutionRangeRef(entry?.range))
            .sort((left, right) => {
                const leftVersion = normalizeVersionValue(left?.version) ?? 0;
                const rightVersion = normalizeVersionValue(right?.version) ?? 0;
                return leftVersion - rightVersion;
            });
        const last = ordered[ordered.length - 1];
        return normalizeCharacterEvolutionRangeRef(last?.range)?.chatId ?? null;
    }

    async function readVersionPayload(characterDir, evolution, version) {
        const committedVersion = (version > 0 && version <= evolution.currentStateVersion)
            || evolution.stateVersions.some((entry) => Number(entry?.version) === Math.floor(version));
        const versionPath = await resolveVersionFilePath(characterDir, Math.floor(version), { allowStaged: committedVersion });
        if (!versionPath) {
            const syntheticPayload = versionHistory.buildSyntheticCurrentVersionPayload(evolution, Math.floor(version));
            if (!syntheticPayload) {
                return null;
            }
            return {
                ...syntheticPayload,
                ...(normalizeCharacterEvolutionRangeRef(syntheticPayload?.range)
                    ? { range: normalizeCharacterEvolutionRangeRef(syntheticPayload.range) }
                    : {}),
                state: normalizeCharacterEvolutionState(syntheticPayload?.state),
                ...(Array.isArray(syntheticPayload?.sectionConfigs)
                    ? { sectionConfigs: normalizeCharacterEvolutionSectionConfigs(syntheticPayload.sectionConfigs) }
                    : {}),
                ...(syntheticPayload?.privacy && typeof syntheticPayload.privacy === 'object'
                    ? { privacy: normalizeCharacterEvolutionPrivacy(syntheticPayload.privacy) }
                    : {}),
            };
        }
        const payload = JSON.parse(await fs.readFile(versionPath, 'utf-8'));
        return {
            ...payload,
            ...(normalizeCharacterEvolutionRangeRef(payload?.range)
                ? { range: normalizeCharacterEvolutionRangeRef(payload.range) }
                : {}),
            state: normalizeCharacterEvolutionState(payload?.state),
            ...(Array.isArray(payload?.sectionConfigs)
                ? { sectionConfigs: normalizeCharacterEvolutionSectionConfigs(payload.sectionConfigs) }
                : {}),
            ...(payload?.privacy && typeof payload.privacy === 'object'
                ? { privacy: normalizeCharacterEvolutionPrivacy(payload.privacy) }
                : {}),
        };
    }

    async function removeVersionFiles(characterDir, versions) {
        for (const version of versions) {
            const versionPath = await resolveVersionFilePath(characterDir, version, { allowStaged: true });
            if (!versionPath) {
                continue;
            }
            try {
                await fs.unlink(versionPath);
            } catch {}
        }
    }

    async function applyVersionMutation(args = {}) {
        const {
            characterId,
            character,
            evolution,
            charDir,
            survivingVersions,
            invalidatedVersions,
            source,
            restoreVersion = null,
        } = args;
        const nextVersion = restoreVersion === null
            ? (survivingVersions[survivingVersions.length - 1]?.version ?? 0)
            : restoreVersion;
        const restoredPayload = nextVersion > 0
            ? await readVersionPayload(charDir, evolution, nextVersion)
            : null;
        const nextProcessedRanges = survivingVersions
            .filter((entry) => normalizeCharacterEvolutionRangeRef(entry?.range))
            .map((entry) => ({
                version: entry.version,
                acceptedAt: Number.isFinite(Number(entry.acceptedAt)) ? Number(entry.acceptedAt) : 0,
                range: normalizeCharacterEvolutionRangeRef(entry.range),
            }));
        const nextCharacter = {
            ...character,
            characterEvolution: {
                ...evolution,
                currentStateVersion: nextVersion,
                currentState: restoredPayload?.state ?? normalizeCharacterEvolutionState({}),
                pendingProposal: null,
                lastProcessedChatId: deriveLastProcessedChatId(nextProcessedRanges),
                lastProcessedMessageIndexByChat: deriveLastProcessedMessageIndexByChat(nextProcessedRanges),
                processedRanges: nextProcessedRanges,
                stateVersions: survivingVersions.map((entry) => ({
                    version: entry.version,
                    chatId: typeof entry.chatId === 'string' ? entry.chatId : null,
                    acceptedAt: Number.isFinite(Number(entry.acceptedAt)) ? Number(entry.acceptedAt) : 0,
                    ...(normalizeCharacterEvolutionRangeRef(entry.range)
                        ? { range: normalizeCharacterEvolutionRangeRef(entry.range) }
                        : {}),
                })),
            },
        };
        await replaceCharacterWithRetry(characterId, nextCharacter, source);
        await removeVersionFiles(charDir, invalidatedVersions);
        return nextCharacter.characterEvolution;
    }

    app.post('/data/character-evolution/:charId/retention/dry-run', withAsyncRoute('character_evolution_retention_dry_run', async (req, res) => {
        if (typeof requirePasswordAuth === 'function' && !requirePasswordAuth(req, res)) {
            return;
        }
        const characterId = toStringOrEmpty(req.params?.charId);
        if (!characterId || !isSafePathSegment(characterId)) {
            throw new LLMHttpError(400, 'INVALID_CHARACTER_ID', 'charId is required and must be a safe id.');
        }
        const { settings, character } = await loadCharacterAndSettings(characterId);
        const evolution = normalizeCharacterEvolutionSettings(character.characterEvolution);
        const defaults = settings?.characterEvolutionDefaults && typeof settings.characterEvolutionDefaults === 'object'
            ? settings.characterEvolutionDefaults
            : {};
        const report = previewCharacterEvolutionRetentionDryRun({
            state: normalizeCharacterEvolutionState(evolution.currentState),
            currentStateVersion: evolution.currentStateVersion || 0,
            retentionPolicy: defaults.retention ?? null,
            promptProjectionPolicy: defaults.promptProjection ?? null,
        });
        sendJson(res, 200, {
            ok: true,
            report,
        });
    }));

    app.get('/data/character-evolution/:charId/versions', withAsyncRoute('character_evolution_versions', async (req, res) => {
        if (typeof requirePasswordAuth === 'function' && !requirePasswordAuth(req, res)) {
            return;
        }
        const characterId = toStringOrEmpty(req.params?.charId);
        if (!characterId || !isSafePathSegment(characterId)) {
            throw new LLMHttpError(400, 'INVALID_CHARACTER_ID', 'charId is required and must be a safe id.');
        }
        const { character, charDir } = await loadCharacterAndSettings(characterId);
        const evolution = normalizeCharacterEvolutionSettings(character.characterEvolution);
        const versions = versionHistory.listReadableVersionMetas(
            evolution,
            await readVersionMetasFromDisk(charDir, {
                includeStagedThroughVersion: evolution.currentStateVersion || 0,
            }),
        );
        sendJson(res, 200, {
            ok: true,
            currentStateVersion: evolution.currentStateVersion,
            versions: [...versions].sort((left, right) => right.version - left.version),
        });
    }));

    app.get('/data/character-evolution/:charId/versions/:version', withAsyncRoute('character_evolution_version', async (req, res) => {
        if (typeof requirePasswordAuth === 'function' && !requirePasswordAuth(req, res)) {
            return;
        }
        const characterId = toStringOrEmpty(req.params?.charId);
        const version = Number(req.params?.version);
        if (!characterId || !isSafePathSegment(characterId)) {
            throw new LLMHttpError(400, 'INVALID_CHARACTER_ID', 'charId is required and must be a safe id.');
        }
        if (!Number.isFinite(version) || version < 0) {
            throw new LLMHttpError(400, 'INVALID_VERSION', 'version must be a positive number.');
        }
        const { character } = await loadCharacterAndSettings(characterId);
        const evolution = normalizeCharacterEvolutionSettings(character.characterEvolution);
        const committedVersion = (version > 0 && version <= evolution.currentStateVersion)
            || evolution.stateVersions.some((entry) => Number(entry?.version) === Math.floor(version));
        const versionPath = await resolveVersionFilePath(
            safeResolve(dataDirs.characters, characterId),
            Math.floor(version),
            { allowStaged: committedVersion },
        );
        if (!versionPath) {
            const syntheticPayload = versionHistory.buildSyntheticCurrentVersionPayload(evolution, Math.floor(version));
            if (!syntheticPayload) {
                throw new LLMHttpError(404, 'VERSION_NOT_FOUND', `Evolution version not found: ${version}`);
            }
            sendJson(res, 200, {
                ok: true,
                version: {
                    ...syntheticPayload,
                    ...(normalizeCharacterEvolutionRangeRef(syntheticPayload?.range)
                        ? { range: normalizeCharacterEvolutionRangeRef(syntheticPayload.range) }
                        : {}),
                    state: normalizeCharacterEvolutionState(syntheticPayload?.state),
                    ...(Array.isArray(syntheticPayload?.sectionConfigs)
                        ? { sectionConfigs: normalizeCharacterEvolutionSectionConfigs(syntheticPayload.sectionConfigs) }
                        : {}),
                    ...(syntheticPayload?.privacy && typeof syntheticPayload.privacy === 'object'
                        ? { privacy: normalizeCharacterEvolutionPrivacy(syntheticPayload.privacy) }
                        : {}),
                },
            });
            return;
        }
        const payload = JSON.parse(await fs.readFile(versionPath, 'utf-8'));
        sendJson(res, 200, {
            ok: true,
            version: {
                ...payload,
                ...(normalizeCharacterEvolutionRangeRef(payload?.range)
                    ? { range: normalizeCharacterEvolutionRangeRef(payload.range) }
                    : {}),
                state: normalizeCharacterEvolutionState(payload?.state),
                ...(Array.isArray(payload?.sectionConfigs)
                    ? { sectionConfigs: normalizeCharacterEvolutionSectionConfigs(payload.sectionConfigs) }
                    : {}),
                ...(payload?.privacy && typeof payload.privacy === 'object'
                    ? { privacy: normalizeCharacterEvolutionPrivacy(payload.privacy) }
                    : {}),
            },
        });
    }));

    app.post('/data/character-evolution/:charId/coverage/clear', withAsyncRoute('character_evolution_coverage_clear', async (req, res) => {
        if (typeof requirePasswordAuth === 'function' && !requirePasswordAuth(req, res)) {
            return;
        }
        const characterId = toStringOrEmpty(req.params?.charId);
        if (!characterId || !isSafePathSegment(characterId)) {
            throw new LLMHttpError(400, 'INVALID_CHARACTER_ID', 'charId is required and must be a safe id.');
        }
        const requestedRange = normalizeCharacterEvolutionRangeRef(req.body?.range || req.body);
        if (!requestedRange) {
            throw new LLMHttpError(400, 'INVALID_RANGE', 'Provide an exact accepted range to clear.');
        }
        const { character, charDir } = await loadCharacterAndSettings(characterId);
        const evolution = normalizeCharacterEvolutionSettings(character.characterEvolution);
        const recoveredVersions = versionHistory.listReadableVersionMetas(
            evolution,
            await readVersionMetasFromDisk(charDir, {
                includeStagedThroughVersion: evolution.currentStateVersion || 0,
            }),
        );
        const matchingRange = (Array.isArray(evolution.processedRanges) ? evolution.processedRanges : [])
            .find((entry) => rangesExactlyMatch(normalizeCharacterEvolutionRangeRef(entry?.range), requestedRange));
        if (!matchingRange) {
            throw new LLMHttpError(404, 'COVERAGE_RANGE_NOT_FOUND', 'Accepted range not found. Coverage clearing requires an exact accepted-range match.');
        }
        const targetVersion = normalizeVersionValue(matchingRange.version);
        if (targetVersion === null) {
            throw new LLMHttpError(500, 'INVALID_RANGE_VERSION', 'Matched coverage entry had an invalid version.');
        }
        const invalidatedVersions = recoveredVersions
            .filter((entry) => entry.version >= targetVersion)
            .map((entry) => entry.version);
        const survivingVersions = recoveredVersions.filter((entry) => !invalidatedVersions.includes(entry.version));
        const nextEvolution = await applyVersionMutation({
            characterId,
            character,
            evolution,
            charDir,
            survivingVersions,
            invalidatedVersions,
            source: 'character-evolution.coverage-clear',
        });
        sendJson(res, 200, {
            ok: true,
            clearedRange: requestedRange,
            invalidatedVersions,
            currentStateVersion: nextEvolution.currentStateVersion,
            state: nextEvolution.currentState,
            versions: nextEvolution.stateVersions,
            processedRanges: nextEvolution.processedRanges,
        });
    }));

    app.post('/data/character-evolution/:charId/versions/:version/revert', withAsyncRoute('character_evolution_version_revert', async (req, res) => {
        if (typeof requirePasswordAuth === 'function' && !requirePasswordAuth(req, res)) {
            return;
        }
        const characterId = toStringOrEmpty(req.params?.charId);
        const version = normalizeVersionValue(req.params?.version);
        if (!characterId || !isSafePathSegment(characterId)) {
            throw new LLMHttpError(400, 'INVALID_CHARACTER_ID', 'charId is required and must be a safe id.');
        }
        if (version === null || version < 1) {
            throw new LLMHttpError(400, 'INVALID_VERSION', 'version must be a positive number.');
        }
        const { character, charDir } = await loadCharacterAndSettings(characterId);
        const evolution = normalizeCharacterEvolutionSettings(character.characterEvolution);
        const recoveredVersions = versionHistory.listReadableVersionMetas(
            evolution,
            await readVersionMetasFromDisk(charDir, {
                includeStagedThroughVersion: evolution.currentStateVersion || 0,
            }),
        );
        const targetExists = recoveredVersions.some((entry) => entry.version === version);
        if (!targetExists) {
            throw new LLMHttpError(404, 'VERSION_NOT_FOUND', `Evolution version not found: ${version}`);
        }
        const invalidatedVersions = recoveredVersions
            .filter((entry) => entry.version > version)
            .map((entry) => entry.version);
        const survivingVersions = recoveredVersions.filter((entry) => entry.version <= version);
        const nextEvolution = await applyVersionMutation({
            characterId,
            character,
            evolution,
            charDir,
            survivingVersions,
            invalidatedVersions,
            restoreVersion: version,
            source: 'character-evolution.version-revert',
        });
        sendJson(res, 200, {
            ok: true,
            revertedToVersion: version,
            invalidatedVersions,
            currentStateVersion: nextEvolution.currentStateVersion,
            state: nextEvolution.currentState,
            versions: nextEvolution.stateVersions,
            processedRanges: nextEvolution.processedRanges,
        });
    }));

    app.post('/data/character-evolution/:charId/versions/:version/delete', withAsyncRoute('character_evolution_version_delete', async (req, res) => {
        if (typeof requirePasswordAuth === 'function' && !requirePasswordAuth(req, res)) {
            return;
        }
        const characterId = toStringOrEmpty(req.params?.charId);
        const version = normalizeVersionValue(req.params?.version);
        if (!characterId || !isSafePathSegment(characterId)) {
            throw new LLMHttpError(400, 'INVALID_CHARACTER_ID', 'charId is required and must be a safe id.');
        }
        if (version === null || version < 1) {
            throw new LLMHttpError(400, 'INVALID_VERSION', 'version must be a positive number.');
        }
        const { character, charDir } = await loadCharacterAndSettings(characterId);
        const evolution = normalizeCharacterEvolutionSettings(character.characterEvolution);
        const recoveredVersions = versionHistory.listReadableVersionMetas(
            evolution,
            await readVersionMetasFromDisk(charDir, {
                includeStagedThroughVersion: evolution.currentStateVersion || 0,
            }),
        );
        const targetIndex = recoveredVersions.findIndex((entry) => entry.version === version);
        if (targetIndex < 0) {
            throw new LLMHttpError(404, 'VERSION_NOT_FOUND', `Evolution version not found: ${version}`);
        }
        const invalidatedVersions = targetIndex === recoveredVersions.length - 1
            ? [version]
            : recoveredVersions.slice(targetIndex).map((entry) => entry.version);
        const survivingVersions = recoveredVersions.filter((entry) => !invalidatedVersions.includes(entry.version));
        const nextEvolution = await applyVersionMutation({
            characterId,
            character,
            evolution,
            charDir,
            survivingVersions,
            invalidatedVersions,
            source: 'character-evolution.version-delete',
        });
        sendJson(res, 200, {
            ok: true,
            deletedVersion: version,
            invalidatedVersions,
            currentStateVersion: nextEvolution.currentStateVersion,
            state: nextEvolution.currentState,
            versions: nextEvolution.stateVersions,
            processedRanges: nextEvolution.processedRanges,
        });
    }));
}

module.exports = {
    registerEvolutionVersionRoutes,
};
