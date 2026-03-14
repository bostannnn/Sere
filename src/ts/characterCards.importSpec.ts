/* eslint-disable @typescript-eslint/no-explicit-any */
import { v4 as uuidv4 } from "uuid";
import type { CharacterCardV3 } from "@risuai/ccardlib";
import { alertConfirm, alertError, alertNormal, alertStore } from "./alert";
import type {
  character,
  customscript,
  loreBook,
  loreSettings,
} from "./storage/database.svelte";
import { getDatabase, setDatabase } from "./storage/database.svelte";
import { language } from "src/lang";
import { checkNullish, sleep } from "./util";
import { saveAsset } from "./globalApi.svelte";
import type { OnnxModelFiles } from "./process/transformers";
import { getHubResources } from "./characterCards.shared";
import { applyCharacterExportBundle } from "./cardBundleImport";
import {
  convertCharbook,
} from "./cardSpecLegacy";
import type { CharacterBook, CharacterCardV2Risu } from "./cardSpecLegacy";
import { applyImportedV3CardFields } from "./cardSpecV3";

export async function importCharacterCardSpec(
  card: CharacterCardV2Risu | CharacterCardV3,
  img?: Uint8Array,
  mode: "hub" | "normal" = "normal",
  assetDict: { [key: string]: string } = {},
  overrideLorebook: loreBook[] | null = null,
): Promise<boolean> {
  if (!card || (card.spec !== "chara_card_v2" && card.spec !== "chara_card_v3")) {
    return false;
  }

  const data = card.data;
  let im = img ? await saveAsset(img) : undefined;
  const db = getDatabase();
  const risuext = safeStructuredClone(data.extensions.risuai);
  const emotions: [string, string][] = [];
  const extAssets: [string, string, string][] = [];
  const ccAssets: Array<{ type: string; uri: string; name: string; ext: string }> = [];
  let bias: [string, number][] = [];
  let viewScreen: "none" | "emotion" = "none";
  let customScripts: customscript[] = [];
  let utilityBot = false;
  let vits: OnnxModelFiles | null = null;

  if (risuext && card.spec === "chara_card_v2") {
    const importedV2 = await importV2AssetsAndState(risuext, assetDict, mode);
    emotions.push(...importedV2.emotions);
    extAssets.push(...importedV2.extAssets);
    bias = importedV2.bias;
    viewScreen = importedV2.viewScreen;
    customScripts = importedV2.customScripts;
    utilityBot = importedV2.utilityBot;
    vits = importedV2.vits;
  }

  if (card.spec === "chara_card_v3") {
    const importedV3 = await importV3AssetsAndState(card, assetDict, im);
    emotions.push(...importedV3.emotions);
    extAssets.push(...importedV3.extAssets);
    ccAssets.push(...importedV3.ccAssets);
    im = importedV3.im;
    bias = importedV3.bias;
    viewScreen = importedV3.viewScreen;
    customScripts = importedV3.customScripts;
    utilityBot = importedV3.utilityBot;
  }

  if (risuext?.lowLevelAccess) {
    const confirmed = await alertConfirm(language.lowLevelAccessConfirm);
    if (!confirmed) {
      return false;
    }
  }

  const convertedLore = convertImportedCharacterBook(data.character_book, overrideLorebook);
  const char = buildImportedCharacter({
    card,
    im,
    emotions,
    bias,
    viewScreen,
    customScripts,
    utilityBot,
    extAssets,
    ccAssets,
    vits,
    lorebook: convertedLore.lorebook,
    loresettings: convertedLore.loresettings,
    loreExt: convertedLore.loreExt,
  });

  if (card.spec === "chara_card_v3") {
    applyImportedV3CardFields(char, card);
    applyCharacterExportBundle(char, data?.extensions?.risuai?.exportBundleV1);
  }

  db.characters.push(char);
  setDatabase(db);
  alertNormal(language.importedCharacter);
  return true;
}

async function importV2AssetsAndState(
  risuext: NonNullable<CharacterCardV2Risu["data"]["extensions"]["risuai"]>,
  assetDict: { [key: string]: string },
  mode: "hub" | "normal",
) {
  const emotions: [string, string][] = [];
  const extAssets: [string, string, string][] = [];
  let vits: OnnxModelFiles | null = null;

  if (risuext.emotions) {
    for (let i = 0; i < risuext.emotions.length; i++) {
      alertStore.set({
        type: "progress",
        msg: "Loading... (Loading Emotions)",
        submsg: (i / risuext.emotions.length * 100).toFixed(2),
      });
      await sleep(10);
      emotions.push([
        risuext.emotions[i][0],
        await resolveImportedAsset(risuext.emotions[i][1], assetDict, mode),
      ]);
    }
  }

  if (risuext.additionalAssets) {
    for (let i = 0; i < risuext.additionalAssets.length; i++) {
      alertStore.set({
        type: "progress",
        msg: "Loading... (Loading Assets)",
        submsg: (i / risuext.additionalAssets.length * 100).toFixed(2),
      });
      if (i % 100 === 0) {
        await sleep(10);
      }
      const fileName = risuext.additionalAssets[i].length >= 3 ? risuext.additionalAssets[i][2] : "";
      const assetPath = await resolveImportedAsset(risuext.additionalAssets[i][1], assetDict, mode, fileName);
      extAssets.push([risuext.additionalAssets[i][0], assetPath, fileName]);
    }
  }

  if (risuext.vits) {
    const keys = Object.keys(risuext.vits);
    for (let i = 0; i < keys.length; i++) {
      alertStore.set({
        type: "progress",
        msg: "Loading... (Loading VITS)",
        submsg: (i / keys.length * 100).toFixed(2),
      });
      await sleep(10);
      const key = keys[i];
      risuext.vits[key] = await resolveImportedAsset(risuext.vits[key], assetDict, mode);
    }
    if (keys.length > 0) {
      vits = {
        name: "Imported VITS",
        files: risuext.vits,
        id: uuidv4().replace(/-/g, ""),
      };
    }
  }

  return {
    emotions,
    extAssets,
    vits,
    bias: risuext.bias ?? [],
    viewScreen: normalizeImportedViewScreen(risuext.viewScreen),
    customScripts: risuext.customScripts ?? [],
    utilityBot: risuext.utilityBot ?? false,
  };
}

async function importV3AssetsAndState(
  card: CharacterCardV3,
  assetDict: { [key: string]: string },
  im: string | undefined,
) {
  const emotions: [string, string][] = [];
  const extAssets: [string, string, string][] = [];
  const ccAssets: Array<{ type: string; uri: string; name: string; ext: string }> = [];
  const risuext = safeStructuredClone(card.data.extensions.risuai);

  if (card.data.assets) {
    for (let i = 0; i < card.data.assets.length; i++) {
      alertStore.set({
        type: "progress",
        msg: "Loading... (Assets)",
        submsg: (i / card.data.assets.length * 100).toFixed(2),
      });
      if (i % 100 === 0) {
        await sleep(10);
      }

      let imgp = "";
      const asset = card.data.assets[i];
      const fileName = asset.name ?? "";
      if (asset.uri.startsWith("__asset:")) {
        const key = asset.uri.replace("__asset:", "");
        imgp = assetDict[key];
        if (!imgp) {
          throw new Error(`Error while importing, asset ${key} not found`);
        }
      } else if (asset.uri === "ccdefault:") {
        imgp = im ?? "";
      } else if (asset.uri.startsWith("embeded://")) {
        const key = asset.uri.replace("embeded://", "");
        imgp = assetDict[key];
        if (!imgp) {
          throw new Error(`Error while importing, asset ${key} not found`);
        }
      } else if (asset.uri.startsWith("data:")) {
        const b64 = asset.uri.split(",")[1];
        if (b64.length >= 50 * 1024 * 1024) {
          alertError("Data URI too large");
          continue;
        }
        imgp = await saveAsset(Buffer.from(b64, "base64"));
      } else {
        continue;
      }

      if (asset.type === "emotion") {
        emotions.push([fileName, imgp]);
      } else if (asset.type === "x-risu-asset") {
        extAssets.push([fileName, imgp, asset.ext ?? "unknown"]);
      } else if (asset.type === "icon" && asset.name === "main") {
        im = imgp;
      } else {
        ccAssets.push({
          type: asset.type ?? "asset",
          uri: imgp,
          name: fileName,
          ext: asset.ext ?? "unknown",
        });
      }
    }
  }

  return {
    emotions,
    extAssets,
    ccAssets,
    im,
    bias: risuext?.bias ?? [],
    viewScreen: normalizeImportedViewScreen(risuext?.viewScreen),
    customScripts: risuext?.customScripts ?? [],
    utilityBot: risuext?.utilityBot ?? false,
  };
}

function buildImportedCharacter(arg: {
  card: CharacterCardV2Risu | CharacterCardV3;
  im?: string;
  emotions: [string, string][];
  bias: [string, number][];
  viewScreen: "none" | "emotion";
  customScripts: customscript[];
  utilityBot: boolean;
  extAssets: [string, string, string][];
  ccAssets: Array<{ type: string; uri: string; name: string; ext: string }>;
  vits: OnnxModelFiles | null;
  lorebook: loreBook[];
  loresettings?: loreSettings;
  loreExt?: any;
}): character {
  const { card, im, emotions, bias, viewScreen, customScripts, utilityBot, extAssets, ccAssets, vits, lorebook, loresettings, loreExt } = arg;
  const data = card.data;
  const ext = safeStructuredClone(data?.extensions ?? {});

  for (const key in ext) {
    if (key === "risuai" || key === "depth_prompt") {
      delete ext[key];
    }
  }

  return {
    name: data.name ?? "",
    firstMessage: data.first_mes ?? "",
    desc: data.description ?? "",
    notes: "",
    chats: [{
      message: [],
      note: "",
      name: "Chat 1",
      localLore: [],
    }],
    chatPage: 0,
    image: im,
    emotionImages: emotions,
    bias,
    globalLore: lorebook,
    viewScreen,
    chaId: uuidv4(),
    utilityBot,
    customscript: customScripts,
    exampleMessage: data.mes_example ?? "",
    creatorNotes: data.creator_notes ?? "",
    systemPrompt: data.system_prompt ?? "",
    postHistoryInstructions: "",
    alternateGreetings: data.alternate_greetings ?? [],
    tags: data.tags ?? [],
    creator: data.creator ?? "",
    characterVersion: data.character_version != null ? `${data.character_version}` : "",
    personality: data.personality ?? "",
    scenario: data.scenario ?? "",
    firstMsgIndex: -1,
    randomAltFirstMessageOnNewChat: data?.extensions?.risuai?.randomAltFirstMessageOnNewChat ?? false,
    removedQuotes: false,
    loreSettings: loresettings,
    loreExt,
    additionalData: {
      tag: data.tags ?? [],
      creator: data.creator,
      character_version: data.character_version ?? "",
    },
    additionalAssets: extAssets,
    replaceGlobalNote: data.post_history_instructions ?? "",
    backgroundHTML: data?.extensions?.risuai?.backgroundHTML,
    license: data?.extensions?.risuai?.license,
    triggerscript: data?.extensions?.risuai?.triggerscript ?? [],
    private: data?.extensions?.risuai?.private ?? false,
    additionalText: data?.extensions?.risuai?.additionalText ?? "",
    virtualscript: "",
    extentions: ext ?? {},
    largePortrait: data?.extensions?.risuai?.largePortrait ?? (!data?.extensions?.risuai),
    lorePlus: data?.extensions?.risuai?.lorePlus ?? false,
    inlayViewScreen: data?.extensions?.risuai?.inlayViewScreen ?? false,
    newGenData: data?.extensions?.risuai?.newGenData ?? undefined,
    vits,
    ttsMode: vits ? "vits" : "normal",
    imported: true,
    source: card?.data?.extensions?.risuai?.source ?? [],
    ccAssets,
    lowLevelAccess: data?.extensions?.risuai?.lowLevelAccess ?? false,
    defaultVariables: data?.extensions?.risuai?.defaultVariables ?? "",
    chatFolders: [],
    memoryEnabled: data?.extensions?.risuai?.memoryEnabled === true,
    memoryPromptOverride: {
      summarizationPrompt: typeof data?.extensions?.risuai?.memoryPromptOverride?.summarizationPrompt === "string"
        ? data.extensions.risuai.memoryPromptOverride.summarizationPrompt
        : "",
    },
    prebuiltAssetCommand: data?.extensions?.risuai?.prebuiltAssetCommand ?? "",
    prebuiltAssetExclude: data?.extensions?.risuai?.prebuiltAssetExclude ?? [],
    prebuiltAssetStyle: data?.extensions?.risuai?.prebuiltAssetStyle ?? "",
  };
}

function convertImportedCharacterBook(charbook: CharacterBook | undefined, overrideLorebook: loreBook[] | null) {
  let lorebook: loreBook[] = overrideLorebook ?? [];
  let loresettings: loreSettings | undefined = undefined;
  let loreExt: any = undefined;

  if (charbook) {
    const converted = convertCharbook({
      lorebook: overrideLorebook ? [] : lorebook,
      charbook,
      loresettings,
      loreExt,
    });
    if (!overrideLorebook) {
      lorebook = converted.lorebook;
    }
    loresettings = converted.loresettings;
    loreExt = converted.loreExt;
  }

  return { lorebook, loresettings, loreExt };
}

async function resolveImportedAsset(
  value: string,
  assetDict: { [key: string]: string },
  mode: "hub" | "normal",
  fileName = "",
) {
  if (value.startsWith("__asset:")) {
    const key = value.replace("__asset:", "");
    const asset = assetDict[key];
    if (!asset) {
      throw new Error(`Error while importing, asset ${key} not found`);
    }
    return asset;
  }

  const assetBuffer = mode === "hub" ? (await getHubResources(value)) : Buffer.from(value, "base64");
  return saveAsset(assetBuffer, "", fileName);
}

function normalizeImportedViewScreen(viewScreen: unknown): "none" | "emotion" {
  if (viewScreen === "emotion") {
    return "emotion";
  }
  if ((viewScreen as string) === "imggen") {
    return "none";
  }
  return "none";
}
