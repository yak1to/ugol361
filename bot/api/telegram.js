// Собрано из bot/src — правьте исходники, потом `node build.mjs`

// src/env.ts
var need = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`\u041D\u0435\u0442 \u043F\u0435\u0440\u0435\u043C\u0435\u043D\u043D\u043E\u0439 \u043E\u043A\u0440\u0443\u0436\u0435\u043D\u0438\u044F ${k}`);
  return v;
};
var env = {
  get botToken() {
    return need("BOT_TOKEN");
  },
  get ghToken() {
    return need("GH_TOKEN");
  },
  get webhookSecret() {
    return need("WEBHOOK_SECRET");
  },
  siteRepo: process.env.SITE_REPO ?? "yak1to/ugol361",
  siteBranch: process.env.SITE_BRANCH ?? "main",
  adminRepo: process.env.ADMIN_REPO ?? "yak1to/ugol361-admin",
  adminBranch: process.env.ADMIN_BRANCH ?? "main",
  owner: (process.env.OWNER ?? "yak1tto").replace(/^@/, "").toLowerCase(),
  siteUrl: process.env.SITE_URL ?? "https://yak1to.github.io/ugol361/"
};

// src/tg.ts
async function call(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${env.botToken}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`Telegram ${method}: ${j.description}`);
  return j.result;
}
var markup = (kb) => kb ? { inline_keyboard: kb.map((row) => row.map((b) => b.url ? { text: b.text, url: b.url } : { text: b.text, callback_data: b.data })) } : void 0;
var esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
var tg = {
  send: (chatId, html, kb) => call("sendMessage", { chat_id: chatId, text: html, parse_mode: "HTML", reply_markup: markup(kb), link_preview_options: { is_disabled: true } }),
  /** Меню «на месте»: правим сообщение с кнопками, чтобы чат не засорялся. */
  edit: async (chatId, messageId, html, kb) => {
    try {
      await call("editMessageText", { chat_id: chatId, message_id: messageId, text: html, parse_mode: "HTML", reply_markup: markup(kb), link_preview_options: { is_disabled: true } });
    } catch (e) {
      if (!String(e).includes("not modified")) await tg.send(chatId, html, kb);
    }
  },
  /**
   * Вопрос, на который нужно ответить. Что именно ждём, зашито в скрытую ссылку на первом символе
   * (Telegram возвращает её в reply_to_message.entities) — бот не хранит состояние между сообщениями.
   */
  ask: (chatId, key, html, placeholder = "\u041E\u0442\u0432\u0435\u0442") => call("sendMessage", {
    chat_id: chatId,
    text: `<a href="${ASK_PREFIX}${encodeURIComponent(key)}">\u270F\uFE0F</a> ${html}`,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: { force_reply: true, input_field_placeholder: placeholder }
  }),
  photo: (chatId, url, caption, kb) => call("sendPhoto", { chat_id: chatId, photo: url, caption, parse_mode: "HTML", reply_markup: markup(kb) }),
  answer: (callbackId, text2) => call("answerCallbackQuery", { callback_query_id: callbackId, text: text2 }).catch(() => {
  }),
  fileBytes: async (fileId) => {
    const f = await call("getFile", { file_id: fileId });
    const r = await fetch(`https://api.telegram.org/file/bot${env.botToken}/${f.file_path}`);
    if (!r.ok) throw new Error("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043A\u0430\u0447\u0430\u0442\u044C \u0444\u043E\u0442\u043E \u0438\u0437 Telegram");
    return Buffer.from(await r.arrayBuffer());
  },
  call
};
var ASK_PREFIX = "https://ugol361.bot/ask/";
function askKey(reply) {
  for (const e of reply?.entities ?? reply?.caption_entities ?? []) {
    if (e.type === "text_link" && typeof e.url === "string" && e.url.startsWith(ASK_PREFIX)) {
      return decodeURIComponent(e.url.slice(ASK_PREFIX.length));
    }
  }
  return null;
}

// src/gh.ts
var api = async (path, init = {}) => {
  const r = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${env.ghToken}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "ugol361-bot",
      ...init.headers ?? {}
    }
  });
  return r;
};
async function readFile(repo, path, branch) {
  const r = await api(`/repos/${repo}/contents/${encodeURI(path)}?ref=${branch}`);
  if (!r.ok) throw new Error(`GitHub: \u043D\u0435 \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C ${path} (${r.status})`);
  const j = await r.json();
  return { sha: j.sha, text: Buffer.from(j.content, "base64").toString("utf8") };
}
async function writeFile(repo, path, branch, content, message, sha) {
  const r = await api(`/repos/${repo}/contents/${encodeURI(path)}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      branch,
      sha,
      content: (typeof content === "string" ? Buffer.from(content, "utf8") : content).toString("base64")
    })
  });
  if (r.status === 409 || r.status === 422) throw new ConflictError();
  if (!r.ok) throw new Error(`GitHub: \u043D\u0435 \u0437\u0430\u043F\u0438\u0441\u0430\u0442\u044C ${path} (${r.status})`);
}
async function deleteFile(repo, path, branch, message) {
  const r = await api(`/repos/${repo}/contents/${encodeURI(path)}?ref=${branch}`);
  if (r.status === 404) return;
  const { sha } = await r.json();
  const d = await api(`/repos/${repo}/contents/${encodeURI(path)}`, { method: "DELETE", body: JSON.stringify({ message, branch, sha }) });
  if (!d.ok && d.status !== 404) throw new Error(`GitHub: \u043D\u0435 \u0443\u0434\u0430\u043B\u0438\u0442\u044C ${path} (${d.status})`);
}
var ConflictError = class extends Error {
  constructor() {
    super("\u0424\u0430\u0439\u043B \u0443\u0441\u043F\u0435\u043B\u0438 \u0438\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u043E\u0434\u043D\u043E\u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E");
  }
};
async function updateJson(repo, path, branch, message, change) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const f = await readFile(repo, path, branch);
    const data = JSON.parse(f.text);
    await change(data);
    try {
      await writeFile(repo, path, branch, JSON.stringify(data, null, 2) + "\n", message, f.sha);
      return data;
    } catch (e) {
      if (!(e instanceof ConflictError)) throw e;
    }
  }
  throw new ConflictError();
}

// src/content.ts
var CONTENT_PATH = "src/content/site.json";
var PHOTOS_DIR = "src/assets/photos";
var readContent = async () => JSON.parse((await readFile(env.siteRepo, CONTENT_PATH, env.siteBranch)).text);
var saveContent = (message, change) => updateJson(env.siteRepo, CONTENT_PATH, env.siteBranch, message, change);
var photoUrl = (file) => `https://raw.githubusercontent.com/${env.siteRepo}/${env.siteBranch}/${PHOTOS_DIR}/${file.includes("/") ? file : `raw/${file}`}`;
var rub = (n) => `${n.toLocaleString("ru-RU").replace(/\s/g, " ")} \u20BD`;

// src/access.ts
var PATH = "admins.json";
var norm = (u) => (u ?? "").replace(/^@/, "").toLowerCase();
var readAdmins = async () => JSON.parse((await readFile(env.adminRepo, PATH, env.adminBranch)).text);
var save = (message, change) => updateJson(env.adminRepo, PATH, env.adminBranch, message, change);
var isOwner = (a, f) => norm(f.username) === norm(a.owner) || a.ownerId !== null && a.ownerId === f.id;
async function checkAccess(f) {
  const a = await readAdmins();
  if (isOwner(a, f)) {
    if (a.ownerId !== f.id) await save(`\u0411\u043E\u0442: \u043F\u0440\u0438\u0432\u044F\u0437\u0430\u043D ID \u0432\u043B\u0430\u0434\u0435\u043B\u044C\u0446\u0430`, (x) => {
      x.ownerId = f.id;
    });
    return { ok: true, owner: true };
  }
  const byId = a.users.find((u) => u.id === f.id);
  if (byId) return { ok: true, owner: false };
  const byName = f.username ? a.users.find((u) => !u.id && norm(u.username) === norm(f.username)) : void 0;
  if (byName) {
    await save(`\u0411\u043E\u0442: \u043F\u0440\u0438\u0432\u044F\u0437\u0430\u043D ID \u0434\u043B\u044F @${norm(f.username)}`, (x) => {
      const u = x.users.find((v) => !v.id && norm(v.username) === norm(f.username));
      if (u) u.id = f.id;
    });
    return { ok: true, owner: false };
  }
  return { ok: false, owner: false };
}
async function addAdmin(input, by) {
  const raw = input.trim().replace(/^https?:\/\/t\.me\//i, "");
  const asId = /^\d{5,15}$/.test(raw) ? Number(raw) : void 0;
  const asName = !asId && /^@?[a-zA-Z][a-zA-Z0-9_]{3,31}$/.test(raw) ? norm(raw) : void 0;
  if (!asId && !asName) throw new UserError("\u041D\u0443\u0436\u0435\u043D @\u043D\u0438\u043A \u0432 Telegram (\u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440, @ivan_barber) \u0438\u043B\u0438 \u0447\u0438\u0441\u043B\u043E\u0432\u043E\u0439 ID.");
  let label = "";
  await save(`\u0411\u043E\u0442: \u0434\u043E\u0441\u0442\u0443\u043F \u0434\u043B\u044F ${asName ? "@" + asName : asId} (\u0434\u043E\u0431\u0430\u0432\u0438\u043B @${norm(by.username) || by.id})`, (a) => {
    if (asName && norm(a.owner) === asName) throw new UserError("\u042D\u0442\u043E \u0432\u043B\u0430\u0434\u0435\u043B\u0435\u0446, \u0443 \u043D\u0435\u0433\u043E \u0443\u0436\u0435 \u0435\u0441\u0442\u044C \u0434\u043E\u0441\u0442\u0443\u043F.");
    if (a.users.some((u) => asId && u.id === asId || asName && norm(u.username) === asName)) throw new UserError("\u0423 \u044D\u0442\u043E\u0433\u043E \u0447\u0435\u043B\u043E\u0432\u0435\u043A\u0430 \u0443\u0436\u0435 \u0435\u0441\u0442\u044C \u0434\u043E\u0441\u0442\u0443\u043F.");
    a.users.push({ ...asId ? { id: asId } : { username: asName }, addedBy: norm(by.username) || String(by.id), addedAt: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) });
    label = asName ? "@" + asName : String(asId);
  });
  return label;
}
async function removeAdmin(index, by) {
  let label = "";
  await save(`\u0411\u043E\u0442: \u0434\u043E\u0441\u0442\u0443\u043F \u043E\u0442\u043E\u0437\u0432\u0430\u043D (\u0441\u0434\u0435\u043B\u0430\u043B @${norm(by.username) || by.id})`, (a) => {
    const u = a.users[index];
    if (!u) throw new UserError("\u0422\u0430\u043A\u043E\u0433\u043E \u0447\u0435\u043B\u043E\u0432\u0435\u043A\u0430 \u0432 \u0441\u043F\u0438\u0441\u043A\u0435 \u0443\u0436\u0435 \u043D\u0435\u0442.");
    if (u.id === by.id) throw new UserError("\u0421\u0435\u0431\u044F \u0443\u0434\u0430\u043B\u0438\u0442\u044C \u043D\u0435\u043B\u044C\u0437\u044F \u2014 \u043F\u043E\u043F\u0440\u043E\u0441\u0438\u0442\u0435 \u0434\u0440\u0443\u0433\u043E\u0433\u043E \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0430.");
    label = userLabel(u);
    a.users.splice(index, 1);
  });
  return label;
}
var userLabel = (u) => (u.username ? `@${u.username}` : `ID ${u.id}`) + (u.username && u.id ? ` (ID ${u.id})` : "");
var UserError = class extends Error {
};

// src/bot.ts
var SAVED = `\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E. \u0421\u0430\u0439\u0442 \u043E\u0431\u043D\u043E\u0432\u0438\u0442\u0441\u044F \u0447\u0435\u0440\u0435\u0437 1\u20132 \u043C\u0438\u043D\u0443\u0442\u044B: <a href="${env.siteUrl}">\u043E\u0442\u043A\u0440\u044B\u0442\u044C</a>`;
var who = (f) => f.username ? "@" + f.username : String(f.id);
var back = (data, text2 = "\u2190 \u041D\u0430\u0437\u0430\u0434") => [[{ text: text2, data }]];
var SOCIALS = { telegram: "Telegram", whatsapp: "WhatsApp", youtube: "YouTube", max: "MAX", vk: "VK", instagram: "Instagram" };
var mainMenu = () => [
  "<b>\u0423\u0433\u043E\u043B 361 \u2014 \u0443\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0441\u0430\u0439\u0442\u043E\u043C</b>\n\u0427\u0442\u043E \u043C\u0435\u043D\u044F\u0435\u043C?",
  [
    [{ text: "\u{1F488} \u0426\u0435\u043D\u044B \u0438 \u0430\u043A\u0446\u0438\u044F", data: "p" }],
    [{ text: "\u{1F4C5} \u0421\u0441\u044B\u043B\u043A\u0430 \xAB\u0417\u0430\u043F\u0438\u0441\u0430\u0442\u044C\u0441\u044F\xBB", data: "bk" }],
    [{ text: "\u{1F4DE} \u041A\u043E\u043D\u0442\u0430\u043A\u0442\u044B \u0438 \u0430\u0434\u0440\u0435\u0441", data: "c" }],
    [{ text: "\u{1F5BC} \u0424\u043E\u0442\u043E \u0440\u0430\u0431\u043E\u0442", data: "ph" }],
    [{ text: "\u2702\uFE0F \u041C\u0430\u0441\u0442\u0435\u0440\u0430", data: "br" }],
    [{ text: "\u2B50 \u0420\u0435\u0439\u0442\u0438\u043D\u0433", data: "rt" }],
    [{ text: "\u{1F465} \u0414\u043E\u0441\u0442\u0443\u043F \u043A \u0431\u043E\u0442\u0443", data: "ad" }],
    [{ text: "\u{1F310} \u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0441\u0430\u0439\u0442", url: env.siteUrl }]
  ]
];
function pricesMenu(c) {
  const p = c.prices;
  const lines = p.items.map((i) => `\u2022 ${esc(i.name)} \u2014 ${rub(i.price)}${i.firstVisit ? ` (\u0432 \u043F\u0435\u0440\u0432\u044B\u0439 \u0440\u0430\u0437 ${rub(i.firstVisit)})` : ""}`);
  return [
    `<b>\u0426\u0435\u043D\u044B</b> (${esc(p.date)})
${lines.join("\n")}

<b>\u0410\u043A\u0446\u0438\u044F:</b> ${esc(p.promo.name)} \u2014 ${rub(p.promo.price)} \u0432\u043C\u0435\u0441\u0442\u043E ${rub(p.promo.oldPrice)}`,
    [
      ...p.items.map((i, n) => [{ text: `${i.name} \u2014 ${rub(i.price)}`, data: `pi:${n}` }]),
      [{ text: "\u2795 \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0443\u0441\u043B\u0443\u0433\u0443", data: "pa" }],
      [{ text: "\u{1F525} \u0410\u043A\u0446\u0438\u044F", data: "pp" }, { text: "\u{1F5D3} \u0414\u0430\u0442\u0430 \u0446\u0435\u043D", data: "q:pdate" }],
      [{ text: "\u2190 \u041C\u0435\u043D\u044E", data: "m" }]
    ]
  ];
}
function priceItemMenu(c, n) {
  const i = c.prices.items[n];
  if (!i) return pricesMenu(c);
  return [
    `<b>${esc(i.name)}</b>
\u0426\u0435\u043D\u0430: ${rub(i.price)}
\u0412 \u043F\u0435\u0440\u0432\u044B\u0439 \u0440\u0430\u0437: ${i.firstVisit ? rub(i.firstVisit) : "\u043D\u0435\u0442"}`,
    [
      [{ text: "\u270F\uFE0F \u0426\u0435\u043D\u0430", data: `q:pprice:${n}` }, { text: "\u270F\uFE0F \u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435", data: `q:pname:${n}` }],
      [{ text: i.firstVisit ? "\u270F\uFE0F \u0426\u0435\u043D\u0430 \u0432 \u043F\u0435\u0440\u0432\u044B\u0439 \u0440\u0430\u0437" : "\u2795 \u0426\u0435\u043D\u0430 \u0432 \u043F\u0435\u0440\u0432\u044B\u0439 \u0440\u0430\u0437", data: `q:pfirst:${n}` }],
      ...i.firstVisit ? [[{ text: "\u2716\uFE0F \u0423\u0431\u0440\u0430\u0442\u044C \u0446\u0435\u043D\u0443 \u0432 \u043F\u0435\u0440\u0432\u044B\u0439 \u0440\u0430\u0437", data: `pfx:${n}` }]] : [],
      [{ text: "\u2B06\uFE0F \u0412\u044B\u0448\u0435", data: `pup:${n}` }, { text: "\u{1F5D1} \u0423\u0434\u0430\u043B\u0438\u0442\u044C", data: `pdel:${n}` }],
      [{ text: "\u2190 \u041A \u0446\u0435\u043D\u0430\u043C", data: "p" }]
    ]
  ];
}
function promoMenu(c) {
  const p = c.prices.promo;
  return [
    `<b>\u0410\u043A\u0446\u0438\u044F \u043D\u0430 \u0441\u0430\u0439\u0442\u0435</b>
${esc(p.name)}: ${rub(p.price)} \u0432\u043C\u0435\u0441\u0442\u043E ${rub(p.oldPrice)}
\u041F\u043E\u0434\u043F\u0438\u0441\u044C: ${esc(p.note)}`,
    [
      [{ text: "\u270F\uFE0F \u0426\u0435\u043D\u0430", data: "q:prp" }, { text: "\u270F\uFE0F \u0421\u0442\u0430\u0440\u0430\u044F \u0446\u0435\u043D\u0430", data: "q:pro" }],
      [{ text: "\u270F\uFE0F \u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435", data: "q:prn" }, { text: "\u270F\uFE0F \u041F\u043E\u0434\u043F\u0438\u0441\u044C", data: "q:prt" }],
      [{ text: "\u2190 \u041A \u0446\u0435\u043D\u0430\u043C", data: "p" }]
    ]
  ];
}
var bookingMenu = (c) => [
  `<b>\u041A\u0443\u0434\u0430 \u0432\u0435\u0434\u0451\u0442 \u043A\u043D\u043E\u043F\u043A\u0430 \xAB\u0417\u0430\u043F\u0438\u0441\u0430\u0442\u044C\u0441\u044F\xBB</b>
${esc(c.booking)}`,
  [[{ text: "\u270F\uFE0F \u0417\u0430\u043C\u0435\u043D\u0438\u0442\u044C \u0441\u0441\u044B\u043B\u043A\u0443", data: "q:bk" }], [{ text: "\u{1F517} \u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0441\u0441\u044B\u043B\u043A\u0443", url: c.booking }], [{ text: "\u2190 \u041C\u0435\u043D\u044E", data: "m" }]]
];
function contactsMenu(c) {
  const soc = Object.entries(SOCIALS).map(([k, l]) => `${l}: ${c.socials[k] ? esc(c.socials[k]) : "\u2014 (\u043D\u0435 \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442\u0441\u044F)"}`);
  return [
    `<b>\u041A\u043E\u043D\u0442\u0430\u043A\u0442\u044B</b>
\u0422\u0435\u043B\u0435\u0444\u043E\u043D: ${esc(c.phone)}
\u0410\u0434\u0440\u0435\u0441: ${esc(c.address.street)}, ${esc(c.address.hint)}
\u041C\u0435\u0442\u0440\u043E: ${esc(c.address.metro)}, ${esc(c.address.metroDistance)}
\u0427\u0430\u0441\u044B: ${esc(c.hours.label)} (${c.hours.open}\u2013${c.hours.close})

${soc.join("\n")}`,
    [
      [{ text: "\u{1F4DE} \u0422\u0435\u043B\u0435\u0444\u043E\u043D", data: "q:phone" }, { text: "\u{1F550} \u0427\u0430\u0441\u044B", data: "q:hours" }],
      [{ text: "\u{1F4CD} \u0410\u0434\u0440\u0435\u0441", data: "q:street" }, { text: "\u{1F6AA} \u041A\u0430\u043A \u0432\u043E\u0439\u0442\u0438", data: "q:hint" }],
      [{ text: "\u24C2\uFE0F \u041C\u0435\u0442\u0440\u043E", data: "q:metro" }, { text: "\u{1F6B6} \u0421\u043A\u043E\u043B\u044C\u043A\u043E \u0438\u0434\u0442\u0438", data: "q:metrodist" }],
      ...chunk(Object.entries(SOCIALS).map(([k, l]) => ({ text: l, data: `q:soc:${k}` })), 3),
      [{ text: "\u2190 \u041C\u0435\u043D\u044E", data: "m" }]
    ]
  ];
}
function photosMenu(c) {
  return [
    `<b>\u0424\u043E\u0442\u043E \u0440\u0430\u0431\u043E\u0442</b> \u2014 ${c.lookbook.length} \u0448\u0442. \u043D\u0430 \u0441\u0430\u0439\u0442\u0435.
\u041D\u0430\u0436\u043C\u0438\u0442\u0435 \u043D\u0430 \u0444\u043E\u0442\u043E, \u0447\u0442\u043E\u0431\u044B \u043F\u043E\u0441\u043C\u043E\u0442\u0440\u0435\u0442\u044C, \u043F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u0442\u044C, \u043F\u0435\u0440\u0435\u0434\u0432\u0438\u043D\u0443\u0442\u044C \u0438\u043B\u0438 \u0443\u0434\u0430\u043B\u0438\u0442\u044C.`,
    [
      [{ text: "\u2795 \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0444\u043E\u0442\u043E", data: "q:phadd" }],
      ...chunk(c.lookbook.map((p, n) => ({ text: `${n + 1}. ${short(p.tag)}`, data: `phi:${n}` })), 2),
      [{ text: "\u2190 \u041C\u0435\u043D\u044E", data: "m" }]
    ]
  ];
}
var photoKb = (n, total) => [
  [{ text: "\u270F\uFE0F \u041F\u043E\u0434\u043F\u0438\u0441\u044C", data: `q:phtag:${n}` }],
  [...n > 0 ? [{ text: "\u2B05\uFE0F \u0420\u0430\u043D\u044C\u0448\u0435", data: `phup:${n}` }] : [], ...n < total - 1 ? [{ text: "\u041F\u043E\u0437\u0436\u0435 \u27A1\uFE0F", data: `phdn:${n}` }] : []],
  [{ text: "\u{1F5D1} \u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0441 \u0441\u0430\u0439\u0442\u0430", data: `phdel:${n}` }],
  [{ text: "\u2190 \u041A \u0444\u043E\u0442\u043E", data: "ph" }]
];
function barbersMenu(c) {
  return [
    `<b>\u041C\u0430\u0441\u0442\u0435\u0440\u0430 \u043D\u0430 \u0441\u0430\u0439\u0442\u0435</b>
${c.barbers.map((b, n) => `${n + 1}. ${esc(b.name)} \u2014 ${esc(b.role)}${b.photo ? " \u{1F4F7}" : " (\u0431\u0435\u0437 \u0444\u043E\u0442\u043E)"}`).join("\n")}

\u041D\u0430\u0436\u043C\u0438\u0442\u0435 \u043D\u0430 \u043C\u0430\u0441\u0442\u0435\u0440\u0430, \u0447\u0442\u043E\u0431\u044B \u0438\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0438\u043C\u044F, \u0441\u043F\u0435\u0446\u0438\u0430\u043B\u0438\u0437\u0430\u0446\u0438\u044E \u0438\u043B\u0438 \u0444\u043E\u0442\u043E.`,
    [
      ...chunk(c.barbers.map((b, n) => ({ text: `${b.photo ? "\u{1F4F7} " : ""}${b.name}`, data: `bi:${n}` })), 2),
      [{ text: "\u2795 \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043C\u0430\u0441\u0442\u0435\u0440\u0430", data: "q:badd" }],
      [{ text: "\u2190 \u041C\u0435\u043D\u044E", data: "m" }]
    ]
  ];
}
var barberKb = (c, n) => [
  [{ text: "\u270F\uFE0F \u0418\u043C\u044F", data: `q:bname:${n}` }, { text: "\u270F\uFE0F \u0427\u0435\u043C \u0437\u0430\u043D\u0438\u043C\u0430\u0435\u0442\u0441\u044F", data: `q:brole:${n}` }],
  [{ text: c.barbers[n].photo ? "\u{1F4F7} \u0417\u0430\u043C\u0435\u043D\u0438\u0442\u044C \u0444\u043E\u0442\u043E" : "\u{1F4F7} \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0444\u043E\u0442\u043E", data: `q:bphoto:${n}` }],
  ...c.barbers[n].photo ? [[{ text: "\u2716\uFE0F \u0423\u0431\u0440\u0430\u0442\u044C \u0444\u043E\u0442\u043E", data: `bpx:${n}` }]] : [],
  [{ text: "\u{1F5D1} \u0423\u0431\u0440\u0430\u0442\u044C \u043C\u0430\u0441\u0442\u0435\u0440\u0430 \u0441 \u0441\u0430\u0439\u0442\u0430", data: `bdel:${n}` }],
  [{ text: "\u2190 \u041A \u043C\u0430\u0441\u0442\u0435\u0440\u0430\u043C", data: "br" }]
];
var ratingMenu = (c) => [
  `<b>\u0420\u0435\u0439\u0442\u0438\u043D\u0433 \u043D\u0430 \u0441\u0430\u0439\u0442\u0435</b>
${c.rating.value.toFixed(1)} \xB7 ${c.rating.votes} \u043E\u0446\u0435\u043D\u043E\u043A \xB7 ${c.rating.reviews} \u043E\u0442\u0437\u044B\u0432\u043E\u0432
(\u043F\u0435\u0440\u0435\u043F\u0438\u0448\u0438\u0442\u0435 \u0446\u0438\u0444\u0440\u044B \u0438\u0437 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438 \u043D\u0430 \u042F\u043D\u0434\u0435\u043A\u0441 \u041A\u0430\u0440\u0442\u0430\u0445)`,
  [[{ text: "\u2B50 \u041E\u0446\u0435\u043D\u043A\u0430", data: "q:rv" }, { text: "\u041E\u0446\u0435\u043D\u043E\u043A", data: "q:rvo" }, { text: "\u041E\u0442\u0437\u044B\u0432\u043E\u0432", data: "q:rre" }], [{ text: "\u2190 \u041C\u0435\u043D\u044E", data: "m" }]]
];
async function adminsMenu() {
  const a = await readAdmins();
  return [
    `<b>\u0414\u043E\u0441\u0442\u0443\u043F \u043A \u0431\u043E\u0442\u0443</b>
\u0412\u043B\u0430\u0434\u0435\u043B\u0435\u0446: @${esc(a.owner)}
${a.users.length ? a.users.map((u, n) => `${n + 1}. ${esc(userLabel(u))}${u.id ? "" : " \u2014 \u0435\u0449\u0451 \u043D\u0435 \u0437\u0430\u0445\u043E\u0434\u0438\u043B"}`).join("\n") : "\u0411\u043E\u043B\u044C\u0448\u0435 \u043D\u0438 \u0443 \u043A\u043E\u0433\u043E \u0434\u043E\u0441\u0442\u0443\u043F\u0430 \u043D\u0435\u0442."}`,
    [
      [{ text: "\u2795 \u0414\u0430\u0442\u044C \u0434\u043E\u0441\u0442\u0443\u043F", data: "q:adadd" }],
      ...a.users.map((u, n) => [{ text: `\u{1F5D1} \u0423\u0431\u0440\u0430\u0442\u044C ${userLabel(u)}`, data: `addel:${n}` }]),
      [{ text: "\u2190 \u041C\u0435\u043D\u044E", data: "m" }]
    ]
  ];
}
var QUESTIONS = {
  pprice: (c, a) => [`\u041D\u043E\u0432\u0430\u044F \u0446\u0435\u043D\u0430 \u0434\u043B\u044F \xAB${esc(c.prices.items[+a]?.name)}\xBB, \u0442\u043E\u043B\u044C\u043A\u043E \u0447\u0438\u0441\u043B\u043E:`, "2800"],
  pname: (c, a) => [`\u041D\u043E\u0432\u043E\u0435 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0432\u043C\u0435\u0441\u0442\u043E \xAB${esc(c.prices.items[+a]?.name)}\xBB:`],
  pfirst: (c, a) => [`\u0426\u0435\u043D\u0430 \u0432 \u043F\u0435\u0440\u0432\u044B\u0439 \u0440\u0430\u0437 \u0434\u043B\u044F \xAB${esc(c.prices.items[+a]?.name)}\xBB, \u0442\u043E\u043B\u044C\u043A\u043E \u0447\u0438\u0441\u043B\u043E:`, "3170"],
  padd: () => ["\u041D\u043E\u0432\u0430\u044F \u0443\u0441\u043B\u0443\u0433\u0430 \u0432 \u0444\u043E\u0440\u043C\u0430\u0442\u0435 <b>\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u2014 \u0446\u0435\u043D\u0430</b>:", "\u041A\u0430\u043C\u0443\u0444\u043B\u044F\u0436 \u0441\u0435\u0434\u0438\u043D\u044B \u2014 1500"],
  pdate: () => ["\u041F\u043E\u0434\u043F\u0438\u0441\u044C \u043D\u0430\u0434 \u0446\u0435\u043D\u0430\u043C\u0438, \u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440 \xAB\u0446\u0435\u043D\u044B \u043D\u0430 1 \u0434\u0435\u043A\u0430\u0431\u0440\u044F\xBB:", "\u0446\u0435\u043D\u044B \u043D\u0430 1 \u0434\u0435\u043A\u0430\u0431\u0440\u044F"],
  prp: () => ["\u0426\u0435\u043D\u0430 \u043F\u043E \u0430\u043A\u0446\u0438\u0438, \u0442\u043E\u043B\u044C\u043A\u043E \u0447\u0438\u0441\u043B\u043E:", "2170"],
  pro: () => ["\u0421\u0442\u0430\u0440\u0430\u044F (\u0437\u0430\u0447\u0451\u0440\u043A\u043D\u0443\u0442\u0430\u044F) \u0446\u0435\u043D\u0430, \u0442\u043E\u043B\u044C\u043A\u043E \u0447\u0438\u0441\u043B\u043E:", "2600"],
  prn: () => ["\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0430\u043A\u0446\u0438\u0438:", "\u041F\u0435\u0440\u0432\u0430\u044F \u0441\u0442\u0440\u0438\u0436\u043A\u0430"],
  prt: () => ["\u041F\u043E\u0434\u043F\u0438\u0441\u044C \u043F\u043E\u0434 \u0446\u0435\u043D\u043E\u0439 \u0430\u043A\u0446\u0438\u0438:", "\u0434\u043B\u044F \u0442\u0435\u0445, \u043A\u0442\u043E \u0443 \u043D\u0430\u0441 \u0432\u043F\u0435\u0440\u0432\u044B\u0435"],
  bk: () => ["\u041F\u0440\u0438\u0448\u043B\u0438\u0442\u0435 \u043D\u043E\u0432\u0443\u044E \u0441\u0441\u044B\u043B\u043A\u0443 \u0434\u043B\u044F \u043A\u043D\u043E\u043F\u043A\u0438 \xAB\u0417\u0430\u043F\u0438\u0441\u0430\u0442\u044C\u0441\u044F\xBB (YCLIENTS, DIKIDI, Telegram \u0438 \u0442. \u043F.):", "https://..."],
  phone: () => ["\u041D\u043E\u0432\u044B\u0439 \u0442\u0435\u043B\u0435\u0444\u043E\u043D:", "+7 (901) 901-63-63"],
  hours: () => ["\u0427\u0430\u0441\u044B \u0440\u0430\u0431\u043E\u0442\u044B \u0432 \u0444\u043E\u0440\u043C\u0430\u0442\u0435 <b>11:00\u201322:00</b> (\u043A\u0430\u0436\u0434\u044B\u0439 \u0434\u0435\u043D\u044C):", "11:00\u201322:00"],
  street: () => ["\u0410\u0434\u0440\u0435\u0441 (\u0443\u043B\u0438\u0446\u0430 \u0438 \u0434\u043E\u043C):", "\u041D\u0430\u0445\u0438\u043C\u043E\u0432\u0441\u043A\u0438\u0439 \u043F\u0440\u043E\u0441\u043F\u0435\u043A\u0442, 40"],
  hint: () => ["\u041A\u0430\u043A \u043A \u0432\u0430\u043C \u0432\u043E\u0439\u0442\u0438 (\u043E\u0434\u043D\u0430 \u043A\u043E\u0440\u043E\u0442\u043A\u0430\u044F \u0444\u0440\u0430\u0437\u0430):", "\u0432\u0445\u043E\u0434 \u0447\u0435\u0440\u0435\u0437 \u0446\u0432\u0435\u0442\u043E\u0447\u043D\u044B\u0439"],
  metro: () => ["\u0411\u043B\u0438\u0436\u0430\u0439\u0448\u0435\u0435 \u043C\u0435\u0442\u0440\u043E:", "\u041F\u0440\u043E\u0444\u0441\u043E\u044E\u0437\u043D\u0430\u044F"],
  metrodist: () => ["\u0421\u043A\u043E\u043B\u044C\u043A\u043E \u0438\u0434\u0442\u0438 \u043E\u0442 \u043C\u0435\u0442\u0440\u043E:", "200 \u043C"],
  soc: (_c, a) => [`\u0421\u0441\u044B\u043B\u043A\u0430 \u043D\u0430 ${SOCIALS[a] ?? a}. \u041E\u0442\u043F\u0440\u0430\u0432\u044C\u0442\u0435 \xAB-\xBB, \u0447\u0442\u043E\u0431\u044B \u0443\u0431\u0440\u0430\u0442\u044C \u0441 \u0441\u0430\u0439\u0442\u0430:`, "https://..."],
  phadd: () => ["\u041F\u0440\u0438\u0448\u043B\u0438\u0442\u0435 <b>\u0444\u043E\u0442\u043E \u043E\u0442\u0432\u0435\u0442\u043E\u043C \u043D\u0430 \u044D\u0442\u043E \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435</b>. \u0412 \u043F\u043E\u0434\u043F\u0438\u0441\u0438 \u043A \u0444\u043E\u0442\u043E \u043D\u0430\u043F\u0438\u0448\u0438\u0442\u0435 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0441\u0442\u0440\u0438\u0436\u043A\u0438 (\u043C\u043E\u0436\u043D\u043E \u0431\u0435\u0437 \u043F\u043E\u0434\u043F\u0438\u0441\u0438).", "\u0424\u043E\u0442\u043E + \u043F\u043E\u0434\u043F\u0438\u0441\u044C"],
  phtag: (c, a) => [`\u041D\u043E\u0432\u0430\u044F \u043F\u043E\u0434\u043F\u0438\u0441\u044C \u0434\u043B\u044F \u0444\u043E\u0442\u043E \u2116${+a + 1} (\u0441\u0435\u0439\u0447\u0430\u0441: \xAB${esc(c.lookbook[+a]?.tag)}\xBB):`, "\u043A\u0443\u0434\u0440\u044F\u0432\u044B\u0439 \u0431\u043B\u043E\u043D\u0434"],
  bname: (c, a) => [`\u0418\u043C\u044F \u043C\u0430\u0441\u0442\u0435\u0440\u0430 \u0432\u043C\u0435\u0441\u0442\u043E \xAB${esc(c.barbers[+a]?.name)}\xBB:`],
  brole: (c, a) => [`\u0427\u0435\u043C \u0437\u0430\u043D\u0438\u043C\u0430\u0435\u0442\u0441\u044F ${esc(c.barbers[+a]?.name)}:`, "\u0421\u0442\u0440\u0438\u0436\u043A\u0438, \u0431\u043E\u0440\u043E\u0434\u0430"],
  badd: () => ["\u041D\u043E\u0432\u044B\u0439 \u043C\u0430\u0441\u0442\u0435\u0440 \u0432 \u0444\u043E\u0440\u043C\u0430\u0442\u0435 <b>\u0418\u043C\u044F \u2014 \u0447\u0435\u043C \u0437\u0430\u043D\u0438\u043C\u0430\u0435\u0442\u0441\u044F</b>:", "\u041A\u043E\u043B\u044F \u2014 \u0441\u0442\u0440\u0438\u0436\u043A\u0438, \u0444\u0435\u0439\u0434\u044B"],
  bphoto: (c, a) => [`\u041F\u0440\u0438\u0448\u043B\u0438\u0442\u0435 <b>\u0444\u043E\u0442\u043E ${esc(c.barbers[+a]?.name)} \u043E\u0442\u0432\u0435\u0442\u043E\u043C \u043D\u0430 \u044D\u0442\u043E \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435</b>. \u041B\u0443\u0447\u0448\u0435 \u0432\u0435\u0440\u0442\u0438\u043A\u0430\u043B\u044C\u043D\u043E\u0435, \u043B\u0438\u0446\u043E \u043F\u043E \u0446\u0435\u043D\u0442\u0440\u0443.`, "\u0424\u043E\u0442\u043E \u043C\u0430\u0441\u0442\u0435\u0440\u0430"],
  rv: () => ["\u041E\u0446\u0435\u043D\u043A\u0430 \u043D\u0430 \u042F\u043D\u0434\u0435\u043A\u0441 \u041A\u0430\u0440\u0442\u0430\u0445, \u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440 4.9:", "5.0"],
  rvo: () => ["\u0421\u043A\u043E\u043B\u044C\u043A\u043E \u043E\u0446\u0435\u043D\u043E\u043A:", "134"],
  rre: () => ["\u0421\u043A\u043E\u043B\u044C\u043A\u043E \u043E\u0442\u0437\u044B\u0432\u043E\u0432:", "117"],
  adadd: () => ["\u041A\u043E\u043C\u0443 \u0434\u0430\u0442\u044C \u0434\u043E\u0441\u0442\u0443\u043F? \u041F\u0440\u0438\u0448\u043B\u0438\u0442\u0435 <b>@\u043D\u0438\u043A</b> \u0432 Telegram \u0438\u043B\u0438 \u0447\u0438\u0441\u043B\u043E\u0432\u043E\u0439 ID.\n\u0427\u0435\u043B\u043E\u0432\u0435\u043A\u0443 \u043D\u0443\u0436\u043D\u043E \u0431\u0443\u0434\u0435\u0442 \u043D\u0430\u043F\u0438\u0441\u0430\u0442\u044C \u0431\u043E\u0442\u0443 /start.", "@username"]
};
var num = (s, min = 1, max = 1e6) => {
  const n = Number(s.replace(/[^\d]/g, ""));
  if (!s.match(/\d/) || !Number.isFinite(n) || n < min || n > max) throw new UserError("\u041D\u0443\u0436\u043D\u043E \u0447\u0438\u0441\u043B\u043E, \u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440 2800.");
  return n;
};
var text = (s, max = 120) => {
  const t = s.trim().replace(/\s+/g, " ");
  if (!t) throw new UserError("\u041F\u0443\u0441\u0442\u043E\u0439 \u0442\u0435\u043A\u0441\u0442. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0435\u0449\u0451 \u0440\u0430\u0437.");
  if (t.length > max) throw new UserError(`\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u0434\u043B\u0438\u043D\u043D\u043E, \u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C ${max} \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432.`);
  return t;
};
var link = (s) => {
  const t = s.trim();
  if (!/^https?:\/\/\S+\.\S+/.test(t)) throw new UserError("\u041D\u0443\u0436\u043D\u0430 \u0441\u0441\u044B\u043B\u043A\u0430, \u043D\u0430\u0447\u0438\u043D\u0430\u044E\u0449\u0430\u044F\u0441\u044F \u0441 https://");
  return t;
};
var nameAndRest = (s) => {
  const m = s.split(/\s+[—–-]\s+/);
  if (m.length < 2) throw new UserError("\u041D\u0443\u0436\u0435\u043D \u0444\u043E\u0440\u043C\u0430\u0442 \xAB\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u2014 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435\xBB, \u0447\u0435\u0440\u0435\u0437 \u0442\u0438\u0440\u0435.");
  return [text(m[0], 60), m.slice(1).join(" \u2014 ")];
};
async function photoFromMessage(msg) {
  const sizes = msg.photo;
  const doc = msg.document && /^image\/(jpe?g)$/.test(msg.document.mime_type) ? msg.document : void 0;
  if (!sizes?.length && !doc) throw new UserError("\u041D\u0435 \u0432\u0438\u0436\u0443 \u0444\u043E\u0442\u043E. \u041D\u0430\u0436\u043C\u0438\u0442\u0435 \u043A\u043D\u043E\u043F\u043A\u0443 \u0435\u0449\u0451 \u0440\u0430\u0437 \u0438 \u043F\u0440\u0438\u0448\u043B\u0438\u0442\u0435 \u043A\u0430\u0440\u0442\u0438\u043D\u043A\u0443 \u043E\u0442\u0432\u0435\u0442\u043E\u043C \u043D\u0430 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u0431\u043E\u0442\u0430.");
  const fileId = doc ? doc.file_id : sizes.reduce((a, b) => b.width > a.width ? b : a).file_id;
  const bytes = await tg.fileBytes(fileId);
  if (bytes.length > 15 * 1024 * 1024) throw new UserError("\u0424\u043E\u0442\u043E \u0441\u043B\u0438\u0448\u043A\u043E\u043C \u0431\u043E\u043B\u044C\u0448\u043E\u0435 (\u0431\u043E\u043B\u044C\u0448\u0435 15 \u041C\u0411).");
  return bytes;
}
var stamp = () => (/* @__PURE__ */ new Date()).toISOString().replace(/\D/g, "").slice(0, 14);
async function applyAnswer(key, value, msg, from) {
  const [q, arg = ""] = key.split(":");
  return applyGeneric(q, arg, Number(arg), value, msg, from, ` (${who(from)})`);
}
async function applyGeneric(q, arg, n, value, msg, from, by) {
  const save2 = (what, fn) => saveContent(`\u0411\u043E\u0442: ${what}${by}`, fn);
  switch (q) {
    case "pprice":
      await save2("\u0446\u0435\u043D\u0430 \u0443\u0441\u043B\u0443\u0433\u0438", (c) => {
        c.prices.items[n].price = num(value);
      });
      return [SAVED, back(`pi:${n}`)];
    case "pname":
      await save2("\u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0443\u0441\u043B\u0443\u0433\u0438", (c) => {
        c.prices.items[n].name = text(value, 40);
      });
      return [SAVED, back(`pi:${n}`)];
    case "pfirst":
      await save2("\u0446\u0435\u043D\u0430 \u0432 \u043F\u0435\u0440\u0432\u044B\u0439 \u0440\u0430\u0437", (c) => {
        c.prices.items[n].firstVisit = num(value);
      });
      return [SAVED, back(`pi:${n}`)];
    case "padd": {
      const [name, price] = nameAndRest(value);
      await save2(`\u043D\u043E\u0432\u0430\u044F \u0443\u0441\u043B\u0443\u0433\u0430 \xAB${name}\xBB`, (c) => {
        c.prices.items.push({ name: text(name, 40), price: num(price) });
      });
      return [SAVED, back("p", "\u2190 \u041A \u0446\u0435\u043D\u0430\u043C")];
    }
    case "pdate":
      await save2("\u0434\u0430\u0442\u0430 \u0446\u0435\u043D", (c) => {
        c.prices.date = text(value, 40);
      });
      return [SAVED, back("p", "\u2190 \u041A \u0446\u0435\u043D\u0430\u043C")];
    case "prp":
      await save2("\u0446\u0435\u043D\u0430 \u0430\u043A\u0446\u0438\u0438", (c) => {
        c.prices.promo.price = num(value);
      });
      return [SAVED, back("pp")];
    case "pro":
      await save2("\u0441\u0442\u0430\u0440\u0430\u044F \u0446\u0435\u043D\u0430 \u0430\u043A\u0446\u0438\u0438", (c) => {
        c.prices.promo.oldPrice = num(value);
      });
      return [SAVED, back("pp")];
    case "prn":
      await save2("\u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0430\u043A\u0446\u0438\u0438", (c) => {
        c.prices.promo.name = text(value, 30);
      });
      return [SAVED, back("pp")];
    case "prt":
      await save2("\u043F\u043E\u0434\u043F\u0438\u0441\u044C \u0430\u043A\u0446\u0438\u0438", (c) => {
        c.prices.promo.note = text(value, 60);
      });
      return [SAVED, back("pp")];
    case "bk":
      await save2("\u0441\u0441\u044B\u043B\u043A\u0430 \xAB\u0417\u0430\u043F\u0438\u0441\u0430\u0442\u044C\u0441\u044F\xBB", (c) => {
        c.booking = link(value);
      });
      return [SAVED, back("bk")];
    case "phone": {
      const digits = value.replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 12) throw new UserError("\u041F\u043E\u0445\u043E\u0436\u0435, \u044D\u0442\u043E \u043D\u0435 \u0442\u0435\u043B\u0435\u0444\u043E\u043D. \u041F\u0440\u0438\u043C\u0435\u0440: +7 (901) 901-63-63");
      await save2("\u0442\u0435\u043B\u0435\u0444\u043E\u043D", (c) => {
        c.phone = text(value, 30);
      });
      return [SAVED, back("c")];
    }
    case "hours": {
      const m = value.match(/(\d{1,2})(?::(\d{2}))?\s*[—–-]\s*(\d{1,2})(?::(\d{2}))?/);
      if (!m) throw new UserError("\u041D\u0443\u0436\u0435\u043D \u0444\u043E\u0440\u043C\u0430\u0442 11:00\u201322:00");
      const hh = (h, mm) => `${h.padStart(2, "0")}:${mm ?? "00"}`;
      const open = hh(m[1], m[2]), close = hh(m[3], m[4]);
      const short2 = (h, mm) => mm && mm !== "00" ? `${+h}:${mm}` : String(+h);
      await save2("\u0447\u0430\u0441\u044B \u0440\u0430\u0431\u043E\u0442\u044B", (c) => {
        c.hours = { label: `\u043A\u0430\u0436\u0434\u044B\u0439 \u0434\u0435\u043D\u044C ${short2(m[1], m[2])}\u2013${short2(m[3], m[4])}`, open, close };
      });
      return [SAVED, back("c")];
    }
    case "street":
      await save2("\u0430\u0434\u0440\u0435\u0441", (c) => {
        c.address.street = text(value, 60);
      });
      return [SAVED, back("c")];
    case "hint":
      await save2("\u043A\u0430\u043A \u0432\u043E\u0439\u0442\u0438", (c) => {
        c.address.hint = text(value, 40);
      });
      return [SAVED, back("c")];
    case "metro":
      await save2("\u043C\u0435\u0442\u0440\u043E", (c) => {
        c.address.metro = text(value, 30);
      });
      return [SAVED, back("c")];
    case "metrodist":
      await save2("\u0440\u0430\u0441\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u043E\u0442 \u043C\u0435\u0442\u0440\u043E", (c) => {
        c.address.metroDistance = text(value, 20);
      });
      return [SAVED, back("c")];
    case "soc":
      await save2(`\u0441\u0441\u044B\u043B\u043A\u0430 ${SOCIALS[arg] ?? arg}`, (c) => {
        c.socials[arg] = value.trim() === "-" ? "" : link(value);
      });
      return [SAVED, back("c")];
    case "phtag":
      await save2("\u043F\u043E\u0434\u043F\u0438\u0441\u044C \u0444\u043E\u0442\u043E", (c) => {
        c.lookbook[n].tag = text(value, 30);
        c.lookbook[n].alt = text(value, 30);
      });
      return [SAVED, back(`phi:${n}`)];
    case "phadd": {
      const bytes = await photoFromMessage(msg);
      const tag = msg.caption ? text(msg.caption, 30) : "\u0440\u0430\u0431\u043E\u0442\u0430 \u043C\u0430\u0441\u0442\u0435\u0440\u0430";
      const name = `lookbook/${stamp()}.jpg`;
      await writeFile(env.siteRepo, `${PHOTOS_DIR}/${name}`, env.siteBranch, bytes, `\u0411\u043E\u0442: \u043D\u043E\u0432\u043E\u0435 \u0444\u043E\u0442\u043E \u0440\u0430\u0431\u043E\u0442\u044B${by}`);
      await save2("\u0444\u043E\u0442\u043E \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E \u043D\u0430 \u0441\u0430\u0439\u0442", (c) => {
        c.lookbook.unshift({ file: name, tag, alt: tag });
      });
      return [`\u0424\u043E\u0442\u043E \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E \u043F\u0435\u0440\u0432\u044B\u043C \u0432 \u043B\u0435\u043D\u0442\u0443 \xAB\u0420\u0430\u0431\u043E\u0442\u044B\xBB. ${SAVED}`, back("ph", "\u2190 \u041A \u0444\u043E\u0442\u043E")];
    }
    case "bphoto": {
      const bytes = await photoFromMessage(msg);
      const name = `barbers/${stamp()}.jpg`;
      await writeFile(env.siteRepo, `${PHOTOS_DIR}/${name}`, env.siteBranch, bytes, `\u0411\u043E\u0442: \u0444\u043E\u0442\u043E \u043C\u0430\u0441\u0442\u0435\u0440\u0430${by}`);
      let old = "";
      const c = await save2("\u0444\u043E\u0442\u043E \u043C\u0430\u0441\u0442\u0435\u0440\u0430 \u043D\u0430 \u0441\u0430\u0439\u0442\u0435", (x) => {
        old = x.barbers[n].photo ?? "";
        x.barbers[n].photo = name;
      });
      if (old.startsWith("barbers/")) await deleteFile(env.siteRepo, `${PHOTOS_DIR}/${old}`, env.siteBranch, `\u0411\u043E\u0442: \u0441\u0442\u0430\u0440\u043E\u0435 \u0444\u043E\u0442\u043E \u043C\u0430\u0441\u0442\u0435\u0440\u0430 \u0443\u0434\u0430\u043B\u0435\u043D\u043E${by}`).catch(() => {
      });
      return [`\u0424\u043E\u0442\u043E ${esc(c.barbers[n].name)} \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u043E. ${SAVED}`, back(`bi:${n}`, "\u2190 \u041A \u043C\u0430\u0441\u0442\u0435\u0440\u0443")];
    }
    case "bname":
      await save2("\u0438\u043C\u044F \u043C\u0430\u0441\u0442\u0435\u0440\u0430", (c) => {
        c.barbers[n].name = text(value, 30);
      });
      return [SAVED, back(`bi:${n}`, "\u2190 \u041A \u043C\u0430\u0441\u0442\u0435\u0440\u0443")];
    case "brole":
      await save2("\u0441\u043F\u0435\u0446\u0438\u0430\u043B\u0438\u0437\u0430\u0446\u0438\u044F \u043C\u0430\u0441\u0442\u0435\u0440\u0430", (c) => {
        c.barbers[n].role = text(value, 60);
      });
      return [SAVED, back(`bi:${n}`, "\u2190 \u041A \u043C\u0430\u0441\u0442\u0435\u0440\u0443")];
    case "badd": {
      const [name, role] = nameAndRest(value);
      await save2(`\u043D\u043E\u0432\u044B\u0439 \u043C\u0430\u0441\u0442\u0435\u0440 ${name}`, (c) => {
        c.barbers.push({ name: text(name, 30), role: text(role, 60) });
      });
      return [SAVED, back("br")];
    }
    case "rv": {
      const v = Number(value.replace(",", "."));
      if (!(v >= 1 && v <= 5)) throw new UserError("\u041E\u0446\u0435\u043D\u043A\u0430 \u043E\u0442 1 \u0434\u043E 5, \u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440 4.9");
      await save2("\u0440\u0435\u0439\u0442\u0438\u043D\u0433", (c) => {
        c.rating.value = Math.round(v * 10) / 10;
      });
      return [SAVED, back("rt")];
    }
    case "rvo":
      await save2("\u0447\u0438\u0441\u043B\u043E \u043E\u0446\u0435\u043D\u043E\u043A", (c) => {
        c.rating.votes = num(value, 0);
      });
      return [SAVED, back("rt")];
    case "rre":
      await save2("\u0447\u0438\u0441\u043B\u043E \u043E\u0442\u0437\u044B\u0432\u043E\u0432", (c) => {
        c.rating.reviews = num(value, 0);
      });
      return [SAVED, back("rt")];
    case "adadd": {
      const label = await addAdmin(value, from);
      return [`\u0413\u043E\u0442\u043E\u0432\u043E, \u0434\u043E\u0441\u0442\u0443\u043F \u0435\u0441\u0442\u044C \u0443 ${esc(label)}. \u041F\u0443\u0441\u0442\u044C \u043E\u0442\u043A\u0440\u043E\u0435\u0442 @ugol361_bot \u0438 \u043D\u0430\u0436\u043C\u0451\u0442 /start.`, back("ad")];
    }
  }
  throw new UserError("\u041D\u0435 \u043F\u043E\u043D\u044F\u043B, \u043A \u0447\u0435\u043C\u0443 \u044D\u0442\u043E\u0442 \u043E\u0442\u0432\u0435\u0442. \u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 /start \u0438 \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0437\u0430\u043D\u043E\u0432\u043E.");
}
async function onButton(data, chatId, messageId, from) {
  const [cmd, arg = ""] = data.split(":");
  const n = Number(arg);
  const by = ` (${who(from)})`;
  const show = async ([html, kb]) => tg.edit(chatId, messageId, html, kb);
  if (cmd === "q") {
    const [q, a = ""] = data.slice(2).split(":");
    const c = await readContent();
    const [html, ph] = QUESTIONS[q](c, a);
    return tg.ask(chatId, `${q}:${a}`, html, ph);
  }
  switch (cmd) {
    case "m":
      return show(mainMenu());
    case "p":
      return show(pricesMenu(await readContent()));
    case "pi":
      return show(priceItemMenu(await readContent(), n));
    case "pa":
      return tg.ask(chatId, "padd:", QUESTIONS.padd(null, "")[0], QUESTIONS.padd(null, "")[1]);
    case "pp":
      return show(promoMenu(await readContent()));
    case "pfx":
      return show(priceItemMenu(await saveContent(`\u0411\u043E\u0442: \u0443\u0431\u0440\u0430\u043D\u0430 \u0446\u0435\u043D\u0430 \u0432 \u043F\u0435\u0440\u0432\u044B\u0439 \u0440\u0430\u0437${by}`, (c) => {
        delete c.prices.items[n].firstVisit;
      }), n));
    case "pup":
      return show(pricesMenu(await saveContent(`\u0411\u043E\u0442: \u043F\u043E\u0440\u044F\u0434\u043E\u043A \u0443\u0441\u043B\u0443\u0433${by}`, (c) => {
        if (n > 0) {
          const it = c.prices.items;
          [it[n - 1], it[n]] = [it[n], it[n - 1]];
        }
      })));
    case "pdel":
      return show([`\u0423\u0434\u0430\u043B\u0438\u0442\u044C \xAB${esc((await readContent()).prices.items[n]?.name)}\xBB \u0438\u0437 \u043F\u0440\u0430\u0439\u0441\u0430?`, [[{ text: "\u{1F5D1} \u0414\u0430, \u0443\u0434\u0430\u043B\u0438\u0442\u044C", data: `pdy:${n}` }, { text: "\u041E\u0442\u043C\u0435\u043D\u0430", data: `pi:${n}` }]]]);
    case "pdy":
      return show(pricesMenu(await saveContent(`\u0411\u043E\u0442: \u0443\u0441\u043B\u0443\u0433\u0430 \u0443\u0434\u0430\u043B\u0435\u043D\u0430${by}`, (c) => {
        if (c.prices.items.length <= 1) throw new UserError("\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u044E\u044E \u0443\u0441\u043B\u0443\u0433\u0443 \u0443\u0434\u0430\u043B\u0438\u0442\u044C \u043D\u0435\u043B\u044C\u0437\u044F.");
        c.prices.items.splice(n, 1);
      })));
    case "bk":
      return show(bookingMenu(await readContent()));
    case "c":
      return show(contactsMenu(await readContent()));
    case "ph":
      return show(photosMenu(await readContent()));
    case "phi": {
      const c = await readContent();
      const p = c.lookbook[n];
      if (!p) return show(photosMenu(c));
      return tg.photo(chatId, photoUrl(p.file), `\u0424\u043E\u0442\u043E \u2116${n + 1} \u0438\u0437 ${c.lookbook.length}
\u041F\u043E\u0434\u043F\u0438\u0441\u044C: <b>${esc(p.tag)}</b>`, photoKb(n, c.lookbook.length));
    }
    case "phup":
    case "phdn": {
      const c = await saveContent(`\u0411\u043E\u0442: \u043F\u043E\u0440\u044F\u0434\u043E\u043A \u0444\u043E\u0442\u043E${by}`, (x) => {
        const to = cmd === "phup" ? n - 1 : n + 1;
        if (to < 0 || to >= x.lookbook.length) return;
        [x.lookbook[to], x.lookbook[n]] = [x.lookbook[n], x.lookbook[to]];
      });
      return tg.send(chatId, `\u0413\u043E\u0442\u043E\u0432\u043E. ${SAVED}`, photosMenu(c)[1]);
    }
    case "phdel":
      return tg.send(chatId, `\u0423\u0431\u0440\u0430\u0442\u044C \u0444\u043E\u0442\u043E \u2116${n + 1} \u0441 \u0441\u0430\u0439\u0442\u0430?`, [[{ text: "\u{1F5D1} \u0414\u0430, \u0443\u0431\u0440\u0430\u0442\u044C", data: `phy:${n}` }, { text: "\u041E\u0442\u043C\u0435\u043D\u0430", data: "ph" }]]);
    case "phy": {
      let removed = "";
      const c = await saveContent(`\u0411\u043E\u0442: \u0444\u043E\u0442\u043E \u0443\u0431\u0440\u0430\u043D\u043E \u0441 \u0441\u0430\u0439\u0442\u0430${by}`, (x) => {
        if (x.lookbook.length <= 1) throw new UserError("\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u0435\u0435 \u0444\u043E\u0442\u043E \u0443\u0431\u0440\u0430\u0442\u044C \u043D\u0435\u043B\u044C\u0437\u044F: \u043B\u0435\u043D\u0442\u0430 \xAB\u0420\u0430\u0431\u043E\u0442\u044B\xBB \u043E\u043F\u0443\u0441\u0442\u0435\u0435\u0442.");
        removed = x.lookbook.splice(n, 1)[0]?.file ?? "";
      });
      if (removed.startsWith("lookbook/")) await deleteFile(env.siteRepo, `${PHOTOS_DIR}/${removed}`, env.siteBranch, `\u0411\u043E\u0442: \u0443\u0434\u0430\u043B\u0451\u043D \u0444\u0430\u0439\u043B \u0444\u043E\u0442\u043E${by}`).catch(() => {
      });
      return show([`\u0424\u043E\u0442\u043E \u0443\u0431\u0440\u0430\u043D\u043E. ${SAVED}`, photosMenu(c)[1]]);
    }
    case "br":
      return show(barbersMenu(await readContent()));
    case "bi": {
      const c = await readContent();
      const b = c.barbers[n];
      if (!b) return show(barbersMenu(c));
      const caption = `<b>${esc(b.name)}</b>
${esc(b.role)}${b.photo ? "" : "\n\n\u0424\u043E\u0442\u043E \u043F\u043E\u043A\u0430 \u043D\u0435\u0442 \u2014 \u043D\u0430 \u0441\u0430\u0439\u0442\u0435 \u0437\u0430\u0433\u043B\u0443\u0448\u043A\u0430."}`;
      return b.photo ? tg.photo(chatId, photoUrl(b.photo), caption, barberKb(c, n)) : show([caption, barberKb(c, n)]);
    }
    case "bpx": {
      let old = "";
      const c = await saveContent(`\u0411\u043E\u0442: \u0444\u043E\u0442\u043E \u043C\u0430\u0441\u0442\u0435\u0440\u0430 \u0443\u0431\u0440\u0430\u043D\u043E${by}`, (x) => {
        old = x.barbers[n].photo ?? "";
        delete x.barbers[n].photo;
      });
      if (old.startsWith("barbers/")) await deleteFile(env.siteRepo, `${PHOTOS_DIR}/${old}`, env.siteBranch, `\u0411\u043E\u0442: \u0443\u0434\u0430\u043B\u0451\u043D \u0444\u0430\u0439\u043B \u0444\u043E\u0442\u043E \u043C\u0430\u0441\u0442\u0435\u0440\u0430${by}`).catch(() => {
      });
      return tg.send(chatId, `\u0424\u043E\u0442\u043E \u0443\u0431\u0440\u0430\u043D\u043E, \u043D\u0430 \u0441\u0430\u0439\u0442\u0435 \u0441\u043D\u043E\u0432\u0430 \u0437\u0430\u0433\u043B\u0443\u0448\u043A\u0430. ${SAVED}`, barberKb(c, n));
    }
    case "bdel":
      return tg.send(chatId, `\u0423\u0431\u0440\u0430\u0442\u044C \u043C\u0430\u0441\u0442\u0435\u0440\u0430 \xAB${esc((await readContent()).barbers[n]?.name)}\xBB \u0441 \u0441\u0430\u0439\u0442\u0430?`, [[{ text: "\u{1F5D1} \u0414\u0430", data: `bdy:${n}` }, { text: "\u041E\u0442\u043C\u0435\u043D\u0430", data: `bi:${n}` }]]);
    case "bdy": {
      let old = "";
      const c = await saveContent(`\u0411\u043E\u0442: \u043C\u0430\u0441\u0442\u0435\u0440 \u0443\u0431\u0440\u0430\u043D${by}`, (x) => {
        old = x.barbers[n]?.photo ?? "";
        x.barbers.splice(n, 1);
      });
      if (old.startsWith("barbers/")) await deleteFile(env.siteRepo, `${PHOTOS_DIR}/${old}`, env.siteBranch, `\u0411\u043E\u0442: \u0443\u0434\u0430\u043B\u0451\u043D \u0444\u0430\u0439\u043B \u0444\u043E\u0442\u043E \u043C\u0430\u0441\u0442\u0435\u0440\u0430${by}`).catch(() => {
      });
      return tg.send(chatId, `\u041C\u0430\u0441\u0442\u0435\u0440 \u0443\u0431\u0440\u0430\u043D. ${SAVED}`, barbersMenu(c)[1]);
    }
    case "rt":
      return show(ratingMenu(await readContent()));
    case "ad":
      return show(await adminsMenu());
    case "addel": {
      const label = await removeAdmin(n, from);
      const [html, kb] = await adminsMenu();
      return show([`\u0414\u043E\u0441\u0442\u0443\u043F \u0443 ${esc(label)} \u043E\u0442\u043E\u0437\u0432\u0430\u043D.

${html}`, kb]);
    }
  }
}
async function handleUpdate(update) {
  const msg = update.message;
  const cb = update.callback_query;
  const from = msg?.from ?? cb?.from;
  const chatId = msg?.chat?.id ?? cb?.message?.chat?.id;
  if (!from || !chatId) return;
  if ((msg?.chat ?? cb?.message?.chat)?.type !== "private") return;
  const access = await checkAccess(from);
  if (!access.ok) {
    if (cb) await tg.answer(cb.id, "\u041D\u0435\u0442 \u0434\u043E\u0441\u0442\u0443\u043F\u0430");
    return tg.send(
      chatId,
      `\u042D\u0442\u043E \u0431\u043E\u0442 \u0434\u043B\u044F \u0443\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u0441\u0430\u0439\u0442\u043E\u043C \u0431\u0430\u0440\u0431\u0435\u0440\u0448\u043E\u043F\u0430 \xAB\u0423\u0433\u043E\u043B 361\xBB. \u0414\u043E\u0441\u0442\u0443\u043F\u0430 \u0443 \u0432\u0430\u0441 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442.

\u041F\u043E\u043F\u0440\u043E\u0441\u0438\u0442\u0435 \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0430 \u0434\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0432\u0430\u0441: ${from.username ? `@${esc(from.username)} \u0438\u043B\u0438 ` : ""}ID <code>${from.id}</code>`
    );
  }
  try {
    if (cb) {
      await tg.answer(cb.id);
      return await onButton(cb.data ?? "m", chatId, cb.message.message_id, from);
    }
    const key = askKey(msg.reply_to_message);
    if (key) {
      const [html2, kb2] = await applyAnswer(key, msg.text ?? msg.caption ?? "", msg, from);
      return await tg.send(chatId, html2, kb2);
    }
    if (msg.photo) return tg.send(chatId, "\u0427\u0442\u043E\u0431\u044B \u0434\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0444\u043E\u0442\u043E \u043D\u0430 \u0441\u0430\u0439\u0442: /start \u2192 \xAB\u0424\u043E\u0442\u043E \u0440\u0430\u0431\u043E\u0442\xBB \u2192 \xAB\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0444\u043E\u0442\u043E\xBB \u0438 \u043F\u0440\u0438\u0448\u043B\u0438\u0442\u0435 \u0444\u043E\u0442\u043E \u043E\u0442\u0432\u0435\u0442\u043E\u043C \u043D\u0430 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u0431\u043E\u0442\u0430.");
    const [html, kb] = mainMenu();
    return tg.send(chatId, html, kb);
  } catch (e) {
    if (e instanceof UserError) return tg.send(chatId, `\u26A0\uFE0F ${esc(e.message)}`);
    console.error(e);
    return tg.send(chatId, "\u26A0\uFE0F \u0427\u0442\u043E-\u0442\u043E \u043F\u043E\u0448\u043B\u043E \u043D\u0435 \u0442\u0430\u043A, \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435 \u043D\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0435\u0449\u0451 \u0440\u0430\u0437 \u0447\u0435\u0440\u0435\u0437 \u043C\u0438\u043D\u0443\u0442\u0443.");
  }
}
var chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
var short = (s) => s.length > 18 ? s.slice(0, 17) + "\u2026" : s;

// src/handler.ts
async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).send("ugol361 bot ok");
  if (req.headers["x-telegram-bot-api-secret-token"] !== env.webhookSecret) return res.status(401).send("nope");
  try {
    const update = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    await handleUpdate(update);
  } catch (e) {
    console.error(e);
  }
  res.status(200).send("ok");
}
export {
  handler as default
};
