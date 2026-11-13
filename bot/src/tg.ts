import { env } from './env.ts';

export type Btn = { text: string; data?: string; url?: string };
export type Kb = Btn[][];

async function call<T = any>(method: string, body: Record<string, unknown>): Promise<T> {
  const r = await fetch(`https://api.telegram.org/bot${env.botToken}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`Telegram ${method}: ${j.description}`);
  return j.result as T;
}

const markup = (kb?: Kb) =>
  kb ? { inline_keyboard: kb.map((row) => row.map((b) => (b.url ? { text: b.text, url: b.url } : { text: b.text, callback_data: b.data }))) } : undefined;

export const esc = (s: string | number) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const tg = {
  send: (chatId: number, html: string, kb?: Kb) =>
    call('sendMessage', { chat_id: chatId, text: html, parse_mode: 'HTML', reply_markup: markup(kb), link_preview_options: { is_disabled: true } }),

  /** Меню «на месте»: правим сообщение с кнопками, чтобы чат не засорялся. */
  edit: async (chatId: number, messageId: number, html: string, kb?: Kb) => {
    try {
      await call('editMessageText', { chat_id: chatId, message_id: messageId, text: html, parse_mode: 'HTML', reply_markup: markup(kb), link_preview_options: { is_disabled: true } });
    } catch (e) {
      // «message is not modified» или сообщение с фото — просто шлём новое
      if (!String(e).includes('not modified')) await tg.send(chatId, html, kb);
    }
  },

  /**
   * Вопрос, на который нужно ответить. Что именно ждём, зашито в скрытую ссылку на первом символе
   * (Telegram возвращает её в reply_to_message.entities) — бот не хранит состояние между сообщениями.
   */
  ask: (chatId: number, key: string, html: string, placeholder = 'Ответ') =>
    call('sendMessage', {
      chat_id: chatId,
      text: `<a href="${ASK_PREFIX}${encodeURIComponent(key)}">✏️</a> ${html}`,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: { force_reply: true, input_field_placeholder: placeholder },
    }),

  photo: (chatId: number, url: string, caption: string, kb?: Kb) =>
    call('sendPhoto', { chat_id: chatId, photo: url, caption, parse_mode: 'HTML', reply_markup: markup(kb) }),

  answer: (callbackId: string, text?: string) => call('answerCallbackQuery', { callback_query_id: callbackId, text }).catch(() => {}),

  fileBytes: async (fileId: string) => {
    const f = await call<{ file_path: string }>('getFile', { file_id: fileId });
    const r = await fetch(`https://api.telegram.org/file/bot${env.botToken}/${f.file_path}`);
    if (!r.ok) throw new Error('Не удалось скачать фото из Telegram');
    return Buffer.from(await r.arrayBuffer());
  },

  call,
};

export const ASK_PREFIX = 'https://ugol361.bot/ask/';

/** Достаём ключ вопроса из сообщения, на которое ответил человек. */
export function askKey(reply: any): string | null {
  for (const e of reply?.entities ?? reply?.caption_entities ?? []) {
    if (e.type === 'text_link' && typeof e.url === 'string' && e.url.startsWith(ASK_PREFIX)) {
      return decodeURIComponent(e.url.slice(ASK_PREFIX.length));
    }
  }
  return null;
}
