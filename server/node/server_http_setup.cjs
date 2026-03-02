function normalizeHttpMethod(value) {
    return (
        typeof value === 'string'
            ? value.trim().toUpperCase()
            : ''
    );
}

function normalizeHttpPath(value, options = {}) {
    if (typeof value !== 'string') return '';
    const caseSensitiveRouting = !!options.caseSensitiveRouting;
    const strictRouting = !!options.strictRouting;
    let normalized = value.trim();
    const hashIndex = normalized.indexOf('#');
    if (hashIndex >= 0) normalized = normalized.slice(0, hashIndex);
    const queryIndex = normalized.indexOf('?');
    if (queryIndex >= 0) normalized = normalized.slice(0, queryIndex);
    if (!normalized) return '';
    normalized = normalized.startsWith('/') ? normalized : `/${normalized}`;
    if (!strictRouting && normalized.length > 1) {
        normalized = normalized.replace(/\/+$/, '');
        if (!normalized) normalized = '/';
    }
    if (!caseSensitiveRouting) {
        normalized = normalized.toLowerCase();
    }
    return normalized;
}

function buildJsonSkipMatchers(rawMatchers, options = {}) {
    const matchers = Array.isArray(rawMatchers) ? rawMatchers : [];
    return matchers
        .map((matcher) => {
            if (typeof matcher === 'string') {
                const parsedPath = normalizeHttpPath(matcher, options);
                return parsedPath ? { method: '', path: parsedPath } : null;
            }
            if (!matcher || typeof matcher !== 'object') {
                return null;
            }
            const parsedPath = normalizeHttpPath(matcher.path, options);
            if (!parsedPath) {
                return null;
            }
            return {
                method: normalizeHttpMethod(matcher.method),
                path: parsedPath,
            };
        })
        .filter(Boolean);
}

function shouldSkipJsonBodyParser(req, jsonSkipMatchers, options = {}) {
    if (!Array.isArray(jsonSkipMatchers) || jsonSkipMatchers.length === 0) {
        return false;
    }
    const reqPath = normalizeHttpPath(
        typeof req?.path === 'string'
            ? req.path
            : (typeof req?.originalUrl === 'string' ? req.originalUrl : req?.url),
        options
    );
    const reqMethod = normalizeHttpMethod(req?.method);
    return jsonSkipMatchers.some((matcher) => (
        matcher.path === reqPath &&
        (!matcher.method || matcher.method === reqMethod)
    ));
}

function configureServerHttpApp(arg = {}) {
    const app = arg.app;
    const express = arg.express;
    const path = arg.path;
    const cwd = typeof arg.cwd === 'function'
        ? arg.cwd
        : (() => process.cwd());

    if (!app || typeof app.use !== 'function') {
        throw new Error('configureServerHttpApp requires an Express app instance.');
    }
    if (!express || typeof express.static !== 'function') {
        throw new Error('configureServerHttpApp requires the express module.');
    }

    const wrappedAsyncHandler = Symbol('wrappedAsyncHandler');
    const limits = (arg.httpBodyLimits && typeof arg.httpBodyLimits === 'object')
        ? arg.httpBodyLimits
        : {};
    const skipJsonBodyParserFor = Array.isArray(arg.skipJsonBodyParserFor)
        ? arg.skipJsonBodyParserFor
        : [];
    const defaultJsonLimit = typeof limits.json === 'string' ? limits.json : '20mb';
    const defaultRawLimit = typeof limits.raw === 'string' ? limits.raw : '20mb';
    const defaultTextLimit = typeof limits.text === 'string' ? limits.text : '20mb';
    const routeMethods = ['use', 'all', 'get', 'post', 'put', 'patch', 'delete', 'options', 'head'];
    const caseSensitiveRouting = !!(typeof app.get === 'function' && app.get('case sensitive routing'));
    const strictRouting = !!(typeof app.get === 'function' && app.get('strict routing'));
    const routingOptions = {
        caseSensitiveRouting,
        strictRouting,
    };
    const jsonSkipMatchers = buildJsonSkipMatchers(skipJsonBodyParserFor, routingOptions);

    const wrapHandlerArg = (value) => {
        if (Array.isArray(value)) {
            return value.map(wrapHandlerArg);
        }
        if (typeof value !== 'function') {
            return value;
        }
        if (value[wrappedAsyncHandler]) {
            return value;
        }
        if (value.length >= 4) {
            const wrappedErrorHandler = function wrappedErrorHandler(err, req, res, next) {
                try {
                    const maybePromise = value.call(this, err, req, res, next);
                    if (maybePromise && typeof maybePromise.then === 'function' && typeof next === 'function') {
                        maybePromise.catch(next);
                    }
                    return maybePromise;
                } catch (error) {
                    if (typeof next === 'function') {
                        return next(error);
                    }
                    throw error;
                }
            };
            Object.defineProperty(wrappedErrorHandler, wrappedAsyncHandler, {
                value: true,
            });
            return wrappedErrorHandler;
        }
        const wrappedRouteHandler = function wrappedRouteHandler(req, res, next) {
            try {
                const maybePromise = value.call(this, req, res, next);
                if (maybePromise && typeof maybePromise.then === 'function' && typeof next === 'function') {
                    maybePromise.catch(next);
                }
                return maybePromise;
            } catch (error) {
                if (typeof next === 'function') {
                    return next(error);
                }
                throw error;
            }
        };
        Object.defineProperty(wrappedRouteHandler, wrappedAsyncHandler, {
            value: true,
        });
        return wrappedRouteHandler;
    };

    for (const method of routeMethods) {
        if (typeof app[method] !== 'function') continue;
        const originalMethod = app[method].bind(app);
        app[method] = (...args) => originalMethod(...args.map(wrapHandlerArg));
    }

    app.use(express.static(path.join(cwd(), 'dist'), {
        index: false,
        setHeaders: (res, filePath) => {
            if (filePath.endsWith('.wasm')) {
                res.setHeader('Content-Type', 'application/wasm');
            }
            res.setHeader('Access-Control-Allow-Origin', '*');
        },
    }));
    const defaultJsonParser = express.json({ limit: defaultJsonLimit });
    app.use((req, res, next) => {
        if (jsonSkipMatchers.length === 0) {
            return defaultJsonParser(req, res, next);
        }
        const shouldSkip = shouldSkipJsonBodyParser(req, jsonSkipMatchers, routingOptions);
        if (shouldSkip) {
            return next();
        }
        return defaultJsonParser(req, res, next);
    });
    app.use(express.raw({ type: 'application/octet-stream', limit: defaultRawLimit }));
    app.use(express.text({ limit: defaultTextLimit }));

    app.use((req, res, next) => {
        console.log(`[Incoming] ${req.method} ${req.originalUrl}`);
        next();
    });
}

module.exports = {
    configureServerHttpApp,
    __test: {
        normalizeHttpMethod,
        normalizeHttpPath,
        buildJsonSkipMatchers,
        shouldSkipJsonBodyParser,
    },
};
