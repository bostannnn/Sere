export async function fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    return await globalThis.fetch(input, init);
}
