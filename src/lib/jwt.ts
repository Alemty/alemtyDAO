
// src/lib/jwt.ts
type JwtPayload = Record<string, any>;

function toBase64(b64url: string) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (b64.length % 4)) % 4;
  return b64 + "=".repeat(pad);
}

const b64url = {
  encode: (input: Uint8Array | string) => {
    const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
    let str = "";
    for (const b of bytes) str += String.fromCharCode(b);
    return btoa(str).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  },
  decodeToBytes: (input: string) => {
    const bin = atob(toBase64(input));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  },
  decodeJson: <T = any>(input: string): T => {
    const bytes = b64url.decodeToBytes(input);
    const text = new TextDecoder().decode(bytes);
    return JSON.parse(text) as T;
  },
};

async function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signJwt(payload: JwtPayload, secret: string) {
  const header = { alg: "HS256", typ: "JWT" };
  const h = b64url.encode(JSON.stringify(header));
  const p = b64url.encode(JSON.stringify(payload));
  const data = `${h}.${p}`;

  const key = await hmacKey(secret);
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const sig = b64url.encode(new Uint8Array(sigBuf));

  return `${data}.${sig}`;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [h, p, s] = parts;

  const header = b64url.decodeJson(h);
  if (header?.alg !== "HS256") return null;

  const data = `${h}.${p}`;
  const sigBytes = b64url.decodeToBytes(s);

  const key = await hmacKey(secret);
  const ok = await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(data));
  if (!ok) return null;

  const payload = b64url.decodeJson<JwtPayload>(p);
  const now = Math.floor(Date.now() / 1000);
  if (payload?.exp && now > payload.exp) return null;

  return payload;
}

