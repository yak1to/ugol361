/** Путь с учётом base (GitHub Pages живёт в подпапке /ugol361/, Vercel — в корне). */
export const url = (path = '') => `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
