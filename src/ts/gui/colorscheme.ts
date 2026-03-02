import { get, writable } from "svelte/store";
import { getDatabase, setDatabase } from "../storage/database.svelte";
import { downloadFile } from "../globalApi.svelte";
import { BufferToText, selectSingleFile } from "../util";
import { alertError } from "../alert";
import { isLite } from "../lite";
import { CustomCSSStore, SafeModeStore } from "../stores.svelte";

export interface ColorScheme{
    bgcolor: string;
    darkbg: string;
    borderc: string;
    selected: string;
    draculared: string;
    textcolor: string;
    textcolor2: string;
    darkBorderc: string;
    darkbutton: string;
    type:'light'|'dark';
}


export const defaultColorScheme: ColorScheme = {
    bgcolor: "#282a36",
    darkbg: "#21222c",
    borderc: "#6272a4",
    selected: "#44475a",
    draculared: "#ff5555",
    textcolor: "#f8f8f2",
    textcolor2: "#64748b",
    darkBorderc: "#4b5563",
    darkbutton: "#374151",
    type:'dark'
}

const colorShemes = {
    "default": defaultColorScheme,
    "dark": {
        bgcolor: "#1a1a1a",
        darkbg: "#141414",
        borderc: "#525252",
        selected: "#3d3d3d",
        draculared: "#ff5555",
        textcolor: "#f5f5f5",
        textcolor2: "#a3a3a3",
        darkBorderc: "#404040",
        darkbutton: "#2e2e2e",
        type:'dark'
    },
    "light": {
        bgcolor: "#ffffff",
        darkbg: "#f0f0f0",
        borderc: "#0f172a",
        selected: "#e0e0e0",
        draculared: "#ff5555",
        textcolor: "#0f172a",
        textcolor2: "#64748b",
        darkBorderc: "#d1d5db",
        darkbutton: "#e5e7eb",
        type:'light'
    },
    "cherry": {
        bgcolor: "#450a0a",
        darkbg: "#7f1d1d",
        borderc: "#ea580c",
        selected: "#d97706",
        draculared: "#ff5555",
        textcolor: "#f8f8f2",
        textcolor2: "#fca5a5",
        darkBorderc: "#92400e",
        darkbutton: "#b45309",
        type:'dark'
    },
    "galaxy": {
        bgcolor: "#0f172a",
        darkbg: "#1f2a48",
        borderc: "#8be9fd",
        selected: "#457b9d",
        draculared: "#ff5555",
        textcolor: "#f8f8f2",
        textcolor2: "#8be9fd",
        darkBorderc: "#457b9d",
        darkbutton: "#1f2a48",
        type:'dark'
    },
    "nature": {
        bgcolor: "#1b4332",
        darkbg: "#2d6a4f",
        borderc: "#a8dadc",
        selected: "#4d908e",
        draculared: "#ff5555",
        textcolor: "#f8f8f2",
        textcolor2: "#4d908e",
        darkBorderc: "#457b9d",
        darkbutton: "#2d6a4f",
        type:'dark'
    },
    "realblack": {
        bgcolor: "#000000",
        darkbg: "#000000",
        borderc: "#6272a4",
        selected: "#44475a",
        draculared: "#ff5555",
        textcolor: "#f8f8f2",
        textcolor2: "#64748b",
        darkBorderc: "#4b5563",
        darkbutton: "#374151",
        type:'dark'
    },
    "monokai-light": {
        bgcolor: "#f8f8f2",
        darkbg: "#e8e8e3",
        borderc: "#75715e",
        selected: "#d8d8d0",
        draculared: "#f92672",
        textcolor: "#272822",
        textcolor2: "#75715e",
        darkBorderc: "#c0c0b8",
        darkbutton: "#d0d0c8",
        type:'light'
    },
    "monokai-black": {
        bgcolor: "#272822",
        darkbg: "#1e1f1a",
        borderc: "#75715e",
        selected: "#3e3d32",
        draculared: "#f92672",
        textcolor: "#f8f8f2",
        textcolor2: "#a6a68a",
        darkBorderc: "#3e3d32",
        darkbutton: "#3e3d32",
        type:'dark'
    },
    "lite": {
        bgcolor: "#1f2937",
        darkbg: "#1C2533",
        borderc: "#475569",
        selected: "#475569",
        draculared: "#ff5555",
        textcolor: "#f8f8f2",
        textcolor2: "#64748b",
        darkBorderc: "#030712",
        darkbutton: "#374151",
        type:'dark'
    }

} as const

export const ColorSchemeTypeStore = writable('dark' as 'dark'|'light')
const bootColorSchemeCacheKey = "risu:boot-color-scheme"
const legacyBootSchemeNameKey = "moescape.colorScheme"

export const colorSchemeList = Object.keys(colorShemes) as (keyof typeof colorShemes)[]

const isValidColorScheme = (value: unknown): value is ColorScheme => {
    if(!value || typeof value !== 'object'){
        return false
    }
    const scheme = value as Partial<ColorScheme>
    return (
        typeof scheme.bgcolor === 'string' &&
        typeof scheme.darkbg === 'string' &&
        typeof scheme.borderc === 'string' &&
        typeof scheme.selected === 'string' &&
        typeof scheme.draculared === 'string' &&
        typeof scheme.textcolor === 'string' &&
        typeof scheme.textcolor2 === 'string' &&
        typeof scheme.darkBorderc === 'string' &&
        typeof scheme.darkbutton === 'string' &&
        (scheme.type === 'light' || scheme.type === 'dark')
    )
}

const applyColorSchemeCssVars = (colorScheme: ColorScheme) => {
    if(typeof document === 'undefined'){
        return
    }
    const root = document.documentElement
    root.style.setProperty("--risu-theme-bgcolor", colorScheme.bgcolor)
    root.style.setProperty("--risu-theme-darkbg", colorScheme.darkbg)
    root.style.setProperty("--risu-theme-borderc", colorScheme.borderc)
    root.style.setProperty("--risu-theme-selected", colorScheme.selected)
    root.style.setProperty("--risu-theme-draculared", colorScheme.draculared)
    root.style.setProperty("--risu-theme-textcolor", colorScheme.textcolor)
    root.style.setProperty("--risu-theme-textcolor2", colorScheme.textcolor2)
    root.style.setProperty("--risu-theme-darkborderc", colorScheme.darkBorderc)
    root.style.setProperty("--risu-theme-darkbutton", colorScheme.darkbutton)
}

const cacheBootColorScheme = (colorScheme: ColorScheme) => {
    if(typeof window === 'undefined'){
        return
    }
    try {
        window.localStorage.setItem(bootColorSchemeCacheKey, JSON.stringify(colorScheme))
    } catch {}
}

export function hydrateBootColorScheme(){
    if(typeof window === 'undefined'){
        return
    }
    let hasValidBootCache = false
    const raw = window.localStorage.getItem(bootColorSchemeCacheKey)
    if(raw){
        try {
            const parsed = JSON.parse(raw)
            if(isValidColorScheme(parsed)){
                applyColorSchemeCssVars(parsed)
                ColorSchemeTypeStore.set(parsed.type)
                hasValidBootCache = true
            }
        } catch {}

        if(!hasValidBootCache){
            try {
                window.localStorage.removeItem(bootColorSchemeCacheKey)
            } catch {}
        }
    }

    if(hasValidBootCache){
        return
    }

    try {
        const legacySchemeName = window.sessionStorage.getItem(legacyBootSchemeNameKey)
            || window.localStorage.getItem(legacyBootSchemeNameKey)
        if(legacySchemeName && legacySchemeName in colorShemes){
            const legacyScheme = colorShemes[legacySchemeName as keyof typeof colorShemes]
            applyColorSchemeCssVars(legacyScheme)
            ColorSchemeTypeStore.set(legacyScheme.type)
        }
    } catch {}
}

export function changeColorScheme(colorScheme: string){
    try {
        const db = getDatabase()
        if(colorScheme !== 'custom' && colorScheme in colorShemes){
            db.colorScheme = safeStructuredClone(colorShemes[colorScheme as keyof typeof colorShemes])
        }
        db.colorSchemeName = colorScheme
        setDatabase(db)
        updateColorScheme()   
    } catch {}
}

export function updateColorScheme(){
    try {
        const db = getDatabase()

        let colorScheme = db.colorScheme

        if(colorScheme == null){
            colorScheme = safeStructuredClone(defaultColorScheme)
        }

        if(get(isLite)){
            colorScheme = safeStructuredClone(colorShemes.lite)
        }

        applyColorSchemeCssVars(colorScheme)
        cacheBootColorScheme(colorScheme)
        if(typeof window !== 'undefined'){
            try {
                const schemeName = db.colorSchemeName || 'default'
                window.sessionStorage.setItem(legacyBootSchemeNameKey, schemeName)
            } catch {}
        }
        ColorSchemeTypeStore.set(colorScheme.type)
    } catch {}
}

export function changeColorSchemeType(type: 'light'|'dark'){
    try {
        const db = getDatabase()
        db.colorScheme.type = type
        setDatabase(db)
        updateColorScheme()
        updateTextThemeAndCSS()
    } catch {}
}

export function exportColorScheme(){
    const db = getDatabase()
    const json = JSON.stringify(db.colorScheme)
    downloadFile('colorScheme.json', json)
}

export async function importColorScheme(){
    const uarray = await selectSingleFile(['json'])
    if(uarray == null){
        return
    }
    const string = BufferToText(uarray.data)
    let colorScheme: ColorScheme
    try{
        colorScheme = JSON.parse(string)
        if(
            typeof colorScheme.bgcolor !== 'string' ||
            typeof colorScheme.darkbg !== 'string' ||
            typeof colorScheme.borderc !== 'string' ||
            typeof colorScheme.selected !== 'string' ||
            typeof colorScheme.draculared !== 'string' ||
            typeof colorScheme.textcolor !== 'string' ||
            typeof colorScheme.textcolor2 !== 'string' ||
            typeof colorScheme.darkBorderc !== 'string' ||
            typeof colorScheme.darkbutton !== 'string' ||
            typeof colorScheme.type !== 'string'
        ){
            alertError('Invalid color scheme')
            return
        }
        changeColorScheme('custom')
        const db = getDatabase()
        db.colorScheme = colorScheme
        setDatabase(db)
        updateColorScheme()
    }
    catch{
        alertError('Invalid color scheme')
        return
    
    }
}

export function updateTextThemeAndCSS(){
    const db = getDatabase()
    const root = document.querySelector(':root') as HTMLElement;
    if(!root){
        return
    }
    const textTheme = get(isLite) ? 'standard' : db.textTheme
    const colorScheme = get(isLite) ? 'dark' : db.colorScheme.type
    switch(textTheme){
        case "standard":{
            if(colorScheme === 'dark'){
                root.style.setProperty('--FontColorStandard', '#fafafa');
                root.style.setProperty('--FontColorItalic', '#8C8D93');
                root.style.setProperty('--FontColorBold', '#fafafa');
                root.style.setProperty('--FontColorItalicBold', '#8C8D93');
                root.style.setProperty('--FontColorQuote1', '#8BE9FD');
                root.style.setProperty('--FontColorQuote2', '#FFB86C');
            }else{
                root.style.setProperty('--FontColorStandard', '#0f172a');
                root.style.setProperty('--FontColorItalic', '#8C8D93');
                root.style.setProperty('--FontColorBold', '#0f172a');
                root.style.setProperty('--FontColorItalicBold', '#8C8D93');
                root.style.setProperty('--FontColorQuote1', '#8BE9FD');
                root.style.setProperty('--FontColorQuote2', '#FFB86C');
            }
            break
        }
        case "highcontrast":{
            if(colorScheme === 'dark'){
                root.style.setProperty('--FontColorStandard', '#f8f8f2');
                root.style.setProperty('--FontColorItalic', '#F1FA8C');
                root.style.setProperty('--FontColorBold', '#8BE9FD');
                root.style.setProperty('--FontColorItalicBold', '#FFB86C');
                root.style.setProperty('--FontColorQuote1', '#8BE9FD');
                root.style.setProperty('--FontColorQuote2', '#FFB86C');
            }
            else{
                root.style.setProperty('--FontColorStandard', '#0f172a');
                root.style.setProperty('--FontColorItalic', '#F1FA8C');
                root.style.setProperty('--FontColorBold', '#8BE9FD');
                root.style.setProperty('--FontColorItalicBold', '#FFB86C');
                root.style.setProperty('--FontColorQuote1', '#8BE9FD');
                root.style.setProperty('--FontColorQuote2', '#FFB86C');
            }
            break
        }
        case "custom":{
            root.style.setProperty('--FontColorStandard', db.customTextTheme.FontColorStandard);
            root.style.setProperty('--FontColorItalic', db.customTextTheme.FontColorItalic);
            root.style.setProperty('--FontColorBold', db.customTextTheme.FontColorBold);
            root.style.setProperty('--FontColorItalicBold', db.customTextTheme.FontColorItalicBold);
            root.style.setProperty('--FontColorQuote1', db.customTextTheme.FontColorQuote1 ?? '#8BE9FD');
            root.style.setProperty('--FontColorQuote2', db.customTextTheme.FontColorQuote2 ?? '#FFB86C');
            break
        }
    }

    switch(db.font){
        case "default":{
            const bodyFont = '"Manrope", "Avenir Next", "Segoe UI", "Noto Sans", "Liberation Sans", sans-serif';
            const displayFont = '"Fraunces", "Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif';
            root.style.setProperty('--risu-font-family-body', bodyFont);
            root.style.setProperty('--risu-font-family-display', displayFont);
            root.style.setProperty('--risu-font-family', bodyFont);
            break
        }
        case "timesnewroman":{
            const serifFont = '"Times New Roman", "Times", "Liberation Serif", serif';
            root.style.setProperty('--risu-font-family-body', serifFont);
            root.style.setProperty('--risu-font-family-display', serifFont);
            root.style.setProperty('--risu-font-family', serifFont);
            break
        }
        case "custom":{
            const customFont = db.customFont;
            root.style.setProperty('--risu-font-family-body', customFont);
            root.style.setProperty('--risu-font-family-display', customFont);
            root.style.setProperty('--risu-font-family', customFont);
            break
        }
    }

    if(!get(SafeModeStore)){
        CustomCSSStore.set(db.customCSS ?? '')
    }
    else{
        CustomCSSStore.set('')
    }
}
