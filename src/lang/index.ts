import { languageEnglish } from "./en";

export let language: typeof languageEnglish = languageEnglish;

export function changeLanguage(_lang: string) {
    // UI localization is English-only.
    language = languageEnglish;
}
