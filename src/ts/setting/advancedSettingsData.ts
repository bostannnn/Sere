
import type { SettingItem } from './types';
import { isNodeServer } from '../platform';

export const advancedSettingsItems: SettingItem[] = [
    { type: 'header', id: 'adv.header', labelKey: 'advancedSettings', options: { level: 'h2' }, classes: 'ds-settings-renderer-no-margin-bottom' },
    { type: 'header', id: 'adv.warn', labelKey: 'advancedSettingsWarn', options: { level: 'warning' } },

    // LoreBook Settings
    {
        id: 'adv.lbDepth', type: 'number', labelKey: 'loreBookDepth', bindKey: 'loreBookDepth',
        options: { min: 0, max: 20 },
        classes: 'ds-settings-renderer-offset-md'
    },
    {
        id: 'adv.lbToken', type: 'number', labelKey: 'loreBookToken', bindKey: 'loreBookToken',
        options: { min: 0, max: 4096 }
    },
    {
        id: 'adv.autoContinueMin', type: 'number', labelKey: 'autoContinueMinTokens', bindKey: 'autoContinueMinTokens',
        options: { min: 0 }
    },

    // Prompts
    {
        id: 'adv.addPrompt', type: 'text', labelKey: 'additionalPrompt', bindKey: 'additionalPrompt',
        helpKey: 'additionalPrompt'
    },
    {
        id: 'adv.descPrefix', type: 'text', labelKey: 'descriptionPrefix', bindKey: 'descriptionPrefix'
    },
    {
        id: 'adv.keiUrl', type: 'text', fallbackLabel: 'Kei Server URL', bindKey: 'keiServerURL',
        options: { placeholder: 'Leave it blank to use default' }
    },
    {
        id: 'adv.presetChain', type: 'text', labelKey: 'presetChain', bindKey: 'presetChain',
        helpKey: 'presetChain', options: { placeholder: 'Leave it blank to not use' }
    },

    // Request Settings
    {
        id: 'adv.retries', type: 'number', labelKey: 'requestretrys', bindKey: 'requestRetrys',
        helpKey: 'requestretrys', options: { min: 0, max: 20 }
    },
    {
        id: 'adv.genTime', type: 'number', labelKey: 'genTimes', bindKey: 'genTime',
        helpKey: 'genTimes', options: { min: 0, max: 4096 }
    },
    {
        id: 'adv.assetAlloc', type: 'number', labelKey: 'assetMaxDifference', bindKey: 'assetMaxDifference'
    },

    // Vision Quality
    {
        id: 'adv.visionQual', type: 'select', fallbackLabel: 'Vision Quality', bindKey: 'gptVisionQuality',
        helpKey: 'gptVisionQuality',
        options: {
            selectOptions: [
                { value: 'low', label: 'Low' },
                { value: 'high', label: 'High' }
            ]
        }
    },

    // Height Mode
    {
        id: 'adv.heightMode', type: 'select', labelKey: 'heightMode', bindKey: 'heightMode',
        options: {
            selectOptions: [
                { value: 'normal', label: 'Normal' },
                { value: 'percent', label: 'Percent' },
                { value: 'vh', label: 'VH' },
                { value: 'dvh', label: 'DVH' },
                { value: 'svh', label: 'SVH' },
                { value: 'lvh', label: 'LVH' }
            ]
        }
    },

    // Request Location (Non-Node/Tauri)
    {
        id: 'adv.reqLoc', type: 'select', labelKey: 'requestLocation', bindKey: 'requestLocation',
        condition: () => !isNodeServer,
        options: {
            selectOptions: [
                { value: '', label: 'Default' },
                { value: 'eu', label: 'EU (GDPR)' },
                { value: 'fedramp', label: 'US (FedRAMP)' }
            ]
        }
    },

    // Toggles
    { id: 'adv.sayNothing', type: 'check', labelKey: 'sayNothing', bindKey: 'useSayNothing', helpKey: 'sayNothing', classes: 'ds-settings-renderer-offset-md' },
    { id: 'adv.showUnrec', type: 'check', labelKey: 'showUnrecommended', bindKey: 'showUnrecommended', helpKey: 'showUnrecommended', classes: 'ds-settings-renderer-offset-md' },
    { id: 'adv.imgComp', type: 'check', labelKey: 'imageCompression', bindKey: 'imageCompression', helpKey: 'imageCompression', classes: 'ds-settings-renderer-offset-md' },
    { id: 'adv.useExp', type: 'check', labelKey: 'useExperimental', bindKey: 'useExperimental', helpKey: 'useExperimental', classes: 'ds-settings-renderer-offset-md' },
    { id: 'adv.sourceMap', type: 'check', labelKey: 'sourcemapTranslate', bindKey: 'sourcemapTranslate', helpKey: 'sourcemapTranslate', classes: 'ds-settings-renderer-offset-md' },
    { id: 'adv.autoFill', type: 'check', labelKey: 'autoFillRequestURL', bindKey: 'autofillRequestUrl', helpKey: 'autoFillRequestURL', classes: 'ds-settings-renderer-offset-md' },
    { id: 'adv.autoCont', type: 'check', labelKey: 'autoContinueChat', bindKey: 'autoContinueChat', helpKey: 'autoContinueChat', classes: 'ds-settings-renderer-offset-md' },
    { id: 'adv.remIncomp', type: 'check', labelKey: 'removeIncompleteResponse', bindKey: 'removeIncompleteResponse', classes: 'ds-settings-renderer-offset-md' },
    { id: 'adv.newOai', type: 'check', labelKey: 'newOAIHandle', bindKey: 'newOAIHandle', classes: 'ds-settings-renderer-offset-md' },
    { id: 'adv.noWaitTrans', type: 'check', labelKey: 'noWaitForTranslate', bindKey: 'noWaitForTranslate', classes: 'ds-settings-renderer-offset-md' },
    { id: 'adv.newImgBeta', type: 'check', labelKey: 'newImageHandlingBeta', bindKey: 'newImageHandlingBeta', classes: 'ds-settings-renderer-offset-md' },
    { id: 'adv.allowExt', type: 'check', fallbackLabel: 'Allow all in file select', bindKey: 'allowAllExtentionFiles', classes: 'ds-settings-renderer-offset-md' },

    // Experimental Section (visible when useExperimental is true)
    {
        id: 'adv.exp.googleToken', type: 'check', labelKey: 'googleCloudTokenization', bindKey: 'googleClaudeTokenizing',
        condition: (ctx) => ctx.db.useExperimental, showExperimental: true, classes: 'ds-settings-renderer-offset-md'
    },
    {
        id: 'adv.exp.cachePoint', type: 'check', labelKey: 'automaticCachePoint', bindKey: 'automaticCachePoint',
        condition: (ctx) => ctx.db.useExperimental, helpKey: 'automaticCachePoint', showExperimental: true, classes: 'ds-settings-renderer-offset-md'
    },
    {
        id: 'adv.exp.chatComp', type: 'check', labelKey: 'experimentalChatCompression', bindKey: 'chatCompression',
        condition: (ctx) => ctx.db.useExperimental, helpKey: 'experimentalChatCompressionDesc', showExperimental: true, classes: 'ds-settings-renderer-offset-md'
    },

    // Unrecommended Section
    {
        id: 'adv.cot', type: 'check', labelKey: 'cot', bindKey: 'chainOfThought',
        condition: (ctx) => ctx.db.showUnrecommended, helpKey: 'customChainOfThought', helpUnrecommended: true, classes: 'ds-settings-renderer-offset-md'
    },

    // More Toggles
    { id: 'adv.remPunc', type: 'check', labelKey: 'removePunctuationHypa', bindKey: 'removePunctuationHypa', helpKey: 'removePunctuationHypa', classes: 'ds-settings-renderer-offset-md' },
    { id: 'adv.devTools', type: 'check', labelKey: 'enableDevTools', bindKey: 'enableDevTools', classes: 'ds-settings-renderer-offset-md' },
    { id: 'adv.scrollToActive', type: 'check', labelKey: 'enableScrollToActiveChar', bindKey: 'enableScrollToActiveChar', helpKey: 'enableScrollToActiveChar', classes: 'ds-settings-renderer-offset-md' },

    // Node/Tauri Specific
    {
        id: 'adv.promptInfo', type: 'check', labelKey: 'promptInfoInsideChat', bindKey: 'promptInfoInsideChat',
        condition: () => isNodeServer, helpKey: 'promptInfoInsideChatDesc', classes: 'ds-settings-renderer-offset-md'
    },
    {
        id: 'adv.promptTextInfo', type: 'check', labelKey: 'promptTextInfoInsideChat', bindKey: 'promptTextInfoInsideChat',
        condition: (ctx) => isNodeServer && ctx.db.promptInfoInsideChat, classes: 'ds-settings-renderer-offset-md'
    },
    {
        type: 'custom', id: 'adv.serverPassword', componentId: 'ServerPasswordSettings',
        condition: () => isNodeServer
    },

    // Dynamic Assets & Others
    { id: 'adv.dynAssets', type: 'check', labelKey: 'dynamicAssets', bindKey: 'dynamicAssets', helpKey: 'dynamicAssets', classes: 'ds-settings-renderer-offset-md' },
    { id: 'adv.cssErr', type: 'check', labelKey: 'returnCSSError', bindKey: 'returnCSSError', classes: 'ds-settings-renderer-offset-md' },
    { id: 'adv.antiOverload', type: 'check', labelKey: 'antiServerOverload', bindKey: 'antiServerOverloads', classes: 'ds-settings-renderer-offset-md' },
    { id: 'adv.bookmark', type: 'check', labelKey: 'bookmark', bindKey: 'enableBookmark', classes: 'ds-settings-renderer-offset-md' },
    { id: 'adv.tokCache', type: 'check', labelKey: 'useTokenizerCaching', bindKey: 'useTokenizerCaching', classes: 'ds-settings-renderer-offset-md' },

    // More Experimental (Condition: useExperimental)
    {
        id: 'adv.exp.googleTrans', type: 'check', fallbackLabel: 'New Google Translate Experimental', bindKey: 'useExperimentalGoogleTranslator',
        condition: (ctx) => ctx.db.useExperimental, helpKey: 'unrecommended', helpUnrecommended: true, classes: 'ds-settings-renderer-offset-md'
    },
    {
        id: 'adv.exp.claudeRet', type: 'check', labelKey: 'claudeCachingRetrival', bindKey: 'claudeRetrivalCaching',
        condition: (ctx) => ctx.db.useExperimental, helpKey: 'unrecommended', helpUnrecommended: true, classes: 'ds-settings-renderer-offset-md'
    },

    // Dynamic Assets Edit (Condition: dynamicAssets)
    {
        id: 'adv.dynAssetsEdit', type: 'check', labelKey: 'dynamicAssetsEditDisplay', bindKey: 'dynamicAssetsEditDisplay',
        condition: (ctx) => ctx.db.dynamicAssets, helpKey: 'dynamicAssetsEditDisplay', classes: 'ds-settings-renderer-offset-md'
    },

    // Unrecommended Extra (Condition: showUnrecommended)
    {
        id: 'adv.plainFetch', type: 'check', labelKey: 'forcePlainFetch', bindKey: 'usePlainFetch',
        condition: (ctx) => ctx.db.showUnrecommended, helpKey: 'forcePlainFetch', helpUnrecommended: true, classes: 'ds-settings-renderer-offset-md'
    },
    {
        id: 'adv.depTrig', type: 'check', labelKey: 'showDeprecatedTriggerV1', bindKey: 'showDeprecatedTriggerV1',
        condition: (ctx) => ctx.db.showUnrecommended, helpKey: 'unrecommended', helpUnrecommended: true, classes: 'ds-settings-renderer-offset-md'
    },

    // Custom Components
    { type: 'custom', id: 'adv.banChar', componentId: 'BanCharacterSetSettings' },
];
