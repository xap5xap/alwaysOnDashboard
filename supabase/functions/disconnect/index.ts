// Edge runtime entrypoint. The handler lives in handler.ts for side-effect-free import under
// `deno test`; only this file calls Deno.serve. withCors answers the browser OPTIONS preflight and
// adds CORS headers so web clients (Expo web) can call this function. Native clients do no preflight
// and are unaffected.
import { handler } from "./handler.ts";
import { withCors } from "../_shared/http.ts";

Deno.serve(withCors(handler));
