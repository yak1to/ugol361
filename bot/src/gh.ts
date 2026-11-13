import { env } from './env.ts';

const api = async (path: string, init: RequestInit = {}) => {
  const r = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${env.ghToken}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'ugol361-bot',
      ...(init.headers ?? {}),
    },
  });
  return r;
};

export type GhFile = { sha: string; text: string };

export async function readFile(repo: string, path: string, branch: string): Promise<GhFile> {
  const r = await api(`/repos/${repo}/contents/${encodeURI(path)}?ref=${branch}`);
  if (!r.ok) throw new Error(`GitHub: не прочитать ${path} (${r.status})`);
  const j: any = await r.json();
  return { sha: j.sha, text: Buffer.from(j.content, 'base64').toString('utf8') };
}

export async function writeFile(repo: string, path: string, branch: string, content: Buffer | string, message: string, sha?: string) {
  const r = await api(`/repos/${repo}/contents/${encodeURI(path)}`, {
    method: 'PUT',
    body: JSON.stringify({
      message,
      branch,
      sha,
      content: (typeof content === 'string' ? Buffer.from(content, 'utf8') : content).toString('base64'),
    }),
  });
  if (r.status === 409 || r.status === 422) throw new ConflictError();
  if (!r.ok) throw new Error(`GitHub: не записать ${path} (${r.status})`);
}

export async function deleteFile(repo: string, path: string, branch: string, message: string) {
  const r = await api(`/repos/${repo}/contents/${encodeURI(path)}?ref=${branch}`);
  if (r.status === 404) return;
  const { sha }: any = await r.json();
  const d = await api(`/repos/${repo}/contents/${encodeURI(path)}`, { method: 'DELETE', body: JSON.stringify({ message, branch, sha }) });
  if (!d.ok && d.status !== 404) throw new Error(`GitHub: не удалить ${path} (${d.status})`);
}

export class ConflictError extends Error {
  constructor() { super('Файл успели изменить одновременно'); }
}

/** Прочитать JSON, изменить, записать. При одновременной правке — перечитать и повторить. */
export async function updateJson<T>(repo: string, path: string, branch: string, message: string, change: (data: T) => void | Promise<void>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const f = await readFile(repo, path, branch);
    const data = JSON.parse(f.text) as T;
    await change(data);
    try {
      await writeFile(repo, path, branch, JSON.stringify(data, null, 2) + '\n', message, f.sha);
      return data;
    } catch (e) {
      if (!(e instanceof ConflictError)) throw e;
    }
  }
  throw new ConflictError();
}
