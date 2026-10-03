/** Wallet sign-in for member-only API routes. Must match backend/src/walletAuth.js. */
const TTL_MS = 24 * 3600_000;
const REFRESH_MS = 3600_000;

type Token = { message: string; signature: string; expires: number };

const storageKey = (wallet: string) => `zkctf-auth:${wallet}`;

function toB64(bytes: Uint8Array) {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}

function headers(wallet: string, t: Token) {
  return { "x-zkctf-wallet": wallet, "x-zkctf-message": t.message, "x-zkctf-signature": t.signature };
}

/** Cached headers if a valid sign-in exists, otherwise null (never prompts the wallet). */
export function cachedAuth(wallet: string): Record<string, string> | null {
  try {
    const t = JSON.parse(localStorage.getItem(storageKey(wallet)) ?? "null") as Token | null;
    return t && t.expires - Date.now() > REFRESH_MS ? headers(wallet, t) : null;
  } catch {
    return null;
  }
}

/** Returns auth headers, asking the wallet to sign a message if there is no valid cached sign-in. */
export async function walletAuth(
  wallet: string,
  signMessage: ((message: Uint8Array) => Promise<Uint8Array>) | undefined,
): Promise<Record<string, string>> {
  const cached = cachedAuth(wallet);
  if (cached) return cached;
  if (!signMessage) throw new Error("This wallet cannot sign messages.");
  const expires = Date.now() + TTL_MS;
  const text = `ZKCTF Academy sign-in\nwallet: ${wallet}\nexpires: ${new Date(expires).toISOString()}`;
  const bytes = new TextEncoder().encode(text);
  const signature = await signMessage(bytes);
  const token: Token = { message: toB64(bytes), signature: toB64(signature), expires };
  localStorage.setItem(storageKey(wallet), JSON.stringify(token));
  return headers(wallet, token);
}
