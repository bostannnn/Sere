/* eslint-disable @typescript-eslint/no-explicit-any */
import { v4 } from "uuid";
import type { CharacterCardV3 } from "@risuai/ccardlib";
import { alertError, alertInput, alertNormal, alertStore, alertWait } from "./alert";
import { type loreBook, getDatabase, importPreset, setDatabase, setDatabaseLite } from "./storage/database.svelte";
import { decryptBuffer, selectFileByDom, sleep } from "./util";
import { language } from "src/lang";
import { AppendableBuffer, checkCharOrder, saveAsset } from "./globalApi.svelte";
import { hasher } from "./parser.svelte";
import { SettingsMenuIndex, settingsOpen } from "./stores.svelte";
import { PngChunk } from "./pngChunk";
import { CharXImporter, CharXSkippableChecker } from "./process/processzip";
import { readModule } from "./process/modules";
import { importCharacterCardSpec } from "./characterCards.importSpec";
import { convertOffSpecCards, type CharacterCardV2Risu, type OldTavernChar } from "./cardSpecLegacy";

export async function importCharacter() {
  try {
    const files = await selectFileByDom(["*"], "multiple");
    if (!files) {
      return;
    }

    for (const file of files) {
      await importCharacterProcess({
        name: file.name,
        data: file,
      });
      checkCharOrder();
    }
  } catch (error) {
    alertError(error);
    return null;
  }
}

export async function importCharacterProcess(f: {
  name: string;
  data: Uint8Array | File | ReadableStream<Uint8Array>;
}) {
  const normalizedName = normalizeImportFileName(f.name);

  if (normalizedName.endsWith(".json")) {
    if (f.data instanceof ReadableStream) {
      return null;
    }
    const data = f.data instanceof Uint8Array ? f.data : new Uint8Array(await f.data.arrayBuffer());
    let parsed: any;
    try {
      parsed = JSON.parse(Buffer.from(data).toString("utf-8"));
    } catch {
      alertError(language.errors.noData);
      return;
    }
    if (await importCharacterCardSpec(parsed)) {
      getDatabase().statics.imports += 1;
      return getDatabase().characters.length - 1;
    }
    if ((parsed.char_name || parsed.name) && (parsed.char_persona || parsed.description) && (parsed.char_greeting || parsed.first_mes)) {
      const db = getDatabase();
      db.characters.push(convertOffSpecCards(parsed));
      setDatabaseLite(db);
      db.statics.imports += 1;
      alertNormal(language.importedCharacter);
      return db.characters.length - 1;
    }
    alertError(language.errors.noData);
    return;
  }

  if (normalizedName.endsWith(".charx") || normalizedName.endsWith(".jpg") || normalizedName.endsWith(".jpeg")) {
    const importedIndex = await importCharXCharacter(f);
    if (typeof importedIndex === "number") {
      getDatabase().statics.imports += 1;
    }
    return importedIndex;
  }

  if (!normalizedName.endsWith(".png")) {
    alertError(language.errors.noData);
    return;
  }

  const db = getDatabase();
  return importPngCharacter(f, db);
}

export async function characterURLImport() {
  const charPath = new URLSearchParams(location.search).get("charahub");
  try {
    if (charPath) {
      alertWait("Loading from Chub...");
      const url = new URL(location.href);
      url.searchParams.delete("charahub");
      window.history.pushState(null, "", url.toString());
      const chara = await fetch("https://api.chub.ai/api/characters/download", {
        method: "POST",
        body: JSON.stringify({
          format: "tavern",
          fullPath: charPath,
          version: "main",
        }),
        headers: {
          "content-type": "application/json",
        },
      });
      await importCharacterProcess({
        name: "charahub.png",
        data: new Uint8Array(await chara.arrayBuffer()),
      });
    }
  } catch {
    alertError(language.errors.noData);
    return null;
  }

  const hash = location.hash;
  if (hash.startsWith("#import=")) {
    location.hash = "";
    try {
      const res = await fetch(hash.replace("#import=", ""));
      await importFileByName(getImportFileName(res), new Uint8Array(await res.arrayBuffer()));
      checkCharOrder();
    } catch {
      alertError(language.errors.noData);
      return null;
    }
  }

  if (hash.startsWith("#import_module=")) {
    const importData = JSON.parse(Buffer.from(decodeURIComponent(hash.replace("#import_module=", "")), "base64").toString("utf-8"));
    importData.id = v4();
    const nextDb = getDatabase();
    nextDb.modules.push(importData);
    setDatabase(nextDb);
    alertNormal(language.successImport);
    SettingsMenuIndex.set(14);
    settingsOpen.set(true);
    return;
  }

  if (hash.startsWith("#import_preset=")) {
    await importPreset({
      name: "imported.risupreset",
      data: Buffer.from(decodeURIComponent(hash.replace("#import_preset=", "")), "base64"),
    });
    SettingsMenuIndex.set(1);
    settingsOpen.set(true);
    return;
  }

  if (hash.startsWith("#share_character")) {
    const data = await fetch("/sw/share/character");
    if (data.status === 200) {
      await importCharacterProcess({
        name: "shared.charx",
        data: new Uint8Array(await data.arrayBuffer()),
      });
    }
  }

  if ("launchQueue" in window) {
    //@ts-expect-error launchQueue is File Handling API, not yet in the Window type
    window.launchQueue.setConsumer((launchParams) => {
      if (!launchParams.files?.length) {
        return;
      }
      void handleLaunchFiles(launchParams.files as FileSystemFileHandle[]);
    });
  }
}

async function importCharXCharacter(f: {
  name: string;
  data: Uint8Array | File | ReadableStream<Uint8Array>;
}) {
  alertStore.set({
    type: "wait",
    msg: "Loading... (Reading)",
  });

  const charXData = await readCharXInput(f.data);
  const charXState = await resolveCharXState(charXData, f.data);
  const importer = new CharXImporter();
  importer.alertInfo = true;
  if (charXState.mode === "skippable") {
    importer.skipSaving = true;
  }
  if (charXState.mode === "signal") {
    importer.hashSignal = charXState.signal;
  }

  await importer.parse(charXState.data);
  if (!importer.cardData) {
    alertError(language.errors.noData);
    return;
  }

  const card = JSON.parse(importer.cardData) as CharacterCardV3;
  if (card.spec !== "chara_card_v3") {
    alertError(language.errors.noData);
    return;
  }

  let lorebook: loreBook[] | null = null;
  if (importer.moduleData) {
    const moduleData = await readModule(Buffer.from(importer.moduleData));
    card.data.extensions ??= {};
    card.data.extensions.risuai ??= {};
    card.data.extensions.risuai.triggerscript = moduleData.trigger ?? [];
    card.data.extensions.risuai.customScripts = moduleData.regex ?? [];
    if (moduleData.lorebook) {
      lorebook = moduleData.lorebook;
    }
  }

  await importer.done();
  await importCharacterCardSpec(card, undefined, "normal", importer.assets, lorebook);
  return getDatabase().characters.length - 1;
}

async function importPngCharacter(
  f: { name: string; data: Uint8Array | File | ReadableStream<Uint8Array> },
  db: ReturnType<typeof getDatabase>,
) {
  alertStore.set({
    type: "wait",
    msg: "Loading... (Reading)",
  });
  await sleep(10);

  let readedChara = "";
  let readedCCv3 = "";
  let img: Uint8Array | undefined;
  let pngChunks = 0;
  let readedPngChunks = 0;

  const pngData = f.data instanceof ReadableStream
    ? new Uint8Array(await new Response(f.data).arrayBuffer())
    : f.data;

  for await (const chunk of PngChunk.readGenerator(pngData)) {
    if (chunk instanceof AppendableBuffer) {
      break;
    }
    if (chunk?.key.startsWith("chara-ext-asset_")) {
      pngChunks += 1;
    }
  }

  const assets: { [key: string]: string } = {};
  for await (const chunk of PngChunk.readGenerator(pngData, { returnTrimed: true })) {
    if (!chunk) {
      continue;
    }
    if (chunk instanceof AppendableBuffer) {
      img = chunk.buffer;
      break;
    }
    if (chunk.key === "chara" && readedChara.length < 5 * 1024 * 1024) {
      readedChara = chunk.value;
      continue;
    }
    if (chunk.key === "ccv3" && readedCCv3.length < 5 * 1024 * 1024) {
      readedCCv3 = chunk.value;
      continue;
    }
    if (chunk.key.startsWith("chara-ext-asset_")) {
      const assetIndex = chunk.key.replace("chara-ext-asset_:", "").replace("chara-ext-asset_", "");
      const assetData = Buffer.from(chunk.value, "base64");
      if (pngChunks === 0) {
        alertWait(`Loading... (Loaded ${readedPngChunks} Assets)`);
      } else {
        alertStore.set({
          type: "progress",
          msg: "Loading... (Loading Assets)",
          submsg: (readedPngChunks / pngChunks * 100).toFixed(2),
        });
      }
      readedPngChunks += 1;
      assets[assetIndex] = await saveAsset(assetData);
    }
  }

  if (!readedChara && !readedCCv3) {
    alertError(language.errors.noData);
    return;
  }

  if (readedCCv3) {
    readedChara = readedCCv3;
  }

  if (!img) {
    alertError(language.errors.noData);
    return;
  }

  if (readedChara.startsWith("rcc||")) {
    return importLegacyEncryptedCard(readedChara, img, assets);
  }

  const parsed = JSON.parse(Buffer.from(readedChara, "base64").toString("utf-8"));
  if (typeof (parsed as CharacterCardV2Risu)?.data?.character_version === "number") {
    (parsed as CharacterCardV2Risu).data.character_version = `${(parsed as CharacterCardV2Risu).data.character_version}`;
  }

  if (parsed.spec !== "chara_card_v2" && parsed.spec !== "chara_card_v3") {
    db.characters.push(convertOffSpecCards(parsed as OldTavernChar, await saveAsset(img)));
    setDatabaseLite(db);
    db.statics.imports += 1;
    alertNormal(language.importedCharacter);
    return db.characters.length - 1;
  }

  if (await importCharacterCardSpec(parsed, img, "normal", assets)) {
    getDatabase().statics.imports += 1;
    return getDatabase().characters.length - 1;
  }
  return;
}

async function importLegacyEncryptedCard(readedChara: string, img: Uint8Array, assets: { [key: string]: string }) {
  const parts = readedChara.split("||");
  if (parts[1] !== "rccv1" || parts.length !== 5) {
    alertError(language.errors.noData);
    return;
  }

  const encrypted = Buffer.from(parts[2], "base64");
  if ((await hasher(encrypted)) !== parts[3]) {
    alertError(language.errors.noData);
    return;
  }

  const metadata = JSON.parse(Buffer.from(parts[4], "base64").toString("utf-8")) as { usePassword?: boolean };
  const password = metadata.usePassword ? await alertInput(language.inputCardPassword) : "RISU_NONE";
  if (!password) {
    return;
  }

  try {
    const decrypted = await decryptBuffer(encrypted, password);
    const card = JSON.parse(Buffer.from(decrypted).toString("utf-8")) as CharacterCardV2Risu;
    if (await importCharacterCardSpec(card, img, "normal", assets)) {
      getDatabase().statics.imports += 1;
      return getDatabase().characters.length - 1;
    }
  } catch {
    alertError(metadata.usePassword ? language.errors.wrongPassword : language.errors.noData);
  }
}

async function importFileByName(name: string, data: Uint8Array) {
  const normalizedName = normalizeImportFileName(name);
  if (
    normalizedName.endsWith(".json")
    || normalizedName.endsWith(".charx")
    || normalizedName.endsWith(".jpg")
    || normalizedName.endsWith(".jpeg")
    || normalizedName.endsWith(".png")
  ) {
    await importCharacterProcess({ name: normalizedName || "import.json", data });
    return;
  }
  if (normalizedName.endsWith(".risupreset") || normalizedName.endsWith(".risup")) {
    await importPreset({ name, data });
    SettingsMenuIndex.set(1);
    settingsOpen.set(true);
    alertNormal(language.successImport);
    return;
  }
  if (normalizedName.endsWith(".risum")) {
    const moduleData = await readModule(Buffer.from(data));
    moduleData.id = v4();
    const db = getDatabase();
    db.modules.push(moduleData);
    setDatabase(db);
    alertNormal(language.successImport);
    SettingsMenuIndex.set(14);
    settingsOpen.set(true);
    return;
  }
  if (looksLikeJsonImport(data)) {
    await importCharacterProcess({ name: normalizedName || "import.json", data });
  }
}

async function handleLaunchFiles(files: FileSystemFileHandle[]) {
  for (const fileHandle of files) {
    const file = await fileHandle.getFile();
    await importFileByName(fileHandle.name, new Uint8Array(await file.arrayBuffer()));
  }
}

async function readCharXInput(data: Uint8Array | File | ReadableStream<Uint8Array>) {
  if (data instanceof ReadableStream) {
    const reader = data.getReader();
    const chunks: Uint8Array[] = [];
    let done = false;
    let readedBytes = 0;
    while (!done) {
      const result = await reader.read();
      readedBytes += result.value ? result.value.length : 0;
      done = result.done;
      if (result.value) {
        chunks.push(result.value);
      }
      alertWait(`Loading... (Reading) ${readedBytes} Bytes`);
    }
    const buffer = new Uint8Array(readedBytes);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }
    return buffer;
  }

  const response = new Response(data as BodyInit);
  return new Uint8Array(await response.arrayBuffer());
}

async function resolveCharXState(data: Uint8Array, originalData: Uint8Array | File | ReadableStream<Uint8Array>) {
  const skippable = await CharXSkippableChecker(data);
  return {
    data: originalData instanceof ReadableStream ? data : originalData,
    signal: skippable.hash,
    mode: skippable.success ? "skippable" as const : "signal" as const,
  };
}

function getImportFileName(res: Response): string {
  return (
    getFromContentDisposition(res.headers.get("content-disposition"))
    || getFileNameFromUrl(res.url)
    || inferFileNameFromContentType(res.headers.get("content-type"))
  );
}

function getFromContentDisposition(contentDisposition: string | null): string | null {
  if (!contentDisposition) {
    return null;
  }
  const matches = contentDisposition.match(/filename\*=UTF-8''([^"';\n]+)|filename[^;\n=]*=["']?([^"';\n]+)["']?/);
  if (!matches) {
    return null;
  }
  return matches[1] ? decodeURIComponent(matches[1]) : matches[2];
}

function getFileNameFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    return path.substring(path.lastIndexOf("/") + 1);
  } catch {
    return "";
  }
}

function inferFileNameFromContentType(contentType: string | null): string {
  if (contentType?.toLowerCase().includes("application/json")) {
    return "import.json";
  }
  return "";
}

function normalizeImportFileName(name: string): string {
  return name.trim().toLowerCase();
}

function looksLikeJsonImport(data: Uint8Array): boolean {
  const preview = Buffer.from(data.slice(0, 256)).toString("utf-8").trimStart();
  return preview.startsWith("{") || preview.startsWith("[");
}
