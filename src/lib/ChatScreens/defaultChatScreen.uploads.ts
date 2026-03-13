type PostFileResult =
  | { type: "asset"; data: string }
  | { type: "text"; data: string; name: string }
  | { type: "void" };

export function applyPostChatFileResults(args: {
  messageInput: string;
  fileInput: string[];
  results: PostFileResult[] | null | undefined;
}): {
  messageInput: string;
  fileInput: string[];
} {
  let nextMessageInput = args.messageInput;
  const nextFileInput = [...args.fileInput];

  for (const result of args.results ?? []) {
    if (result?.type === "asset") {
      nextFileInput.push(result.data);
    }
    if (result?.type === "text") {
      nextMessageInput += `{{file::${result.name}::${result.data}}}`;
    }
  }

  return {
    messageInput: nextMessageInput,
    fileInput: nextFileInput,
  };
}

export async function handleImagePasteUpload(args: {
  event: ClipboardEvent;
  uploadFile: (file: { name: string; data: Uint8Array }) => Promise<PostFileResult[] | null | undefined>;
  messageInput: string;
  fileInput: string[];
}): Promise<{
  handled: boolean;
  messageInput: string;
  fileInput: string[];
}> {
  const items = args.event.clipboardData?.items;
  if (!items) {
    return {
      handled: false,
      messageInput: args.messageInput,
      fileInput: args.fileInput,
    };
  }

  let canceled = false;
  let nextMessageInput = args.messageInput;
  let nextFileInput = [...args.fileInput];

  for (const item of items) {
    if (item.kind !== "file" || !item.type.startsWith("image")) {
      continue;
    }
    if (!canceled) {
      args.event.preventDefault();
      canceled = true;
    }
    const file = item.getAsFile();
    if (!file) {
      continue;
    }
    const buffer = await file.arrayBuffer();
    const results = await args.uploadFile({
      name: file.name,
      data: new Uint8Array(buffer),
    });
    const nextState = applyPostChatFileResults({
      messageInput: nextMessageInput,
      fileInput: nextFileInput,
      results,
    });
    nextMessageInput = nextState.messageInput;
    nextFileInput = nextState.fileInput;
  }

  return {
    handled: canceled,
    messageInput: nextMessageInput,
    fileInput: nextFileInput,
  };
}

export function getAdditionalAssetFileType(additionalAsset: [string, string, string?]): "img" | "video" | "audio" {
  const fileExtension = additionalAsset[2]?.toLowerCase() ?? "";
  if (fileExtension === "mp4" || fileExtension === "webm") {
    return "video";
  }
  if (fileExtension === "mp3" || fileExtension === "wav") {
    return "audio";
  }
  return "img";
}

export function appendStickerMarkup(messageInput: string, additionalAsset: [string, string, string?]): string {
  const fileType = getAdditionalAssetFileType(additionalAsset);
  return `${messageInput}<span class='notranslate' translate='no'>{{${fileType}::${additionalAsset[0]}}}</span> *${additionalAsset[0]} added*`;
}
