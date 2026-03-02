import { invoke } from "src/ts/tauriCompat/api-core";
import * as path from "src/ts/tauriCompat/api-path";
import { exists, readTextFile } from "src/ts/tauriCompat/plugin-fs";
import { alertClear, alertWait } from "src/ts/alert";
import { getDatabase } from "src/ts/storage/database.svelte";
import { sleep } from "src/ts/util";

let initPython = false

function getLocalModelServerBaseUrl() {
    const db = getDatabase();
    const dbWithLocalUrl = db as typeof db & { localModelServerUrl?: string };
    const configuredUrl = (dbWithLocalUrl.localModelServerUrl ?? '').trim();
    if (configuredUrl) {
        return configuredUrl.replace(/\/+$/, '');
    }
    const hostname = (typeof window !== 'undefined' && window.location?.hostname)
        ? window.location.hostname
        : '127.0.0.1';
    return `http://${hostname}:10026`;
}

async function installPython(){
    if(initPython){
        return
    }
    initPython = true
    const appDir = await path.appDataDir()
    const completedPath = await path.join(appDir, 'python', 'completed.txt')
    if(await exists(completedPath)){
        alertWait("Python is already installed, skipping")
    }
    else{
        alertWait("Installing Python")
        await invoke("install_python", {
            path: appDir
        })
        alertWait("Installing Pip")
        await invoke("install_pip", {
            path: appDir
        })
        alertWait("Rewriting requirements")
        await invoke('post_py_install', {
            path: appDir
        })
    
        alertClear()
    }
    const dependencies = [
        'pydantic',
        'scikit-build',
        'scikit-build-core',
        'pyproject_metadata',
        'pathspec',
        'llama-cpp-python',
        'uvicorn[standard]',
        'fastapi'
    ]
    for(const dep of dependencies){
        alertWait("Installing Python Dependencies (" + dep + ")")
        await invoke('install_py_dependencies', {
            path: appDir,
            dependency: dep
        })
    }

    await invoke('run_py_server', {
        pyPath: appDir,
    })
    await sleep(4000)
    alertClear()
    return

}

async function getLocalKey(retry = true) {
    try {
        const ft = await fetch(`${getLocalModelServerBaseUrl()}/`)
        const keyJson = await ft.json()
        const keyPath = keyJson.dir
        const key = await readTextFile(keyPath)
        return key
    } catch (error) {
        if(!retry){
            throw `Error when getting local key: ${error}`
        }
        //if is cors error
        if(
            error.message.includes("NetworkError when attempting to fetch resource.")
            || error.message.includes("Failed to fetch")
        ){
            await installPython()
            return await getLocalKey(false)
        }
        else{
            throw `Error when getting local key: ${error}`
        }
    }
}

export async function tokenizeGGUFModel(prompt:string):Promise<number[]> {
    const key = await getLocalKey()
    const db = getDatabase()
    const modelPath = db.aiModel.replace('local_', '')
    const b = await fetch(`${getLocalModelServerBaseUrl()}/llamacpp/tokenize`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-risu-auth": key
        },
        body: JSON.stringify({
            prompt: prompt,
            n_ctx: db.maxContext,
            model_path: modelPath
        })
    })

    return await b.json()
}
