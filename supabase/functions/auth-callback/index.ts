import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { signJWT } from "../_shared/jwt.ts";
import { createLogger } from "../_shared/observability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  const logger = createLogger("auth-callback", req);

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const redirectTo = url.searchParams.get("redirect_to") || Deno.env.get("FRONTEND_URL") || "";

    if (!code) {
      logger.logWarn("Missing code parameter in OAuth callback");
      return Response.redirect(`${redirectTo}?error=missing_code&requestId=${logger.requestId}`, 302);
    }

    // Get code verifier from cookie
    const cookies = req.headers.get("cookie") || "";
    const verifierMatch = cookies.match(/oauth-verifier=([^;]+)/);
    const codeVerifier = verifierMatch ? verifierMatch[1] : null;

    if (!codeVerifier) {
      logger.logWarn("Missing OAuth verifier in cookie");
      return Response.redirect(`${redirectTo}?error=missing_verifier&requestId=${logger.requestId}`, 302);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Exchange code for session
    const { data: authData, error: authError } = await logger.withTiming(
      () => supabase.auth.exchangeCodeForSession(code),
      "exchangeCodeForSession"
    );

    if (authError || !authData.session) {
      logger.logError(authError || new Error("Authentication failed"), {
        hasCode: !!code,
        authErrorCode: authError?.status,
      });
      return Response.redirect(`${redirectTo}?error=${encodeURIComponent(authError?.message || "authentication_failed")}&requestId=${logger.requestId}`, 302);
    }

    const { access_token, refresh_token, expires_in } = authData.session;

    // Fetch user subscription
    const { data: subscription, error: subError } = await logger.withTiming(
      () => supabaseAdmin
        .from("subscriptions")
        .select("tier, expires_at")
        .eq("user_id", authData.user.id)
        .single(),
      "fetchSubscription"
    );

    if (subError) {
      logger.logWarn("Failed to fetch subscription, using default", {
        userId: authData.user.id,
        error: subError.message,
      });
    }

    // Default to 'free' if subscription doesn't exist
    const tier = (subscription?.tier || "free") as "free" | "plus" | "pro";
    const expiresAt = subscription?.expires_at 
      ? Math.floor(new Date(subscription.expires_at).getTime() / 1000)
      : undefined;

    // Create custom JWT with subscription info
    const customToken = await logger.withTiming(
      () => signJWT({
        sub: authData.user.id,
        email: authData.user.email,
        tier,
        expires_at: expiresAt,
      }, expires_in || 3600),
      "signJWT"
    );

    // Set httpOnly cookies
    const cookieOptions = [
      `sb-access-token=${customToken}`,
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

    logger.logInfo("OAuth callback successful", {
      userId: authData.user.id,
      tier,
    });

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
    logger.logError(error, {
      operation: "auth-callback",
    });
    const redirectTo = new URL(req.url).searchParams.get("redirect_to") || Deno.env.get("FRONTEND_URL") || "";
    return Response.redirect(
      `${redirectTo}?error=${encodeURIComponent(error instanceof Error ? error.message : "internal_error")}&requestId=${logger.requestId}`,
      302
    );
  }
});

