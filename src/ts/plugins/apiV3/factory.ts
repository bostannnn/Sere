type MsgType =
    | 'CALL_ROOT'
    | 'CALL_INSTANCE'
    | 'INVOKE_CALLBACK'
    | 'CALLBACK_RETURN'
    | 'RESPONSE'
    | 'RELEASE_INSTANCE';

interface RpcMessage {
    type: MsgType;
    reqId?: string;
    id?: string;
    method?: string;
    args?: unknown[];
    result?: unknown;
    error?: string;
    __risuChannel?: string;
}

interface RemoteRef {
    __type: 'REMOTE_REF';
    id: string;
}

interface CallbackRef {
    __type: 'CALLBACK_REF';
    id: string;
}
const factoryLog = (..._args: unknown[]) => {};


const GUEST_BRIDGE_SCRIPT = `
await (async function() {
    const CHANNEL = __RISU_CHANNEL__;
    const PARENT_ORIGIN = __RISU_PARENT_ORIGIN__;
    const pendingRequests = new Map();
    const callbackRegistry = new Map();
    const proxyRefRegistry = new Map();

    function serializeArg(arg) {
        if (typeof arg === 'function') {
            const id = 'cb_' + Math.random().toString(36).substring(2);
            callbackRegistry.set(id, arg);
            return { __type: 'CALLBACK_REF', id: id };
        }
        if (arg && typeof arg === 'object') {
            const refId = proxyRefRegistry.get(arg);
            if (refId) {
                return { __type: 'REMOTE_REF', id: refId };
            }
        }
        return arg;
    }

    function deserializeResult(val) {
        if (val && typeof val === 'object' && val.__type === 'REMOTE_REF') {
            const proxy = new Proxy({}, {
                get: (target, prop) => {
                    if (prop === 'then') return undefined;
                    if (prop === 'release') {
                        return () => send({ type: 'RELEASE_INSTANCE', id: val.id });
                    }
                    return (...args) => sendRequest('CALL_INSTANCE', {
                        id: val.id,
                        method: prop,
                        args: args
                    });
                }
            });
            // Store the mapping so we can serialize it back
            proxyRefRegistry.set(proxy, val.id);
            return proxy;
        }
        if (val && typeof val === 'object' && val.__type === 'CALLBACK_STREAMS') {
            //specialType, one of
            // - Response
            // - none
            const specialType = val.__specialType;
            if (specialType === 'Response') {
                return new Response(val.value, val.init);
            }
            return val.value;
        }
        return val;
    }

    function collectTransferables(obj, transferables = []) {
        if (!obj || typeof obj !== 'object') return transferables;

        if (obj instanceof ArrayBuffer ||
            obj instanceof MessagePort ||
            obj instanceof ImageBitmap ||
            (typeof OffscreenCanvas !== 'undefined' && obj instanceof OffscreenCanvas)) {
            transferables.push(obj);
        }
        else if (ArrayBuffer.isView(obj) && obj.buffer instanceof ArrayBuffer) {
            transferables.push(obj.buffer);
        }
        else if (Array.isArray(obj)) {
            obj.forEach(item => collectTransferables(item, transferables));
        }
        else if (obj.constructor === Object) {
            Object.values(obj).forEach(value => collectTransferables(value, transferables));
        }

        return transferables;
    }

    function send(payload, transferables = []) {
        window.parent.postMessage({ ...payload, __risuChannel: CHANNEL }, PARENT_ORIGIN, transferables);
    }

    function sendRequest(type, payload) {
        return new Promise((resolve, reject) => {
            const reqId = Math.random().toString(36).substring(7);
            pendingRequests.set(reqId, { resolve, reject });


            if (payload.args) {
                payload.args = payload.args.map(serializeArg);
            }

            const message = { type: type, reqId: reqId, ...payload };
            const transferables = collectTransferables(message);
            send(message, transferables);
        });
    }

    
    
    
    window.addEventListener('message', async (event) => {
        if (event.source !== window.parent) return;
        if (event.origin !== PARENT_ORIGIN) return;
        const data = event.data;
        if (!data) return;
        if (data.__risuChannel !== CHANNEL) return;


        if (data.type === 'RESPONSE' && data.reqId) {
            const req = pendingRequests.get(data.reqId);
            if (req) {
                if (data.error) req.reject(new Error(data.error));
                else req.resolve(deserializeResult(data.result));
                pendingRequests.delete(data.reqId);
            }
        }

        else if (data.type === 'INVOKE_CALLBACK' && data.id) {
            const fn = callbackRegistry.get(data.id);
            const response = { type: 'CALLBACK_RETURN', reqId: data.reqId };

            try {
                if (!fn) throw new Error("Callback not found or released");
                const result = await fn(...(data.args || []));
                response.result = result;
            } catch (e) {
                response.error = e.message || "Guest callback error";
            }
            const transferables = collectTransferables(response);
            send(response, transferables);
        }
    });





    const propertyCache = new Map();

    window.risuai = new Proxy({}, {
        get: (target, prop) => {
            if (propertyCache.has(prop)) {
                return propertyCache.get(prop);
            }
            return (...args) => sendRequest('CALL_ROOT', { method: prop, args: args });
        }
    });
    window.Risuai = window.risuai;

    try {
        // Initialize cached properties
        const propsToInit = await window.risuai._getPropertiesForInitialization();
        factoryLog('Initializing risuai properties:', JSON.stringify(propsToInit.list));
        for (let i = 0; i < propsToInit.list.length; i++) {
            const key = propsToInit.list[i];
            const value = propsToInit[key];
            propertyCache.set(key, value);
        }

        // Initialize aliases
        const aliases = await window.risuai._getAliases();
        const aliasKeys = Object.keys(aliases);
        for (let i = 0; i < aliasKeys.length; i++) {
            const aliasKey = aliasKeys[i];
            const childrens = Object.keys(aliases[aliasKey]);
            const aliasObj = {};
            for (let j = 0; j < childrens.length; j++) {
                const childKey = childrens[j];
                aliasObj[childKey] = risuai[aliases[aliasKey][childKey]];
            }
            propertyCache.set(aliasKey, aliasObj);
        }

        // Initialize helper functions defined in the guest

        propertyCache.set('unwarpSafeArray', async (safeArray) => {
            const length = await safeArray.length();
            const result = [];
            for (let i = 0; i < length; i++) {
                const item = await safeArray.at(i);
                result.push(item);
            }
            return result;
        });
    } catch (e) {
        factoryLog('Failed to initialize risuai properties:', e);
    }

    window.initOldApiGlobal = () => {
        const keys = risuai._getOldKeys()
        for(const key of keys){
            window[key] = risuai[key];
        }
    }
})();
`;

export class SandboxHost {
    private iframe: HTMLIFrameElement;
    private apiFactory: Record<string, unknown>;
    private channelId = '';
    private readonly parentOrigin: string;


    private instanceRegistry = new Map<string, unknown>();


    private pendingCallbacks = new Map<string, { resolve: (value: unknown) => void, reject: (reason?: unknown) => void }>();

    constructor(apiFactory: Record<string, unknown>) {
        this.apiFactory = apiFactory;
        this.parentOrigin = window.location.origin;
    }

    public executeInIframe(code: string): Promise<never> {
        return Promise.reject(
            new Error(`executeInIframe is disabled for security. Received code length: ${code?.length ?? 0}.`)
        );
    }

    private collectTransferables(obj: unknown, transferables: Transferable[] = []): Transferable[] {
        if (!obj || typeof obj !== 'object') return transferables;

        if (obj instanceof ArrayBuffer ||
            obj instanceof MessagePort ||
            obj instanceof ImageBitmap ||
            obj instanceof ReadableStream ||
            obj instanceof WritableStream ||
            obj instanceof TransformStream ||
            (typeof OffscreenCanvas !== 'undefined' && obj instanceof OffscreenCanvas)) {
            transferables.push(obj);
        }
        else if (ArrayBuffer.isView(obj) && obj.buffer instanceof ArrayBuffer) {
            transferables.push(obj.buffer);
        }
        else if (Array.isArray(obj)) {
            obj.forEach(item => this.collectTransferables(item, transferables));
        }
        else if (obj.constructor === Object) {
            Object.values(obj).forEach(value => this.collectTransferables(value, transferables));
        }

        return transferables;
    }


    private serialize(val: unknown): unknown {
        const valRecord = (typeof val === 'object' || typeof val === 'function') ? (val as Record<string, unknown>) : null;
        if (
            valRecord &&
            valRecord.__classType === 'REMOTE_REQUIRED'
        ) {
            if (val === null) return null;
            if (Array.isArray(val)) return val;


            const id = 'ref_' + Math.random().toString(36).substring(2);
            this.instanceRegistry.set(id, val);
            return { __type: 'REMOTE_REF', id } as RemoteRef;
        }

        if(val instanceof Response) {
            return {
                __type: 'CALLBACK_STREAMS',
                __specialType: 'Response',
                value: val.body,
                init: {
                    status: val.status,
                    statusText: val.statusText,
                    headers: Array.from(val.headers.entries())
                }
            };
        }

        if(
            val instanceof ReadableStream
            || val instanceof WritableStream
            || val instanceof TransformStream
        ) {
            return {
                __type: 'CALLBACK_STREAMS',
                __specialType: 'none',
                value: val
            };
        }
        return val;
    }


    private deserializeArgs(args: unknown[]) {
        return args.map(arg => {
            const argRef = (arg && typeof arg === 'object') ? (arg as { __type?: string }) : null;
            if (argRef?.__type === 'CALLBACK_REF') {
                const cbRef = arg as CallbackRef;

                return async (...innerArgs: unknown[]) => {
                    return new Promise<unknown>((resolve, reject) => {
                        const reqId = 'cb_req_' + Math.random().toString(36).substring(2);
                        this.pendingCallbacks.set(reqId, { resolve, reject });

                        const message = {
                            type: 'INVOKE_CALLBACK',
                            id: cbRef.id,
                            reqId,
                            args: innerArgs,
                            __risuChannel: this.channelId,
                        };
                        const transferables = this.collectTransferables(message);
                        this.iframe.contentWindow?.postMessage(message, '*', transferables);
                    });
                };
            }
            if (argRef?.__type === 'REMOTE_REF') {
                const remoteRef = arg as RemoteRef;
                const instance = this.instanceRegistry.get(remoteRef.id);
                if (instance) {
                    return instance;
                }
            }
            return arg;
        });
    }

    public run(container: HTMLElement|HTMLIFrameElement, userCode: string) {
        this.channelId = 'risu_' + Math.random().toString(36).slice(2);
        if(container instanceof HTMLIFrameElement) {
            this.iframe = container;
        } else {
            this.iframe = document.createElement('iframe');
            container.appendChild(this.iframe);
        }

        this.iframe.style.width = "100%";
        this.iframe.style.height = "100%";
        this.iframe.style.border = "none";

        this.iframe.style.backgroundColor = "transparent";
        this.iframe.setAttribute('allowTransparency', 'true');

        this.iframe.sandbox.add('allow-scripts');
        this.iframe.sandbox.add('allow-modals')
        this.iframe.sandbox.add('allow-downloads')

        const messageHandler = async (event: MessageEvent) => {
            if (event.source !== this.iframe.contentWindow) return;
            if (event.origin !== 'null' && event.origin !== this.parentOrigin) return;
            const data = event.data as RpcMessage;
            if (!data || data.__risuChannel !== this.channelId) return;


            if (data.type === 'CALLBACK_RETURN') {
                const req = this.pendingCallbacks.get(data.reqId!);
                if (req) {
                    if (data.error) req.reject(new Error(data.error));
                    else req.resolve(data.result);
                    this.pendingCallbacks.delete(data.reqId!);
                }
                return;
            }


            if (data.type === 'RELEASE_INSTANCE') {
                this.instanceRegistry.delete(data.id!);
                return;
            }


            if (data.type === 'CALL_ROOT' || data.type === 'CALL_INSTANCE') {
                const response: RpcMessage = { type: 'RESPONSE', reqId: data.reqId };

                try {

                    const args = this.deserializeArgs(data.args || []);
                    let result: unknown;


                    if (data.type === 'CALL_ROOT') {
                        const fn = this.apiFactory[data.method!];
                        if (typeof fn !== 'function') throw new Error(`API method ${data.method} not found`);
                        result = await fn(...args);
                    } else {
                        const instance = this.instanceRegistry.get(data.id!);
                        if (!instance) throw new Error("Instance not found or released");
                        const methodName = data.method ?? '';
                        const instanceMethod = (instance as Record<string, unknown>)[methodName];
                        if (typeof instanceMethod !== 'function') throw new Error(`Method ${data.method} missing on instance`);
                        result = await instanceMethod(...args);
                    }


                    response.result = this.serialize(result);

                } catch (err: unknown) {
                    response.error = err instanceof Error ? err.message : "Host execution error";
                }

                const transferables = this.collectTransferables(response);
                factoryLog("Original request:", data);
                factoryLog('Original response:', response, transferables);
                try {
                    this.iframe.contentWindow?.postMessage({
                        ...response,
                        __risuChannel: this.channelId,
                    }, '*', transferables);
                } catch (error) {
                    this.iframe.contentWindow?.postMessage({
                        type: 'RESPONSE',
                        reqId: data.reqId,
                        error: 'Failed to post message to iframe: ' + (error as Error).message,
                        __risuChannel: this.channelId,
                    }, '*');
                    factoryLog('Failed to post message to iframe:', error);
                }
            }
        };

        window.addEventListener('message', messageHandler);


        const bridgeScript = GUEST_BRIDGE_SCRIPT
            .replace('__RISU_CHANNEL__', JSON.stringify(this.channelId))
            .replace('__RISU_PARENT_ORIGIN__', JSON.stringify(this.parentOrigin));
        const html = `
      <!DOCTYPE html>
      <html>
      <body>
        <style>
            body {
                background-color: transparent;
            }
        </style>
        <script>
            (async () => {
                ${bridgeScript}
                    
                (async () => {
                    ${userCode}
                })()
            })();
        </script>
      </body>
      </html>
    `;

        this.iframe.srcdoc = html;

        return () => {
            window.removeEventListener('message', messageHandler);
            this.iframe.remove();
            this.instanceRegistry.clear();
            this.pendingCallbacks.clear();
        };
    }

    public terminate() {
        if (this.iframe) {
            this.iframe.remove();
        }
        this.instanceRegistry.clear();
        this.pendingCallbacks.clear();
    }
}
