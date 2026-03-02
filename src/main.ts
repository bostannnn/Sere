import "./ts/polyfill";
import "core-js/actual"
import "./ts/storage/database.svelte"
import App from "./App.svelte";
import { loadData } from "./ts/bootstrap";
import { initHotkey } from "./ts/hotkey";
import { preLoadCheck } from "./preload";
import { mount } from "svelte";
import { hydrateBootColorScheme } from "./ts/gui/colorscheme";

preLoadCheck()
hydrateBootColorScheme()
const target = document.getElementById("app");
if (!target) throw new Error("Could not find element with id 'app'");
const app = mount(App, {
    target: target,
});
loadData()
initHotkey()
document.getElementById('preloading')?.remove()

export default app;
