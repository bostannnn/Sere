import { SlashCommandParser } from '/scripts/slash-commands/SlashCommandParser.js';
import { SlashCommand } from '/scripts/slash-commands/SlashCommand.js';
import { SlashCommandArgument, ARGUMENT_TYPE } from '/scripts/slash-commands/SlashCommandArgument.js';
import { extension_settings, renderExtensionTemplateAsync, getContext } from '/scripts/extensions.js';
import { saveSettingsDebounced, generateQuietPrompt, generateRaw } from '/script.js';

const MODULE_NAME = 'comfy-commander';

// Default settings
const DEFAULT_SETTINGS = {
    templates: [] // { trigger: string, workflow: string, prompt: string }
};

async function init() {
    console.log('[Comfy Commander] Initializing...');

    // Initialize settings
    if (!extension_settings[MODULE_NAME]) {
        extension_settings[MODULE_NAME] = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    }

    // Render settings UI
    try {
        console.log('[Comfy Commander] Rendering settings...');
        const html = await renderExtensionTemplateAsync(MODULE_NAME, 'settings', {});
        $('#extensions_settings').append(html);
        console.log('[Comfy Commander] Settings HTML appended.');
        renderTemplates();
        bindUiEvents();
        console.log('[Comfy Commander] UI events bound.');
    } catch (e) {
        console.error('[Comfy Commander] Failed to render settings:', e);
        toastr.error('Comfy Commander UI failed to load: ' + e.message);
    }

    // Register /cw command
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'comfy-workflow',
        aliases: ['cw', 'comfy'],
        helpString: 'Switch to a ComfyUI workflow and generate an image. Supports custom templates. Usage: /cw [trigger/workflow] [prompt]',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Trigger Word or Workflow Name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true
            }),
            SlashCommandArgument.fromProps({
                description: 'Prompt',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                defaultValue: ''
            })
        ],
        callback: async (args, triggerOrWorkflow, prompt) => {
            await handleCommand(triggerOrWorkflow, prompt);
        }
    }));
    
    console.log('[Comfy Commander] /cw command registered.');
}

function bindUiEvents() {
    $('#comfy_template_add').on('click', () => {
        addTemplateItem({ trigger: '', workflow: '', prompt: '' });
        saveTemplates();
    });

    $('#comfy_view_macros').on('click', () => {
        SlashCommandParser.commands['help'].callback({}, 'macros');
    });
}

function getComfyWorkflows() {
    const options = $('#sd_comfy_workflow option');
    if (options.length > 0) {
        return $.map(options, function(option) {
            return option.value;
        }).filter(v => v);
    }
    return [];
}

function renderTemplates() {
    $('#comfy_template_list').empty();
    if (Array.isArray(extension_settings[MODULE_NAME].templates)) {
        extension_settings[MODULE_NAME].templates.forEach(t => addTemplateItem(t));
    }
}

function addTemplateItem(data) {
    const template = document.getElementById('comfy_template_item_template');
    if (!template) return;
    
    const clone = template.content.cloneNode(true);
    const item = $(clone).find('.comfy_template_item');

    // Populate Workflows dropdown
    const workflowSelect = item.find('.comfy_template_workflow');
    const workflows = getComfyWorkflows();
    
    workflowSelect.append(new Option('Use Current / Default', ''));
    workflows.forEach(wf => {
        workflowSelect.append(new Option(wf, wf));
    });

    // Set values
    const triggerInput = item.find('.comfy_template_trigger');
    triggerInput.val(data.trigger);
    workflowSelect.val(data.workflow);
    item.find('.comfy_template_prompt').val(data.prompt);
    // Default to FALSE (Include Chat History) if undefined
    item.find('.comfy_template_use_context').prop('checked', !!data.useContext);
    
    // Update header title
    const updateTitle = () => {
        const val = triggerInput.val();
        item.find('.comfy_template_title').text(val || 'New Template');
    };
    updateTitle();

    // Bind events
    item.find('input, select, textarea').on('change input', () => {
        updateTitle();
        saveTemplates();
    });
    
    item.find('.comfy_template_delete').on('click', function(e) {
        e.stopPropagation(); // Prevent toggle
        if (confirm('Delete this template?')) {
            $(this).closest('.comfy_template_item').remove();
            saveTemplates();
        }
    });

    item.find('.comfy_commander_help_icon').on('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        toastr.info(
            '<b>Context vs Raw Mode</b><br><br>' + 
            '<b>CHECKED (Context Mode):</b> Uses the SillyTavern Prompt Builder. It assembles a full prompt including Chat History, World Info, Author\'s Note, and Persona. This ensures the image matches the current story state.<br>' +
            '⚠️ <i>Warning: Uses significantly more tokens (can exceed 7000+).</i><br><br>' + 
            '<b>UNCHECKED (Raw Mode):</b> Uses the Macro Engine only. It sends your template and simple macros (like {{char}} or {{lastMessage}}) directly. This is faster and prevents character personality from interfering with tagging.',
            '', 
            { timeOut: 15000, escapeHtml: false }
        );
    });

    // Toggle Logic
    item.find('.comfy_template_header').on('click', function() {
        const content = item.find('.comfy_template_content');
        const icon = item.find('.comfy_template_toggle_icon');
        content.slideToggle(200);
        icon.toggleClass('fa-caret-down fa-caret-right');
    });

    $('#comfy_template_list').append(item);
}

function saveTemplates() {
    const templates = [];
    $('#comfy_template_list .comfy_template_item').each(function() {
        const trigger = $(this).find('.comfy_template_trigger').val();
        const workflow = $(this).find('.comfy_template_workflow').val();
        const prompt = $(this).find('.comfy_template_prompt').val();
        const useContext = $(this).find('.comfy_template_use_context').is(':checked');
        
        if (trigger) {
            templates.push({ trigger, workflow, prompt, useContext });
        }
    });
    
    console.log('[Comfy Commander] Saving templates:', templates);
    extension_settings[MODULE_NAME].templates = templates;
    saveSettingsDebounced();
}

async function handleCommand(triggerOrWorkflow, prompt) {
    console.log('[Comfy Commander v2.0 - RAW MODE] Triggered with:', triggerOrWorkflow, prompt);
    console.log('[Comfy Commander] Loaded settings:', extension_settings[MODULE_NAME]);
    const currentTemplates = extension_settings[MODULE_NAME]?.templates || [];
    console.log('[Comfy Commander] Available templates:', currentTemplates.map(t => t.trigger));

    if (!extension_settings.sd) {
        toastr.error('Stable Diffusion extension not loaded.');
        return;
    }

    // 1. Switch Source to ComfyUI
    if (extension_settings.sd.source !== 'comfy') {
        console.log('[Comfy Commander] Switching source to comfy');
        extension_settings.sd.source = 'comfy';
        $('#sd_source').val('comfy').trigger('change');
        saveSettingsDebounced();
        
        toastr.info('Switching to ComfyUI... One moment.');
        await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // 2. Check for Custom Template
    const templates = extension_settings[MODULE_NAME].templates || [];
    
    // Sort templates by length (descending) to match longest triggers first
    // This prevents "elf" from matching "elf warrior" prematurely
    const sortedTemplates = [...templates].sort((a, b) => b.trigger.length - a.trigger.length);

    let matchedTemplate = null;
    let derivedPrompt = prompt || '';

    // Reconstruct full input to handle loose parser behavior
    let fullInput = triggerOrWorkflow || '';
    if (prompt) fullInput += ' ' + prompt;
    fullInput = fullInput.trim();
    const fullInputLower = fullInput.toLowerCase();

    for (const t of sortedTemplates) {
        const trigger = t.trigger.toLowerCase();
        // Check if input starts with the trigger word
        if (fullInputLower.startsWith(trigger)) {
            // Ensure strict word boundary (match "outfit" but not "outfitted")
            const nextChar = fullInput.charAt(trigger.length);
            if (!nextChar || /\s/.test(nextChar)) {
                matchedTemplate = t;
                // Extract the rest of the string as the prompt
                derivedPrompt = fullInput.slice(trigger.length).trim();
                break;
            }
        }
    }

    if (matchedTemplate) {
        console.log('[Comfy Commander] Found custom template:', matchedTemplate.trigger);
        console.log('[Comfy Commander] Derived prompt:', derivedPrompt);
        await executeTemplate(matchedTemplate, derivedPrompt);
    } else {
        // Fallback to "Argument 1 is Workflow" logic
        await executeDirectWorkflow(triggerOrWorkflow, prompt);
    }
}

async function executeTemplate(template, userPrompt) {
    // 1. Resolve Workflow
    let targetWorkflow = template.workflow;
    if (!targetWorkflow) {
        // Use current if template doesn't specify
        targetWorkflow = extension_settings.sd.comfy_workflow;
    }
    
    // Switch workflow
    if (targetWorkflow) {
        // Ensure .json
        if (!targetWorkflow.toLowerCase().endsWith('.json')) {
            targetWorkflow += '.json';
        }
        
        // Validate against dropdown (fuzzy check)
        const availableWorkflows = getComfyWorkflows();
        const normalizedSearch = targetWorkflow.toLowerCase().replace(/\s+/g, '');
        const foundWorkflow = availableWorkflows.find(wf => wf === targetWorkflow) ||
                              availableWorkflows.find(wf => wf.toLowerCase() === targetWorkflow.toLowerCase()) ||
                              availableWorkflows.find(wf => wf.toLowerCase().replace(/\s+/g, '') === normalizedSearch);

        if (foundWorkflow) {
            extension_settings.sd.comfy_workflow = foundWorkflow;
            $('#sd_comfy_workflow').val(foundWorkflow).trigger('change');
            saveSettingsDebounced();
        } else {
            console.warn(`[Comfy Commander] Template workflow "${targetWorkflow}" not found in dropdown. Forcing value.`);
            // Force the value even if it's not in the dropdown (it might exist on server)
            extension_settings.sd.comfy_workflow = targetWorkflow;
            
            // Try adding it to dropdown if missing, so it displays correctly
            if ($('#sd_comfy_workflow option[value="' + targetWorkflow + '"]').length === 0) {
                 $('#sd_comfy_workflow').append(new Option(targetWorkflow, targetWorkflow));
            }
            $('#sd_comfy_workflow').val(targetWorkflow).trigger('change');
            saveSettingsDebounced();
        }
    }

    // 2. Generate Prompt using LLM (if template has a prompt instruction)
    let finalPrompt = userPrompt || '';
    
    if (template.prompt) {
        toastr.info('Generating prompt description...');
        
        console.log('[Comfy Commander] Template raw prompt:', template.prompt);

        // Inject user prompt into template
        let systemPrompt = template.prompt.replace('{{prompt}}', userPrompt || '');
        // Replace {{char}}, {{user}}, etc. using context
        systemPrompt = replaceMacros(systemPrompt);
        
        console.log('[Comfy Commander] Final system prompt sending to LLM:', systemPrompt);

        try {
            let llmResponse;
            
            // Check explicit false, otherwise default to true (Context Enabled)
            if (template.useContext === false) {
                console.log('[Comfy Commander] Using RAW generation (No context)');
                llmResponse = await generateRaw({ 
                    prompt: systemPrompt,
                    stop: ['\n', '[End', 'This response'] // Aggressive stops for raw tagging
                });
            } else {
                console.log('[Comfy Commander] Using Standard generation (With Chat Context)');
                llmResponse = await generateQuietPrompt({ quietPrompt: systemPrompt });
            }

            if (llmResponse) {
                finalPrompt = llmResponse.trim();
                // Strip quotes if LLM wrapped it
                if (finalPrompt.startsWith('"') && finalPrompt.endsWith('"')) {
                    finalPrompt = finalPrompt.slice(1, -1);
                }
                console.log('[Comfy Commander] LLM generated prompt:', finalPrompt);
            } else {
                toastr.warning('LLM produced empty prompt. Using raw input.');
            }
        } catch (e) {
            console.error('[Comfy Commander] LLM generation failed:', e);
            toastr.error('Prompt generation failed: ' + e.message);
            // Fallback to raw prompt? Or abort? 
            // Let's fallback to raw user input if LLM fails
        }
    }

    // 3. Trigger Generation
    triggerImagine(finalPrompt);
}

async function executeDirectWorkflow(workflowName, prompt) {
    // Combine inputs if prompt is undefined/empty (legacy fuzzy split logic)
    // But since we want to be clean, let's trust the SlashCommandParser splits mostly.
    // However, if the user typed `/cw zimageturbo coffee`, args might be `zimageturbo` and `coffee`.
    
    // NOTE: If the user types `/cw template prompt`, `triggerOrWorkflow` is "template".
    // If we are here, no template matched. So we assume it IS a workflow.

    // Manual merge check if prompt is empty but workflow has spaces?
    // Let's stick to the robust logic we built before.
    let inputString = workflowName;
    if (prompt) inputString += ' ' + prompt;
    
    const parts = inputString.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    if (parts.length === 0) return;

    const rawWorkflow = parts[0].replace(/^["']|["']$/g, '');
    let finalPrompt = parts.slice(1).join(' ');
    if (finalPrompt.length > 1 && finalPrompt.startsWith('"') && finalPrompt.endsWith('"')) {
         finalPrompt = finalPrompt.slice(1, -1);
    }

    // Resolve Workflow
    let targetWorkflow = rawWorkflow;
    if (!targetWorkflow.toLowerCase().endsWith('.json')) {
        targetWorkflow += '.json';
    }

    const availableWorkflows = getComfyWorkflows();
    const normalizedSearch = targetWorkflow.toLowerCase().replace(/\s+/g, '');
    
    const foundWorkflow = availableWorkflows.find(wf => wf === targetWorkflow) ||
                       availableWorkflows.find(wf => wf.toLowerCase() === targetWorkflow.toLowerCase()) ||
                       availableWorkflows.find(wf => wf.toLowerCase().replace(/\s+/g, '') === normalizedSearch);

    if (foundWorkflow) {
        extension_settings.sd.comfy_workflow = foundWorkflow;
        $('#sd_comfy_workflow').val(foundWorkflow).trigger('change');
        saveSettingsDebounced();
    } else {
        toastr.warning(`Workflow "${rawWorkflow}" not found. Using as-is.`);
        extension_settings.sd.comfy_workflow = targetWorkflow;
        $('#sd_comfy_workflow').val(targetWorkflow).trigger('change');
        saveSettingsDebounced();
    }

    triggerImagine(finalPrompt);
}

function triggerImagine(prompt) {
    const imagineCommand = SlashCommandParser.commands['imagine'];
    if (imagineCommand) {
        // Save current generation mode and free_extend setting
        const originalMode = extension_settings.sd.generate_mode;
        const originalFreeExtend = extension_settings.sd.free_extend;
        
        // Force settings to avoid ST re-prompting
        console.log('[Comfy Commander] Bypassing ST prompt generation. Disabling free_extend.');
        extension_settings.sd.generate_mode = 0; // FREE mode
        extension_settings.sd.free_extend = false; // Disable auto-extend

        toastr.info(`Generating image...`);
        
        setTimeout(() => {
            imagineCommand.callback({}, prompt || '');
            
            // Restore original settings
            setTimeout(() => {
                extension_settings.sd.generate_mode = originalMode;
                extension_settings.sd.free_extend = originalFreeExtend;
                console.log('[Comfy Commander] Restored original ST settings.');
            }, 2000);
        }, 500);
    } else {
        toastr.error('Could not find /imagine command.');
    }
}

function replaceMacros(str) {
    const context = getContext();
    const charId = context.characterId;
    const char = context.characters[charId];
    
    if (char) {
        str = str.replaceAll('{{char}}', char.name);
        str = str.replaceAll('{{user}}', context.name1 || 'User'); // name1 is usually User's name
    }
    return str;
}

init();
