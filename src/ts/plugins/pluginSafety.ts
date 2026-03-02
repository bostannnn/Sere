import { hasher } from '../parser.svelte';

export interface CheckResult {
    isSafe: boolean;
    errors: PluginSafetyErrors[];
    checkerVersion: number;
    modifiedCode: string;
}

type DangerousNodeType = 'CallExpression' | 'NewExpression' | 'Identifier' | 'ThisExpression';
type UserFriendlyRuleAlertKey = 'eval' | 'globalAccess' | 'thisOutsideClass' | 'errorInVerification' | 'storageAccess';

interface BlacklistRule {
    nodeType: DangerousNodeType;
    identifierName?: string;
    message: string;
    userAlertKey: UserFriendlyRuleAlertKey;
}

const SAFETY_BLACKLIST: BlacklistRule[] = [
    {
        nodeType: 'CallExpression',
        identifierName: 'eval',
        message: 'Usage of "eval()" is forbidden.',
        userAlertKey: 'eval'
    },
    {
        nodeType: 'NewExpression',
        identifierName: 'Function',
        message: 'Usage of "new Function()" is forbidden.',
        userAlertKey: 'eval'
    },
    {
        nodeType: 'CallExpression',
        identifierName: 'fetch',
        message: 'Direct network access via "fetch()" is forbidden.',
        userAlertKey: 'globalAccess'
    },
    {
        nodeType: 'CallExpression',
        identifierName: 'setTimeout',
        message: 'Usage of "setTimeout()" is forbidden.',
        userAlertKey: 'globalAccess'
    },
    {
        nodeType: 'CallExpression',
        identifierName: 'setInterval',
        message: 'Usage of "setInterval()" is forbidden.',
        userAlertKey: 'globalAccess'
    },
    {
        nodeType: 'CallExpression',
        identifierName: 'require',
        message: 'Usage of "require()" is forbidden.',
        userAlertKey: 'globalAccess'
    },
    {
        nodeType: 'Identifier',
        identifierName: 'XMLHttpRequest',
        message: 'Usage of "XMLHttpRequest" is forbidden.',
        userAlertKey: 'globalAccess'
    },
    {
        nodeType: 'Identifier',
        identifierName: 'WebSocket',
        message: 'Usage of "WebSocket" is forbidden.',
        userAlertKey: 'globalAccess'
    },
    {
        nodeType: 'Identifier',
        identifierName: 'sessionStorage',
        message: 'Access to "sessionStorage" is forbidden.',
        userAlertKey: 'storageAccess'
    },
    {
        nodeType: 'Identifier',
        identifierName: 'cookieStore',
        message: 'Access to "cookieStore" is forbidden.',
        userAlertKey: 'storageAccess'
    }
];

export type PluginSafetyErrors = {
    message: string; //message for developers
    userAlertKey: UserFriendlyRuleAlertKey; //key for user-friendly alert messages
}


// Increment this version if the safety rules change to invalidate the cache
const checkerVersion = 4;
export async function checkCodeSafety(code: string): Promise<CheckResult> {
    const errors: PluginSafetyErrors[] = [];

    const hashedCode = await hasher(new TextEncoder().encode(code));
    const cacheKey = `safety-${hashedCode}`;
    const cachedResult = localStorage.getItem(cacheKey);
    if (cachedResult) {
        const got =  JSON.parse(cachedResult) as CheckResult;
        if (got.checkerVersion === checkerVersion) {
            return got;
        }
    }

    try {
        const [acorn, walk] = await Promise.all([
            import('acorn'),
            import('acorn-walk')
        ]);

        const ast = acorn.parse(code, { ecmaVersion: 'latest' });

        const identifierReplacements = new WeakMap<object, string>();

        walk.ancestor(ast, {

            CallExpression(node) {
                if (node.callee?.type === 'Identifier') {
                    validateNode('CallExpression', node.callee.name, errors);
                }
            },
            NewExpression(node) {
                if (node.callee?.type === 'Identifier') {
                    validateNode('NewExpression', node.callee.name, errors);
                }
            },
            ImportExpression() {
                errors.push({
                    message: 'Usage of "import()" is forbidden.',
                    userAlertKey: 'globalAccess',
                });
            },

            Identifier(node) {
                const name = node.name;

                switch (name) {
                    case 'window':
                    case 'global':
                    case 'globalThis':
                    case 'self':
                    case 'top':
                    case 'parent':
                    case 'frames':
                        identifierReplacements.set(node, 'safeGlobalThis');
                        return;
                    case 'localStorage':
                        identifierReplacements.set(node, 'safeLocalStorage');
                        return;
                    case 'indexedDB':
                        identifierReplacements.set(node, 'safeIdbFactory');
                        return;
                    case 'document':
                        identifierReplacements.set(node, 'safeDocument');
                        return;
                    case 'Function':
                        identifierReplacements.set(node, 'SafeFunction');
                        return;
                    case 'prototype':
                        identifierReplacements.set(node, 'safePrototype');
                        return;
                    case 'ownerDocument':
                        identifierReplacements.set(node, 'safeOwnerDocument');
                        return;
                    case 'constructor':
                        identifierReplacements.set(node, 'safeConstructor');
                        return;
                }
                const isTarget = SAFETY_BLACKLIST.some(r => r.nodeType === 'Identifier' && r.identifierName === name);
                if (!isTarget) return;

                validateNode('Identifier', name, errors);
            }
        });
        walk.simple(ast, {
            Identifier(node) {
                const replacement = identifierReplacements.get(node);
                if (replacement) {
                    node.name = replacement;
                }
            },
        });

        const {generate} = await import('astring');
        const modifiedCode = generate(ast);
        code = modifiedCode;

    } catch (err) {
        // Handles syntax errors or import errors
        return {
            isSafe: false,
            errors: [{
                message: `Error during code verification: ${(err as Error).message}`,
                userAlertKey: 'errorInVerification'
            }],
            checkerVersion,
            modifiedCode: code
        };
    }

    localStorage.setItem(cacheKey, JSON.stringify({ isSafe: errors.length === 0, errors, checkerVersion, modifiedCode:code }));
    return { isSafe: errors.length === 0, errors, checkerVersion, modifiedCode: code};
}

function validateNode(type: DangerousNodeType, name: string | undefined, errors: PluginSafetyErrors[]) {
    const rule = SAFETY_BLACKLIST.find(r => r.nodeType === type && r.identifierName === name);
    if (rule) {
        errors.push({
            message: rule.message,
            userAlertKey: rule.userAlertKey
        });
    }
}
