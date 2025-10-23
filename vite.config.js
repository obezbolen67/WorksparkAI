import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
// https://vitejs.dev/config/
export default defineConfig({
    define: {
        __SYSTEMENV__: JSON.stringify(process.env),
    },
    plugins: [
        react(),
        svgr()
    ],
    server: {
        proxy: {
            // Proxying API requests to avoid CORS issues in development.
            // Any request from the frontend to /api will be forwarded to the backend server.
            '/api': {
                target: 'http://localhost:3001', // Your backend server address
                changeOrigin: true,
            },
        },
    },
});
