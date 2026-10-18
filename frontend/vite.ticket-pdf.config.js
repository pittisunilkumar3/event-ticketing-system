import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  ssr: { noExternal: true },
  build: {
    ssr: 'src/pdf/ticketDocument.jsx',
    outDir: '../backend/generated',
    emptyOutDir: false,
    minify: true,
    rolldownOptions: { output: { format: 'cjs', entryFileNames: 'ticketDocument.cjs' } },
  },
});
