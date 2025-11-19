// client/src/lib/api.ts
export async function api<T = unknown>(path: string, init: RequestInit = {}) {
  const res = await fetch(path, {
    credentials: 'include', // ensure cookie is sent
    headers: { 'content-type': 'application/json', ...(init.headers || {}) },
    ...init,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.headers.get('content-type')?.includes('application/json')
    ? await res.json() as T
    : (await res.text() as unknown as T);
}