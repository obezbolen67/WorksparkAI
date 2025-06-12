import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
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
