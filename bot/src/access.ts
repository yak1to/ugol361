import { env } from './env.ts';
import { readFile, updateJson } from './gh.ts';

const PATH = 'admins.json';
export type AdminUser = { id?: number; username?: string; addedBy: string; addedAt: string };
export type Admins = { owner: string; ownerId: number | null; users: AdminUser[] };
export type From = { id: number; username?: string; first_name?: string };

const norm = (u?: string) => (u ?? '').replace(/^@/, '').toLowerCase();

export const readAdmins = async () => JSON.parse((await readFile(env.adminRepo, PATH, env.adminBranch)).text) as Admins;

const save = (message: string, change: (a: Admins) => void) => updateJson<Admins>(env.adminRepo, PATH, env.adminBranch, message, change);

export const isOwner = (a: Admins, f: From) => norm(f.username) === norm(a.owner) || (a.ownerId !== null && a.ownerId === f.id);

/**
 * Есть ли доступ. Если человека добавили по @нику и он пишет впервые —
 * запоминаем его числовой ID (ник можно сменить, ID — нет).
 */
export async function checkAccess(f: From): Promise<{ ok: boolean; owner: boolean }> {
  const a = await readAdmins();
  if (isOwner(a, f)) {
    if (a.ownerId !== f.id) await save(`Бот: привязан ID владельца`, (x) => { x.ownerId = f.id; });
    return { ok: true, owner: true };
  }
  const byId = a.users.find((u) => u.id === f.id);
  if (byId) return { ok: true, owner: false };
  const byName = f.username ? a.users.find((u) => !u.id && norm(u.username) === norm(f.username)) : undefined;
  if (byName) {
    await save(`Бот: привязан ID для @${norm(f.username)}`, (x) => {
      const u = x.users.find((v) => !v.id && norm(v.username) === norm(f.username));
      if (u) u.id = f.id;
    });
    return { ok: true, owner: false };
  }
  return { ok: false, owner: false };
}

/** Добавить по «@ник», «ник» или числовому ID. */
export async function addAdmin(input: string, by: From): Promise<string> {
  const raw = input.trim().replace(/^https?:\/\/t\.me\//i, '');
  const asId = /^\d{5,15}$/.test(raw) ? Number(raw) : undefined;
  const asName = !asId && /^@?[a-zA-Z][a-zA-Z0-9_]{3,31}$/.test(raw) ? norm(raw) : undefined;
  if (!asId && !asName) throw new UserError('Нужен @ник в Telegram (например, @ivan_barber) или числовой ID.');
  let label = '';
  await save(`Бот: доступ для ${asName ? '@' + asName : asId} (добавил @${norm(by.username) || by.id})`, (a) => {
    if (asName && norm(a.owner) === asName) throw new UserError('Это владелец, у него уже есть доступ.');
    if (a.users.some((u) => (asId && u.id === asId) || (asName && norm(u.username) === asName))) throw new UserError('У этого человека уже есть доступ.');
    a.users.push({ ...(asId ? { id: asId } : { username: asName }), addedBy: norm(by.username) || String(by.id), addedAt: new Date().toISOString().slice(0, 10) });
    label = asName ? '@' + asName : String(asId);
  });
  return label;
}

export async function removeAdmin(index: number, by: From): Promise<string> {
  let label = '';
  await save(`Бот: доступ отозван (сделал @${norm(by.username) || by.id})`, (a) => {
    const u = a.users[index];
    if (!u) throw new UserError('Такого человека в списке уже нет.');
    if (u.id === by.id) throw new UserError('Себя удалить нельзя — попросите другого администратора.');
    label = userLabel(u);
    a.users.splice(index, 1);
  });
  return label;
}

export const userLabel = (u: AdminUser) => (u.username ? `@${u.username}` : `ID ${u.id}`) + (u.username && u.id ? ` (ID ${u.id})` : '');

/** Ошибка, текст которой можно показать человеку. */
export class UserError extends Error {}
