// Собираем бота в один файл api/telegram.js — Vercel запускает его как функцию
import { build } from 'esbuild';
await build({
  entryPoints: ['src/handler.ts'],
  outfile: 'api/telegram.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  banner: { js: '// Собрано из bot/src — правьте исходники, потом `node build.mjs`' },
});
console.log('api/telegram.js собран');
