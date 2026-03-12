function registerSystemRoutes(arg = {}) {
    const {
        app,
        path,
        fs,
        existsSync,
        htmlparser,
    } = arg;

    app.get('/', async (req, res, next) => {
        const clientIP = req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress || 'Unknown IP';
        const timestamp = new Date().toISOString();
        console.log(`[Server] ${timestamp} | Connection from: ${clientIP}`);

        try {
            const indexPath = path.join(process.cwd(), 'dist', 'index.html');
            if (!existsSync(indexPath)) {
                res.status(200).send(
                    'RisuAI server is running. Build the web client with `pnpm build` or run `pnpm dev` and open the Vite URL.'
                );
                return;
            }
            const mainIndex = await fs.readFile(indexPath);
            const root = htmlparser.parse(mainIndex);
            const head = root.querySelector('head');
            head.innerHTML = `<script>globalThis.__NODE__ = true</script>` + head.innerHTML;

            res.send(root.toString());
        } catch (error) {
            console.log(error);
            next(error);
        }
    });
}

module.exports = {
    registerSystemRoutes,
};
