// The /oauth/done route: the OAuth callback COLD-START fallback (app-ia.md §8.1). The `vela://oauth/done`
// deep-link (scheme `vela`, already in app.json) resolves here when the OS delivers it as a launch/foreground
// link rather than to an active auth session (the primary in-session capture is AOD-28's connect action).
// Thin: delegates to the src/ screen, which reads { service, status } and routes to Settings -> Connections.
export { OAuthDone as default } from '../../src/screens/OAuthDone';
