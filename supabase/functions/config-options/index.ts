// Edge runtime entrypoint. Handler lives in handler.ts for side-effect-free import under deno test.
import { handler } from "./handler.ts";

Deno.serve(handler);
