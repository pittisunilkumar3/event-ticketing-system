import {readFileSync} from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss(), {
    name:'early-public-data',
    transformIndexHtml: {order:'post', handler(html) {
      const script=readFileSync(new URL('./public/early-data.js',import.meta.url),'utf8');
      return html.replace('<title>', '<script>'+script+'</script>\n<title>');
    }},
  }],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5001',
      '/uploads': 'http://localhost:5001',
    },
  },
});
