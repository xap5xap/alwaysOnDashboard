// Edge runtime entrypoint. The handler is in handler.ts so it can be imported side-effect-free
// under `deno test` (testing-strategy.md §5.2, §11); only this file calls Deno.serve.
import { handler } from "./handler.ts";

Deno.serve(handler);
