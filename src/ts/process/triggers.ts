import { parseChatML } from "../parser/chatML";
import { risuChatParser } from "../parser.svelte";
import {
    getDatabase,
    resolveCharacterEntryById,
    resolveChatStateByCharacterAndChatId,
    setDatabase,
    type Chat,
    type character,
} from "../storage/database.svelte";
import { tokenize } from "../tokenizer";
import { getModuleTriggers } from "./modules";
import { get } from "svelte/store";
import { ReloadChatPointer, ReloadGUIPointer, CurrentTriggerIdStore } from "../stores.svelte";
import { processMultiCommand } from "./command";
import { parseKeyValue, sleep } from "../util";
import { alertError, alertInput, alertNormal, alertSelect } from "../alert";
import type { OpenAIChat } from "./index.svelte";
import { EmbeddingProcessor } from "./memory/embeddings";
import { requestChatData } from "./request/request";
import { runScripted } from "./scriptings";
import { calcString } from "./infunctions";
const triggerLog = (..._args: unknown[]) => {};


export interface triggerscript{
    comment: string;
    type: 'start'|'manual'|'output'|'input'|'display'|'request'
    conditions: triggerCondition[]
    effect:triggerEffect[]
    lowLevelAccess?: boolean
}

export type triggerCondition = triggerConditionsVar|triggerConditionsExists|triggerConditionsChatIndex

export type triggerEffect = triggerEffectV1|triggerCode|triggerEffectV2
export type triggerEffectV1 = triggerEffectCutChat|triggerEffectModifyChat|triggerEffectRegex|triggerEffectRunLLM|triggerEffectCheckSimilarity|triggerEffectSendAIprompt|triggerEffectShowAlert|triggerEffectSetvar|triggerEffectSystemPrompt|triggerEffectImpersonate|triggerEffectCommand|triggerEffectStop|triggerEffectRunTrigger|triggerEffectRunAxLLM
export type triggerEffectV2 =   triggerV2Header|triggerV2IfVar|triggerV2Else|triggerV2EndIndent|triggerV2SetVar|triggerV2Loop|triggerV2BreakLoop|
                                triggerV2RunTrigger|triggerV2ConsoleLog|triggerV2StopTrigger|triggerV2CutChat|triggerV2ModifyChat|triggerV2SystemPrompt|triggerV2Impersonate|
                                triggerV2Command|triggerV2SendAIprompt|triggerV2CheckSimilarity|triggerV2RunLLM|triggerV2ShowAlert|triggerV2ExtractRegex|
                                triggerV2GetLastMessage|triggerV2GetMessageAtIndex|triggerV2GetMessageCount|
                                triggerV2ModifyLorebook|triggerV2GetLorebook|triggerV2GetLorebookCount|triggerV2GetLorebookEntry|
                                triggerV2SetLorebookActivation|triggerV2GetLorebookIndexViaName|triggerV2LoopNTimes|triggerV2Random|triggerV2GetCharAt|
                                triggerV2GetCharCount|triggerV2ToLowerCase|triggerV2ToUpperCase|triggerV2SetCharAt|triggerV2SplitString|triggerV2JoinArrayVar|triggerV2GetCharacterDesc|
                                triggerV2SetCharacterDesc|triggerV2GetPersonaDesc|triggerV2SetPersonaDesc|triggerV2MakeArrayVar|triggerV2GetArrayVarLength|triggerV2GetArrayVar|triggerV2SetArrayVar|
                                triggerV2PushArrayVar|triggerV2PopArrayVar|triggerV2ShiftArrayVar|triggerV2UnshiftArrayVar|triggerV2SpliceArrayVar|triggerV2GetFirstMessage|
                                triggerV2SliceArrayVar|triggerV2GetIndexOfValueInArrayVar|triggerV2RemoveIndexFromArrayVar|triggerV2ConcatString|triggerV2GetLastUserMessage|
                                triggerV2GetLastCharMessage|triggerV2GetAlertInput|triggerV2GetAlertSelect|triggerV2GetDisplayState|triggerV2SetDisplayState|triggerV2UpdateGUI|triggerV2UpdateChatAt|triggerV2Wait|
                                triggerV2GetRequestState|triggerV2SetRequestState|triggerV2GetRequestStateRole|triggerV2SetRequestStateRole|triggerV2GetRequestStateLength|triggerV2IfAdvanced|
                                triggerV2QuickSearchChat|triggerV2StopPromptSending|triggerV2Tokenize|triggerV2GetAllLorebooks|triggerV2GetLorebookByName|triggerV2GetLorebookByIndex|
                                triggerV2CreateLorebook|triggerV2ModifyLorebookByIndex|triggerV2DeleteLorebookByIndex|triggerV2GetLorebookCountNew|triggerV2SetLorebookAlwaysActive|
                                triggerV2RegexTest|triggerV2GetReplaceGlobalNote|triggerV2SetReplaceGlobalNote|
                                triggerV2GetAuthorNote|triggerV2SetAuthorNote|triggerV2MakeDictVar|triggerV2GetDictVar|triggerV2SetDictVar|triggerV2DeleteDictKey|
                                triggerV2HasDictKey|triggerV2ClearDict|triggerV2GetDictSize|triggerV2GetDictKeys|triggerV2GetDictValues|triggerV2Calculate|triggerV2ReplaceString|triggerV2Comment|
                                triggerV2DeclareLocalVar

export type triggerConditionsVar = {
    type:'var'|'value'
    var:string
    value:string
    operator:'='|'!='|'>'|'<'|'>='|'<='|'null'|'true'
}

export type triggerCode = {
    type: 'triggercode'|'triggerlua',
    code: string
}

export type triggerConditionsChatIndex = {
    type:'chatindex'
    value:string
    operator:'='|'!='|'>'|'<'|'>='|'<='|'null'|'true'
}

export type triggerConditionsExists ={
    type: 'exists'
    value:string
    type2: 'strict'|'loose'|'regex',
    depth: number
}

export interface triggerEffectSetvar{
    type: 'setvar',
    operator: '='|'+='|'-='|'*='|'/='
    var:string
    value:string
}

export interface triggerEffectCutChat{
    type: 'cutchat',
    start: string,
    end: string
}

export interface triggerEffectModifyChat{
    type: 'modifychat',
    index: string,
    value: string
}

export interface triggerEffectSystemPrompt{
    type: 'systemprompt',
    location: 'start'|'historyend'|'promptend',
    value:string
}

export interface triggerEffectImpersonate{
    type: 'impersonate'
    role: 'user'|'char',
    value:string
}

type triggerMode = 'start'|'manual'|'output'|'input'|'display'|'request'

export interface triggerEffectCommand{
    type: 'command',
    value: string
}

export interface triggerEffectRegex{
    type: 'extractRegex',
    value: string
    regex: string
    flags: string
    result: string
    inputVar: string
}

export interface triggerEffectShowAlert{
    type: 'showAlert',
    alertType: string
    value: string
    inputVar: string
}

export interface triggerEffectRunTrigger{
    type: 'runtrigger',
    value: string
}

export interface triggerEffectStop{
    type: 'stop'
}

export interface triggerEffectSendAIprompt{
    type: 'sendAIprompt'
}

export interface triggerEffectCheckSimilarity{
    type: 'checkSimilarity',
    source: string,
    value: string,
    inputVar: string
}

export interface triggerEffectRunLLM{
    type: 'runLLM',
    value: string,
    inputVar: string
}

export interface triggerEffectRunAxLLM{
    type: 'runAxLLM',
    value: string,
    inputVar: string
}

export type additonalSysPrompt = {
    start:string,
    historyend: string,
    promptend: string
}

export type triggerV2Header = {
    type: 'v2Header',
    code?: string,
    indent: number
}

export type triggerV2IfVar = {
    type: 'v2If',
    condition: '='|'!='|'>'|'<'|'>='|'<=',
    targetType: 'var'|'value',
    target: string,
    source: string,
    indent: number
}

export type triggerV2Else = {
    type: 'v2Else'
    indent: number
}

export type triggerV2EndIndent = {
    type: 'v2EndIndent',
    endOfLoop?: boolean,
    indent: number
}

export type triggerV2SetVar = {
    type: 'v2SetVar',
    operator: '='|'+='|'-='|'*='|'/='|'%=',
    var: string,
    valueType: 'var'|'value',
    value: string,
    indent: number
}

export type triggerV2Loop = {
    type: 'v2Loop',
    indent: number
}

export type triggerV2LoopNTimes = {
    type: 'v2LoopNTimes',
    value: string,
    valueType: 'var'|'value',
    indent: number
}

export type triggerV2BreakLoop = {
    type: 'v2BreakLoop',
    indent: number
}

export type triggerV2RunTrigger = {
    type: 'v2RunTrigger',
    target: string,
    indent: number
}

export type triggerV2ConsoleLog = {
    type: 'v2ConsoleLog',
    sourceType: 'var'|'value',
    source: string,
    indent: number
}

export type triggerV2StopTrigger = {
    type: 'v2StopTrigger',
    indent: number
}

export type triggerV2CutChat = {
    type: 'v2CutChat',
    start: string,
    startType: 'var'|'value',
    end: string,
    endType: 'var'|'value',
    indent: number
}

export type triggerV2ModifyChat = {
    type: 'v2ModifyChat',
    index: string,
    indexType: 'var'|'value',
    value: string,
    valueType: 'var'|'value',
    indent: number
}

export type triggerV2SystemPrompt = {
    type: 'v2SystemPrompt',
    location: 'start'|'historyend'|'promptend',
    value: string,
    valueType: 'var'|'value',
    indent: number
}

export type triggerV2Impersonate = {
    type: 'v2Impersonate',
    role: 'user'|'char',
    value: string,
    valueType: 'var'|'value',
    indent: number
}

export type triggerV2Command = {
    type: 'v2Command',
    value: string,
    valueType: 'var'|'value',
    indent: number
}

export type triggerV2SendAIprompt = {
    type: 'v2SendAIprompt',
    indent: number
}

export type triggerV2CheckSimilarity = {
    type: 'v2CheckSimilarity',
    source: string,
    sourceType: 'var'|'value',
    value: string,
    valueType: 'var'|'value',
    outputVar: string,
    indent: number
}

export type triggerV2RunLLM = {
    type: 'v2RunLLM',
    value: string,
    valueType: 'var'|'value',
    model: 'model'|'submodel',
    outputVar: string,
    indent: number
}

export type triggerV2ShowAlert = {
    type: 'v2ShowAlert',
    value: string,
    valueType: 'var'|'value',
    indent: number
}

export type triggerV2ExtractRegex = {
    type: 'v2ExtractRegex',
    value: string,
    valueType: 'var'|'value',
    regex: string,
    regexType: 'var'|'value',
    flags: string,
    flagsType: 'var'|'value',
    result: string,
    resultType: 'var'|'value',
    outputVar: string,
    indent: number
}

export type triggerV2GetLastMessage = {
    type: 'v2GetLastMessage',
    outputVar: string,
    indent: number
}

export type triggerV2GetMessageAtIndex = {
    type: 'v2GetMessageAtIndex',
    index: string,
    indexType: 'var'|'value',
    outputVar: string,
    indent: number
}

export type triggerV2GetMessageCount = {
    type: 'v2GetMessageCount',
    outputVar: string,
    indent: number
}

export type triggerV2ModifyLorebook = {
    type: 'v2ModifyLorebook',
    target: string,
    targetType: 'var'|'value',
    value: string,
    valueType: 'var'|'value',
    indent: number
}

export type triggerV2GetLorebook = {
    type: 'v2GetLorebook',
    target: string,
    targetType: 'var'|'value',
    outputVar: string,
    indent: number
}

export type triggerV2GetLorebookCount = {
    type: 'v2GetLorebookCount',
    outputVar: string,
    indent: number
}

export type triggerV2GetLorebookEntry = {
    type: 'v2GetLorebookEntry',
    index: string,
    indexType: 'var'|'value',
    outputVar: string,
    indent: number
}

export type triggerV2SetLorebookActivation = {
    type: 'v2SetLorebookActivation',
    index: string,
    indexType: 'var'|'value',
    value: boolean,
    indent: number
}

export type triggerV2GetLorebookIndexViaName = {
    type: 'v2GetLorebookIndexViaName',
    name: string,
    nameType: 'var'|'value',
    outputVar: string,
    indent: number
}

export type triggerV2Random = {
    type: 'v2Random',
    min: string,
    minType: 'var'|'value',
    max: string,
    maxType: 'var'|'value',
    outputVar: string,
    indent: number
}

export type triggerV2GetCharAt = {
    type: 'v2GetCharAt',
    source: string,
    sourceType: 'var'|'value',
    index: string,
    indexType: 'var'|'value',
    outputVar: string,
    indent: number
}

export type triggerV2GetCharCount = {
    type: 'v2GetCharCount',
    source: string,
    sourceType: 'var'|'value',
    outputVar: string,
    indent: number
}

export type triggerV2ToLowerCase = {
    type: 'v2ToLowerCase',
    source: string,
    sourceType: 'var'|'value',
    outputVar: string,
    indent: number
}

export type triggerV2ToUpperCase = {
    type: 'v2ToUpperCase',
    source: string,
    sourceType: 'var'|'value',
    outputVar: string,
    indent: number
}

export type triggerV2SetCharAt = {
    type: 'v2SetCharAt',
    source: string,
    sourceType: 'var'|'value',
    index: string,
    indexType: 'var'|'value',
    value: string,
    valueType: 'var'|'value',
    outputVar: string,
    indent: number
}

export type triggerV2SplitString = {
    type: 'v2SplitString',
    source: string,
    sourceType: 'var'|'value',
    delimiter: string,
    delimiterType: 'var'|'value'|'regex',
    outputVar: string,
    indent: number
}

export type triggerV2JoinArrayVar = {
    type: 'v2JoinArrayVar',
    var: string,
    varType: 'var'|'value',
    delimiter: string,
    delimiterType: 'var'|'value',
    outputVar: string,
    indent: number
}

export type triggerV2GetCharacterDesc = {
    type: 'v2GetCharacterDesc',
    outputVar: string,
    indent: number
}

export type triggerV2SetCharacterDesc = {
    type: 'v2SetCharacterDesc',
    value: string,
    valueType: 'var'|'value',
    indent: number
}

export type triggerV2GetPersonaDesc = {
    type: 'v2GetPersonaDesc',
    outputVar: string,
    indent: number
}

export type triggerV2SetPersonaDesc = {
    type: 'v2SetPersonaDesc',
    value: string,
    valueType: 'var'|'value',
    indent: number
}

export type triggerV2MakeArrayVar = {
    type: 'v2MakeArrayVar',
    var: string,
    indent: number
}

export type triggerV2GetArrayVarLength = {
    type: 'v2GetArrayVarLength',
    var: string,
    outputVar: string,
    indent: number
}

export type triggerV2GetArrayVar = {
    type: 'v2GetArrayVar',
    var: string,
    index: string,
    indexType: 'var'|'value',
    outputVar: string,
    indent: number
}

export type triggerV2SetArrayVar = {
    type: 'v2SetArrayVar',
    var: string,
    index: string,
    indexType: 'var'|'value',
    value: string,
    valueType: 'var'|'value',
    indent: number
}

export type triggerV2PushArrayVar = {
    type: 'v2PushArrayVar',
    var: string,
    value: string,
    valueType: 'var'|'value',
    indent: number
}

export type triggerV2PopArrayVar = {
    type: 'v2PopArrayVar',
    var: string,
    outputVar: string,
    indent: number
}

export type triggerV2ShiftArrayVar = {
    type: 'v2ShiftArrayVar',
    var: string,
    outputVar: string,
    indent: number
}

export type triggerV2UnshiftArrayVar = {
    type: 'v2UnshiftArrayVar',
    var: string,
    value: string,
    valueType: 'var'|'value',
    indent: number
}

export type triggerV2SpliceArrayVar = {
    type: 'v2SpliceArrayVar',
    var: string,
    start: string,
    startType: 'var'|'value',
    item: string,
    itemType: 'var'|'value',
    indent: number
}

export type triggerV2SliceArrayVar = {
    type: 'v2SliceArrayVar',
    var: string,
    start: string,
    startType: 'var'|'value',
    end: string,
    endType: 'var'|'value',
    outputVar: string,
    indent: number
}

export type triggerV2GetIndexOfValueInArrayVar = {
    type: 'v2GetIndexOfValueInArrayVar',
    var: string,
    value: string,
    valueType: 'var'|'value',
    outputVar: string,
    indent: number
}

export type triggerV2RemoveIndexFromArrayVar = {
    type: 'v2RemoveIndexFromArrayVar',
    var: string,
    index: string,
    indexType: 'var'|'value',
    indent: number
}

export type triggerV2ConcatString = {
    type: 'v2ConcatString',
    source1: string,
    source1Type: 'var'|'value',
    source2: string,
    source2Type: 'var'|'value',
    outputVar: string,
    indent: number
}

export type triggerV2GetLastUserMessage = {
    type: 'v2GetLastUserMessage',
    outputVar: string,
    indent: number
}

export type triggerV2GetLastCharMessage = {
    type: 'v2GetLastCharMessage',
    outputVar: string,
    indent: number
}

export type triggerV2GetFirstMessage = {
    type: 'v2GetFirstMessage',
    outputVar: string,
    indent: number
}

export type triggerV2GetAlertInput = {
    type: 'v2GetAlertInput',
    display: string,
    displayType: 'var'|'value',
    outputVar: string,
    indent: number
}

export type triggerV2GetDisplayState = {
    type: 'v2GetDisplayState',
    outputVar: string,
    indent: number
}

export type triggerV2SetDisplayState = {
    type: 'v2SetDisplayState',
    value: string,
    valueType: 'var'|'value',
    indent: number
}

export type triggerV2GetRequestState = {
    type: 'v2GetRequestState',
    outputVar: string,
    index: string,
    indexType: 'var'|'value',
    indent: number
}

export type triggerV2GetRequestStateRole = {
    type: 'v2GetRequestStateRole',
    outputVar: string,
    index: string,
    indexType: 'var'|'value',
    indent: number
}

export type triggerV2SetRequestState = {
    type: 'v2SetRequestState',
    value: string,
    valueType: 'var'|'value',
    index: string,
    indexType: 'var'|'value',
    indent: number
}

export type triggerV2SetRequestStateRole = {
    type: 'v2SetRequestStateRole',
    value: string,
    valueType: 'var'|'value',
    index: string,
    indexType: 'var'|'value',
    indent: number
}

export type triggerV2GetRequestStateLength = {
    type: 'v2GetRequestStateLength',
    outputVar: string,
    indent: number
}

export type triggerV2UpdateGUI = {
    type: 'v2UpdateGUI',
    indent: number
}

export type triggerV2UpdateChatAt = {
    type: 'v2UpdateChatAt',
    index: string,
    indent: number
}

export type triggerV2Wait = {
    type: 'v2Wait',
    value: string,
    valueType: 'var'|'value',
    indent: number
}

export type triggerV2IfAdvanced = {
    type: 'v2IfAdvanced',
    condition: '='|'!='|'>'|'<'|'>='|'<='|'≒'|'∋'|'∈'|'∌'|'∉'|'≡'
    targetType: 'var'|'value',
    target: string,
    sourceType: 'var'|'value',
    source: string,
    indent: number
}

export type triggerV2QuickSearchChat = {
    type: 'v2QuickSearchChat',
    value: string,
    valueType: 'var'|'value',
    condition: 'loose'|'strict'|'regex',
    depth: string,
    depthType: 'var'|'value',
    outputVar: string,
    indent: number
}

export type triggerV2StopPromptSending = {
    type: 'v2StopPromptSending',
    indent: number
}

export type triggerV2Tokenize = {
    type: 'v2Tokenize',
    indent: number,
    value: string
    valueType: "var"|"value"
    outputVar:string
}

export type triggerV2GetAllLorebooks = {
    type: 'v2GetAllLorebooks',
    outputVar: string,
    indent: number
}
export type triggerV2RegexTest = {
    type: 'v2RegexTest',
    value: string,
    valueType: 'var'|'value',
    regex: string,
    regexType: 'var'|'value',
    flags: string,
    flagsType: 'var'|'value',
    outputVar: string,
    indent: number
}

export type triggerV2GetLorebookByName = {
    type: 'v2GetLorebookByName',
    name: string,
    nameType: 'var'|'value',
    outputVar: string,
    indent: number
}

export type triggerV2GetLorebookByIndex = {
    type: 'v2GetLorebookByIndex',
    index: string,
    indexType: 'var'|'value',
    outputVar: string,
    indent: number
}

export type triggerV2CreateLorebook = {
    type: 'v2CreateLorebook',
    name: string,
    nameType: 'var'|'value',
    key: string,
    keyType: 'var'|'value',
    content: string,
    contentType: 'var'|'value',
    insertOrder: string,
    insertOrderType: 'var'|'value',
    indent: number
}

export type triggerV2ModifyLorebookByIndex = {
    type: 'v2ModifyLorebookByIndex',
    index: string,
    indexType: 'var'|'value',
    name: string,
    nameType: 'var'|'value',
    key: string,
    keyType: 'var'|'value',
    content: string,
    contentType: 'var'|'value',
    insertOrder: string,
    insertOrderType: 'var'|'value',
    indent: number
}

export type triggerV2DeleteLorebookByIndex = {
    type: 'v2DeleteLorebookByIndex',
    index: string,
    indexType: 'var'|'value',
    indent: number
}

export type triggerV2GetLorebookCountNew = {
    type: 'v2GetLorebookCountNew',
    outputVar: string,
    indent: number
}

export type triggerV2SetLorebookAlwaysActive = {
    type: 'v2SetLorebookAlwaysActive',
    index: string,
    indexType: 'var'|'value',
    value: boolean,
    indent: number
}

export type triggerV2GetAlertSelect = {
    type: 'v2GetAlertSelect',
    display: string,
    displayType: 'var'|'value',
    value: string,
    valueType: 'var'|'value',
    outputVar: string,
    indent: number
}

export type triggerV2GetReplaceGlobalNote = {
    type: 'v2GetReplaceGlobalNote',
    outputVar: string,
    indent: number
}

export type triggerV2SetReplaceGlobalNote = {
    type: 'v2SetReplaceGlobalNote',
    value: string,
    valueType: 'var'|'value',
    indent: number
}

export type triggerV2GetAuthorNote = {
    type: 'v2GetAuthorNote',
    outputVar: string,
    indent: number
}

export type triggerV2SetAuthorNote = {
    type: 'v2SetAuthorNote',
    value: string,
    valueType: 'var'|'value',
    indent: number
}

export type triggerV2MakeDictVar = {
    type: 'v2MakeDictVar',
    var: string,
    indent: number
}

export type triggerV2GetDictVar = {
    type: 'v2GetDictVar',
    var: string,
    varType: 'var'|'value',
    key: string,
    keyType: 'var'|'value',
    outputVar: string,
    indent: number
}

export type triggerV2SetDictVar = {
    type: 'v2SetDictVar',
    var: string,
    varType: 'var'|'value',
    key: string,
    keyType: 'var'|'value',
    value: string,
    valueType: 'var'|'value',
    indent: number
}

export type triggerV2DeleteDictKey = {
    type: 'v2DeleteDictKey',
    var: string,
    varType: 'var'|'value',
    key: string,
    keyType: 'var'|'value',
    indent: number
}

export type triggerV2HasDictKey = {
    type: 'v2HasDictKey',
    var: string,
    varType: 'var'|'value',
    key: string,
    keyType: 'var'|'value',
    outputVar: string,
    indent: number
}

export type triggerV2ClearDict = {
    type: 'v2ClearDict',
    var: string,
    indent: number
}

export type triggerV2GetDictSize = {
    type: 'v2GetDictSize',
    var: string,
    varType: 'var'|'value',
    outputVar: string,
    indent: number
}

export type triggerV2GetDictKeys = {
    type: 'v2GetDictKeys',
    var: string,
    varType: 'var'|'value',
    outputVar: string,
    indent: number
}

export type triggerV2GetDictValues = {
    type: 'v2GetDictValues',
    var: string,
    varType: 'var'|'value',
    outputVar: string,
    indent: number
}

export type triggerV2Calculate = {
    type: 'v2Calculate',
    expression: string,
    expressionType: 'var'|'value',
    outputVar: string,
    indent: number
}

export type triggerV2ReplaceString = {
    type: 'v2ReplaceString',
    source: string,
    sourceType: 'var'|'value',
    regex: string,
    regexType: 'var'|'value',
    result: string,
    resultType: 'var'|'value',
    replacement: string,
    replacementType: 'var'|'value',
    flags: string,
    flagsType: 'var'|'value',
    outputVar: string,
    indent: number
}

export type triggerV2Comment = {
    type: 'v2Comment',
    value: string,
    indent: number
}

export type triggerV2DeclareLocalVar = {
    type: 'v2DeclareLocalVar',
    var: string,
    value: string,
    valueType: 'var'|'value',
    indent: number
}

export type RunTriggerArg = {
    chat: Chat,
    recursiveCount?: number
    additonalSysPrompt?: additonalSysPrompt
    stopSending?: boolean
    manualName?: string
    triggerId?: string
    displayMode?: boolean
    displayData?: string
    tempVars?: Record<string, string | number>
}

export type TriggerV2EffectType = triggerEffectV2['type']
export type TriggerV2SelectableType = Exclude<TriggerV2EffectType, 'v2Header' | 'v2Else' | 'v2EndIndent'>
export type TriggerV2EffectByType<T extends TriggerV2EffectType> = Extract<triggerEffectV2, { type: T }>

const triggerV2CategoryOrder = [
    'Special',
    'Control',
    'Chat',
    'Low Level',
    'Alert',
    'Lorebook V2',
    'String',
    'Data',
    'Array',
    'Dictionary',
    'Others',
    'Deprecated'
] as const

export type TriggerV2Category = typeof triggerV2CategoryOrder[number]
export type TriggerV2EditorFieldKind = 'text' | 'textarea' | 'select' | 'checkbox'
export type TriggerV2EditorOption = {
    value: string | number
    label: string
}

export type TriggerV2EditorContext = {
    triggers: triggerscript[]
}

type TriggerV2EditorLabel<T extends TriggerV2EffectType> = string | ((effect: TriggerV2EffectByType<T>) => string)
type TriggerV2EditorOptions<T extends TriggerV2EffectType> =
    readonly TriggerV2EditorOption[]
    | ((effect: TriggerV2EffectByType<T>, context: TriggerV2EditorContext) => readonly TriggerV2EditorOption[])
type TriggerV2EditorKey<T extends TriggerV2EffectType> = keyof TriggerV2EffectByType<T> & string

export type TriggerV2EditorConfig<T extends TriggerV2EffectType> = {
    fieldOrder?: readonly TriggerV2EditorKey<T>[]
    textareaFields?: readonly TriggerV2EditorKey<T>[]
    highlightFields?: readonly TriggerV2EditorKey<T>[]
    labelOverrides?: Partial<Record<TriggerV2EditorKey<T>, TriggerV2EditorLabel<T>>>
    checkboxLabels?: Partial<Record<TriggerV2EditorKey<T>, TriggerV2EditorLabel<T>>>
    helpKeys?: Partial<Record<TriggerV2EditorKey<T>, string>>
    fieldKinds?: Partial<Record<TriggerV2EditorKey<T>, TriggerV2EditorFieldKind | ((effect: TriggerV2EffectByType<T>) => TriggerV2EditorFieldKind)>>
    fieldOptions?: Partial<Record<TriggerV2EditorKey<T>, TriggerV2EditorOptions<T>>>
    visibility?: Partial<Record<TriggerV2EditorKey<T>, (effect: TriggerV2EffectByType<T>) => boolean>>
    postChange?: Partial<Record<TriggerV2EditorKey<T>, (effect: TriggerV2EffectByType<T>, value: string | boolean) => void>>
    showAddElse?: boolean
}

type TriggerV2RuntimeState = {
    chat: Chat
    additonalSysPrompt: additonalSysPrompt
    stopSending: boolean
    sendAIprompt: boolean
    currentIndent: number
    index: number
    displayData?: string
    tempVars: Record<string, string | number>
}

type TriggerV2RuntimeControl = void | { abortRun: true }

type TriggerV2RuntimeContext = {
    char: character
    mode: triggerMode
    trigger: triggerscript
    arg: RunTriggerArg
    state: TriggerV2RuntimeState
    getVar: (key: string) => string
    setVar: (key: string, value: string) => void
    declareLocalVar: (key: string, value: string, indent: number) => void
    clearLocalVarsAtIndent: (indent: number) => void
    resolveTargetCharacter: () => ReturnType<typeof resolveCharacterEntryById> | null
    resolveTargetChat: () => Chat | null
}

type TriggerV2RuntimeHandler<T extends TriggerV2EffectType> = (
    effect: TriggerV2EffectByType<T>,
    context: TriggerV2RuntimeContext
) => Promise<TriggerV2RuntimeControl> | TriggerV2RuntimeControl

export type TriggerV2Definition<T extends TriggerV2EffectType> = {
    type: T
    category?: TriggerV2Category
    labelKey?: string
    descriptionKey?: string
    deprecated?: boolean
    special?: boolean
    lowLevel?: boolean
    displayAllowed?: boolean
    requestAllowed?: boolean
    selectable?: boolean
    opensBlock?: boolean
    loopBlock?: boolean
    allowElse?: boolean
    createDefault?: () => TriggerV2EffectByType<T>
    editor?: TriggerV2EditorConfig<T>
    run?: TriggerV2RuntimeHandler<T>
}

type TriggerV2Registry = {
    [K in TriggerV2EffectType]: TriggerV2Definition<K>
}

const defineTriggerV2 = <T extends TriggerV2EffectType>(
    type: T,
    definition: Omit<TriggerV2Definition<T>, 'type'>
): TriggerV2Definition<T> => ({
    type,
    labelKey: type,
    descriptionKey: `${type}Desc`,
    ...definition
})

const option = (value: string | number, label: string): TriggerV2EditorOption => ({ value, label })

const valueVarOptions = [
    option('value', 'value'),
    option('var', 'var')
] as const

const valueVarRegexOptions = [
    ...valueVarOptions,
    option('regex', 'regex')
] as const

const operatorOptions = [
    option('=', 'operatorSet'),
    option('+=', 'operatorAdd'),
    option('-=', 'operatorSubtract'),
    option('*=', 'operatorMultiply'),
    option('/=', 'operatorDivide'),
    option('%=', 'operatorModulo')
] as const

const ifConditionOptions = [
    option('=', 'conditionEqual'),
    option('!=', 'conditionNotEqual'),
    option('>', 'conditionGreater'),
    option('<', 'conditionLess'),
    option('>=', 'conditionGreaterEqual'),
    option('<=', 'conditionLessEqual')
] as const

const advancedIfConditionOptions = [
    ...ifConditionOptions,
    option('≒', 'conditionSimilar'),
    option('∋', 'conditionContains'),
    option('∈', 'conditionIn'),
    option('∌', 'conditionNotContains'),
    option('∉', 'conditionNotIn'),
    option('≡', 'conditionTruthy')
] as const

const truthyTargetOptions = [
    option('true', 'boolTrue'),
    option('false', 'boolFalse'),
    option('null', 'boolNull')
] as const

const systemPromptLocationOptions = [
    option('start', 'sysStart'),
    option('historyend', 'sysHistoryEnd'),
    option('promptend', 'sysPromptEnd')
] as const

const impersonateRoleOptions = [
    option('user', 'roleUser'),
    option('char', 'roleChar')
] as const

const modelOptions = [
    option('model', 'modelMain'),
    option('submodel', 'modelSub')
] as const

const quickSearchConditionOptions = [
    option('loose', 'searchLoose'),
    option('strict', 'searchStrict'),
    option('regex', 'searchRegex')
] as const

const safeInDisplayAndRequest = {
    displayAllowed: true,
    requestAllowed: true
} as const

const displayOnly = {
    displayAllowed: true
} as const

const requestOnly = {
    requestAllowed: true
} as const

const isTriggerV2TruthyCondition = (effect: triggerV2IfAdvanced) => effect.condition === '≡'

const triggerV2Registry: TriggerV2Registry = {
    v2Header: defineTriggerV2('v2Header', {
        selectable: false
    }),
    v2If: defineTriggerV2('v2If', {
        ...safeInDisplayAndRequest,
        category: 'Deprecated',
        deprecated: true,
        opensBlock: true,
        allowElse: true,
        createDefault: () => ({
            type: 'v2If',
            source: '',
            condition: '=',
            targetType: 'value',
            target: '',
            indent: 0
        }),
        editor: {
            labelOverrides: {
                source: 'varName',
                target: 'value'
            },
            fieldKinds: {
                condition: 'select'
            },
            fieldOptions: {
                condition: ifConditionOptions
            },
            showAddElse: true
        }
    }),
    v2Else: defineTriggerV2('v2Else', {
        ...safeInDisplayAndRequest,
        selectable: false,
        opensBlock: true
    }),
    v2EndIndent: defineTriggerV2('v2EndIndent', {
        ...safeInDisplayAndRequest,
        selectable: false
    }),
    v2SetVar: defineTriggerV2('v2SetVar', {
        ...safeInDisplayAndRequest,
        category: 'Control',
        createDefault: () => ({
            type: 'v2SetVar',
            var: '',
            operator: '=',
            valueType: 'value',
            value: '',
            indent: 0
        }),
        editor: {
            textareaFields: ['value'],
            highlightFields: ['value'],
            labelOverrides: {
                var: 'varName'
            },
            fieldKinds: {
                operator: 'select'
            },
            fieldOptions: {
                operator: operatorOptions
            }
        }
    }),
    v2Loop: defineTriggerV2('v2Loop', {
        category: 'Control',
        opensBlock: true,
        loopBlock: true,
        createDefault: () => ({
            type: 'v2Loop',
            indent: 0
        })
    }),
    v2BreakLoop: defineTriggerV2('v2BreakLoop', {
        ...safeInDisplayAndRequest,
        category: 'Control',
        createDefault: () => ({
            type: 'v2BreakLoop',
            indent: 0
        })
    }),
    v2RunTrigger: defineTriggerV2('v2RunTrigger', {
        category: 'Control',
        createDefault: () => ({
            type: 'v2RunTrigger',
            target: '',
            indent: 0
        }),
        editor: {
            labelOverrides: {
                target: 'trigger'
            },
            fieldKinds: {
                target: 'select'
            },
            fieldOptions: {
                target: (_effect, context) =>
                    context.triggers
                        .slice(1)
                        .map((trigger) => option(trigger.comment, trigger.comment || 'Unnamed Trigger'))
            }
        }
    }),
    v2ConsoleLog: defineTriggerV2('v2ConsoleLog', {
        ...safeInDisplayAndRequest,
        category: 'Control',
        createDefault: () => ({
            type: 'v2ConsoleLog',
            sourceType: 'value',
            source: '',
            indent: 0
        }),
        editor: {
            labelOverrides: {
                source: 'value'
            }
        }
    }),
    v2StopTrigger: defineTriggerV2('v2StopTrigger', {
        ...safeInDisplayAndRequest,
        category: 'Control',
        createDefault: () => ({
            type: 'v2StopTrigger',
            indent: 0
        })
    }),
    v2CutChat: defineTriggerV2('v2CutChat', {
        category: 'Chat',
        createDefault: () => ({
            type: 'v2CutChat',
            startType: 'value',
            start: '0',
            endType: 'value',
            end: '0',
            indent: 0
        })
    }),
    v2ModifyChat: defineTriggerV2('v2ModifyChat', {
        category: 'Chat',
        createDefault: () => ({
            type: 'v2ModifyChat',
            indexType: 'value',
            index: '',
            valueType: 'value',
            value: '',
            indent: 0
        }),
        editor: {
            textareaFields: ['value'],
            highlightFields: ['value']
        }
    }),
    v2SystemPrompt: defineTriggerV2('v2SystemPrompt', {
        category: 'Others',
        createDefault: () => ({
            type: 'v2SystemPrompt',
            location: 'start',
            valueType: 'value',
            value: '',
            indent: 0
        }),
        editor: {
            textareaFields: ['value'],
            highlightFields: ['value'],
            fieldKinds: {
                location: 'select'
            },
            fieldOptions: {
                location: systemPromptLocationOptions
            }
        }
    }),
    v2Impersonate: defineTriggerV2('v2Impersonate', {
        category: 'Chat',
        createDefault: () => ({
            type: 'v2Impersonate',
            role: 'user',
            valueType: 'value',
            value: '',
            indent: 0
        }),
        editor: {
            textareaFields: ['value'],
            highlightFields: ['value'],
            fieldKinds: {
                role: 'select'
            },
            fieldOptions: {
                role: impersonateRoleOptions
            }
        }
    }),
    v2Command: defineTriggerV2('v2Command', {
        category: 'Control',
        createDefault: () => ({
            type: 'v2Command',
            valueType: 'value',
            value: '',
            indent: 0
        }),
        editor: {
            labelOverrides: {
                value: 'cmd'
            }
        }
    }),
    v2SendAIprompt: defineTriggerV2('v2SendAIprompt', {
        category: 'Low Level',
        lowLevel: true,
        createDefault: () => ({
            type: 'v2SendAIprompt',
            indent: 0
        })
    }),
    v2CheckSimilarity: defineTriggerV2('v2CheckSimilarity', {
        category: 'Low Level',
        lowLevel: true,
        createDefault: () => ({
            type: 'v2CheckSimilarity',
            sourceType: 'value',
            source: '',
            valueType: 'value',
            value: '',
            outputVar: '',
            indent: 0
        })
    }),
    v2RunLLM: defineTriggerV2('v2RunLLM', {
        category: 'Low Level',
        lowLevel: true,
        createDefault: () => ({
            type: 'v2RunLLM',
            valueType: 'value',
            value: '',
            model: 'model',
            outputVar: '',
            indent: 0
        }),
        editor: {
            textareaFields: ['value'],
            highlightFields: ['value'],
            labelOverrides: {
                value: 'prompt'
            },
            fieldKinds: {
                model: 'select'
            },
            fieldOptions: {
                model: modelOptions
            }
        }
    }),
    v2ShowAlert: defineTriggerV2('v2ShowAlert', {
        category: 'Alert',
        createDefault: () => ({
            type: 'v2ShowAlert',
            valueType: 'value',
            value: '',
            indent: 0
        }),
        editor: {
            labelOverrides: {
                value: 'alertContent'
            }
        }
    }),
    v2ExtractRegex: defineTriggerV2('v2ExtractRegex', {
        ...safeInDisplayAndRequest,
        category: 'String',
        createDefault: () => ({
            type: 'v2ExtractRegex',
            valueType: 'value',
            value: '',
            regexType: 'value',
            regex: '',
            resultType: 'value',
            result: '',
            flagsType: 'value',
            flags: '',
            outputVar: '',
            indent: 0
        }),
        editor: {
            labelOverrides: {
                value: 'source',
                result: 'resultFormat'
            }
        }
    }),
    v2GetLastMessage: defineTriggerV2('v2GetLastMessage', {
        category: 'Chat',
        createDefault: () => ({
            type: 'v2GetLastMessage',
            outputVar: '',
            indent: 0
        })
    }),
    v2GetMessageAtIndex: defineTriggerV2('v2GetMessageAtIndex', {
        category: 'Chat',
        createDefault: () => ({
            type: 'v2GetMessageAtIndex',
            indexType: 'value',
            index: '',
            outputVar: '',
            indent: 0
        })
    }),
    v2GetMessageCount: defineTriggerV2('v2GetMessageCount', {
        category: 'Chat',
        createDefault: () => ({
            type: 'v2GetMessageCount',
            outputVar: '',
            indent: 0
        })
    }),
    v2ModifyLorebook: defineTriggerV2('v2ModifyLorebook', {
        category: 'Deprecated',
        deprecated: true,
        createDefault: () => ({
            type: 'v2ModifyLorebook',
            targetType: 'value',
            target: '',
            valueType: 'value',
            value: '',
            indent: 0
        })
    }),
    v2GetLorebook: defineTriggerV2('v2GetLorebook', {
        category: 'Deprecated',
        deprecated: true,
        createDefault: () => ({
            type: 'v2GetLorebook',
            targetType: 'value',
            target: '',
            outputVar: '',
            indent: 0
        })
    }),
    v2GetLorebookCount: defineTriggerV2('v2GetLorebookCount', {
        category: 'Deprecated',
        deprecated: true,
        createDefault: () => ({
            type: 'v2GetLorebookCount',
            outputVar: '',
            indent: 0
        })
    }),
    v2GetLorebookEntry: defineTriggerV2('v2GetLorebookEntry', {
        category: 'Deprecated',
        deprecated: true,
        createDefault: () => ({
            type: 'v2GetLorebookEntry',
            indexType: 'value',
            index: '',
            outputVar: '',
            indent: 0
        })
    }),
    v2SetLorebookActivation: defineTriggerV2('v2SetLorebookActivation', {
        category: 'Deprecated',
        deprecated: true,
        createDefault: () => ({
            type: 'v2SetLorebookActivation',
            indexType: 'value',
            index: '',
            value: true,
            indent: 0
        }),
        editor: {
            checkboxLabels: {
                value: 'alwaysActive'
            }
        }
    }),
    v2GetLorebookIndexViaName: defineTriggerV2('v2GetLorebookIndexViaName', {
        category: 'Deprecated',
        deprecated: true,
        createDefault: () => ({
            type: 'v2GetLorebookIndexViaName',
            nameType: 'value',
            name: '',
            outputVar: '',
            indent: 0
        })
    }),
    v2LoopNTimes: defineTriggerV2('v2LoopNTimes', {
        ...safeInDisplayAndRequest,
        category: 'Control',
        opensBlock: true,
        loopBlock: true,
        createDefault: () => ({
            type: 'v2LoopNTimes',
            valueType: 'value',
            value: '',
            indent: 0
        })
    }),
    v2Random: defineTriggerV2('v2Random', {
        ...safeInDisplayAndRequest,
        category: 'Others',
        createDefault: () => ({
            type: 'v2Random',
            minType: 'value',
            min: '0',
            maxType: 'value',
            max: '100',
            outputVar: '',
            indent: 0
        })
    }),
    v2GetCharAt: defineTriggerV2('v2GetCharAt', {
        ...safeInDisplayAndRequest,
        category: 'String',
        createDefault: () => ({
            type: 'v2GetCharAt',
            sourceType: 'value',
            source: '',
            indexType: 'value',
            index: '',
            outputVar: '',
            indent: 0
        })
    }),
    v2GetCharCount: defineTriggerV2('v2GetCharCount', {
        ...safeInDisplayAndRequest,
        category: 'String',
        createDefault: () => ({
            type: 'v2GetCharCount',
            sourceType: 'value',
            source: '',
            outputVar: '',
            indent: 0
        })
    }),
    v2ToLowerCase: defineTriggerV2('v2ToLowerCase', {
        ...safeInDisplayAndRequest,
        category: 'String',
        createDefault: () => ({
            type: 'v2ToLowerCase',
            sourceType: 'value',
            source: '',
            outputVar: '',
            indent: 0
        })
    }),
    v2ToUpperCase: defineTriggerV2('v2ToUpperCase', {
        ...safeInDisplayAndRequest,
        category: 'String',
        createDefault: () => ({
            type: 'v2ToUpperCase',
            sourceType: 'value',
            source: '',
            outputVar: '',
            indent: 0
        })
    }),
    v2SetCharAt: defineTriggerV2('v2SetCharAt', {
        ...safeInDisplayAndRequest,
        category: 'String',
        createDefault: () => ({
            type: 'v2SetCharAt',
            sourceType: 'value',
            source: '',
            indexType: 'value',
            index: '',
            valueType: 'value',
            value: '',
            outputVar: '',
            indent: 0
        })
    }),
    v2SplitString: defineTriggerV2('v2SplitString', {
        ...safeInDisplayAndRequest,
        category: 'String',
        createDefault: () => ({
            type: 'v2SplitString',
            sourceType: 'value',
            source: '',
            delimiterType: 'value',
            delimiter: '',
            outputVar: '',
            indent: 0
        }),
        editor: {
            fieldOptions: {
                delimiterType: valueVarRegexOptions
            }
        }
    }),
    v2JoinArrayVar: defineTriggerV2('v2JoinArrayVar', {
        ...safeInDisplayAndRequest,
        category: 'Array',
        createDefault: () => ({
            type: 'v2JoinArrayVar',
            varType: 'value',
            var: '',
            delimiterType: 'value',
            delimiter: '',
            outputVar: '',
            indent: 0
        })
    }),
    v2GetCharacterDesc: defineTriggerV2('v2GetCharacterDesc', {
        category: 'Data',
        createDefault: () => ({
            type: 'v2GetCharacterDesc',
            outputVar: '',
            indent: 0
        })
    }),
    v2SetCharacterDesc: defineTriggerV2('v2SetCharacterDesc', {
        category: 'Data',
        createDefault: () => ({
            type: 'v2SetCharacterDesc',
            valueType: 'value',
            value: '',
            indent: 0
        }),
        editor: {
            textareaFields: ['value'],
            highlightFields: ['value']
        }
    }),
    v2GetPersonaDesc: defineTriggerV2('v2GetPersonaDesc', {
        category: 'Data',
        createDefault: () => ({
            type: 'v2GetPersonaDesc',
            outputVar: '',
            indent: 0
        })
    }),
    v2SetPersonaDesc: defineTriggerV2('v2SetPersonaDesc', {
        category: 'Data',
        createDefault: () => ({
            type: 'v2SetPersonaDesc',
            valueType: 'value',
            value: '',
            indent: 0
        }),
        editor: {
            textareaFields: ['value'],
            highlightFields: ['value']
        }
    }),
    v2MakeArrayVar: defineTriggerV2('v2MakeArrayVar', {
        ...safeInDisplayAndRequest,
        category: 'Array',
        createDefault: () => ({
            type: 'v2MakeArrayVar',
            var: '',
            indent: 0
        })
    }),
    v2GetArrayVarLength: defineTriggerV2('v2GetArrayVarLength', {
        ...safeInDisplayAndRequest,
        category: 'Array',
        createDefault: () => ({
            type: 'v2GetArrayVarLength',
            var: '',
            outputVar: '',
            indent: 0
        })
    }),
    v2GetArrayVar: defineTriggerV2('v2GetArrayVar', {
        ...safeInDisplayAndRequest,
        category: 'Array',
        createDefault: () => ({
            type: 'v2GetArrayVar',
            var: '',
            indexType: 'value',
            index: '',
            outputVar: '',
            indent: 0
        })
    }),
    v2SetArrayVar: defineTriggerV2('v2SetArrayVar', {
        ...safeInDisplayAndRequest,
        category: 'Array',
        createDefault: () => ({
            type: 'v2SetArrayVar',
            var: '',
            indexType: 'value',
            index: '',
            valueType: 'value',
            value: '',
            indent: 0
        })
    }),
    v2PushArrayVar: defineTriggerV2('v2PushArrayVar', {
        ...safeInDisplayAndRequest,
        category: 'Array',
        createDefault: () => ({
            type: 'v2PushArrayVar',
            var: '',
            valueType: 'value',
            value: '',
            indent: 0
        })
    }),
    v2PopArrayVar: defineTriggerV2('v2PopArrayVar', {
        ...safeInDisplayAndRequest,
        category: 'Array',
        createDefault: () => ({
            type: 'v2PopArrayVar',
            var: '',
            outputVar: '',
            indent: 0
        })
    }),
    v2ShiftArrayVar: defineTriggerV2('v2ShiftArrayVar', {
        ...safeInDisplayAndRequest,
        category: 'Array',
        createDefault: () => ({
            type: 'v2ShiftArrayVar',
            var: '',
            outputVar: '',
            indent: 0
        })
    }),
    v2UnshiftArrayVar: defineTriggerV2('v2UnshiftArrayVar', {
        ...safeInDisplayAndRequest,
        category: 'Array',
        createDefault: () => ({
            type: 'v2UnshiftArrayVar',
            var: '',
            valueType: 'value',
            value: '',
            indent: 0
        })
    }),
    v2SpliceArrayVar: defineTriggerV2('v2SpliceArrayVar', {
        ...safeInDisplayAndRequest,
        category: 'Array',
        createDefault: () => ({
            type: 'v2SpliceArrayVar',
            var: '',
            startType: 'value',
            start: '',
            itemType: 'value',
            item: '',
            indent: 0
        }),
        editor: {
            labelOverrides: {
                item: 'value'
            }
        }
    }),
    v2GetFirstMessage: defineTriggerV2('v2GetFirstMessage', {
        category: 'Chat',
        createDefault: () => ({
            type: 'v2GetFirstMessage',
            outputVar: '',
            indent: 0
        })
    }),
    v2SliceArrayVar: defineTriggerV2('v2SliceArrayVar', {
        ...safeInDisplayAndRequest,
        category: 'Array',
        createDefault: () => ({
            type: 'v2SliceArrayVar',
            var: '',
            startType: 'value',
            start: '',
            endType: 'value',
            end: '',
            outputVar: '',
            indent: 0
        })
    }),
    v2GetIndexOfValueInArrayVar: defineTriggerV2('v2GetIndexOfValueInArrayVar', {
        ...safeInDisplayAndRequest,
        category: 'Array',
        createDefault: () => ({
            type: 'v2GetIndexOfValueInArrayVar',
            var: '',
            valueType: 'value',
            value: '',
            outputVar: '',
            indent: 0
        })
    }),
    v2RemoveIndexFromArrayVar: defineTriggerV2('v2RemoveIndexFromArrayVar', {
        ...safeInDisplayAndRequest,
        category: 'Array',
        createDefault: () => ({
            type: 'v2RemoveIndexFromArrayVar',
            var: '',
            indexType: 'value',
            index: '',
            indent: 0
        })
    }),
    v2ConcatString: defineTriggerV2('v2ConcatString', {
        ...safeInDisplayAndRequest,
        category: 'String',
        createDefault: () => ({
            type: 'v2ConcatString',
            source1Type: 'value',
            source1: '',
            source2Type: 'value',
            source2: '',
            outputVar: '',
            indent: 0
        }),
        editor: {
            labelOverrides: {
                source1: 'A',
                source2: 'B'
            }
        }
    }),
    v2GetLastUserMessage: defineTriggerV2('v2GetLastUserMessage', {
        category: 'Chat',
        createDefault: () => ({
            type: 'v2GetLastUserMessage',
            outputVar: '',
            indent: 0
        })
    }),
    v2GetLastCharMessage: defineTriggerV2('v2GetLastCharMessage', {
        category: 'Chat',
        createDefault: () => ({
            type: 'v2GetLastCharMessage',
            outputVar: '',
            indent: 0
        })
    }),
    v2GetAlertInput: defineTriggerV2('v2GetAlertInput', {
        category: 'Alert',
        createDefault: () => ({
            type: 'v2GetAlertInput',
            displayType: 'value',
            display: '',
            outputVar: '',
            indent: 0
        }),
        editor: {
            labelOverrides: {
                display: 'alertContent'
            }
        }
    }),
    v2GetAlertSelect: defineTriggerV2('v2GetAlertSelect', {
        category: 'Alert',
        createDefault: () => ({
            type: 'v2GetAlertSelect',
            displayType: 'value',
            display: '',
            valueType: 'value',
            value: '',
            outputVar: '',
            indent: 0
        }),
        editor: {
            labelOverrides: {
                display: 'alertContent',
                value: 'options'
            },
            helpKeys: {
                value: 'v2GetAlertSelect'
            }
        }
    }),
    v2GetDisplayState: defineTriggerV2('v2GetDisplayState', {
        ...displayOnly,
        category: 'Special',
        special: true,
        createDefault: () => ({
            type: 'v2GetDisplayState',
            outputVar: '',
            indent: 0
        })
    }),
    v2SetDisplayState: defineTriggerV2('v2SetDisplayState', {
        ...displayOnly,
        category: 'Special',
        special: true,
        createDefault: () => ({
            type: 'v2SetDisplayState',
            valueType: 'value',
            value: '',
            indent: 0
        })
    }),
    v2UpdateGUI: defineTriggerV2('v2UpdateGUI', {
        category: 'Others',
        createDefault: () => ({
            type: 'v2UpdateGUI',
            indent: 0
        })
    }),
    v2UpdateChatAt: defineTriggerV2('v2UpdateChatAt', {
        category: 'Others',
        createDefault: () => ({
            type: 'v2UpdateChatAt',
            index: '0',
            indent: 0
        })
    }),
    v2Wait: defineTriggerV2('v2Wait', {
        category: 'Others',
        createDefault: () => ({
            type: 'v2Wait',
            valueType: 'value',
            value: '1',
            indent: 0
        })
    }),
    v2GetRequestState: defineTriggerV2('v2GetRequestState', {
        ...requestOnly,
        category: 'Special',
        special: true,
        createDefault: () => ({
            type: 'v2GetRequestState',
            indexType: 'value',
            index: '',
            outputVar: '',
            indent: 0
        })
    }),
    v2SetRequestState: defineTriggerV2('v2SetRequestState', {
        ...requestOnly,
        category: 'Special',
        special: true,
        createDefault: () => ({
            type: 'v2SetRequestState',
            indexType: 'value',
            index: '',
            valueType: 'value',
            value: '',
            indent: 0
        })
    }),
    v2GetRequestStateRole: defineTriggerV2('v2GetRequestStateRole', {
        ...requestOnly,
        category: 'Special',
        special: true,
        createDefault: () => ({
            type: 'v2GetRequestStateRole',
            indexType: 'value',
            index: '',
            outputVar: '',
            indent: 0
        })
    }),
    v2SetRequestStateRole: defineTriggerV2('v2SetRequestStateRole', {
        ...requestOnly,
        category: 'Special',
        special: true,
        createDefault: () => ({
            type: 'v2SetRequestStateRole',
            indexType: 'value',
            index: '',
            valueType: 'value',
            value: '',
            indent: 0
        })
    }),
    v2GetRequestStateLength: defineTriggerV2('v2GetRequestStateLength', {
        ...requestOnly,
        category: 'Special',
        special: true,
        createDefault: () => ({
            type: 'v2GetRequestStateLength',
            outputVar: '',
            indent: 0
        })
    }),
    v2IfAdvanced: defineTriggerV2('v2IfAdvanced', {
        ...safeInDisplayAndRequest,
        category: 'Control',
        opensBlock: true,
        allowElse: true,
        createDefault: () => ({
            type: 'v2IfAdvanced',
            sourceType: 'value',
            source: '',
            condition: '=',
            targetType: 'value',
            target: '',
            indent: 0
        }),
        editor: {
            labelOverrides: {
                source: 'A',
                target: 'B'
            },
            fieldKinds: {
                condition: 'select',
                target: (effect) => isTriggerV2TruthyCondition(effect) ? 'select' : 'text'
            },
            fieldOptions: {
                condition: advancedIfConditionOptions,
                target: truthyTargetOptions
            },
            visibility: {
                targetType: (effect) => !isTriggerV2TruthyCondition(effect)
            },
            postChange: {
                condition: (effect, value) => {
                    if (value === '≡') {
                        effect.target = 'true'
                        effect.targetType = 'value'
                    }
                }
            },
            showAddElse: true
        }
    }),
    v2QuickSearchChat: defineTriggerV2('v2QuickSearchChat', {
        category: 'Chat',
        createDefault: () => ({
            type: 'v2QuickSearchChat',
            valueType: 'value',
            value: '',
            condition: 'loose',
            depthType: 'value',
            depth: '3',
            outputVar: '',
            indent: 0
        }),
        editor: {
            fieldKinds: {
                condition: 'select'
            },
            fieldOptions: {
                condition: quickSearchConditionOptions
            }
        }
    }),
    v2StopPromptSending: defineTriggerV2('v2StopPromptSending', {
        category: 'Others',
        createDefault: () => ({
            type: 'v2StopPromptSending',
            indent: 0
        })
    }),
    v2Tokenize: defineTriggerV2('v2Tokenize', {
        category: 'Others',
        createDefault: () => ({
            type: 'v2Tokenize',
            valueType: 'value',
            value: '',
            outputVar: '',
            indent: 0
        })
    }),
    v2GetAllLorebooks: defineTriggerV2('v2GetAllLorebooks', {
        category: 'Lorebook V2',
        createDefault: () => ({
            type: 'v2GetAllLorebooks',
            outputVar: '',
            indent: 0
        })
    }),
    v2GetLorebookByName: defineTriggerV2('v2GetLorebookByName', {
        category: 'Lorebook V2',
        createDefault: () => ({
            type: 'v2GetLorebookByName',
            nameType: 'value',
            name: '',
            outputVar: '',
            indent: 0
        })
    }),
    v2GetLorebookByIndex: defineTriggerV2('v2GetLorebookByIndex', {
        category: 'Lorebook V2',
        createDefault: () => ({
            type: 'v2GetLorebookByIndex',
            indexType: 'value',
            index: '',
            outputVar: '',
            indent: 0
        })
    }),
    v2CreateLorebook: defineTriggerV2('v2CreateLorebook', {
        category: 'Lorebook V2',
        createDefault: () => ({
            type: 'v2CreateLorebook',
            nameType: 'value',
            name: '',
            keyType: 'value',
            key: '',
            contentType: 'value',
            content: '',
            insertOrderType: 'value',
            insertOrder: '100',
            indent: 0
        }),
        editor: {
            textareaFields: ['content'],
            labelOverrides: {
                key: 'activationKeys',
                content: 'prompt'
            }
        }
    }),
    v2ModifyLorebookByIndex: defineTriggerV2('v2ModifyLorebookByIndex', {
        category: 'Lorebook V2',
        createDefault: () => ({
            type: 'v2ModifyLorebookByIndex',
            indexType: 'value',
            index: '',
            nameType: 'value',
            name: '{{slot}}',
            keyType: 'value',
            key: '{{slot}}',
            contentType: 'value',
            content: '{{slot}}',
            insertOrderType: 'value',
            insertOrder: '{{slot}}',
            indent: 0
        }),
        editor: {
            textareaFields: ['content'],
            labelOverrides: {
                key: 'activationKeys',
                content: 'prompt'
            }
        }
    }),
    v2DeleteLorebookByIndex: defineTriggerV2('v2DeleteLorebookByIndex', {
        category: 'Lorebook V2',
        createDefault: () => ({
            type: 'v2DeleteLorebookByIndex',
            indexType: 'value',
            index: '',
            indent: 0
        })
    }),
    v2GetLorebookCountNew: defineTriggerV2('v2GetLorebookCountNew', {
        category: 'Lorebook V2',
        createDefault: () => ({
            type: 'v2GetLorebookCountNew',
            outputVar: '',
            indent: 0
        })
    }),
    v2SetLorebookAlwaysActive: defineTriggerV2('v2SetLorebookAlwaysActive', {
        category: 'Lorebook V2',
        createDefault: () => ({
            type: 'v2SetLorebookAlwaysActive',
            indexType: 'value',
            index: '',
            value: true,
            indent: 0
        }),
        editor: {
            checkboxLabels: {
                value: 'alwaysActive'
            }
        }
    }),
    v2RegexTest: defineTriggerV2('v2RegexTest', {
        ...safeInDisplayAndRequest,
        category: 'String',
        createDefault: () => ({
            type: 'v2RegexTest',
            valueType: 'value',
            value: '',
            regexType: 'value',
            regex: '',
            flagsType: 'value',
            flags: '',
            outputVar: '',
            indent: 0
        }),
        editor: {
            labelOverrides: {
                value: 'source'
            },
            helpKeys: {
                outputVar: 'v2RegexTest'
            }
        }
    }),
    v2GetReplaceGlobalNote: defineTriggerV2('v2GetReplaceGlobalNote', {
        category: 'Data',
        createDefault: () => ({
            type: 'v2GetReplaceGlobalNote',
            outputVar: '',
            indent: 0
        })
    }),
    v2SetReplaceGlobalNote: defineTriggerV2('v2SetReplaceGlobalNote', {
        category: 'Data',
        createDefault: () => ({
            type: 'v2SetReplaceGlobalNote',
            valueType: 'value',
            value: '',
            indent: 0
        }),
        editor: {
            textareaFields: ['value'],
            highlightFields: ['value']
        }
    }),
    v2GetAuthorNote: defineTriggerV2('v2GetAuthorNote', {
        category: 'Data',
        createDefault: () => ({
            type: 'v2GetAuthorNote',
            outputVar: '',
            indent: 0
        })
    }),
    v2SetAuthorNote: defineTriggerV2('v2SetAuthorNote', {
        category: 'Data',
        createDefault: () => ({
            type: 'v2SetAuthorNote',
            valueType: 'value',
            value: '',
            indent: 0
        }),
        editor: {
            textareaFields: ['value'],
            highlightFields: ['value']
        }
    }),
    v2MakeDictVar: defineTriggerV2('v2MakeDictVar', {
        category: 'Dictionary',
        createDefault: () => ({
            type: 'v2MakeDictVar',
            var: '',
            indent: 0
        })
    }),
    v2GetDictVar: defineTriggerV2('v2GetDictVar', {
        category: 'Dictionary',
        createDefault: () => ({
            type: 'v2GetDictVar',
            varType: 'value',
            var: '',
            keyType: 'value',
            key: '',
            outputVar: '',
            indent: 0
        })
    }),
    v2SetDictVar: defineTriggerV2('v2SetDictVar', {
        category: 'Dictionary',
        createDefault: () => ({
            type: 'v2SetDictVar',
            varType: 'value',
            var: '',
            keyType: 'value',
            key: '',
            valueType: 'value',
            value: '',
            indent: 0
        })
    }),
    v2DeleteDictKey: defineTriggerV2('v2DeleteDictKey', {
        category: 'Dictionary',
        createDefault: () => ({
            type: 'v2DeleteDictKey',
            varType: 'value',
            var: '',
            keyType: 'value',
            key: '',
            indent: 0
        })
    }),
    v2HasDictKey: defineTriggerV2('v2HasDictKey', {
        category: 'Dictionary',
        createDefault: () => ({
            type: 'v2HasDictKey',
            varType: 'value',
            var: '',
            keyType: 'value',
            key: '',
            outputVar: '',
            indent: 0
        })
    }),
    v2ClearDict: defineTriggerV2('v2ClearDict', {
        category: 'Dictionary',
        createDefault: () => ({
            type: 'v2ClearDict',
            var: '',
            indent: 0
        })
    }),
    v2GetDictSize: defineTriggerV2('v2GetDictSize', {
        category: 'Dictionary',
        createDefault: () => ({
            type: 'v2GetDictSize',
            varType: 'value',
            var: '',
            outputVar: '',
            indent: 0
        })
    }),
    v2GetDictKeys: defineTriggerV2('v2GetDictKeys', {
        category: 'Dictionary',
        createDefault: () => ({
            type: 'v2GetDictKeys',
            varType: 'value',
            var: '',
            outputVar: '',
            indent: 0
        })
    }),
    v2GetDictValues: defineTriggerV2('v2GetDictValues', {
        category: 'Dictionary',
        createDefault: () => ({
            type: 'v2GetDictValues',
            varType: 'value',
            var: '',
            outputVar: '',
            indent: 0
        })
    }),
    v2Calculate: defineTriggerV2('v2Calculate', {
        ...safeInDisplayAndRequest,
        category: 'Control',
        createDefault: () => ({
            type: 'v2Calculate',
            expressionType: 'value',
            expression: '',
            outputVar: '',
            indent: 0
        }),
        editor: {
            textareaFields: ['expression'],
            highlightFields: ['expression'],
            helpKeys: {
                expression: 'v2Calculate'
            }
        }
    }),
    v2ReplaceString: defineTriggerV2('v2ReplaceString', {
        category: 'String',
        createDefault: () => ({
            type: 'v2ReplaceString',
            sourceType: 'value',
            source: '',
            regexType: 'value',
            regex: '',
            resultType: 'value',
            result: '',
            replacementType: 'value',
            replacement: '',
            flagsType: 'value',
            flags: '',
            outputVar: '',
            indent: 0
        }),
        editor: {
            labelOverrides: {
                result: 'resultFormat'
            }
        }
    }),
    v2Comment: defineTriggerV2('v2Comment', {
        ...safeInDisplayAndRequest,
        category: 'Control',
        createDefault: () => ({
            type: 'v2Comment',
            value: '',
            indent: 0
        })
    }),
    v2DeclareLocalVar: defineTriggerV2('v2DeclareLocalVar', {
        ...safeInDisplayAndRequest,
        category: 'Control',
        createDefault: () => ({
            type: 'v2DeclareLocalVar',
            var: '',
            valueType: 'value',
            value: '',
            indent: 0
        }),
        editor: {
            labelOverrides: {
                var: 'varName'
            }
        }
    })
}

const triggerV2EditorFieldOrderMap = {
    v2If: ['source', 'condition', 'target'],
    v2SetVar: ['var', 'operator', 'value'],
    v2Loop: [],
    v2BreakLoop: [],
    v2RunTrigger: ['target'],
    v2ConsoleLog: ['source'],
    v2StopTrigger: [],
    v2CutChat: ['start', 'end'],
    v2ModifyChat: ['index', 'value'],
    v2SystemPrompt: ['location', 'value'],
    v2Impersonate: ['role', 'value'],
    v2Command: ['value'],
    v2SendAIprompt: [],
    v2CheckSimilarity: ['source', 'value', 'outputVar'],
    v2RunLLM: ['value', 'model', 'outputVar'],
    v2ShowAlert: ['value'],
    v2ExtractRegex: ['value', 'regex', 'result', 'flags', 'outputVar'],
    v2GetLastMessage: ['outputVar'],
    v2GetMessageAtIndex: ['index', 'outputVar'],
    v2GetMessageCount: ['outputVar'],
    v2ModifyLorebook: ['target', 'value'],
    v2GetLorebook: ['target', 'outputVar'],
    v2GetLorebookCount: ['outputVar'],
    v2GetLorebookEntry: ['index', 'outputVar'],
    v2SetLorebookActivation: ['index', 'value'],
    v2GetLorebookIndexViaName: ['name', 'outputVar'],
    v2LoopNTimes: ['value'],
    v2Random: ['min', 'max', 'outputVar'],
    v2GetCharAt: ['source', 'index', 'outputVar'],
    v2GetCharCount: ['source', 'outputVar'],
    v2ToLowerCase: ['source', 'outputVar'],
    v2ToUpperCase: ['source', 'outputVar'],
    v2SetCharAt: ['source', 'index', 'value', 'outputVar'],
    v2SplitString: ['source', 'delimiter', 'outputVar'],
    v2JoinArrayVar: ['var', 'delimiter', 'outputVar'],
    v2GetCharacterDesc: ['outputVar'],
    v2SetCharacterDesc: ['value'],
    v2GetPersonaDesc: ['outputVar'],
    v2SetPersonaDesc: ['value'],
    v2MakeArrayVar: ['var'],
    v2GetArrayVarLength: ['var', 'outputVar'],
    v2GetArrayVar: ['var', 'index', 'outputVar'],
    v2SetArrayVar: ['var', 'index', 'value'],
    v2PushArrayVar: ['var', 'value'],
    v2PopArrayVar: ['var', 'outputVar'],
    v2ShiftArrayVar: ['var', 'outputVar'],
    v2UnshiftArrayVar: ['var', 'value'],
    v2SpliceArrayVar: ['var', 'start', 'item'],
    v2GetFirstMessage: ['outputVar'],
    v2SliceArrayVar: ['var', 'start', 'end', 'outputVar'],
    v2GetIndexOfValueInArrayVar: ['var', 'value', 'outputVar'],
    v2RemoveIndexFromArrayVar: ['var', 'index'],
    v2ConcatString: ['source1', 'source2', 'outputVar'],
    v2GetLastUserMessage: ['outputVar'],
    v2GetLastCharMessage: ['outputVar'],
    v2GetAlertInput: ['display', 'outputVar'],
    v2GetAlertSelect: ['display', 'value', 'outputVar'],
    v2GetDisplayState: ['outputVar'],
    v2SetDisplayState: ['value'],
    v2UpdateGUI: [],
    v2UpdateChatAt: ['index'],
    v2Wait: ['value'],
    v2GetRequestState: ['index', 'outputVar'],
    v2SetRequestState: ['index', 'value'],
    v2GetRequestStateRole: ['index', 'outputVar'],
    v2SetRequestStateRole: ['index', 'value'],
    v2GetRequestStateLength: ['outputVar'],
    v2IfAdvanced: ['source', 'condition', 'target'],
    v2QuickSearchChat: ['value', 'condition', 'depth', 'outputVar'],
    v2StopPromptSending: [],
    v2Tokenize: ['value', 'outputVar'],
    v2GetAllLorebooks: ['outputVar'],
    v2GetLorebookByName: ['name', 'outputVar'],
    v2GetLorebookByIndex: ['index', 'outputVar'],
    v2CreateLorebook: ['name', 'key', 'content', 'insertOrder'],
    v2ModifyLorebookByIndex: ['index', 'name', 'key', 'content', 'insertOrder'],
    v2DeleteLorebookByIndex: ['index'],
    v2GetLorebookCountNew: ['outputVar'],
    v2SetLorebookAlwaysActive: ['index', 'value'],
    v2RegexTest: ['value', 'regex', 'flags', 'outputVar'],
    v2GetReplaceGlobalNote: ['outputVar'],
    v2SetReplaceGlobalNote: ['value'],
    v2GetAuthorNote: ['outputVar'],
    v2SetAuthorNote: ['value'],
    v2MakeDictVar: ['var'],
    v2GetDictVar: ['var', 'key', 'outputVar'],
    v2SetDictVar: ['var', 'key', 'value'],
    v2DeleteDictKey: ['var', 'key'],
    v2HasDictKey: ['var', 'key', 'outputVar'],
    v2ClearDict: ['var'],
    v2GetDictSize: ['var', 'outputVar'],
    v2GetDictKeys: ['var', 'outputVar'],
    v2GetDictValues: ['var', 'outputVar'],
    v2Calculate: ['expression', 'outputVar'],
    v2ReplaceString: ['source', 'regex', 'result', 'replacement', 'flags', 'outputVar'],
    v2Comment: ['value'],
    v2DeclareLocalVar: ['var', 'value']
} as const satisfies Record<TriggerV2SelectableType, readonly string[]>

for (const [type, fieldOrder] of Object.entries(triggerV2EditorFieldOrderMap) as [TriggerV2SelectableType, readonly string[]][]) {
    const definition = triggerV2Registry[type]
    definition.editor = {
        ...(definition.editor ?? {}),
        fieldOrder
    } as never
}

export const triggerV2Categories = triggerV2CategoryOrder.reduce((acc, category) => {
    acc[category] = (Object.values(triggerV2Registry) as TriggerV2Definition<TriggerV2EffectType>[])
        .filter((definition) => definition.category === category && definition.selectable !== false)
        .map((definition) => definition.type as TriggerV2SelectableType)
    return acc
}, {} as Record<TriggerV2Category, TriggerV2SelectableType[]>)

export const getTriggerV2Definition = <T extends TriggerV2EffectType>(type: T): TriggerV2Definition<T> => {
    return triggerV2Registry[type] as TriggerV2Definition<T>
}

export const isTriggerV2EffectType = (type: triggerEffect['type']): type is TriggerV2EffectType => {
    return Object.hasOwn(triggerV2Registry, type)
}

export const getTriggerV2LabelKey = <T extends TriggerV2EffectType>(type: T) => {
    return getTriggerV2Definition(type).labelKey ?? type
}

export const getTriggerV2DescriptionKey = <T extends TriggerV2EffectType>(type: T) => {
    return getTriggerV2Definition(type).descriptionKey ?? `${type}Desc`
}

export const getTriggerV2EditorFieldOrder = <T extends TriggerV2SelectableType>(type: T) => {
    return [...getTriggerV2Definition(type).editor?.fieldOrder ?? []] as string[]
}

export const isTriggerV2BlockEffectType = (type: TriggerV2EffectType) => {
    return getTriggerV2Definition(type).opensBlock === true
}

export const isTriggerV2PrimaryBlockStartType = (type: TriggerV2EffectType) => {
    return type !== 'v2Else' && isTriggerV2BlockEffectType(type)
}

export const isTriggerV2LoopBlockType = (type: TriggerV2EffectType) => {
    return getTriggerV2Definition(type).loopBlock === true
}

export const canTriggerV2HaveElse = (type: TriggerV2EffectType) => {
    return getTriggerV2Definition(type).allowElse === true
}

export const isTriggerV2SpecialType = (type: TriggerV2EffectType) => {
    return getTriggerV2Definition(type).special === true
}

export const isTriggerV2LowLevelType = (type: TriggerV2EffectType) => {
    return getTriggerV2Definition(type).lowLevel === true
}

export const isTriggerV2DisplayAllowed = (type: TriggerV2EffectType) => {
    return getTriggerV2Definition(type).displayAllowed === true
}

export const isTriggerV2RequestAllowed = (type: TriggerV2EffectType) => {
    return getTriggerV2Definition(type).requestAllowed === true
}

export const displayAllowList = (Object.values(triggerV2Registry) as TriggerV2Definition<TriggerV2EffectType>[])
    .filter((definition) => definition.displayAllowed)
    .map((definition) => definition.type)

export const requestAllowList = (Object.values(triggerV2Registry) as TriggerV2Definition<TriggerV2EffectType>[])
    .filter((definition) => definition.requestAllowed)
    .map((definition) => definition.type)

export const createTriggerV2Default = <T extends TriggerV2SelectableType>(type: T): TriggerV2EffectByType<T> => {
    const definition = getTriggerV2Definition(type)
    if (!definition.createDefault) {
        throw new Error(`Trigger definition for ${type} does not expose a default editor state.`)
    }
    return definition.createDefault()
}

const parseTriggerValue = (context: TriggerV2RuntimeContext, value: string) => {
    return risuChatParser(value, { chara: context.char })
}

const resolveTriggerInput = (
    context: TriggerV2RuntimeContext,
    value: string,
    valueType: 'value' | 'var'
) => {
    const parsedValue = parseTriggerValue(context, value)
    return valueType === 'value' ? parsedValue : context.getVar(parsedValue)
}

const resolveTriggerNumber = (
    context: TriggerV2RuntimeContext,
    value: string,
    valueType: 'value' | 'var',
    fallback = 0
) => {
    const parsed = Number(resolveTriggerInput(context, value, valueType))
    return Number.isNaN(parsed) ? fallback : parsed
}

const resolveTriggerOutputKey = (context: TriggerV2RuntimeContext, outputVar: string) => {
    return parseTriggerValue(context, outputVar)
}

const triggerV2RuntimeHandlers: {
    [K in TriggerV2EffectType]?: TriggerV2RuntimeHandler<K>
} = {
    v2Header: () => {},
    v2If: (effect, context) => {
        const sourceValue = context.getVar(parseTriggerValue(context, effect.source))
        const targetValue = resolveTriggerInput(context, effect.target, effect.targetType)
        let pass = false
        switch (effect.condition) {
            case '=':
                pass = !isNaN(Number(sourceValue)) && !isNaN(Number(targetValue))
                    ? Number(sourceValue) === Number(targetValue)
                    : sourceValue === targetValue
                break
            case '!=':
                pass = !isNaN(Number(sourceValue)) && !isNaN(Number(targetValue))
                    ? Number(sourceValue) !== Number(targetValue)
                    : sourceValue !== targetValue
                break
            case '>':
                pass = Number(sourceValue) > Number(targetValue)
                break
            case '<':
                pass = Number(sourceValue) < Number(targetValue)
                break
            case '>=':
                pass = Number(sourceValue) >= Number(targetValue)
                break
            case '<=':
                pass = Number(sourceValue) <= Number(targetValue)
                break
        }

        if (!pass) {
            let indent = effect.indent + 1
            for (; context.state.index < context.trigger.effect.length; context.state.index++) {
                const nextEffect = context.trigger.effect[context.state.index] as triggerEffectV2
                if (nextEffect.type === 'v2EndIndent' && indent === nextEffect.indent) {
                    indent--
                    const elseEffect = context.trigger.effect[context.state.index + 1] as triggerEffectV2
                    if (elseEffect?.type === 'v2Else' && elseEffect?.indent === indent) {
                        context.state.index++
                    }
                    break
                }
            }
        }
    },
    v2Else: (effect, context) => {
        const indent = effect.indent + 1
        for (; context.state.index < context.trigger.effect.length; context.state.index++) {
            const nextEffect = context.trigger.effect[context.state.index] as triggerEffectV2
            if (nextEffect.type === 'v2EndIndent' && indent === nextEffect.indent) {
                break
            }
        }
    },
    v2EndIndent: async (effect, context) => {
        if (effect.endOfLoop) {
            const indent = effect.indent - 1
            const originalIndex = context.state.index
            for (; context.state.index >= 0; context.state.index--) {
                const nextEffect = context.trigger.effect[context.state.index] as triggerEffectV2
                if ((nextEffect.type === 'v2Loop' || nextEffect.type === 'v2LoopNTimes') && indent === nextEffect.indent) {
                    if (nextEffect.type === 'v2LoopNTimes') {
                        const loopLimit = resolveTriggerNumber(context, nextEffect.value, nextEffect.valueType)
                        const loopCountKey = `${context.state.index}LoopNTimes`
                        const loopCount = Number(context.state.tempVars[loopCountKey] ?? 0) + 1
                        context.state.tempVars[loopCountKey] = loopCount

                        if (loopCount >= loopLimit) {
                            context.state.index = originalIndex
                        }
                        else {
                            break
                        }
                    }
                    break
                }
            }

            const loopTimes = Number(context.state.tempVars.loopTimes ?? 0) + 1
            context.state.tempVars.loopTimes = loopTimes
            if (loopTimes > 100) {
                await sleep(1)
                context.state.tempVars.loopTimes = 0
            }
        }

        context.clearLocalVarsAtIndent(effect.indent)
    },
    v2SetVar: (effect, context) => {
        const effectValue = resolveTriggerInput(context, effect.value, effect.valueType)
        const varKey = parseTriggerValue(context, effect.var)
        let originalVar = Number(context.getVar(varKey))
        if (Number.isNaN(originalVar)) {
            originalVar = 0
        }

        let resultValue = ''
        switch (effect.operator) {
            case '=':
                resultValue = effectValue
                break
            case '+=':
                resultValue = (originalVar + Number(effectValue)).toString()
                break
            case '-=':
                resultValue = (originalVar - Number(effectValue)).toString()
                break
            case '*=':
                resultValue = (originalVar * Number(effectValue)).toString()
                break
            case '/=':
                resultValue = (originalVar / Number(effectValue)).toString()
                break
            case '%=':
                resultValue = (originalVar % Number(effectValue)).toString()
                break
        }

        context.setVar(varKey, resultValue)
    },
    v2Loop: () => {},
    v2BreakLoop: (_effect, context) => {
        for (; context.state.index < context.trigger.effect.length; context.state.index++) {
            const nextEffect = context.trigger.effect[context.state.index] as triggerEffectV2
            if (nextEffect.type === 'v2EndIndent' && nextEffect.endOfLoop) {
                break
            }
        }
    },
    v2RunTrigger: async (effect, context) => {
        if (context.arg.recursiveCount !== undefined && context.arg.recursiveCount >= 10 && !context.trigger.lowLevelAccess) {
            return
        }

        context.arg.recursiveCount = (context.arg.recursiveCount ?? 0) + 1
        const result = await runTrigger(context.char, 'manual', {
            chat: context.state.chat,
            recursiveCount: context.arg.recursiveCount,
            additonalSysPrompt: context.state.additonalSysPrompt,
            stopSending: context.state.stopSending,
            manualName: effect.target
        })

        if (result) {
            context.state.additonalSysPrompt = result.additonalSysPrompt
            context.state.chat = result.chat
            context.state.stopSending = result.stopSending
        }
    },
    v2ConsoleLog: (effect, context) => {
        const sourceValue = resolveTriggerInput(context, effect.source, effect.sourceType)
        triggerLog(sourceValue)
    },
    v2StopTrigger: (_effect, context) => {
        context.state.index = context.trigger.effect.length
    },
    v2CutChat: (effect, context) => {
        const start = resolveTriggerNumber(context, effect.start, effect.startType, 0)
        const end = resolveTriggerNumber(context, effect.end, effect.endType, context.state.chat.message.length)
        context.state.chat.message = context.state.chat.message.slice(start, end)
    },
    v2ModifyChat: (effect, context) => {
        const index = resolveTriggerNumber(context, effect.index, effect.indexType)
        const value = resolveTriggerInput(context, effect.value, effect.valueType)
        if (context.state.chat.message[index]) {
            context.state.chat.message[index].data = value
        }
    },
    v2SystemPrompt: (effect, context) => {
        const value = resolveTriggerInput(context, effect.value, effect.valueType)
        context.state.additonalSysPrompt[effect.location] += `${value}\n\n`
    },
    v2Impersonate: (effect, context) => {
        const value = resolveTriggerInput(context, effect.value, effect.valueType)
        if (effect.role === 'user') {
            context.state.chat.message.push({ role: 'user', data: value })
        }
        else if (effect.role === 'char') {
            context.state.chat.message.push({ role: 'char', data: value })
        }
    },
    v2Command: async (effect, context) => {
        await processMultiCommand(resolveTriggerInput(context, effect.value, effect.valueType))
    },
    v2SendAIprompt: (_effect, context) => {
        if (!context.trigger.lowLevelAccess) {
            return
        }
        context.state.sendAIprompt = true
    },
    v2CheckSimilarity: async (effect, context) => {
        if (!context.trigger.lowLevelAccess) {
            return
        }
        const source = resolveTriggerInput(context, effect.source, effect.sourceType)
        const value = resolveTriggerInput(context, effect.value, effect.valueType)
        const processor = new EmbeddingProcessor()
        await processor.addText(value.split('§'))
        const result = await processor.similaritySearch(source)
        context.setVar(resolveTriggerOutputKey(context, effect.outputVar), result.join('§'))
    },
    v2RunLLM: async (effect, context) => {
        if (!context.trigger.lowLevelAccess) {
            return
        }

        const value = resolveTriggerInput(context, effect.value, effect.valueType)
        let promptBody = parseChatML(value)
        if (!promptBody) {
            promptBody = [{ role: 'user', content: value }]
        }

        const result = await requestChatData({
            formated: promptBody,
            bias: {},
            useStreaming: false,
            noMultiGen: true
        }, effect.model)

        if (result.type === 'fail' || result.type === 'streaming' || result.type === 'multiline') {
            context.setVar(resolveTriggerOutputKey(context, effect.outputVar), 'null')
            return
        }
        context.setVar(resolveTriggerOutputKey(context, effect.outputVar), result.result)
    },
    v2ShowAlert: (effect, context) => {
        if (context.arg.displayMode) {
            return { abortRun: true }
        }
        alertNormal(resolveTriggerInput(context, effect.value, effect.valueType))
    },
    v2ExtractRegex: (effect, context) => {
        const value = resolveTriggerInput(context, effect.value, effect.valueType)
        const regexValue = resolveTriggerInput(context, effect.regex, effect.regexType)
        const flagsValue = resolveTriggerInput(context, effect.flags, effect.flagsType)
        const resultValue = resolveTriggerInput(context, effect.result, effect.resultType)
        const regex = new RegExp(regexValue, flagsValue)
        const regexResult = regex.exec(value)

        const result = regexResult !== null
            ? resultValue
                .replace(/\$[0-9]+/g, (match) => regexResult[Number(match.slice(1))] || '')
                .replace(/\$&/g, regexResult[0] || '')
                .replace(/\$\$/g, '$')
            : resultValue
                .replace(/\$[0-9]+/g, '')
                .replace(/\$&/g, '')
                .replace(/\$\$/g, '$')

        context.setVar(resolveTriggerOutputKey(context, effect.outputVar), result)
    },
    v2GetLastMessage: (effect, context) => {
        context.setVar(resolveTriggerOutputKey(context, effect.outputVar), context.state.chat.message[context.state.chat.message.length - 1]?.data ?? 'null')
    },
    v2GetMessageAtIndex: (effect, context) => {
        const index = resolveTriggerNumber(context, effect.index, effect.indexType)
        context.setVar(resolveTriggerOutputKey(context, effect.outputVar), context.state.chat.message[index]?.data ?? 'null')
    },
    v2GetMessageCount: (effect, context) => {
        context.setVar(resolveTriggerOutputKey(context, effect.outputVar), context.state.chat.message.length.toString())
    },
    v2ModifyLorebook: (effect, context) => {
        context.char.globalLore = context.char.globalLore ?? []
        const target = resolveTriggerInput(context, effect.target, effect.targetType)
        const value = resolveTriggerInput(context, effect.value, effect.valueType)
        const index = context.char.globalLore.findIndex((entry) => entry[0] === target)

        if (index !== -1) {
            context.char.globalLore[index][1] = value
        }

        const targetCharacter = context.resolveTargetCharacter()
        if (targetCharacter && targetCharacter.type !== 'group') {
            targetCharacter.globalLore = context.char.globalLore
        }
    },
    v2GetLorebook: (effect, context) => {
        context.char.globalLore = context.char.globalLore ?? []
        const target = resolveTriggerInput(context, effect.target, effect.targetType)
        const index = context.char.globalLore.findIndex((entry) => entry[0] === target)
        context.setVar(resolveTriggerOutputKey(context, effect.outputVar), index === -1 ? 'null' : context.char.globalLore[index][1])
    },
    v2GetLorebookCount: (effect, context) => {
        context.char.globalLore = context.char.globalLore ?? []
        context.setVar(resolveTriggerOutputKey(context, effect.outputVar), context.char.globalLore.length.toString())
    },
    v2GetLorebookEntry: (effect, context) => {
        context.char.globalLore = context.char.globalLore ?? []
        const index = resolveTriggerNumber(context, effect.index, effect.indexType, 0)
        context.setVar(resolveTriggerOutputKey(context, effect.outputVar), context.char.globalLore[index]?.[1] ?? 'null')
    },
    v2SetLorebookActivation: (effect, context) => {
        context.char.globalLore = context.char.globalLore ?? []
        const index = resolveTriggerNumber(context, effect.index, effect.indexType)
        context.char.globalLore[index][2] = effect.value

        const targetCharacter = context.resolveTargetCharacter()
        if (targetCharacter && targetCharacter.type !== 'group') {
            targetCharacter.globalLore = context.char.globalLore
        }
    },
    v2GetLorebookIndexViaName: (effect, context) => {
        context.char.globalLore = context.char.globalLore ?? []
        const name = resolveTriggerInput(context, effect.name, effect.nameType)
        const index = context.char.globalLore.findIndex((entry) => entry[0] === name)
        context.setVar(resolveTriggerOutputKey(context, effect.outputVar), index.toString())
    },
    v2LoopNTimes: () => {},
    v2Random: (effect, context) => {
        const min = resolveTriggerNumber(context, effect.min, effect.minType)
        const max = resolveTriggerNumber(context, effect.max, effect.maxType)
        const output = Math.floor(Math.random() * (max - min + 1) + min)
        context.setVar(resolveTriggerOutputKey(context, effect.outputVar), output.toString())
    },
    v2GetCharAt: (effect, context) => {
        const source = resolveTriggerInput(context, effect.source, effect.sourceType)
        const index = resolveTriggerNumber(context, effect.index, effect.indexType)
        context.setVar(resolveTriggerOutputKey(context, effect.outputVar), source[index] ?? 'null')
    },
    v2GetCharCount: (effect, context) => {
        const source = resolveTriggerInput(context, effect.source, effect.sourceType)
        context.setVar(resolveTriggerOutputKey(context, effect.outputVar), source.length.toString())
    },
    v2ToLowerCase: (effect, context) => {
        context.setVar(resolveTriggerOutputKey(context, effect.outputVar), resolveTriggerInput(context, effect.source, effect.sourceType).toLowerCase())
    },
    v2ToUpperCase: (effect, context) => {
        context.setVar(resolveTriggerOutputKey(context, effect.outputVar), resolveTriggerInput(context, effect.source, effect.sourceType).toUpperCase())
    },
    v2SetCharAt: (effect, context) => {
        const source = resolveTriggerInput(context, effect.source, effect.sourceType)
        const index = resolveTriggerNumber(context, effect.index, effect.indexType)
        const value = resolveTriggerInput(context, effect.value, effect.valueType)
        const chars = [...source]
        chars[index] = value
        context.setVar(resolveTriggerOutputKey(context, effect.outputVar), chars.join(''))
    },
    v2SplitString: (effect, context) => {
        const source = resolveTriggerInput(context, effect.source, effect.sourceType)
        let delimiter = effect.delimiterType === 'regex'
            ? parseTriggerValue(context, effect.delimiter)
            : resolveTriggerInput(context, effect.delimiter, effect.delimiterType)

        let result: string[]
        if (effect.delimiterType === 'regex') {
            try {
                const regexMatch = delimiter.match(/^\/(.+)\/([gimuy]*)$/)
                if (regexMatch) {
                    const [, pattern, flags] = regexMatch
                    result = source.split(new RegExp(pattern, flags))
                }
                else {
                    result = source.split(new RegExp(delimiter))
                }
            }
            catch {
                result = [source]
            }
        }
        else {
            result = source.split(delimiter)
        }

        context.setVar(resolveTriggerOutputKey(context, effect.outputVar), JSON.stringify(result))
    },
    v2JoinArrayVar: (effect, context) => {
        try {
            const varValue = resolveTriggerInput(context, effect.var, effect.varType)
            const delimiter = resolveTriggerInput(context, effect.delimiter, effect.delimiterType)
            const arrayValue = JSON.parse(varValue)
            context.setVar(resolveTriggerOutputKey(context, effect.outputVar), arrayValue.join(delimiter))
        }
        catch {
            context.setVar(resolveTriggerOutputKey(context, effect.outputVar), '')
        }
    },
    v2GetCharacterDesc: (effect, context) => {
        context.setVar(resolveTriggerOutputKey(context, effect.outputVar), context.char.desc)
    },
    v2SetCharacterDesc: (effect, context) => {
        const value = resolveTriggerInput(context, effect.value, effect.valueType)
        context.char.desc = value
        const targetCharacter = context.resolveTargetCharacter()
        if (targetCharacter && targetCharacter.type !== 'group') {
            targetCharacter.desc = value
        }
    },
    v2GetPersonaDesc: (effect, context) => {
        const db = getDatabase()
        const currentPersonaPrompt = db.personaPrompt ?? ''
        const savedPersonaPrompt = db.personas[db.selectedPersona]?.personaPrompt ?? ''
        context.setVar(resolveTriggerOutputKey(context, effect.outputVar), currentPersonaPrompt || savedPersonaPrompt)
    },
    v2SetPersonaDesc: (effect, context) => {
        const value = resolveTriggerInput(context, effect.value, effect.valueType)
        const db = getDatabase()
        if (db.personas[db.selectedPersona]) {
            db.personas[db.selectedPersona].personaPrompt = value
            db.personaPrompt = value
            setDatabase(db)
        }
    },
    v2MakeArrayVar: (effect, context) => {
        const varName = parseTriggerValue(context, effect.var)
        if (varName.startsWith('[') && varName.endsWith(']')) {
            return { abortRun: true }
        }
        context.setVar(varName, '[]')
    },
    v2GetArrayVarLength: (effect, context) => {
        try {
            const varValue = context.getVar(parseTriggerValue(context, effect.var))
            const arrayValue = JSON.parse(varValue)
            context.setVar(resolveTriggerOutputKey(context, effect.outputVar), arrayValue.length.toString())
        }
        catch {
            context.setVar(resolveTriggerOutputKey(context, effect.outputVar), '0')
        }
    },
    v2GetArrayVar: (effect, context) => {
        try {
            const varValue = context.getVar(parseTriggerValue(context, effect.var))
            const arrayValue = JSON.parse(varValue)
            const index = resolveTriggerNumber(context, effect.index, effect.indexType)
            context.setVar(resolveTriggerOutputKey(context, effect.outputVar), arrayValue[index] ?? 'null')
        }
        catch {
            context.setVar(resolveTriggerOutputKey(context, effect.outputVar), 'null')
        }
    },
    v2SetArrayVar: (effect, context) => {
        const index = resolveTriggerNumber(context, effect.index, effect.indexType, Number.NaN)
        if (Number.isNaN(index)) {
            return
        }
        try {
            const varName = parseTriggerValue(context, effect.var)
            const arrayValue = JSON.parse(context.getVar(varName))
            arrayValue[index] = resolveTriggerInput(context, effect.value, effect.valueType)
            context.setVar(varName, JSON.stringify(arrayValue))
        }
        catch {
            // keep legacy silent failure behavior
        }
    },
    v2PushArrayVar: (effect, context) => {
        try {
            const varName = parseTriggerValue(context, effect.var)
            const arrayValue = JSON.parse(context.getVar(varName))
            arrayValue.push(resolveTriggerInput(context, effect.value, effect.valueType))
            context.setVar(varName, JSON.stringify(arrayValue))
        }
        catch {
            context.setVar(parseTriggerValue(context, effect.var), '[]')
        }
    },
    v2PopArrayVar: (effect, context) => {
        try {
            const varName = parseTriggerValue(context, effect.var)
            const arrayValue = JSON.parse(context.getVar(varName))
            context.setVar(resolveTriggerOutputKey(context, effect.outputVar), arrayValue.pop() ?? 'null')
            context.setVar(varName, JSON.stringify(arrayValue))
        }
        catch {
            const varName = parseTriggerValue(context, effect.var)
            context.setVar(varName, '[]')
            context.setVar(resolveTriggerOutputKey(context, effect.outputVar), 'null')
        }
    },
    v2ShiftArrayVar: (effect, context) => {
        try {
            const varName = parseTriggerValue(context, effect.var)
            const arrayValue = JSON.parse(context.getVar(varName))
            context.setVar(resolveTriggerOutputKey(context, effect.outputVar), arrayValue.shift() ?? 'null')
            context.setVar(varName, JSON.stringify(arrayValue))
        }
        catch {
            const varName = parseTriggerValue(context, effect.var)
            context.setVar(varName, '[]')
            context.setVar(resolveTriggerOutputKey(context, effect.outputVar), 'null')
        }
    },
    v2UnshiftArrayVar: (effect, context) => {
        try {
            const varName = parseTriggerValue(context, effect.var)
            const arrayValue = JSON.parse(context.getVar(varName))
            arrayValue.unshift(resolveTriggerInput(context, effect.value, effect.valueType))
            context.setVar(varName, JSON.stringify(arrayValue))
        }
        catch {
            context.setVar(parseTriggerValue(context, effect.var), '[]')
        }
    },
    v2SpliceArrayVar: (effect, context) => {
        try {
            const varName = parseTriggerValue(context, effect.var)
            const arrayValue = JSON.parse(context.getVar(varName))
            const start = resolveTriggerNumber(context, effect.start, effect.startType)
            const value = resolveTriggerInput(context, effect.item, effect.itemType)
            arrayValue.splice(start, 0, value)
            context.setVar(varName, JSON.stringify(arrayValue))
        }
        catch {
            context.setVar(parseTriggerValue(context, effect.var), '[]')
        }
    },
    v2GetFirstMessage: (effect, context) => {
        context.setVar(
            resolveTriggerOutputKey(context, effect.outputVar),
            context.state.chat.fmIndex === -1 ? context.char.firstMessage : context.char.alternateGreetings[context.state.chat.fmIndex]
        )
    },
    v2SliceArrayVar: (effect, context) => {
        try {
            const varName = parseTriggerValue(context, effect.var)
            const arrayValue = JSON.parse(context.getVar(varName))
            const start = resolveTriggerNumber(context, effect.start, effect.startType)
            const end = resolveTriggerNumber(context, effect.end, effect.endType)
            context.setVar(resolveTriggerOutputKey(context, effect.outputVar), JSON.stringify(arrayValue.slice(start, end)))
        }
        catch {
            context.setVar(resolveTriggerOutputKey(context, effect.outputVar), '[]')
        }
    },
    v2GetIndexOfValueInArrayVar: (effect, context) => {
        try {
            const arrayValue = JSON.parse(context.getVar(parseTriggerValue(context, effect.var)))
            const value = resolveTriggerInput(context, effect.value, effect.valueType)
            context.setVar(resolveTriggerOutputKey(context, effect.outputVar), arrayValue.indexOf(value).toString())
        }
        catch {
            context.setVar(resolveTriggerOutputKey(context, effect.outputVar), '-1')
        }
    },
    v2RemoveIndexFromArrayVar: (effect, context) => {
        try {
            const varName = parseTriggerValue(context, effect.var)
            const arrayValue = JSON.parse(context.getVar(varName))
            const index = resolveTriggerNumber(context, effect.index, effect.indexType)
            arrayValue.splice(index, 1)
            context.setVar(varName, JSON.stringify(arrayValue))
        }
        catch {
            context.setVar(parseTriggerValue(context, effect.var), '[]')
        }
    },
    v2ConcatString: (effect, context) => {
        const source1 = resolveTriggerInput(context, effect.source1, effect.source1Type)
        const source2 = resolveTriggerInput(context, effect.source2, effect.source2Type)
        context.setVar(resolveTriggerOutputKey(context, effect.outputVar), source1 + source2)
    },
    v2GetLastUserMessage: (effect, context) => {
        const lastUserMessage = context.state.chat.message.slice().reverse().find((message) => message.role === 'user')
        context.setVar(resolveTriggerOutputKey(context, effect.outputVar), lastUserMessage?.data ?? 'null')
    },
    v2GetLastCharMessage: (effect, context) => {
        const lastCharMessage = context.state.chat.message.slice().reverse().find((message) => message.role === 'char')
        context.setVar(resolveTriggerOutputKey(context, effect.outputVar), lastCharMessage?.data ?? 'null')
    },
    v2GetAlertInput: async (effect, context) => {
        if (context.arg.displayMode) {
            return { abortRun: true }
        }
        const value = await alertInput(resolveTriggerInput(context, effect.display, effect.displayType))
        context.setVar(resolveTriggerOutputKey(context, effect.outputVar), value)
    },
    v2GetAlertSelect: async (effect, context) => {
        if (context.arg.displayMode) {
            return { abortRun: true }
        }
        const display = resolveTriggerInput(context, effect.display, effect.displayType)
        const value = resolveTriggerInput(context, effect.value, effect.valueType)
        const result = await alertSelect(value.split('|'), display)
        context.setVar(resolveTriggerOutputKey(context, effect.outputVar), result)
    },
    v2GetDisplayState: (effect, context) => {
        if (!context.arg.displayMode) {
            return { abortRun: true }
        }
        context.setVar(resolveTriggerOutputKey(context, effect.outputVar), context.state.displayData ?? 'null')
    },
    v2SetDisplayState: (effect, context) => {
        if (!context.arg.displayMode) {
            return { abortRun: true }
        }
        context.state.displayData = resolveTriggerInput(context, effect.value, effect.valueType)
    },
    v2UpdateGUI: () => {
        ReloadGUIPointer.set(get(ReloadGUIPointer) + 1)
    },
    v2UpdateChatAt: (effect) => {
        ReloadChatPointer.update((value) => {
            value[effect.index] = (value[effect.index] ?? 0) + 1
            return value
        })
    },
    v2Wait: async (effect, context) => {
        await sleep(resolveTriggerNumber(context, effect.value, effect.valueType) * 1000)
    },
    v2GetRequestState: (effect, context) => {
        if (!context.arg.displayMode) {
            return { abortRun: true }
        }
        const requestState = JSON.parse(context.state.displayData) as OpenAIChat[]
        const index = resolveTriggerNumber(context, effect.index, effect.indexType)
        context.setVar(resolveTriggerOutputKey(context, effect.outputVar), requestState?.[index]?.content ?? 'null')
    },
    v2SetRequestState: (effect, context) => {
        if (!context.arg.displayMode) {
            return { abortRun: true }
        }
        const requestState = JSON.parse(context.state.displayData) as OpenAIChat[]
        const index = resolveTriggerNumber(context, effect.index, effect.indexType)
        requestState[index].content = resolveTriggerInput(context, effect.value, effect.valueType)
        context.state.displayData = JSON.stringify(requestState)
    },
    v2GetRequestStateRole: (effect, context) => {
        if (!context.arg.displayMode) {
            return { abortRun: true }
        }
        const requestState = JSON.parse(context.state.displayData) as OpenAIChat[]
        const index = resolveTriggerNumber(context, effect.index, effect.indexType)
        context.setVar(resolveTriggerOutputKey(context, effect.outputVar), requestState?.[index]?.role ?? 'null')
    },
    v2SetRequestStateRole: (effect, context) => {
        if (!context.arg.displayMode) {
            return { abortRun: true }
        }
        const requestState = JSON.parse(context.state.displayData) as OpenAIChat[]
        const index = resolveTriggerNumber(context, effect.index, effect.indexType)
        const value = resolveTriggerInput(context, effect.value, effect.valueType)
        if (value === 'user' || value === 'assistant' || value === 'system') {
            requestState[index].role = value
        }
        context.state.displayData = JSON.stringify(requestState)
    },
    v2GetRequestStateLength: (effect, context) => {
        if (!context.arg.displayMode) {
            return { abortRun: true }
        }
        const requestState = JSON.parse(context.state.displayData) as OpenAIChat[]
        context.setVar(resolveTriggerOutputKey(context, effect.outputVar), requestState.length.toString())
    },
    v2IfAdvanced: (effect, context) => {
        const sourceValue = effect.sourceType === 'var'
            ? context.getVar(parseTriggerValue(context, effect.source))
            : parseTriggerValue(context, effect.source)
        const targetValue = resolveTriggerInput(context, effect.target, effect.targetType)
        let pass = false

        switch (effect.condition) {
            case '=':
                pass = !isNaN(Number(sourceValue)) && !isNaN(Number(targetValue))
                    ? Number(sourceValue) === Number(targetValue)
                    : sourceValue === targetValue
                break
            case '!=':
                pass = !isNaN(Number(sourceValue)) && !isNaN(Number(targetValue))
                    ? Number(sourceValue) !== Number(targetValue)
                    : sourceValue !== targetValue
                break
            case '>':
                pass = Number(sourceValue) > Number(targetValue)
                break
            case '<':
                pass = Number(sourceValue) < Number(targetValue)
                break
            case '>=':
                pass = Number(sourceValue) >= Number(targetValue)
                break
            case '<=':
                pass = Number(sourceValue) <= Number(targetValue)
                break
            case '∈':
                try {
                    pass = JSON.parse(targetValue).includes(sourceValue)
                }
                catch {
                    pass = false
                }
                break
            case '∋':
                try {
                    pass = JSON.parse(sourceValue).includes(targetValue)
                }
                catch {
                    pass = false
                }
                break
            case '∉':
                try {
                    pass = !JSON.parse(targetValue).includes(sourceValue)
                }
                catch {
                    pass = true
                }
                break
            case '∌':
                try {
                    pass = !JSON.parse(sourceValue).includes(targetValue)
                }
                catch {
                    pass = true
                }
                break
            case '≒': {
                const sourceNumber = Number(sourceValue)
                const targetNumber = Number(targetValue)
                pass = Number.isNaN(sourceNumber) || Number.isNaN(targetNumber)
                    ? sourceValue.toLocaleLowerCase().replace(/ /g, '') === targetValue.toLocaleLowerCase().replace(/ /g, '')
                    : Math.abs(sourceNumber - targetNumber) < 0.0001
                break
            }
            case '≡':
                if (targetValue === 'true') {
                    pass = sourceValue === 'true' || sourceValue === '1'
                }
                else if (targetValue === 'false') {
                    pass = !(sourceValue === 'true' || sourceValue === '1')
                }
                else {
                    pass = sourceValue === targetValue
                }
                break
        }

        if (!pass) {
            let indent = effect.indent + 1
            for (; context.state.index < context.trigger.effect.length; context.state.index++) {
                const nextEffect = context.trigger.effect[context.state.index] as triggerEffectV2
                if (nextEffect.type === 'v2EndIndent' && indent === nextEffect.indent) {
                    indent--
                    const elseEffect = context.trigger.effect[context.state.index + 1] as triggerEffectV2
                    if (elseEffect?.type === 'v2Else' && elseEffect?.indent === indent) {
                        context.state.index++
                    }
                    break
                }
            }
        }
    },
    v2QuickSearchChat: (effect, context) => {
        const value = resolveTriggerInput(context, effect.value, effect.valueType)
        const depth = resolveTriggerNumber(context, effect.depth, effect.depthType, Number.NaN)
        if (Number.isNaN(depth)) {
            context.setVar(resolveTriggerOutputKey(context, effect.outputVar), '0')
            return
        }
        const searchText = context.state.chat.message.slice(0 - depth).map((message) => message.data).join(' ')
        let pass = false
        if (effect.condition === 'strict') {
            pass = searchText.split(' ').includes(value)
        }
        else if (effect.condition === 'loose') {
            pass = searchText.toLowerCase().includes(value.toLowerCase())
        }
        else if (effect.condition === 'regex') {
            pass = new RegExp(value).test(searchText)
        }
        context.setVar(resolveTriggerOutputKey(context, effect.outputVar), pass ? '1' : '0')
    },
    v2StopPromptSending: (_effect, context) => {
        context.state.stopSending = true
    },
    v2Tokenize: async (effect, context) => {
        const value = resolveTriggerInput(context, effect.value, effect.valueType)
        context.setVar(resolveTriggerOutputKey(context, effect.outputVar), (await tokenize(value)).toString())
    },
    v2GetAllLorebooks: (effect, context) => {
        context.char.globalLore = context.char.globalLore ?? []
        const allPrompts = context.char.globalLore
            .filter((lore) => lore && lore.content !== undefined)
            .map((lore) => lore.content)
        context.setVar(resolveTriggerOutputKey(context, effect.outputVar), JSON.stringify(allPrompts))
    },
    v2GetLorebookByName: (effect, context) => {
        context.char.globalLore = context.char.globalLore ?? []
        const name = resolveTriggerInput(context, effect.name, effect.nameType)
        const regex = new RegExp(name, 'i')
        const matchingIndices = context.char.globalLore
            .map((lore, index) => {
                if (lore && lore.comment !== undefined && regex.test(lore.comment)) {
                    return index
                }
                return -1
            })
            .filter((index) => index !== -1)
        context.setVar(resolveTriggerOutputKey(context, effect.outputVar), JSON.stringify(matchingIndices))
    },
    v2GetLorebookByIndex: (effect, context) => {
        context.char.globalLore = context.char.globalLore ?? []
        const index = resolveTriggerNumber(context, effect.index, effect.indexType, Number.NaN)
        if (Number.isNaN(index) || index < 0 || index >= context.char.globalLore.length) {
            context.setVar(resolveTriggerOutputKey(context, effect.outputVar), 'null')
            return
        }
        const loreEntry = context.char.globalLore[index]
        context.setVar(resolveTriggerOutputKey(context, effect.outputVar), loreEntry?.content ?? 'null')
    },
    v2CreateLorebook: (effect, context) => {
        context.char.globalLore = context.char.globalLore ?? []
        const name = resolveTriggerInput(context, effect.name, effect.nameType)
        const key = resolveTriggerInput(context, effect.key, effect.keyType)
        const content = resolveTriggerInput(context, effect.content, effect.contentType)
        const insertOrder = resolveTriggerNumber(context, effect.insertOrder, effect.insertOrderType, 100)
        context.char.globalLore.push({
            key,
            comment: name,
            content,
            mode: 'normal',
            insertorder: insertOrder,
            alwaysActive: false,
            secondkey: '',
            selective: false
        })

        const targetCharacter = context.resolveTargetCharacter()
        if (targetCharacter && targetCharacter.type !== 'group') {
            targetCharacter.globalLore = context.char.globalLore
        }
    },
    v2ModifyLorebookByIndex: (effect, context) => {
        context.char.globalLore = context.char.globalLore ?? []
        const index = resolveTriggerNumber(context, effect.index, effect.indexType, Number.NaN)
        if (Number.isNaN(index) || index < 0 || index >= context.char.globalLore.length || !context.char.globalLore[index]) {
            return
        }

        const currentLore = context.char.globalLore[index]
        let name = resolveTriggerInput(context, effect.name, effect.nameType).replace(/{{slot}}/g, currentLore.comment || '')
        let key = resolveTriggerInput(context, effect.key, effect.keyType).replace(/{{slot}}/g, currentLore.key || '')
        let content = resolveTriggerInput(context, effect.content, effect.contentType).replace(/{{slot}}/g, currentLore.content || '')
        let insertOrder = resolveTriggerInput(context, effect.insertOrder, effect.insertOrderType)
            .replace(/{{slot}}/g, (currentLore.insertorder || 100).toString())

        context.char.globalLore[index].comment = name
        context.char.globalLore[index].key = key
        context.char.globalLore[index].content = content
        const insertOrderNumber = Number(insertOrder)
        if (!Number.isNaN(insertOrderNumber)) {
            context.char.globalLore[index].insertorder = insertOrderNumber
        }

        const targetCharacter = context.resolveTargetCharacter()
        if (targetCharacter && targetCharacter.type !== 'group') {
            targetCharacter.globalLore = context.char.globalLore
        }
    },
    v2DeleteLorebookByIndex: (effect, context) => {
        context.char.globalLore = context.char.globalLore ?? []
        const index = resolveTriggerNumber(context, effect.index, effect.indexType, Number.NaN)
        if (Number.isNaN(index) || index < 0 || index >= context.char.globalLore.length || !context.char.globalLore[index]) {
            return
        }
        context.char.globalLore.splice(index, 1)

        const targetCharacter = context.resolveTargetCharacter()
        if (targetCharacter && targetCharacter.type !== 'group') {
            targetCharacter.globalLore = context.char.globalLore
        }
    },
    v2GetLorebookCountNew: (effect, context) => {
        context.char.globalLore = context.char.globalLore ?? []
        context.setVar(resolveTriggerOutputKey(context, effect.outputVar), context.char.globalLore.length.toString())
    },
    v2SetLorebookAlwaysActive: (effect, context) => {
        context.char.globalLore = context.char.globalLore ?? []
        const index = resolveTriggerNumber(context, effect.index, effect.indexType, Number.NaN)
        if (Number.isNaN(index) || index < 0 || index >= context.char.globalLore.length || !context.char.globalLore[index]) {
            return
        }
        context.char.globalLore[index].alwaysActive = effect.value

        const targetCharacter = context.resolveTargetCharacter()
        if (targetCharacter && targetCharacter.type !== 'group') {
            targetCharacter.globalLore = context.char.globalLore
        }
    },
    v2RegexTest: (effect, context) => {
        try {
            const value = resolveTriggerInput(context, effect.value, effect.valueType)
            const regexPattern = resolveTriggerInput(context, effect.regex, effect.regexType)
            const flags = resolveTriggerInput(context, effect.flags, effect.flagsType)
            const result = new RegExp(regexPattern, flags).test(value)
            context.setVar(resolveTriggerOutputKey(context, effect.outputVar), result ? '1' : '0')
        }
        catch {
            context.setVar(resolveTriggerOutputKey(context, effect.outputVar), '0')
        }
    },
    v2GetReplaceGlobalNote: (effect, context) => {
        context.setVar(resolveTriggerOutputKey(context, effect.outputVar), context.char.replaceGlobalNote ?? '')
    },
    v2SetReplaceGlobalNote: (effect, context) => {
        const value = resolveTriggerInput(context, effect.value, effect.valueType)
        context.char.replaceGlobalNote = value
        const targetCharacter = context.resolveTargetCharacter()
        if (targetCharacter && targetCharacter.type !== 'group') {
            targetCharacter.replaceGlobalNote = value
        }
    },
    v2GetAuthorNote: (effect, context) => {
        context.setVar(resolveTriggerOutputKey(context, effect.outputVar), context.state.chat.note ?? '')
    },
    v2SetAuthorNote: (effect, context) => {
        const value = resolveTriggerInput(context, effect.value, effect.valueType)
        context.state.chat.note = value
        if (!context.arg.displayMode) {
            const targetChat = context.resolveTargetChat()
            if (targetChat) {
                targetChat.note = value
            }
        }
    },
    v2MakeDictVar: (effect, context) => {
        if (effect.var.startsWith('{') && effect.var.endsWith('}')) {
            return { abortRun: true }
        }
        context.setVar(parseTriggerValue(context, effect.var), '{}')
    },
    v2GetDictVar: (effect, context) => {
        try {
            const dict = JSON.parse(resolveTriggerInput(context, effect.var, effect.varType))
            const key = resolveTriggerInput(context, effect.key, effect.keyType)
            context.setVar(resolveTriggerOutputKey(context, effect.outputVar), dict[key] ?? 'null')
        }
        catch {
            context.setVar(resolveTriggerOutputKey(context, effect.outputVar), 'null')
        }
    },
    v2SetDictVar: (effect, context) => {
        try {
            if (effect.varType === 'value') {
                return
            }
            const varName = parseTriggerValue(context, effect.var)
            const dict = JSON.parse(context.getVar(varName))
            const key = resolveTriggerInput(context, effect.key, effect.keyType)
            const value = resolveTriggerInput(context, effect.value, effect.valueType)
            dict[key] = value
            context.setVar(varName, JSON.stringify(dict))
        }
        catch {
            if (effect.varType === 'var') {
                const dict = {}
                dict[resolveTriggerInput(context, effect.key, effect.keyType)] = resolveTriggerInput(context, effect.value, effect.valueType)
                context.setVar(parseTriggerValue(context, effect.var), JSON.stringify(dict))
            }
        }
    },
    v2DeleteDictKey: (effect, context) => {
        try {
            if (effect.varType === 'value') {
                return
            }
            const varName = parseTriggerValue(context, effect.var)
            const dict = JSON.parse(context.getVar(varName))
            delete dict[resolveTriggerInput(context, effect.key, effect.keyType)]
            context.setVar(varName, JSON.stringify(dict))
        }
        catch {
            if (effect.varType === 'var') {
                context.setVar(parseTriggerValue(context, effect.var), '{}')
            }
        }
    },
    v2HasDictKey: (effect, context) => {
        try {
            const dict = JSON.parse(resolveTriggerInput(context, effect.var, effect.varType))
            const key = resolveTriggerInput(context, effect.key, effect.keyType)
            context.setVar(resolveTriggerOutputKey(context, effect.outputVar), Object.hasOwn(dict, key) ? '1' : '0')
        }
        catch {
            context.setVar(resolveTriggerOutputKey(context, effect.outputVar), '0')
        }
    },
    v2ClearDict: (effect, context) => {
        if (effect.var.startsWith('{') && effect.var.endsWith('}')) {
            return { abortRun: true }
        }
        context.setVar(parseTriggerValue(context, effect.var), '{}')
    },
    v2GetDictSize: (effect, context) => {
        try {
            const dict = JSON.parse(resolveTriggerInput(context, effect.var, effect.varType))
            context.setVar(resolveTriggerOutputKey(context, effect.outputVar), Object.keys(dict).length.toString())
        }
        catch {
            context.setVar(resolveTriggerOutputKey(context, effect.outputVar), '0')
        }
    },
    v2GetDictKeys: (effect, context) => {
        try {
            const dict = JSON.parse(resolveTriggerInput(context, effect.var, effect.varType))
            context.setVar(resolveTriggerOutputKey(context, effect.outputVar), JSON.stringify(Object.keys(dict)))
        }
        catch {
            context.setVar(resolveTriggerOutputKey(context, effect.outputVar), '[]')
        }
    },
    v2GetDictValues: (effect, context) => {
        try {
            const dict = JSON.parse(resolveTriggerInput(context, effect.var, effect.varType))
            context.setVar(resolveTriggerOutputKey(context, effect.outputVar), JSON.stringify(Object.values(dict)))
        }
        catch {
            context.setVar(resolveTriggerOutputKey(context, effect.outputVar), '[]')
        }
    },
    v2Calculate: (effect, context) => {
        try {
            let expression = resolveTriggerInput(context, effect.expression, effect.expressionType)
            expression = expression.replace(/\$([a-zA-Z0-9_]+)/g, (_match, varName) => {
                const parsed = parseFloat(context.getVar(varName))
                return Number.isNaN(parsed) ? '0' : parsed.toString()
            })
            context.setVar(resolveTriggerOutputKey(context, effect.outputVar), calcString(expression).toString())
        }
        catch {
            context.setVar(resolveTriggerOutputKey(context, effect.outputVar), '0')
        }
    },
    v2ReplaceString: (effect, context) => {
        try {
            const source = resolveTriggerInput(context, effect.source, effect.sourceType)
            const regexPattern = resolveTriggerInput(context, effect.regex, effect.regexType)
            const resultFormat = resolveTriggerInput(context, effect.result, effect.resultType)
            const replacement = resolveTriggerInput(context, effect.replacement, effect.replacementType)
            const flags = resolveTriggerInput(context, effect.flags, effect.flagsType)

            const regex = new RegExp(regexPattern, flags)
            const result = source.replace(regex, (...args) => {
                const match = args[0]
                const groups = args.slice(1, -2)
                const targetGroupMatch = resultFormat.match(/^\$(\d+)$/)

                if (targetGroupMatch) {
                    const targetIndex = Number(targetGroupMatch[1])
                    if (targetIndex === 0) {
                        return replacement
                    }
                    const targetGroup = groups[targetIndex - 1]
                    if (targetGroup) {
                        return match.replace(targetGroup, replacement)
                    }
                }

                return resultFormat
                    .replace(/\$[0-9]+/g, (placeholder) => {
                        const index = Number(placeholder.slice(1))
                        return index === 0 ? match : (groups[index - 1] || '')
                    })
                    .replace(/\$&/g, match)
                    .replace(/\$\$/g, '$')
            })

            context.setVar(resolveTriggerOutputKey(context, effect.outputVar), result)
        }
        catch {
            context.setVar(resolveTriggerOutputKey(context, effect.outputVar), resolveTriggerInput(context, effect.source, effect.sourceType))
        }
    },
    v2Comment: () => {},
    v2DeclareLocalVar: (effect, context) => {
        const effectValue = resolveTriggerInput(context, effect.value, effect.valueType)
        const varKey = parseTriggerValue(context, effect.var)
        const finalValue = effectValue === null || effectValue === undefined ? 'null' : effectValue
        context.declareLocalVar(varKey, finalValue, effect.indent)
    }
}

for (const [type, handler] of Object.entries(triggerV2RuntimeHandlers) as [TriggerV2EffectType, TriggerV2RuntimeHandler<TriggerV2EffectType>][]) {
    if (handler) {
        triggerV2Registry[type].run = handler as never
    }
}

export async function runTrigger(char:character,mode:triggerMode, arg:RunTriggerArg){
    arg.recursiveCount ??= 0
    char = arg.displayMode ? char : safeStructuredClone(char)
    let varChanged = false
    let stopSending = arg.stopSending ?? false
    const CharacterlowLevelAccess = char.lowLevelAccess ?? false
    let sendAIprompt = false
    let additonalSysPrompt:additonalSysPrompt = arg.additonalSysPrompt ?? {
        start:'',
        historyend: '',
        promptend: ''
    }
    const triggers = char.triggerscript.map((v) => {
        v.lowLevelAccess = CharacterlowLevelAccess
        return v
    }).concat(getModuleTriggers())
    const db = getDatabase()
    const defaultVariables = parseKeyValue(char.defaultVariables).concat(parseKeyValue(db.templateDefaultVariables))
    let chat = arg.displayMode ? arg.chat : safeStructuredClone(arg.chat ?? char.chats[char.chatPage])
    const stableTarget = !arg.displayMode && char?.chaId
        ? {
            characterId: char.chaId,
            chatId: arg.chat?.id ?? '',
        }
        : null

    function resolveTargetState() {
        if (!stableTarget) {
            return {
                character: null,
                characterIndex: -1,
                chat: null,
                chatIndex: -1,
                messages: [],
            }
        }
        if (stableTarget.chatId) {
            const resolvedState = resolveChatStateByCharacterAndChatId(
                db.characters,
                stableTarget.characterId,
                stableTarget.chatId,
            )
            if (resolvedState.character) {
                return resolvedState
            }
        }
        const targetCharacter = resolveCharacterEntryById(db.characters, stableTarget.characterId)
        const fallbackChat = targetCharacter?.chats?.[targetCharacter.chatPage] ?? null
        return {
            character: targetCharacter,
            characterIndex: db.characters.findIndex((entry) => entry?.chaId === stableTarget.characterId),
            chat: fallbackChat,
            chatIndex: fallbackChat ? targetCharacter.chats.findIndex((entry) => entry === fallbackChat) : -1,
            messages: fallbackChat?.message ?? [],
        }
    }

    function resolveTargetCharacter() {
        return resolveTargetState().character
    }

    function resolveTargetChat() {
        return resolveTargetState().chat
    }
    
    const previousTriggerId = get(CurrentTriggerIdStore)
    const shouldSetTriggerId = !arg.displayMode && mode !== 'display'
    if (shouldSetTriggerId) {
        CurrentTriggerIdStore.set(arg.triggerId || null)
    }
    
    if((!triggers) || (triggers.length === 0)){
        if (shouldSetTriggerId) {
            CurrentTriggerIdStore.set(previousTriggerId)
        }
        return null
    }

    const tempVars:Record<string, string | number> = arg.tempVars ?? {}
    
    let localVarScopes: Record<number, Record<string, string>>[] = [{}]
    let currentIndent = 0
    

    function getLocalVar(key: string): string | null {
        if (!localVarScopes || localVarScopes.length === 0) {
            return null
        }
        const currentScope = localVarScopes[localVarScopes.length - 1]
        if (!currentScope) {
            return null
        }
        for (let indent = currentIndent; indent >= 0; indent--) {
            if (currentScope[indent] && currentScope[indent][key] !== undefined) {
                const value = currentScope[indent][key]
                return value
            }
        }
        return null
    }
    
    function setLocalVar(key: string, value: string, indent: number) {
        if (!localVarScopes || localVarScopes.length === 0) {
            localVarScopes = [{}]
        }
        const currentScope = localVarScopes[localVarScopes.length - 1]
        if (!currentScope) {
            return
        }
        
        const finalValue = (value === null || value === undefined) ? 'null' : value
        
        let foundIndent = -1
        for (let i = indent; i >= 0; i--) {
            if (currentScope[i] && currentScope[i][key] !== undefined) {
                foundIndent = i
                break
            }
        }
        
        const targetIndent = foundIndent !== -1 ? foundIndent : indent
        
        if (!currentScope[targetIndent]) {
            currentScope[targetIndent] = {}
        }
        
        currentScope[targetIndent][key] = finalValue
    }
    
    function declareLocalVar(key: string, value: string, indent: number) {
        setLocalVar(key, value, indent)
    }
    
    function clearLocalVarsAtIndent(indent: number) {
        if (!localVarScopes || localVarScopes.length === 0) {
            return
        }
        const currentScope = localVarScopes[localVarScopes.length - 1]
        if (!currentScope) {
            return
        }
        const indentsToDelete: string[] = []
        for (const scopeIndent in currentScope) {
            if (Number(scopeIndent) >= indent) {
                indentsToDelete.push(scopeIndent)
            }
        }
        indentsToDelete.forEach(indentKey => {
            delete currentScope[indentKey]
        })
    }

    function getVar(key:string){
        const localVar = getLocalVar(key)
        if(localVar !== null){
            return localVar
        }
        
        const state = chat.scriptstate?.['$' + key]
        if(state === undefined || state === null){
            const findResult = defaultVariables.find((f) => {
                return f[0] === key
            })
            if(findResult){
                return findResult[1]
            }
            if(arg.displayMode){
                return String(tempVars[key] ?? 'null')
            }
            return 'null'
        }
        return state.toString()
    }

    function setVar(key:string, value:string){
        if(arg.displayMode){
            tempVars[key] = value
            return
        }
        
        const localVar = getLocalVar(key)
        if(localVar !== null){
            setLocalVar(key, value, currentIndent)
            return
        }
        
        varChanged = true
        chat.scriptstate ??= {}
        chat.scriptstate['$' + key] = value
        const targetChat = resolveTargetChat()
        if (targetChat) {
            targetChat.scriptstate = chat.scriptstate
        }
    }
    
    
    for(const trigger of triggers){
        const tempVars:Record<string, number> = {}

        if(trigger.effect[0]?.type === 'triggercode' || trigger.effect[0]?.type === 'triggerlua'){
            //
        }
        else if(arg.manualName){
            if(trigger.comment !== arg.manualName){
                continue
            }
        }
        else if(mode !== trigger.type){
            continue
        }

        let pass = true
        for(const condition of trigger.conditions){
            if(condition.type === 'var' || condition.type === 'chatindex' || condition.type === 'value'){
                let varValue =  (condition.type === 'var') ? (getVar(condition.var) ?? 'null') :
                                (condition.type === 'chatindex') ? (chat.message.length.toString()) :
                                (condition.type === 'value') ? condition.var : null
                                
                if(varValue === undefined || varValue === null){
                    pass = false
                    break
                }
                else{
                    const conditionValue = risuChatParser(condition.value,{chara:char})
                    varValue = risuChatParser(varValue,{chara:char})
                    switch(condition.operator){
                        case 'true': {
                            if(varValue !== 'true' && varValue !== '1'){
                                pass = false
                            }
                            break
                        }
                        case '=':
                            if(varValue !== conditionValue){
                                pass = false
                            }
                            break
                        case '!=':
                            if(varValue === conditionValue){
                                pass = false
                            }
                            break
                        case '>':
                            if(Number(varValue) <= Number(conditionValue)){
                                pass = false
                            }
                            break
                        case '<':
                            if(Number(varValue) >= Number(conditionValue)){
                                pass = false
                            }
                            break
                        case '>=':
                            if(Number(varValue) < Number(conditionValue)){
                                pass = false
                            }
                            break
                        case '<=':
                            if(Number(varValue) > Number(conditionValue)){
                                pass = false
                            }
                            break
                        case 'null':
                            if(varValue !== 'null'){
                                pass = false
                            }
                            break
                    }
                }
            }
            else if(condition.type === 'exists'){
                const conditionValue = risuChatParser(condition.value,{chara:char})
                const val = risuChatParser(conditionValue,{chara:char})
                const da =  chat.message.slice(0-condition.depth).map((v)=>v.data).join(' ')
                if(condition.type2 === 'strict'){
                    pass = da.split(' ').includes(val)
                }
                else if(condition.type2 === 'loose'){
                    pass = da.toLowerCase().includes(val.toLowerCase())
                }
                else if(condition.type2 === 'regex'){
                    pass = new RegExp(val).test(da)
                }
            }
            if(!pass){
                break
            }
        }
        if(!pass){
            continue
        }

        for(let index = 0; index < trigger.effect.length; index++){
            const effect = trigger.effect[index]
            if(mode === 'display' && (!isTriggerV2EffectType(effect.type) || !isTriggerV2DisplayAllowed(effect.type))){
                continue
            }
            if(mode === 'request' && (!isTriggerV2EffectType(effect.type) || !isTriggerV2RequestAllowed(effect.type))){
                continue
            }
            
            if(effect && 'indent' in effect && typeof effect.indent === 'number' && effect.indent >= 0){
                currentIndent = effect.indent
            } else if(!effect || !('indent' in effect)) {
                currentIndent = 0
            }
            
            switch(effect.type){
                case'setvar': {
                    const effectValue = risuChatParser(effect.value,{chara:char})
                    const varKey  = risuChatParser(effect.var,{chara:char})
                    let originalVar = Number(getVar(varKey))
                    if(Number.isNaN(originalVar)){
                        originalVar = 0
                    }
                    let resultValue = ''
                    switch(effect.operator){
                        case '=':{
                            resultValue = effectValue
                            break
                        }
                        case '+=':{
                            resultValue = (originalVar + Number(effectValue)).toString()
                            break
                        }
                        case '-=':{
                            resultValue = (originalVar - Number(effectValue)).toString()
                            break
                        }
                        case '*=':{
                            resultValue = (originalVar * Number(effectValue)).toString()
                            break
                        }
                        case '/=':{
                            resultValue = (originalVar / Number(effectValue)).toString()
                            break
                        }
                    }
                    setVar(varKey, resultValue)
                    break
                }
                case 'systemprompt':{
                    const effectValue = risuChatParser(effect.value,{chara:char})
                    additonalSysPrompt[effect.location] += effectValue + "\n\n"
                    break
                }
                case 'impersonate':{
                    const effectValue = risuChatParser(effect.value,{chara:char})
                    if(effect.role === 'user'){
                        chat.message.push({role: 'user', data: effectValue})
                    }
                    else if(effect.role === 'char'){
                        chat.message.push({role: 'char', data: effectValue})
                    }
                    break
                }
                case 'command':{
                    const effectValue = risuChatParser(effect.value,{chara:char})
                    await processMultiCommand(effectValue)
                    break
                }
                case 'stop':{
                    stopSending = true
                    break
                }
                case 'runtrigger':{
                    if(arg.recursiveCount < 10 || trigger.lowLevelAccess){
                        arg.recursiveCount++
                        const r = await runTrigger(char,'manual',{
                            chat,
                            recursiveCount: arg.recursiveCount,
                            additonalSysPrompt,
                            stopSending,
                            manualName: effect.value
                        })
                        if(r){
                            additonalSysPrompt = r.additonalSysPrompt
                            chat = r.chat
                            stopSending = r.stopSending
                        }
                    }
                    break
                }
                case 'cutchat':{
                    const start = Number(risuChatParser(effect.start,{chara:char}))
                    const end = Number(risuChatParser(effect.end,{chara:char}))
                    chat.message = chat.message.slice(start,end)
                    break
                }
                case 'modifychat':{
                    const index = Number(risuChatParser(effect.index,{chara:char}))
                    const value = risuChatParser(effect.value,{chara:char})
                    if(chat.message[index]){
                        chat.message[index].data = value
                    }
                    break
                }

                // low level access only
                case 'showAlert':{
                    if(!trigger.lowLevelAccess){
                        break
                    }

                    if(arg.displayMode){
                        return
                    }

                    const effectValue = risuChatParser(effect.value,{chara:char})
                    const inputVar = risuChatParser(effect.inputVar,{chara:char})

                    switch(effect.alertType){
                        case 'normal':{
                            alertNormal(effectValue)
                            break
                        }
                        case 'error':{
                            alertError(effectValue)
                            break
                        }
                        case 'input':{
                            const val = await alertInput(effectValue)
                            setVar(inputVar, val)
                            break;
                        }
                        case 'select':{
                            const val = await alertSelect(effectValue.split('§'))
                            setVar(inputVar, val)
                        }
                    }
                    break
                }

                case 'sendAIprompt':{
                    if(!trigger.lowLevelAccess){
                        break
                    }
                    sendAIprompt = true
                    break
                }

                case 'runLLM':{
                    if(!trigger.lowLevelAccess){
                        break
                    }
                    const effectValue = risuChatParser(effect.value,{chara:char})
                    const varName = effect.inputVar
                    let promptbody:OpenAIChat[] = parseChatML(effectValue)
                    if(!promptbody){
                        promptbody = [{role:'user', content:effectValue}]
                    }
                    const result = await requestChatData({
                        formated: promptbody,
                        bias: {},
                        useStreaming: false,
                        noMultiGen: true,
                    }, 'model')

                    if(result.type === 'fail' || result.type === 'streaming' || result.type === 'multiline'){
                        setVar(varName, 'Error: ' + result.result)
                    }
                    else{
                        setVar(varName, result.result)
                    }

                    break
                }

                case 'checkSimilarity':{
                    if(!trigger.lowLevelAccess){
                        break
                    }

                    const processer = new EmbeddingProcessor()
                    const effectValue = risuChatParser(effect.value,{chara:char})
                    const source = risuChatParser(effect.source,{chara:char})
                    await processer.addText(effectValue.split('§'))
                    const val = await processer.similaritySearch(source)
                    setVar(effect.inputVar, val.join('§'))
                    break
                }

                case 'extractRegex':{
                    if(!trigger.lowLevelAccess){
                        break
                    }

                    const effectValue = risuChatParser(effect.value,{chara:char})
                    const regex = new RegExp(effect.regex, effect.flags)
                    const regexResult = regex.exec(effectValue)
                    const result = effect.result.replace(/\$[0-9]+/g, (match) => {
                        const index = Number(match.slice(1))
                        return regexResult[index]
                    }).replace(/\$&/g, regexResult[0]).replace(/\$\$/g, '$')

                    setVar(effect.inputVar, result)
                    break
                }

                case 'triggerlua':{
                    const triggerCodeResult = await runScripted(effect.code,{
                        lowLevelAccess: trigger.lowLevelAccess,
                        mode: mode === 'manual' ? arg.manualName : mode,
                        setVar: setVar,
                        getVar: getVar,
                        char: char,
                        chat: chat,
                    })

                    if(triggerCodeResult.stopSending){
                        stopSending = true
                    }
                    chat = triggerCodeResult.chat
                    break
                }
                default: {
                    if (!effect.type.startsWith('v2')) {
                        break
                    }

                    const definition = getTriggerV2Definition(effect.type as TriggerV2EffectType)
                    if (!definition.run) {
                        break
                    }

                    const runtimeContext: TriggerV2RuntimeContext = {
                        char,
                        mode,
                        trigger,
                        arg,
                        state: {
                            chat,
                            additonalSysPrompt,
                            stopSending,
                            sendAIprompt,
                            currentIndent,
                            index,
                            displayData: arg.displayData,
                            tempVars
                        },
                        getVar,
                        setVar,
                        declareLocalVar,
                        clearLocalVarsAtIndent,
                        resolveTargetCharacter,
                        resolveTargetChat
                    }

                    const control = await definition.run(effect as never, runtimeContext)

                    chat = runtimeContext.state.chat
                    additonalSysPrompt = runtimeContext.state.additonalSysPrompt
                    stopSending = runtimeContext.state.stopSending
                    sendAIprompt = runtimeContext.state.sendAIprompt
                    currentIndent = runtimeContext.state.currentIndent
                    index = runtimeContext.state.index
                    arg.displayData = runtimeContext.state.displayData

                    if (control && control.abortRun) {
                        return
                    }
                    break
                }
            }
        }
    }
    
    let caculatedTokens = 0
    if(additonalSysPrompt.start){
        caculatedTokens += await tokenize(additonalSysPrompt.start)
    }
    if(additonalSysPrompt.historyend){
        caculatedTokens += await tokenize(additonalSysPrompt.historyend)
    }
    if(additonalSysPrompt.promptend){
        caculatedTokens += await tokenize(additonalSysPrompt.promptend)
    }
    if(varChanged){
        const targetChat = resolveTargetChat()
        if (targetChat) {
            targetChat.scriptstate = chat.scriptstate
        }
        ReloadGUIPointer.set(get(ReloadGUIPointer) + 1)
    }

    if (shouldSetTriggerId && mode !== 'manual') {
        CurrentTriggerIdStore.set(previousTriggerId)
    }
    
    return {additonalSysPrompt, chat, tokens:caculatedTokens, stopSending, sendAIprompt, displayData: arg.displayData, tempVars: arg.tempVars}

}
