const isTestMode = typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test';

// Server-only runtime: desktop (Tauri) and browser-lite modes are intentionally disabled
// for app/dev/prod execution. Tests can still opt into legacy behavior when needed.
export const isTauri: boolean = false;
export const isNodeServer: boolean = isTestMode
  ? !!(globalThis as typeof globalThis & { __NODE__?: boolean }).__NODE__
  : true;
export const isWeb: boolean = false;
export const isMobile: boolean = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent);

export const isFirefox: boolean = navigator.userAgent.includes("Firefox")
export const isWebKit: boolean =
  /AppleWebKit/i.test(navigator.userAgent) &&
  !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/i.test(navigator.userAgent);

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;

  const ua = navigator.userAgent || '';
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua);

  // iPadOS 13+
  const isIpadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;

  return isAppleMobile || isIpadOS;
}

export const isInStandaloneMode =
    window.matchMedia("(display-mode: standalone)").matches ||
    !!(navigator as Navigator & { standalone?: boolean }).standalone ||
    document.referrer.includes("android-app://");
