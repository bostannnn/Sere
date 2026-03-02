//@name Comfy Commander
//@display-name Comfy Commander
//@api 3.0
//@version 1.8.7

(async () => {
    const SETTINGS_KEY = 'templates';
    const CONFIG_KEY = 'config';
    const WORKFLOWS_KEY = 'workflows';

    const getTemplates = async () => {
        const data = await Risuai.pluginStorage.getItem(SETTINGS_KEY);
        return data ? JSON.parse(data) : [];
    };

    const saveTemplates = async (templates) => {
        await Risuai.pluginStorage.setItem(SETTINGS_KEY, JSON.stringify(templates));
    };

    const getWorkflows = async () => {
        const data = await Risuai.pluginStorage.getItem(WORKFLOWS_KEY);
        return data ? JSON.parse(data) : [];
    };

    const saveWorkflows = async (workflows) => {
        await Risuai.pluginStorage.setItem(WORKFLOWS_KEY, JSON.stringify(workflows));
    };

    const getConfig = async () => {
        const data = await Risuai.pluginStorage.getItem(CONFIG_KEY);
        return data
            ? JSON.parse(data)
            : { comfy_url: 'http://127.0.0.1:8188', use_proxy: true, proxy_auth: '', debug: false };
    };

    const saveConfig = async (config) => {
        await Risuai.pluginStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    };

    const getChar = async () => await Risuai.getCharacter();

    let registeredMenuButtons = [];

    const syncMenuButtons = async (templates) => {
        if (registeredMenuButtons.length > 0) {
            for (const id of registeredMenuButtons) {
                try {
                    await Risuai.unregisterUIPart(id);
                } catch {}
            }
            registeredMenuButtons = [];
        }
        for (const t of templates) {
            if (!t.showInMenu) continue;
            const name = (t.buttonName || t.trigger || 'Comfy').trim();
            if (!name) continue;
            try {
                const res = await Risuai.registerButton(
                    { name, icon: '', iconType: 'none', location: 'chat' },
                    () => handleCommand(`/cw ${t.trigger || ''}`)
                );
                if (res?.id) registeredMenuButtons.push(res.id);
            } catch (e) {
                await debugLog('Failed to register chat menu button', e?.message || e);
            }
        }
    };

    const getCharImageBase64 = async () => {
        const char = await getChar();
        if (!char || !char.image) return null;
        try {
            const buffer = await Risuai.readImage(char.image);
            const blob = new Blob([buffer]);
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const res = reader.result;
                    const b64 = res.split(',')[1];
                    resolve(b64);
                };
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.error("Failed to load character image", e);
            return null;
        }
    };

    const stripImageContent = (text) => {
        if (!text) return '';
        let next = text;
        next = next.replace(/!\[[^\]]*]\([^)]+\)/g, '');
        next = next.replace(/{{inlay(?:ed|eddata)?::[^}]+}}/g, '');
        next = next.replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g, '');
        return next.trim();
    };

    const getLastMessage = async () => {
        try {
            const charIndex = await Risuai.getCurrentCharacterIndex();
            const chatIndex = await Risuai.getCurrentChatIndex();
            if (charIndex === -1) return "";
            
            const chat = await Risuai.getChatFromIndex(charIndex, chatIndex);
            if (!chat || !chat.message || chat.message.length === 0) return "";
            
            for (let i = chat.message.length - 1; i >= 0; i--) {
                const msg = chat.message[i];
                if (msg.data && msg.role !== 'system') { 
                    const cleaned = stripImageContent(msg.data);
                    if (cleaned) {
                        return cleaned;
                    }
                }
            }
            return "";
        } catch (e) {
            console.error("Failed to get last message", e);
            return "";
        }
    };

    const getLastCharMessage = async () => {
        const charIdx = await Risuai.getCurrentCharacterIndex();
        const chatIdx = await Risuai.getCurrentChatIndex();
        const chat = await Risuai.getChatFromIndex(charIdx, chatIdx);
        if (!chat || !chat.message) return "";
        for (let i = chat.message.length - 1; i >= 0; i--) {
            if (chat.message[i].role === 'char' && chat.message[i].data) {
                const cleaned = stripImageContent(chat.message[i].data);
                if (cleaned) return cleaned;
            }
        }
        return "";
    };

    const insertMessage = async (text, role = 'user') => {
        const charIdx = await Risuai.getCurrentCharacterIndex();
        const chatIdx = await Risuai.getCurrentChatIndex();
        if (charIdx === -1) {
            throw new Error("No active character/chat.");
        }
        const chat = await Risuai.getChatFromIndex(charIdx, chatIdx);
        if (!chat) {
            throw new Error("Chat not found.");
        }
        if (!Array.isArray(chat.message)) {
            chat.message = [];
        }
        chat.message.push({
            role: role,
            data: text,
            time: Date.now(),
            id: Date.now().toString(36) + Math.random().toString(36).substring(2)
        });
        await Risuai.setChatToIndex(charIdx, chatIdx, chat);
    };

    const terminalLog = async (level, message, data) => {
        try {
            const payload = { plugin: 'comfy_commander', level, message, data };
            await fetch('/data/plugins/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
        } catch {
            // ignore logging failures
        }
    };

    const debugLog = async (message, data) => {
        const cfg = await getConfig();
        if (cfg.debug) {
            console.log('[Comfy Commander]', message, data ?? '');
            await terminalLog('debug', message, data);
        }
    };
    const infoLog = async (message, data) => {
        console.log('[Comfy Commander]', message, data ?? '');
        await terminalLog('info', message, data);
    };

    const cleanupCommandMessages = async () => {
        const charIdx = await Risuai.getCurrentCharacterIndex();
        const chatIdx = await Risuai.getCurrentChatIndex();
        const chat = await Risuai.getChatFromIndex(charIdx, chatIdx);
        if (!chat || !Array.isArray(chat.message)) return;

        // Remove empty user/char messages near the tail (from /cw interception).
        const tailWindow = 6;
        const start = Math.max(0, chat.message.length - tailWindow);
        for (let i = chat.message.length - 1; i >= start; i--) {
            const msg = chat.message[i];
            if ((msg?.role === 'user' || msg?.role === 'char') && (!msg.data || msg.data.trim() === '')) {
                chat.message.splice(i, 1);
            }
        }

        await Risuai.setChatToIndex(charIdx, chatIdx, chat);
    };

    const saveToRisu = async (dataUrl, fileName = '') => {
        const b64 = dataUrl.split(',')[1];
        const binary = atob(b64);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
        if (Risuai.saveInlayAsset) {
            return await Risuai.saveInlayAsset(array, fileName);
        }
        return await Risuai.saveAsset(array, '', fileName);
    };

    const THEME_VARS = [
        '--risu-theme-bgcolor',
        '--risu-theme-darkbg',
        '--risu-theme-borderc',
        '--risu-theme-selected',
        '--risu-theme-textcolor',
        '--risu-theme-textcolor2',
        '--risu-theme-darkborderc',
        '--risu-theme-darkbutton',
        '--risu-theme-draculared',
        '--risu-theme-primary-500',
    ];

    const parseCssVars = (styleText) => {
        const vars = new Map();
        if (!styleText) return vars;
        const parts = styleText.split(';');
        for (const part of parts) {
            const [rawKey, rawVal] = part.split(':');
            if (!rawKey || !rawVal) continue;
            const key = rawKey.trim();
            const val = rawVal.trim();
            if (key.startsWith('--') && val) vars.set(key, val);
        }
        return vars;
    };

    const applyThemeVars = async (iframeDoc) => {
        try {
            const colorSchemes = {
                "default": {
                    bgcolor: "#282a36",
                    darkbg: "#21222c",
                    borderc: "#6272a4",
                    selected: "#44475a",
                    draculared: "#ff5555",
                    textcolor: "#f8f8f2",
                    textcolor2: "#64748b",
                    darkBorderc: "#4b5563",
                    darkbutton: "#374151"
                },
                "dark": {
                    bgcolor: "#1a1a1a",
                    darkbg: "#141414",
                    borderc: "#525252",
                    selected: "#3d3d3d",
                    draculared: "#ff5555",
                    textcolor: "#f5f5f5",
                    textcolor2: "#a3a3a3",
                    darkBorderc: "#404040",
                    darkbutton: "#2e2e2e"
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
                    darkbutton: "#e5e7eb"
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
                    darkbutton: "#b45309"
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
                    darkbutton: "#1f2a48"
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
                    darkbutton: "#2d6a4f"
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
                    darkbutton: "#374151"
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
                    darkbutton: "#d0d0c8"
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
                    darkbutton: "#3e3d32"
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
                    darkbutton: "#374151"
                }
            };

            const db = await Risuai.getDatabase(['colorScheme', 'colorSchemeName']);
            const scheme = db?.colorScheme;
            const schemeName = db?.colorSchemeName;
            if (scheme) {
                iframeDoc.documentElement.style.setProperty('--risu-theme-bgcolor', scheme.bgcolor);
                iframeDoc.documentElement.style.setProperty('--risu-theme-darkbg', scheme.darkbg);
                iframeDoc.documentElement.style.setProperty('--risu-theme-borderc', scheme.borderc);
                iframeDoc.documentElement.style.setProperty('--risu-theme-selected', scheme.selected);
                iframeDoc.documentElement.style.setProperty('--risu-theme-draculared', scheme.draculared);
                iframeDoc.documentElement.style.setProperty('--risu-theme-textcolor', scheme.textcolor);
                iframeDoc.documentElement.style.setProperty('--risu-theme-textcolor2', scheme.textcolor2);
                iframeDoc.documentElement.style.setProperty('--risu-theme-darkborderc', scheme.darkBorderc);
                iframeDoc.documentElement.style.setProperty('--risu-theme-darkbutton', scheme.darkbutton);
            } else if (schemeName && colorSchemes[schemeName]) {
                const fallback = colorSchemes[schemeName];
                iframeDoc.documentElement.style.setProperty('--risu-theme-bgcolor', fallback.bgcolor);
                iframeDoc.documentElement.style.setProperty('--risu-theme-darkbg', fallback.darkbg);
                iframeDoc.documentElement.style.setProperty('--risu-theme-borderc', fallback.borderc);
                iframeDoc.documentElement.style.setProperty('--risu-theme-selected', fallback.selected);
                iframeDoc.documentElement.style.setProperty('--risu-theme-draculared', fallback.draculared);
                iframeDoc.documentElement.style.setProperty('--risu-theme-textcolor', fallback.textcolor);
                iframeDoc.documentElement.style.setProperty('--risu-theme-textcolor2', fallback.textcolor2);
                iframeDoc.documentElement.style.setProperty('--risu-theme-darkborderc', fallback.darkBorderc);
                iframeDoc.documentElement.style.setProperty('--risu-theme-darkbutton', fallback.darkbutton);
            }

            const rootDoc = await Risuai.getRootDocument();
            const rootEl = await rootDoc.querySelector('html');
            const bodyEl = await rootDoc.querySelector('body');
            const vars = new Map();
            if (rootEl) {
                const styleText = await rootEl.getStyleAttribute();
                for (const [k, v] of parseCssVars(styleText)) vars.set(k, v);
            }
            if (bodyEl) {
                const styleText = await bodyEl.getStyleAttribute();
                for (const [k, v] of parseCssVars(styleText)) vars.set(k, v);
            }
            for (const key of THEME_VARS) {
                const value = vars.get(key);
                if (value) iframeDoc.documentElement.style.setProperty(key, value);
            }
        } catch {
            // ignore theme sync failures
        }
    };

    const makeId = () =>
        Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    const escHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    const escTextarea = (value) => escHtml(value).replace(/&lt;\/textarea/gi, '&lt;/textarea');

    const ensureWorkflowStorage = async (templates) => {
        let workflows = await getWorkflows();
        if (!Array.isArray(workflows)) workflows = [];
        let changed = false;

        const findByContent = (workflow) =>
            workflows.find((w) => (w.workflow || '').trim() === (workflow || '').trim());

        for (const t of templates) {
            if (t.workflowId) continue;
            if (!t.workflow) continue;
            let existing = findByContent(t.workflow);
            if (!existing) {
                existing = {
                    id: makeId(),
                    name: (t.trigger || 'Workflow').trim() || 'Workflow',
                    workflow: t.workflow,
                };
                workflows.push(existing);
                changed = true;
            }
            t.workflowId = existing.id;
            changed = true;
        }

        if (changed) {
            await saveWorkflows(workflows);
            await saveTemplates(templates);
        }
        return workflows;
    };

    // --- ComfyUI Interaction ---

    const safeFetch = async (url, options) => {
        const config = await getConfig();
        const useProxy = config.use_proxy;
        
        if (useProxy) {
            let parsedUrl;
            try {
                parsedUrl = new URL(url);
            } catch {
                throw new Error(`Invalid Comfy URL: ${url}`);
            }
            const comfyPath = parsedUrl.pathname.replace(/^\/+/, '');
            if (!comfyPath) {
                throw new Error(`Invalid Comfy path: ${url}`);
            }
            const proxyUrl = `/data/integrations/comfy/${comfyPath}${parsedUrl.search}`;
            
            const method = options.method || 'GET';
            
            const headers = {
                'x-risu-comfy-base': encodeURIComponent(parsedUrl.origin),
                'x-risu-comfy-headers': encodeURIComponent(JSON.stringify(options.headers || {})),
            };

            const configuredAuth = typeof config.proxy_auth === 'string' ? config.proxy_auth.trim() : '';
            if (configuredAuth) {
                headers['risu-auth'] = configuredAuth;
            }

            const contentType =
                options?.headers?.['Content-Type'] || options?.headers?.['content-type'];
            if (contentType) {
                headers['Content-Type'] = contentType;
            }

            const fetchOptions = {
                method: method,
                headers: headers,
                body: options.body
            };

            const fetchImpl = async (input, init) => {
                if (typeof Risuai !== 'undefined' && typeof Risuai.nativeFetch === 'function') {
                    return await Risuai.nativeFetch(input, init);
                }
                if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
                    return await window.fetch(input, init);
                }
                return await fetch(input, init);
            };
            const res = await fetchImpl(proxyUrl, fetchOptions);
            
            if (!res.ok) {
                // If proxy returns 404/500/502
                let errText = await res.text();
                if (errText.includes("<!DOCTYPE html")) errText = "HTML (Check Vite/Backend)";
                throw new Error(`Proxy Request Failed (Status ${res.status}): ${errText}`);
            }

            return res;

        } else {
            try {
                return await Risuai.nativeFetch(url, options);
            } catch (e) {
                const msg = e.message || e.toString();
                if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("Network error")) {
                    throw new Error("Direct Connection Failed. Enable 'Use Proxy' in Settings.");
                }
                throw e;
            }
        }
    };

    async function generateImage(workflowJSON, positivePrompt, negativePrompt) {
        const config = await getConfig();
        let url = config.comfy_url;
        if (!url) throw new Error("ComfyUI URL not set.");
        if (!url.startsWith('http')) url = 'http://' + url;
        url = url.replace(/\/$/, '');

        let prompt;
        try {
            prompt = JSON.parse(workflowJSON);
        } catch {
            throw new Error("Invalid workflow JSON. Please check your template.");
        }
        const charAvatar = await getCharImageBase64();
        const seed = Math.floor(Math.random() * 1000000000);

        for (const key in prompt) {
            const node = prompt[key];
            if (node.inputs) {
                for (const k in node.inputs) {
                    if (typeof node.inputs[k] === 'string') {
                        node.inputs[k] = node.inputs[k]
                            .replaceAll('{{risu_prompt}}', positivePrompt).replaceAll('%prompt%', positivePrompt)
                            .replaceAll('{{risu_neg}}', negativePrompt).replaceAll('%negative_prompt%', negativePrompt)
                            .replaceAll('%seed%', seed)
                            .replaceAll('%char_avatar%', charAvatar || "");
                    }
                    if (k === 'seed' && (typeof node.inputs[k] === 'number' || node.inputs[k] === '%seed%')) node.inputs[k] = seed;
                }
            }
        }

        await infoLog('Comfy payload', prompt);
        const res = await safeFetch(url + '/prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
        const { prompt_id: id } = await res.json();
        
        let item = null;
        let checks = 0;
        while (!item) {
            if(checks++ > 120) throw new Error("Generation Timeout (2m)");
            await new Promise(r => setTimeout(r, 1000));
            const hRes = await safeFetch(url + '/history', { method: 'GET' });
            item = (await hRes.json())[id];
        }

        const imgInfo = Object.values(item.outputs).flatMap(o => o.images || [])[0];
        if (!imgInfo) {
            throw new Error("No images returned from ComfyUI.");
        }
        const vRes = await safeFetch(url + '/view?' + new URLSearchParams({ filename: imgInfo.filename, subfolder: imgInfo.subfolder, type: imgInfo.type }), { method: 'GET' });
        const blob = await vRes.blob();
        const dataUrl = await new Promise(r => { const rd = new FileReader(); rd.onloadend = () => r(rd.result); rd.readAsDataURL(blob); });
        return { dataUrl, fileName: imgInfo.filename || '' };
    }

    // --- Command Logic ---

    const resolveTemplate = (templates, content) => {
        const rest = content.trim().replace(/^\/(cw|comfy)\s+/i, '');
        const restLower = rest.toLowerCase();
        let best = null;
        for (const tmpl of templates) {
            const trig = (tmpl.trigger || '').trim().toLowerCase();
            if (!trig) continue;
            if (restLower === trig || restLower.startsWith(trig + ' ')) {
                if (!best || trig.length > best.trig.length) {
                    best = { tmpl, trig };
                }
            }
        }
        if (!best) return null;
        const userPrompt = rest.slice(best.trig.length).trim();
        return { template: best.tmpl, userPrompt };
    };

    const cleanLLMOutput = (raw) => {
        if (!raw) return '';
        let text = String(raw);
        text = text.replace(/<\s*thoughts?\s*>[\s\S]*?<\s*\/\s*thoughts?\s*>/gi, '');
        text = text.replace(/<\s*thinking\s*>[\s\S]*?<\s*\/\s*thinking\s*>/gi, '');
        text = text.trim();
        text = text.replace(/^"(.*)"$/, '$1').trim();
        return text;
    };

    const handleCommand = async (content) => {
        const templates = await getTemplates();
        const workflows = await getWorkflows();
        const match = resolveTemplate(templates, content);
        const t = match?.template;
        const userPrompt = match?.userPrompt ?? '';
        if (!t) {
            await Risuai.alertError("No template found.");
            return;
        }

        const char = await getChar();
        const lastMsg = await getLastMessage();
        const lastCharMsg = await getLastCharMessage();

        const prompt = (t.prompt || userPrompt)
            .replaceAll('{{prompt}}', userPrompt).replaceAll('{{char}}', char?.name || 'Char')
            .replaceAll('{{user}}', 'User').replaceAll('{{lastMessage}}', lastMsg)
            .replaceAll('{{lastCharMessage}}', lastCharMsg);

        try {
            await Risuai.setPluginProgress(true, `Comfy Commander: LLM`, 'var(--risu-theme-selected)');
            await infoLog('LLM prompt', prompt);
            const llmRaw = await Risuai.runMainLLM(prompt);
            const finalPrompt = cleanLLMOutput(llmRaw);
            await infoLog('LLM output', finalPrompt);
            if (!finalPrompt) {
                throw new Error("LLM returned empty prompt.");
            }
            await Risuai.setPluginProgress(true, `Comfy Commander: ComfyUI`, 'var(--risu-theme-selected)');
            const negativePrompt = t.negativePrompt || '';
            let workflowJSON = t.workflow || '';
            if (t.workflowId) {
                const w = workflows.find((item) => item.id === t.workflowId);
                if (!w) {
                    throw new Error("Workflow not found. Please select a workflow in settings.");
                }
                workflowJSON = w.workflow || '';
            }
            if (!workflowJSON) {
                throw new Error("Workflow is empty. Please select or add a workflow.");
            }
            const { dataUrl, fileName } = await generateImage(workflowJSON, finalPrompt, negativePrompt);
            await debugLog('Comfy image file', fileName || '(none)');
            await debugLog('Comfy dataUrl prefix', typeof dataUrl === 'string' ? dataUrl.slice(0, 64) : typeof dataUrl);
            const assetId = await saveToRisu(dataUrl, fileName);
            await debugLog('Saved assetId', assetId);
            if (!assetId) {
                throw new Error("Asset save failed (empty id).");
            }
            // Prefer inlay tokens (no base64 stored). Fallback to data URL if inlay API is unavailable.
            if (Risuai.saveInlayAsset) {
                await insertMessage(`{{inlayed::${assetId}}}`, 'char');
            } else {
                await insertMessage(`![](${dataUrl})`, 'char');
            }
            await Risuai.setPluginProgress(false, '');
        } catch (e) { 
            await Risuai.setPluginProgress(false, '');
            await Risuai.alertError("Comfy Error: " + e.message); 
        } finally {
            await cleanupCommandMessages();
        }
    };

    Risuai.registerCommandHandler('cw', async ({ arg }) => {
        if (!arg) {
            await Risuai.alertError("Usage: /cw <trigger> [prompt]");
            return "";
        }
        setTimeout(() => handleCommand(`/cw ${arg}`), 0);
        return "";
    });

    Risuai.registerCommandHandler('comfy', async ({ arg }) => {
        if (!arg) {
            await Risuai.alertError("Usage: /comfy <trigger> [prompt]");
            return "";
        }
        setTimeout(() => handleCommand(`/comfy ${arg}`), 0);
        return "";
    });

    const iconSvg = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 3L5 7l4 4" />
            <path d="M15 21l4-4-4-4" />
            <path d="M5 7h8a4 4 0 010 8H9" />
        </svg>
    `;

    Risuai.registerSetting('Comfy Commander', async () => {
        const iframeDoc = document;
        const ts = await getTemplates();
        const workflows = await ensureWorkflowStorage(ts);
        const cfg = await getConfig();
        let themeSyncId = null;

        const syncWorkflowOptionLabels = (workflowId, name) => {
            const escapedWorkflowId = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
                ? CSS.escape(String(workflowId || ''))
                : String(workflowId || '').replace(/["\\]/g, '\\$&');
            const options = iframeDoc.querySelectorAll(`.wfsel option[value="${escapedWorkflowId}"]`);
            options.forEach((opt) => {
                opt.textContent = name || 'Workflow';
            });
        };

        const updateTemplateSummary = (index) => {
            const target = iframeDoc.querySelector(`.tpl-summary[data-i="${index}"]`);
            if (!target) return;
            const t = ts[index];
            const label = (t.buttonName || t.trigger || 'Template').trim();
            target.textContent = label || 'Template';
        };

        const updateWorkflowSummary = (index) => {
            const target = iframeDoc.querySelector(`.wf-summary[data-i="${index}"]`);
            if (!target) return;
            const w = workflows[index];
            target.textContent = (w?.name || 'Workflow').trim() || 'Workflow';
        };

        await applyThemeVars(iframeDoc);
        themeSyncId = setInterval(() => applyThemeVars(iframeDoc), 1000);
        Risuai.onUnload(() => {
            if (themeSyncId) clearInterval(themeSyncId);
        });
        const render = () => {
            iframeDoc.body.innerHTML = `
                <style>
                    body{background:var(--risu-theme-bgcolor, #1e1e1e);color:var(--risu-theme-textcolor, #fff);font-family:sans-serif;padding:20px}
                    h2,h3{color:var(--risu-theme-textcolor, #fff)}
                    .card{background:var(--risu-theme-darkbg, #2a2a2a);padding:15px;margin-bottom:15px;border-radius:8px;border:1px solid var(--risu-theme-borderc, #444)}
                    label{display:block;margin-top:6px}
                    input,textarea,select{width:100%;padding:10px;margin:5px 0;background:var(--risu-theme-darkbg, #333);border:1px solid var(--risu-theme-borderc, #555);color:var(--risu-theme-textcolor, #fff);border-radius:4px;box-sizing:border-box}
                    button{padding:10px 20px;border:none;border-radius:4px;cursor:pointer;font-weight:bold;margin-top:10px}
                    .save{background:var(--risu-theme-selected, #4CAF50);color:var(--risu-theme-textcolor, #fff)}
                    .add{background:var(--risu-theme-primary-500, var(--risu-theme-selected, #2196F3));color:var(--risu-theme-textcolor, #fff)}
                    .del{background:var(--risu-theme-draculared, #f44336);color:#fff}
                    .close{background:var(--risu-theme-darkbutton, #555);color:var(--risu-theme-textcolor, #fff)}
                    details{border:1px solid var(--risu-theme-borderc, #444);border-radius:8px;background:var(--risu-theme-darkbg, #2a2a2a);margin-top:8px}
                    #workflow-list details:first-child{margin-top:0}
                    #list details:first-child{margin-top:0}
                    summary{cursor:pointer;padding:10px 12px 10px 28px;font-weight:bold;list-style:none;position:relative}
                    summary::-webkit-details-marker{display:none}
                    summary .chev{position:absolute;left:10px;top:50%;transform:translateY(-50%) rotate(0deg);transition:transform 0.12s ease}
                    details[open] summary .chev{transform:rotate(90deg)}
                    .detail-body{padding:0 12px 12px 28px}
                </style>
                <h2>Comfy Commander v1.8.7</h2>
                <div class="card">
                    <h3>Global Config</h3>
                    <label>URL</label>
                    <input id="url" value="${escHtml(cfg.comfy_url)}">
                    <label>Proxy Password</label>
                    <input id="pwa" type="password" value="${escHtml(cfg.proxy_auth || '')}">
                    <label>Proxy</label>
                    <input type="checkbox" id="prx" ${cfg.use_proxy ? 'checked' : ''} style="width:20px;height:20px">
                    <label>Debug Logs</label>
                    <input type="checkbox" id="dbg" ${cfg.debug ? 'checked' : ''} style="width:20px;height:20px">
                    <button class="save" id="svCfg">Save Config</button>
                </div>
                <div class="card">
                    <h3>Workflows</h3>
                    <div style="color:var(--risu-theme-textcolor2, #9aa3b2);font-size:12px;margin-bottom:6px">Tip: click a header to expand/collapse.</div>
                    <div id="workflow-list"></div>
                    <button class="add" id="add-workflow">Add Workflow</button>
                </div>
                <div class="card">
                    <h3>Templates</h3>
                    <div style="color:var(--risu-theme-textcolor2, #9aa3b2);font-size:12px;margin-bottom:6px">Tip: click a header to expand/collapse.</div>
                    <div id="list"></div>
                    <button class="add" id="add">Add Template</button>
                </div>
                <button class="close" id="cls">Close</button>
            `;
            const workflowList = iframeDoc.getElementById('workflow-list');
            workflows.forEach((w, i) => {
                const d = iframeDoc.createElement('details');
                d.open = i === 0;
                d.innerHTML = `
                    <summary><span class="chev">&gt;</span><span class="wf-summary" data-i="${i}">${escHtml(w.name || 'Workflow')}</span></summary>
                    <div class="detail-body">
                        <label>Name</label>
                        <input value="${escHtml(w.name || '')}" data-i="${i}" class="wfname">
                        <label>Workflow JSON</label>
                        <textarea rows="4" data-i="${i}" class="wfflow">${escTextarea(w.workflow || '')}</textarea>
                        <button class="del del-wf" data-i="${i}">Delete Workflow</button>
                    </div>
                `;
                workflowList.appendChild(d);
            });
            const list = iframeDoc.getElementById('list');
            ts.forEach((t, i) => {
                const d = iframeDoc.createElement('details');
                d.open = i === 0;
                const options = workflows.map((w) => `<option value="${escHtml(w.id || '')}" ${t.workflowId === w.id ? 'selected' : ''}>${escHtml(w.name || 'Workflow')}</option>`).join('');
                d.innerHTML = `
                    <summary><span class="chev">&gt;</span><span class="tpl-summary" data-i="${i}">${escHtml(t.buttonName || t.trigger || 'Template')}</span></summary>
                    <div class="detail-body">
                        <label>Trigger</label>
                        <input value="${escHtml(t.trigger || '')}" data-i="${i}" class="trig">
                        <label>Prompt</label>
                        <textarea rows="2" data-i="${i}" class="prm">${escTextarea(t.prompt || '')}</textarea>
                        <label>Negative Prompt</label>
                        <textarea rows="2" data-i="${i}" class="neg">${escTextarea(t.negativePrompt || '')}</textarea>
                        <label>Show in Chat Menu</label>
                        <input type="checkbox" data-i="${i}" class="showmenu" ${t.showInMenu ? 'checked' : ''} style="width:20px;height:20px">
                        <label>Button Name</label>
                        <input value="${escHtml(t.buttonName || '')}" data-i="${i}" class="btnname">
                        <label>Workflow</label>
                        <select data-i="${i}" class="wfsel">
                            <option value="">Select workflow</option>
                            ${options}
                        </select>
                        <button class="del del-tpl" data-i="${i}">Delete</button>
                    </div>
                `;
                list.appendChild(d);
            });
            iframeDoc.querySelectorAll('.trig').forEach(e => e.oninput = (ev) => { ts[ev.target.dataset.i].trigger = ev.target.value; saveTemplates(ts); updateTemplateSummary(ev.target.dataset.i); syncMenuButtons(ts); });
            iframeDoc.querySelectorAll('.prm').forEach(e => e.oninput = (ev) => { ts[ev.target.dataset.i].prompt = ev.target.value; saveTemplates(ts); });
            iframeDoc.querySelectorAll('.neg').forEach(e => e.oninput = (ev) => { ts[ev.target.dataset.i].negativePrompt = ev.target.value; saveTemplates(ts); });
            iframeDoc.querySelectorAll('.showmenu').forEach(e => e.oninput = (ev) => { ts[ev.target.dataset.i].showInMenu = ev.target.checked; saveTemplates(ts); syncMenuButtons(ts); });
            iframeDoc.querySelectorAll('.btnname').forEach(e => e.oninput = (ev) => { ts[ev.target.dataset.i].buttonName = ev.target.value; saveTemplates(ts); syncMenuButtons(ts); updateTemplateSummary(ev.target.dataset.i); });
            iframeDoc.querySelectorAll('.wfsel').forEach(e => e.oninput = (ev) => { ts[ev.target.dataset.i].workflowId = ev.target.value; saveTemplates(ts); });
            iframeDoc.querySelectorAll('.wfname').forEach(e => e.oninput = (ev) => {
                const idx = ev.target.dataset.i;
                workflows[idx].name = ev.target.value;
                saveWorkflows(workflows);
                updateWorkflowSummary(idx);
                syncWorkflowOptionLabels(workflows[idx].id, workflows[idx].name);
            });
            iframeDoc.querySelectorAll('.wfflow').forEach(e => e.oninput = (ev) => { workflows[ev.target.dataset.i].workflow = ev.target.value; saveWorkflows(workflows); });
            iframeDoc.querySelectorAll('.del-tpl').forEach(e => e.onclick = (ev) => { ts.splice(ev.target.dataset.i, 1); saveTemplates(ts); syncMenuButtons(ts); render(); });
            iframeDoc.querySelectorAll('.del-wf').forEach(e => e.onclick = (ev) => {
                const idx = ev.target.dataset.i;
                const removed = workflows[idx];
                workflows.splice(idx, 1);
                if (removed?.id) {
                    ts.forEach((t) => {
                        if (t.workflowId === removed.id) t.workflowId = '';
                    });
                    saveTemplates(ts);
                }
                saveWorkflows(workflows);
                render();
            });
            iframeDoc.getElementById('add-workflow').onclick = () => { workflows.push({ id: makeId(), name: 'Workflow', workflow: '' }); saveWorkflows(workflows); render(); };
            iframeDoc.getElementById('add').onclick = () => { ts.push({trigger:'new',prompt:'',negativePrompt:'',workflowId:'',showInMenu:false,buttonName:''}); saveTemplates(ts); syncMenuButtons(ts); render(); };
            iframeDoc.getElementById('cls').onclick = () => {
                if (themeSyncId) clearInterval(themeSyncId);
                Risuai.hideContainer();
            };
            iframeDoc.getElementById('svCfg').onclick = () => {
                cfg.comfy_url = iframeDoc.getElementById('url').value;
                cfg.use_proxy = iframeDoc.getElementById('prx').checked;
                cfg.proxy_auth = iframeDoc.getElementById('pwa').value;
                cfg.debug = iframeDoc.getElementById('dbg').checked;
                saveConfig(cfg);
                Risuai.alert("Saved!");
            };
        };
        render();
        Risuai.showContainer('fullscreen');
    }, iconSvg, 'html');

    syncMenuButtons(await getTemplates());
    console.log('[Comfy Commander] Initialized v1.8.7');
})();
