/**
 * check-server-deps.cjs
 *
 * Contract enforcer for dependency injection architecture across server modules.
 *
 * Rules checked:
 *   DEP-001  Every non-root .cjs module exports at least one create*, register*, or configure* factory
 *            (utility-module exceptions allowed).
 *   DEP-002  No top-level require() of project-internal modules in route files
 *            (except rag/ sub-modules).
 *   DEP-003  No module-level mutable state (let/var) outside allowed state modules.
 *   DEP-004  process.env access only in approved files.
 *   DEP-005  Route register* factories must not compose other register* factories internally.
 *   DEP-006  Exported DI factories must use arg or arg = {} signature (supports function + arrow forms).
 *   DEP-007  server.cjs must install data middleware before route registration.
 *
 * Optional local suppressions:
 *   // checker-ignore DEP-006 until YYYY-MM-DD: reason
 * Expired suppressions fail the checker.
 *
 * Run:  node server/node/check-server-deps.cjs
 * Exit: 0 = all pass, 1 = violations found.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const {
    parseAst,
    collectNamedFunctions,
    parseCheckerSuppressions,
    isRuleSuppressed,
} = require('./checker_utils.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const failures = [];

function rule(name, condition, details, file) {
    if (condition) return;
    if (file && isRuleSuppressed(name, file.suppressions)) return;
    failures.push({ name, details });
}

function readSrc(filePath) {
    return fs.readFileSync(filePath, 'utf-8');
}

function collectCjsFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter((f) => f.endsWith('.cjs'))
        .map((f) => {
            const abs = path.join(dir, f);
            const src = readSrc(abs);
            const suppressions = parseCheckerSuppressions(src);
            const { ast, error } = parseAst(src, f);
            const namedFunctions = ast ? collectNamedFunctions(ast, src) : new Map();
            const file = { name: f, abs, src, ast, astError: error, namedFunctions, suppressions };
            for (const bad of suppressions.invalid) {
                failures.push({
                    name: `DEP-SUPPRESS:${f}:${bad.line}`,
                    details: `${bad.reason}\n    ${bad.text}`,
                });
            }
            for (const expired of suppressions.expired) {
                failures.push({
                    name: `DEP-SUPPRESS:${f}:${expired.line}`,
                    details: `Expired suppression for ${expired.ruleCode} (expired ${expired.until}).\n    ${expired.text}`,
                });
            }
            if (error) {
                failures.push({
                    name: `DEP-AST:${f}`,
                    details: error,
                });
            }
            return file;
        });
}

function indexOf(src, re) {
    const m = re.exec(src);
    return m ? m.index : -1;
}

function occursBeforeFirstFactory(src, re) {
    const firstFactory = indexOf(src, /\b(function\s+(create|register)\w+|module\.exports)/);
    const hit = indexOf(src, re);
    if (hit === -1) return false;
    return firstFactory === -1 || hit < firstFactory;
}

function getExportedNames(src) {
    const m = src.match(/module\.exports\s*=\s*\{([^}]+)\}/);
    if (!m) return [];
    return m[1].split(',').map((s) => s.trim().split(':')[0].trim()).filter(Boolean);
}

function usesArgFactorySignature(fnNode) {
    if (!fnNode || !Array.isArray(fnNode.params)) return false;
    if (fnNode.params.length === 0) return true;
    if (fnNode.params.length !== 1) return false;
    const only = fnNode.params[0];
    if (only.type === 'Identifier') return only.name === 'arg';
    if (only.type === 'AssignmentPattern') {
        return only.left?.type === 'Identifier'
            && only.left.name === 'arg'
            && only.right?.type === 'ObjectExpression';
    }
    return false;
}

// ---------------------------------------------------------------------------
// Files to check
// ---------------------------------------------------------------------------

const serverDir = __dirname;
const routesDir = path.join(serverDir, 'routes');

const serverFiles = collectCjsFiles(serverDir);
const routeFiles = collectCjsFiles(routesDir);

const ROOT_FILE = 'server.cjs';
const STATE_FILES = new Set(['server_password_state.cjs']);
const UTILITY_MODULE_EXCEPTIONS = new Set([
    'server_helpers.cjs',
    'storage_utils.cjs',
    // Side-effect utility that wraps console output; intentionally not a DI factory.
    'console_timestamp.cjs',
]);

const PROCESS_ENV_ALLOWED = new Set([
    'server.cjs',
    'server_paths.cjs',
    'server_helpers.cjs',
    'proxy_routes.cjs',
    'integration_routes.cjs',
    'server_runtime.cjs',
]);

const SKIP_FILES = new Set([
    'check-server-routes.cjs',
    'check-api-surface.cjs',
    'check-server-deps.cjs',
    'check-error-handling.cjs',
    'check-server-contracts.cjs',
    'check-server-authoritative.cjs',
    'checker_utils.cjs',
]);

const allServerFiles = serverFiles.filter((f) => !SKIP_FILES.has(f.name));
const allFiles = [...allServerFiles, ...routeFiles];
const nonRootFiles = allFiles.filter((f) => f.name !== ROOT_FILE);
const nonRootNonState = nonRootFiles.filter((f) => !STATE_FILES.has(f.name));

// ---------------------------------------------------------------------------
// DEP-001
// ---------------------------------------------------------------------------

for (const file of nonRootFiles) {
    if (UTILITY_MODULE_EXCEPTIONS.has(file.name)) continue;
    const exported = getExportedNames(file.src);
    const factoryExports = exported.filter((name) => /^(create|register|configure)[A-Z]/.test(name));
    rule(
        `DEP-001:${file.name}`,
        factoryExports.length >= 1,
        `${file.name} does not export a create*(), register*(), or configure*() factory. ` +
        `Got: [${exported.join(', ')}]. ` +
        `If this is a utility module, add it to UTILITY_MODULE_EXCEPTIONS with a comment.`,
        file
    );
}

// ---------------------------------------------------------------------------
// DEP-002
// ---------------------------------------------------------------------------

const INTERNAL_REQUIRE_RE = /\brequire\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g;
const ALLOWED_INTERNAL_PREFIXES = ['../rag/', './rag/'];

for (const file of routeFiles) {
    let m;
    const re = new RegExp(INTERNAL_REQUIRE_RE.source, 'g');
    while ((m = re.exec(file.src)) !== null) {
        const requirePath = m[1];
        const isAllowed = ALLOWED_INTERNAL_PREFIXES.some((prefix) => requirePath.startsWith(prefix));
        const beforeFactory = occursBeforeFirstFactory(
            file.src,
            new RegExp(`require\\s*\\(\\s*['"]${requirePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]\\s*\\)`)
        );
        if (beforeFactory && !isAllowed) {
            rule(
                `DEP-002:${file.name}:require(${requirePath})`,
                false,
                `${file.name} has a top-level require('${requirePath}'). ` +
                'Route files must receive dependencies via arg = {} (except rag/ sub-modules).',
                file
            );
        }
    }
}

// ---------------------------------------------------------------------------
// DEP-003
// ---------------------------------------------------------------------------

const TOP_LEVEL_MUTABLE_RE = /^(?:let|var)\s+\w+/m;

for (const file of nonRootNonState) {
    const hasTopMutable = occursBeforeFirstFactory(file.src, TOP_LEVEL_MUTABLE_RE);
    rule(
        `DEP-003:${file.name}`,
        !hasTopMutable,
        `${file.name} declares a mutable variable (let/var) at module top-level. ` +
        'Move mutable state inside a factory function.',
        file
    );
}

// ---------------------------------------------------------------------------
// DEP-004
// ---------------------------------------------------------------------------

const PROCESS_ENV_RE = /\bprocess\.env\b/;

for (const file of allFiles) {
    if (PROCESS_ENV_ALLOWED.has(file.name)) continue;
    rule(
        `DEP-004:${file.name}`,
        !PROCESS_ENV_RE.test(file.src),
        `${file.name} accesses process.env directly. ` +
        `Only [${[...PROCESS_ENV_ALLOWED].join(', ')}] may read process.env.`,
        file
    );
}

// ---------------------------------------------------------------------------
// DEP-005
// ---------------------------------------------------------------------------

const REGISTER_CALL_RE = /\bregister[A-Z]\w+\s*\(/g;

for (const file of routeFiles) {
    const factoryStart = file.src.search(/\bfunction\s+register[A-Z]/);
    if (factoryStart === -1) continue;
    const body = file.src.slice(factoryStart);
    const bodyStart = body.indexOf('{');
    if (bodyStart === -1) continue;
    const bodyContent = body.slice(bodyStart + 1);
    let m;
    const re = new RegExp(REGISTER_CALL_RE.source, 'g');
    while ((m = re.exec(bodyContent)) !== null) {
        rule(
            `DEP-005:${file.name}:${m[0].trim()}`,
            false,
            `${file.name} calls ${m[0].trim()} inside its factory body. ` +
            'Composition belongs in server_route_bootstrap.cjs.',
            file
        );
    }
}

// ---------------------------------------------------------------------------
// DEP-006
// ---------------------------------------------------------------------------

for (const file of nonRootFiles) {
    const exportedNames = new Set(getExportedNames(file.src));
    if (exportedNames.size === 0) continue;

    const exportedFactories = [...exportedNames].filter((name) =>
        /^(create|register|configure)[A-Z]/.test(name)
    );

    for (const factoryName of exportedFactories) {
        const fnInfo = file.namedFunctions.get(factoryName);
        rule(
            `DEP-006:${file.name}:${factoryName}:exists`,
            !!fnInfo,
            `${file.name}: exported factory ${factoryName} is not declared as a local function value. ` +
            'Exported DI factories must be locally declared.',
            file
        );
        if (!fnInfo) continue;
        rule(
            `DEP-006:${file.name}:${factoryName}`,
            usesArgFactorySignature(fnInfo.node),
            `${file.name}: exported factory ${factoryName} does not use arg / arg = {} signature. ` +
            'DI factories must accept a single `arg = {}` parameter.',
            file
        );
    }
}

// ---------------------------------------------------------------------------
// DEP-007
// ---------------------------------------------------------------------------

const rootFile = allServerFiles.find((f) => f.name === ROOT_FILE);
if (rootFile) {
    const installPos = rootFile.src.indexOf('installDataApiMiddleware()');
    const registerPos = rootFile.src.indexOf('registerServerRoutes(');
    rule(
        'DEP-007:server.cjs:middleware-before-routes',
        installPos !== -1 && registerPos !== -1 && installPos < registerPos,
        'server.cjs must call installDataApiMiddleware() before registerServerRoutes().' +
        (installPos === -1 ? ' (installDataApiMiddleware call not found)' : '') +
        (registerPos === -1 ? ' (registerServerRoutes call not found)' : ''),
        rootFile
    );
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const totalChecked = allFiles.length;

if (failures.length === 0) {
    console.log(`✓ check-server-deps: all contracts pass (${totalChecked} files checked)`);
    process.exit(0);
}

console.error(`\n✗ check-server-deps: ${failures.length} violation(s) found:\n`);
for (const failure of failures) {
    console.error(`  [${failure.name}]`);
    console.error(`    ${failure.details}`);
    console.error('');
}
process.exit(1);
