# RisuAI Server-First Storage Refactor (Working Draft)

Last updated: 2026-02-05

## Goal
Run RisuAI as a server (Docker) with multi-client access and **human-readable** data on disk under `/data`. The server is authoritative; clients only read/write through the server API.  
Storage must be per-character, per-chat files, with minimal **robust sync** (ETag/version checks to prevent lost updates).

## Skills To Apply (for future agents)
- `backend-patterns`: REST API design, layering, and server architecture decisions.
- `coding-standards`: general TypeScript/Node best practices for changes.
- `database-migration`: schema versioning + data migration guidance (conceptual only).

Use these only as needed:
- `resolve-conflicts`: when merge conflicts appear.
- `validating-cors-policies`: if/when we audit or change CORS policy.

## Non-Goals (for now)
- Full SillyTavern format compatibility (nice-to-have later).
- Advanced merge logic (event sourcing, per-message diffing).
- Offline-first client mode.

## Constraints
- Multi-client access; last-write-wins is unacceptable.
- Minimal robust sync is required (server rejects stale writes).
- No backward compatibility with `database.bin` required.

---

## Proposed Filesystem Layout (Under `/data`)

```
/data
  /users
    /default
      settings.json
      secrets.json
      /characters
        /{charId}
          character.json
          avatar.png
          /expressions
            {name}.png
          /chats
            {chatId}.json
      /assets
        /backgrounds
          {id}.{ext}
        /generated
          {id}.{ext}
        /other
          {id}.{ext}
      /plugins
        manifest.json
        {pluginName}.js
      /prompts
        {promptId}.json
      /themes
        {themeId}.json
      /color_schemes
        {schemeId}.json
      /backups
        /{timestamp}
          ...
```

Notes:
- **Per-character** and **per-chat** files.
- Assets referenced by relative paths in JSON.
- Everything human-readable JSON.

---

## Minimal Robust Sync (Required)

### Per-file versioning
Each JSON file includes:
```json
{
  "version": 1,
  "updatedAt": 0,
  "data": { ... }
}
```

### Write protocol (ETag)
- Server returns `ETag` header per resource (hash of content or version).
- Client sends `If-Match: <etag>` on PUT/DELETE.
- If mismatch, server returns `409 Conflict` with latest data.

### Why this is required
Prevents silent data loss when multiple clients write the same resource.

---

## Draft Schemas

### `settings.json`
```json
{
  "version": 1,
  "updatedAt": 0,
  "data": {
    "...": "all non-character, non-chat DB fields"
  }
}
```

### `secrets.json`
```json
{
  "version": 1,
  "updatedAt": 0,
  "data": {
    "...": "all API keys, tokens, and secrets"
  }
}
```

### `character.json`
```json
{
  "version": 1,
  "updatedAt": 0,
  "character": {
    "type": "character",
    "chaId": "uuid",
    "name": "Name",
    "desc": "",
    "firstMessage": "",
    "image": "avatar.png",
    "emotionImages": [
      ["happy", "expressions/happy.png"]
    ],
    "additionalAssets": [
      ["title", "assets/other/title.png", "png"]
    ],
    "globalLore": [],
    "customscript": [],
    "triggerscript": [],
    "chatFolders": [],
    "chatPage": 0,
    "...": "all other character fields"
  }
}
```

### `chat.json`
```json
{
  "version": 1,
  "updatedAt": 0,
  "chat": {
    "id": "uuid",
    "name": "Chat Name",
    "note": "",
    "message": [
      {
        "role": "user",
        "data": "hello",
        "time": 0,
        "attachments": [
          {
            "type": "image",
            "inlayId": "assets/generated/abc123.png",
            "source": "asset"
          }
        ]
      }
    ],
    "localLore": [],
    "modules": [],
    "scriptstate": {},
    "...": "all other chat fields"
  }
}
```

---

## Server API (New)

### Contract (Authoritative)

**Headers**
- `ETag`: returned on all GET responses for versioned resources.
- `If-Match`: required on PUT/DELETE for versioned resources.

**Responses**
- `200 OK` on GET/PUT (returns JSON body + `ETag`).
- `201 Created` on POST (returns JSON body + `ETag`).
- `204 No Content` on successful DELETE (may return `ETag` of last version if needed).
- `400 Bad Request` for invalid JSON or schema.
- `404 Not Found` for missing resource.
- `409 Conflict` when `If-Match` does not match current `ETag` (must return latest data).
- `412 Precondition Failed` if `If-Match` is missing on a versioned PUT/DELETE.

**Conflict body**
```json
{
  "error": "ETAG_MISMATCH",
  "message": "Stale write rejected. Fetch latest and retry.",
  "latest": { ...resource... }
}
```

### API Shapes (Request/Response)

**Resource envelope (versioned JSON)**
```json
{
  "version": 1,
  "updatedAt": 0,
  "data": { }
}
```

**Settings**
- `GET /data/settings` → returns settings envelope
- `PUT /data/settings` (body: settings envelope) → returns updated envelope

**Character**
- `GET /data/characters/:id` → returns character envelope
- `PUT /data/characters/:id` (body: character envelope) → returns updated envelope
- `POST /data/characters` (body: character envelope) → returns created envelope

**Chat**
- `GET /data/characters/:id/chats/:chatId` → returns chat envelope
- `PUT /data/characters/:id/chats/:chatId` (body: chat envelope) → returns updated envelope
- `POST /data/characters/:id/chats` (body: chat envelope) → returns created envelope

**List responses**
- `GET /data/characters` → `[{ "id": "...", "name": "...", "updatedAt": 0 }]`
- `GET /data/characters/:id/chats` → `[{ "id": "...", "name": "...", "updatedAt": 0 }]`

**Assets**
- `POST /data/assets` → `{"path": "assets/other/<id>.<ext>"}`
- `GET /data/assets/*` → raw file bytes

**Plugins / Prompts / Themes / Color Schemes**
- JSON envelopes follow the same `{ version, updatedAt, data }` shape.

### Core
- `GET /data/settings`
- `PUT /data/settings`

### Characters
- `GET /data/characters`
- `POST /data/characters`
- `GET /data/characters/:id`
- `PUT /data/characters/:id`
- `DELETE /data/characters/:id`

### Chats (per character)
- `GET /data/characters/:id/chats`
- `POST /data/characters/:id/chats`
- `GET /data/characters/:id/chats/:chatId`
- `PUT /data/characters/:id/chats/:chatId`
- `DELETE /data/characters/:id/chats/:chatId`

### Assets
- `POST /data/assets` (upload, returns relative path)
- `GET /data/assets/*` (serve file)

### Plugins
- `GET /data/plugins/manifest`
- `PUT /data/plugins/manifest`
- `GET /data/plugins/:name`
- `PUT /data/plugins/:name`
- `DELETE /data/plugins/:name`

### Prompts/Themes/Color Schemes
- `GET/PUT/DELETE /data/prompts/:id`
- `GET/PUT/DELETE /data/themes/:id`
- `GET/PUT/DELETE /data/color_schemes/:id`

---

## Client Changes (High Level)

1. Replace `AutoStorage` and `NodeStorage` for all persistence.
2. Implement `ServerStorage` that:
   - Uses REST API.
   - Manages `ETag` and retries on conflicts.
3. Replace direct calls to:
   - `saveDb`, `loadDb`
   - `saveAsset`, `loadAsset`, `getFileSrc`
   - plugin storage

---

## Migration Plan

Since backward compatibility is not required:
1. Export current in-memory DB into new `/data` structure.
2. Generate per-character and per-chat JSON files.
3. Copy assets into `/data/assets/...`
4. Start using server storage only.

---

## Field-by-Field Mapping (Draft)

All paths are under `/data/users/default/` unless stated otherwise.

Source of truth for fields: `src/ts/storage/database.svelte.ts` (`Database`, `character`, `groupChat`, `Chat`, `Message` interfaces).

### Database -> `settings.json` (non-secret fields)
```
apiType
mainPrompt
jailbreak
globalNote
temperature
askRemoval
maxContext
maxResponse
frequencyPenalty
PresensePenalty
formatingOrder
aiModel
jailbreakToggle
loreBookDepth
loreBookToken
cipherChat
loreBook
loreBookPage
supaMemoryPrompt
username
userIcon
userNote
additionalPrompt
descriptionPrefix
forceReplaceUrl
language
translator
plugins
currentPluginProvider
zoomsize
customBackground
textgenWebUIStreamURL
textgenWebUIBlockingURL
autoTranslate
fullScreen
playMessage
iconsize
theme
subModel
emotionPrompt
formatversion
waifuWidth
waifuWidth2
botPresets
botPresetsId
sdProvider
webUiUrl
sdSteps
sdCFG
sdConfig
NAIImgUrl
NAIImgModel
NAII2I
NAIREF
NAIImgConfig
ttsAutoSpeech
promptPreprocess
bias
swipe
instantRemove
textTheme
customTextTheme
requestRetrys
emotionPrompt2
useSayNothing
didFirstSetup
showUnrecommended
voicevoxUrl
useExperimental
showMemoryLimit
roundIcons
useStreaming
supaModelType
textScreenColor
textBorder
textScreenRounded
textScreenBorder
characterOrder
hordeConfig
novelai
globalscript
sendWithEnter
fixedChatTextarea
clickToEdit
koboldURL
useAutoSuggestions
autoSuggestPrompt
autoSuggestPrefix
autoSuggestClean
useChatCopy
novellistAPI
useAutoTranslateInput
imageCompression
classicMaxWidth
useChatSticker
useAdditionalAssetsPreview
usePlainFetch
hypaMemory
hypav2
memoryAlgorithmType
proxyRequestModel
ooba
ainconfig
personaPrompt
openrouterRequestModel
openrouterSubRequestModel
openrouterMiddleOut
openrouterFallback
selectedPersona
personas
personaNote
assetWidth
animationSpeed
botSettingAtStart
NAIsettings
hideRealm
colorScheme
colorSchemeName
promptTemplate
forceProxyAsOpenAI
hypaModel
saveTime
mancerHeader
emotionProcesser
showMenuChatList
translatorType
translatorInputLanguage
htmlTranslation
NAIadventure
NAIappendName
deeplOptions
deeplXOptions
localStopStrings
autofillRequestUrl
customProxyRequestModel
generationSeed
newOAIHandle
gptVisionQuality
reverseProxyOobaMode
reverseProxyOobaArgs
allowAllExtentionFiles
translatorPrompt
translatorMaxResponse
top_p
google
google.projectId
chainOfThought
genTime
promptSettings
keiServerURL
top_k
repetition_penalty
min_p
top_a
claudeAws
lastPatchNoteCheckVersion
removePunctuationHypa
memoryLimitThickness
modules
enabledModules
sideMenuRerollButton
requestInfoInsideChat
additionalParams
heightMode
noWaitForTranslate
antiClaudeOverload
maxSupaChunkSize
ollamaURL
ollamaModel
autoContinueChat
autoContinueMinTokens
removeIncompleteResponse
customTokenizer
instructChatTemplate
JinjaTemplate
openrouterProvider
useInstructPrompt
hanuraiTokens
hanuraiSplit
hanuraiEnable
textAreaSize
sideBarSize
textAreaTextSize
combineTranslation
dynamicAssets
dynamicAssetsEditDisplay
customPromptTemplateToggle
globalChatVariables
templateDefaultVariables
hypaAllocatedTokens
hypaChunkSize
goCharacterOnImport
dallEQuality
font
customFont
lineHeight
stabilityModel
stabllityStyle
falModel
falLora
falLoraName
falLoraScale
legacyTranslation
comfyConfig
comfyUiUrl
useLegacyGUI
claudeCachingExperimental
hideApiKey
unformatQuotes
enableDevTools
moduleIntergration
customCSS
betaMobileGUI
jsonSchemaEnabled
jsonSchema
strictJsonSchema
extractJson
statics
customQuotes
customQuotesData
groupTemplate
groupOtherBotRole
customGUI
guiHTML
OAIPrediction
customAPIFormat
systemContentReplacement
systemRoleReplacement
vertexClientEmail
vertexAccessTokenExpires
vertexRegion
seperateParametersEnabled
seperateParameters
translateBeforeHTMLFormatting
autoTranslateCachedOnly
lightningRealmImport
notification
customFlags
enableCustomFlags
googleClaudeTokenizing
presetChain
legacyMediaFindings
geminiStream
assetMaxDifference
menuSideBar
pluginV2
showSavingIcon
presetRegex
banCharacterset
showPromptComparison
hypaV3
hypaV3Settings
hypaV3Presets
hypaV3PresetId
realmDirectOpen
inlayErrorResponse
reasoningEffort
bulkEnabling
showTranslationLoading
showDeprecatedTriggerV1
showDeprecatedTriggerV2
returnCSSError
useExperimentalGoogleTranslator
thinkingTokens
antiServerOverloads
hypaCustomSettings
localActivationInGlobalLorebook
showFolderName
automaticCachePoint
chatCompression
claudeRetrivalCaching
outputImageModal
playMessageOnTranslateEnd
seperateModelsForAxModels
seperateModels
doNotChangeSeperateModels
modelTools
hotkeys
fallbackModels
doNotChangeFallbackModels
fallbackWhenBlankResponse
customModels
igpPrompt
useTokenizerCaching
showMenuHypaMemoryModal
authRefreshes
authRefreshes.url
authRefreshes.tokenUrl
authRefreshes.clientId
promptInfoInsideChat
promptTextInfoInsideChat
claudeBatching
claude1HourCaching
rememberToolUsage
simplifiedToolUse
requestLocation
newImageHandlingBeta
showFirstMessagePages
streamGeminiThoughts
verbosity
dynamicOutput
hubServerType
pluginCustomStorage
ImagenModel
ImagenImageSize
ImagenAspectRatio
ImagenPersonGeneration
enableScrollToActiveChar
openaiCompatImage
openaiCompatImage.size
openaiCompatImage.quality
sourcemapTranslate
settingsCloseButtonSize
promptDiffPrefs
enableBookmark
hideAllImages
autoScrollToNewMessage
alwaysScrollToNewMessage
newMessageButtonStyle
pluginDevelopMode
echoMessage
echoDelay
createFolderOnBranch
hypaV3Debug
account.id
account.useSync
account.kei
```

### Mapping Validation (Reconciled)

The previously reported unmapped tokens are resolved as **nested fields** or **non-settings storage**. Notes below show where they live:

- `characters` → stored as per-character files under `/characters/{charId}/character.json`.
- `FontColor*` → `customTextTheme.*` (settings).
- `accessToken` / `projectId` → `google.*` (accessToken is secret; projectId is settings).
- `refresh_token` / `access_token` / `expires_in` → `account.data.*` (secrets).
- `clientId` / `clientSecret` / `tokenUrl` / `refreshToken` / `url` → `authRefreshes.*` (clientSecret/refreshToken are secrets).
- `falModel` / `falLora` / `falLoraName` / `falLoraScale` → settings.
- `openaiCompatImage.size` / `openaiCompatImage.quality` → settings.
- `statics.messages` / `statics.imports` → `statics` (settings).
- `hypaV3Debug.*` (timestamp, prompt, formatted, periodic, etc.) → `hypaV3Debug` (settings).
- `customModels.*` (id, internalId, url, format, tokenizer, key, name, params, flags) → `customModels[]` (settings).
- `personas.*` (name, icon, note, largePortrait, id) → `personas[]` (settings).
- `openrouterProvider.order/only/ignore` → `openrouterProvider` (settings).
- `seperateParameters.*` (memory/emotion/translate/otherAx) → `seperateParameters` (settings).
- `fallbackModels.*` → `fallbackModels` (settings).
- `seperateModels.*` → `seperateModels` (settings).

### Database -> `secrets.json` (API keys, tokens, credentials)
```
openAIKey
proxyKey
NAIApiKey
elevenLabKey
supaMemoryKey
hypaMemoryKey
claudeAPIKey
openrouterKey
huggingfaceKey
fishSpeechKey
mistralKey
cohereAPIKey
stabilityKey
falToken
vertexPrivateKey
vertexAccessToken
OaiCompAPIKeys
google.accessToken
openaiCompatImage.key
openaiCompatImage.url
openaiCompatImage.model
novelai.token
account.token
account.data.refresh_token
account.data.access_token
account.data.expires_in
deeplOptions.key
deeplXOptions.token
authRefreshes.refreshToken
authRefreshes.clientSecret
openrouterRequestModel
openrouterSubRequestModel
proxyRequestModel
customProxyRequestModel
```

### Character -> `/characters/{charId}/character.json`
```
All fields from `character` or `groupChat` except:
- `image` -> `avatar.png`
- `emotionImages` -> files in `/expressions`
- `additionalAssets` -> files in `/assets/other`
```

### Chat -> `/characters/{charId}/chats/{chatId}.json`
```
All fields from `Chat`, including `message` list.
```

### Message -> `/characters/{charId}/chats/{chatId}.json`
```
All fields from `Message`, including `attachments`.
```

### Plugins -> `/plugins`
```
manifest.json: enabled state + metadata
{pluginName}.js: plugin source
```

### Prompts/Themes/Color Schemes
```
/prompts/{promptId}.json
/themes/{themeId}.json
/color_schemes/{schemeId}.json
```

---

## Testing

1. Two clients editing same chat:
   - Ensure stale client receives `409` and reloads.
2. Create, edit, delete:
   - Characters
   - Chats
   - Assets
3. Restart server → ensure data loads correctly.

### Minimal Integration Script

Add a small script to exercise the API:
- Settings ETag flow (create, update, conflict)
- Characters + Chats CRUD
- Assets upload + GET
- Prompts/Themes/Color Schemes CRUD

---

## Risks
- Hidden storage writes in UI logic.
- Schema drift if fields are missed.
- Large refactor touches many files.

---

## Next Steps
1. Field-by-field mapping from `Database`, `character`, `chat`, `message`.
2. Implement server API endpoints.
3. Implement `ServerStorage` client adapter.
4. Add migration/export tool.

---

## Context (Latest Summary)
- Goal: server-authoritative RisuAI with human-readable filesystem under `/data/users/default`.
- Per-character folders and per-chat files; group chats treated as character entities.
- Plugins: `plugins/manifest.json` + `{plugin}.js`.
- Secrets separated into `secrets.json`.
- Minimal robust sync required: ETag/If-Match with `409 Conflict` on stale writes.
- Full field-by-field mapping added to this doc.
