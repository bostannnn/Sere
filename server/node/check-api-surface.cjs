/**
 * check-api-surface.cjs
 *
 * Contract enforcer for the client ↔ server API surface boundary.
 * Scans TypeScript source in src/ts/ to verify that client code correctly
 * uses the authenticated fetch wrapper rather than raw fetch() for internal
 * endpoints.
 *
 * Rules checked:
 *   API-001  Every fetch('/data/...) call in src/ts/ (excluding serverAuth.ts
 *            which owns the auth bootstrap paths) must go through
 *            fetchWithServerAuth(), not raw fetch().
 *   API-002  No hardcoded absolute URLs to localhost or 127.0.0.1 as the target
 *            of a fetch() call in client TypeScript source. User-configurable
 *            default values (e.g. ComfyUI base URL stored in settings) are exempt
 *            because the user is expected to override them — see LOCALHOST_FETCH_RE.
 *   API-003  No direct fetch() to /data/ paths from .svelte files — must
 *            use fetchWithServerAuth() or a ts helper.
 *   API-004  fetchWithServerAuth must be defined in exactly one place
 *            (src/ts/storage/serverAuth.ts).
 *   API-005  Error responses from /data/ endpoints must be consumed via
 *            response.ok checks — no unchecked fetch().then(r => r.json())
 *            chains without an ok guard (heuristic: warn on .then(r => r.json())
 *            without .ok or response.ok nearby).
 *   API-006  No client-side import of Node.js built-in modules (path, fs, crypto, etc.)
 *            in src/ts/ — these only exist server-side.
 *
 * Calibration notes (exception rationale):
 *   API-001/auth  serverAuth.ts uses raw fetch() for auth bootstrap paths (/data/auth/*).
 *                 These must not use fetchWithServerAuth() because fetchWithServerAuth()
 *                 itself calls these paths to resolve the token. Listed in ALLOWED_RAW_FETCH_PATHS.
 *   API-002/user-config  localhost URLs in default value assignments and JSDoc comments
 *                 are exempt — they are user-configurable settings defaults that the user
 *                 is expected to change (e.g. ComfyUI at localhost:8188, llama.cpp at
 *                 localhost:10026, DeepL at localhost:1188). Only localhost URLs that appear
 *                 as the direct first argument of a fetch() call are flagged, because those
 *                 are hardcoded server addresses that would silently break on any machine
 *                 where the port differs. Pattern: LOCALHOST_FETCH_RE.
 *
 * Run:  node server/node/check-api-surface.cjs
 * Exit: 0 = all pass, 1 = violations found.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const {
    parseCheckerSuppressions,
    isRuleSuppressed,
} = require('./checker_utils.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const failures = [];
const warnings = [];

function rule(name, condition, details, file) {
    if (condition) return;
    if (file && isRuleSuppressed(name, file.suppressions)) return;
    failures.push({ name, details });
}

function warn(name, details, file) {
    if (file && isRuleSuppressed(name, file.suppressions)) return;
    warnings.push({ name, details });
}

/**
 * Recursively collect all files under dir matching the predicate.
 */
function collectFiles(dir, predicate, results = []) {
    if (!fs.existsSync(dir)) return results;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            // Skip node_modules, dist, .git
            if (['node_modules', 'dist', '.git', '.svelte-kit'].includes(entry.name)) continue;
            collectFiles(abs, predicate, results);
        } else if (entry.isFile() && predicate(entry.name)) {
            const src = fs.readFileSync(abs, 'utf-8');
            const suppressions = parseCheckerSuppressions(src);
            const rel = path.relative(path.join(__dirname, '..', '..'), abs);
            for (const bad of suppressions.invalid) {
                failures.push({
                    name: `API-SUPPRESS:${rel}:${bad.line}`,
                    details: `${bad.reason}\n    ${bad.text}`,
                });
            }
            for (const expired of suppressions.expired) {
                failures.push({
                    name: `API-SUPPRESS:${rel}:${expired.line}`,
                    details: `Expired suppression for ${expired.ruleCode} (expired ${expired.until}).\n    ${expired.text}`,
                });
            }
            results.push({ name: entry.name, abs, src, suppressions });
        }
    }
    return results;
}

/**
 * Find all occurrences of a pattern in src, returning { line, col, match } entries.
 */
function findAll(src, re) {
    const results = [];
    const lines = src.split('\n');
    for (let ln = 0; ln < lines.length; ln++) {
        const line = lines[ln];
        let m;
        const lineRe = new RegExp(re.source, re.flags.replace('g', '') + 'g');
        while ((m = lineRe.exec(line)) !== null) {
            results.push({ line: ln + 1, col: m.index + 1, match: m[0], fullLine: line.trim() });
        }
    }
    return results;
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const projectRoot = path.join(__dirname, '..', '..');
const srcTsDir = path.join(projectRoot, 'src', 'ts');
const serverAuthFile = path.join(srcTsDir, 'storage', 'serverAuth.ts');

// ---------------------------------------------------------------------------
// Collect files
// ---------------------------------------------------------------------------

const tsFiles = collectFiles(srcTsDir, name => name.endsWith('.ts') && !name.endsWith('.test.ts'));
const svelteFiles = collectFiles(path.join(projectRoot, 'src'), name => name.endsWith('.svelte'));

const tsFilesNoAuth = tsFiles.filter(f => f.abs !== serverAuthFile);

// ---------------------------------------------------------------------------
// API-001 — No raw fetch('/data/...') in client TS (except serverAuth.ts)
// ---------------------------------------------------------------------------

// Auth bootstrap paths that ARE legitimately called with raw fetch() in serverAuth.ts
const ALLOWED_RAW_FETCH_PATHS = new Set([
    '/data/auth/password/status',
    '/data/auth/crypto',
    '/data/auth/password',
    '/data/auth/password/change',
]);

for (const file of tsFilesNoAuth) {
    // Match: fetch('/data/... or fetch("/data/...
    const rawFetchMatches = findAll(file.src, /fetch\s*\(\s*['"`]\/data\//);
    for (const hit of rawFetchMatches) {
        // Check if the path is an allowed bootstrap path
        const pathMatch = hit.fullLine.match(/fetch\s*\(\s*['"`](\/data\/[^'"`\s]+)/);
        const fetchPath = pathMatch ? pathMatch[1] : '';
        const isAllowed = fetchPath && [...ALLOWED_RAW_FETCH_PATHS].some(p => fetchPath.startsWith(p));
        rule(
            `API-001:${path.relative(projectRoot, file.abs)}:${hit.line}`,
            isAllowed,
            `Raw fetch('/data/...') at line ${hit.line} in ${path.relative(projectRoot, file.abs)}. ` +
            `Use fetchWithServerAuth() instead to ensure auth token is injected.\n    Line: ${hit.fullLine}`,
            file
        );
    }
}

// ---------------------------------------------------------------------------
// API-002 — No hardcoded localhost URLs as the direct target of a fetch() call.
//            User-configurable defaults (??=, =, JSDoc) are exempt — see calibration notes.
// ---------------------------------------------------------------------------

// Only flag localhost/127.0.0.1 when it appears as the first argument of fetch().
// This catches: fetch("http://localhost:1234/path") but NOT:
//   db.comfyUiUrl ??= 'http://localhost:8188'   ← user-configurable default
//   * appendLastPath("http://127.0.0.1:7997")   ← JSDoc example comment
const LOCALHOST_FETCH_RE = /\bfetch\s*\(\s*['"`]https?:\/\/(?:localhost|127\.0\.0\.1)[:/]/;

for (const file of tsFiles) {
    const hits = findAll(file.src, LOCALHOST_FETCH_RE);
    for (const hit of hits) {
        rule(
            `API-002:${path.relative(projectRoot, file.abs)}:${hit.line}`,
            false,
            `Hardcoded localhost fetch() target at line ${hit.line} in ${path.relative(projectRoot, file.abs)}. ` +
            `fetch() calls must use relative paths (/data/...) or env-provided base URLs — ` +
            `hardcoded localhost ports silently break on other machines.\n    Line: ${hit.fullLine}`,
            file
        );
    }
}

// ---------------------------------------------------------------------------
// API-003 — No raw fetch('/data/...') in Svelte files
// ---------------------------------------------------------------------------

for (const file of svelteFiles) {
    const rawFetchMatches = findAll(file.src, /fetch\s*\(\s*['"`]\/data\//);
    for (const hit of rawFetchMatches) {
        rule(
            `API-003:${path.relative(projectRoot, file.abs)}:${hit.line}`,
            false,
            `Raw fetch('/data/...') at line ${hit.line} in ${path.relative(projectRoot, file.abs)}. ` +
            `Svelte components must use fetchWithServerAuth() (imported from storage/serverAuth.ts).\n    Line: ${hit.fullLine}`,
            file
        );
    }
}

// ---------------------------------------------------------------------------
// API-004 — fetchWithServerAuth defined in exactly one file
// ---------------------------------------------------------------------------

const definingFiles = tsFiles.filter(f =>
    /export\s+(async\s+)?function\s+fetchWithServerAuth\b/.test(f.src) ||
    /export\s+const\s+fetchWithServerAuth\s*=/.test(f.src)
);

rule(
    'API-004:fetchWithServerAuth-single-definition',
    definingFiles.length === 1,
    definingFiles.length === 0
        ? 'fetchWithServerAuth is not defined anywhere in src/ts/. It must be exported from src/ts/storage/serverAuth.ts.'
        : `fetchWithServerAuth is defined in ${definingFiles.length} files: ${definingFiles.map(f => path.relative(projectRoot, f.abs)).join(', ')}. It must exist in exactly one place.`
);

if (definingFiles.length === 1) {
    rule(
        'API-004:fetchWithServerAuth-correct-location',
        definingFiles[0].abs === serverAuthFile,
        `fetchWithServerAuth is defined in ${path.relative(projectRoot, definingFiles[0].abs)} but must be in src/ts/storage/serverAuth.ts.`
    );
}

// ---------------------------------------------------------------------------
// API-005 — Warn on unchecked .then(r => r.json()) without response.ok guard
//            (heuristic — generates warnings not failures)
// ---------------------------------------------------------------------------

const UNCHECKED_JSON_RE = /\.then\s*\(\s*(?:r|res|response)\s*=>\s*(?:r|res|response)\.json\s*\(\s*\)\s*\)/;

for (const file of [...tsFiles, ...svelteFiles]) {
    const hits = findAll(file.src, UNCHECKED_JSON_RE);
    for (const hit of hits) {
        // Check if .ok or response.ok appears in the vicinity (±5 lines)
        const lines = file.src.split('\n');
        const start = Math.max(0, hit.line - 6);
        const end = Math.min(lines.length, hit.line + 4);
        const context = lines.slice(start, end).join('\n');
        const hasOkCheck = /\.ok\b/.test(context) || /response\.ok\b/.test(context);
        if (!hasOkCheck) {
            warn(
                `API-005:${path.relative(projectRoot, file.abs)}:${hit.line}`,
                `.then(r => r.json()) at line ${hit.line} in ${path.relative(projectRoot, file.abs)} ` +
                `has no visible response.ok guard nearby. Unhandled error responses may be silently swallowed.\n    Line: ${hit.fullLine}`,
                file
            );
        }
    }
}

// ---------------------------------------------------------------------------
// API-006 — No Node.js built-in imports in client src/ts/
// ---------------------------------------------------------------------------

const NODE_BUILTINS = ['path', 'fs', 'crypto', 'os', 'child_process', 'stream', 'http', 'https', 'net', 'readline'];
const BUILTIN_IMPORT_RE = new RegExp(
    `import\\s+.*\\s+from\\s+['"\`](${NODE_BUILTINS.join('|')}|node:(${NODE_BUILTINS.join('|')}))['"\`]`
);
const REQUIRE_BUILTIN_RE = new RegExp(
    `require\\s*\\(\\s*['"\`](${NODE_BUILTINS.join('|')}|node:(${NODE_BUILTINS.join('|')}))['"\`]\\s*\\)`
);

for (const file of tsFilesNoAuth) {
    const importHits = findAll(file.src, BUILTIN_IMPORT_RE);
    const requireHits = findAll(file.src, REQUIRE_BUILTIN_RE);
    for (const hit of [...importHits, ...requireHits]) {
        rule(
            `API-006:${path.relative(projectRoot, file.abs)}:${hit.line}`,
            false,
            `Node.js built-in module imported at line ${hit.line} in ${path.relative(projectRoot, file.abs)}. ` +
            `Client-side TypeScript must not import Node.js modules.\n    Line: ${hit.fullLine}`,
            file
        );
    }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const totalChecked = tsFiles.length + svelteFiles.length;

if (failures.length === 0 && warnings.length === 0) {
    console.log(`✓ check-api-surface: all contracts pass (${totalChecked} files checked)`);
    process.exit(0);
}

if (warnings.length > 0) {
    console.warn(`\n⚠ check-api-surface: ${warnings.length} warning(s):\n`);
    for (const w of warnings) {
        console.warn(`  [${w.name}]`);
        console.warn(`    ${w.details}`);
        console.warn('');
    }
}

if (failures.length > 0) {
    console.error(`\n✗ check-api-surface: ${failures.length} violation(s) found:\n`);
    for (const f of failures) {
        console.error(`  [${f.name}]`);
        console.error(`    ${f.details}`);
        console.error('');
    }
    process.exit(1);
}

// Warnings only — exit 0 so CI doesn't block on heuristic warnings
process.exit(0);
