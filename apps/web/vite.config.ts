import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// API_PROXY_TARGET is read from process.env (no VITE_ prefix) so it is never inlined.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '^/api/': {
        target: process.env.API_PROXY_TARGET || 'http://localhost:3000',
      },
    },
  },
});
