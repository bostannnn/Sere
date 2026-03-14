import type { CharacterCardV3, LorebookEntry } from "@risuai/ccardlib";
import type { character } from "./storage/database.svelte";
import { getCharacterMemoryPromptOverride } from "./process/memory/storage";
import type { CardExportSelection } from "./cardExportOptions";
import { buildCharacterExportBundle } from "./cardBundleExport";

type RisuLorebookEntry = LorebookEntry & {
  mode?: string;
  folder?: string;
};

export function createBaseV3(char: character, selection?: CardExportSelection): CharacterCardV3 {
  const charBook: RisuLorebookEntry[] = [];
  const assets: Array<{
    type: string;
    uri: string;
    name: string;
    ext: string;
  }> = safeStructuredClone(char.ccAssets ?? []);

  if (char.additionalAssets) {
    for (const asset of char.additionalAssets) {
      assets.push({
        type: "x-risu-asset",
        uri: asset[1],
        name: asset[0],
        ext: asset[2] || "png",
      });
    }
  }

  if (char.emotionImages) {
    for (const asset of char.emotionImages) {
      assets.push({
        type: "emotion",
        uri: asset[1],
        name: asset[0],
        ext: "png",
      });
    }
  }

  if (char.image && !assets.some((asset) => asset.type === "icon" && asset.name === "main")) {
    assets.push({
      type: "icon",
      uri: "ccdefault:",
      name: "main",
      ext: "png",
    });
  }

  for (const lore of char.globalLore) {
    const ext: {
      risu_case_sensitive?: boolean;
      risu_activationPercent?: number;
      risu_loreCache?: {
        key: string;
        data: string[];
      };
    } = safeStructuredClone(lore.extentions ?? {});

    const caseSensitive = ext.risu_case_sensitive ?? false;
    ext.risu_activationPercent = lore.activationPercent;
    ext.risu_loreCache = lore.loreCache;

    charBook.push({
      ...{
        keys: lore.key.split(",").map((r) => r.trim()),
        secondary_keys: lore.selective ? lore.secondkey.split(",").map((r) => r.trim()) : undefined,
        content: lore.content,
        extensions: ext,
        enabled: true,
        insertion_order: lore.insertorder,
        constant: lore.alwaysActive,
        selective: lore.selective,
        name: lore.comment,
        comment: lore.comment,
        case_sensitive: caseSensitive,
        use_regex: lore.useRegex ?? false,
      } as LorebookEntry,
      mode: lore.mode ?? "normal",
      folder: lore.folder,
    });
  }

  const loreExt = safeStructuredClone(char.loreExt ?? {});
  loreExt.risu_fullWordMatching = char.loreSettings?.fullWordMatching ?? false;

  const card: CharacterCardV3 = {
    spec: "chara_card_v3",
    spec_version: "3.0",
    data: {
      name: char.name,
      description: char.desc ?? "",
      personality: char.personality ?? "",
      scenario: char.scenario ?? "",
      first_mes: char.firstMessage ?? "",
      mes_example: char.exampleMessage ?? "",
      creator_notes: char.creatorNotes ?? "",
      system_prompt: char.systemPrompt ?? "",
      post_history_instructions: char.replaceGlobalNote ?? "",
      alternate_greetings: char.alternateGreetings ?? [],
      character_book: {
        scan_depth: char.loreSettings?.scanDepth,
        token_budget: char.loreSettings?.tokenBudget,
        recursive_scanning: char.loreSettings?.recursiveScanning,
        extensions: loreExt,
        entries: charBook,
      },
      tags: char.tags ?? [],
      creator: char.additionalData?.creator ?? "",
      character_version: char.additionalData?.character_version != null
        ? `${char.additionalData.character_version}`
        : "",
      extensions: {
        risuai: {
          bias: char.bias,
          viewScreen: char.viewScreen,
          customScripts: char.customscript,
          utilityBot: char.utilityBot,
          backgroundHTML: char.backgroundHTML,
          license: char.license,
          triggerscript: char.triggerscript,
          additionalText: char.additionalText,
          randomAltFirstMessageOnNewChat: char.randomAltFirstMessageOnNewChat ?? false,
          memoryEnabled: char.memoryEnabled === true,
          memoryPromptOverride: {
            summarizationPrompt: typeof getCharacterMemoryPromptOverride(char)?.summarizationPrompt === "string"
              ? getCharacterMemoryPromptOverride(char)?.summarizationPrompt
              : "",
          },
          virtualscript: "",
          largePortrait: char.largePortrait,
          lorePlus: char.lorePlus,
          inlayViewScreen: char.inlayViewScreen,
          newGenData: char.newGenData,
          vits: {},
          lowLevelAccess: char.lowLevelAccess ?? false,
          defaultVariables: char.defaultVariables ?? "",
          prebuiltAssetCommand: char.prebuiltAssetCommand ?? false,
          prebuiltAssetExclude: char.prebuiltAssetExclude ?? [],
          prebuiltAssetStyle: char.prebuiltAssetStyle ?? "",
        },
        depth_prompt: char.depth_prompt,
      },
      group_only_greetings: char.group_only_greetings ?? [],
      nickname: char.nickname ?? "",
      source: char.source ?? [],
      creation_date: char.creation_date ?? 0,
      modification_date: Math.floor(Date.now() / 1000),
      assets,
    },
  };

  const exportBundle = buildCharacterExportBundle(char, selection);
  if (exportBundle) {
    card.data.extensions.risuai.exportBundleV1 = exportBundle;
  }

  if (char.extentions) {
    for (const key in char.extentions) {
      if (key === "risuai" || key === "depth_prompt") {
        continue;
      }
      card.data.extensions[key] = char.extentions[key];
    }
  }

  return card;
}

export function applyImportedV3CardFields(char: character, card: CharacterCardV3): void {
  char.group_only_greetings = card.data.group_only_greetings ?? [];
  char.nickname = card.data.nickname ?? "";
  char.source = card.data.source ?? card.data?.extensions?.risuai?.source ?? [];
  char.creation_date = card.data.creation_date ?? 0;
  char.modification_date = card.data.modification_date ?? 0;
}
