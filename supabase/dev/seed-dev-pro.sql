-- Grant the LOCAL dev user (dev@vela.test) a Pro-shaped server tier (AOD-78).
--
-- Why this exists: the AOD-75 dogfood grant (EXPO_PUBLIC_DEV_ENTITLEMENTS=pro) is CLIENT-only.
-- The server resolves entitlements from the persisted row (entitlements.ts serverTier, a missing
-- row = Free), so without this row the dogfood user is Free-shaped server-side: capped at 2
-- connected backend services (connect-limit.ts) and floored to 900s fetch triggers (the proxy).
--
-- This is a LOCAL-ONLY dev convenience, run by hand (npm run db:grant-pro), NEVER a migration:
-- production entitlements are written exclusively by the RevenueCat webhook (AOD-12 section 6.2).
-- supabase/seed.sql stays intentionally empty (data-model.md section 9); this cannot live there
-- anyway, because seed.sql runs at `db reset` time, before the dev user has signed up.
--
-- Idempotent: re-run any time (first setup, and after every `npm run db:reset` + app sign-up).
-- current_period_end stays NULL so serverTier never expires the grant.

do $$
declare
  v_user uuid;
begin
  select id into v_user from auth.users where email = 'dev@vela.test';
  if v_user is null then
    raise exception 'dev@vela.test not found. Start the stack, sign up in the app first (docs/device-build.md), then re-run.';
  end if;

  insert into public.entitlements (user_id, tier, status, current_period_end)
  values (v_user, 'pro', 'active', null)
  on conflict (user_id) do update
    set tier = 'pro', status = 'active', current_period_end = null, updated_at = now();

  raise notice 'dev@vela.test (%) -> tier=pro, status=active, current_period_end=NULL', v_user;
end $$;
