import { env } from './env.ts';
import { handleUpdate } from './bot.ts';

/** Вебхук Telegram на Vercel: POST /api/telegram */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(200).send('ugol361 bot ok');
  // Telegram подписывает запросы секретом, заданным в setWebhook
  if (req.headers['x-telegram-bot-api-secret-token'] !== env.webhookSecret) return res.status(401).send('nope');
  try {
    const update = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    await handleUpdate(update);
  } catch (e) {
    console.error(e);
  }
  // всегда 200: иначе Telegram будет повторять одно и то же сообщение
  res.status(200).send('ok');
}
