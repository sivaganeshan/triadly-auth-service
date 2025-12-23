import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode } from "https://deno.land/std@0.168.0/encoding/base64url.ts";
import { createLogger } from "../_shared/observability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Generate PKCE code verifier and challenge
function generatePKCE() {
  const codeVerifier = crypto.getRandomValues(new Uint8Array(32));
  const codeVerifierBase64 = encode(codeVerifier);
  
  // For simplicity, we'll use the verifier as challenge (in production, hash it)
  // In real implementation, you'd hash the verifier with SHA256
  return {
    codeVerifier: codeVerifierBase64,
    codeChallenge: codeVerifierBase64,
    codeChallengeMethod: "plain", // Use "S256" in production with proper hashing
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const logger = createLogger("auth-oauth", req);

  try {
    const url = new URL(req.url);
    const provider = url.searchParams.get("provider") || "google";
    const redirectTo = url.searchParams.get("redirect_to") || Deno.env.get("FRONTEND_URL") || "";

    if (!redirectTo) {
      logger.logWarn("Missing redirect_to parameter");
      return new Response(
        JSON.stringify({ 
          error: "redirect_to parameter is required",
          requestId: logger.requestId,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Generate PKCE values
    const { codeVerifier, codeChallenge, codeChallengeMethod } = generatePKCE();

    // Store code verifier in cookie for later use in callback
    const verifierCookieOptions = [
      `oauth-verifier=${codeVerifier}`,
      "HttpOnly",
      "SameSite=Lax",
      "Path=/",
      "Max-Age=600", // 10 minutes
    ];

    if (Deno.env.get("ENVIRONMENT") === "production") {
      verifierCookieOptions.push("Secure");
    }

    // Initiate OAuth flow
    const { data, error } = await logger.withTiming(
      () => supabase.auth.signInWithOAuth({
        provider: provider as any,
        options: {
          redirectTo: `${Deno.env.get("SUPABASE_FUNCTIONS_URL")}/auth-callback?redirect_to=${encodeURIComponent(redirectTo)}`,
          queryParams: {
            code_challenge: codeChallenge,
            code_challenge_method: codeChallengeMethod,
          },
        },
      }),
      "signInWithOAuth"
    );

    if (error) {
      logger.logError(error, {
        provider,
        redirectTo,
      });
      return new Response(
        JSON.stringify({ 
          error: error.message,
          requestId: logger.requestId,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    logger.logInfo("OAuth flow initiated", {
      provider,
    });

    // Return OAuth URL with cookie set
    return new Response(
      JSON.stringify({ url: data.url }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Set-Cookie": verifierCookieOptions.join("; "),
        },
      }
    );
  } catch (error) {
    logger.logError(error, {
      operation: "auth-oauth",
    });
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
        requestId: logger.requestId,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

