// vite.config.ts
import { defineConfig } from 'vite';
import copy from 'rollup-plugin-copy';

export default defineConfig(({ mode }) => {
  const enableSourceMap = process.env.SOURCE_MAP !== 'false';
  const isNode = mode === 'node';
  const outDir = isNode ? './out/node' : './out/web';

  const stripWorkshopPrefix = (p: string) =>
    p.replace(/\\/g, '/').replace(/(^|.*\/)src\/commands\/workshop\//, '');

  return {
    build: {
      target: 'es2020',
      minify: 'esbuild',
      sourcemap: enableSourceMap,
      outDir,
      emptyOutDir: true,
      lib: { entry: './src/extension.ts', formats: isNode ? ['cjs'] : ['es'] },
      rollupOptions: {
        external: ['vscode'],
        output: { entryFileNames: 'extension.js' },
      },
    },
    plugins: [
      copy({
        targets: [
          {
            src: 'src/commands/workshop/**/*.zip',
            dest: `${outDir}/assets/workshop`,
            rename: (_name, _ext, fullPath) => stripWorkshopPrefix(fullPath),
          },
        ],
        hook: 'writeBundle',
        flatten: true, // use ONLY what rename() returns
        verbose: true,
      }),
    ],
  };
});
