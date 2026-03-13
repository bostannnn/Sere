import { isExpTranslator, translate } from "src/ts/translator/translator";

type TranslationArgs = {
  reverse: boolean;
  messageInput: string;
  messageInputTranslate: string;
  requestId: number;
};

type TranslationResult = {
  requestId: number;
  messageInput?: string;
  messageInputTranslate?: string;
};

export function shouldClearComposerTranslation(args: {
  reverse: boolean;
  messageInput: string;
  messageInputTranslate: string;
}): TranslationResult | null {
  const { reverse, messageInput, messageInputTranslate } = args;
  if (reverse && messageInputTranslate === "") {
    return {
      requestId: 0,
      messageInput: "",
    };
  }
  if (!reverse && messageInput === "") {
    return {
      requestId: 0,
      messageInputTranslate: "",
    };
  }
  return null;
}

export function usesDelayedExperimentalTranslation(reverse: boolean): boolean {
  return isExpTranslator() && reverse;
}

export function isExperimentalComposerTranslator(): boolean {
  return isExpTranslator();
}

export async function resolveComposerTranslation(args: TranslationArgs): Promise<TranslationResult> {
  const translatedMessage = await translate(
    args.reverse ? args.messageInputTranslate : args.messageInput,
    args.reverse,
  );
  if (!translatedMessage) {
    return { requestId: args.requestId };
  }
  return args.reverse
    ? {
        requestId: args.requestId,
        messageInput: translatedMessage,
      }
    : {
        requestId: args.requestId,
        messageInputTranslate: translatedMessage,
      };
}
