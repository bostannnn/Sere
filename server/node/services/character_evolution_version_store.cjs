const path = require('path');

function createCharacterEvolutionVersionStore(arg = {}) {
    const { fs, existsSync } = arg;

    async function stageVersionFile(characterDir, version, payload) {
        const statesDir = path.join(characterDir, 'states');
        await fs.mkdir(statesDir, { recursive: true });
        const stagedPath = path.join(
            statesDir,
            `.v${version}.${Date.now()}.${Math.random().toString(36).slice(2, 10)}.pending.json`
        );
        await fs.writeFile(
            stagedPath,
            JSON.stringify(payload, null, 2),
            'utf-8'
        );
        return {
            stagedPath,
            finalPath: path.join(statesDir, `v${version}.json`),
        };
    }

    async function cleanupStagedVersionFile(stagedPath) {
        if (!stagedPath) {
            return;
        }
        try {
            await fs.unlink(stagedPath);
        } catch {}
    }

    async function finalizeVersionFile(versionFile) {
        if (!versionFile?.stagedPath || !versionFile?.finalPath) {
            return null;
        }
        try {
            await fs.rename(versionFile.stagedPath, versionFile.finalPath);
            return versionFile.finalPath;
        } catch {
            try {
                await fs.copyFile(versionFile.stagedPath, versionFile.finalPath);
                await cleanupStagedVersionFile(versionFile.stagedPath);
                return versionFile.finalPath;
            } catch {
                return versionFile.stagedPath;
            }
        }
    }

    async function readVersionMetasFromDisk(characterDir, arg = {}) {
        const { includeStagedThroughVersion = 0 } = arg;
        const statesDir = path.join(characterDir, 'states');
        if (!existsSync(statesDir)) {
            return [];
        }
        const files = await fs.readdir(statesDir);
        const versionFiles = new Map();
        for (const fileName of files) {
            const finalMatch = /^v(\d+)\.json$/.exec(fileName);
            const stagedMatch = /^\.v(\d+)\..+\.pending\.json$/.exec(fileName);
            const match = finalMatch || stagedMatch;
            if (!match) continue;
            const version = Number(match[1]);
            if (!Number.isFinite(version)) continue;
            const current = versionFiles.get(version);
            if (finalMatch) {
                versionFiles.set(version, {
                    fileName,
                    version,
                    priority: 2,
                });
                continue;
            }
            if (version > includeStagedThroughVersion) {
                continue;
            }
            if (!current || current.priority < 2) {
                if (!current || fileName > current.fileName) {
                    versionFiles.set(version, {
                        fileName,
                        version,
                        priority: 1,
                    });
                }
            }
        }

        const versions = [];
        for (const entry of versionFiles.values()) {
            try {
                const payload = JSON.parse(await fs.readFile(path.join(statesDir, entry.fileName), 'utf-8'));
                versions.push({
                    version: Math.max(0, Math.floor(entry.version)),
                    chatId: typeof payload?.chatId === 'string' ? payload.chatId : null,
                    acceptedAt: Number.isFinite(Number(payload?.acceptedAt)) ? Number(payload.acceptedAt) : 0,
                });
            } catch {}
        }
        return versions.sort((left, right) => left.version - right.version);
    }

    async function resolveVersionFilePath(characterDir, version, arg = {}) {
        const { allowStaged = false } = arg;
        const statesDir = path.join(characterDir, 'states');
        const finalPath = path.join(statesDir, `v${version}.json`);
        if (existsSync(finalPath)) {
            return finalPath;
        }
        if (!allowStaged) {
            return null;
        }
        if (!existsSync(statesDir)) {
            return null;
        }
        const stagedFiles = (await fs.readdir(statesDir))
            .filter((entry) => entry.startsWith(`.v${version}.`) && entry.endsWith('.pending.json'))
            .sort();
        if (stagedFiles.length === 0) {
            return null;
        }
        return path.join(statesDir, stagedFiles[stagedFiles.length - 1]);
    }

    function mergeVersionMetas(preferred, fallback) {
        const merged = new Map();
        for (const entry of Array.isArray(fallback) ? fallback : []) {
            if (!entry || !Number.isFinite(Number(entry.version))) continue;
            merged.set(Number(entry.version), {
                version: Math.max(0, Math.floor(Number(entry.version))),
                chatId: typeof entry.chatId === 'string' ? entry.chatId : null,
                acceptedAt: Number.isFinite(Number(entry.acceptedAt)) ? Number(entry.acceptedAt) : 0,
            });
        }
        for (const entry of Array.isArray(preferred) ? preferred : []) {
            if (!entry || !Number.isFinite(Number(entry.version))) continue;
            merged.set(Number(entry.version), {
                version: Math.max(0, Math.floor(Number(entry.version))),
                chatId: typeof entry.chatId === 'string' ? entry.chatId : null,
                acceptedAt: Number.isFinite(Number(entry.acceptedAt)) ? Number(entry.acceptedAt) : 0,
            });
        }
        return [...merged.values()].sort((left, right) => left.version - right.version);
    }

    return {
        cleanupStagedVersionFile,
        finalizeVersionFile,
        mergeVersionMetas,
        readVersionMetasFromDisk,
        resolveVersionFilePath,
        stageVersionFile,
    };
}

module.exports = {
    createCharacterEvolutionVersionStore,
};
