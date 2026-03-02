'use strict';

const acorn = require('acorn');
const walk = require('acorn-walk');

const FUNCTION_NODE_TYPES = new Set([
    'FunctionDeclaration',
    'FunctionExpression',
    'ArrowFunctionExpression',
]);

const ROUTE_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'all', 'options']);

function parseAst(src, fileLabel = 'source') {
    try {
        const ast = acorn.parse(src, {
            ecmaVersion: 'latest',
            sourceType: 'script',
            allowHashBang: true,
            locations: true,
        });
        return { ast, error: null };
    } catch (error) {
        return {
            ast: null,
            error: `[AST] Failed to parse ${fileLabel}: ${String(error?.message || error)}`,
        };
    }
}

function evaluateStaticString(node) {
    if (!node) return null;
    if (node.type === 'Literal' && typeof node.value === 'string') {
        return node.value;
    }
    if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
        return node.quasis.map((q) => q.value.cooked ?? q.value.raw ?? '').join('');
    }
    if (node.type === 'BinaryExpression' && node.operator === '+') {
        const left = evaluateStaticString(node.left);
        const right = evaluateStaticString(node.right);
        if (typeof left === 'string' && typeof right === 'string') {
            return left + right;
        }
        return null;
    }
    return null;
}

function functionBodySourceFromNode(fnNode, src) {
    if (!fnNode || !fnNode.body) return '';
    if (fnNode.body.type === 'BlockStatement') {
        return src.slice(fnNode.body.start + 1, fnNode.body.end - 1);
    }
    return src.slice(fnNode.body.start, fnNode.body.end);
}

function collectNamedFunctions(ast, src) {
    const named = new Map();

    const addNamed = (name, fnNode) => {
        if (!name || !fnNode || !FUNCTION_NODE_TYPES.has(fnNode.type)) return;
        if (named.has(name)) return;
        named.set(name, {
            name,
            node: fnNode,
            async: !!fnNode.async,
            source: functionBodySourceFromNode(fnNode, src),
            start: fnNode.start,
            end: fnNode.end,
        });
    };

    walk.simple(ast, {
        FunctionDeclaration(node) {
            if (node.id && node.id.name) {
                addNamed(node.id.name, node);
            }
        },
        VariableDeclarator(node) {
            if (!node.id || node.id.type !== 'Identifier') return;
            if (!node.init || !FUNCTION_NODE_TYPES.has(node.init.type)) return;
            addNamed(node.id.name, node.init);
        },
    });

    return named;
}

function isAppRouteCall(node) {
    if (!node || node.type !== 'CallExpression') return false;
    const callee = node.callee;
    if (!callee || callee.type !== 'MemberExpression') return false;
    if (!callee.object || callee.object.type !== 'Identifier' || callee.object.name !== 'app') return false;
    const prop = callee.property;
    const method = callee.computed
        ? (prop && prop.type === 'Literal' ? String(prop.value || '').toLowerCase() : '')
        : (prop && prop.type === 'Identifier' ? prop.name.toLowerCase() : '');
    return ROUTE_METHODS.has(method);
}

function collectRouteRegistrations(ast) {
    const routes = [];
    walk.ancestor(ast, {
        CallExpression(node, ancestors) {
            if (!isAppRouteCall(node)) return;
            const callee = node.callee;
            const prop = callee.property;
            const method = callee.computed
                ? String(prop?.value || '').toUpperCase()
                : String(prop?.name || '').toUpperCase();
            const pathArg = node.arguments[0];
            const handlers = node.arguments.slice(1).map((argNode) => {
                if (FUNCTION_NODE_TYPES.has(argNode.type)) {
                    return { kind: 'inline', node: argNode };
                }
                if (argNode.type === 'Identifier') {
                    return { kind: 'named', name: argNode.name, node: argNode };
                }
                return { kind: 'unknown', node: argNode };
            });
            const insideFunction = ancestors.slice(0, -1).some((ancestor) => FUNCTION_NODE_TYPES.has(ancestor.type));
            routes.push({
                method,
                routePath: evaluateStaticString(pathArg),
                offset: node.start,
                line: node.loc?.start?.line || 0,
                insideFunction,
                handlers,
            });
        },
    });
    return routes;
}

function collectRouteHandlerEntries(route, namedFunctions, src) {
    const entries = [];
    const handlers = Array.isArray(route?.handlers) ? route.handlers : [];
    for (const handler of handlers) {
        if (handler.kind === 'inline') {
            entries.push({
                kind: 'inline',
                async: !!handler.node?.async,
                source: functionBodySourceFromNode(handler.node, src),
                name: null,
            });
            continue;
        }
        if (handler.kind === 'named') {
            const named = namedFunctions.get(handler.name);
            if (!named) continue;
            entries.push({
                kind: 'named',
                async: !!named.async,
                source: named.source,
                name: named.name,
                node: named.node,
            });
        }
    }
    return entries;
}

function isValidDateString(raw) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
    const date = new Date(`${raw}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return false;
    return date.toISOString().slice(0, 10) === raw;
}

function parseCheckerSuppressions(src, options = {}) {
    const today = options.today || new Date().toISOString().slice(0, 10);
    const byRule = new Map();
    const invalid = [];
    const expired = [];
    const lines = String(src || '').split('\n');
    const lineRe = /^\s*\/\/\s*checker-ignore\s+([A-Z]+-\d{3})\s+until\s+(\d{4}-\d{2}-\d{2})\s*:\s*(.+)$/;

    for (let idx = 0; idx < lines.length; idx++) {
        const line = lines[idx];
        if (!/^\s*\/\/\s*checker-ignore\b/.test(line)) continue;
        const match = line.match(lineRe);
        if (!match) {
            invalid.push({
                line: idx + 1,
                text: line.trim(),
                reason: 'Malformed suppression. Use: checker-ignore RULE-123 until YYYY-MM-DD: reason',
            });
            continue;
        }
        const ruleCode = match[1];
        const until = match[2];
        const reason = match[3].trim();
        if (!isValidDateString(until)) {
            invalid.push({
                line: idx + 1,
                text: line.trim(),
                reason: `Invalid date "${until}". Expected YYYY-MM-DD.`,
            });
            continue;
        }
        if (!reason) {
            invalid.push({
                line: idx + 1,
                text: line.trim(),
                reason: 'Suppression reason is required.',
            });
            continue;
        }
        if (until < today) {
            expired.push({
                line: idx + 1,
                text: line.trim(),
                ruleCode,
                until,
            });
            continue;
        }
        if (!byRule.has(ruleCode)) byRule.set(ruleCode, []);
        byRule.get(ruleCode).push({
            line: idx + 1,
            until,
            reason,
        });
    }

    return {
        byRule,
        invalid,
        expired,
    };
}

function isRuleSuppressed(ruleName, suppressions) {
    if (!suppressions || !suppressions.byRule) return false;
    const ruleCode = String(ruleName || '').split(':')[0];
    return suppressions.byRule.has(ruleCode);
}

module.exports = {
    parseAst,
    evaluateStaticString,
    collectNamedFunctions,
    collectRouteRegistrations,
    collectRouteHandlerEntries,
    parseCheckerSuppressions,
    isRuleSuppressed,
};
