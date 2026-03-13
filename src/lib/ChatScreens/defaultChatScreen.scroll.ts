import { tick } from "svelte";

type ScrollToMessageArgs = {
  index: number;
  currentChatLength: number;
  loadPages: number;
  setLoadPages: (nextLoadPages: number) => void;
  setScrollingToMessage: (active: boolean) => void;
  sleep: (ms: number) => Promise<unknown>;
  containerSelector?: string;
};

export function getNeededLoadPagesForMessage(currentChatLength: number, index: number): number {
  return currentChatLength - index + 5;
}

export async function scrollToChatMessage(args: ScrollToMessageArgs): Promise<void> {
  const {
    index,
    currentChatLength,
    loadPages,
    setLoadPages,
    setScrollingToMessage,
    sleep,
    containerSelector = ".default-chat-screen",
  } = args;

  setScrollingToMessage(true);
  try {
    const neededLoadPages = getNeededLoadPagesForMessage(currentChatLength, index);
    if (loadPages < neededLoadPages) {
      setLoadPages(neededLoadPages);
      await tick();
    }

    let element: Element | null = null;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      element = document.querySelector(`[data-chat-index="${index}"]`);
      if (element) {
        break;
      }
      await sleep(100);
    }

    const preIndex = Math.max(0, index - 3);
    const preElement = document.querySelector(`[data-chat-index="${preIndex}"]`);
    if (preElement) {
      preElement.scrollIntoView({ behavior: "instant", block: "start" });
    } else {
      element?.scrollIntoView({ behavior: "instant", block: "start" });
    }
    await sleep(50);

    if (!element) {
      return;
    }

    const chatContainer = document.querySelector(containerSelector);
    if (chatContainer) {
      const images = Array.from(chatContainer.querySelectorAll("img"));
      const promises = images.map((img) => {
        if (img.complete) {
          return Promise.resolve();
        }
        return new Promise((resolve) => {
          img.onload = () => resolve(null);
          img.onerror = () => resolve(null);
        });
      });
      await Promise.race([Promise.all(promises), sleep(4000)]);
    }

    element.scrollIntoView({ behavior: "instant", block: "start" });
    await sleep(50);
    element.scrollIntoView({ behavior: "instant", block: "start" });
    element.classList.add("ds-chat-scroll-highlight");
    setTimeout(() => {
      element?.classList.remove("ds-chat-scroll-highlight");
    }, 2000);
  } finally {
    setScrollingToMessage(false);
  }
}

export function readChatScrollState(args: {
  event: Event;
  currentChatLength: number;
  loadPages: number;
}): {
  nextLoadPages: number;
  shouldHideNewMessageButton: boolean;
} {
  const target = args.event.target as HTMLElement;
  const scrolled = target.scrollHeight - target.clientHeight + target.scrollTop;
  const nextLoadPages =
    scrolled < 100 && args.currentChatLength > args.loadPages
      ? args.loadPages + 15
      : args.loadPages;

  const chatsContainer = target.querySelector(".ds-chat-list-stack");
  const lastElement = chatsContainer?.firstElementChild;
  const shouldHideNewMessageButton = lastElement
    ? lastElement.getBoundingClientRect().top <= target.getBoundingClientRect().bottom + 100
    : true;

  return {
    nextLoadPages,
    shouldHideNewMessageButton,
  };
}
