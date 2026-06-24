// Web Crypto helpers (AOD-25: "PKCE, CSRF state, and constant-time compares are Web Crypto
// one-liners. No axios, no framework."). Pure and dependency-free, so unit-tested without a stack.

const encoder = new TextEncoder();

/** base64url (RFC 4648 §5) with no padding. */
function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

/** A random CSRF state value echoed by the provider (AOD-9 §7.1). */
export function randomState(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

/** A PKCE code_verifier: 32 random bytes -> 43-char base64url (RFC 7636 length bounds). */
export function randomVerifier(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

/** The S256 code_challenge for a verifier: base64url(SHA-256(verifier)). */
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(verifier));
  return base64url(new Uint8Array(digest));
}

export async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = randomVerifier();
  return { verifier, challenge: await pkceChallenge(verifier) };
}

/**
 * Constant-time string compare (the same helper the RevenueCat webhook auth check will reuse,
 * AOD-12 §6.2). The broker uses it to validate the OAuth `state`. Folds the length difference
 * into the result so it does not early-return on unequal lengths.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  const len = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

async function sha256Hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(s));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Stable JSON: object keys sorted recursively; arrays keep order. So {a,b} and {b,a} match. */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

/**
 * The proxy_cache `params_hash`: hex SHA-256 of the canonical JSON of the request params
 * (data-model.md §5.8, AOD-10 §6.3 requestKey). A no-params widget hashes `{}`.
 */
export function paramsHash(params: unknown): Promise<string> {
  return sha256Hex(canonicalJson(params ?? {}));
}
