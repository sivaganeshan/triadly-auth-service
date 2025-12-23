import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode } from "https://deno.land/std@0.168.0/encoding/base64url.ts";

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

  try {
    const url = new URL(req.url);
    const provider = url.searchParams.get("provider") || "google";
    const redirectTo = url.searchParams.get("redirect_to") || Deno.env.get("FRONTEND_URL") || "";

    if (!redirectTo) {
      return new Response(
        JSON.stringify({ error: "redirect_to parameter is required" }),
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
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider as any,
      options: {
        redirectTo: `${Deno.env.get("SUPABASE_FUNCTIONS_URL")}/auth-callback?redirect_to=${encodeURIComponent(redirectTo)}`,
        queryParams: {
          code_challenge: codeChallenge,
          code_challenge_method: codeChallengeMethod,
        },
      },
    });

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

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
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

