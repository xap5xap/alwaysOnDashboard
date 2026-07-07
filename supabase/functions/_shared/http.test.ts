// Unit tests for withCors (browser CORS on the broker functions, added when the hosted acceptance
// showed Expo web could not call any edge function). OPTIONS is answered with a 204 + CORS headers
// without running the handler; every other response passes through with its status and body intact
// and the CORS headers added. Native clients issue no preflight, so the wrapper is inert for them.

import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { json, withCors } from "./http.ts";

describe("withCors", () => {
  it("answers the OPTIONS preflight with 204 and CORS headers, without calling the handler", async () => {
    let handlerRan = false;
    const wrapped = withCors(() => {
      handlerRan = true;
      return Promise.resolve(json({ ok: true }));
    });
    const res = await wrapped(new Request("https://fn.test", { method: "OPTIONS" }));
    assertEquals(res.status, 204);
    assertEquals(handlerRan, false);
    assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
    assertEquals(res.headers.get("Access-Control-Allow-Methods"), "POST, GET, OPTIONS");
    assertEquals(res.headers.get("Access-Control-Allow-Headers"), "authorization, x-client-info, apikey, content-type");
  });

  it("passes a normal response through with status and body intact, CORS headers added", async () => {
    const wrapped = withCors(() => Promise.resolve(json({ error: "needs_reconnect" }, 409)));
    const res = await wrapped(new Request("https://fn.test", { method: "POST" }));
    assertEquals(res.status, 409);
    assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
    assertEquals(res.headers.get("content-type"), "application/json");
    assertEquals(await res.json(), { error: "needs_reconnect" });
  });
});
