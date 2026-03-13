import { isMobile } from "src/ts/platform";

export function shouldSendOnEnter(event: KeyboardEvent, sendWithEnter: boolean): boolean {
  if (event.key.toLocaleLowerCase() !== "enter" || event.isComposing) {
    return false;
  }
  if (isMobile) {
    return false;
  }
  return sendWithEnter ? !event.shiftKey : event.shiftKey;
}

export function shouldSendTranslateOnEnter(event: KeyboardEvent, sendWithEnter: boolean): boolean {
  if (event.key.toLocaleLowerCase() !== "enter" || event.isComposing) {
    return false;
  }
  if (isMobile) {
    return false;
  }
  return sendWithEnter && !event.shiftKey;
}

export function resizeTextarea(textarea: HTMLTextAreaElement | null | undefined): string {
  if (!textarea) {
    return "44px";
  }
  textarea.style.height = "0";
  const nextHeight = `${textarea.scrollHeight}px`;
  textarea.style.height = nextHeight;
  return nextHeight;
}
