import "./ts/polyfill";
import "core-js/actual"
import "./ts/storage/database.svelte"
import App from "./App.svelte";
import { loadData, installTouchHardening } from "./ts/bootstrap";
import { initHotkey, initMobileGesture } from "./ts/hotkey";
import { preLoadCheck } from "./preload";
import { mount } from "svelte";
import { hydrateBootColorScheme } from "./ts/gui/colorscheme";
import { initStoresRuntime } from "./ts/stores.svelte";

preLoadCheck()
hydrateBootColorScheme()
initStoresRuntime()
const target = document.getElementById("app");
if (!target) throw new Error("Could not find element with id 'app'");
const app = mount(App, {
    target: target,
});
loadData()
initHotkey()
initMobileGesture()
installTouchHardening()
document.getElementById('preloading')?.remove()

export default app;
