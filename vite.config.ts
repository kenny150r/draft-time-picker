import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const root = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  base: '/draft-time-picker/',
  build: {
    cssMinify: false,
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        sheet: resolve(root, 'sheet.html'),
      },
    },
  },
})
