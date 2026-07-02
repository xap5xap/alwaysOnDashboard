// Unit tests for the Edge env access (AOD-9 §5.4), specifically the EDGE_DB_URL local escape
// hatch (AOD-78, supabase/postgres#1447): set -> it wins dbUrl; unset -> SUPABASE_DB_URL keeps
// winning (the hosted posture, where the var never exists). No stack.

import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { loadEnv } from "./env.ts";

const CORE = {
  SUPABASE_URL: "http://kong.test",
  SUPABASE_ANON_KEY: "anon-test",
  SUPABASE_SERVICE_ROLE_KEY: "service-test",
  SUPABASE_DB_URL: "postgresql://postgres:postgres@supabase_db_test:5432/postgres",
};

describe("loadEnv dbUrl (AOD-78 EDGE_DB_URL escape hatch)", () => {
  const saved = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of [...Object.keys(CORE), "EDGE_DB_URL"]) {
      saved.set(key, Deno.env.get(key));
    }
    for (const [key, value] of Object.entries(CORE)) Deno.env.set(key, value);
    Deno.env.delete("EDGE_DB_URL");
  });

  afterEach(() => {
    for (const [key, value] of saved) {
      if (value === undefined) Deno.env.delete(key);
      else Deno.env.set(key, value);
    }
  });

  it("falls back to SUPABASE_DB_URL when EDGE_DB_URL is unset (the hosted posture)", () => {
    assertEquals(loadEnv().dbUrl, CORE.SUPABASE_DB_URL);
  });

  it("prefers EDGE_DB_URL when set (the local DNS workaround)", () => {
    Deno.env.set("EDGE_DB_URL", "postgresql://postgres:postgres@172.18.0.1:54322/postgres");
    assertEquals(loadEnv().dbUrl, "postgresql://postgres:postgres@172.18.0.1:54322/postgres");
  });

  it("ignores an empty EDGE_DB_URL (falls back)", () => {
    Deno.env.set("EDGE_DB_URL", "");
    assertEquals(loadEnv().dbUrl, CORE.SUPABASE_DB_URL);
  });
});
