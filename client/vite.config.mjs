import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Point Vite at the project root so it reads the single shared .env file
  // that also drives the Node server.  All VITE_* variables defined there
  // (VITE_ENABLE_SSH_RUN_COMMAND, VITE_API_BASE_URL,
  // VITE_STATUS_REPORT_REFRESH_INTERVAL_MS) are now picked up correctly
  // both during `vite dev` and `vite build`.
  envDir: '..',
  server: {
    port: 3000,
    // Proxy all /api calls to the Express backend during development
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split vendor libraries into separate chunks for better caching
        // Vite 8 (Rolldown) requires manualChunks as a function
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-router'))
            return 'vendor-react';
          if (id.includes('node_modules/@mui') || id.includes('node_modules/@emotion'))
            return 'vendor-mui';
          if (id.includes('node_modules/@tanstack'))
            return 'vendor-query';
          if (id.includes('node_modules/axios'))
            return 'vendor-axios';
        },
      },
    },
  },
});
