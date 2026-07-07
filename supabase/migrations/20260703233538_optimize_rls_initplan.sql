-- Migration: optimize_rls_initplan
-- Source: Supabase performance advisor (auth_rls_initplan), noticed while standing up the hosted
--         production project (AOD-82); out of scope there, taken as this clean follow-up.
--
-- A bare auth.uid() in an RLS predicate is re-evaluated once PER ROW. Wrapping it as a scalar
-- subquery `(select auth.uid())` lets the planner hoist it into an InitPlan evaluated ONCE per
-- statement. This is Supabase's documented remediation:
--   https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
--
-- Pure performance optimization; semantics are IDENTICAL. auth.uid() is STABLE, so the scalar
-- subquery yields the same single uuid (or NULL when unauthenticated), and every USING / WITH CHECK
-- predicate evaluates exactly as before. The six owner-CRUD policies from 20260623190300_rls.sql
-- (§8.2) are altered in place with ALTER POLICY, which rewrites only the expressions and leaves each
-- policy's command (FOR ALL / FOR SELECT) and roles untouched; that applied migration is left
-- unedited (forward-only, §9). widget_instances and kiosk_configs wrap the INNER auth.uid() in their
-- parent-ownership subquery too, so the dashboards lookup is hoisted as well, not re-run per row.

-- Server-written, owner-readable (SELECT-only, USING only).
alter policy connections_select_own on public.connections
  using (user_id = (select auth.uid()));
alter policy entitlements_select_own on public.entitlements
  using (user_id = (select auth.uid()));

-- Client-authored, owner CRUD.
alter policy dashboards_rw_own on public.dashboards
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
alter policy user_settings_rw_own on public.user_settings
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Client-authored with a parent-ownership cross-check. Both the outer and the inner (subquery)
-- auth.uid() are wrapped.
alter policy widget_instances_rw_own on public.widget_instances
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and dashboard_id in (select id from public.dashboards where user_id = (select auth.uid()))
  );
alter policy kiosk_configs_rw_own on public.kiosk_configs
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and dashboard_id in (select id from public.dashboards where user_id = (select auth.uid()))
  );
