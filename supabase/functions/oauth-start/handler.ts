// oauth-start (AOD-9 §6, §7.1): build the provider authorize URL, generate state + PKCE verifier,
// persist an oauth_transactions row, return the URL. The app opens it in a system browser.

import { deriveUser } from "../_shared/auth.ts";
import { pkcePair, randomState } from "../_shared/crypto.ts";
import { loadEnv, oauthClientCreds } from "../_shared/env.ts";
import { errorResponse, HttpError, json, methodGuard, parseBody, readJson } from "../_shared/http.ts";
import { buildAuthorizeUrl } from "../_shared/providers.ts";
import { getBackend } from "../_shared/registry.ts";
import { OauthStartSchema } from "../_shared/schemas.ts";
import { serviceClient } from "../_shared/supabase.ts";

export async function handler(req: Request): Promise<Response> {
  try {
    methodGuard(req, "POST");
    const user = await deriveUser(req);
    const { service } = parseBody(OauthStartSchema, await readJson(req));

    const backend = getBackend(service);
    if (backend.authClass !== "oauth2" || !backend.oauth) {
      throw new HttpError(400, "not_oauth2", `${service} does not use oauth2`);
    }

    const env = loadEnv();
    const state = randomState();
    const pkce = backend.oauth.supportsPkce ? await pkcePair() : { verifier: null, challenge: null };

    const { error } = await serviceClient().from("oauth_transactions").insert({
      user_id: user.id,
      service,
      state,
      code_verifier: pkce.verifier,
      expires_at: new Date(Date.now() + 600_000).toISOString(), // ~10 min (AOD-9 §5.2)
    });
    if (error) throw new HttpError(500, "db_error", error.message);

    const { clientId } = oauthClientCreds(service);
    const authorizeUrl = buildAuthorizeUrl(backend, {
      clientId,
      state,
      codeChallenge: pkce.challenge,
      redirectUri: `${env.callbackBaseUrl}/oauth-callback`,
    });
    return json({ authorizeUrl });
  } catch (e) {
    return errorResponse(e);
  }
}
