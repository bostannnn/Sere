import type {
    ComfyPromptVariables,
    ComfyTemplateMatch,
    ComfyWorkflowMacroArgs,
} from "./types";
import type { ComfyCommanderTemplate } from "src/ts/storage/database.svelte";

export function resolveTemplate(
    templates: ComfyCommanderTemplate[],
    content: string,
): ComfyTemplateMatch | null {
    const rest = content.trim();
    if (!rest) {
        return null;
    }

    const restLower = rest.toLowerCase();
    let best: { template: ComfyCommanderTemplate; trigger: string } | null = null;

    for (const template of templates) {
        const trigger = (template.trigger || "").trim().toLowerCase();
        if (!trigger) {
            continue;
        }
        if (restLower === trigger || restLower.startsWith(`${trigger} `)) {
            if (!best || trigger.length > best.trigger.length) {
                best = { template, trigger };
            }
        }
    }

    if (!best) {
        return null;
    }

    const userPrompt = rest.slice(best.trigger.length).trim();
    return {
        template: best.template,
        userPrompt,
    };
}

export function cleanLLMOutput(raw: unknown): string {
    if (raw === null || raw === undefined) {
        return "";
    }

    let text = String(raw);
    text = text.replace(/<\s*thoughts?\s*>[\s\S]*?<\s*\/\s*thoughts?\s*>/gi, "");
    text = text.replace(/<\s*thinking\s*>[\s\S]*?<\s*\/\s*thinking\s*>/gi, "");
    text = text.trim();
    text = text.replace(/^"(.*)"$/, "$1").trim();
    return text;
}

export function stripImageContent(text: string): string {
    if (!text) {
        return "";
    }
    let next = text;
    next = next.replace(/!\[[^\]]*]\([^)]+\)/g, "");
    next = next.replace(/{{inlay(?:ed|eddata)?::[^}]+}}/g, "");
    next = next.replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g, "");
    return next.trim();
}

export function applyTemplatePrompt(
    templatePrompt: string,
    fallbackUserPrompt: string,
    vars: ComfyPromptVariables,
): string {
    const base = templatePrompt || fallbackUserPrompt;
    return base
        .replaceAll("{{prompt}}", vars.prompt)
        .replaceAll("{{char}}", vars.char)
        .replaceAll("{{user}}", vars.user)
        .replaceAll("{{lastMessage}}", vars.lastMessage)
        .replaceAll("{{lastCharMessage}}", vars.lastCharMessage);
}

function replaceMacroInString(value: string, args: ComfyWorkflowMacroArgs): string {
    return value
        .replaceAll("{{risu_prompt}}", args.positivePrompt)
        .replaceAll("%prompt%", args.positivePrompt)
        .replaceAll("{{risu_neg}}", args.negativePrompt)
        .replaceAll("%negative_prompt%", args.negativePrompt)
        .replaceAll("%seed%", String(args.seed))
        .replaceAll("%char_avatar%", args.charAvatarBase64 || "");
}

export function applyWorkflowMacros(
    workflowJSON: string,
    args: ComfyWorkflowMacroArgs,
): Record<string, unknown> {
    const parsed = JSON.parse(workflowJSON) as Record<string, unknown>;

    for (const [nodeId, rawNode] of Object.entries(parsed)) {
        if (!rawNode || typeof rawNode !== "object") {
            continue;
        }
        const node = rawNode as Record<string, unknown>;
        if (!node.inputs || typeof node.inputs !== "object") {
            continue;
        }

        const inputs = node.inputs as Record<string, unknown>;
        for (const [inputName, inputValue] of Object.entries(inputs)) {
            const originalValue = inputValue;
            if (typeof originalValue === "string") {
                inputs[inputName] = replaceMacroInString(originalValue, args);
            }

            if (inputName === "seed") {
                if (typeof originalValue === "number" || originalValue === "%seed%") {
                    inputs[inputName] = args.seed;
                }
            }
        }

        parsed[nodeId] = {
            ...node,
            inputs,
        };
    }

    return parsed;
}
