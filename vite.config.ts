
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  // Fix: Cast process to any to avoid "Property 'cwd' does not exist on type 'Process'" if node types are missing
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
          secure: false,
          ws: true,
        }
      }
    },
    plugins: [react()],
    define: {
      // Expose the GEMINI_API_KEY safely to the client-side code as empty string to prevent accidental exposure but satisfy types
      'process.env.GEMINI_API_KEY': JSON.stringify(''),
    },
    build: {
      outDir: 'dist',
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html')
        },
        // Fix: Externalize html2canvas since it is loaded via importmap in index.html
        external: ['html2canvas'],
        output: {
          entryFileNames: `assets/[name].[hash].js`,
          chunkFileNames: `assets/[name].[hash].js`,
          assetFileNames: `assets/[name].[hash].[ext]`
        }
      }
    }
  }
})
