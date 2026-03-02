import { defineConfig } from "vite";
import { svelte, vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import wasm from "vite-plugin-wasm";
import strip from '@rollup/plugin-strip';
import tailwindcss from '@tailwindcss/vite'
// https://vitejs.dev/config/
export default defineConfig(({command}) => {
  const isDebugBuild = process.env.VITE_DEBUG === '1';
  return {
    plugins: [
      svelte({
        preprocess: vitePreprocess(),
        onwarn: (warning, handler) => {
          // disable a11y warnings
          if (warning.code.startsWith("a11y-")) return;
          handler(warning);
        },
      }),
      tailwindcss(),
      wasm(),
      command === 'build' ? strip({
        include: '**/*.(mjs|js|svelte|ts)'
      }) : null
    ],
    // Keep logs visible in terminal during dev.
    clearScreen: false,
    server: {
      host: '0.0.0.0', // listen on all addresses
      port: 5174,
      strictPort: true,
      cors: {
        origin: '*',
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['risu-url', 'risu-header', 'risu-auth', 'content-type', 'x-risu-tk', 'risu-location'],
      },
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      proxy: {
        '/data': {
          target: 'http://localhost:6001',
          changeOrigin: true,
          rewrite: (path) => path,
          // Large PDF ingestion/embedding can run for several minutes.
          timeout: 1000 * 60 * 30,
          proxyTimeout: 1000 * 60 * 30,
        },
      }
      // hmr: false,
    },
    envPrefix: ["VITE_"],
    build: {
      target:'baseline-widely-available',
      minify: isDebugBuild ? false : 'esbuild',
      sourcemap: isDebugBuild,
      // Lower limit so genuinely large chunks are visible again.
      // The previous 2000 kB ceiling was masking bundle size growth.
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          // Split stable vendor code into separate cacheable chunks.
          // Because these deps change far less often than app code, browsers
          // can serve them from cache across deploys even when the main bundle
          // fingerprint changes.
          manualChunks: {
            'vendor-svelte': ['svelte'],
            'vendor-icons': ['@lucide/svelte'],
            'vendor-hljs': ['highlight.js'],
          },
        },
      },
    },
    
    optimizeDeps:{
      exclude: [
        "@browsermt/bergamot-translator",
        "JSZip"
      ],
      entries: [
        "src/main.ts"
      ],
      needsInterop:[
        "@mlc-ai/web-tokenizers"
      ]
    },

    resolve:{
      alias:{
        'src':'/src',
      }
    },
    worker: {
      format: 'es'
    }
}
});
