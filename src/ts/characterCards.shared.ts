import type { character, groupChat } from "./storage/database.svelte";

const EXTERNAL_HUB_URL = "https://sv.risuai.xyz";
const NIGHTLY_HUB_URL = "https://nightly.sv.risuai.xyz";

export const hubURL = (window.location.hostname === "nightly.risuai.xyz" || localStorage.getItem("hub") === "nightly")
  ? NIGHTLY_HUB_URL
  : EXTERNAL_HUB_URL;

export async function getHubResources(id: string) {
  const res = await fetch(`${hubURL}/resource/${id}`);
  if (res.status !== 200) {
    throw (await res.text());
  }
  return Buffer.from(await res.arrayBuffer());
}

export function isCharacterHasAssets(char: character | groupChat) {
  if (char.type === "group") {
    return false;
  }

  return !!(
    (char.additionalAssets && char.additionalAssets.length > 0)
    || (char.emotionImages && char.emotionImages.length > 0)
    || (char.ccAssets && char.ccAssets.length > 0)
  );
}
