import { alertError } from "src/ts/alert"
import { importPlugin } from "../plugins.svelte"
import { sleep } from "src/ts/util"
const pluginDevelopLog = (..._args: unknown[]) => {};

export async function hotReloadPluginFiles(){
    if(!('showOpenFilePicker' in window)){
        alertError("Your browser does not support the File System Access API, which is required for hot-reloading plugin files.")
        return
    }

    let fileHandle: FileSystemFileHandle
    try {
        [fileHandle] = await window.showOpenFilePicker({
            types: [
                {
                    description: "JavaScript or TypeScript Plugin File",
                    accept: {
                        "text/typescript": [".ts"],
                        "application/javascript": [".js"]
                    }
                }
            ]
        })   
    } catch {
        return
    }

    let lastModified = 0
    const callback = async () => {
        try {
            const file = await fileHandle.getFile()
            if(file.lastModified === lastModified){
                return
            }
            pluginDevelopLog("Detected change in plugin file, reloading...")
            lastModified = file.lastModified
            const content = await file.text()
            await importPlugin(content, {
                isHotReload: true,
                isUpdate: true,
                isTypescript: file.name.endsWith(".ts")
            })
        }
        catch (e){
            pluginDevelopLog("Error reading file:", e)
        }
    }

    while(true){
        await callback()
        await sleep(500)
    }
}
