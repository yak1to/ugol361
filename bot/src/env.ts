// Настройки берутся из переменных окружения Vercel (vercel env add ...)
const need = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Нет переменной окружения ${k}`);
  return v;
};

export const env = {
  get botToken() { return need('BOT_TOKEN'); },
  get ghToken() { return need('GH_TOKEN'); },
  get webhookSecret() { return need('WEBHOOK_SECRET'); },
  siteRepo: process.env.SITE_REPO ?? 'yak1to/ugol361',
  siteBranch: process.env.SITE_BRANCH ?? 'main',
  adminRepo: process.env.ADMIN_REPO ?? 'yak1to/ugol361-admin',
  adminBranch: process.env.ADMIN_BRANCH ?? 'main',
  owner: (process.env.OWNER ?? 'yak1tto').replace(/^@/, '').toLowerCase(),
  siteUrl: process.env.SITE_URL ?? 'https://yak1to.github.io/ugol361/',
};
