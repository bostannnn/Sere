function registerMemoryRoutes(arg = {}) {
    if (typeof arg.traceRoutes === 'function') {
        arg.traceRoutes(arg);
    }
    if (typeof arg.manualRoutes === 'function') {
        arg.manualRoutes(arg);
    }
    if (typeof arg.resummaryRoutes === 'function') {
        arg.resummaryRoutes(arg);
    }
}

module.exports = {
    registerMemoryRoutes,
};
