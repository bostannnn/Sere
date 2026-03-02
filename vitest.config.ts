import { svelte } from "@sveltejs/vite-plugin-svelte"
import { defineConfig, configDefaults } from 'vitest/config'

export default defineConfig({
  plugins: [
    svelte(),
  ],
  resolve: {
    alias: {
      src: '/src',
    },
    conditions: ['browser'],
  },
  define: {
    __RISU_DEV_NODE_SERVER__: JSON.stringify(false),
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['vitest.setup.ts'],
    exclude: [...configDefaults.exclude, '**/.claude/**'],
  },
})
