declare module "@browsermt/bergamot-translator" {
    export class TranslatorBacking {
        constructor(options?: unknown);
        loadModelRegistery(): Promise<Array<{
            from: string;
            to: string;
            files: Record<string, {
                name: string;
                modelType: string;
            }>;
        }>>;
    }

    export class LatencyOptimisedTranslator {
        constructor(options?: unknown, backing?: TranslatorBacking);
        translate(input: {
            from: string;
            to: string;
            text: string;
            html?: boolean | null;
        }): Promise<{
            target: {
                text: string;
            };
        }>;
    }
}
