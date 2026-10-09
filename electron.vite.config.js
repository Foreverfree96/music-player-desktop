import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  main: {
    build: {
      outDir: 'out/main',
      rollupOptions: {
        external: ['music-metadata']
      }
    }
  },
  preload: {
    build: {
      outDir: 'out/preload',
      lib: {
        entry: path.resolve(__dirname, 'src/main/preload.js')
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    build: {
      outDir: path.resolve(__dirname, 'out/renderer'),
      rollupOptions: {
        input: path.resolve(__dirname, 'src/renderer/index.html')
      }
    },
    plugins: [vue()]
  }
})
