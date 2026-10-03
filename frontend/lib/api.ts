export const API = process.env.NEXT_PUBLIC_API ?? "/zk-api";

async function failure(res: Response) {
  const type = res.headers.get("content-type") ?? "";
  if (type.includes("application/json")) return new Error(await res.text());
  return new Error(`API unavailable (HTTP ${res.status})`);
}

export async function getJson<T>(path: string, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(`${API}${path}`, { cache: "no-store", headers });
  if (!res.ok) throw await failure(res);
  return res.json() as Promise<T>;
}

export async function postJson<T>(path: string, body: unknown, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await failure(res);
  return res.json() as Promise<T>;
}
