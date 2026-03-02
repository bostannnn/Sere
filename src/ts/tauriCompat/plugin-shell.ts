type CommandOptions = {
    env?: Record<string, string>;
};

class UnsupportedChildProcess {
    async write(_data: string): Promise<void> {
        throw new Error('[Server-only] stdio MCP transport is unavailable (desktop runtime removed).');
    }

    kill(): void {
        return;
    }
}

class CommandInstance {
    command: string;
    args: string[];
    options?: CommandOptions;

    stdout = {
        on: (_event: 'data', _handler: (line: string) => void) => undefined,
    };

    constructor(command: string, args: string[] = [], options?: CommandOptions) {
        this.command = command;
        this.args = args;
        this.options = options;
    }

    async spawn(): Promise<UnsupportedChildProcess> {
        throw new Error('[Server-only] stdio MCP transport is unavailable (desktop runtime removed).');
    }
}

export class Command {
    static create(command: string, args: string[] = [], options?: CommandOptions): CommandInstance {
        return new CommandInstance(command, args, options);
    }
}

export async function open(url: string): Promise<void> {
    if (typeof window !== 'undefined' && typeof window.open === 'function') {
        window.open(url, '_blank', 'noopener,noreferrer');
    }
}
