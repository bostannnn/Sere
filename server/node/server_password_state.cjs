function createServerPasswordState(arg = {}) {
    const path = arg.path;
    const existsSync = typeof arg.existsSync === 'function'
        ? arg.existsSync
        : (() => false);
    const mkdirSync = typeof arg.mkdirSync === 'function'
        ? arg.mkdirSync
        : (() => {});
    const readFileSync = typeof arg.readFileSync === 'function'
        ? arg.readFileSync
        : (() => '');
    const cwd = typeof arg.cwd === 'function'
        ? arg.cwd
        : (() => process.cwd());
    const dataRoot = typeof arg.dataRoot === 'string'
        ? arg.dataRoot
        : '';
    const preferDataRoot = !!arg.preferDataRoot;

    const legacySavePath = path.join(cwd(), 'save');
    const dataRootSavePath = dataRoot ? path.join(dataRoot, 'save') : legacySavePath;
    const dataRootPasswordPath = path.join(dataRootSavePath, '__password');
    const legacyPasswordPath = path.join(legacySavePath, '__password');

    let savePath = dataRootSavePath;
    if (
        !preferDataRoot &&
        dataRootSavePath !== legacySavePath &&
        !existsSync(dataRootPasswordPath) &&
        existsSync(legacyPasswordPath)
    ) {
        // Backward compatibility for existing installs that still keep password state in project ./save.
        savePath = legacySavePath;
    }

    if (!existsSync(savePath)) {
        mkdirSync(savePath, { recursive: true });
    }

    const passwordPath = path.join(savePath, '__password');
    const authCodePath = path.join(savePath, '__authcode');

    let password = '';
    if (existsSync(passwordPath)) {
        password = readFileSync(passwordPath, 'utf-8');
    }
    let oauthAccessToken = '';
    if (existsSync(authCodePath)) {
        oauthAccessToken = String(readFileSync(authCodePath, 'utf-8') || '').trim();
    }

    return {
        savePath,
        passwordPath,
        authCodePath,
        getOAuthAccessToken: () => oauthAccessToken,
        setOAuthAccessToken: (nextToken) => {
            oauthAccessToken = String(nextToken || '').trim();
        },
        clearOAuthAccessToken: () => {
            oauthAccessToken = '';
        },
        getPassword: () => password,
        setPassword: (nextPassword) => {
            password = nextPassword;
        },
    };
}

module.exports = {
    createServerPasswordState,
};
