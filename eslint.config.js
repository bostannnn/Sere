// eslint.config.js
// ESLint 9 flat config for RisuAI
// Docs: https://eslint.org/docs/latest/use/configure/configuration-files

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import sveltePlugin from "eslint-plugin-svelte";
import globals from "globals";

// ─── Global ignores (replaces .eslintignore) ──────────────────────────────────
const IGNORES = {
    ignores: [
        "node_modules/**",
        "dist/**",
        "dist-web/**",
        "dist-ssr/**",
        "src-tauri/**",
        "prototypes/**",
        "server/hono/**",   // separate sub-project with its own tsconfig
        ".claude/**",
        "**/*.local",
    ],
};

// ─── 1. TypeScript source files (src/) ───────────────────────────────────────
// Note: type-aware rules (no-floating-promises, no-misused-promises) are NOT
// enabled here because `projectService: true` causes OOM on this large codebase.
// Those rules require TypeScript to load the full type graph.
// They can be re-enabled incrementally per-file or after the codebase is
// split into smaller tsconfig projects.
const TS_CONFIG = {
    files: ["src/**/*.ts"],
    ignores: ["**/*.d.ts"],
    plugins: {
        "@typescript-eslint": tseslint.plugin,
    },
    languageOptions: {
        parser: tseslint.parser,
        parserOptions: {
            project: false,  // no type-aware linting — avoids OOM on large codebase
        },
        globals: {
            ...globals.browser,
            ...globals.es2021,
        },
    },
    rules: {
        // Base JS — turn off rules superseded by TypeScript versions
        "no-unused-vars": "off",
        "no-undef": "off",
        "no-duplicate-imports": "warn",

        // CONVENTIONS.md III.1: `any` is banned — warn so existing violations
        // are visible without blocking CI on day 1
        "@typescript-eslint/no-explicit-any": "warn",

        // Dead code
        "@typescript-eslint/no-unused-vars": [
            "warn",
            {
                argsIgnorePattern: "^_",
                varsIgnorePattern: "^_",
                ignoreRestSiblings: true,
            },
        ],

        // CONVENTIONS.md II.1: @ts-ignore / @ts-nocheck only with explanation
        "@typescript-eslint/ban-ts-comment": [
            "warn",
            {
                "ts-ignore": "allow-with-description",
                "ts-nocheck": "allow-with-description",
                "ts-expect-error": "allow-with-description",
                minimumDescriptionLength: 10,
            },
        ],

        // No console.log/warn/error in production source — use a logger or remove.
        // dev/, server/, sw.js explicitly set "no-console": "off" to override.
        "no-console": "warn",

        // Security: direct innerHTML assignment bypasses DOMPurify — flag every site.
        // Fix: use `element.textContent = value` for plain text, or
        //      `element.innerHTML = DOMPurify.sanitize(value)` for HTML.
        "no-restricted-syntax": [
            "warn",
            {
                selector: "AssignmentExpression[left.type='MemberExpression'][left.property.name='innerHTML']",
                message: "Direct innerHTML assignment is forbidden. Use textContent for plain text or DOMPurify.sanitize() for HTML. See CONVENTIONS.md §Security.",
            },
        ],
    },
};

// ─── 2. Svelte component files ────────────────────────────────────────────────
// flat/recommended has 4 entries:
//   [0] plugin registration — no files, must stay global (ok, just registers plugin)
//   [1] .svelte parser + basic rules — already scoped to *.svelte
//   [2] .svelte.ts/.svelte.js parser — already scoped to those extensions
//   [3] all Svelte rules — NO files scope (applies globally, breaks CJS files)
// We spread them and patch entry [3] to be scoped to src/ Svelte files only.
const rawRecommended = sveltePlugin.configs["flat/recommended"];
const SVELTE_RECOMMENDED_SCOPED = rawRecommended.map((entry, i) => {
    // Entry 3: global rules entry with no files scope — add explicit scoping
    if (i === 3 && !entry.files) {
        return { ...entry, files: ["src/**/*.svelte", "src/**/*.svelte.ts", "src/**/*.svelte.js"] };
    }
    return entry;
});

const SVELTE_CONFIG = [
    ...SVELTE_RECOMMENDED_SCOPED,
    {
        files: ["src/**/*.svelte"],
        plugins: {
            "@typescript-eslint": tseslint.plugin,
            svelte: sveltePlugin,
        },
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.es2021,
            },
            parser: sveltePlugin.parser,
            parserOptions: {
                parser: tseslint.parser,        // inner parser for <script lang="ts">
                project: false,                 // no type-aware linting — avoids OOM
                svelteFeatures: {
                    runes: true,                // explicit Svelte 5 runes support
                },
            },
        },
        rules: {
            // TypeScript rules apply inside <script lang="ts">
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-unused-vars": [
                "warn",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
            ],

            // Svelte-specific quality rules
            // Catches svelte-ignore comments that don't have a description
            "svelte/no-unused-svelte-ignore": "warn",
            // Catches @html usage which can be an XSS risk
            "svelte/no-at-html-tags": "warn",
            // Catches handlers that aren't functions (e.g. accidentally passing a value)
            "svelte/no-not-function-handler": "error",
            // Catches duplicate event directives
            "svelte/no-dupe-on-directives": "error",
            // Catches infinite reactive loops
            "svelte/infinite-reactive-loop": "warn",

            // Downgrade recommended errors to warnings — too many existing violations
            // to block CI on day 1. These are real issues to fix over time.
            "svelte/require-each-key": "warn",
            "svelte/no-useless-mustaches": "warn",
            "svelte/prefer-svelte-reactivity": "warn",

            // No console.log/warn/error in production source.
            "no-console": "warn",

            // Svelte 5: `let { bindable = $bindable(), nonBindable } = $props()` requires
            // `let` for the whole destructure when any prop is bindable. prefer-const
            // can't distinguish bindable vs non-bindable props in one destructure, so it
            // generates false positives for the non-bindable ones. Disable in .svelte files.
            "prefer-const": "off",

            // Security: direct innerHTML assignment in <script> blocks.
            "no-restricted-syntax": [
                "warn",
                {
                    selector: "AssignmentExpression[left.type='MemberExpression'][left.property.name='innerHTML']",
                    message: "Direct innerHTML assignment is forbidden. Use textContent for plain text or DOMPurify.sanitize() for HTML. See CONVENTIONS.md §Security.",
                },
            ],
        },
    },
];

// ─── 3. .svelte.ts rune files ─────────────────────────────────────────────────
// Files like stores.svelte.ts, globalApi.svelte.ts use $state/$effect outside
// of .svelte components. svelte-eslint-parser recognises rune globals correctly.
const SVELTE_TS_CONFIG = {
    files: ["src/**/*.svelte.ts"],
    plugins: {
        "@typescript-eslint": tseslint.plugin,
        svelte: sveltePlugin,
    },
    languageOptions: {
        globals: {
            ...globals.browser,
            ...globals.es2021,
        },
        parser: sveltePlugin.parser,
        parserOptions: {
            parser: tseslint.parser,
            project: false,             // no type-aware linting — avoids OOM
            svelteFeatures: { runes: true },
        },
    },
    rules: {
        "@typescript-eslint/no-explicit-any": "warn",
        "@typescript-eslint/no-unused-vars": [
            "warn",
            { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
        ],
        // svelte/prefer-svelte-reactivity fires on .svelte.ts files too
        "svelte/prefer-svelte-reactivity": "warn",

        // No console.log/warn/error in production source.
        "no-console": "warn",

        // Security: direct innerHTML assignment in .svelte.ts rune files.
        "no-restricted-syntax": [
            "warn",
            {
                selector: "AssignmentExpression[left.type='MemberExpression'][left.property.name='innerHTML']",
                message: "Direct innerHTML assignment is forbidden. Use textContent for plain text or DOMPurify.sanitize() for HTML. See CONVENTIONS.md §Security.",
            },
        ],
    },
};

// ─── 4. Dev / test utilities ─────────────────────────────────────────────────
// Slightly relaxed: no-explicit-any off, console allowed
const DEV_TS_CONFIG = {
    files: ["dev/**/*.ts"],
    plugins: {
        "@typescript-eslint": tseslint.plugin,
    },
    languageOptions: {
        parser: tseslint.parser,
        parserOptions: {
            // dev/ files are not in tsconfig.json's include list so we cannot
            // use projectService here — type-aware rules are disabled for dev files.
            project: false,
        },
        globals: {
            ...globals.node,
            ...globals.es2021,
        },
    },
    rules: {
        "no-unused-vars": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unused-vars": [
            "warn",
            { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
        ],
        "no-console": "off",
    },
};

// ─── 5. Dev Svelte stubs (dev/**/*.svelte) ───────────────────────────────────
// Test stubs in dev/ use <script lang="ts"> with Svelte 5 runes. They need the
// Svelte parser configured with the TypeScript inner parser, same as src/ Svelte
// files, but with relaxed rules appropriate for test utilities.
const DEV_SVELTE_CONFIG = {
    files: ["dev/**/*.svelte"],
    plugins: {
        "@typescript-eslint": tseslint.plugin,
        svelte: sveltePlugin,
    },
    languageOptions: {
        globals: {
            ...globals.browser,
            ...globals.es2021,
        },
        parser: sveltePlugin.parser,
        parserOptions: {
            parser: tseslint.parser,
            project: false,
            svelteFeatures: { runes: true },
        },
    },
    rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unused-vars": [
            "warn",
            { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
        ],
        "no-console": "off",
        // Same Svelte 5 $bindable() issue as src/ Svelte files — disable in test stubs.
        "prefer-const": "off",
    },
};

// ─── 6. Dev JS utilities (.js files in dev/) ─────────────────────────────────
const DEV_JS_CONFIG = {
    files: ["dev/**/*.js"],
    languageOptions: {
        globals: {
            ...globals.node,
            ...globals.es2021,
        },
        sourceType: "module",
    },
    rules: {
        "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
        "no-console": "off",
    },
};

// ─── 6. CommonJS server files ─────────────────────────────────────────────────
// server/node/**/*.cjs and dev/**/*.cjs use require()/module.exports.
// No TypeScript parser — plain JS linting with Node.js globals.
const CJS_CONFIG = {
    files: ["server/node/**/*.cjs", "dev/**/*.cjs"],
    languageOptions: {
        globals: {
            ...globals.node,
            ...globals.commonjs,
            ...globals.es2021,
        },
        sourceType: "commonjs",
    },
    rules: {
        "no-unused-vars": [
            "warn",
            { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
        ],
        // no-undef as warn — globals.node covers most, but custom globals may exist
        "no-undef": "warn",
        "no-console": "off",
    },
};

// ─── 7. Service worker ────────────────────────────────────────────────────────
const SW_CONFIG = {
    files: ["public/sw.js"],
    languageOptions: {
        globals: {
            ...globals.serviceworker,
            ...globals.es2021,
        },
        sourceType: "module",
    },
    rules: {
        "no-unused-vars": "warn",
        "no-undef": "off",  // ServiceWorker has non-standard globals
    },
};

// ─── Global overrides ─────────────────────────────────────────────────────────
// These override rules that come from js.configs.recommended and
// tseslint.configs.recommended that are either too noisy for this codebase
// or are already handled better by TypeScript itself.
const GLOBAL_OVERRIDES = {
    rules: {
        // TypeScript handles undefined references; no-undef causes false positives
        // on Svelte rune globals ($state, $effect, etc.) and browser globals
        "no-undef": "off",

        // prefer-const is a style preference, not a bug. The codebase uses let
        // consistently. Enforce this gradually, not as a CI gate from day 1.
        "prefer-const": "warn",

        // no-empty is overly aggressive — empty catch blocks are sometimes intentional
        "no-empty": ["warn", { allowEmptyCatch: true }],

        // require-imports fires on .cjs server files via tseslint.configs.recommended.
        // We override to off globally and only enable for TS/ESM files via TS_CONFIG.
        // (CJS_CONFIG uses sourceType:"commonjs" which should suppress this, but the
        // global tseslint rule fires first.)
        "@typescript-eslint/no-require-imports": "off",

        // no-unused-expressions fires on Svelte reactive declarations ($: expr)
        // and some intentional patterns. Warn rather than error.
        "@typescript-eslint/no-unused-expressions": "warn",

        // ban-types (Function, Object, etc.) — deprecated in newer typescript-eslint.
        // The codebase uses `Function` type in many places; downgrade to warn.
        "@typescript-eslint/ban-types": "off",
        "@typescript-eslint/no-unsafe-function-type": "warn",

        // Svelte recommended sets these as errors; too many existing violations
        // to block CI on day 1. Downgrade to warn.
        "svelte/require-each-key": "warn",
        "svelte/no-useless-mustaches": "warn",
        // prefer-svelte-reactivity (SvelteMap/SvelteSet) is opinionated — warn only
        "svelte/prefer-svelte-reactivity": "warn",
    },
};

// ─── Declaration files (.d.ts) ────────────────────────────────────────────────
// Ambient declaration files use `var` for global augmentation — this is valid.
const DECLARATION_FILES_CONFIG = {
    files: ["src/**/*.d.ts", "**/*.d.ts"],
    rules: {
        "no-var": "off",
        "@typescript-eslint/no-explicit-any": "off",  // .d.ts often needs any for interop
        "@typescript-eslint/no-unsafe-function-type": "off",
    },
};

// ─── Final export ─────────────────────────────────────────────────────────────
export default [
    IGNORES,
    js.configs.recommended,
    ...tseslint.configs.recommended,
    GLOBAL_OVERRIDES,
    DECLARATION_FILES_CONFIG,
    TS_CONFIG,
    ...SVELTE_CONFIG,
    SVELTE_TS_CONFIG,
    DEV_SVELTE_CONFIG,
    DEV_TS_CONFIG,
    DEV_JS_CONFIG,
    CJS_CONFIG,
    SW_CONFIG,
];
