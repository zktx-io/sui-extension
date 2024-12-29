import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vite.dev/config/
export default defineConfig(() => {
  const enableSourceMap = process.env.SOURCE_MAP !== 'false';
  return {
    plugins: [react()],
    build: {
      minify: true,
      sourcemap: enableSourceMap,
      rollupOptions: {
        output: {
          entryFileNames: 'main.js',
          chunkFileNames: 'chunks/[name].js',
          assetFileNames: 'assets/[name].[ext]',
        },
      },
    },
  };
});
