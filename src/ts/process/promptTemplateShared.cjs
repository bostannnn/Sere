const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const sourcePath = path.join(__dirname, "promptTemplateShared.ts");
const sourceText = fs.readFileSync(sourcePath, "utf8");
const wrappedSource = `${sourceText.replace(/^export\s+/gm, "")}

module.exports = {
    MEMORY_PROMPT_TAG,
    MEMORY_MESSAGE_MEMO,
    getPromptTemplateFallbackTitle,
    resolvePromptTemplateBlockTitle,
    hasTemplateRangeConfig,
    normalizeTemplateRange,
    renderPromptMemoryContent,
    resolveMemoryTemplateMessages,
};
`;

const sandbox = {
    module: { exports: {} },
    exports: {},
};

vm.runInNewContext(wrappedSource, sandbox, {
    filename: sourcePath,
});

module.exports = sandbox.module.exports;
