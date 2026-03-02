function installTimestampedConsole() {
    const key = '__RISU_TIMESTAMPED_CONSOLE_INSTALLED__';
    if (globalThis[key]) return;
    globalThis[key] = true;

    const wrapMethod = (method) => {
        const original = console[method];
        if (typeof original !== 'function') return;

        console[method] = (...args) => {
            const stamp = `[${new Date().toISOString()}]`;
            if (args.length === 0) {
                return original.call(console, stamp);
            }
            if (typeof args[0] === 'string') {
                return original.call(console, `${stamp} ${args[0]}`, ...args.slice(1));
            }
            return original.call(console, stamp, ...args);
        };
    };

    wrapMethod('log');
    wrapMethod('info');
    wrapMethod('warn');
    wrapMethod('error');
    wrapMethod('debug');
}

module.exports = {
    installTimestampedConsole,
};
