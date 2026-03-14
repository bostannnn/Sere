function registerEvolutionVersionRoutes(arg = {}) {
    const {
        app,
        dataDirs,
        fs,
        isSafePathSegment,
        LLMHttpError,
        loadCharacterAndSettings,
        normalizeCharacterEvolutionPrivacy,
        normalizeCharacterEvolutionRangeRef,
        normalizeCharacterEvolutionSectionConfigs,
        normalizeCharacterEvolutionSettings,
        normalizeCharacterEvolutionState,
        readVersionMetasFromDisk,
        requirePasswordAuth,
        resolveVersionFilePath,
        safeResolve,
        sendJson,
        toStringOrEmpty,
        versionHistory,
        withAsyncRoute,
    } = arg;

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
}

module.exports = {
    registerEvolutionVersionRoutes,
};
