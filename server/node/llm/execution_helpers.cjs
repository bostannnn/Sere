function createExecutionHelpers(arg = {}) {
    const toStringOrEmpty = typeof arg.toStringOrEmpty === 'function'
        ? arg.toStringOrEmpty
        : ((value) => (typeof value === 'string' ? value.trim() : ''));
    const normalizeProvider = typeof arg.normalizeProvider === 'function'
        ? arg.normalizeProvider
        : (() => 'unknown');
    const stripThoughtBlocks = typeof arg.stripThoughtBlocks === 'function'
        ? arg.stripThoughtBlocks
        : ((text) => toStringOrEmpty(text));

    function sanitizeOutputByMode(mode, text) {
        if (typeof text !== 'string') return '';
        const normalizedMode = toStringOrEmpty(mode) || 'model';
        if (normalizedMode === 'model') {
            return text;
        }
        return stripThoughtBlocks(text);
    }

    function getGenerateMode(input) {
        return toStringOrEmpty(input?.mode) || 'model';
    }

    function resolveGenerateModelSelection(input, settings) {
        const mode = getGenerateMode(input);
        const explicitModel = toStringOrEmpty(input?.model);
        const explicitModelId = toStringOrEmpty(input?.modelId);
        const explicitProvider = toStringOrEmpty(input?.provider);

        let selectedModelId = explicitModelId;
        if (!selectedModelId) {
            selectedModelId = mode === 'model'
                ? toStringOrEmpty(settings?.aiModel)
                : toStringOrEmpty(settings?.subModel);
        }

        if (
            settings?.seperateModelsForAxModels === true &&
            mode !== 'model' &&
            mode !== 'submodel'
        ) {
            const separate = toStringOrEmpty(settings?.seperateModels?.[mode]);
            if (separate) selectedModelId = separate;
        }

        let provider = '';
        if (explicitProvider) {
            provider = normalizeProvider(explicitProvider, explicitModel || selectedModelId);
        } else if (selectedModelId === 'openrouter') {
            provider = 'openrouter';
        } else {
            provider = normalizeProvider('', selectedModelId);
        }

        let model = explicitModel;
        if (!model) {
            if (provider === 'openrouter') {
                model = mode === 'model'
                    ? toStringOrEmpty(settings?.openrouterRequestModel)
                    : (toStringOrEmpty(settings?.openrouterSubRequestModel) || toStringOrEmpty(settings?.openrouterRequestModel));
            } else {
                model = selectedModelId;
            }
        }

        return {
            mode,
            provider,
            model,
            selectedModelId,
        };
    }

    function isInternalExecutionRequest(requestBody) {
        const body = (requestBody && typeof requestBody === 'object' && !Array.isArray(requestBody)) ? requestBody : {};
        const request = (body.request && typeof body.request === 'object' && !Array.isArray(body.request)) ? body.request : {};
        const requestBodyInner = (request.requestBody && typeof request.requestBody === 'object' && !Array.isArray(request.requestBody))
            ? request.requestBody
            : {};
        return (
            body.internalNoAssembly === true ||
            request.internalNoAssembly === true ||
            requestBodyInner.internalNoAssembly === true ||
            toStringOrEmpty(request.internalTask).length > 0 ||
            toStringOrEmpty(requestBodyInner.internalTask).length > 0
        );
    }

    return {
        sanitizeOutputByMode,
        getGenerateMode,
        resolveGenerateModelSelection,
        isInternalExecutionRequest,
    };
}

module.exports = {
    createExecutionHelpers,
};
