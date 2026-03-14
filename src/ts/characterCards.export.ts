/* eslint-disable @typescript-eslint/no-explicit-any */
import { v4 } from "uuid";
import { alertCardExport, alertError, alertNormal, alertStore } from "./alert";
import { type character, getDatabase } from "./storage/database.svelte";
import { LocalWriter, readImage, downloadFile, BlankWriter, VirtualWriter, AppendableBuffer, saveAsset } from "./globalApi.svelte";
import { sleep, isKnownUri } from "./util";
import { language } from "src/lang";
import { reencodeImage } from "./process/files/inlays";
import { convertImage, checkImageType } from "./parser.svelte";
import { PngChunk } from "./pngChunk";
import { CharXWriter } from "./process/processzip";
import { exportModule, type RisuModule } from "./process/modules";
import { createBaseV3 } from "./cardSpecV3";
import type { CardExportSelection } from "./cardExportOptions";

export async function exportChar(charaID: number): Promise<string> {
  const db = getDatabase({ snapshot: true });
  const char = safeStructuredClone(db.characters[charaID]);

  if (char.type === "group") {
    return "";
  }

  if (!char.image) {
    const res = await fetch("/none.webp");
    char.image = await saveAsset(new Uint8Array(await res.arrayBuffer()));
  }

  const selection = await alertCardExport();
  if (selection.cancelled) {
    return "cancelled";
  }

  await exportCharacterCard(
    char,
    selection.format,
    {
      selection,
    },
  );
  return "";
}

export async function exportCharacterCard(
  char: character,
  type: "png" | "json" | "charx" | "charxJpeg" = "png",
  arg: {
    password?: string;
    writer?: LocalWriter | VirtualWriter;
    selection?: CardExportSelection;
  } = {},
) {
  let img: Uint8Array;
  const localWriter: LocalWriter | VirtualWriter = arg.writer ?? new LocalWriter();

  try {
    img = await readImage(char.image);
    img = type === "png" ? (await reencodeImage(img)) : img;
    if (!arg.writer && type !== "json") {
      const fileType = {
        png: ["Image File", "png"],
        json: ["JSON File", "json"],
        charx: ["CharX File", "charx"],
        charxJpeg: ["CharX Embeded Jpeg", "jpeg"],
      }[type];
      await (localWriter as LocalWriter).init(fileType[0], [fileType[1]]);
    }

    const writer = (type === "charx" || type === "charxJpeg")
      ? new CharXWriter(localWriter)
      : type === "json"
        ? new BlankWriter()
        : new PngChunk.streamWriter(img, localWriter);

    await writer.init();
    if (writer instanceof CharXWriter && type === "charxJpeg") {
      await writer.writeJpeg(img);
    }

    const jsonOutput = await writeV3Card(char, type, writer, img, arg.selection);

    await writer.end();
    if (jsonOutput) {
      await writeJsonOutput(localWriter, sanitizeFilename(char.name), jsonOutput, Boolean(arg.writer));
    }
    await sleep(10);
    if (!arg.writer) {
      alertNormal(language.successExport);
    }
  } catch (error) {
    alertError(error);
  }
}

async function writeV3Card(
  char: character,
  type: "png" | "json" | "charx" | "charxJpeg",
  writer: BlankWriter | CharXWriter | InstanceType<typeof PngChunk.streamWriter>,
  img: Uint8Array,
  selection?: CardExportSelection,
): Promise<Uint8Array | undefined> {
  const card = createBaseV3(char, selection);
  const seenPaths = new Set<string>();

  if (card.data.assets?.length) {
    for (let i = 0; i < card.data.assets.length; i++) {
      alertStore.set({
        type: "progress",
        msg: "Loading... (Adding Assets)",
        submsg: (i / card.data.assets.length * 100).toFixed(2),
      });

      let key = card.data.assets[i].uri;
      let rData: Uint8Array;
      if (key === "ccdefault:" && type !== "png") {
        key = char.image;
        rData = img;
      } else if (isKnownUri(key)) {
        continue;
      } else {
        rData = await readImage(key);
      }

      if (type === "png") {
        await writePngAsset(card.data.assets[i], writer, rData, i + 1);
      } else if (type === "json") {
        const jsonAssetEncoding = await encodeAssetForExport(card.data.assets[i].ext, rData);
        card.data.assets[i].ext = jsonAssetEncoding.ext;
        card.data.assets[i].uri = `data:${jsonAssetEncoding.mime};base64,${Buffer.from(jsonAssetEncoding.data).toString("base64")}`;
      } else {
        await writeCharXAsset(card.data.assets[i], writer as CharXWriter, rData, seenPaths, i + 1);
      }
    }
  }

  if (type === "json") {
    return Buffer.from(JSON.stringify(card, null, 4), "utf-8");
  }

  await sleep(10);
  alertStore.set({
    type: "wait",
    msg: "Loading... (Writing)",
  });

  if (type === "charx" || type === "charxJpeg") {
    const moduleData: RisuModule = {
      name: `${char.name} Module`,
      description: `Module for ${char.name}`,
      id: v4(),
      trigger: card.data.extensions.risuai.triggerscript ?? [],
      regex: card.data.extensions.risuai.customScripts ?? [],
      lorebook: char.globalLore ?? [],
    };
    delete card.data.extensions.risuai.triggerscript;
    delete card.data.extensions.risuai.customScripts;
    await writer.write("module.risum", await exportModule(moduleData, { alertEnd: false, saveData: false }));
    await writer.write("card.json", Buffer.from(JSON.stringify(card, null, 4)));
    return undefined;
  }

  await writer.write("ccv3", Buffer.from(JSON.stringify(card)).toString("base64"));
  return undefined;
}

async function writePngAsset(
  asset: { uri: string },
  writer: BlankWriter | CharXWriter | InstanceType<typeof PngChunk.streamWriter>,
  rData: Uint8Array,
  assetIndex: number,
) {
  asset.uri = `__asset:${assetIndex}`;
  await writer.write(`chara-ext-asset_:${assetIndex}`, Buffer.from(await convertImage(rData)).toString("base64"));
}

async function writeCharXAsset(
  asset: { type: string; uri: string; name: string; ext: string },
  writer: CharXWriter,
  rData: Uint8Array,
  seenPaths: Set<string>,
  assetIndex: number,
) {
  const assetCategory = getAssetCategory(asset.type);
  const encodedAsset = await encodeAssetForExport(asset.ext, rData);
  const assetFamily = getAssetFamily(encodedAsset.ext);
  const name = (asset.name || `asset_${assetIndex}`).slice(0, 100);
  const ext = encodedAsset.ext === "unknown" ? "png" : encodedAsset.ext;
  const baseDir = encodedAsset.ext === "unknown"
    ? `assets/${assetCategory}/image`
    : `assets/${assetCategory}/${assetFamily}`;
  const uniqueName = getUniqueAssetName(baseDir, name, ext, seenPaths);
  const assetPath = `${baseDir}/${uniqueName}.${ext}`;
  const metaPath = `x_meta/${uniqueName}.json`;

  asset.ext = ext;
  asset.uri = `embeded://${assetPath}`;
  await writeAssetMetadata(writer, metaPath, encodedAsset.data);
  await writer.write(assetPath, Buffer.from(encodedAsset.data));
}

async function writeJsonOutput(
  writer: LocalWriter | VirtualWriter,
  fileName: string,
  data: Uint8Array,
  useWriter: boolean,
) {
  if (!useWriter) {
    await downloadFile(`${fileName}_export.json`, data);
    return;
  }

  if (writer instanceof LocalWriter) {
    await writer.init(`${fileName}_export`, ["json"]);
  }
  await writer.write(data);
  await writer.close();
}

async function writeAssetMetadata(writer: CharXWriter, metaPath: string, rData: Uint8Array) {
  const imageType = checkImageType(rData);
  if (imageType === "PNG") {
    const metadata: Record<string, string> = {};
    const generator = PngChunk.readGenerator(rData);
    for await (const chunk of generator as AsyncGenerator<{ key: string; value: string } | AppendableBuffer | null>) {
      if (!chunk || chunk instanceof AppendableBuffer) {
        continue;
      }
      metadata[chunk.key] = chunk.value;
    }
    if (Object.keys(metadata).length > 0) {
      await writer.write(metaPath, Buffer.from(JSON.stringify(metadata, null, 4)), 6);
      return;
    }
  }
  await writer.write(metaPath, Buffer.from(JSON.stringify({ type: imageType }), "utf-8"), 6);
}

function getAssetCategory(type: string) {
  switch (type) {
    case "emotion":
    case "background":
    case "user_icon":
    case "icon":
      return type;
    default:
      return "other";
  }
}

function getAssetFamily(ext: string) {
  switch (ext) {
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "webp":
    case "avif":
      return "image";
    case "mp3":
    case "wav":
    case "ogg":
    case "flac":
      return "audio";
    case "mp4":
    case "webm":
    case "mov":
    case "avi":
    case "mkv":
      return "video";
    case "mmd":
    case "obj":
      return "model";
    case "safetensors":
    case "cpkt":
    case "onnx":
      return "ai";
    case "otf":
    case "ttf":
    case "woff":
    case "woff2":
      return "fonts";
    case "js":
    case "ts":
    case "lua":
      return "code";
    default:
      return "other";
  }
}

function getUniqueAssetName(baseDir: string, name: string, ext: string, seenPaths: Set<string>) {
  let uniqueName = name;
  let suffix = 0;
  while (seenPaths.has(`${baseDir}/${uniqueName}.${ext}`)) {
    suffix += 1;
    uniqueName = `${name}_${suffix}`;
  }
  seenPaths.add(`${baseDir}/${uniqueName}.${ext}`);
  return uniqueName;
}

function sanitizeFilename(name: string) {
  return name.replace(/[<>:"/\\|?*.,]/g, "");
}

async function encodeAssetForExport(ext: string, data: Uint8Array): Promise<{ data: Uint8Array; mime: string; ext: string }> {
  const convertedData = await convertImage(data);
  const encoding = getJsonAssetEncoding(ext, convertedData);
  return {
    data: convertedData,
    mime: encoding.mime,
    ext: encoding.ext,
  };
}

function getJsonAssetEncoding(ext: string, data: Uint8Array): { mime: string; ext: string } {
  const detectedImageType = checkImageType(data);
  switch (detectedImageType) {
    case "PNG":
      return { mime: "image/png", ext: "png" };
    case "JPEG":
      return { mime: "image/jpeg", ext: "jpeg" };
    case "GIF":
      return { mime: "image/gif", ext: "gif" };
    case "BMP":
      return { mime: "image/bmp", ext: "bmp" };
    case "AVIF":
      return { mime: "image/avif", ext: "avif" };
    case "WEBP":
      return { mime: "image/webp", ext: "webp" };
    default:
      break;
  }

  switch (ext.toLowerCase()) {
    case "png":
      return { mime: "image/png", ext: "png" };
    case "jpg":
    case "jpeg":
      return { mime: "image/jpeg", ext: "jpeg" };
    case "gif":
      return { mime: "image/gif", ext: "gif" };
    case "bmp":
      return { mime: "image/bmp", ext: "bmp" };
    case "webp":
      return { mime: "image/webp", ext: "webp" };
    case "avif":
      return { mime: "image/avif", ext: "avif" };
    case "mp3":
      return { mime: "audio/mpeg", ext: "mp3" };
    case "wav":
      return { mime: "audio/wav", ext: "wav" };
    case "ogg":
      return { mime: "audio/ogg", ext: "ogg" };
    case "flac":
      return { mime: "audio/flac", ext: "flac" };
    case "mp4":
      return { mime: "video/mp4", ext: "mp4" };
    case "webm":
      return { mime: "video/webm", ext: "webm" };
    case "mov":
      return { mime: "video/quicktime", ext: "mov" };
    case "avi":
      return { mime: "video/x-msvideo", ext: "avi" };
    case "mkv":
      return { mime: "video/x-matroska", ext: "mkv" };
    case "obj":
      return { mime: "model/obj", ext: "obj" };
    case "mmd":
      return { mime: "model/vnd.mmd", ext: "mmd" };
    case "otf":
      return { mime: "font/otf", ext: "otf" };
    case "ttf":
      return { mime: "font/ttf", ext: "ttf" };
    case "woff":
      return { mime: "font/woff", ext: "woff" };
    case "woff2":
      return { mime: "font/woff2", ext: "woff2" };
    case "js":
      return { mime: "text/javascript", ext: "js" };
    case "ts":
      return { mime: "text/plain", ext: "ts" };
    case "lua":
      return { mime: "text/plain", ext: "lua" };
    case "onnx":
      return { mime: "application/onnx", ext: "onnx" };
    case "safetensors":
      return { mime: "application/octet-stream", ext: "safetensors" };
    case "cpkt":
      return { mime: "application/octet-stream", ext: "cpkt" };
    default:
      return { mime: "application/octet-stream", ext: ext.toLowerCase() || "unknown" };
  }
}
