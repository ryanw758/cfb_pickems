import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/cfb_pickems/',
  plugins: [react()],
  server: {
    port: 5173,
  },
});
