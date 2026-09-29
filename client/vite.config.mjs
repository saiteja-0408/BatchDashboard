import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
          if (id.includes('node_modules/recharts'))
            return 'vendor-recharts';
          if (id.includes('node_modules/axios'))
            return 'vendor-axios';
        },
      },
    },
  },
});
