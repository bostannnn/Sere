import {
  type Chat,
  type character,
  getDatabase,
  type groupChat,
} from "src/ts/storage/database.svelte";
import { type OpenAIChat } from "../index.svelte";
import { unloadEngine } from "../webllm";
import { memoryProgressStore } from "src/ts/stores.svelte";
import { type ChatTokenizer } from "src/ts/tokenizer";
import {
  type MemoryData,
  type MemoryResult,
  type MemorySettings,
  type SerializableMemoryData,
  type Summary,
  type SummaryChunk,
} from "./memory.types";
import { cleanOrphanedSummary, toMemoryData, toSerializableMemoryData } from "./memory.serialization";
import { getCurrentMemoryPreset, createMemoryPreset } from "./memory.preset";
import { summarize, stripSummaryForPrompt, wrapWithXml } from "./memory.summarizer";
import { childToParentRRF, HypaProcesserEx, simpleCC } from "./memory.similarity";
import { getChatMemoryData, getDbMemoryDebug, setDbMemoryDebug } from "./storage";

export type {
  MemoryPreset,
  MemorySettings,
  MemoryData,
  SerializableMemoryData,
  SerializableSummary,
  SummarizeDebugLog,
  MemoryResult,
} from "./memory.types";
export { createMemoryPreset, getCurrentMemoryPreset, summarize };

const logPrefix = "[Memory]";
const memoryPromptTag = "Past Events Summary";
const minChatsForSimilarity = 3;
const summarySeparator = "\n\n";
const memoryLog = (..._args: unknown[]) => {};

function getSummaryBatchSize(settings: MemorySettings): number {
  const interval = Number(settings.periodicSummarizationInterval);
  if (Number.isFinite(interval) && interval > 0) {
    return Math.max(1, Math.floor(interval));
  }
  return 10;
}

async function runPeriodicSummarization(
  chats: OpenAIChat[],
  room: Chat,
  data: MemoryData,
  settings: MemorySettings
): Promise<{ error?: string }> {
  const db = getDatabase();
  const resolvedModel = settings.summarizationModel === "subModel" ? db.subModel : settings.summarizationModel;
  const setPeriodicDebug = (info: {
    totalChats: number;
    lastIndex: number;
    newMessages: number;
    interval: number;
    toSummarizeCount: number;
    skippedReason?: string;
    chatName?: string;
  }) => {
    if (!getDbMemoryDebug(db)) {
      setDbMemoryDebug(db, {
        timestamp: Date.now(),
        model: resolvedModel,
        prompt: settings.summarizationPrompt,
        input: "",
        formatted: [],
        periodic: info,
      });
      return;
    }
    const debug = getDbMemoryDebug(db);
    if (!debug) return;
    debug.timestamp = Date.now();
    debug.model = resolvedModel;
    debug.prompt = debug.prompt || settings.summarizationPrompt;
    debug.periodic = info;
    setDbMemoryDebug(db, debug);
  };

  const periodicInterval = getSummaryBatchSize(settings);
  if (periodicInterval <= 0) {
    setPeriodicDebug({
      totalChats: chats.length,
      lastIndex: data.lastSummarizedMessageIndex ?? 0,
      newMessages: 0,
      interval: periodicInterval,
      toSummarizeCount: 0,
      skippedReason: "invalid-periodic-interval",
      chatName: room?.name,
    });
    return {};
  }

  const totalChats = chats.length;
  const isSummarizableChat = (chat: OpenAIChat): boolean => {
    if (!chat.memo) return false;
    if (chat.content.trim().length === 0) return false;
    if (
      chat.name === "example_user" ||
      chat.name === "example_assistant" ||
      chat.memo === "NewChatExample" ||
      chat.memo === "NewChat"
    ) {
      return false;
    }
    if (settings.doNotSummarizeUserMessage && chat.role === "user") {
      return false;
    }
    return true;
  };

  let lastIndex = data.lastSummarizedMessageIndex ?? 0;
  // Skip leading non-summarizable scaffold blocks so interval math reflects real chat messages.
  while (lastIndex < totalChats && !isSummarizableChat(chats[lastIndex])) {
    lastIndex += 1;
  }
  if ((data.lastSummarizedMessageIndex ?? 0) !== lastIndex) {
    data.lastSummarizedMessageIndex = lastIndex;
  }

  const newMessages = totalChats - lastIndex;

  if (newMessages < periodicInterval) {
    setPeriodicDebug({
      totalChats,
      lastIndex,
      newMessages,
      interval: periodicInterval,
      toSummarizeCount: 0,
      skippedReason: "interval-not-reached",
      chatName: room?.name,
    });
    return {};
  }

  const sliceStart = Math.max(0, Math.min(lastIndex, chats.length));
  const sliceEnd = Math.max(sliceStart, chats.length);
  const slice = chats.slice(sliceStart, sliceEnd);
  const maxPerSummary = periodicInterval;
  const nextChunk = slice.slice(0, maxPerSummary);
  const nextChunkEndIndex = sliceStart + nextChunk.length;

  const toSummarize = nextChunk.filter(isSummarizableChat);

  setPeriodicDebug({
    totalChats,
    lastIndex,
    newMessages,
    interval: periodicInterval,
    toSummarizeCount: toSummarize.length,
    chatName: room?.name,
  });

  if (toSummarize.length > 0) {
    try {
      const summarizeResult = await summarize(toSummarize);
      data.summaries.push({
        text: summarizeResult,
        chatMemos: new Set(toSummarize.map((chat) => chat.memo).filter(Boolean)),
        isImportant: false,
        categoryId: undefined,
        tags: [],
      });
      data.lastSummarizedMessageIndex = nextChunkEndIndex;
      setPeriodicDebug({
        totalChats,
        lastIndex,
        newMessages,
        interval: periodicInterval,
        toSummarizeCount: toSummarize.length,
        skippedReason: "summarized",
        chatName: room?.name,
      });
    } catch (error) {
      setPeriodicDebug({
        totalChats,
        lastIndex,
        newMessages,
        interval: periodicInterval,
        toSummarizeCount: toSummarize.length,
        skippedReason: `error:${error instanceof Error ? error.message : String(error)}`,
        chatName: room?.name,
      });
      return { error: `${logPrefix} Periodic summarization failed: ${error}` };
    }
  } else if (nextChunkEndIndex > sliceStart) {
    // Skip non-summarizable system/example blocks to prevent retry loops.
    data.lastSummarizedMessageIndex = nextChunkEndIndex;
    setPeriodicDebug({
      totalChats,
      lastIndex,
      newMessages,
      interval: periodicInterval,
      toSummarizeCount: 0,
      skippedReason: "empty-slice",
      chatName: room?.name,
    });
  }
  return {};
}

export async function buildMemoryContext(
  chats: OpenAIChat[],
  currentTokens: number,
  maxContextTokens: number,
  room: Chat,
  char: character | groupChat,
  tokenizer: ChatTokenizer
): Promise<MemoryResult> {
  try {
    return await buildMemoryContextMain(
      chats,
      currentTokens,
      maxContextTokens,
      room,
      char,
      tokenizer
    );
  } catch (error) {
    if (error instanceof Error) {
      // Standard Error instance
      error.message = `${logPrefix} ${error.message}`;
      throw error;
    }

    // Fallback for non-Error object
    let errorMessage: string;

    try {
      errorMessage = JSON.stringify(error);
    } catch {
      errorMessage = String(error);
    }

    throw new Error(`${logPrefix} ${errorMessage}`);
  } finally {
    if (getCurrentMemoryPreset().settings.summarizationModel !== "subModel") {
      try {
        await unloadEngine();
      } catch {}
    }
  }
}

async function buildMemoryContextMain(
  chats: OpenAIChat[],
  currentTokens: number,
  maxContextTokens: number,
  room: Chat,
  char: character | groupChat,
  tokenizer: ChatTokenizer
): Promise<MemoryResult> {
  const db = getDatabase();
  const settings = getCurrentMemoryPreset().settings;

  // Validate settings
  if (settings.recentMemoryRatio + settings.similarMemoryRatio > 1) {
    return {
      currentTokens,
      chats,
      error: `${logPrefix} The sum of Recent Memory Ratio and Similar Memory Ratio is greater than 1.`,
    };
  }

  // Initial token correction
  currentTokens -= db.maxResponse;

  // Load existing memory data if available.
  const existingMemoryData = getChatMemoryData(room);
  const data: MemoryData = existingMemoryData
    ? toMemoryData(existingMemoryData)
    : {
        summaries: [],
      };

  cleanOrphanedSummary(chats, data, room, (...args) => memoryLog(logPrefix, ...args));

  const periodicResult = await runPeriodicSummarization(chats, room, data, settings);
  if (periodicResult.error) {
    return {
      currentTokens,
      chats,
      error: periodicResult.error,
      memory: toSerializableMemoryData(data),
    };
  }

  // Determine starting index
  let startIdx = 0;

  if (data.summaries.length > 0) {
    const lastSummary = data.summaries.at(-1);
    const lastChatIndex = chats.findIndex(
      (chat) => chat.memo === [...lastSummary.chatMemos].at(-1)
    );

    if (lastChatIndex !== -1) {
      startIdx = lastChatIndex + 1;

      // Exclude tokens from summarized chats
      const summarizedChats = chats.slice(0, lastChatIndex + 1);
      for (const chat of summarizedChats) {
        currentTokens -= await tokenizer.tokenizeChat(chat);
      }
    }
  }

  memoryLog(logPrefix, "Starting index:", startIdx);

  // Reserve memory tokens
  const emptyMemoryTokens = await tokenizer.tokenizeChat({
    role: "system",
    content: wrapWithXml(memoryPromptTag, ""),
  });
  const memoryTokens = Math.floor(
    maxContextTokens * settings.memoryTokensRatio
  );
  const shouldReserveEmptyMemoryTokens =
    data.summaries.length === 0 &&
    currentTokens + emptyMemoryTokens <= maxContextTokens;
  let availableMemoryTokens = shouldReserveEmptyMemoryTokens
    ? 0
    : memoryTokens - emptyMemoryTokens;

  if (shouldReserveEmptyMemoryTokens) {
    currentTokens += emptyMemoryTokens;
    memoryLog(logPrefix, "Reserved empty memory tokens:", emptyMemoryTokens);
  } else {
    currentTokens += memoryTokens;
    memoryLog(logPrefix, "Reserved max memory tokens:", memoryTokens);
  }

  // If summarization is needed
  const summarizationMode = currentTokens > maxContextTokens;
  const targetTokens = maxContextTokens;

  while (summarizationMode) {
    if (currentTokens <= targetTokens) {
      break;
    }

    if (chats.length - startIdx <= minChatsForSimilarity) {
      if (currentTokens <= maxContextTokens) {
        break;
      } else {
        return {
          currentTokens,
          chats,
          error: `${logPrefix} Cannot summarize further: input token count (${currentTokens}) exceeds max context size (${maxContextTokens}), but minimum ${minChatsForSimilarity} messages required.`,
          memory: toSerializableMemoryData(data),
        };
      }
    }

    const toSummarize: OpenAIChat[] = [];
    const endIdx = Math.min(
      startIdx + getSummaryBatchSize(settings),
      chats.length - minChatsForSimilarity
    );
    let toSummarizeTokens = 0;

    memoryLog(
      logPrefix,
      "Evaluating summarization batch:",
      "\nCurrent Tokens:",
      currentTokens,
      "\nMax Context Tokens:",
      maxContextTokens,
      "\nStart Index:",
      startIdx,
      "\nEnd Index:",
      endIdx,
      "\nChat Count:",
      endIdx - startIdx,
      "\nBatch Size:",
      getSummaryBatchSize(settings)
    );

    for (let i = startIdx; i < endIdx; i++) {
      const chat = chats[i];
      const chatTokens = await tokenizer.tokenizeChat(chat);

      memoryLog(
        logPrefix,
        "Evaluating chat:",
        "\nIndex:",
        i,
        "\nRole:",
        chat.role,
        "\nContent:",
        "\n" + chat.content,
        "\nTokens:",
        chatTokens
      );

      toSummarizeTokens += chatTokens;

      if (
        chat.name === "example_user" ||
        chat.name === "example_assistant" ||
        chat.memo === "NewChatExample"
      ) {
        memoryLog(logPrefix, `Skipping example chat at index ${i}`);
        continue;
      }

      if (chat.memo === "NewChat") {
        memoryLog(logPrefix, `Skipping new chat at index ${i}`);
        continue;
      }

      if (chat.content.trim().length === 0) {
        memoryLog(logPrefix, `Skipping empty chat at index ${i}`);
        continue;
      }

      if (settings.doNotSummarizeUserMessage && chat.role === "user") {
        memoryLog(logPrefix, `Skipping user role at index ${i}`);
        continue;
      }

      toSummarize.push(chat);
    }

    // Stop summarization if further reduction would go below target tokens (unless we're over max tokens)
    if (
      currentTokens <= maxContextTokens &&
      currentTokens - toSummarizeTokens < targetTokens
    ) {
      memoryLog(
        logPrefix,
        "Stopping summarization:",
        `\ncurrentTokens(${currentTokens}) - toSummarizeTokens(${toSummarizeTokens}) < targetTokens(${targetTokens})`
      );
      break;
    }

    // Attempt summarization
    if (toSummarize.length > 0) {
      memoryLog(
        logPrefix,
        "Attempting summarization:",
        "\nTarget:",
        toSummarize
      );

      try {
        const summarizeResult = await summarize(toSummarize);

        data.summaries.push({
          text: summarizeResult,
          chatMemos: new Set(toSummarize.map((chat) => chat.memo)),
          isImportant: false,
          categoryId: undefined,
          tags: [],
        });
      } catch (error) {
        memoryLog(logPrefix, "Summarization failed:", `\n${error}`);

        return {
          currentTokens,
          chats,
          error: `${logPrefix} Summarization failed: ${error}`,
          memory: toSerializableMemoryData(data),
        };
      }
    }

    currentTokens -= toSummarizeTokens;
    startIdx = endIdx;
  }

  memoryLog(
    logPrefix,
    `${summarizationMode ? "Completed" : "Skipped"} summarization phase:`,
    "\nCurrent Tokens:",
    currentTokens,
    "\nMax Context Tokens:",
    maxContextTokens,
    "\nAvailable Memory Tokens:",
    availableMemoryTokens
  );

  // Early return if no summaries
  if (data.summaries.length === 0) {
    // Generate final memory prompt
    const memory = wrapWithXml(memoryPromptTag, "");

    const newChats: OpenAIChat[] = [
      {
        role: "system",
        content: memory,
        memo: "supaMemory",
      },
      ...chats.slice(startIdx),
    ];

    memoryLog(
      logPrefix,
      "Exiting function:",
      "\nCurrent Tokens:",
      currentTokens,
      "\nAll chats, including memory prompt:",
      newChats,
      "\nMemory Data:",
      data
    );

    return {
      currentTokens,
      chats: newChats,
      memory: toSerializableMemoryData(data),
    };
  }

  const selectedSummaries: Summary[] = [];
  const selectedImportantSummaries: Summary[] = [];

  // Select important summaries
  {
    for (const summary of data.summaries) {
      if (summary.isImportant) {
        const summaryTokens = await tokenizer.tokenizeChat({
          role: "system",
          content: summary.text + summarySeparator,
        });

        if (summaryTokens > availableMemoryTokens) {
          break;
        }

        selectedImportantSummaries.push(summary);

        availableMemoryTokens -= summaryTokens;
      }
    }

    selectedSummaries.push(...selectedImportantSummaries);

    memoryLog(
      logPrefix,
      "After important memory selection:",
      "\nSummary Count:",
      selectedImportantSummaries.length,
      "\nSummaries:",
      selectedImportantSummaries,
      "\nAvailable Memory Tokens:",
      availableMemoryTokens
    );
  }

  // Select recent summaries
  const reservedRecentMemoryTokens = Math.floor(
    availableMemoryTokens * settings.recentMemoryRatio
  );
  let consumedRecentMemoryTokens = 0;
  const selectedRecentSummaries: Summary[] = [];

  if (settings.recentMemoryRatio > 0) {
    // Target only summaries that haven't been selected yet
    const unusedSummaries = data.summaries.filter(
      (e) => !selectedSummaries.includes(e)
    );

    // Add one by one from the end
    for (let i = unusedSummaries.length - 1; i >= 0; i--) {
      const summary = unusedSummaries[i];
      const summaryTokens = await tokenizer.tokenizeChat({
        role: "system",
        content: summary.text + summarySeparator,
      });

      if (
        summaryTokens + consumedRecentMemoryTokens >
        reservedRecentMemoryTokens
      ) {
        break;
      }

      selectedRecentSummaries.push(summary);
      consumedRecentMemoryTokens += summaryTokens;
    }

    selectedSummaries.push(...selectedRecentSummaries);

    memoryLog(
      logPrefix,
      "After recent memory selection:",
      "\nSummary Count:",
      selectedRecentSummaries.length,
      "\nSummaries:",
      selectedRecentSummaries,
      "\nReserved Tokens:",
      reservedRecentMemoryTokens,
      "\nConsumed Tokens:",
      consumedRecentMemoryTokens
    );
  }

  // Select similar summaries
  let reservedSimilarMemoryTokens = Math.floor(
    availableMemoryTokens * settings.similarMemoryRatio
  );
  let consumedSimilarMemoryTokens = 0;
  const selectedSimilarSummaries: Summary[] = [];

  if (settings.similarMemoryRatio > 0) {
    const unusedRecentTokens =
      reservedRecentMemoryTokens - consumedRecentMemoryTokens;

    reservedSimilarMemoryTokens += unusedRecentTokens;
    memoryLog(
      logPrefix,
      "Additional available token space for similar memory:",
      "\nFrom recent:",
      unusedRecentTokens
    );

    // Target only summaries that haven't been selected yet
    const unusedSummaries = data.summaries.filter(
      (e) => !selectedSummaries.includes(e)
    );

    // Dynamically generate summary chunks
    const summaryChunks: SummaryChunk[] = [];

    unusedSummaries.forEach((summary) => {
      const splitted = summary.text
        .split("\n\n")
        .filter((e) => e.trim().length > 0);

      summaryChunks.push(
        ...splitted.map((e) => ({
          text: e.trim(),
          summary,
        }))
      );
    });

    // Initialize embedding processor
    const processor = new HypaProcesserEx(db.hypaModel);
    processor.oaikey = db.supaMemoryKey;

    // Add summaryChunks to processor for similarity search
    try {
      await processor.addSummaryChunks(summaryChunks);
    } catch (error) {
      return {
        currentTokens,
        chats,
        error: `${logPrefix} Similarity search failed: ${error}`,
        memory: toSerializableMemoryData(data),
      };
    }

    const recentChats = chats
      .slice(-minChatsForSimilarity)
      .filter((chat) => chat.content.trim().length > 0);

    if (recentChats.length > 0) {
      const queries = recentChats.map((chat) => chat.content);

      try {
        const scoredLists: [SummaryChunk, number][][] = [];

        for (let i = 0; i < queries.length; i++) {
          const query = queries[i];
          const scoredChunks = await processor.similaritySearchScoredEx(query);

          scoredLists.push(scoredChunks);
        }

        const rankedChunks = simpleCC<SummaryChunk>(
          scoredLists,
          (listIndex, totalLists) => {
            return (listIndex + 1) / ((totalLists * (totalLists + 1)) / 2);
          }
        );

        const rankedSummaries = childToParentRRF<SummaryChunk, Summary>(
          rankedChunks,
          (chunk) => chunk.summary
        );

        while (rankedSummaries.length > 0) {
          const summary = rankedSummaries.shift();
          const summaryTokens = await tokenizer.tokenizeChat({
            role: "system",
            content: summary.text + summarySeparator,
          });

          if (
            summaryTokens + consumedSimilarMemoryTokens >
            reservedSimilarMemoryTokens
          ) {
            memoryLog(
              logPrefix,
              "Stopping similar memory selection:",
              `\nconsumedSimilarMemoryTokens(${consumedSimilarMemoryTokens}) + summaryTokens(${summaryTokens}) > reservedSimilarMemoryTokens(${reservedSimilarMemoryTokens})`
            );
            break;
          }

          selectedSimilarSummaries.push(summary);
          consumedSimilarMemoryTokens += summaryTokens;
        }

        selectedSummaries.push(...selectedSimilarSummaries);
      } catch (error) {
        return {
          currentTokens,
          chats,
          error: `${logPrefix} Similarity search failed: ${error}`,
          memory: toSerializableMemoryData(data),
        };
      }
    }

    memoryLog(
      logPrefix,
      "After similar memory selection:",
      "\nSummary Count:",
      selectedSimilarSummaries.length,
      "\nSummaries:",
      selectedSimilarSummaries,
      "\nReserved Tokens:",
      reservedSimilarMemoryTokens,
      "\nConsumed Tokens:",
      consumedSimilarMemoryTokens
    );
  }

  // Sort selected summaries chronologically (by index)
  selectedSummaries.sort(
    (a, b) => data.summaries.indexOf(a) - data.summaries.indexOf(b)
  );

  // Generate final memory prompt
  const memory = wrapWithXml(
    memoryPromptTag,
    selectedSummaries.map((e) => stripSummaryForPrompt(e.text)).join(summarySeparator)
  );
  const realMemoryTokens = await tokenizer.tokenizeChat({
    role: "system",
    content: memory,
  });

  // Release reserved memory tokens
  if (shouldReserveEmptyMemoryTokens) {
    currentTokens -= emptyMemoryTokens;
  } else {
    currentTokens -= memoryTokens;
  }

  currentTokens += realMemoryTokens;

  memoryLog(
    logPrefix,
    "Final memory selection:",
    "\nSummary Count:",
    selectedSummaries.length,
    "\nSummaries:",
    selectedSummaries,
    "\nReal Memory Tokens:",
    realMemoryTokens,
    "\nAvailable Memory Tokens:",
    availableMemoryTokens
  );

  if (currentTokens > maxContextTokens) {
    throw new Error(
      `Unexpected error: input token count (${currentTokens}) exceeds max context size (${maxContextTokens})`
    );
  }

  // Save last selected summaries
  data.metrics = {
    lastImportantSummaries: selectedImportantSummaries.map((selected) =>
      data.summaries.findIndex((sum) => sum === selected)
    ),
    lastRecentSummaries: selectedRecentSummaries.map((selected) =>
      data.summaries.findIndex((sum) => sum === selected)
    ),
    lastSimilarSummaries: selectedSimilarSummaries.map((selected) =>
      data.summaries.findIndex((sum) => sum === selected)
    ),
    lastRandomSummaries: [],
  };

  const newChats: OpenAIChat[] = [
    {
      role: "system",
      content: memory,
      memo: "supaMemory",
    },
    ...chats.slice(startIdx),
  ];

  memoryLog(
    logPrefix,
    "Exiting function:",
    "\nCurrent Tokens:",
    currentTokens,
    "\nAll chats, including memory prompt:",
    newChats,
    "\nMemory Data:",
    data
  );

  return {
    currentTokens,
    chats: newChats,
    memory: toSerializableMemoryData(data),
  };
}
