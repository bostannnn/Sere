import type { botPreset } from "../../storage/database.svelte";
import type { NAISettings } from "../models/nai";


export const prebuiltPresets = {
  "NAI": {
    "name": "Carefree",
    "apiType": "gemini-3-flash-preview",
    "openAIKey": "",
    "temperature": 135,
    "maxContext": 4000,
    "maxResponse": 500,
    "frequencyPenalty": 70,
    "PresensePenalty": 0,
    "aiModel": "novelai_kayra",
    "subModel": "novelai_kayra",
    "forceReplaceUrl": "",
    "forceReplaceUrl2": "",
    "bias": [],
    "koboldURL": "",
    "proxyKey": "",
    "proxyRequestModel": "",
    "openrouterRequestModel": "openai/gpt-3.5-turbo",
    "openrouterSubRequestModel": "openai/gpt-3.5-turbo",
    "NAISettings": {
      "topK": 15,
      "topP": 0.85,
      "topA": 0.1,
      "tailFreeSampling": 0.915,
      "repetitionPenalty": 2.8,
      "repetitionPenaltyRange": 2048,
      "repetitionPenaltySlope": 0.02,
      "repostitionPenaltyPresence": 0,
      "seperator": "",
      "frequencyPenalty": 0.02,
      "presencePenalty": 0,
      "typicalp": 1,
      "starter": "",
      "cfg_scale": 1,
      "mirostat_tau": 0,
      "mirostat_lr": 1
    },
    "promptTemplate": [
      {
        "type": "chat",
        "rangeStart": 0,
        "rangeEnd": -6
      },
      {
        "type": "plain",
        "text": "",
        "role": "system",
        "type2": "main"
      },
      {
        "type": "chat",
        "rangeStart": -6,
        "rangeEnd": -4
      },
      {
        "type": "persona",
        "innerFormat": "----\n{{slot}}"
      },
      {
        "type": "lorebook"
      },
      {
        "type": "description",
        "innerFormat": "----\n{{slot}}"
      },
      {
        "type": "plain",
        "text": "",
        "role": "system",
        "type2": "globalNote"
      },
      {
        "type": "plain",
        "text": "***",
        "role": "system",
        "type2": "normal"
      },
      {
        "type": "authornote",
        "innerFormat": "",
        "defaultText": "[ Style: chat, roleplay, prose; Tags: high impact sexual violence ]"
      },
      {
        "type": "chat",
        "rangeStart": -4,
        "rangeEnd": "end"
      }
    ],
  } satisfies botPreset,
  "OAI2": { //작가 프롬프트 by 하나안, modified by Kwaroran
    "name": "Default Prompt",
    "apiType": "gemini-3-flash-preview",
    "openAIKey": "",
    "temperature": 100,
    "maxContext": 16000,
    "maxResponse": 1000,
    "frequencyPenalty": 0,
    "PresensePenalty": 0,
    "aiModel": "claude-3-5-sonnet-20240620",
    "subModel": "gemini-3-flash-preview",
    "forceReplaceUrl": "",
    "forceReplaceUrl2": "",
    "bias": [],
    "koboldURL": "http://localho.st:5001/api/v1",
    "proxyKey": "",
    "proxyRequestModel": "claude-3-5-sonnet-20240620",
    "openrouterRequestModel": "anthropic/claude-2",
    "openrouterSubRequestModel": "anthropic/claude-2",
    "NAISettings": {
      "topK": 12,
      "topP": 0.85,
      "topA": 0.1,
      "tailFreeSampling": 0.915,
      "repetitionPenalty": 2.8,
      "repetitionPenaltyRange": 2048,
      "repetitionPenaltySlope": 0.02,
      "repostitionPenaltyPresence": 0,
      "seperator": "",
      "frequencyPenalty": 0.03,
      "presencePenalty": 0,
      "typicalp": 1,
      "starter": "",
      "cfg_scale": 1,
      "mirostat_tau": 0,
      "mirostat_lr": 1
    },
    "promptTemplate": [
      {
        "type": "plain",
        "text": "You are {{char}}, a fictional character in a collaborative, text-based roleplay with {{user}}. Your role is to portray {{char}} authentically — their voice, flaws, desires, and worldview — while narrating the world around them.\n\nWrite in third-person limited perspective. Focus on {{char}}'s actions, speech, sensory experience, and observable behavior. Never speak, think, or act for {{user}}. Treat them as an equal participant in the story.\n\nThis is a creative fiction space. Portray characters honestly, including their darkness, contradictions, and complexity. Prefer grounded, immersive storytelling over melodrama.",
        "role": "system",
        "type2": "main"
      },
      {
        "type": "description",
        "innerFormat": "[Roleplay Setting]\n{{slot}}\n"
      },
      {
        "type": "persona",
        "innerFormat": "[{{user}} Character Profile]\n{{slot}}\n"
      },
      {
        "type": "plain",
        "text": "[Supplementary Information]\n",
        "role": "system",
        "type2": "normal"
      },
      {
        "type": "lorebook",
      },
      {
        "type": "characterState",
        "innerFormat": "The following state was extracted from previous chats.\nTreat it as persistent background memory about the relationship, {{user}}, and recurring dynamics.\nUse it as context unless the current chat clearly contradicts it.\nYou can quote it directly.\n\n{{slot}}\n"
      },
      {
        "type": "plain",
        "text": "### NARRATIVE DEFAULTS\n- **Perspective:** Third-person limited, centered on {{char}}\n- **Tone:** Match the scene — don't default to either clinical or overwrought\n- **Pacing:** Let scenes breathe; don't rush emotional beats\n\n### SPEECH & VOICE\n- Write {{char}}'s dialogue in their established voice\n- Use subtext — what characters don't say matters as much as what they do\n- Avoid exposition dumps in dialogue\n\n### AGENCY RULES\n- Never generate {{user}}'s actions, thoughts, or dialogue\n- {{char}} reacts to what {{user}} does, not what you assume they'll do\n- NPCs may have varied, even negative opinions of {{user}}\n\n### WRITING QUALITY\n- Show internal states through physical cues and behavior, not narration\n- Engage at least 2-3 senses per scene\n- Vary sentence rhythm — mix short punchy lines with longer atmospheric ones\n- End responses on {{char}} action or dialogue, not a summary\n\n### FORBIDDEN\n- No fourth-wall breaks or meta-commentary\n- No unsolicited plot resolution\n- No softening characters to be more likeable or palatable",
        "role": "system",
        "type2": "globalNote"
      },
      {
        "type": "authornote",
      },
      {
        "type": "memory",
        "innerFormat": "[Roleplay Summary]\n{{slot}}\n"
      },
      {
        "type": "rulebookRag"
      },
      {
        "type": "chat",
        "rangeStart": 0,
        "rangeEnd": -2,
        "chatAsOriginalOnSystem": true
      },
      {
        "type": "chat",
        "rangeStart": -2,
        "rangeEnd": "end"
      },
      {
        "type": "postEverything",
      },
    ],
    "NAIadventure": false,
    "NAIappendName": true,
    "autoSuggestPrompt": "",
    "customProxyRequestModel": "claude-3-5-sonnet-20240620",
    "reverseProxyOobaArgs": {
      "mode": "instruct"
    },
    "top_p": 1,
    "promptSettings": {
      "assistantPrefill": "",
      "postEndInnerFormat": "",
      "sendChatAsSystem": false,
      "sendName": false,
      "utilOverride": false,
      "maxThoughtTagDepth": -1,
      "customChainOfThought": false
    },
    "repetition_penalty": 1,
    "min_p": 0,
    "top_a": 0,
    "openrouterProvider": {
        "order": [],
        "only": [],
        "ignore": []
    },
    "useInstructPrompt": false,
    "customPromptTemplateToggle": "",
    "templateDefaultVariables": ""
  } satisfies botPreset,
} as const

export const prebuiltNAIpresets: NAISettings = {
  topK: 12,
  topP: 0.85,
  topA: 0.1,
  tailFreeSampling: 0.915,
  repetitionPenalty: 2.8,
  repetitionPenaltyRange: 2048,
  repetitionPenaltySlope: 0.02,
  repostitionPenaltyPresence: 0,
  seperator: "",
  frequencyPenalty: 0.03,
  presencePenalty: 0,
  typicalp: 1,
  starter: ""
}
