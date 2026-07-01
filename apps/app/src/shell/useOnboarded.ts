// The first-run "onboarded" signal (app-ia.md §4.2 / §10: its home is a build detail — a
// user_settings.preferences key, or local state seeded by the first successful connect). This shell
// tech-task fixes the gate PREDICATE (gate.ts) and leaves the real first-run DETECTION to AOD-29's
// onboarding build. The hook returns `true` today, preserving the shipped behaviour (a signed-in user
// goes straight to the dashboard), and is the single swap point where AOD-29 wires the persisted flag.
// The `/onboarding` route already exists (scaffolded by this task); flipping this hook to return `false`
// for a brand-new user routes them through it (the gate's `session + !onboarded -> onboarding` branch,
// exercised in gate.test.ts).
export function useOnboarded(): boolean {
  return true;
}
