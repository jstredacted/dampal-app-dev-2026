import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The proxy forwards /auth/* to the Auth Server and /api/* to the Blog Server.
// The browser only ever talks to this one address, so no CORS setup is needed
// and the httpOnly refresh-token cookie is sent automatically.
const proxy = {
  '/auth': {
    target: 'http://127.0.0.1:4000',
    rewrite: (path) => path.replace(/^\/auth/, ''),
  },
  '/api': 'http://127.0.0.1:5000',
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 5180 instead of Vite's default 5173, so it does not clash with other Vite projects
  server: { host: '127.0.0.1', port: 5180, strictPort: true, proxy },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true, proxy },
})
