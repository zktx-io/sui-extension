import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const enableSourceMap = process.env.SOURCE_MAP !== 'false';
  const isNode = mode === 'node';
  const outDir = isNode ? './out/node' : './out/web';

  return {
    build: {
      target: 'es2020',
      minify: 'esbuild',
      sourcemap: enableSourceMap,
      outDir,
      lib: {
        entry: './src/extension.ts',
        formats: isNode ? ['cjs'] : ['es'],
      },
      rollupOptions: {
        external: ['vscode'],
        output: {
          entryFileNames: 'extension.js',
        },
      },
    },
  };
});
