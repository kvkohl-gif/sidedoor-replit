// client/src/lib/api.ts
export async function api<T = unknown>(path: string, init: RequestInit = {}) {
  const res = await fetch(path, {
    credentials: "include", // <-- required to send connect.sid
    headers: { "content-type": "application/json", ...(init.headers || {}) },
    ...init,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}