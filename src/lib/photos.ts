import type { ImageMetadata } from 'astro';
const all = import.meta.glob<{ default: ImageMetadata }>('../assets/photos/**/*.jpg', { eager: true });
export function photo(file: string): ImageMetadata {
  const hit = all[`../assets/photos/raw/${file}`] ?? all[`../assets/photos/${file}`];
  if (!hit) throw new Error(`Нет фото: ${file}`);
  return hit.default;
}
