import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev proxy: same-origin /api avoids CORS during local dev.
// Production: set VITE_API_BASE to the deployed API origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true
      }
    }
  }
});
