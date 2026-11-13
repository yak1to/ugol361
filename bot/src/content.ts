import { env } from './env.ts';
import { readFile, updateJson } from './gh.ts';

export const CONTENT_PATH = 'src/content/site.json';
export const PHOTOS_DIR = 'src/assets/photos';

export type PriceItem = { name: string; price: number; firstVisit?: number };
export type Content = {
  address: { street: string; hint: string; metro: string; metroDistance: string };
  phone: string;
  hours: { label: string; open: string; close: string };
  rating: { value: number; votes: number; reviews: number };
  booking: string;
  socials: Record<string, string>;
  prices: { date: string; items: PriceItem[]; promo: { name: string; price: number; oldPrice: number; note: string } };
  lookbook: { file: string; tag: string; alt: string }[];
  barbers: { name: string; role: string }[];
};

export const readContent = async () =>
  JSON.parse((await readFile(env.siteRepo, CONTENT_PATH, env.siteBranch)).text) as Content;

export const saveContent = (message: string, change: (c: Content) => void | Promise<void>) =>
  updateJson<Content>(env.siteRepo, CONTENT_PATH, env.siteBranch, message, change);

/** Публичная ссылка на фото в репозитории — Telegram сам её скачает для превью. */
export const photoUrl = (file: string) =>
  `https://raw.githubusercontent.com/${env.siteRepo}/${env.siteBranch}/${PHOTOS_DIR}/${file.includes('/') ? file : `raw/${file}`}`;

export const rub = (n: number) => `${n.toLocaleString('ru-RU').replace(/\s/g, ' ')} ₽`;
