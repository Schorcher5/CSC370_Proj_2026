import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// API_PROXY_TARGET differs between "running locally" (the API is on
// localhost) and "running in Docker" (the API is only reachable by its
// service name on the compose network) -- see docker-compose.yml, which
// sets this to http://demography_api:3000 for the frontend container.
const apiTarget = process.env.API_PROXY_TARGET || 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
});
