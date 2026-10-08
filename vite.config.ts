import { defineConfig } from 'vite';

export default defineConfig({
  // During `npm run dev`, API and WebSocket calls go to the local Worker (`npm run dev:cloudflare`).
  server: { proxy: { '/api': { target: 'http://127.0.0.1:8787', ws: true } } },
  build: { target: 'es2022', chunkSizeWarningLimit: 650 },
});
