function registerMemoryRoutes(arg = {}) {
    if (typeof arg.traceRoutes === 'function') {
        arg.traceRoutes(arg);
    }
    if (typeof arg.manualRoutes === 'function') {
        arg.manualRoutes(arg);
    }
}

module.exports = {
    registerMemoryRoutes,
};
