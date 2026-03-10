import type {
    CharacterEvolutionPrivacySettings,
    CharacterEvolutionSectionConfig,
    CharacterEvolutionSectionKey,
} from "../storage/database.types"

export const DEFAULT_EXTRACTION_PROMPT = [
    "You update a character evolution state after a completed roleplay chat.",
    "",
    "Return raw JSON only with keys proposedState and changes.",
    "Do not use markdown.",
    "Do not use code fences.",
    "",
    "proposedState:",
    "- must contain the full next state object",
    "- must use the exact keys and structure from Current state JSON",
    "- must preserve unchanged fields exactly as received",
    "- must not add new keys or rename keys",
    "",
    "changes:",
    "- must be an array of objects with sectionKey, summary, and evidence",
    "- include only sections that actually changed in proposedState",
    "- never list a section in changes if proposedState for that section is unchanged or empty",
    "- every changes entry must have at least one non-empty evidence string",
    "- evidence must be short transcript-supported quotes or paraphrases",
    "",
    "Global rules:",
    "- Use only transcript-supported information.",
    "- Do not invent facts.",
    "- Do not use character card identity context as evidence for new changes.",
    "- Prefer no change over weak inference.",
    "- If nothing changed, return the current state unchanged and return an empty changes array.",
    "- Only update enabled and privacy-allowed sections.",
    "- Keep changes small and durable; do not overreact to one-off lines.",
    "- Maximum 3 to 6 changed sections unless the transcript clearly supports more.",
    "- When preserving existing item objects, keep their existing fields intact.",
    "",
    "Schema rules:",
    "- relationship and lastChatEnded are objects",
    "- activeThreads, runningJokes, userRead, and keyMoments are arrays of strings",
    "- characterLikes, characterDislikes, characterHabits, characterBoundariesPreferences, userFacts, userLikes, userDislikes, characterIntimatePreferences, and userIntimatePreferences are arrays of item objects",
    "- userRead must be an array of strings, never objects",
    "- if userRead is listed in changes, proposedState.userRead must contain at least one new string",
    "",
    "Field discipline:",
    "- userFacts = neutral, explicit facts about {{user}} only",
    "- never put fantasies, desires, kinks, interpretations, opinions, or relationship judgments into userFacts",
    "- userRead = {{char}}'s subjective interpretation of {{user}} only",
    "- userLikes and userDislikes = explicit or strongly evidenced preferences only",
    "- characterIntimatePreferences and userIntimatePreferences = explicit sexual or erotic preferences only",
    "- do not move sexual fantasies or erotic requests into userFacts",
    "- do not add broad intimate preference labels if the transcript only supports a narrower act",
    "- do not add 'will allow it', 'probably likes', or other speculative intimate entries",
    "",
    "For item objects, use:",
    "- value: string",
    "- confidence: suspected | likely | confirmed when applicable",
    "- note: brief evidence/context when applicable",
    "- status: preserve existing status unless there is a clear reason to change it",
].join("\n")

export const DEFAULT_PRIVACY: CharacterEvolutionPrivacySettings = {
    allowCharacterIntimatePreferences: false,
    allowUserIntimatePreferences: false,
}

export const CHARACTER_EVOLUTION_PROVIDER_SUGGESTIONS = [
    "openrouter",
    "openai",
    "deepseek",
    "anthropic",
    "google",
    "ollama",
] as const

export const CHARACTER_EVOLUTION_MODEL_SUGGESTIONS = [
    "anthropic/claude-3.5-haiku",
    "anthropic/claude-3.5-sonnet",
    "openai/gpt-4.1-mini",
    "openai/gpt-4.1",
    "google/gemini-2.0-flash-001",
    "deepseek/deepseek-chat",
] as const

export const CHARACTER_EVOLUTION_NATIVE_MODEL_SUGGESTIONS = {
    openrouter: CHARACTER_EVOLUTION_MODEL_SUGGESTIONS,
    openai: [
        "gpt-4.1-mini",
        "gpt-4.1",
    ],
    anthropic: [
        "claude-3-5-haiku-latest",
        "claude-3-5-sonnet-latest",
    ],
    google: [
        "gemini-2.0-flash-001",
        "gemini-2.0-flash",
    ],
    deepseek: [
        "deepseek-chat",
    ],
    ollama: [] as const,
    kobold: [] as const,
    novelai: [] as const,
} as const

export const CHARACTER_EVOLUTION_MODEL_PREFIX_BY_PROVIDER = {
    openai: "openai/",
    anthropic: "anthropic/",
    google: "google/",
    deepseek: "deepseek/",
} as const

export const CHARACTER_EVOLUTION_MODEL_PREFIXES = Object.values(
    CHARACTER_EVOLUTION_MODEL_PREFIX_BY_PROVIDER,
)

export const BUILTIN_SECTION_DEFS: Array<{
    key: CharacterEvolutionSectionKey
    label: string
    instruction: string
    kind: CharacterEvolutionSectionConfig["kind"]
    enabled?: boolean
    includeInPrompt?: boolean
    sensitive?: boolean
}> = [
    { key: "relationship", label: "Relationship", instruction: "Update only on durable relationship shifts supported by repeated signals or a clear pivotal moment. Do not change for one flirt, one argument, or one sex act alone.", kind: "object", includeInPrompt: true },
    { key: "activeThreads", label: "Active Threads", instruction: "Keep unresolved loops only. Add only clear open loops, tensions, promises, or unanswered questions. Do not add vague themes unless they are clearly left hanging.", kind: "list", includeInPrompt: true },
    { key: "runningJokes", label: "Running Jokes", instruction: "Add only jokes or callbacks that are repeated, explicitly revisited, or clearly framed as recurring. Do not turn one-off banter into a running joke.", kind: "list", includeInPrompt: true },
    { key: "characterLikes", label: "Character Likes", instruction: "Track persistent likes only if explicitly stated or strongly evidenced more than once in this chat. Do not preserve from identity context alone.", kind: "list", includeInPrompt: true },
    { key: "characterDislikes", label: "Character Dislikes", instruction: "Track persistent dislikes only if explicitly stated or strongly evidenced in this chat. Do not preserve from identity context alone. Do not confuse moral opinions with stable dislikes unless clearly personal.", kind: "list", includeInPrompt: true },
    { key: "characterHabits", label: "Character Habits", instruction: "Track repeated habits or clear behavioral patterns shown in this chat. Do not add habits from a single isolated action unless it is strongly characteristic.", kind: "list", includeInPrompt: true },
    { key: "characterBoundariesPreferences", label: "Character Boundaries / Preferences", instruction: "Track non-intimate boundaries, comfort rules, and control preferences only. Do not mix in sexual preferences. Add only when explicitly stated, enforced, or clearly demonstrated in this chat.", kind: "list", includeInPrompt: true },
    { key: "userFacts", label: "User Facts", instruction: "Track neutral, explicit user facts only. No interpretations, fantasies, kinks, opinions, relationship judgments, or emotional reads. Work history, plans, locations, routines, and concrete life details belong here.", kind: "list", includeInPrompt: true },
    { key: "userRead", label: "User Read", instruction: "Track {{char}}'s durable subjective interpretation of {{user}} as short strings only. Not facts. Not objects. Add only if clearly shown by {{char}}'s words, stance, or repeated framing in this chat.", kind: "list", includeInPrompt: true },
    { key: "userLikes", label: "User Likes", instruction: "Track non-intimate user likes directly stated or strongly evidenced in this chat. Sexual fantasies, erotic requests, or kink preferences belong in userIntimatePreferences, not here.", kind: "list", includeInPrompt: true },
    { key: "userDislikes", label: "User Dislikes", instruction: "Track non-intimate user dislikes directly stated or strongly evidenced in this chat. Do not turn existential distress or relationship tension into a dislike unless the user clearly frames it that way.", kind: "list", includeInPrompt: true },
    { key: "lastChatEnded", label: "Last Chat Ended", instruction: "Describe only how the chat actually ended and what should carry into the next one. Do not summarize the whole conversation here.", kind: "object", includeInPrompt: true },
    { key: "keyMoments", label: "Key Moments", instruction: "Only add moments that materially changed trust, vulnerability, future trajectory, or mutual understanding. Do not log ordinary banter or routine sex beats unless they changed something important.", kind: "list", includeInPrompt: true },
    { key: "characterIntimatePreferences", label: "Character Intimate Preferences", instruction: "Track only explicit erotic preferences, desires, requests, or strongly evidenced repeated patterns from this chat. No identity-context carryover. No broad umbrella labels if the transcript supports only narrower acts. No 'would allow it' speculation.", kind: "list", enabled: false, includeInPrompt: false, sensitive: true },
    { key: "userIntimatePreferences", label: "User Intimate Preferences", instruction: "Track only explicit erotic fantasies, desires, requests, or strongly evidenced repeated patterns from this chat. Do not place sexual material in userFacts or userLikes. No broad umbrella labels if the transcript supports only narrower acts.", kind: "list", enabled: false, includeInPrompt: false, sensitive: true },
]
