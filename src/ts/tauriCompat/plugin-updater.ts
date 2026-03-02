type UpdateHandle = {
    version: string;
    downloadAndInstall: () => Promise<void>;
};

export async function check(): Promise<UpdateHandle | null> {
    return null;
}
