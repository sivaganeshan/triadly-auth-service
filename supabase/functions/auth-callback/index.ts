import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const redirectTo = url.searchParams.get("redirect_to") || Deno.env.get("FRONTEND_URL") || "";

    if (!code) {
      return Response.redirect(`${redirectTo}?error=missing_code`, 302);
    }

    // Get code verifier from cookie
    const cookies = req.headers.get("cookie") || "";
    const verifierMatch = cookies.match(/oauth-verifier=([^;]+)/);
    const codeVerifier = verifierMatch ? verifierMatch[1] : null;

    if (!codeVerifier) {
      return Response.redirect(`${redirectTo}?error=missing_verifier`, 302);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Exchange code for session
    const { data: authData, error: authError } = await supabase.auth.exchangeCodeForSession(code);

    if (authError || !authData.session) {
      return Response.redirect(`${redirectTo}?error=${encodeURIComponent(authError?.message || "authentication_failed")}`, 302);
    }

    const { access_token, refresh_token, expires_in } = authData.session;

    // Set httpOnly cookies
    const cookieOptions = [
      `sb-access-token=${access_token}`,
      "HttpOnly",
      "SameSite=Lax",
      "Path=/",
      `Max-Age=${expires_in || 3600}`,
    ];

    if (Deno.env.get("ENVIRONMENT") === "production") {
      cookieOptions.push("Secure");
    }

    const refreshCookieOptions = [
      `sb-refresh-token=${refresh_token}`,
      "HttpOnly",
      "SameSite=Lax",
      "Path=/",
      "Max-Age=604800",
    ];

    if (Deno.env.get("ENVIRONMENT") === "production") {
      refreshCookieOptions.push("Secure");
    }

    // Clear OAuth verifier cookie
    const clearVerifierCookie = "oauth-verifier=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0";

    // Redirect to frontend with success
    return Response.redirect(
      `${redirectTo}?auth=success`,
      302,
      {
        headers: {
          "Set-Cookie": `${cookieOptions.join("; ")}, ${refreshCookieOptions.join("; ")}, ${clearVerifierCookie}`,
        },
      }
    );
  } catch (error) {
    const redirectTo = new URL(req.url).searchParams.get("redirect_to") || Deno.env.get("FRONTEND_URL") || "";
    return Response.redirect(
      `${redirectTo}?error=${encodeURIComponent(error instanceof Error ? error.message : "internal_error")}`,
      302
    );
  }
});

