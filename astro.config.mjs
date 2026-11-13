import { defineConfig } from 'astro/config';

// DEPLOY=pages → GitHub Pages (yak1to.github.io/ugol361), иначе корень (Vercel / свой домен)
const pages = process.env.DEPLOY === 'pages';

export default defineConfig({
  site: pages ? 'https://yak1to.github.io' : 'https://ugol361-alpha.vercel.app',
  base: pages ? '/ugol361' : '/',
  trailingSlash: 'ignore',
  devToolbar: { enabled: false },
  build: { inlineStylesheets: 'always' },
  server: { port: 4321, host: '127.0.0.1' },
  vite: { server: { watch: { ignored: ['**/.agents/**', '**/.claude/**', '**/docs/**', '**/.playwright-mcp/**'] } } },
});
