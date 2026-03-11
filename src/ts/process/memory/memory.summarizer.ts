import { parseChatML } from "src/ts/parser/chatML";
import {
  getCurrentCharacter,
  getDatabase,
} from "src/ts/storage/database.svelte";
import { inlayTokenRegex } from "src/ts/util/inlayTokens";
import { risuChatParser } from "../../parser.svelte";
import { type OpenAIChat } from "../index.svelte";
import { requestChatData } from "../request/request";
import { chatCompletion } from "../webllm";
import { getCurrentMemoryPreset } from "./memory.preset";
import { getDbMemoryDebug, setDbMemoryDebug } from "./storage";

const summaryHeadingRegex = /^\s*Roleplay Scene Summary\s*\n+/i;
const summaryKeywordsRegex = /\n+\s*Keywords?\s*:\s*.*$/is;

export function wrapWithXml(tag: string, content: string): string {
  return `<${tag}>\n${content}\n</${tag}>`;
}

export function sanitizeSummaryContent(content: string): string {
  return content.replace(inlayTokenRegex, "[Image]");
}

export function stripSummaryForPrompt(content: string): string {
  const withoutHeading = content.replace(summaryHeadingRegex, "");
  return withoutHeading.replace(summaryKeywordsRegex, "").trim();
}

export async function summarize(oaiMessages: OpenAIChat[]): Promise<string> {
  const db = getDatabase();
  const settings = getCurrentMemoryPreset().settings;
  const previousPeriodic = getDbMemoryDebug(db)?.periodic;

  const strMessages = oaiMessages
    .map((chat) => `${chat.role}: ${sanitizeSummaryContent(chat.content)}`)
    .join("\n");

  const summarizationPrompt = settings.summarizationPrompt.trim() === ""
    ? "[Summarize the ongoing role story, It must also remove redundancy and unnecessary text and content from the output.]"
    : settings.summarizationPrompt;
  const parsedSummarizationPrompt = risuChatParser(summarizationPrompt, {
    chara: getCurrentCharacter(),
  });

  const formated: OpenAIChat[] = parseChatML(
    parsedSummarizationPrompt.replaceAll("{{slot}}", strMessages)
  ) ?? [
    {
      role: "user",
      content: strMessages,
    },
    {
      role: "system",
      content: parsedSummarizationPrompt,
    },
  ];

  const resolvedModel = settings.summarizationModel === "subModel"
    ? db.subModel
    : settings.summarizationModel;
  setDbMemoryDebug(db, {
    timestamp: Date.now(),
    model: resolvedModel,
    prompt: parsedSummarizationPrompt,
    input: strMessages,
    formatted: formated.map((item) => ({ role: item.role, content: item.content })),
    periodic: previousPeriodic,
  });

  if (settings.summarizationModel === "subModel") {
    const response = await requestChatData(
      {
        formated,
        bias: {},
        useStreaming: false,
        noMultiGen: true,
      },
      "memory"
    );

    if (response.type === "streaming" || response.type === "multiline") {
      throw new Error("Unexpected response type");
    }

    if (response.type === "fail") {
      throw new Error(response.result);
    }

    if (!response.result || response.result.trim().length === 0) {
      throw new Error("Empty summary returned");
    }

    const debug = getDbMemoryDebug(db);
    if (debug) {
      debug.rawResponse = response.result;
      setDbMemoryDebug(db, debug);
    }
    return response.result.replace(/<Thoughts>[\s\S]*?<\/Thoughts>/g, "").trim();
  }

  const content = await chatCompletion(formated, settings.summarizationModel, {
    max_tokens: 8192,
    temperature: 0,
  });

  if (!content || content.trim().length === 0) {
    throw new Error("Empty summary returned");
  }

  const debug = getDbMemoryDebug(db);
  if (debug) {
    debug.rawResponse = content;
    setDbMemoryDebug(db, debug);
  }
  return content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}
