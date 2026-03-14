/* eslint-disable @typescript-eslint/no-explicit-any */
import { v4 as uuidv4 } from "uuid";
import type { LorebookEntry } from "@risuai/ccardlib";
import type {
  character,
  customscript,
  loreBook,
  loreSettings,
  triggerscript,
} from "./storage/database.svelte";
import { checkNullish } from "./util";

export type CharacterBook = {
  name?: string;
  description?: string;
  scan_depth?: number;
  token_budget?: number;
  recursive_scanning?: boolean;
  extensions: Record<string, any>;
  entries: Array<charBookEntry>;
};

interface charBookEntry {
  keys: Array<string>;
  content: string;
  extensions: Record<string, any>;
  enabled: boolean;
  insertion_order: number;
  name?: string;
  priority?: number;
  id?: number;
  comment?: string;
  selective?: boolean;
  secondary_keys?: Array<string>;
  constant?: boolean;
  position?: "before_char" | "after_char";
  case_sensitive?: boolean;
  use_regex?: boolean;
  mode?: string;
  folder?: string;
}

export type CharacterCardV2Risu = {
  spec: "chara_card_v2";
  spec_version: "2.0";
  data: {
    name: string;
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
    creator_notes: string;
    system_prompt: string;
    post_history_instructions: string;
    alternate_greetings: string[];
    character_book?: CharacterBook;
    tags: string[];
    creator: string;
    character_version: string;
    extensions: {
      risuai?: {
        emotions?: [string, string][];
        bias?: [string, number][];
        viewScreen?: any;
        customScripts?: customscript[];
        utilityBot?: boolean;
        additionalAssets?: [string, string, string][];
        backgroundHTML?: string;
        license?: string;
        triggerscript?: triggerscript[];
        private?: boolean;
        additionalText?: string;
        randomAltFirstMessageOnNewChat?: boolean;
        memoryEnabled?: boolean;
        memoryPromptOverride?: {
          summarizationPrompt?: string;
        };
        virtualscript?: string;
        largePortrait?: boolean;
        lorePlus?: boolean;
        inlayViewScreen?: boolean;
        newGenData?: {
          prompt: string;
          negative: string;
          instructions: string;
          emotionInstructions: string;
        };
        vits?: { [key: string]: string };
      };
      depth_prompt?: { depth: number; prompt: string };
    };
  };
};

export interface OldTavernChar {
  avatar: "none";
  chat: string;
  create_date: string;
  description: string;
  first_mes: string;
  mes_example: string;
  name: string;
  personality: string;
  scenario: string;
  talkativeness: "0.5";
  spec_version?: "1.0";
}

export function convertOffSpecCards(charaData: OldTavernChar | CharacterCardV2Risu, imgp: string | undefined = undefined): character {
  const data = charaData.spec_version === "2.0" ? charaData.data : charaData;
  const charbook = charaData.spec_version === "2.0" ? charaData.data.character_book : null;
  let lorebook: loreBook[] = [];
  let loresettings: undefined | loreSettings = undefined;
  let loreExt: undefined | any = undefined;

  if (charbook) {
    const converted = convertCharbook({
      lorebook,
      charbook,
      loresettings,
      loreExt,
    });
    lorebook = converted.lorebook;
    loresettings = converted.loresettings;
    loreExt = converted.loreExt;
  }

  return {
    name: data.name ?? "unknown name",
    firstMessage: data.first_mes ?? "unknown first message",
    desc: data.description ?? "",
    notes: "",
    chats: [{
      message: [],
      note: "",
      name: "Chat 1",
      localLore: [],
    }],
    chatPage: 0,
    image: imgp,
    emotionImages: [],
    bias: [],
    globalLore: lorebook,
    viewScreen: "none",
    chaId: uuidv4(),
    utilityBot: false,
    customscript: [],
    exampleMessage: data.mes_example,
    creatorNotes: "",
    systemPrompt: (charaData.spec_version === "2.0" ? charaData.data.system_prompt : "") ?? "",
    postHistoryInstructions: (charaData.spec_version === "2.0" ? charaData.data.post_history_instructions : "") ?? "",
    alternateGreetings: [],
    tags: [],
    creator: "",
    characterVersion: "",
    personality: data.personality ?? "",
    scenario: data.scenario ?? "",
    firstMsgIndex: -1,
    randomAltFirstMessageOnNewChat: false,
    replaceGlobalNote: "",
    triggerscript: [],
    additionalText: "",
    loreExt,
    loreSettings: loresettings,
    chatFolders: [],
    memoryPromptOverride: {
      summarizationPrompt: "",
    },
  };
}

export function convertCharbook(arg: {
  lorebook: loreBook[];
  charbook: CharacterBook;
  loresettings: loreSettings | undefined;
  loreExt: any;
}) {
  const { lorebook, charbook } = arg;
  let { loresettings, loreExt } = arg;

  if (
    (!checkNullish(charbook.recursive_scanning))
    && (!checkNullish(charbook.scan_depth))
    && (!checkNullish(charbook.token_budget))
  ) {
    loresettings = {
      tokenBudget: charbook.token_budget,
      scanDepth: charbook.scan_depth,
      recursiveScanning: charbook.recursive_scanning,
      fullWordMatching: charbook?.extensions?.risu_fullWordMatching ?? false,
    };
  }

  loreExt = charbook.extensions;

  for (const book of charbook.entries) {
    let content = book.content;

    if (book.use_regex && !book.keys?.[0]?.startsWith("/")) {
      book.use_regex = false;
    }

    const extensions = book.extensions ?? {};

    if (extensions.useProbability && extensions.probability !== undefined && extensions.probability !== 100) {
      content = `@@probability ${extensions.probability}\n${content}`;
      delete extensions.useProbability;
      delete extensions.probability;
    }
    if (extensions.position === 4 && typeof extensions.depth === "number" && typeof extensions.role === "number") {
      content = `@@depth ${extensions.depth}\n@@role ${["system", "user", "assistant"][extensions.role]}\n${content}`;
      delete extensions.position;
      delete extensions.depth;
      delete extensions.role;
    }
    if (typeof extensions.selectiveLogic === "number" && book.secondary_keys && book.secondary_keys.length > 0) {
      switch (extensions.selectiveLogic) {
        case 1:
          book.selective = false;
          content = `@@exclude_keys_all ${book.secondary_keys.join(",")}\n${content}`;
          break;
        case 2:
          book.selective = false;
          for (const secKey of book.secondary_keys) {
            content = `@@exclude_keys ${secKey}\n${content}`;
          }
          break;
        case 3:
          book.selective = false;
          for (const secKey of book.secondary_keys) {
            content = `@@additional_keys ${secKey}\n${content}`;
          }
          break;
        default:
          if (!book.secondary_keys || book.secondary_keys.length === 0) {
            book.selective = false;
          }
      }
    }
    if (typeof extensions.delay === "number" && extensions.delay > 0) {
      content = `@@activate_only_after ${extensions.delay}\n${content}`;
      delete extensions.delay;
    }
    if (extensions.match_whole_words === true) {
      content = `@@match_full_word\n${content}`;
      delete extensions.match_whole_words;
    }
    if (extensions.match_whole_words === false) {
      content = `@@match_partial_word\n${content}`;
      delete extensions.match_whole_words;
    }

    lorebook.push({
      key: book.keys.join(", "),
      secondkey: book.secondary_keys?.join(", ") ?? "",
      insertorder: book.insertion_order,
      comment: book.name ?? book.comment ?? "",
      content,
      mode: (book.mode as any) ?? "normal",
      alwaysActive: book.constant ?? false,
      selective: book.selective ?? false,
      extentions: { ...extensions, risu_case_sensitive: book.case_sensitive },
      activationPercent: book.extensions?.risu_activationPercent,
      loreCache: book.extensions?.risu_loreCache ?? null,
      useRegex: book.use_regex ?? false,
      folder: book.folder,
    });
  }

  return {
    lorebook,
    loresettings,
    loreExt,
  };
}

type RisuLorebookEntry = LorebookEntry & {
  mode?: string;
  folder?: string;
};

export type { RisuLorebookEntry };
