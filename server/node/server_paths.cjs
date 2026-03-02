function createServerPaths(arg = {}) {
    const path = arg.path;
    const cwd = typeof arg.cwd === 'function'
        ? arg.cwd
        : (() => process.cwd());
    const dataRootEnv = typeof arg.dataRootEnv === 'string'
        ? arg.dataRootEnv
        : process.env.SERE_DATA_ROOT;

    const projectRoot = cwd();
    const sslPath = path.join(projectRoot, 'server/node/ssl/certificate');
    const dataRoot = dataRootEnv || path.join(projectRoot, 'data');
    const isCustomDataRoot = !!dataRootEnv;

    const dataDirs = {
        root: dataRoot,
        characters: path.join(dataRoot, 'characters'),
        assets: path.join(dataRoot, 'assets'),
        plugins: path.join(dataRoot, 'plugins'),
        prompts: path.join(dataRoot, 'prompts'),
        themes: path.join(dataRoot, 'themes'),
        color_schemes: path.join(dataRoot, 'color_schemes'),
        logs: path.join(dataRoot, 'logs'),
        ragRulebooks: path.join(dataRoot, 'rag', 'rulebooks'),
    };

    return {
        sslPath,
        dataRoot,
        isCustomDataRoot,
        dataDirs,
    };
}

module.exports = {
    createServerPaths,
};
