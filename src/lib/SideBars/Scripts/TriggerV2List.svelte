<script lang="ts">
     
    import { PlusIcon, ArrowLeftIcon, DownloadIcon, UploadIcon } from "@lucide/svelte";
    import { language } from "src/lang";
    import Button from "src/lib/UI/GUI/Button.svelte";
    import CheckInput from "src/lib/UI/GUI/CheckInput.svelte";
    import OptionInput from "src/lib/UI/GUI/OptionInput.svelte";
    import Portal from "src/lib/UI/GUI/Portal.svelte";
    import SelectInput from "src/lib/UI/GUI/SelectInput.svelte";
    import TextInput from "src/lib/UI/GUI/TextInput.svelte";
    import TextAreaInput from "src/lib/UI/GUI/TextAreaInput.svelte";
    import Help from "src/lib/Others/Help.svelte";
    import { type triggerEffectV2, type triggerEffect, type triggerscript, displayAllowList, requestAllowList, type triggerV2IfAdvanced } from "src/ts/process/triggers";
    import { onMount } from "svelte";
    import DOMPurify from "dompurify";
    import { DBState } from "src/ts/stores.svelte";
    const triggerV2ListLog = (..._args: unknown[]) => {};

    interface Props {
        value?: triggerscript[];
        lowLevelAble?: boolean;
    }

    const effectCategories = {
        'Special': [
            'v2GetDisplayState',
            'v2SetDisplayState',
            'v2GetRequestState',
            'v2SetRequestState',
            'v2GetRequestStateRole',
            'v2SetRequestStateRole',
            'v2GetRequestStateLength'
        ],
        'Control': [
            'v2SetVar',
            'v2DeclareLocalVar',
            'v2Calculate',
            'v2IfAdvanced',
            'v2LoopNTimes',
            'v2Loop',
            'v2BreakLoop',
            'v2Command',
            'v2ConsoleLog',
            'v2RunTrigger',
            'v2StopTrigger',
            'v2Comment'
        ],
        'Chat': [
            'v2CutChat',
            'v2ModifyChat',
            'v2Impersonate',
            'v2GetLastMessage',
            'v2GetLastUserMessage',
            'v2GetLastCharMessage',
            'v2GetMessageAtIndex',
            'v2GetMessageCount',
            'v2GetFirstMessage',
            'v2QuickSearchChat'
        ],
        'Low Level': [
            'v2SendAIprompt',
            'v2CheckSimilarity',
            'v2RunLLM'
        ],
        'Alert': [
            'v2ShowAlert',
            'v2GetAlertInput',
            'v2GetAlertSelect'
        ],
        'Lorebook V2': [
            'v2GetAllLorebooks',
            'v2GetLorebookByName',
            'v2GetLorebookByIndex',
            'v2CreateLorebook',
            'v2ModifyLorebookByIndex',
            'v2DeleteLorebookByIndex',
            'v2GetLorebookCountNew',
            'v2SetLorebookAlwaysActive'
        ],
        'String': [
            'v2RegexTest',
            'v2ExtractRegex',
            'v2GetCharAt',
            'v2GetCharCount',
            'v2ToLowerCase',
            'v2ToUpperCase',
            'v2SetCharAt',
            'v2SplitString',
            'v2ConcatString',
            'v2ReplaceString'
        ],
        'Data': [
            'v2GetCharacterDesc',
            'v2SetCharacterDesc',
            'v2GetPersonaDesc',
            'v2SetPersonaDesc',
            'v2GetReplaceGlobalNote',
            'v2SetReplaceGlobalNote',
            'v2GetAuthorNote',
            'v2SetAuthorNote'
        ],
        'Array': [
            'v2MakeArrayVar',
            'v2GetArrayVarLength',
            'v2GetArrayVar',
            'v2SetArrayVar',
            'v2PushArrayVar',
            'v2PopArrayVar',
            'v2ShiftArrayVar',
            'v2UnshiftArrayVar',
            'v2SpliceArrayVar',
            'v2SliceArrayVar',
            'v2GetIndexOfValueInArrayVar',
            'v2RemoveIndexFromArrayVar',
            'v2JoinArrayVar'
        ],
        'Dictionary': [
            'v2MakeDictVar',
            'v2GetDictVar',
            'v2SetDictVar',
            'v2DeleteDictKey',
            'v2HasDictKey',
            'v2ClearDict',
            'v2GetDictSize',
            'v2GetDictKeys',
            'v2GetDictValues'
        ],
        'Others': [
            'v2Random',
            'v2UpdateGUI',
            'v2SystemPrompt',
            'v2UpdateChatAt',
            'v2Wait',
            'v2StopPromptSending',
            'v2Tokenize'
        ],
        'Deprecated': [
            'v2If',
            'v2ModifyLorebook',
            'v2GetLorebook',
            'v2GetLorebookCount',
            'v2GetLorebookEntry',
            'v2SetLorebookActivation',
            'v2GetLorebookIndexViaName'
        ]
    }

    let lastClickTime = 0
    let { value = $bindable([]), lowLevelAble = false }: Props = $props();
    let selectedIndex = $state(0);
    let selectedEffectIndex = $state(-1);
    let selectedTriggerIndices = $state<number[]>([]);
    let lastSelectedTriggerIndex = $state(-1);
    let menuMode = $state(0)
    let isDragging = $state(false);
    let dragOverIndex = $state(-1);
    let isEffectDragging = $state(false);
    let effectDragOverIndex = $state(-1);
    let editTrigger:triggerEffectV2 = $state(null as triggerEffectV2)
    let addElse = $state(false)
    let selectMode = $state(0) //0 = trigger 1 = effect
    let contextMenu = $state(false)
    let contextMenuLoc = $state({x: 0, y: 0, style: ''})
    let selectedTriggerIndex = $state(0)
    let selectedEffectIndexSaved = $state(-1)
    const effectElements = $state<HTMLButtonElement[]>([])
    let guideLineKey = $state(0)
    let selectedCategory = $state('Control')
    let isMobileScreen = $state(false)
    let previousMenuMode = $state(0)    
    let menu0Container = $state<HTMLDivElement | null>(null)
    let triggerScrollRef = $state<HTMLDivElement | null>(null)
    
    let isRestoringMode = $state(false)
    let previousSelectedTriggerIndex = $state(-1)
    
    const scrollManager = $state({
        mode0ScrollPosition: { menu0: 0, trigger: 0 },
        otherModeScrollPositions: new Map([
            [1, { menu0: 0, trigger: 0 }],
            [2, { menu0: 0, trigger: 0 }],
            [3, { menu0: 0, trigger: 0 }]
        ]),
        autoScrollInterval: null as number | null,
        scrollSpeed: 8,
        scrollThreshold: 50,
        
        saveMode0ScrollPositions() {
            try {
                if (menu0Container) {
                    this.mode0ScrollPosition.menu0 = menu0Container.scrollTop
                }
                if (triggerScrollRef && typeof triggerScrollRef.scrollTop === 'number') {
                    this.mode0ScrollPosition.trigger = triggerScrollRef.scrollTop
                }
            } catch (e) {
                triggerV2ListLog('Failed to save mode0 scroll positions:', e)
            }
        },
        
        restoreMode0ScrollPositions() {
            try {
                setTimeout(() => {
                    if (menu0Container) {
                        menu0Container.scrollTop = this.mode0ScrollPosition.menu0
                    }
                    if (triggerScrollRef && triggerScrollRef.scrollTop !== null && triggerScrollRef.scrollTop !== undefined) {
                        triggerScrollRef.scrollTop = this.mode0ScrollPosition.trigger
                    }
                }, 10)
            } catch (e) {
                triggerV2ListLog('Failed to restore mode0 scroll positions:', e)
            }
        },
        
        saveOtherModeScrollPositions(mode: number) {
            try {
                if (mode === 0) return
                
                const positions = this.otherModeScrollPositions.get(mode) || { menu0: 0, trigger: 0 }
                if (menu0Container) {
                    positions.menu0 = menu0Container.scrollTop
                }
                if (triggerScrollRef && typeof triggerScrollRef.scrollTop === 'number') {
                    positions.trigger = triggerScrollRef.scrollTop
                }
                this.otherModeScrollPositions.set(mode, positions)
            } catch (e) {
                triggerV2ListLog('Failed to save other mode scroll positions:', e)
            }
        },
        
        restoreOtherModeScrollPositions(mode: number) {
            try {
                if (mode === 0) return
                
                const positions = this.otherModeScrollPositions.get(mode) || { menu0: 0, trigger: 0 }
                setTimeout(() => {
                    if (menu0Container) {
                        menu0Container.scrollTop = positions.menu0
                    }
                    if (triggerScrollRef && triggerScrollRef.scrollTop !== null && triggerScrollRef.scrollTop !== undefined) {
                        triggerScrollRef.scrollTop = positions.trigger
                    }
                }, 10)
            } catch (e) {
                triggerV2ListLog('Failed to restore other mode scroll positions:', e)
            }
        },
        
        resetEffectScrollInMode0() {
            try {
                if (menu0Container) {
                    menu0Container.scrollTop = 0
                    this.mode0ScrollPosition.menu0 = 0
                }
            } catch (e) {
                triggerV2ListLog('Failed to reset effect scroll in mode0:', e)
            }
        },
        
        handleTriggerScroll() {
            try {
                if (triggerScrollRef && typeof triggerScrollRef.scrollTop === 'number') {
                    if (menuMode === 0) {
                        this.mode0ScrollPosition.trigger = triggerScrollRef.scrollTop
                    } else {
                        const positions = this.otherModeScrollPositions.get(menuMode) || { menu0: 0, trigger: 0 }
                        positions.trigger = triggerScrollRef.scrollTop
                        this.otherModeScrollPositions.set(menuMode, positions)
                    }
                }
            } catch (e) {
                triggerV2ListLog('Failed to handle trigger scroll:', e)
            }
        },
        
        handleMenu0Scroll() {
            try {
                if (menu0Container && typeof menu0Container.scrollTop === 'number') {
                    if (menuMode === 0) {
                        this.mode0ScrollPosition.menu0 = menu0Container.scrollTop
                    } else {
                        const positions = this.otherModeScrollPositions.get(menuMode) || { menu0: 0, trigger: 0 }
                        positions.menu0 = menu0Container.scrollTop
                        this.otherModeScrollPositions.set(menuMode, positions)
                    }
                }
            } catch (e) {
                triggerV2ListLog('Failed to handle menu0 scroll:', e)
            }
        },
        
        stopAutoScroll() {
            if (this.autoScrollInterval !== null) {
                window.clearInterval(this.autoScrollInterval)
                this.autoScrollInterval = null
            }
        },
        
        startAutoScroll(container: HTMLElement, direction: 'up' | 'down', speed?: number) {
            this.stopAutoScroll()
            const scrollSpeed = speed || this.scrollSpeed
            
            this.autoScrollInterval = window.setInterval(() => {
                if (!container) return
                
                const scrollAmount = direction === 'up' ? -scrollSpeed : scrollSpeed
                container.scrollBy(0, scrollAmount)
                
                if ((direction === 'up' && container.scrollTop <= 0) || 
                    (direction === 'down' && container.scrollTop >= container.scrollHeight - container.clientHeight)) {
                    this.stopAutoScroll()
                }
            }, 16)
        },
        
        checkAutoScrollZone(mouseY: number, containerRect: DOMRect): 'up' | 'down' | null {
            const topZone = containerRect.top + this.scrollThreshold
            const bottomZone = containerRect.bottom - this.scrollThreshold
            
            if (mouseY < topZone) {
                return 'up'
            } else if (mouseY > bottomZone) {
                return 'down'
            }
            
            return null
        }
    })


    type VirtualClipboard = {
        type: 'trigger',
        value: triggerscript[]
    }|{
        type: 'effect',
        value: triggerEffect[]
    }
    let clipboard:VirtualClipboard = $state(null)

    $effect(() => {
        if (!value || value.length === 0) {
            value = [{
                comment: '',
                type: 'start',
                conditions: [],
                effect: []
            }];
        }
    });


    $effect(() => {
        if (value && value.length > 0) {
            if (selectedIndex >= value.length) {
                selectedIndex = Math.max(0, value.length - 1)
                selectedTriggerIndex = selectedIndex
            } else if (selectedIndex < 0) {
                selectedIndex = 0
                selectedTriggerIndex = 0
            }
        }
    })
    
    $effect(() => {
        if(previousMenuMode !== menuMode) {
            if(previousMenuMode === 0 && menuMode !== 0) {
                scrollManager.saveMode0ScrollPositions()
            }
            else if(previousMenuMode !== 0) {
                scrollManager.saveOtherModeScrollPositions(previousMenuMode)
            }
            
            if(menuMode === 0 && previousMenuMode !== 0){
                addElse = false
                isRestoringMode = true
                scrollManager.restoreMode0ScrollPositions()
                
                if(selectedTriggerIndex > 0) {
                    setTimeout(() => {
                        try {
                            if(value && value.length > selectedTriggerIndex) {
                                selectedIndex = selectedTriggerIndex
                                if(selectedEffectIndexSaved >= 0 && value[selectedTriggerIndex]?.effect && selectedEffectIndexSaved < value[selectedTriggerIndex].effect.length) {
                                    selectedEffectIndex = selectedEffectIndexSaved
                                }
                            } else if(value && value.length > 1) {
                                selectedIndex = 1
                                selectedTriggerIndex = 1
                            } else {
                                selectedIndex = 0
                                selectedTriggerIndex = 0
                            }
                        } catch(e) {
                            triggerV2ListLog('Failed to restore trigger selection:', e)
                        }
                        setTimeout(() => {
                            isRestoringMode = false
                        }, 10)
                    }, 15)
                } else {
                    setTimeout(() => {
                        isRestoringMode = false
                    }, 25)
                }
            }
            else if(menuMode !== 0) {
                scrollManager.restoreOtherModeScrollPositions(menuMode)
                if(previousMenuMode === 0) {
                    clearTriggerSelection()
                }
            }
            
            if (menuMode === 0) {
                previousSelectedTriggerIndex = selectedTriggerIndex
            }
            
            previousMenuMode = menuMode
        }
    })

    $effect(() => {
        if (menuMode === 0 && selectedIndex !== selectedTriggerIndex && selectedIndex >= 0 && value && value.length > selectedIndex) {
            selectedTriggerIndex = selectedIndex
            selectedEffectIndex = -1
        }
    })

    $effect(() => {
        if (menuMode === 0 && selectedTriggerIndex >= 0 && !isRestoringMode && previousSelectedTriggerIndex !== selectedTriggerIndex) {
            scrollManager.resetEffectScrollInMode0()
            previousSelectedTriggerIndex = selectedTriggerIndex
        }
    })

    $effect(() => {
        if(menuMode === 0 && selectedIndex >= 0 && value && value.length > selectedIndex) {
            setTimeout(() => updateGuideLines(), 10)
            setTimeout(() => updateGuideLines(), 50)
        }
    })

    $effect(() => {
        if(selectedIndex >= 0 && value && value[selectedIndex]?.effect) {
            void value[selectedIndex].effect.length
            if(menuMode === 0) {
                setTimeout(() => updateGuideLines(), 10)
                setTimeout(() => updateGuideLines(), 100)
            }
        }
    })

    const getFilteredTriggers = () => {
        const allCategories = DBState.db.showDeprecatedTriggerV2 
            ? effectCategories
            : Object.fromEntries(Object.entries(effectCategories).filter(([key]) => key !== 'Deprecated'))
        
        const categoryTriggers = allCategories[selectedCategory] || []
        return categoryTriggers.filter(checkSupported)
    }

    const getAvailableCategories = () => {
        const allCategories = DBState.db.showDeprecatedTriggerV2 
            ? effectCategories
            : Object.fromEntries(Object.entries(effectCategories).filter(([key]) => key !== 'Deprecated'))
        
        return Object.keys(allCategories).filter(category => {
            const categoryTriggers = allCategories[category] || []
            return categoryTriggers.some(checkSupported)
        })
    }

    $effect(() => {
        const availableCategories = getAvailableCategories()
        if (availableCategories.length > 0 && !availableCategories.includes(selectedCategory)) {
            selectedCategory = availableCategories[0]
        }
    })

    const close = () => {
        selectedIndex = 0;
        selectedTriggerIndex = 0;
        selectedEffectIndexSaved = -1;
    }

    const isMultipleSelected = () => {
        return selectedTriggerIndices.length > 0
    }

    const isTriggerSelected = (index: number) => {
        return selectedTriggerIndices.includes(index)
    }

    const clearTriggerSelection = () => {
        selectedTriggerIndices = []
        lastSelectedTriggerIndex = -1
    }

    const importTriggers = () => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json'
        input.onchange = async (event) => {
            const file = (event.target as HTMLInputElement)?.files?.[0]
            if (!file) return
            
            try {
                const text = await file.text()
                const importedTriggers = JSON.parse(text)
                
                if (!Array.isArray(importedTriggers)) {
                    return
                }
                
                for (const trigger of importedTriggers) {
                    if (!Object.hasOwn(trigger, 'comment') || 
                        !Object.hasOwn(trigger, 'type') ||
                        !Object.hasOwn(trigger, 'conditions') ||
                        !Object.hasOwn(trigger, 'effect') ||
                        !Array.isArray(trigger.conditions) ||
                        !Array.isArray(trigger.effect)) {
                        return
                    }
                }
                
                for (const trigger of importedTriggers) {
                    value.push(trigger)
                }
                
            } catch (error) {
                triggerV2ListLog('Import error:', error)
            }
        }
        
        input.click()
    }

    const selectTriggerRange = (startIndex: number, endIndex: number) => {
        const start = Math.min(startIndex, endIndex)
        const end = Math.max(startIndex, endIndex)
        const range = []
        for (let i = start; i <= end; i++) {
            if (i > 0) {
                range.push(i)
            }
        }
        selectedTriggerIndices = range
    }

    const handleTriggerClick = (index: number, event: MouseEvent) => {
        event.preventDefault()
        event.stopPropagation()
        
        if (event.shiftKey && lastSelectedTriggerIndex !== -1) {
            selectTriggerRange(lastSelectedTriggerIndex, index)
        } else {
            selectedTriggerIndices = [index]
            lastSelectedTriggerIndex = index
            selectedIndex = index
            selectedTriggerIndex = index
        }
        selectMode = 0
    }

    const checkSupported = (e:string) => {
        if(!value || value.length === 0 || selectedIndex < 0 || selectedIndex >= value.length || !value[selectedIndex]){
            return false
        }
        if(value[selectedIndex].type === 'display'){
            return displayAllowList.includes(e)
        }
        if(value[selectedIndex].type === 'request'){
            return requestAllowList.includes(e)
        }
        if(effectCategories['Special'].includes(e)){
            return false
        }

        if(lowLevelAble){
            return true
        }
        return !effectCategories['Low Level'].includes(e)
    }
    const makeDefaultEditType = (type:string) => {
        switch(type){
            case 'v2SetVar':
                editTrigger = {
                    type: 'v2SetVar',
                    operator: '=',
                    var: '',
                    value: '',
                    valueType: 'value',
                    indent: 0
                }
                break;
            case 'v2If':
                editTrigger = {
                    type: 'v2If',
                    indent: 0,
                    condition: '=',
                    targetType: 'value',
                    target: '',
                    source: ''
                }
                break;
            case 'v2IfAdvanced':
                editTrigger = {
                    type: 'v2IfAdvanced',
                    indent: 0,
                    condition: '=',
                    targetType: 'value',
                    target: '',
                    sourceType: 'value',
                    source: '',
                }
                break;
            case 'v2Else':
                editTrigger = {
                    type: 'v2Else',
                    indent: 0
                }
                break;
            case 'v2Loop':
                editTrigger = {
                    type: 'v2Loop',
                    indent: 0,
                }
                break;
            case 'v2LoopNTimes':
                editTrigger = {
                    type: 'v2LoopNTimes',
                    indent: 0,
                    value: '',
                    valueType: 'value'
                }
                break;
            case 'v2BreakLoop':
                editTrigger = {
                    type: 'v2BreakLoop',
                    indent: 0
                }
                break;
            case 'v2RunTrigger':
                editTrigger = {
                    type: 'v2RunTrigger',
                    indent: 0,
                    target: ''
                }
                break;
            case 'v2ConsoleLog':
                editTrigger = {
                    type: 'v2ConsoleLog',
                    indent: 0,
                    sourceType: 'value',
                    source: ''
                }
                break;
            case 'v2StopTrigger':
                editTrigger = {
                    type: 'v2StopTrigger',
                    indent: 0
                }
                break;
            case 'v2CutChat':
                editTrigger = {
                    type: 'v2CutChat',
                    indent: 0,
                    start: '0',
                    end: '0',
                    startType: 'value',
                    endType: 'value'
                }
                break;
            case 'v2ModifyChat':
                editTrigger = {
                    type: 'v2ModifyChat',
                    index: '',
                    indexType: 'value',
                    value: '',
                    valueType: 'value',
                    indent: 0
                }
                break;
            case 'v2SystemPrompt':
                editTrigger = {
                    type: 'v2SystemPrompt',
                    location: 'start',
                    value: '',
                    valueType: 'value',
                    indent: 0
                }
                break;
            case 'v2Impersonate':
                editTrigger = {
                    type: 'v2Impersonate',
                    role: 'user',
                    value: '',
                    valueType: 'value',
                    indent: 0
                }
                break;
            case 'v2Command':
                editTrigger = {
                    type: 'v2Command',
                    value: '',
                    valueType: 'value',
                    indent: 0
                }
                break;
            case 'v2SendAIprompt':
                editTrigger = {
                    type: 'v2SendAIprompt',
                    indent: 0
                }
                break;
            case 'v2CheckSimilarity':
                editTrigger = {
                    type: 'v2CheckSimilarity',
                    source: '',
                    sourceType: 'value',
                    value: '',
                    valueType: 'value',
                    outputVar: '',
                    indent: 0
                }
                break;
            case 'v2RunLLM':
                editTrigger = {
                    type: 'v2RunLLM',
                    value: '',
                    valueType: 'value',
                    outputVar: '',
                    indent: 0,
                    model: 'model'
                }
                break;
            case 'v2ShowAlert':
                editTrigger = {
                    type: 'v2ShowAlert',
                    value: '',
                    valueType: 'value',
                    indent: 0
                }
                break;
            case 'v2ExtractRegex':
                editTrigger = {
                    type: 'v2ExtractRegex',
                    value: '',
                    valueType: 'value',
                    regex: '',
                    regexType: 'value',
                    flags: '',
                    flagsType: 'value',
                    result: '',
                    resultType: 'value',
                    outputVar: '',
                    indent: 0
                }
                break;
            case 'v2GetLastMessage':
                editTrigger = {
                    type: 'v2GetLastMessage',
                    outputVar: '',
                    indent: 0
                }
                break;
            case 'v2GetMessageAtIndex':
                editTrigger = {
                    type: 'v2GetMessageAtIndex',
                    index: '',
                    indexType: 'value',
                    outputVar: '',
                    indent: 0
                }
                break;
            case 'v2GetMessageCount':
                editTrigger = {
                    type: 'v2GetMessageCount',
                    outputVar: '',
                    indent: 0
                }
                break;
            case 'v2ModifyLorebook':
                editTrigger = {
                    type: 'v2ModifyLorebook',
                    target: '',
                    targetType: 'value',
                    value: '',
                    valueType: 'value',
                    indent: 0
                }
                break;
            case 'v2GetLorebook':
                editTrigger = {
                    type: 'v2GetLorebook',
                    target: '',
                    targetType: 'value',
                    outputVar: '',
                    indent: 0
                }
                break;
            case 'v2GetLorebookCount':
                editTrigger = {
                    type: 'v2GetLorebookCount',
                    outputVar: '',
                    indent: 0
                }
                break;
            case 'v2GetLorebookEntry':
                editTrigger = {
                    type: 'v2GetLorebookEntry',
                    index: '',
                    indexType: 'value',
                    outputVar: '',
                    indent: 0
                }
                break;
            case 'v2SetLorebookActivation':
                editTrigger = {
                    type: 'v2SetLorebookActivation',
                    index: '',
                    indexType: 'value',
                    value: true,
                    indent: 0
                }
                break;
            case 'v2GetLorebookIndexViaName':
                editTrigger = {
                    type: 'v2GetLorebookIndexViaName',
                    name: '',
                    nameType: 'value',
                    outputVar: '',
                    indent: 0
                }
                break;
            case 'v2Random':
                editTrigger = {
                    type: 'v2Random',
                    outputVar: '',
                    min: '0',
                    max: '100',
                    minType: 'value',
                    maxType: 'value',
                    indent: 0
                }
                break;
            case 'v2GetCharAt':
                editTrigger = {
                    type: 'v2GetCharAt',
                    source: '',
                    sourceType: 'value',
                    index: '',
                    indexType: 'value',
                    outputVar: '',
                    indent: 0
                }
                break;
            case 'v2GetCharCount':
                editTrigger = {
                    type: 'v2GetCharCount',
                    source: '',
                    sourceType: 'value',
                    outputVar: '',
                    indent: 0
                }
                break;
            case 'v2ToLowerCase':
                editTrigger = {
                    type: 'v2ToLowerCase',
                    source: '',
                    sourceType: 'value',
                    outputVar: '',
                    indent: 0
                }
                break;
            case 'v2ToUpperCase':
                editTrigger = {
                    type: 'v2ToUpperCase',
                    source: '',
                    sourceType: 'value',
                    outputVar: '',
                    indent: 0
                }
                break;
            case 'v2SetCharAt':
                editTrigger = {
                    type: 'v2SetCharAt',
                    source: '',
                    sourceType: 'value',
                    index: '',
                    indexType: 'value',
                    value: '',
                    valueType: 'value',
                    outputVar: '',
                    indent: 0
                }
                break;
            case 'v2SplitString':
                editTrigger = {
                    type: 'v2SplitString',
                    source: '',
                    sourceType: 'value',
                    delimiter: '',
                    delimiterType: 'value',
                    outputVar: '',
                    indent: 0
                }
                break;
            case 'v2JoinArrayVar':
                editTrigger = {
                    type: 'v2JoinArrayVar',
                    var: '',
                    varType: 'value',
                    delimiter: '',
                    delimiterType: 'value',
                    outputVar: '',
                    indent: 0
                }
                break;
            case 'v2GetCharacterDesc':
                editTrigger = {
                    type: 'v2GetCharacterDesc',
                    outputVar: '',
                    indent: 0
                }
                break;
            case 'v2SetCharacterDesc':
                editTrigger = {
                    type: 'v2SetCharacterDesc',
                    value: '',
                    valueType: 'value',
                    indent: 0
                }
                break;
            case 'v2GetPersonaDesc':
                editTrigger = {
                    type: 'v2GetPersonaDesc',
                    outputVar: '',
                    indent: 0
                }
                break;
            case 'v2SetPersonaDesc':
                editTrigger = {
                    type: 'v2SetPersonaDesc',
                    value: '',
                    valueType: 'value',
                    indent: 0
                }
                break;
            case 'v2MakeArrayVar':
                editTrigger = {
                    type: 'v2MakeArrayVar',
                    var: '',
                    indent: 0
                }
                break;
            case 'v2GetArrayVarLength':
                editTrigger = {
                    type: 'v2GetArrayVarLength',
                    var: '',
                    outputVar: '',
                    indent: 0
                }
                break;
            case 'v2GetArrayVar':
                editTrigger = {
                    type: 'v2GetArrayVar',
                    var: '',
                    index: '',
                    indexType: 'value',
                    outputVar: '',
                    indent: 0
                }
                break;
            case 'v2SetArrayVar':
                editTrigger = {
                    type: 'v2SetArrayVar',
                    var: '',
                    index: '',
                    indexType: 'value',
                    value: '',
                    valueType: 'value',
                    indent: 0
                }
                break;
            case 'v2Tokenize':{
                editTrigger = {
                    type: 'v2Tokenize',
                    value: '',
                    valueType: 'value',
                    indent: 0,
                    outputVar: ""
                }
                break;
            }
            case 'v2PushArrayVar':
                editTrigger = {
                    type: 'v2PushArrayVar',
                    var: '',
                    value: '',
                    valueType: 'value',
                    indent: 0
                }
                break;
            case 'v2PopArrayVar':
                editTrigger = {
                    type: 'v2PopArrayVar',
                    var: '',
                    outputVar: '',
                    indent: 0
                }
                break;
            case 'v2ShiftArrayVar':
                editTrigger = {
                    type: 'v2ShiftArrayVar',
                    var: '',
                    outputVar: '',
                    indent: 0
                }
                break;
            case 'v2UnshiftArrayVar':
                editTrigger = {
                    type: 'v2UnshiftArrayVar',
                    var: '',
                    value: '',
                    valueType: 'value',
                    indent: 0
                }
                break;
            case 'v2SpliceArrayVar':
                editTrigger = {
                    type: 'v2SpliceArrayVar',
                    var: '',
                    start: '',
                    startType: 'value',
                    item: '',
                    itemType: 'value',
                    indent: 0
                }
                break;
            case 'v2SliceArrayVar':
                editTrigger = {
                    type: 'v2SliceArrayVar',
                    var: '',
                    start: '',
                    startType: 'value',
                    end: '',
                    endType: 'value',
                    outputVar: '',
                    indent: 0
                }
                break;
            case 'v2GetIndexOfValueInArrayVar':
                editTrigger = {
                    type: 'v2GetIndexOfValueInArrayVar',
                    var: '',
                    value: '',
                    valueType: 'value',
                    outputVar: '',
                    indent: 0
                }
                break;
            case 'v2RemoveIndexFromArrayVar':
                editTrigger = {
                    type: 'v2RemoveIndexFromArrayVar',
                    var: '',
                    index: '',
                    indexType: 'value',
                    indent: 0
                }
                break;
            case 'v2ConcatString':
                editTrigger = {
                    type: 'v2ConcatString',
                    source1: '',
                    source1Type: 'value',
                    source2: '',
                    source2Type: 'value',
                    outputVar: '',
                    indent: 0
                }
                break;
            case 'v2GetLastUserMessage':{
                editTrigger = {
                    type: 'v2GetLastUserMessage',
                    outputVar: '',
                    indent: 0
                }
                break;
            }
            case 'v2GetLastCharMessage':{
                editTrigger = {
                    type: 'v2GetLastCharMessage',
                    outputVar: '',
                    indent: 0
                }
                break;
            }
            case 'v2GetFirstMessage':{
                editTrigger = {
                    type: 'v2GetFirstMessage',
                    outputVar: '',
                    indent: 0
                }
                break;
            }
            case 'v2GetAlertInput':{
                editTrigger = {
                    type: 'v2GetAlertInput',
                    outputVar: '',
                    indent: 0,
                    display: '',
                    displayType: 'value'
                }
                break;
            }
            case 'v2GetAlertSelect':{
                editTrigger = {
                    type: 'v2GetAlertSelect',
                    display: '',
                    displayType: 'value',
                    value: '',
                    valueType: 'value',
                    outputVar: '',
                    indent: 0
                }
                break;
            }
            case 'v2GetDisplayState':{
                editTrigger = {
                    type: 'v2GetDisplayState',
                    outputVar: '',
                    indent: 0
                }
                break;
            }
            case 'v2SetDisplayState':{
                editTrigger = {
                    type: 'v2SetDisplayState',
                    value: '',
                    valueType: 'value',
                    indent: 0
                }
                break;
            }
            case 'v2UpdateGUI':{
                editTrigger = {
                    type: 'v2UpdateGUI',
                    indent: 0
                }
                break;
            }
            case 'v2UpdateChatAt':{
                editTrigger = {
                    type: 'v2UpdateChatAt',
                    index: '0',
                    indent: 0
                }
                break;
            }
            case 'v2Wait':{
                editTrigger = {
                    type: 'v2Wait',
                    value: '1',
                    valueType: 'value',
                    indent: 0
                }
                break;
            }
            case 'v2GetRequestState':{
                editTrigger = {
                    type: 'v2GetRequestState',
                    outputVar: '',
                    index: '',
                    indexType: 'value',
                    indent: 0
                }
                break;
            }
            case 'v2SetRequestState':{
                editTrigger = {
                    type: 'v2SetRequestState',
                    value: '',
                    valueType: 'value',
                    index: '',
                    indexType: 'value',
                    indent: 0
                }
                break;
            }
            case 'v2GetRequestStateRole':{
                editTrigger = {
                    type: 'v2GetRequestStateRole',
                    outputVar: '',
                    index: '',
                    indexType: 'value',
                    indent: 0
                }
                break;
            }
            case 'v2SetRequestStateRole':{
                editTrigger = {
                    type: 'v2SetRequestStateRole',
                    value: '',
                    valueType: 'value',
                    index: '',
                    indexType: 'value',
                    indent: 0
                }
                break;
            }
            case 'v2GetRequestStateLength':{
                editTrigger = {
                    type: 'v2GetRequestStateLength',
                    outputVar: '',
                    indent: 0
                }
                break;
            }
            case 'v2StopPromptSending':{
                editTrigger = {
                    type: 'v2StopPromptSending',
                    indent: 0
                }
                break;
            }
            case 'v2QuickSearchChat':{
                editTrigger = {
                    type: 'v2QuickSearchChat',
                    value: '',
                    valueType: 'value',
                    indent: 0,
                    condition: 'loose',
                    depth: '3',
                    depthType: 'value',
                    outputVar: ''
                }
                break;
            }
            case 'v2GetAllLorebooks':{
                editTrigger = {
                    type: 'v2GetAllLorebooks',
                    outputVar: '',
                    indent: 0
                }
                break;
            }
            case 'v2RegexTest':{
                editTrigger = {
                    type: 'v2RegexTest',
                    value: '',
                    valueType: 'value',
                    regex: '',
                    regexType: 'value',
                    flags: '',
                    flagsType: 'value',
                    outputVar: '',
                    indent: 0
                }
                break;
            }
            case 'v2GetLorebookByName':{
                editTrigger = {
                    type: 'v2GetLorebookByName',
                    name: '',
                    nameType: 'value',
                    outputVar: '',
                    indent: 0
                }
                break;
            }
            case 'v2GetLorebookByIndex':{
                editTrigger = {
                    type: 'v2GetLorebookByIndex',
                    index: '',
                    indexType: 'value',
                    outputVar: '',
                    indent: 0
                }
                break;
            }
            case 'v2CreateLorebook':{
                editTrigger = {
                    type: 'v2CreateLorebook',
                    name: '',
                    nameType: 'value',
                    key: '',
                    keyType: 'value',
                    content: '',
                    contentType: 'value',
                    insertOrder: '100',
                    insertOrderType: 'value',
                    indent: 0
                }
                break;
            }
            case 'v2ModifyLorebookByIndex':{
                editTrigger = {
                    type: 'v2ModifyLorebookByIndex',
                    index: '',
                    indexType: 'value',
                    name: '{{slot}}',
                    nameType: 'value',
                    key: '{{slot}}',
                    keyType: 'value',
                    content: '{{slot}}',
                    contentType: 'value',
                    insertOrder: '{{slot}}',
                    insertOrderType: 'value',
                    indent: 0
                }
                break;
            }
            case 'v2DeleteLorebookByIndex':{
                editTrigger = {
                    type: 'v2DeleteLorebookByIndex',
                    index: '',
                    indexType: 'value',
                    indent: 0
                }
                break;
            }
            case 'v2GetLorebookCountNew':{
                editTrigger = {
                    type: 'v2GetLorebookCountNew',
                    outputVar: '',
                    indent: 0
                }
                break;
            }
            case 'v2SetLorebookAlwaysActive':{
                editTrigger = {
                    type: 'v2SetLorebookAlwaysActive',
                    index: '',
                    indexType: 'value',
                    value: true,
                    indent: 0
                }
                break;
            }
            case 'v2GetReplaceGlobalNote':{
                editTrigger = {
                    type: 'v2GetReplaceGlobalNote',
                    outputVar: '',
                    indent: 0
                }
                break;
            }
            case 'v2SetReplaceGlobalNote':{
                editTrigger = {
                    type: 'v2SetReplaceGlobalNote',
                    value: '',
                    valueType: 'value',
                    indent: 0
                }
                break;
            }
            case 'v2GetAuthorNote':{
                editTrigger = {
                    type: 'v2GetAuthorNote',
                    outputVar: '',
                    indent: 0
                }
                break;
            }
            case 'v2SetAuthorNote':{
                editTrigger = {
                    type: 'v2SetAuthorNote',
                    value: '',
                    valueType: 'value',
                    indent: 0
                }
                break;
            }
            case 'v2MakeDictVar':{
                editTrigger = {
                    type: 'v2MakeDictVar',
                    var: '',
                    indent: 0
                }
                break;
            }
            case 'v2GetDictVar':{
                editTrigger = {
                    type: 'v2GetDictVar',
                    var: '',
                    varType: 'value',
                    key: '',
                    keyType: 'value',
                    outputVar: '',
                    indent: 0
                }
                break;
            }
            case 'v2SetDictVar':{
                editTrigger = {
                    type: 'v2SetDictVar',
                    var: '',
                    varType: 'value',
                    key: '',
                    keyType: 'value',
                    value: '',
                    valueType: 'value',
                    indent: 0
                }
                break;
            }
            case 'v2DeleteDictKey':{
                editTrigger = {
                    type: 'v2DeleteDictKey',
                    var: '',
                    varType: 'value',
                    key: '',
                    keyType: 'value',
                    indent: 0
                }
                break;
            }
            case 'v2HasDictKey':{
                editTrigger = {
                    type: 'v2HasDictKey',
                    var: '',
                    varType: 'value',
                    key: '',
                    keyType: 'value',
                    outputVar: '',
                    indent: 0
                }
                break;
            }
            case 'v2ClearDict':{
                editTrigger = {
                    type: 'v2ClearDict',
                    var: '',
                    indent: 0
                }
                break;
            }
            case 'v2GetDictSize':{
                editTrigger = {
                    type: 'v2GetDictSize',
                    var: '',
                    varType: 'value',
                    outputVar: '',
                    indent: 0
                }
                break;
            }
            case 'v2GetDictKeys':{
                editTrigger = {
                    type: 'v2GetDictKeys',
                    var: '',
                    varType: 'value',
                    outputVar: '',
                    indent: 0
                }
                break;
            }
            case 'v2GetDictValues':{
                editTrigger = {
                    type: 'v2GetDictValues',
                    var: '',
                    varType: 'value',
                    outputVar: '',
                    indent: 0
                }
                break;
            }
            case 'v2Calculate':{
                editTrigger = {
                    type: 'v2Calculate',
                    expression: '',
                    expressionType: 'value',
                    outputVar: '',
                    indent: 0
                }
                break;
            }
            case 'v2ReplaceString':{
                editTrigger = {
                    type: 'v2ReplaceString',
                    source: '',
                    sourceType: 'value',
                    regex: '',
                    regexType: 'value',
                    result: '',
                    resultType: 'value',
                    replacement: '',
                    replacementType: 'value',
                    flags: '',
                    flagsType: 'value',
                    outputVar: '',
                    indent: 0
                }
                break;
            }
            case 'v2Comment':{
                editTrigger = {
                    type: 'v2Comment',
                    value: '',
                    indent: 0
                }
                break;
            }
            case 'v2DeclareLocalVar':{
                editTrigger = {
                    type: 'v2DeclareLocalVar',
                    var: '',
                    value: '',
                    valueType: 'value',
                    indent: 0
                }
                break;
            }
        }
    }

    const deleteEffect = () => {
        const type = value[selectedIndex].effect[selectedEffectIndex]
        value[selectedIndex].effect.splice(selectedEffectIndex, 1)
        if(type.type === 'v2If' || type.type === 'v2IfAdvanced' || type.type === 'v2Loop' || type.type === 'v2Else' || type.type === 'v2LoopNTimes'){
            let pointer = selectedEffectIndex
            const indent = (type as triggerEffectV2).indent
            while(pointer < value[selectedIndex].effect.length){
                if(value[selectedIndex].effect[pointer].type === 'v2EndIndent' && (value[selectedIndex].effect[pointer] as triggerEffectV2).indent === indent + 1){
                    value[selectedIndex].effect.splice(pointer, 1)
                    if(value?.[selectedIndex]?.effect?.[pointer]?.type === 'v2Else'){
                        value[selectedIndex].effect.splice(pointer, 1)
                        continue
                    }
                    else{
                        break
                    }
                }
                (value[selectedIndex].effect[pointer] as triggerEffectV2).indent -= 1
                pointer += 1
            }
        }


        selectedEffectIndex -= 1
        if(selectedEffectIndex < 0){
            selectedEffectIndex = 0
        }
        updateGuideLines()
    }

    const copyEffect = () => {
        const type = value[selectedIndex].effect[selectedEffectIndex]
        
        if(type.type === 'v2If' || type.type === 'v2IfAdvanced' || type.type === 'v2Loop' || type.type === 'v2LoopNTimes'){
            const blockRange = getBlockRange(selectedEffectIndex)
            const blockEffects = value[selectedIndex].effect.slice(blockRange.start, blockRange.end + 1)
            clipboard = {
                type: 'effect',
                value: safeStructuredClone(blockEffects)
            }
            return
        }
        
        if(type.type === 'v2Else'){
            return
        }
        
        clipboard = {
            type: 'effect',
            value: safeStructuredClone([type])
        }
    }

    const getInsertIndent = (insertIndex: number): number => {
        if (insertIndex === 0) {
            return 0
        }
        
        if (insertIndex >= value[selectedIndex].effect.length) {
            if (value[selectedIndex].effect.length === 0) {
                return 0
            }
            const lastEffect = value[selectedIndex].effect[value[selectedIndex].effect.length - 1] as triggerEffectV2
            if (lastEffect.type === 'v2EndIndent') {
                return lastEffect.indent - 1
            }
            return lastEffect.indent
        }
        
        const targetEffect = value[selectedIndex].effect[insertIndex] as triggerEffectV2
        const prevEffect = insertIndex > 0 ? value[selectedIndex].effect[insertIndex - 1] as triggerEffectV2 : null
        
        if (targetEffect.type === 'v2EndIndent') {
            return targetEffect.indent
        }
        
        if (targetEffect.type === 'v2Else') {
            return targetEffect.indent
        }
        
        if (prevEffect && (prevEffect.type === 'v2If' || prevEffect.type === 'v2IfAdvanced' || 
                          prevEffect.type === 'v2Loop' || prevEffect.type === 'v2LoopNTimes')) {
            return prevEffect.indent + 1
        }
        
        if (prevEffect && prevEffect.type === 'v2Else') {
            return prevEffect.indent + 1
        }
        
        if (prevEffect && prevEffect.type === 'v2EndIndent') {
            return prevEffect.indent - 1
        }
        
        if (prevEffect) {
            return prevEffect.indent
        }
        
        return targetEffect.indent
    }

    const pasteEffect = async () => {
        if(clipboard?.type !== 'effect'){
            return
        }

        let insertIndex = selectedEffectIndex === -1 ? value[selectedIndex].effect.length : selectedEffectIndex
        const targetIndent = getInsertIndent(insertIndex)
        
        const firstEffect = clipboard.value[0] as triggerEffectV2
        const isBlock = firstEffect && (
            firstEffect.type === 'v2If' || 
            firstEffect.type === 'v2IfAdvanced' || 
            firstEffect.type === 'v2Loop' || 
            firstEffect.type === 'v2LoopNTimes'
        )
        
        if (isBlock) {
            const baseIndent = firstEffect.indent
            const indentDifference = targetIndent - baseIndent
            
            for(const effect of clipboard.value){
                const clonedEffect = safeStructuredClone(effect) as triggerEffectV2
                clonedEffect.indent = (effect as triggerEffectV2).indent + indentDifference
                value[selectedIndex].effect.splice(insertIndex, 0, clonedEffect)
                insertIndex += 1
            }
        } else {
            for(const effect of clipboard.value){
                const clonedEffect = safeStructuredClone(effect) as triggerEffectV2
                clonedEffect.indent = targetIndent
                value[selectedIndex].effect.splice(insertIndex, 0, clonedEffect)
                insertIndex += 1
            }
        }
        
        selectedEffectIndex = insertIndex - 1
        updateGuideLines()
    }

    const copyTrigger = () => {
        if (isMultipleSelected()) {
            const selectedTriggers = selectedTriggerIndices.map(index => value[index]).filter(Boolean)
            clipboard = {
                type: 'trigger',
                value: safeStructuredClone(selectedTriggers)
            }
        } else {
            clipboard = {
                type: 'trigger',
                value: safeStructuredClone([value[selectedIndex]])
            }
        }
    }

    const pasteTrigger = async () => {
        if(clipboard?.type !== 'trigger'){
            return
        }

        let insertIndex = selectedIndex
        for(const trigger of clipboard.value){
            value.splice(insertIndex, 0, safeStructuredClone(trigger))
            insertIndex += 1
        }
        selectedIndex = insertIndex - 1
        clearTriggerSelection()
    }

    const deleteTrigger = () => {
        if (isMultipleSelected()) {
            if (selectedTriggerIndices.length >= value.length - 1) {
                return
            }
            
            const sortedIndices = [...selectedTriggerIndices].sort((a, b) => b - a)
            for (const index of sortedIndices) {
                if (index > 0 && index < value.length) {
                    value.splice(index, 1)
                }
            }
            
            clearTriggerSelection()
            selectedIndex = Math.max(1, Math.min(selectedIndex, value.length - 1))
        } else {
            if(value.length <= 2){
                return
            }
            value.splice(selectedIndex, 1)
            selectedIndex -= 1
            if(selectedIndex < 1){
                selectedIndex = 1
            }
            clearTriggerSelection()
        }
    }

    const moveTrigger = (fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex || fromIndex === 0 || toIndex === 0) return;
        if (fromIndex < 0 || toIndex < 0 || fromIndex >= value.length || toIndex > value.length) return;
        if (!value[fromIndex]) return;
        
        if (isMultipleSelected() && isTriggerSelected(fromIndex)) {
            moveMultipleTriggers(toIndex);
        } else {
            const triggers = [...value];
            const movedItem = triggers.splice(fromIndex, 1)[0];
            if (!movedItem) return;
            
            const adjustedToIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
            triggers.splice(adjustedToIndex, 0, movedItem);
            
            if (selectedIndex === fromIndex) {
                selectedIndex = adjustedToIndex;
            } else if (fromIndex < selectedIndex && adjustedToIndex >= selectedIndex) {
                selectedIndex = selectedIndex - 1;
            } else if (fromIndex > selectedIndex && adjustedToIndex <= selectedIndex) {
                selectedIndex = selectedIndex + 1;
            }
            
            value = triggers;
        }
    }

    const moveMultipleTriggers = (toIndex: number) => {
        const sortedIndices = [...selectedTriggerIndices].sort((a, b) => a - b);
        const triggersToMove = sortedIndices.map(index => value[index]);
        
        const triggers = [...value];
        
        for (let i = sortedIndices.length - 1; i >= 0; i--) {
            triggers.splice(sortedIndices[i], 1);
        }
        
        let insertIndex = toIndex;
        for (let i = 0; i < sortedIndices.length; i++) {
            if (sortedIndices[i] < toIndex) {
                insertIndex--;
            }
        }
        
        insertIndex = Math.max(1, insertIndex);
        
        for (let i = 0; i < triggersToMove.length; i++) {
            triggers.splice(insertIndex + i, 0, triggersToMove[i]);
        }
        
        const newSelectedIndices = [];
        for (let i = 0; i < triggersToMove.length; i++) {
            newSelectedIndices.push(insertIndex + i);
        }
        
        selectedTriggerIndices = newSelectedIndices;
        selectedIndex = newSelectedIndices[0];
        lastSelectedTriggerIndex = newSelectedIndices[0];
        
        value = triggers;
    }

    const handleTriggerDrop = (targetIndex: number, e) => {
        e.preventDefault();
        e.stopPropagation();
        const data = e.dataTransfer?.getData('text');
        if (data === 'trigger') {
            const sourceIndex = parseInt(e.dataTransfer?.getData('triggerIndex') || '0');
            moveTrigger(sourceIndex, targetIndex);
        }
    }

    const getBlockRange = (startIndex: number): { start: number, end: number } => {
        if (!value || !value[selectedIndex] || !value[selectedIndex].effect) {
            return { start: startIndex, end: startIndex };
        }
        
        const effects = value[selectedIndex].effect;
        const startEffect = effects[startIndex] as triggerEffectV2;
        
        if (!startEffect || 
            (startEffect.type !== 'v2If' && startEffect.type !== 'v2IfAdvanced' && 
             startEffect.type !== 'v2Loop' && startEffect.type !== 'v2LoopNTimes')) {
            return { start: startIndex, end: startIndex };
        }
        
        let pointer = startIndex + 1;
        const indent = startEffect.indent;
        
        while (pointer < effects.length) {
            const currentEffect = effects[pointer] as triggerEffectV2;
            if (currentEffect.type === 'v2EndIndent' && currentEffect.indent === indent + 1) {
                let endIndex = pointer;
                
                if (pointer + 1 < effects.length) {
                    const nextEffect = effects[pointer + 1] as triggerEffectV2;
                    if (nextEffect.type === 'v2Else' && nextEffect.indent === indent) {
                        pointer += 2;
                        while (pointer < effects.length) {
                            const elseEffect = effects[pointer] as triggerEffectV2;
                            if (elseEffect.type === 'v2EndIndent' && elseEffect.indent === indent + 1) {
                                endIndex = pointer;
                                break;
                            }
                            pointer++;
                        }
                    }
                }
                
                return { start: startIndex, end: endIndex };
            }
            pointer++;
        }
        
        return { start: startIndex, end: startIndex };
    }

    const canMoveEffect = (fromIndex: number, toIndex: number): boolean => {
        if (!value || !value[selectedIndex] || !value[selectedIndex].effect) return false;
        if (fromIndex === toIndex) return false;
        if (fromIndex < 0 || toIndex < 0) return false;
        if (fromIndex >= value[selectedIndex].effect.length || toIndex > value[selectedIndex].effect.length) return false;
        
        const fromEffect = value[selectedIndex].effect[fromIndex] as triggerEffectV2;
        if (!fromEffect) return false;
        
        if (fromEffect.type === 'v2EndIndent' || fromEffect.type === 'v2Else') {
            return false;
        }
        
        if (fromEffect.type === 'v2If' || fromEffect.type === 'v2IfAdvanced' || 
            fromEffect.type === 'v2Loop' || fromEffect.type === 'v2LoopNTimes') {
            const blockRange = getBlockRange(fromIndex);
            
            if (toIndex > blockRange.start && toIndex <= blockRange.end + 1) {
                return false;
            }
        }
        
        if (toIndex < value[selectedIndex].effect.length) {
            const targetEffect = value[selectedIndex].effect[toIndex] as triggerEffectV2;
            if (targetEffect && targetEffect.type === 'v2Else' && toIndex > 0) {
                const prevEffect = value[selectedIndex].effect[toIndex - 1] as triggerEffectV2;
                if (prevEffect && prevEffect.type === 'v2EndIndent') {
                    const blockIndent = prevEffect.indent - 1;
                    for (let i = toIndex - 2; i >= 0; i--) {
                        const checkEffect = value[selectedIndex].effect[i] as triggerEffectV2;
                        if (checkEffect.indent === blockIndent) {
                            if (checkEffect.type === 'v2If' || checkEffect.type === 'v2IfAdvanced') {
                                return false;
                            }
                            break;
                        }
                    }
                }
            }
        }

        if (toIndex > 0 && toIndex < value[selectedIndex].effect.length) {
            const prevEffect = value[selectedIndex].effect[toIndex - 1] as triggerEffectV2;
            const targetEffect = value[selectedIndex].effect[toIndex] as triggerEffectV2;
            
            if (prevEffect && prevEffect.type === 'v2EndIndent' && 
                targetEffect && targetEffect.type === 'v2Else') {
                return false;
            }
        }

        try {
            const targetIndent = getInsertIndent(toIndex);
            if (targetIndent < 0 || targetIndent > 10) {
                return false;
            }
        } catch {
            return false;
        }
        
        return true;
    }

    const moveEffect = (fromIndex: number, toIndex: number) => {
        if (!canMoveEffect(fromIndex, toIndex)) return;
        
        const effects = [...value[selectedIndex].effect];
        const fromEffect = effects[fromIndex] as triggerEffectV2;
        
        if (fromEffect.type === 'v2If' || fromEffect.type === 'v2IfAdvanced' || 
            fromEffect.type === 'v2Loop' || fromEffect.type === 'v2LoopNTimes') {
            
            const blockRange = getBlockRange(fromIndex);
            const blockSize = blockRange.end - blockRange.start + 1;
            
            const targetIndent = getInsertIndent(toIndex);
            
            const movedBlock = effects.splice(blockRange.start, blockSize);
            if (movedBlock.length === 0) return;
                
            const adjustedToIndex = blockRange.start < toIndex ? toIndex - blockSize : toIndex;
            
            const originalIndent = (movedBlock[0] as triggerEffectV2).indent;
            const indentDifference = targetIndent - originalIndent;
            
            movedBlock.forEach((effect) => {
                const effectV2 = effect as triggerEffectV2;
                effectV2.indent += indentDifference;
            });
            
            effects.splice(adjustedToIndex, 0, ...movedBlock);
            
            if (selectedEffectIndex >= blockRange.start && selectedEffectIndex <= blockRange.end) {
                const offsetInBlock = selectedEffectIndex - blockRange.start;
                selectedEffectIndex = adjustedToIndex + offsetInBlock;
            } else if (blockRange.start < selectedEffectIndex && adjustedToIndex >= selectedEffectIndex) {
                selectedEffectIndex = selectedEffectIndex - blockSize;
            } else if (blockRange.start > selectedEffectIndex && adjustedToIndex <= selectedEffectIndex) {
                selectedEffectIndex = selectedEffectIndex + blockSize;
            }
            
        } else {
            const targetIndent = getInsertIndent(toIndex);
            
            const movedItem = effects.splice(fromIndex, 1)[0];
            if (!movedItem) return;
            
            const adjustedToIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
            
            (movedItem as triggerEffectV2).indent = targetIndent;
            
            effects.splice(adjustedToIndex, 0, movedItem);
            
            if (selectedEffectIndex === fromIndex) {
                selectedEffectIndex = adjustedToIndex;
            } else if (fromIndex < selectedEffectIndex && adjustedToIndex >= selectedEffectIndex) {
                selectedEffectIndex = selectedEffectIndex - 1;
            } else if (fromIndex > selectedEffectIndex && adjustedToIndex <= selectedEffectIndex) {
                selectedEffectIndex = selectedEffectIndex + 1;
            }
        }
        
        value[selectedIndex].effect = effects;
        updateGuideLines();
    }

    const handleEffectDrop = (targetIndex: number, e) => {
        e.preventDefault();
        e.stopPropagation();
        const data = e.dataTransfer?.getData('text');
        if (data === 'effect') {
            const sourceIndex = parseInt(e.dataTransfer?.getData('effectIndex') || '0');
            moveEffect(sourceIndex, targetIndex);
        }
    }

    const handleKeydown = (e:KeyboardEvent) => {
        if(e.key === 'Escape'){
            if(contextMenu){
                contextMenu = false
                return
            }
            if(menuMode === 0){
                close()
            }
            else{
                if(selectedIndex > 0) {
                    selectedTriggerIndex = selectedIndex;
                    selectedEffectIndexSaved = selectedEffectIndex;
                }
                menuMode = 0
            }
        }
        if(selectedIndex > 0 && selectedEffectIndex !== -1 && menuMode === 0 && selectMode === 1){
            if(e.key === 'ArrowUp'){
                if(selectedEffectIndex > 0){
                    selectedEffectIndex -= 1

                    if(e.altKey){
                        const before = value[selectedIndex].effect[selectedEffectIndex] as triggerEffectV2
                        const after = value[selectedIndex].effect[selectedEffectIndex + 1] as triggerEffectV2
                        if(
                            before.type !== 'v2EndIndent' && after.type !== 'v2EndIndent'
                            && before.type !== 'v2If' && after.type !== 'v2If'
                            && before.type !== 'v2IfAdvanced' && after.type !== 'v2IfAdvanced'
                            && before.type !== 'v2Loop' && after.type !== 'v2Loop'
                            && before.type !== 'v2LoopNTimes' && after.type !== 'v2LoopNTimes'
                            && before.indent === after.indent
                        ){
                            value[selectedIndex].effect[selectedEffectIndex] = after
                            value[selectedIndex].effect[selectedEffectIndex + 1] = before
                        }
                    }
                }
                e.preventDefault()
            }
            if(e.key === 'ArrowDown'){
                if(selectedEffectIndex < value[selectedIndex].effect.length - 1){
                    selectedEffectIndex += 1

                    if(e.altKey){
                        const before = value[selectedIndex].effect[selectedEffectIndex] as triggerEffectV2
                        const after = value[selectedIndex].effect[selectedEffectIndex - 1] as triggerEffectV2
                        if(
                            before.type !== 'v2EndIndent' && after.type !== 'v2EndIndent'
                            && before.type !== 'v2If' && after.type !== 'v2If'
                            && before.type !== 'v2IfAdvanced' && after.type !== 'v2IfAdvanced'
                            && before.type !== 'v2Loop' && after.type !== 'v2Loop'
                            && before.type !== 'v2LoopNTimes' && after.type !== 'v2LoopNTimes'
                            && before.indent === after.indent
                        ){
                            value[selectedIndex].effect[selectedEffectIndex] = after
                            value[selectedIndex].effect[selectedEffectIndex - 1] = before
                        }
                    }
                }
                e.preventDefault()
            }
            if(e.key === 'c' && e.ctrlKey){
                copyEffect()
                e.preventDefault()
            }
            if(e.key === 'v' && e.ctrlKey){
                //paste
                pasteEffect()
                e.preventDefault()
            }
            if(e.key === 'Delete'){
                deleteEffect()
                e.preventDefault()
            }
        }
        if(selectedIndex > 0 && menuMode === 0 && selectMode === 0){
            if(e.key === 'ArrowUp'){
                if(selectedIndex > 1){
                    selectedIndex -= 1

                    if(e.altKey){
                        const before = value[selectedIndex]
                        const after = value[selectedIndex + 1]
                        value[selectedIndex] = after
                        value[selectedIndex + 1] = before
                    }
                }
                e.preventDefault()
            }
            if(e.key === 'ArrowDown'){
                if(selectedIndex < value.length - 1){
                    selectedIndex += 1

                    if(e.altKey){
                        const before = value[selectedIndex]
                        const after = value[selectedIndex - 1]
                        value[selectedIndex] = after
                        value[selectedIndex - 1] = before
                    }
                }
                e.preventDefault()
            }
            if(e.key === 'c' && e.ctrlKey){
                copyTrigger()
                e.preventDefault()
            }
            if(e.key === 'v' && e.ctrlKey){
                pasteTrigger()
                e.preventDefault()
            }
            //Delete is forrbidden due to the fact that misclicks can cause huge data loss
        }
    }

    const handleContextMenu = (e, mode, effectIndex = -1, effect = null) => {
        contextMenu = true
        selectMode = mode
        
        const clickPos = {x: e.clientX, y: e.clientY}
        
        const yPosition = clickPos.y > (window.innerHeight * 0.75)
            ? `bottom: ${window.innerHeight - clickPos.y}px;`
            : `top: ${clickPos.y}px;`
        
        const xPosition = clickPos.x > (window.innerWidth * 0.75)
            ? `right: ${window.innerWidth - clickPos.x}px;`
            : `left: ${clickPos.x}px;`
        
        contextMenuLoc = {
            x: clickPos.x, 
            y: clickPos.y,
            style: `${yPosition} ${xPosition}`
        }
        
        if (mode === 1) {
            selectedEffectIndex = effectIndex
            
            if (effect) {
                editTrigger = effect as triggerEffectV2
            }
        } else if (mode === 0) {
            if (!isTriggerSelected(effectIndex)) {
                selectedTriggerIndices = [effectIndex]
                lastSelectedTriggerIndex = effectIndex
                selectedIndex = effectIndex
            }
        }
        
        e.preventDefault()
        e.stopPropagation()
    }

    const formatEffectDisplay = (effect:triggerEffect) => {
        const escapeHtml = (value: unknown) => String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        const type = effect.type

        if(!checkSupported(type)){
            return DOMPurify.sanitize(`<span class="text-red-500">${escapeHtml(language.triggerDesc.v2UnsupportedTriggerDesc)}</span>`)
        }

        const txt = escapeHtml(language.triggerDesc[type + 'Desc'] as string || type).replace(/{{(.+?)}}/g, (_match, p1) => {
            const d = effect[p1]
            const safeValue = escapeHtml(d || 'null')
            
            if(type === 'v2Comment' && p1 === 'value') {
                return `<span class="text-textcolor2">${escapeHtml(d || '')}</span>`
            }
            
            if(typeof d === 'boolean'){
                return `<span class="text-blue-500">${d ? 'true' : 'false'}</span>`
            }
            
            if(p1.endsWith('Type')){
                return `<span class="text-blue-500">${safeValue}</span>`
            }
            if(p1 === 'condition' || p1 === 'operator'){
                return `<span class="text-green-500">${safeValue}</span>`
            }
            if(effect[p1 + 'Type'] === 'var'){
                return `<span class="text-yellow-500">${safeValue}</span>`
            }
            if(effect[p1 + 'Type'] === 'value'){
                return `<span class="text-green-500">"${escapeHtml(d)}"</span>`
            }
            if(effect.type === 'v2If' && p1 === 'source'){
                return `<span class="text-yellow-500">${safeValue}</span>`
            }
            if(effect.type === 'v2SetVar' && p1 === 'var'){
                return `<span class="text-yellow-500">${safeValue}</span>`
            }
            if(effect.type === 'v2DeclareLocalVar' && p1 === 'var'){
                return `<span class="text-cyan-500">${safeValue}</span>`
            }
            return `<span class="text-blue-500">${safeValue}</span>`
        })

        if(type === 'v2Comment') {
            return DOMPurify.sanitize(`<div class="text-textcolor2 italic line-clamp-4" style="margin-left:${(effect as triggerEffectV2).indent}rem; word-break: break-all; overflow-wrap: break-word;">// ${txt}</div>`)
        }

        return DOMPurify.sanitize(`<div class="text-purple-500 line-clamp-4" style="margin-left:${(effect as triggerEffectV2).indent}rem; word-break: break-all; overflow-wrap: break-word;">${txt}</div>`)
    }
    
    const updateGuideLines = () => {
        guideLineKey += 1
    }




    onMount(() => {
        const checkMobileScreen = () => {
            isMobileScreen = window.innerWidth < 768
        }
        
        checkMobileScreen()
        window.addEventListener('resize', checkMobileScreen)
        
        window.addEventListener('keydown', handleKeydown);
        window.addEventListener('resize', updateGuideLines);
        
        const handleGlobalClick = (_e: MouseEvent) => {
            if (contextMenu) {
                contextMenu = false
            }
        }
        
        const handleGlobalContextMenu = (e: MouseEvent) => {
            if (contextMenu) {
                e.preventDefault()
            }
        }
        
        document.addEventListener('click', handleGlobalClick, true);
        document.addEventListener('contextmenu', handleGlobalContextMenu, true);
        
        return () => {
            window.removeEventListener('resize', checkMobileScreen)
            window.removeEventListener('keydown', handleKeydown);
            window.removeEventListener('resize', updateGuideLines);
            document.removeEventListener('click', handleGlobalClick, true);
            document.removeEventListener('contextmenu', handleGlobalContextMenu, true);
            scrollManager.stopAutoScroll();
        }
    })
</script>

<div
    class="trigger-v2-launcher"
>
    <Button onclick={(e) => {
        e.stopPropagation()
        menuMode = 0
        selectedIndex = 1
        selectedTriggerIndices = [1]
        lastSelectedTriggerIndex = 1
        selectedTriggerIndex = 1
    }}>
        {language.edit}
    </Button>
</div>




{#if selectedIndex > 0}
<Portal>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="trigger-v2-overlay" 
         onclick={(e) => {
             if (e.target === e.currentTarget) {
                 contextMenu = false
                 if (menuMode === 0) {
                     clearTriggerSelection()
                 }
             }
         }}
         oncontextmenu={(e) => {
             if (e.target === e.currentTarget) {
                 e.preventDefault()
                 contextMenu = false
             }
         }}
    >
        {#if contextMenu}
            <div class="trigger-v2-context-menu ds-ui-menu" style={contextMenuLoc.style} 
                 onclick={(e) => {
                     e.stopPropagation()
                 }}
                 oncontextmenu={(e) => {
                     e.preventDefault()
                     e.stopPropagation()
                 }}
            >
                {#if selectedTriggerIndices.length > 1 && selectMode === 0}
                    <div class="trigger-v2-context-header">
                        {selectedTriggerIndices.length} selected
                    </div>
                {/if}
                
                {#if selectMode === 1}
                    {#if selectedEffectIndex !== -1 && value[selectedIndex].effect[selectedEffectIndex].type !== 'v2EndIndent'}
                        <button type="button" class="trigger-v2-context-action ds-ui-menu-item" title={language.edit} aria-label={language.edit} onclick={(e) => {
                            e.stopPropagation()
                            const currentEffect = value[selectedIndex].effect[selectedEffectIndex] as triggerEffectV2
                            if(currentEffect.type === 'v2If' || currentEffect.type === 'v2IfAdvanced'){
                                let hasExistingElse = false
                                let pointer = selectedEffectIndex + 1
                                const indent = currentEffect.indent
                                
                                while(pointer < value[selectedIndex].effect.length){
                                    const effect = value[selectedIndex].effect[pointer] as triggerEffectV2
                                    if(effect.type === 'v2EndIndent' && effect.indent === indent + 1){
                                        if(pointer + 1 < value[selectedIndex].effect.length){
                                            const nextEffect = value[selectedIndex].effect[pointer + 1] as triggerEffectV2
                                            if(nextEffect.type === 'v2Else' && nextEffect.indent === indent){
                                                hasExistingElse = true
                                            }
                                        }
                                        break
                                    }
                                    pointer++
                                }
                                
                                addElse = hasExistingElse
                            }
                            
                            if(selectedIndex > 0) {
                                selectedTriggerIndex = selectedIndex;
                                selectedEffectIndexSaved = selectedEffectIndex;
                            }
                            menuMode = 3
                            contextMenu = false
                        }}>
                            {language.edit}
                        </button>
                        
                        <button type="button" class="trigger-v2-context-action ds-ui-menu-item" title={language.copy} aria-label={language.copy} onclick={(e) => {
                            e.stopPropagation()
                            copyEffect()
                            contextMenu = false
                        }}>
                            {language.copy}
                        </button>
                        
                        <button type="button" class="trigger-v2-context-action ds-ui-menu-item ds-ui-menu-item--danger" title={language.remove} aria-label={language.remove} onclick={(e) => {
                            e.stopPropagation()
                            deleteEffect()
                            contextMenu = false
                        }}>
                            {language.remove}
                        </button>
                    {/if}
                    
                    <button type="button" class="trigger-v2-context-action ds-ui-menu-item" title={language.paste} aria-label={language.paste} onclick={(e) => {
                        e.stopPropagation()
                        pasteEffect()
                        contextMenu = false
                    }}>
                        {language.paste}
                    </button>
                    
                {:else if selectMode === 0}
                    <button type="button" class="trigger-v2-context-action ds-ui-menu-item" title={language.copy} aria-label={language.copy} onclick={(e) => {
                        e.stopPropagation()
                        copyTrigger()
                        contextMenu = false
                    }}>
                        {language.copy}
                    </button>
                    
                    <button type="button" class="trigger-v2-context-action ds-ui-menu-item" title={language.paste} aria-label={language.paste} onclick={(e) => {
                        e.stopPropagation()
                        pasteTrigger()
                        contextMenu = false
                    }}>
                        {language.paste}
                    </button>
                    
                    <button type="button" class="trigger-v2-context-action ds-ui-menu-item ds-ui-menu-item--danger" title={language.remove} aria-label={language.remove} onclick={(e) => {
                        e.stopPropagation()
                        deleteTrigger()
                        contextMenu = false
                    }}>
                        {language.remove}
                    </button>
                {/if}
            </div>
        {/if}
        <div class="trigger-v2-panel panel-shell" 
             class:trigger-v2-panel-width-edit={menuMode === 0} 
             class:trigger-v2-panel-width-menu={menuMode !== 0} 
             class:trigger-v2-panel-fill={menuMode!==2}
             onclick={(_e) => {
                 if (contextMenu) {
                     contextMenu = false
                 }
             }}
             oncontextmenu={(e) => {
                 if (contextMenu) {
                     e.preventDefault()
                 }
             }}
        >
            {#if menuMode === 0}
                <div class="trigger-v2-left-column">
                    <div class="trigger-v2-trigger-scroll list-shell" bind:this={triggerScrollRef} onscroll={scrollManager.handleTriggerScroll} 
                         ondragover={(e) => {
                             if (!isMobileScreen && isDragging && triggerScrollRef) {
                                 const rect = e.currentTarget.getBoundingClientRect()
                                 const autoScrollDirection = scrollManager.checkAutoScrollZone(e.clientY, rect)
                                 
                                 if (autoScrollDirection) {
                                     scrollManager.startAutoScroll(triggerScrollRef, autoScrollDirection)
                                 } else {
                                     scrollManager.stopAutoScroll()
                                 }
                             }
                         }}
                         ondragleave={(e) => {
                             if (!isMobileScreen) {
                                 const rect = e.currentTarget.getBoundingClientRect()
                                 const mouseX = e.clientX
                                 const mouseY = e.clientY
                                 
                                 if (mouseX < rect.left || mouseX > rect.right || 
                                     mouseY < rect.top || mouseY > rect.bottom) {
                                     dragOverIndex = -1
                                     scrollManager.stopAutoScroll()
                                 }
                             }
                         }}>
                        {#each value as trigger, i (trigger)}
                            {#if i === 0}
                                <!-- Header, skip the first trigger -->
                            {:else}
                                                        <div class="trigger-v2-drop-zone" 
                            class:trigger-v2-drop-zone-hover={!isMobileScreen && !isDragging}
                            class:trigger-v2-drop-zone-active={isDragging && dragOverIndex === i}
                            role="listitem"
                            ondragover={(e) => {
                                if (!isMobileScreen) {
                                    e.preventDefault()
                                }
                            }} 
                            ondrop={(e) => {
                                if (!isMobileScreen) {
                                    handleTriggerDrop(i, e)
                                    dragOverIndex = -1
                                }
                            }}>
                        </div>
                                
                                <button
                                    type="button"
                                    class="trigger-v2-trigger-button trigger-item"
                                    class:trigger-v2-trigger-button-draggable={!isMobileScreen}
                                    class:text-textcolor2={!isTriggerSelected(i) && selectedIndex !== i}
                                    class:text-textcolor={isTriggerSelected(i) || selectedIndex === i}
                                    class:hover:text-textcolor={!isTriggerSelected(i) && selectedIndex !== i}
                                    class:trigger-v2-trigger-button-selected={selectedIndex === i && !isMultipleSelected()}
                                    class:trigger-v2-selection-active={isTriggerSelected(i)}
                                    title={trigger?.comment || 'Unnamed Trigger'}
                                    aria-label={trigger?.comment || 'Unnamed Trigger'}
                                    draggable={!isMobileScreen}
                                    ondragstart={(e) => {
                                        if (isMobileScreen) {
                                            e.preventDefault()
                                            return
                                        }
                                        isDragging = true
                                        e.dataTransfer?.setData('text', 'trigger')
                                        e.dataTransfer?.setData('triggerIndex', i.toString())
                                        
                                        const dragElement = document.createElement('div')
                                        if (isMultipleSelected() && isTriggerSelected(i)) {
                                            dragElement.textContent = `${selectedTriggerIndices.length} triggers selected`
                                        } else {
                                            dragElement.textContent = trigger?.comment || 'Unnamed Trigger'
                                        }
                                        dragElement.className = 'trigger-v2-drag-ghost'
                                        document.body.appendChild(dragElement)
                                        e.dataTransfer?.setDragImage(dragElement, 10, 10)
                                        
                                        setTimeout(() => {
                                            document.body.removeChild(dragElement)
                                        }, 0)
                                    }}
                                    ondragend={(_e) => {
                                        isDragging = false
                                        dragOverIndex = -1
                                        scrollManager.stopAutoScroll()
                                    }}
                                    ondragover={(e) => {
                                        if (!isMobileScreen) {
                                            e.preventDefault()
                                            const rect = e.currentTarget.getBoundingClientRect()
                                            const mouseY = e.clientY
                                            const elementCenter = rect.top + rect.height / 2
                                            
                                            if (mouseY < elementCenter) {
                                                dragOverIndex = i
                                            } else {
                                                dragOverIndex = i + 1
                                            }
                                        }
                                    }}
                                    ondragleave={(e) => {
                                        if (!isMobileScreen) {
                                            const rect = e.currentTarget.getBoundingClientRect()
                                            const mouseX = e.clientX
                                            const mouseY = e.clientY
                                            
                                            if (mouseX < rect.left || mouseX > rect.right || 
                                                mouseY < rect.top || mouseY > rect.bottom) {
                                                dragOverIndex = -1
                                            }
                                        }
                                    }}
                                    ondrop={(e) => {
                                        if (!isMobileScreen) {
                                            handleTriggerDrop(dragOverIndex, e)
                                            dragOverIndex = -1
                                        }
                                    }}
                                    onclick={(event) => {
                                        handleTriggerClick(i, event)
                                    }}
                                    oncontextmenu={(e) => {
                                        e.preventDefault()
                                        handleContextMenu(e, 0, i)
                                    }}
                                >
                                    {trigger?.comment || 'Unnamed Trigger'}
                                </button>
                            {/if}
                        {/each}
                        
                        <div class="trigger-v2-drop-zone" 
                            class:trigger-v2-drop-zone-hover={!isMobileScreen && !isDragging}
                            class:trigger-v2-drop-zone-active={isDragging && dragOverIndex === value.length}
                            role="listitem"
                            ondragover={(e) => {
                                if (!isMobileScreen) {
                                    e.preventDefault()
                                    dragOverIndex = value.length
                                }
                            }} 
                            ondrop={(e) => {
                                if (!isMobileScreen) {
                                    handleTriggerDrop(value.length, e)
                                    dragOverIndex = -1
                                }
                            }}>
                        </div>
                    </div>
                    <div class="trigger-v2-toolbar action-rail ds-ui-action-rail">
                        <button type="button" class="trigger-v2-toolbar-action icon-btn icon-btn--sm" title="Add trigger" aria-label="Add trigger" onclick={() => {
                            value.push({
                                comment: "",
                                type: "manual",
                                conditions: [],
                                effect: []
                            })
                            selectedIndex = value.length - 1
                        }}>
                            <PlusIcon />
                        </button>
                        <button type="button" class="trigger-v2-toolbar-action icon-btn icon-btn--sm" title="Export triggers" aria-label="Export triggers" onclick={() => {
                            const triggersToExport = value.slice(1);
                            const jsonData = JSON.stringify(triggersToExport, null, 2);
                            
                            const blob = new Blob([jsonData], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `triggers-${new Date().getTime()}.json`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            
                            URL.revokeObjectURL(url);
                        }}>
                            <DownloadIcon />
                        </button>
                        <button type="button" class="trigger-v2-toolbar-action icon-btn icon-btn--sm" title="Import triggers" aria-label="Import triggers" onclick={() => {
                            importTriggers()
                        }}>
                            <UploadIcon />
                        </button>
                    </div>
                    <Button className="trigger-v2-close-btn" onclick={(e) => {
                        e?.stopPropagation();
                        close();
                    }}>Close</Button>
                </div>

                <div class="trigger-v2-editor">
                    <div class="trigger-v2-editor-header" onclick={() => {
                        selectMode = 1
                        selectedEffectIndex = -1
                    }}>
                        <div class="trigger-v2-editor-field">
                            <span class="block text-textcolor2">{language.name}</span>
                            <div class="trigger-v2-editor-input-wrap">
                                <TextInput className="flex-1" value={value && value[selectedIndex] ? (value[selectedIndex].comment || '') : ''} onchange={(e) => {
                                if (!value || !value[selectedIndex] || selectedIndex < 0 || selectedIndex >= value.length) return;
                                const comment = e.currentTarget.value
                                const prev = value[selectedIndex].comment
                                for(let i = 1; i < value.length; i++){
                                    if (!value[i] || !value[i].effect) continue;
                                    for(let j = 0; j < value[i].effect.length; j++){
                                        const effect = value[i].effect[j]
                                        if(effect && effect.type === 'v2RunTrigger' && effect.target === prev){
                                            effect.target = comment
                                        }
                                    }
                                }
                                value[selectedIndex].comment = comment
                            }} />
                            </div>
                        </div>
                        <div class="trigger-v2-editor-field">
                            <span class="block text-textcolor2">{language.triggerOn}</span>
                            {#if value && value[selectedIndex] && selectedIndex >= 0 && selectedIndex < value.length}
                                <div class="trigger-v2-editor-input-wrap">
                                    <SelectInput className="flex-1" bind:value={value[selectedIndex].type}>
                                    <OptionInput value="start">{language.triggerStart}</OptionInput>
                                    <OptionInput value="output">{language.triggerOutput}</OptionInput>
                                    <OptionInput value="input">{language.triggerInput}</OptionInput>
                                    <OptionInput value="manual">{language.triggerManual}</OptionInput>
                                    <OptionInput value="display">{language.editDisplay}</OptionInput>
                                    <OptionInput value="request">{language.editProcess}</OptionInput>
                                </SelectInput>
                                </div>
                            {/if}
                        </div>
                    </div>

                    <!-- <div class="mx-2 mb-2 p-2 bg-darkbg2 border border-darkborderc rounded-md">
                        <div class="flex flex-wrap gap-2">
                            <button class="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors">
                                TBD
                            </button>
                        </div>
                    </div> -->
                    
                    <div class="trigger-v2-effect-list list-shell" bind:this={menu0Container}
                         onscroll={scrollManager.handleMenu0Scroll}
                         ondragover={(e) => {
                             if (!isMobileScreen && isEffectDragging && menu0Container) {
                                 const rect = e.currentTarget.getBoundingClientRect()
                                 const autoScrollDirection = scrollManager.checkAutoScrollZone(e.clientY, rect)
                                 
                                 if (autoScrollDirection) {
                                     scrollManager.startAutoScroll(menu0Container, autoScrollDirection)
                                 } else {
                                     scrollManager.stopAutoScroll()
                                 }
                             }
                         }}
                         ondragleave={(e) => {
                             if (!isMobileScreen && isEffectDragging) {
                                 const rect = e.currentTarget.getBoundingClientRect()
                                 const mouseX = e.clientX
                                 const mouseY = e.clientY
                                 
                                 if (mouseX < rect.left || mouseX > rect.right || 
                                     mouseY < rect.top || mouseY > rect.bottom) {
                                     effectDragOverIndex = -1
                                     scrollManager.stopAutoScroll()
                                 }
                             }
                         }}>
                        {#key guideLineKey}
                            {#each (value && value[selectedIndex] && value[selectedIndex].effect) ? value[selectedIndex].effect : [] as effect, i (effect)}
                                {#if effect.type === 'v2If' || effect.type === 'v2IfAdvanced' || effect.type === 'v2Loop' || effect.type === 'v2LoopNTimes' || effect.type === 'v2Else'}
                                    {@const blockIndent = (effect as triggerEffectV2).indent}
                                    {@const endIndex = (value && value[selectedIndex] && value[selectedIndex].effect) ? value[selectedIndex].effect.findIndex((e, idx) => 
                                        idx > i && e.type === 'v2EndIndent' && (e as triggerEffectV2).indent === blockIndent + 1
                                    ) : -1}
                                    {#if endIndex !== -1 && effectElements[i] && effectElements[endIndex] && menu0Container}
                                        {@const startElement = effectElements[i]}
                                        {@const endElement = effectElements[endIndex]}
                                        {@const startRect = startElement.getBoundingClientRect()}
                                        {@const endRect = endElement.getBoundingClientRect()}
                                        {@const containerRect = menu0Container.getBoundingClientRect()}
                                        {#if startRect.width > 0 && endRect.width > 0 && startRect.height > 0 && endRect.height > 0}
                                            {@const startTop = startRect.bottom - containerRect.top + menu0Container.scrollTop}
                                            {@const endTop = endRect.top - containerRect.top + menu0Container.scrollTop + endRect.height * 0.5}
                                            {#if endTop > startTop}
                                                <div 
                                                    class="trigger-v2-guide-line-v"
                                                    style="left: {0.5 + blockIndent * 1}rem; top: {startTop}px; height: {endTop - startTop}px;"
                                                ></div>
                                                <div 
                                                    class="trigger-v2-guide-line-h"
                                                    style="left: {0.5 + blockIndent * 1}rem; top: {endTop}px; width: 0.5rem;"
                                                ></div>
                                            {/if}
                                        {/if}
                                    {/if}
                                {/if}
                            {/each}
                        {/key}
                        
                        {#each (value && value[selectedIndex] && value[selectedIndex].effect) ? value[selectedIndex].effect : [] as effect, i (effect)}
                            <div class="trigger-v2-drop-zone" 
                                class:trigger-v2-drop-zone-hover={!isMobileScreen && !isEffectDragging}
                                class:trigger-v2-drop-zone-active={isEffectDragging && effectDragOverIndex === i}
                                role="listitem"
                                ondragover={(e) => {
                                    if (!isMobileScreen && isEffectDragging) {
                                        e.preventDefault()
                                    }
                                }} 
                                ondrop={(e) => {
                                    if (!isMobileScreen && isEffectDragging) {
                                        handleEffectDrop(i, e)
                                        effectDragOverIndex = -1
                                    }
                                }}>
                            </div>

                            <div class="trigger-v2-effect-row"
                                class:trigger-v2-selection-hover={selectedEffectIndex !== i}
                                class:trigger-v2-selection-active={selectedEffectIndex === i}
                                ondragover={(e) => {
                                    if (!isMobileScreen && isEffectDragging) {
                                        e.preventDefault()
                                        const rect = e.currentTarget.getBoundingClientRect()
                                        const mouseY = e.clientY
                                        const elementCenter = rect.top + rect.height / 2
                                        
                                        if (mouseY < elementCenter) {
                                            effectDragOverIndex = i
                                        } else {
                                            effectDragOverIndex = i + 1
                                        }
                                    }
                                }}
                                ondragleave={(e) => {
                                    if (!isMobileScreen && isEffectDragging) {
                                        const rect = e.currentTarget.getBoundingClientRect()
                                        const mouseX = e.clientX
                                        const mouseY = e.clientY
                                        
                                        if (mouseX < rect.left || mouseX > rect.right || 
                                            mouseY < rect.top || mouseY > rect.bottom) {
                                            effectDragOverIndex = -1
                                        }
                                    }
                                }}
                                ondrop={(e) => {
                                    if (!isMobileScreen && isEffectDragging) {
                                        handleEffectDrop(effectDragOverIndex, e)
                                        effectDragOverIndex = -1
                                    }
                                }}>
                                <button type="button" class="trigger-v2-effect-button"
                                    bind:this={effectElements[i]}
                                    title="Select effect"
                                    aria-label="Select effect"
                                    onclick={() => {
                                        if(selectedEffectIndex === i && lastClickTime + 500 > Date.now()){
                                            if(selectedIndex > 0) {
                                                selectedTriggerIndex = selectedIndex;
                                                selectedEffectIndexSaved = selectedEffectIndex;
                                            }
                                            menuMode = 1
                                        }

                                        selectMode = 1
                                        lastClickTime = Date.now()
                                        selectedEffectIndex = i
                                    }}
                                    oncontextmenu={(e) => handleContextMenu(e, 1, i, effect)}
                                >
                                    {#if effect.type === 'v2EndIndent'}
                                        <div class="text-textcolor" style:margin-left={effect.indent + 'rem'}>...</div>
                                    {:else}
                                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                                        {@html formatEffectDisplay(effect)}
                                    {/if}
                                </button>
                                
                                {#if effect.type !== 'v2EndIndent' && effect.type !== 'v2Else'}
                                    <div class="trigger-v2-effect-handle"
                                         draggable={!isMobileScreen}
                                         onclick={(e) => {
                                             e.stopPropagation();
                                         }}
                                         oncontextmenu={(e) => {
                                             e.stopPropagation();
                                             e.preventDefault();
                                         }}
                                         ondragstart={(e) => {
                                             if (isMobileScreen) {
                                                 e.preventDefault()
                                                 return
                                             }
                                             isEffectDragging = true
                                             e.dataTransfer?.setData('text', 'effect')
                                             e.dataTransfer?.setData('effectIndex', i.toString())
                                             
                                             const dragElement = document.createElement('div')
                                             dragElement.textContent = formatEffectDisplay(effect).replace(/<[^>]*>/g, '') || 'Effect'
                                             dragElement.className = 'trigger-v2-drag-ghost'
                                             document.body.appendChild(dragElement)
                                             e.dataTransfer?.setDragImage(dragElement, 10, 10)
                                             
                                             setTimeout(() => {
                                                 document.body.removeChild(dragElement)
                                             }, 0)
                                         }}
                                         ondragend={(_e) => {
                                             isEffectDragging = false
                                             effectDragOverIndex = -1
                                             scrollManager.stopAutoScroll()
                                         }}>
                                        <div class="text-textcolor2 text-xs select-none">⋮⋮</div>
                                    </div>
                                {:else}
                                    <div class="trigger-v2-effect-handle-placeholder">
                                        <div class="text-textcolor2 opacity-20 text-xs select-none"></div>
                                    </div>
                                {/if}
                            </div>
                        {/each}
                        
                        <div class="trigger-v2-drop-zone" 
                            class:trigger-v2-drop-zone-hover={!isMobileScreen && !isEffectDragging}
                            class:trigger-v2-drop-zone-active={isEffectDragging && effectDragOverIndex === (value && value[selectedIndex] && value[selectedIndex].effect ? value[selectedIndex].effect.length : 0)}
                            role="listitem"
                            ondragover={(e) => {
                                if (!isMobileScreen && isEffectDragging) {
                                    e.preventDefault()
                                }
                            }} 
                            ondrop={(e) => {
                                if (!isMobileScreen && isEffectDragging) {
                                    handleEffectDrop(value && value[selectedIndex] && value[selectedIndex].effect ? value[selectedIndex].effect.length : 0, e)
                                    effectDragOverIndex = -1
                                }
                            }}>
                        </div>
                        
                        <button type="button" class="trigger-v2-add-effect trigger-v2-selection-hover" title="Add effect" aria-label="Add effect" onclick={() => {
                            //add effect
                            if(lastClickTime + 500 > Date.now()){
                                selectedEffectIndex = -1
                                if(selectedIndex > 0) {
                                    selectedTriggerIndex = selectedIndex;
                                    selectedEffectIndexSaved = selectedEffectIndex;
                                }
                                menuMode = 1
                            }
                            lastClickTime = Date.now()
                        }} oncontextmenu={(e) => handleContextMenu(e, 1)}>
                            ...
                        </button>
                    </div>
                </div>
            {:else if menuMode === 1}
                <div class="trigger-v2-type-layout">
                    <div class="trigger-v2-type-sidebar">
                        <div class="trigger-v2-type-sidebar-header">
                            <button type="button" class="trigger-v2-back-btn icon-btn icon-btn--sm" title="Back to trigger list" aria-label="Back to trigger list" onclick={() => {
                                if(selectedIndex > 0) {
                                    selectedTriggerIndex = selectedIndex;
                                    selectedEffectIndexSaved = selectedEffectIndex;
                                }
                                menuMode = 0
                            }}>
                                <ArrowLeftIcon />
                            </button>
                            <h3 class="ml-4 text-lg font-medium text-textcolor md:hidden">{language.triggerCategories[selectedCategory] || selectedCategory}</h3>
                        </div>
                        <div class="hidden md:flex md:flex-1 md:flex-col md:overflow-y-auto">
                            {#each getAvailableCategories() as category (category)}
                                <button 
                                    type="button"
                                    class="w-full p-3 text-left trigger-v2-selection-hover hover:text-textcolor transition-colors"
                                    class:trigger-v2-selection-active={selectedCategory === category}
                                    class:text-textcolor={selectedCategory === category}
                                    class:text-textcolor2={selectedCategory !== category}
                                    title={language.triggerCategories[category] || category}
                                    aria-label={language.triggerCategories[category] || category}
                                    aria-pressed={selectedCategory === category}
                                    onclick={() => {
                                        selectedCategory = category
                                    }}
                                >
                                    {language.triggerCategories[category] || category}
                                    {#if category === 'Deprecated'}
                                        <span class="trigger-v2-deprecated-note">(Deprecated)</span>
                                    {/if}
                                </button>
                            {/each}
                        </div>
                        <div class="trigger-v2-type-mobile-filter">
                            <SelectInput bind:value={selectedCategory}>
                                {#each getAvailableCategories() as category (category)}
                                    <OptionInput value={category}>{language.triggerCategories[category] || category}</OptionInput>
                                {/each}
                            </SelectInput>
                        </div>
                        <div class="trigger-v2-type-sidebar-footer">
                            <div class="trigger-v2-muted-note">
                                <CheckInput bind:check={DBState.db.showDeprecatedTriggerV2} name={language.showDeprecatedTriggerV2} grayText />
                            </div>
                        </div>
                    </div>
                    
                    <div class="trigger-v2-type-main">
                        <div class="trigger-v2-type-main-header">
                            <h3 class="text-lg font-medium text-textcolor">{language.triggerCategories[selectedCategory] || selectedCategory}</h3>
                        </div>
                        <div class="flex-1 overflow-y-auto">
                            {#each getFilteredTriggers() as type (type)}
                                <button 
                                    type="button"
                                    class="trigger-v2-type-item trigger-v2-selection-hover text-textcolor2 hover:text-textcolor" 
                                    class:opacity-60={effectCategories.Deprecated.includes(type)} 
                                    title={language.triggerDesc[type]}
                                    aria-label={language.triggerDesc[type]}
                                    onclick={(e) => {
                                        e.stopPropagation()
                                        makeDefaultEditType(type)
                                        if(selectedIndex > 0) {
                                            selectedTriggerIndex = selectedIndex;
                                            selectedEffectIndexSaved = selectedEffectIndex;
                                        }
                                        menuMode = 2
                                    }}
                                >
                                    <div>
                                        {language.triggerDesc[type]}
                                        {#if effectCategories.Deprecated.includes(type)}
                                            <span class="trigger-v2-deprecated-note">(Deprecated)</span>
                                        {/if}
                                    </div>
                                </button>
                            {/each}
                        </div>
                        <div class="trigger-v2-type-mobile-footer">
                            <div class="trigger-v2-muted-note">
                                <CheckInput bind:check={DBState.db.showDeprecatedTriggerV2} name={language.showDeprecatedTriggerV2} grayText />
                            </div>
                        </div>
                    </div>
                </div>
            {:else if menuMode === 2 || menuMode === 3}
                <div class="trigger-v2-edit-panel panel-shell">
                    <div class="trigger-v2-edit-header">
                        <button type="button" class="trigger-v2-back-btn icon-btn icon-btn--sm" title="Back to trigger types" aria-label="Back to trigger types" onclick={() => {
                            if(menuMode === 3 && selectedIndex > 0) {
                                selectedTriggerIndex = selectedIndex;
                                selectedEffectIndexSaved = selectedEffectIndex;
                            }
                            menuMode = menuMode === 2 ? 1 : 0
                        }}>
                            <ArrowLeftIcon />
                        </button>
                        <h2 class="trigger-v2-edit-title">
                            {language.triggerDesc[editTrigger.type]}
                        </h2>
                    </div>
                    {#if editTrigger.type === 'v2SetVar'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.varName}</span>
                        <TextInput bind:value={editTrigger.var} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.operator}</span>
                        <SelectInput bind:value={editTrigger.operator}>
                            <OptionInput value="=">{language.triggerInputLabels.operatorSet}</OptionInput>
                            <OptionInput value="+=">{language.triggerInputLabels.operatorAdd}</OptionInput>
                            <OptionInput value="-=">{language.triggerInputLabels.operatorSubtract}</OptionInput>
                            <OptionInput value="*=">{language.triggerInputLabels.operatorMultiply}</OptionInput>
                            <OptionInput value="/=">{language.triggerInputLabels.operatorDivide}</OptionInput>
                            <OptionInput value="%=">{language.triggerInputLabels.operatorModulo}</OptionInput>
                        </SelectInput>
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.value}</span>
                        <SelectInput bind:value={editTrigger.valueType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextAreaInput highlight bind:value={editTrigger.value} />
                    {:else if editTrigger.type === 'v2If' || editTrigger.type === 'v2IfAdvanced'}
                        
                        <span class="trigger-v2-field-label">{editTrigger.type === 'v2If' ? language.triggerInputLabels.varName : 'A'}</span>
                        {#if editTrigger.type === 'v2IfAdvanced'}
                            <SelectInput bind:value={editTrigger.sourceType}>
                                <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                                <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                            </SelectInput>
                        {/if}
                        <TextInput bind:value={editTrigger.source} />

                        <span class="trigger-v2-field-label">{language.triggerInputLabels.condition}</span>
                        <SelectInput bind:value={editTrigger.condition} onchange={(e) => {
                            if(e.currentTarget.value === '≡'){
                                const trg = editTrigger as triggerV2IfAdvanced
                                trg.condition = '≡'
                                trg.target = 'true'
                                trg.targetType = 'value'
                            }
                        }}>
                            <OptionInput value="=">{language.triggerInputLabels.conditionEqual}</OptionInput>
                            <OptionInput value="!=">{language.triggerInputLabels.conditionNotEqual}</OptionInput>
                            <OptionInput value=">">{language.triggerInputLabels.conditionGreater}</OptionInput>
                            <OptionInput value="<">{language.triggerInputLabels.conditionLess}</OptionInput>
                            <OptionInput value=">=">{language.triggerInputLabels.conditionGreaterEqual}</OptionInput>
                            <OptionInput value="<=">{language.triggerInputLabels.conditionLessEqual}</OptionInput>
                            {#if editTrigger.type === 'v2IfAdvanced'}
                                <OptionInput value="≒">{language.triggerInputLabels.conditionSimilar}</OptionInput>
                                <OptionInput value="∋">{language.triggerInputLabels.conditionContains}</OptionInput>
                                <OptionInput value="∈">{language.triggerInputLabels.conditionIn}</OptionInput>
                                <OptionInput value="∌">{language.triggerInputLabels.conditionNotContains}</OptionInput>
                                <OptionInput value="∉">{language.triggerInputLabels.conditionNotIn}</OptionInput>
                                <OptionInput value="≡">{language.triggerInputLabels.conditionTruthy}</OptionInput>
                            {/if}
                        </SelectInput>

                        <span class="trigger-v2-field-label">{editTrigger.type === 'v2If' ? language.triggerInputLabels.value : 'B'}</span>
                        {#if editTrigger.condition === '≡'}
                            <SelectInput bind:value={editTrigger.target}>
                                <OptionInput value="true">{language.triggerInputLabels.boolTrue}</OptionInput>
                                <OptionInput value="false">{language.triggerInputLabels.boolFalse}</OptionInput>
                                <OptionInput value="null">{language.triggerInputLabels.boolNull}</OptionInput>
                            </SelectInput>
                        {:else}
                            <SelectInput bind:value={editTrigger.targetType}>
                                <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                                <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                            </SelectInput>
                            <TextInput bind:value={editTrigger.target} />
                        {/if}

                        <CheckInput bind:check={addElse} name={language.triggerInputLabels.addElse} className="mt-4"/>
                    {:else if editTrigger.type === 'v2RunTrigger'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.trigger}</span>
                        <SelectInput bind:value={editTrigger.target}>
                            {#each value as trigger, i (trigger)}
                                {#if i === 0}
                                    <!-- Header, skip the first trigger -->
                                {:else}
                                    <OptionInput value={trigger.comment}>{trigger.comment || 'Unnamed Trigger'}</OptionInput>
                                {/if}
                            {/each}
                        </SelectInput>
                    {:else if editTrigger.type === 'v2ConsoleLog'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.value}</span>
                        <SelectInput bind:value={editTrigger.sourceType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.source} />

                    {:else if editTrigger.type === 'v2ShowAlert'}
                        <span>{language.triggerInputLabels.alertContent}</span>
                        <SelectInput bind:value={editTrigger.valueType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.value} />

                    {:else if editTrigger.type === 'v2RunLLM'}
                        <span>{language.triggerInputLabels.prompt}</span>
                        <SelectInput bind:value={editTrigger.valueType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextAreaInput highlight bind:value={editTrigger.value} />

                        <span>{language.triggerInputLabels.model}</span>
                        <SelectInput bind:value={editTrigger.model}>
                            <OptionInput value="model">{language.triggerInputLabels.modelMain}</OptionInput>
                            <OptionInput value="submodel">{language.triggerInputLabels.modelSub}</OptionInput>
                        </SelectInput>

                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />

                    {:else if editTrigger.type === 'v2CheckSimilarity'}
                        <span>{language.triggerInputLabels.source}</span>
                        <SelectInput bind:value={editTrigger.sourceType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.source} />
                        <span>{language.triggerInputLabels.value}</span>
                        <SelectInput bind:value={editTrigger.valueType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.value} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />
                    {:else if editTrigger.type === 'v2CutChat'}
                        <span>{language.triggerInputLabels.start}</span>
                        <SelectInput bind:value={editTrigger.startType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.start} />
                        <span>{language.triggerInputLabels.end}</span>
                        <SelectInput bind:value={editTrigger.endType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.end} />
                        
                    {:else if editTrigger.type === 'v2Command'}
                        <span>{language.triggerInputLabels.cmd}</span>
                        <SelectInput bind:value={editTrigger.valueType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.value} />

                    {:else if editTrigger.type === 'v2SystemPrompt'}
                        <span>{language.triggerInputLabels.location}</span>
                        <SelectInput bind:value={editTrigger.location}>
                            <OptionInput value="start">{language.triggerInputLabels.sysStart}</OptionInput>
                            <OptionInput value="historyend">{language.triggerInputLabels.sysHistoryEnd}</OptionInput>
                            <OptionInput value="promptend">{language.triggerInputLabels.sysPromptEnd}</OptionInput>
                        </SelectInput>
                        <span>{language.triggerInputLabels.value}</span>
                        <SelectInput bind:value={editTrigger.valueType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextAreaInput highlight bind:value={editTrigger.value} />

                    {:else if editTrigger.type === 'v2Impersonate'}
                        <span>{language.triggerInputLabels.role}</span>
                        <SelectInput bind:value={editTrigger.role}>
                            <OptionInput value="user">{language.triggerInputLabels.roleUser}</OptionInput>
                            <OptionInput value="char">{language.triggerInputLabels.roleChar}</OptionInput>
                        </SelectInput>
                        <span>{language.triggerInputLabels.value}</span>
                        <SelectInput bind:value={editTrigger.valueType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextAreaInput highlight bind:value={editTrigger.value} />

                    {:else if editTrigger.type === 'v2ModifyChat'}
                        <span>{language.triggerInputLabels.index}</span>
                        <SelectInput bind:value={editTrigger.indexType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.index} />
                        <span>{language.triggerInputLabels.value}</span>
                        <SelectInput bind:value={editTrigger.valueType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextAreaInput highlight bind:value={editTrigger.value} />
                    {:else if editTrigger.type === 'v2LoopNTimes'}
                        <span>{language.triggerInputLabels.value}</span>
                        <SelectInput bind:value={editTrigger.valueType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.value} />
                    {:else if editTrigger.type === 'v2GetLastMessage'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />

                    {:else if editTrigger.type === 'v2GetMessageAtIndex'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.index}</span>
                        <SelectInput bind:value={editTrigger.indexType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.index} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />

                    {:else if editTrigger.type === 'v2GetMessageCount'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />

                    {:else if editTrigger.type === 'v2ModifyLorebook'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.target}</span>
                        <SelectInput bind:value={editTrigger.targetType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.target} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.value}</span>
                        <SelectInput bind:value={editTrigger.valueType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.value} />

                    {:else if editTrigger.type === 'v2GetLorebook'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.target}</span>
                        <SelectInput bind:value={editTrigger.targetType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.target} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />

                    {:else if editTrigger.type === 'v2GetLorebookCountNew'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />

                    {:else if editTrigger.type === 'v2GetLorebookEntry'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.index}</span>
                        <SelectInput bind:value={editTrigger.indexType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.index} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />

                    {:else if editTrigger.type === 'v2SetLorebookActivation'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.index}</span>
                        <SelectInput bind:value={editTrigger.indexType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.index} />
                        <CheckInput bind:check={editTrigger.value} name={language.triggerInputLabels.alwaysActive} className="mt-4" />
                    {:else if editTrigger.type === 'v2GetLorebookIndexViaName'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.name}</span>
                        <SelectInput bind:value={editTrigger.nameType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.name} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />
                    {:else if editTrigger.type === 'v2Random'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.min}</span>
                        <SelectInput bind:value={editTrigger.minType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.min} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.max}</span>
                        <SelectInput bind:value={editTrigger.maxType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.max} />

                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />
                    {:else if editTrigger.type === 'v2GetCharAt'}
                        <span>{language.triggerInputLabels.source}</span>
                        <SelectInput bind:value={editTrigger.sourceType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.source} />
                        <span>{language.triggerInputLabels.index}</span>
                        <SelectInput bind:value={editTrigger.indexType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.index} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />
                    

                    {:else if editTrigger.type === 'v2GetCharCount'}
                        <span>{language.triggerInputLabels.source}</span>
                        <SelectInput bind:value={editTrigger.sourceType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.source} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />
                    
                    {:else if editTrigger.type === 'v2ToLowerCase'}
                        <span>{language.triggerInputLabels.source}</span>
                        <SelectInput bind:value={editTrigger.sourceType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.source} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />

                    {:else if editTrigger.type === 'v2ToUpperCase'}
                        <span>{language.triggerInputLabels.source}</span>
                        <SelectInput bind:value={editTrigger.sourceType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.source} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />

                    {:else if editTrigger.type === 'v2SetCharAt'}
                        <span>{language.triggerInputLabels.source}</span>
                        <SelectInput bind:value={editTrigger.sourceType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.source} />
                        <span>{language.triggerInputLabels.index}</span>
                        <SelectInput bind:value={editTrigger.indexType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.index} />
                        <span>{language.triggerInputLabels.value}</span>
                        <SelectInput bind:value={editTrigger.valueType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.value} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />

                    {:else if editTrigger.type === 'v2SplitString'}
                        <span>{language.triggerInputLabels.source}</span>
                        <SelectInput bind:value={editTrigger.sourceType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.source} />
                        <span>{language.triggerInputLabels.delimiter}</span>
                        <SelectInput bind:value={editTrigger.delimiterType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                            <OptionInput value="regex">{language.triggerInputLabels.regex}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.delimiter} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />

                    {:else if editTrigger.type === 'v2JoinArrayVar'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.var}</span>
                        <SelectInput bind:value={editTrigger.varType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.var} />
                        <span>{language.triggerInputLabels.delimiter}</span>
                        <SelectInput bind:value={editTrigger.delimiterType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.delimiter} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />

                    {:else if editTrigger.type === 'v2GetCharacterDesc'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />

                    {:else if editTrigger.type === 'v2SetCharacterDesc'}
                        <span>{language.triggerInputLabels.value}</span>
                        <SelectInput bind:value={editTrigger.valueType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextAreaInput highlight  bind:value={editTrigger.value} />
                    {:else if editTrigger.type === 'v2GetPersonaDesc'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />
                    {:else if editTrigger.type === 'v2SetPersonaDesc'}
                        <span>{language.triggerInputLabels.value}</span>
                        <SelectInput bind:value={editTrigger.valueType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextAreaInput highlight  bind:value={editTrigger.value} />
                    {:else if editTrigger.type === 'v2ExtractRegex'}
                        <span>{language.triggerInputLabels.source}</span>
                        <SelectInput bind:value={editTrigger.valueType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.value} />
                        <span>{language.triggerInputLabels.regex}</span>
                        <SelectInput bind:value={editTrigger.regexType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.regex} />

                        <span>{language.triggerInputLabels.resultFormat}</span>
                        <SelectInput bind:value={editTrigger.resultType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.result} />

                        <span>{language.triggerInputLabels.flags}</span>
                        <SelectInput bind:value={editTrigger.flagsType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.flags} />

                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />
                    {:else if editTrigger.type === 'v2MakeArrayVar'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.var}</span>
                        <TextInput bind:value={editTrigger.var} />

                    {:else if editTrigger.type === 'v2GetArrayVarLength'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.var}</span>
                        <TextInput bind:value={editTrigger.var} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />

                    {:else if editTrigger.type === 'v2GetArrayVar'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.var}</span>
                        <TextInput bind:value={editTrigger.var} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.index}</span>
                        <SelectInput bind:value={editTrigger.indexType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.index} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />

                    {:else if editTrigger.type === 'v2SetArrayVar'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.var}</span>
                        <TextInput bind:value={editTrigger.var} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.index}</span>
                        <SelectInput bind:value={editTrigger.indexType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.index} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.value}</span>
                        <SelectInput bind:value={editTrigger.valueType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.value} />

                    {:else if editTrigger.type === 'v2PushArrayVar'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.var}</span>
                        <TextInput bind:value={editTrigger.var} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.value}</span>
                        <SelectInput bind:value={editTrigger.valueType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.value} />

                    {:else if editTrigger.type === 'v2PopArrayVar'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.var}</span>
                        <TextInput bind:value={editTrigger.var} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />

                    {:else if editTrigger.type === 'v2ShiftArrayVar'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.var}</span>
                        <TextInput bind:value={editTrigger.var} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />

                    {:else if editTrigger.type === 'v2UnshiftArrayVar'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.var}</span>
                        <TextInput bind:value={editTrigger.var} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.value}</span>
                        <SelectInput bind:value={editTrigger.valueType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.value} />

                    {:else if editTrigger.type === 'v2SpliceArrayVar'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.var}</span>
                        <TextInput bind:value={editTrigger.var} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.start}</span>
                        <SelectInput bind:value={editTrigger.startType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.start} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.value}</span>
                        <SelectInput bind:value={editTrigger.itemType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.item} />
                    {:else if editTrigger.type === 'v2SliceArrayVar'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.var}</span>
                        <TextInput bind:value={editTrigger.var} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.start}</span>
                        <SelectInput bind:value={editTrigger.startType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.start} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.end}</span>
                        <SelectInput bind:value={editTrigger.endType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.end} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />
                    {:else if editTrigger.type === 'v2GetIndexOfValueInArrayVar'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.var}</span>
                        <TextInput bind:value={editTrigger.var} />

                        <span class="trigger-v2-field-label">{language.triggerInputLabels.value}</span>
                        <SelectInput bind:value={editTrigger.valueType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>

                        <TextInput bind:value={editTrigger.value} />

                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />
                    {:else if editTrigger.type === 'v2RemoveIndexFromArrayVar'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.var}</span>
                        <TextInput bind:value={editTrigger.var} />

                        <span class="trigger-v2-field-label">{language.triggerInputLabels.index}</span>
                        <SelectInput bind:value={editTrigger.indexType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.index} />
                    {:else if editTrigger.type === 'v2ConcatString'}
                        <span class="trigger-v2-field-label">A</span>
                        <SelectInput bind:value={editTrigger.source1Type}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.source1} />

                        <span class="trigger-v2-field-label">B</span>
                        <SelectInput bind:value={editTrigger.source2Type}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.source2} />

                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />
                    {:else if editTrigger.type === 'v2GetLastUserMessage'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />
                    {:else if editTrigger.type === 'v2GetLastCharMessage'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />
                    {:else if editTrigger.type === 'v2GetFirstMessage'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />
                    {:else if editTrigger.type === 'v2GetAlertInput'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.alertContent}</span>
                        <SelectInput bind:value={editTrigger.displayType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.display} />

                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />
                    {:else if editTrigger.type === 'v2GetAlertSelect'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.alertContent}</span>
                        <SelectInput bind:value={editTrigger.displayType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.display} />

                        <span class="trigger-v2-field-label">{language.triggerInputLabels.options} <Help key="v2GetAlertSelect" /></span>
                        <SelectInput bind:value={editTrigger.valueType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.value} />

                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />
                    {:else if editTrigger.type === 'v2GetDisplayState'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />
                    {:else if editTrigger.type === 'v2SetDisplayState'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.value}</span>
                        <SelectInput bind:value={editTrigger.valueType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.value} />
                    {:else if editTrigger.type === 'v2Wait'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.value}</span>
                        <SelectInput bind:value={editTrigger.valueType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.value} />
                    {:else if editTrigger.type === 'v2GetRequestState'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.index}</span>
                        <SelectInput bind:value={editTrigger.indexType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.index} />

                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />
                    {:else if editTrigger.type === 'v2GetRequestStateRole'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.index}</span>
                        <SelectInput bind:value={editTrigger.indexType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.index} />

                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />
                    {:else if editTrigger.type === 'v2SetRequestState'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.index}</span>
                        <SelectInput bind:value={editTrigger.indexType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.index} />

                        <span class="trigger-v2-field-label">{language.triggerInputLabels.value}</span>
                        <SelectInput bind:value={editTrigger.valueType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.value} />
                    {:else if editTrigger.type === 'v2SetRequestStateRole'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.index}</span>
                        <SelectInput bind:value={editTrigger.indexType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.index} />

                        <span class="trigger-v2-field-label">{language.triggerInputLabels.value}</span>
                        <SelectInput bind:value={editTrigger.valueType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.value} />
                    {:else if editTrigger.type === 'v2GetRequestStateLength'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />
                    {:else if editTrigger.type === 'v2QuickSearchChat'}
                        <span class="trigger-v2-field-label">{language.value}</span>
                        <SelectInput bind:value={editTrigger.valueType}>
                            <OptionInput value="value">{language.value}</OptionInput>
                            <OptionInput value="var">{language.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.value} />

                        <span class="trigger-v2-field-label">{language.condition}</span>
                        <SelectInput bind:value={editTrigger.condition}>
                            <OptionInput value="loose">loose</OptionInput>
                            <OptionInput value="strict">strict</OptionInput>
                            <OptionInput value="regex">regex</OptionInput>
                        </SelectInput>

                        <span class="trigger-v2-field-label">{language.depth}</span>
                        <SelectInput bind:value={editTrigger.depthType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.depth} />

                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />
                    {:else if editTrigger.type === 'v2Tokenize'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.value}</span>
                        <SelectInput bind:value={editTrigger.valueType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.value} />

                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />
                    {:else if editTrigger.type === 'v2GetAllLorebooks'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />
                    {:else if editTrigger.type === 'v2GetLorebookByName'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.name}</span>
                        <SelectInput bind:value={editTrigger.nameType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.name} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />
                    {:else if editTrigger.type === 'v2GetLorebookByIndex'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.index}</span>
                        <SelectInput bind:value={editTrigger.indexType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.index} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />
                    {:else if editTrigger.type === 'v2CreateLorebook'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.name}</span>
                        <SelectInput bind:value={editTrigger.nameType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.name} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.activationKeys}</span>
                        <SelectInput bind:value={editTrigger.keyType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.key} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.prompt}</span>
                        <SelectInput bind:value={editTrigger.contentType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextAreaInput bind:value={editTrigger.content} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.insertOrder}</span>
                        <SelectInput bind:value={editTrigger.insertOrderType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.insertOrder} />
                    {:else if editTrigger.type === 'v2ModifyLorebookByIndex'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.index}</span>
                        <SelectInput bind:value={editTrigger.indexType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.index} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.name}</span>
                        <SelectInput bind:value={editTrigger.nameType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.name} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.activationKeys}</span>
                        <SelectInput bind:value={editTrigger.keyType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.key} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.prompt}</span>
                        <SelectInput bind:value={editTrigger.contentType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextAreaInput bind:value={editTrigger.content} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.insertOrder}</span>
                        <SelectInput bind:value={editTrigger.insertOrderType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.insertOrder} />
                    {:else if editTrigger.type === 'v2DeleteLorebookByIndex'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.index}</span>
                        <SelectInput bind:value={editTrigger.indexType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.index} />
                    {:else if editTrigger.type === 'v2SetLorebookAlwaysActive'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.index}</span>
                        <SelectInput bind:value={editTrigger.indexType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.index} />
                        <CheckInput bind:check={editTrigger.value} name={language.triggerInputLabels.alwaysActive} className="mt-4" />
                    {:else if editTrigger.type === 'v2UpdateChatAt'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.index}</span>
                        <TextInput bind:value={editTrigger.index} />
                    {:else if editTrigger.type === 'v2RegexTest'}
                        <span>{language.triggerInputLabels.source}</span>
                        <SelectInput bind:value={editTrigger.valueType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.value} />
                        <span>{language.triggerInputLabels.regex}</span>
                        <SelectInput bind:value={editTrigger.regexType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.regex} />

                        <span>{language.triggerInputLabels.flags}</span>
                        <SelectInput bind:value={editTrigger.flagsType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.flags} />

                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar} <Help key="v2RegexTest" /></span>
                        <TextInput bind:value={editTrigger.outputVar} />
                    {:else if editTrigger.type === 'v2GetReplaceGlobalNote'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />
                    {:else if editTrigger.type === 'v2SetReplaceGlobalNote'}
                        <span>{language.triggerInputLabels.value}</span>
                        <SelectInput bind:value={editTrigger.valueType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextAreaInput highlight bind:value={editTrigger.value} />
                    {:else if editTrigger.type === 'v2GetAuthorNote'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />
                    {:else if editTrigger.type === 'v2SetAuthorNote'}
                        <span>{language.triggerInputLabels.value}</span>
                        <SelectInput bind:value={editTrigger.valueType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextAreaInput highlight bind:value={editTrigger.value} />
                    {:else if editTrigger.type === 'v2MakeDictVar'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.var}</span>
                        <TextInput bind:value={editTrigger.var} />
                    {:else if editTrigger.type === 'v2GetDictVar'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.var}</span>
                        <SelectInput bind:value={editTrigger.varType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.var} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.key}</span>
                        <SelectInput bind:value={editTrigger.keyType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.key} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />
                    {:else if editTrigger.type === 'v2SetDictVar'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.var}</span>
                        <SelectInput bind:value={editTrigger.varType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.var} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.key}</span>
                        <SelectInput bind:value={editTrigger.keyType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.key} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.value}</span>
                        <SelectInput bind:value={editTrigger.valueType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.value} />
                    {:else if editTrigger.type === 'v2DeleteDictKey'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.var}</span>
                        <SelectInput bind:value={editTrigger.varType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.var} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.key}</span>
                        <SelectInput bind:value={editTrigger.keyType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.key} />
                    {:else if editTrigger.type === 'v2HasDictKey'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.var}</span>
                        <SelectInput bind:value={editTrigger.varType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.var} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.key}</span>
                        <SelectInput bind:value={editTrigger.keyType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.key} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />
                    {:else if editTrigger.type === 'v2ClearDict'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.var}</span>
                        <TextInput bind:value={editTrigger.var} />
                    {:else if editTrigger.type === 'v2GetDictSize'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.var}</span>
                        <SelectInput bind:value={editTrigger.varType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.var} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />
                    {:else if editTrigger.type === 'v2GetDictKeys'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.var}</span>
                        <SelectInput bind:value={editTrigger.varType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.var} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />
                    {:else if editTrigger.type === 'v2GetDictValues'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.var}</span>
                        <SelectInput bind:value={editTrigger.varType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.var} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />
                    {:else if editTrigger.type === 'v2Calculate'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.expression} <Help key="v2Calculate" /></span>
                        <SelectInput bind:value={editTrigger.expressionType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextAreaInput highlight bind:value={editTrigger.expression} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />
                    {:else if editTrigger.type === 'v2ReplaceString'}
                        <span>{language.triggerInputLabels.source}</span>
                        <SelectInput bind:value={editTrigger.sourceType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.source} />
                        <span>{language.triggerInputLabels.regex}</span>
                        <SelectInput bind:value={editTrigger.regexType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.regex} />
                        <span>{language.triggerInputLabels.resultFormat}</span>
                        <SelectInput bind:value={editTrigger.resultType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.result} />
                        <span>{language.triggerInputLabels.replacement}</span>
                        <SelectInput bind:value={editTrigger.replacementType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.replacement} />
                        <span>{language.triggerInputLabels.flags}</span>
                        <SelectInput bind:value={editTrigger.flagsType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.flags} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.outputVar}</span>
                        <TextInput bind:value={editTrigger.outputVar} />
                    {:else if editTrigger.type === 'v2Comment'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.value}</span>
                        <TextInput bind:value={editTrigger.value} />
                    {:else if editTrigger.type === 'v2DeclareLocalVar'}
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.varName}</span>
                        <TextInput bind:value={editTrigger.var} />
                        <span class="trigger-v2-field-label">{language.triggerInputLabels.value}</span>
                        <SelectInput bind:value={editTrigger.valueType}>
                            <OptionInput value="value">{language.triggerInputLabels.value}</OptionInput>
                            <OptionInput value="var">{language.triggerInputLabels.var}</OptionInput>
                        </SelectInput>
                        <TextInput bind:value={editTrigger.value} />
                    {:else}
                        <span>{language.noConfig}</span>
                    {/if}

                    <Button className="mt-4" onclick={() => {
                        if(!value || !value[selectedIndex] || selectedIndex < 0 || selectedIndex >= value.length) return;
                        if(selectedEffectIndex === -1){
                            value[selectedIndex].effect.push(editTrigger)

                            if(editTrigger.type === 'v2If'  || editTrigger.type === 'v2IfAdvanced' || editTrigger.type === 'v2Loop' || editTrigger.type === 'v2Else' || editTrigger.type === 'v2LoopNTimes'){
                                value[selectedIndex].effect.push({
                                    type: 'v2EndIndent',
                                    indent: editTrigger.indent + 1,
                                    endOfLoop: editTrigger.type === 'v2Loop' || editTrigger.type === 'v2LoopNTimes'
                                })

                                if(addElse){
                                    value[selectedIndex].effect.push({
                                        type: 'v2Else',
                                        indent: editTrigger.indent
                                    })
                                    value[selectedIndex].effect.push({
                                        type: 'v2EndIndent',
                                        indent: editTrigger.indent + 1
                                    })
                                }
                            }
                        }
                        else if(menuMode === 2){
                            editTrigger.indent = (value[selectedIndex].effect[selectedEffectIndex] as triggerEffectV2).indent
                            if(editTrigger.type === 'v2If' || editTrigger.type === 'v2IfAdvanced' || editTrigger.type === 'v2Loop' || editTrigger.type === 'v2LoopNTimes' || editTrigger.type === 'v2Else'){
                                value[selectedIndex].effect.splice(selectedEffectIndex, 0, {
                                    type: 'v2EndIndent',
                                    indent: editTrigger.indent + 1,
                                    endOfLoop: editTrigger.type === 'v2Loop' || editTrigger.type === 'v2LoopNTimes'
                                })
                                
                                if(addElse){
                                    value[selectedIndex].effect.splice(selectedEffectIndex, 0, {
                                        type: 'v2Else',
                                        indent: editTrigger.indent
                                    })
                                    value[selectedIndex].effect.splice(selectedEffectIndex, 0, {
                                        type: 'v2EndIndent',
                                        indent: editTrigger.indent + 1
                                    })
                                }
                            }
                            value[selectedIndex].effect.splice(selectedEffectIndex, 0, editTrigger)
                        }
                        else if(menuMode === 3){
                            const originalEffect = value[selectedIndex].effect[selectedEffectIndex] as triggerEffectV2
                            const isIfType = editTrigger.type === 'v2If' || editTrigger.type === 'v2IfAdvanced'
                            
                            if(isIfType){
                                let hasExistingElse = false
                                let elseIndex = -1
                                let endIndentIndex = -1
                                
                                let pointer = selectedEffectIndex + 1
                                const indent = originalEffect.indent
                                while(pointer < value[selectedIndex].effect.length){
                                    const effect = value[selectedIndex].effect[pointer] as triggerEffectV2
                                    if(effect.type === 'v2EndIndent' && effect.indent === indent + 1){
                                        endIndentIndex = pointer
                                        break
                                    }
                                    pointer++
                                }
                                
                                if(endIndentIndex !== -1 && endIndentIndex + 1 < value[selectedIndex].effect.length){
                                    const nextEffect = value[selectedIndex].effect[endIndentIndex + 1] as triggerEffectV2
                                    if(nextEffect.type === 'v2Else' && nextEffect.indent === indent){
                                        hasExistingElse = true
                                        elseIndex = endIndentIndex + 1
                                    }
                                }
                                
                                if(addElse && !hasExistingElse){
                                    value[selectedIndex].effect.splice(endIndentIndex + 1, 0, {
                                        type: 'v2Else',
                                        indent: indent
                                    })
                                    value[selectedIndex].effect.splice(endIndentIndex + 2, 0, {
                                        type: 'v2EndIndent',
                                        indent: indent + 1
                                    })
                                }
                                else if(!addElse && hasExistingElse){
                                    let elseEndIndex = -1
                                    pointer = elseIndex + 1
                                    while(pointer < value[selectedIndex].effect.length){
                                        const effect = value[selectedIndex].effect[pointer] as triggerEffectV2
                                        if(effect.type === 'v2EndIndent' && effect.indent === indent + 1){
                                            elseEndIndex = pointer
                                            break
                                        }
                                        pointer++
                                    }
                                    
                                    if(elseEndIndex !== -1){
                                        value[selectedIndex].effect.splice(elseIndex, elseEndIndex - elseIndex + 1)
                                    }
                                }
                            }
                            
                            value[selectedIndex].effect[selectedEffectIndex] = editTrigger
                        }
                        else{
                            value[selectedIndex].effect[selectedEffectIndex] = editTrigger
                        }
                        if(selectedIndex > 0) {
                            selectedTriggerIndex = selectedIndex;
                            selectedEffectIndexSaved = selectedEffectIndex;
                        }
                        menuMode = 0
                        updateGuideLines()
                    }}>Save</Button>

                    {#if menuMode === 3}
                        <Button className="mt-2" onclick={() => {
                            deleteEffect()
                            selectedEffectIndex = -1
                            if(selectedIndex > 0) {
                                selectedTriggerIndex = selectedIndex;
                                selectedEffectIndexSaved = selectedEffectIndex;
                            }
                            menuMode = 0
                        }}>Delete</Button>
                    {/if}
                </div>
            {/if}
        </div>
    </div>
</Portal>
{/if}

<style>
    .trigger-v2-launcher {
        width: 100%;
        max-width: 100%;
        margin-top: var(--ds-space-2);
        display: flex;
        flex-direction: column;
        padding: var(--ds-space-2);
        border: 1px solid var(--ds-border-strong);
        border-radius: var(--ds-radius-md);
        background: var(--ds-surface-2);
        box-sizing: border-box;
    }

    .trigger-v2-overlay {
        position: absolute;
        inset: 0;
        z-index: 40;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        max-width: 100%;
        color: var(--ds-text-primary);
        background: rgb(0 0 0 / 0.5);
    }

    .trigger-v2-context-menu {
        position: absolute;
        z-index: 50;
        box-sizing: border-box;
    }

    .trigger-v2-context-header {
        margin-bottom: var(--ds-space-2);
        padding-bottom: var(--ds-space-2);
        border-bottom: 1px solid var(--ds-border-subtle);
        color: var(--ds-text-secondary);
        font-size: var(--ds-font-size-xs);
    }

    .trigger-v2-panel {
        max-width: 100%;
        max-height: 100%;
        overflow-y: auto;
        display: flex;
        flex-direction: column-reverse;
        padding: var(--ds-space-2);
        box-sizing: border-box;
    }

    .trigger-v2-panel-width-edit {
        width: 80rem;
    }

    .trigger-v2-panel-width-menu {
        width: 48rem;
    }

    .trigger-v2-panel-fill {
        height: 100%;
    }

    .trigger-v2-left-column {
        margin-top: var(--ds-space-2);
        padding-right: var(--ds-space-2);
        display: flex;
        flex-direction: column;
    }

    .trigger-v2-trigger-scroll {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
    }

    .trigger-v2-drop-zone {
        width: 100%;
        height: 2px;
        min-height: 2px;
        transition: height var(--ds-motion-fast) var(--ds-ease-standard),
            min-height var(--ds-motion-fast) var(--ds-ease-standard),
            background-color var(--ds-motion-fast) var(--ds-ease-standard),
            box-shadow var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .trigger-v2-drop-zone-hover:hover {
        background: var(--ds-border-strong);
    }

    .trigger-v2-drop-zone-active {
        height: 4px;
        min-height: 4px;
        background: var(--ds-text-primary);
        box-shadow: 0 0 0 1px rgb(0 0 0 / 0.2);
    }

    .trigger-v2-trigger-button {
        padding: var(--ds-space-2);
        text-align: left;
        user-select: none;
    }

    .trigger-v2-trigger-button-draggable:hover {
        cursor: grab;
    }

    .trigger-v2-trigger-button-draggable:active {
        cursor: grabbing;
    }

    .trigger-v2-trigger-button-selected {
        background: var(--ds-surface-1);
    }

    :global(.trigger-v2-drag-ghost) {
        position: absolute;
        top: -9999px;
        left: -9999px;
        z-index: 50;
        padding: 0.5rem 1rem;
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-sm);
        background: var(--ds-surface-2);
        color: var(--ds-text-secondary);
        font-size: var(--ds-font-size-sm);
        white-space: nowrap;
        box-shadow: 0 12px 20px rgb(0 0 0 / 0.3);
        pointer-events: none;
    }

    .trigger-v2-editor {
        display: flex;
        flex-direction: column;
        background: var(--ds-surface-1);
        height: 100svh;
        min-height: 100svh;
    }

    .trigger-v2-editor-header {
        margin-bottom: 0;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        align-items: stretch;
    }

    .trigger-v2-editor-field {
        padding: var(--ds-space-2);
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 4.5rem;
    }

    .trigger-v2-editor-input-wrap {
        flex: 1;
        min-height: 2.5rem;
        display: flex;
    }

    .trigger-v2-effect-list {
        position: relative;
        flex: 1;
        margin-right: var(--ds-space-2);
        margin-bottom: var(--ds-space-2);
        margin-left: var(--ds-space-2);
        overflow-x: hidden;
        overflow-y: auto;
        box-sizing: border-box;
    }

    .trigger-v2-guide-line-v {
        position: absolute;
        width: 1px;
        background: var(--ds-border-strong);
        opacity: 0.4;
    }

    .trigger-v2-guide-line-h {
        position: absolute;
        height: 1px;
        background: var(--ds-border-strong);
        opacity: 0.4;
    }

    .trigger-v2-effect-row {
        position: relative;
        display: flex;
        align-items: center;
        width: 100%;
    }

    .trigger-v2-effect-button {
        position: relative;
        flex: 1;
        overflow: hidden;
        padding: var(--ds-space-2);
        color: var(--ds-text-primary);
        text-align: left;
        white-space: normal;
        word-break: break-word;
    }

    .trigger-v2-effect-handle {
        width: 2rem;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: move;
        opacity: 0.3;
        transition: opacity var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .trigger-v2-effect-handle:hover {
        opacity: 0.7;
    }

    .trigger-v2-effect-handle-placeholder {
        width: 2rem;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .trigger-v2-add-effect {
        width: 100%;
        padding: var(--ds-space-2);
        text-align: left;
    }

    .trigger-v2-type-layout {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        background: var(--ds-surface-1);
    }

    .trigger-v2-type-sidebar {
        width: 100%;
        display: flex;
        flex-direction: column;
        border-bottom: 1px solid var(--ds-border-subtle);
    }

    .trigger-v2-type-sidebar-header {
        display: flex;
        align-items: center;
        min-height: 4rem;
        padding: 1rem;
        border-bottom: 1px solid var(--ds-border-subtle);
    }

    .trigger-v2-back-btn {
        padding: var(--ds-space-2);
    }

    .trigger-v2-type-mobile-filter {
        display: block;
        padding: 1rem;
        border-bottom: 1px solid var(--ds-border-subtle);
    }

    .trigger-v2-type-sidebar-footer {
        display: none;
        padding: 1rem;
        border-top: 1px solid var(--ds-border-subtle);
    }

    .trigger-v2-type-main {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
    }

    .trigger-v2-type-main-header {
        display: none;
        align-items: center;
        min-height: 4rem;
        padding: 1rem;
        border-bottom: 1px solid var(--ds-border-subtle);
    }

    .trigger-v2-type-item {
        width: 100%;
        padding: 0.75rem;
        text-align: left;
        transition: color var(--ds-motion-fast) var(--ds-ease-standard),
            background-color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .trigger-v2-field-label {
        display: block;
        color: var(--ds-text-primary);
    }

    .trigger-v2-muted-note {
        color: var(--ds-text-secondary);
        font-size: var(--ds-font-size-xs);
    }

    .trigger-v2-deprecated-note {
        margin-left: var(--ds-space-1);
        opacity: 0.6;
        font-size: var(--ds-font-size-xs);
    }

    .trigger-v2-type-mobile-footer {
        display: block;
        padding: 1rem;
        border-top: 1px solid var(--ds-border-subtle);
    }

    .trigger-v2-edit-panel {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
    }

    .trigger-v2-edit-header {
        display: flex;
        align-items: center;
        gap: var(--ds-space-2);
        margin-bottom: 1rem;
    }

    .trigger-v2-edit-title {
        font-size: 1.25rem;
        line-height: 1.75rem;
    }

    .trigger-v2-toolbar {
        display: flex;
        gap: var(--ds-space-2);
    }

    .trigger-v2-toolbar-action {
        padding: var(--ds-space-2);
    }

    :global(.trigger-v2-close-btn) {
        margin-top: var(--ds-space-2);
    }

    .trigger-v2-selection-active {
        background: var(--ds-surface-active);
    }

    .trigger-v2-selection-hover:hover {
        background: var(--ds-surface-active);
    }

    @media (min-width: 768px) {
        .trigger-v2-panel {
            flex-direction: row;
            overflow-y: visible;
        }

        .trigger-v2-left-column {
            width: 24rem;
            margin-top: 0;
            height: 100%;
        }

        .trigger-v2-editor {
            flex: 1;
            height: auto;
            min-height: 0;
        }

        .trigger-v2-type-layout {
            flex-direction: row;
            overflow-y: visible;
        }

        .trigger-v2-type-sidebar {
            width: 12rem;
            border-right: 1px solid var(--ds-border-subtle);
            border-bottom: 0;
        }

        .trigger-v2-type-mobile-filter {
            display: none;
        }

        .trigger-v2-type-sidebar-footer {
            display: block;
        }

        .trigger-v2-type-main-header {
            display: flex;
        }

        .trigger-v2-type-mobile-footer {
            display: none;
        }
    }
</style>
