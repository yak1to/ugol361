import { env } from './env.ts';
import { tg, esc, askKey, type Kb } from './tg.ts';
import { readContent, saveContent, photoUrl, rub, PHOTOS_DIR, type Content } from './content.ts';
import { writeFile, deleteFile } from './gh.ts';
import { checkAccess, readAdmins, addAdmin, removeAdmin, userLabel, UserError, type From } from './access.ts';

const SAVED = `Сохранено. Сайт обновится через 1–2 минуты: <a href="${env.siteUrl}">открыть</a>`;
const who = (f: From) => (f.username ? '@' + f.username : String(f.id));
const back = (data: string, text = '← Назад'): Kb => [[{ text, data }]];

const SOCIALS: Record<string, string> = { telegram: 'Telegram', whatsapp: 'WhatsApp', youtube: 'YouTube', max: 'MAX', vk: 'VK', instagram: 'Instagram' };

// ---------- экраны ----------

const mainMenu = (): [string, Kb] => [
  '<b>Угол 361 — управление сайтом</b>\nЧто меняем?',
  [
    [{ text: '💈 Цены и акция', data: 'p' }],
    [{ text: '📅 Ссылка «Записаться»', data: 'bk' }],
    [{ text: '📞 Контакты и адрес', data: 'c' }],
    [{ text: '🖼 Фото работ', data: 'ph' }],
    [{ text: '✂️ Мастера', data: 'br' }],
    [{ text: '⭐ Рейтинг', data: 'rt' }],
    [{ text: '👥 Доступ к боту', data: 'ad' }],
    [{ text: '🌐 Открыть сайт', url: env.siteUrl }],
  ],
];

function pricesMenu(c: Content): [string, Kb] {
  const p = c.prices;
  const lines = p.items.map((i) => `• ${esc(i.name)} — ${rub(i.price)}${i.firstVisit ? ` (в первый раз ${rub(i.firstVisit)})` : ''}`);
  return [
    `<b>Цены</b> (${esc(p.date)})\n${lines.join('\n')}\n\n<b>Акция:</b> ${esc(p.promo.name)} — ${rub(p.promo.price)} вместо ${rub(p.promo.oldPrice)}`,
    [
      ...p.items.map((i, n) => [{ text: `${i.name} — ${rub(i.price)}`, data: `pi:${n}` }]),
      [{ text: '➕ Добавить услугу', data: 'pa' }],
      [{ text: '🔥 Акция', data: 'pp' }, { text: '🗓 Дата цен', data: 'q:pdate' }],
      [{ text: '← Меню', data: 'm' }],
    ],
  ];
}

function priceItemMenu(c: Content, n: number): [string, Kb] {
  const i = c.prices.items[n];
  if (!i) return pricesMenu(c);
  return [
    `<b>${esc(i.name)}</b>\nЦена: ${rub(i.price)}\nВ первый раз: ${i.firstVisit ? rub(i.firstVisit) : 'нет'}`,
    [
      [{ text: '✏️ Цена', data: `q:pprice:${n}` }, { text: '✏️ Название', data: `q:pname:${n}` }],
      [{ text: i.firstVisit ? '✏️ Цена в первый раз' : '➕ Цена в первый раз', data: `q:pfirst:${n}` }],
      ...(i.firstVisit ? [[{ text: '✖️ Убрать цену в первый раз', data: `pfx:${n}` }]] : []),
      [{ text: '⬆️ Выше', data: `pup:${n}` }, { text: '🗑 Удалить', data: `pdel:${n}` }],
      [{ text: '← К ценам', data: 'p' }],
    ],
  ];
}

function promoMenu(c: Content): [string, Kb] {
  const p = c.prices.promo;
  return [
    `<b>Акция на сайте</b>\n${esc(p.name)}: ${rub(p.price)} вместо ${rub(p.oldPrice)}\nПодпись: ${esc(p.note)}`,
    [
      [{ text: '✏️ Цена', data: 'q:prp' }, { text: '✏️ Старая цена', data: 'q:pro' }],
      [{ text: '✏️ Название', data: 'q:prn' }, { text: '✏️ Подпись', data: 'q:prt' }],
      [{ text: '← К ценам', data: 'p' }],
    ],
  ];
}

const bookingMenu = (c: Content): [string, Kb] => [
  `<b>Куда ведёт кнопка «Записаться»</b>\n${esc(c.booking)}`,
  [[{ text: '✏️ Заменить ссылку', data: 'q:bk' }], [{ text: '🔗 Проверить ссылку', url: c.booking }], [{ text: '← Меню', data: 'm' }]],
];

function contactsMenu(c: Content): [string, Kb] {
  const soc = Object.entries(SOCIALS).map(([k, l]) => `${l}: ${c.socials[k] ? esc(c.socials[k]) : '— (не показывается)'}`);
  return [
    `<b>Контакты</b>\nТелефон: ${esc(c.phone)}\nАдрес: ${esc(c.address.street)}, ${esc(c.address.hint)}\nМетро: ${esc(c.address.metro)}, ${esc(c.address.metroDistance)}\nЧасы: ${esc(c.hours.label)} (${c.hours.open}–${c.hours.close})\n\n${soc.join('\n')}`,
    [
      [{ text: '📞 Телефон', data: 'q:phone' }, { text: '🕐 Часы', data: 'q:hours' }],
      [{ text: '📍 Адрес', data: 'q:street' }, { text: '🚪 Как войти', data: 'q:hint' }],
      [{ text: 'Ⓜ️ Метро', data: 'q:metro' }, { text: '🚶 Сколько идти', data: 'q:metrodist' }],
      ...chunk(Object.entries(SOCIALS).map(([k, l]) => ({ text: l, data: `q:soc:${k}` })), 3),
      [{ text: '← Меню', data: 'm' }],
    ],
  ];
}

function photosMenu(c: Content): [string, Kb] {
  return [
    `<b>Фото работ</b> — ${c.lookbook.length} шт. на сайте.\nНажмите на фото, чтобы посмотреть, переименовать, передвинуть или удалить.`,
    [
      [{ text: '➕ Добавить фото', data: 'q:phadd' }],
      ...chunk(c.lookbook.map((p, n) => ({ text: `${n + 1}. ${short(p.tag)}`, data: `phi:${n}` })), 2),
      [{ text: '← Меню', data: 'm' }],
    ],
  ];
}

const photoKb = (n: number, total: number): Kb => [
  [{ text: '✏️ Подпись', data: `q:phtag:${n}` }],
  [...(n > 0 ? [{ text: '⬅️ Раньше', data: `phup:${n}` }] : []), ...(n < total - 1 ? [{ text: 'Позже ➡️', data: `phdn:${n}` }] : [])],
  [{ text: '🗑 Удалить с сайта', data: `phdel:${n}` }],
  [{ text: '← К фото', data: 'ph' }],
];

function barbersMenu(c: Content): [string, Kb] {
  return [
    `<b>Мастера на сайте</b>\n${c.barbers.map((b, n) => `${n + 1}. ${esc(b.name)} — ${esc(b.role)}${b.photo ? ' 📷' : ' (без фото)'}`).join('\n')}\n\nНажмите на мастера, чтобы изменить имя, специализацию или фото.`,
    [
      ...chunk(c.barbers.map((b, n) => ({ text: `${b.photo ? '📷 ' : ''}${b.name}`, data: `bi:${n}` })), 2),
      [{ text: '➕ Добавить мастера', data: 'q:badd' }],
      [{ text: '← Меню', data: 'm' }],
    ],
  ];
}

const barberKb = (c: Content, n: number): Kb => [
  [{ text: '✏️ Имя', data: `q:bname:${n}` }, { text: '✏️ Чем занимается', data: `q:brole:${n}` }],
  [{ text: c.barbers[n].photo ? '📷 Заменить фото' : '📷 Добавить фото', data: `q:bphoto:${n}` }],
  ...(c.barbers[n].photo ? [[{ text: '✖️ Убрать фото', data: `bpx:${n}` }]] : []),
  [{ text: '🗑 Убрать мастера с сайта', data: `bdel:${n}` }],
  [{ text: '← К мастерам', data: 'br' }],
];

const ratingMenu = (c: Content): [string, Kb] => [
  `<b>Рейтинг на сайте</b>\n${c.rating.value.toFixed(1)} · ${c.rating.votes} оценок · ${c.rating.reviews} отзывов\n(перепишите цифры из карточки на Яндекс Картах)`,
  [[{ text: '⭐ Оценка', data: 'q:rv' }, { text: 'Оценок', data: 'q:rvo' }, { text: 'Отзывов', data: 'q:rre' }], [{ text: '← Меню', data: 'm' }]],
];

async function adminsMenu(): Promise<[string, Kb]> {
  const a = await readAdmins();
  return [
    `<b>Доступ к боту</b>\nВладелец: @${esc(a.owner)}\n${a.users.length ? a.users.map((u, n) => `${n + 1}. ${esc(userLabel(u))}${u.id ? '' : ' — ещё не заходил'}`).join('\n') : 'Больше ни у кого доступа нет.'}`,
    [
      [{ text: '➕ Дать доступ', data: 'q:adadd' }],
      ...a.users.map((u, n) => [{ text: `🗑 Убрать ${userLabel(u)}`, data: `addel:${n}` }]),
      [{ text: '← Меню', data: 'm' }],
    ],
  ];
}

// ---------- вопросы (ответ приходит reply на сообщение бота) ----------

const QUESTIONS: Record<string, (c: Content, arg: string) => [string, string?]> = {
  pprice: (c, a) => [`Новая цена для «${esc(c.prices.items[+a]?.name)}», только число:`, '2800'],
  pname: (c, a) => [`Новое название вместо «${esc(c.prices.items[+a]?.name)}»:`],
  pfirst: (c, a) => [`Цена в первый раз для «${esc(c.prices.items[+a]?.name)}», только число:`, '3170'],
  padd: () => ['Новая услуга в формате <b>Название — цена</b>:', 'Камуфляж седины — 1500'],
  pdate: () => ['Подпись над ценами, например «цены на 1 декабря»:', 'цены на 1 декабря'],
  prp: () => ['Цена по акции, только число:', '2170'],
  pro: () => ['Старая (зачёркнутая) цена, только число:', '2600'],
  prn: () => ['Название акции:', 'Первая стрижка'],
  prt: () => ['Подпись под ценой акции:', 'для тех, кто у нас впервые'],
  bk: () => ['Пришлите новую ссылку для кнопки «Записаться» (YCLIENTS, DIKIDI, Telegram и т. п.):', 'https://...'],
  phone: () => ['Новый телефон:', '+7 (901) 901-63-63'],
  hours: () => ['Часы работы в формате <b>11:00–22:00</b> (каждый день):', '11:00–22:00'],
  street: () => ['Адрес (улица и дом):', 'Нахимовский проспект, 40'],
  hint: () => ['Как к вам войти (одна короткая фраза):', 'вход через цветочный'],
  metro: () => ['Ближайшее метро:', 'Профсоюзная'],
  metrodist: () => ['Сколько идти от метро:', '200 м'],
  soc: (_c, a) => [`Ссылка на ${SOCIALS[a] ?? a}. Отправьте «-», чтобы убрать с сайта:`, 'https://...'],
  phadd: () => ['Пришлите <b>фото ответом на это сообщение</b>. В подписи к фото напишите название стрижки (можно без подписи).', 'Фото + подпись'],
  phtag: (c, a) => [`Новая подпись для фото №${+a + 1} (сейчас: «${esc(c.lookbook[+a]?.tag)}»):`, 'кудрявый блонд'],
  bname: (c, a) => [`Имя мастера вместо «${esc(c.barbers[+a]?.name)}»:`],
  brole: (c, a) => [`Чем занимается ${esc(c.barbers[+a]?.name)}:`, 'Стрижки, борода'],
  badd: () => ['Новый мастер в формате <b>Имя — чем занимается</b>:', 'Коля — стрижки, фейды'],
  bphoto: (c, a) => [`Пришлите <b>фото ${esc(c.barbers[+a]?.name)} ответом на это сообщение</b>. Лучше вертикальное, лицо по центру.`, 'Фото мастера'],
  rv: () => ['Оценка на Яндекс Картах, например 4.9:', '5.0'],
  rvo: () => ['Сколько оценок:', '134'],
  rre: () => ['Сколько отзывов:', '117'],
  adadd: () => ['Кому дать доступ? Пришлите <b>@ник</b> в Telegram или числовой ID.\nЧеловеку нужно будет написать боту /start.', '@username'],
};

// ---------- разбор ответов ----------

const num = (s: string, min = 1, max = 1_000_000) => {
  const n = Number(s.replace(/[^\d]/g, ''));
  if (!s.match(/\d/) || !Number.isFinite(n) || n < min || n > max) throw new UserError('Нужно число, например 2800.');
  return n;
};
const text = (s: string, max = 120) => {
  const t = s.trim().replace(/\s+/g, ' ');
  if (!t) throw new UserError('Пустой текст. Попробуйте ещё раз.');
  if (t.length > max) throw new UserError(`Слишком длинно, максимум ${max} символов.`);
  return t;
};
const link = (s: string) => {
  const t = s.trim();
  if (!/^https?:\/\/\S+\.\S+/.test(t)) throw new UserError('Нужна ссылка, начинающаяся с https://');
  return t;
};
const nameAndRest = (s: string) => {
  const m = s.split(/\s+[—–-]\s+/);
  if (m.length < 2) throw new UserError('Нужен формат «Название — значение», через тире.');
  return [text(m[0], 60), m.slice(1).join(' — ')] as const;
};

/** Фото из ответа → JPEG-байты из Telegram (берём самый крупный размер). */
async function photoFromMessage(msg: any) {
  const sizes = msg.photo as { file_id: string; width: number }[] | undefined;
  const doc = msg.document && /^image\/(jpe?g)$/.test(msg.document.mime_type) ? msg.document : undefined;
  if (!sizes?.length && !doc) throw new UserError('Не вижу фото. Нажмите кнопку ещё раз и пришлите картинку ответом на сообщение бота.');
  const fileId = doc ? doc.file_id : sizes!.reduce((a, b) => (b.width > a.width ? b : a)).file_id;
  const bytes = await tg.fileBytes(fileId);
  if (bytes.length > 15 * 1024 * 1024) throw new UserError('Фото слишком большое (больше 15 МБ).');
  return bytes;
}
const stamp = () => new Date().toISOString().replace(/\D/g, '').slice(0, 14);

async function applyAnswer(key: string, value: string, msg: any, from: From): Promise<[string, Kb?]> {
  const [q, arg = ''] = key.split(':');
  return applyGeneric(q, arg, Number(arg), value, msg, from, ` (${who(from)})`);
}

async function applyGeneric(q: string, arg: string, n: number, value: string, msg: any, from: From, by: string): Promise<[string, Kb?]> {
  const save = (what: string, fn: (c: Content) => void) => saveContent(`Бот: ${what}${by}`, fn);
  switch (q) {
    case 'pprice': await save('цена услуги', (c) => { c.prices.items[n].price = num(value); }); return [SAVED, back(`pi:${n}`)];
    case 'pname': await save('название услуги', (c) => { c.prices.items[n].name = text(value, 40); }); return [SAVED, back(`pi:${n}`)];
    case 'pfirst': await save('цена в первый раз', (c) => { c.prices.items[n].firstVisit = num(value); }); return [SAVED, back(`pi:${n}`)];
    case 'padd': {
      const [name, price] = nameAndRest(value);
      await save(`новая услуга «${name}»`, (c) => { c.prices.items.push({ name: text(name, 40), price: num(price) }); });
      return [SAVED, back('p', '← К ценам')];
    }
    case 'pdate': await save('дата цен', (c) => { c.prices.date = text(value, 40); }); return [SAVED, back('p', '← К ценам')];
    case 'prp': await save('цена акции', (c) => { c.prices.promo.price = num(value); }); return [SAVED, back('pp')];
    case 'pro': await save('старая цена акции', (c) => { c.prices.promo.oldPrice = num(value); }); return [SAVED, back('pp')];
    case 'prn': await save('название акции', (c) => { c.prices.promo.name = text(value, 30); }); return [SAVED, back('pp')];
    case 'prt': await save('подпись акции', (c) => { c.prices.promo.note = text(value, 60); }); return [SAVED, back('pp')];
    case 'bk': await save('ссылка «Записаться»', (c) => { c.booking = link(value); }); return [SAVED, back('bk')];
    case 'phone': {
      const digits = value.replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 12) throw new UserError('Похоже, это не телефон. Пример: +7 (901) 901-63-63');
      await save('телефон', (c) => { c.phone = text(value, 30); });
      return [SAVED, back('c')];
    }
    case 'hours': {
      const m = value.match(/(\d{1,2})(?::(\d{2}))?\s*[—–-]\s*(\d{1,2})(?::(\d{2}))?/);
      if (!m) throw new UserError('Нужен формат 11:00–22:00');
      const hh = (h: string, mm?: string) => `${h.padStart(2, '0')}:${mm ?? '00'}`;
      const open = hh(m[1], m[2]), close = hh(m[3], m[4]);
      const short = (h: string, mm?: string) => (mm && mm !== '00' ? `${+h}:${mm}` : String(+h));
      await save('часы работы', (c) => { c.hours = { label: `каждый день ${short(m[1], m[2])}–${short(m[3], m[4])}`, open, close }; });
      return [SAVED, back('c')];
    }
    case 'street': await save('адрес', (c) => { c.address.street = text(value, 60); }); return [SAVED, back('c')];
    case 'hint': await save('как войти', (c) => { c.address.hint = text(value, 40); }); return [SAVED, back('c')];
    case 'metro': await save('метро', (c) => { c.address.metro = text(value, 30); }); return [SAVED, back('c')];
    case 'metrodist': await save('расстояние от метро', (c) => { c.address.metroDistance = text(value, 20); }); return [SAVED, back('c')];
    case 'soc': await save(`ссылка ${SOCIALS[arg] ?? arg}`, (c) => { c.socials[arg] = value.trim() === '-' ? '' : link(value); }); return [SAVED, back('c')];
    case 'phtag': await save('подпись фото', (c) => { c.lookbook[n].tag = text(value, 30); c.lookbook[n].alt = text(value, 30); }); return [SAVED, back(`phi:${n}`)];
    case 'phadd': {
      const bytes = await photoFromMessage(msg);
      const tag = msg.caption ? text(msg.caption, 30) : 'работа мастера';
      const name = `lookbook/${stamp()}.jpg`;
      await writeFile(env.siteRepo, `${PHOTOS_DIR}/${name}`, env.siteBranch, bytes, `Бот: новое фото работы${by}`);
      await save('фото добавлено на сайт', (c) => { c.lookbook.unshift({ file: name, tag, alt: tag }); });
      return [`Фото добавлено первым в ленту «Работы». ${SAVED}`, back('ph', '← К фото')];
    }
    case 'bphoto': {
      const bytes = await photoFromMessage(msg);
      const name = `barbers/${stamp()}.jpg`;
      await writeFile(env.siteRepo, `${PHOTOS_DIR}/${name}`, env.siteBranch, bytes, `Бот: фото мастера${by}`);
      let old = '';
      const c = await save('фото мастера на сайте', (x) => { old = x.barbers[n].photo ?? ''; x.barbers[n].photo = name; });
      if (old.startsWith('barbers/')) await deleteFile(env.siteRepo, `${PHOTOS_DIR}/${old}`, env.siteBranch, `Бот: старое фото мастера удалено${by}`).catch(() => {});
      return [`Фото ${esc(c.barbers[n].name)} обновлено. ${SAVED}`, back(`bi:${n}`, '← К мастеру')];
    }
    case 'bname': await save('имя мастера', (c) => { c.barbers[n].name = text(value, 30); }); return [SAVED, back(`bi:${n}`, '← К мастеру')];
    case 'brole': await save('специализация мастера', (c) => { c.barbers[n].role = text(value, 60); }); return [SAVED, back(`bi:${n}`, '← К мастеру')];
    case 'badd': {
      const [name, role] = nameAndRest(value);
      await save(`новый мастер ${name}`, (c) => { c.barbers.push({ name: text(name, 30), role: text(role, 60) }); });
      return [SAVED, back('br')];
    }
    case 'rv': {
      const v = Number(value.replace(',', '.'));
      if (!(v >= 1 && v <= 5)) throw new UserError('Оценка от 1 до 5, например 4.9');
      await save('рейтинг', (c) => { c.rating.value = Math.round(v * 10) / 10; });
      return [SAVED, back('rt')];
    }
    case 'rvo': await save('число оценок', (c) => { c.rating.votes = num(value, 0); }); return [SAVED, back('rt')];
    case 'rre': await save('число отзывов', (c) => { c.rating.reviews = num(value, 0); }); return [SAVED, back('rt')];
    case 'adadd': {
      const label = await addAdmin(value, from);
      return [`Готово, доступ есть у ${esc(label)}. Пусть откроет @ugol361_bot и нажмёт /start.`, back('ad')];
    }
  }
  throw new UserError('Не понял, к чему этот ответ. Откройте /start и выберите действие заново.');
}

// ---------- кнопки ----------

async function onButton(data: string, chatId: number, messageId: number, from: From) {
  const [cmd, arg = ''] = data.split(':');
  const n = Number(arg);
  const by = ` (${who(from)})`;
  const show = async ([html, kb]: [string, Kb]) => tg.edit(chatId, messageId, html, kb);

  if (cmd === 'q') {
    // кнопка «изменить» → задаём вопрос
    const [q, a = ''] = data.slice(2).split(':');
    const c = await readContent();
    const [html, ph] = QUESTIONS[q](c, a);
    return tg.ask(chatId, `${q}:${a}`, html, ph);
  }
  switch (cmd) {
    case 'm': return show(mainMenu());
    case 'p': return show(pricesMenu(await readContent()));
    case 'pi': return show(priceItemMenu(await readContent(), n));
    case 'pa': return tg.ask(chatId, 'padd:', QUESTIONS.padd(null as any, '')[0], QUESTIONS.padd(null as any, '')[1]);
    case 'pp': return show(promoMenu(await readContent()));
    case 'pfx': return show(priceItemMenu(await saveContent(`Бот: убрана цена в первый раз${by}`, (c) => { delete c.prices.items[n].firstVisit; }), n));
    case 'pup': return show(pricesMenu(await saveContent(`Бот: порядок услуг${by}`, (c) => { if (n > 0) { const it = c.prices.items; [it[n - 1], it[n]] = [it[n], it[n - 1]]; } })));
    case 'pdel': return show([`Удалить «${esc((await readContent()).prices.items[n]?.name)}» из прайса?`, [[{ text: '🗑 Да, удалить', data: `pdy:${n}` }, { text: 'Отмена', data: `pi:${n}` }]]]);
    case 'pdy': return show(pricesMenu(await saveContent(`Бот: услуга удалена${by}`, (c) => { if (c.prices.items.length <= 1) throw new UserError('Последнюю услугу удалить нельзя.'); c.prices.items.splice(n, 1); })));
    case 'bk': return show(bookingMenu(await readContent()));
    case 'c': return show(contactsMenu(await readContent()));
    case 'ph': return show(photosMenu(await readContent()));
    case 'phi': {
      const c = await readContent();
      const p = c.lookbook[n];
      if (!p) return show(photosMenu(c));
      return tg.photo(chatId, photoUrl(p.file), `Фото №${n + 1} из ${c.lookbook.length}\nПодпись: <b>${esc(p.tag)}</b>`, photoKb(n, c.lookbook.length));
    }
    case 'phup':
    case 'phdn': {
      const c = await saveContent(`Бот: порядок фото${by}`, (x) => {
        const to = cmd === 'phup' ? n - 1 : n + 1;
        if (to < 0 || to >= x.lookbook.length) return;
        [x.lookbook[to], x.lookbook[n]] = [x.lookbook[n], x.lookbook[to]];
      });
      return tg.send(chatId, `Готово. ${SAVED}`, photosMenu(c)[1]);
    }
    case 'phdel': return tg.send(chatId, `Убрать фото №${n + 1} с сайта?`, [[{ text: '🗑 Да, убрать', data: `phy:${n}` }, { text: 'Отмена', data: 'ph' }]]);
    case 'phy': {
      let removed = '';
      const c = await saveContent(`Бот: фото убрано с сайта${by}`, (x) => {
        if (x.lookbook.length <= 1) throw new UserError('Последнее фото убрать нельзя: лента «Работы» опустеет.');
        removed = x.lookbook.splice(n, 1)[0]?.file ?? '';
      });
      if (removed.startsWith('lookbook/')) await deleteFile(env.siteRepo, `${PHOTOS_DIR}/${removed}`, env.siteBranch, `Бот: удалён файл фото${by}`).catch(() => {});
      return show([`Фото убрано. ${SAVED}`, photosMenu(c)[1]]);
    }
    case 'br': return show(barbersMenu(await readContent()));
    case 'bi': {
      const c = await readContent();
      const b = c.barbers[n];
      if (!b) return show(barbersMenu(c));
      const caption = `<b>${esc(b.name)}</b>\n${esc(b.role)}${b.photo ? '' : '\n\nФото пока нет — на сайте заглушка.'}`;
      return b.photo ? tg.photo(chatId, photoUrl(b.photo), caption, barberKb(c, n)) : show([caption, barberKb(c, n)]);
    }
    case 'bpx': {
      let old = '';
      const c = await saveContent(`Бот: фото мастера убрано${by}`, (x) => { old = x.barbers[n].photo ?? ''; delete x.barbers[n].photo; });
      if (old.startsWith('barbers/')) await deleteFile(env.siteRepo, `${PHOTOS_DIR}/${old}`, env.siteBranch, `Бот: удалён файл фото мастера${by}`).catch(() => {});
      return tg.send(chatId, `Фото убрано, на сайте снова заглушка. ${SAVED}`, barberKb(c, n));
    }
    case 'bdel': return tg.send(chatId, `Убрать мастера «${esc((await readContent()).barbers[n]?.name)}» с сайта?`, [[{ text: '🗑 Да', data: `bdy:${n}` }, { text: 'Отмена', data: `bi:${n}` }]]);
    case 'bdy': {
      let old = '';
      const c = await saveContent(`Бот: мастер убран${by}`, (x) => { old = x.barbers[n]?.photo ?? ''; x.barbers.splice(n, 1); });
      if (old.startsWith('barbers/')) await deleteFile(env.siteRepo, `${PHOTOS_DIR}/${old}`, env.siteBranch, `Бот: удалён файл фото мастера${by}`).catch(() => {});
      return tg.send(chatId, `Мастер убран. ${SAVED}`, barbersMenu(c)[1]);
    }
    case 'rt': return show(ratingMenu(await readContent()));
    case 'ad': return show(await adminsMenu());
    case 'addel': {
      const label = await removeAdmin(n, from);
      const [html, kb] = await adminsMenu();
      return show([`Доступ у ${esc(label)} отозван.\n\n${html}`, kb]);
    }
  }
}

// ---------- точка входа ----------

export async function handleUpdate(update: any) {
  const msg = update.message;
  const cb = update.callback_query;
  const from: From | undefined = msg?.from ?? cb?.from;
  const chatId: number | undefined = msg?.chat?.id ?? cb?.message?.chat?.id;
  if (!from || !chatId) return;
  if ((msg?.chat ?? cb?.message?.chat)?.type !== 'private') return; // только личка

  const access = await checkAccess(from);
  if (!access.ok) {
    if (cb) await tg.answer(cb.id, 'Нет доступа');
    return tg.send(
      chatId,
      `Это бот для управления сайтом барбершопа «Угол 361». Доступа у вас пока нет.\n\nПопросите администратора добавить вас: ${from.username ? `@${esc(from.username)} или ` : ''}ID <code>${from.id}</code>`,
    );
  }

  try {
    if (cb) {
      await tg.answer(cb.id);
      return await onButton(cb.data ?? 'm', chatId, cb.message.message_id, from);
    }
    const key = askKey(msg.reply_to_message);
    if (key) {
      const [html, kb] = await applyAnswer(key, msg.text ?? msg.caption ?? '', msg, from);
      return await tg.send(chatId, html, kb);
    }
    if (msg.photo) return tg.send(chatId, 'Чтобы добавить фото на сайт: /start → «Фото работ» → «Добавить фото» и пришлите фото ответом на сообщение бота.');
    const [html, kb] = mainMenu();
    return tg.send(chatId, html, kb);
  } catch (e) {
    if (e instanceof UserError) return tg.send(chatId, `⚠️ ${esc(e.message)}`);
    console.error(e);
    return tg.send(chatId, '⚠️ Что-то пошло не так, изменение не сохранено. Попробуйте ещё раз через минуту.');
  }
}

const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
const short = (s: string) => (s.length > 18 ? s.slice(0, 17) + '…' : s);
