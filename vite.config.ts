import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
      dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'lucide-react',
        'motion/react',
        'xlsx',
      ],
      force: true,
    },
    build: {
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          // Split heavy libraries into their own cacheable chunks
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) return 'vendor-react';
            if (id.includes('/motion') || id.includes('/framer-motion/')) return 'vendor-motion';
            if (id.includes('/xlsx/')) return 'vendor-xlsx';
            if (id.includes('/lucide-react/')) return 'vendor-icons';
            return undefined;
          },
        },
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
