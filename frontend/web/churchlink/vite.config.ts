import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const apiHost = env.VITE_API_HOST
  const allowedHosts = (env.VITE_ALLOWED_HOSTS || 'localhost')
    .split(',')
    .map(h => h.trim())

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom"],
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts,
      proxy: {
        '/api': {
          target: apiHost,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '/api'),
        },
      },
    },
    preview: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts,
    },
  }
})
