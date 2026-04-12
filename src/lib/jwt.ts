
// src/lib/jwt.ts

type JwtPayload = {
  iss?: string;
  aud?: string;
  sub?: string;
  iat?: number;
  exp?: number;
  [k: string]: any;
};

function base64urlEncode(data: Uint8Array) {
  let str = "";
  for (const b of data) str += String.fromCharCode(b);
  return btoa(str).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64urlDecode(str: string) {
  const pad = "=".repeat((4 - (str.length % 4)) % 4);
  const base64 = (str + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(base64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

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

  const enc = new TextEncoder();
  const headerPart = base64urlEncode(enc.encode(JSON.stringify(header)));
  const payloadPart = base64urlEncode(enc.encode(JSON.stringify(payload)));
  const data = `${headerPart}.${payloadPart}`;

  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  const signature = base64urlEncode(new Uint8Array(sig));

  return `${data}.${signature}`;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token format");

  const [headerPart, payloadPart, signaturePart] = parts;
  const data = `${headerPart}.${payloadPart}`;

  const key = await hmacKey(secret);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64urlDecode(signaturePart),
    new TextEncoder().encode(data)
  );

  if (!valid) throw new Error("Invalid signature");

  const payloadJson = new TextDecoder().decode(base64urlDecode(payloadPart));
  const payload = JSON.parse(payloadJson) as JwtPayload;

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) {
    throw new Error("Token expired");
  }

  return payload;
}


