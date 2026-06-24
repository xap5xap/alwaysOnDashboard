// Pure unit tests for the Web Crypto helpers (testing-strategy.md §4.2). No stack: runs on push.

import { describe, it } from "@std/testing/bdd";
import { assert, assertEquals, assertNotEquals } from "@std/assert";
import { paramsHash, pkceChallenge, pkcePair, randomState, timingSafeEqual } from "./crypto.ts";

describe("crypto: PKCE", () => {
  it("derives the RFC 7636 Appendix B test-vector challenge", async () => {
    // The canonical RFC 7636 example pins S256(verifier) == challenge.
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const challenge = await pkceChallenge(verifier);
    assertEquals(challenge, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("pkcePair returns a verifier whose S256 challenge matches", async () => {
    const { verifier, challenge } = await pkcePair();
    assert(verifier.length >= 43, "verifier meets RFC 7636 minimum length");
    assertEquals(challenge, await pkceChallenge(verifier));
  });

  it("randomState is url-safe and unique per call", () => {
    const a = randomState();
    const b = randomState();
    assertNotEquals(a, b);
    assert(/^[A-Za-z0-9_-]+$/.test(a), "state is base64url");
  });
});

describe("crypto: timingSafeEqual", () => {
  it("returns true for equal strings", () => {
    assert(timingSafeEqual("super-secret-state", "super-secret-state"));
  });
  it("returns false for unequal strings of equal length", () => {
    assert(!timingSafeEqual("abcdef", "abcdeg"));
  });
  it("returns false for strings of different length", () => {
    assert(!timingSafeEqual("short", "shorter"));
  });
});

describe("crypto: paramsHash", () => {
  it("is order-independent over object keys", async () => {
    assertEquals(await paramsHash({ a: 1, b: 2 }), await paramsHash({ b: 2, a: 1 }));
  });
  it("differs for different params", async () => {
    assertNotEquals(await paramsHash({ projectId: "x" }), await paramsHash({ projectId: "y" }));
  });
  it("a no-params widget hashes {} to a stable 64-char hex", async () => {
    const h = await paramsHash({});
    assertEquals(h, await paramsHash(undefined));
    assert(/^[0-9a-f]{64}$/.test(h), "hex sha-256");
  });
});
