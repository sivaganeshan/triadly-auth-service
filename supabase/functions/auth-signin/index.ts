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
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const logger = createLogger("auth-signin", req);

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      logger.logWarn("Missing email or password in request");
      return new Response(
        JSON.stringify({ 
          error: "Email and password are required",
          requestId: logger.requestId,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create Supabase client with service role key for admin operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Authenticate user
    const { data: authData, error: authError } = await logger.withTiming(
      () => supabaseAdmin.auth.signInWithPassword({
        email,
        password,
      }),
      "signInWithPassword"
    );

    if (authError || !authData.session) {
      logger.logError(authError || new Error("Authentication failed"), {
        email,
        authErrorCode: authError?.status,
      });
      return new Response(
        JSON.stringify({ 
          error: authError?.message || "Authentication failed",
          requestId: logger.requestId,
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
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

    // Create httpOnly cookie with custom JWT token
    const cookieOptions = [
      `sb-access-token=${customToken}`,
      "HttpOnly",
      "SameSite=Lax",
      "Path=/",
      `Max-Age=${expires_in || 3600}`,
    ];

    // Add Secure flag in production (HTTPS only)
    if (Deno.env.get("ENVIRONMENT") === "production") {
      cookieOptions.push("Secure");
    }

    const cookieHeader = cookieOptions.join("; ");

    // Set refresh token in separate cookie
    const refreshCookieOptions = [
      `sb-refresh-token=${refresh_token}`,
      "HttpOnly",
      "SameSite=Lax",
      "Path=/",
      "Max-Age=604800", // 7 days
    ];

    if (Deno.env.get("ENVIRONMENT") === "production") {
      refreshCookieOptions.push("Secure");
    }

    const refreshCookieHeader = refreshCookieOptions.join("; ");

    logger.logInfo("Sign in successful", {
      userId: authData.user.id,
      tier,
    });

    // Return user data (without sensitive tokens)
    return new Response(
      JSON.stringify({
        user: {
          id: authData.user.id,
          email: authData.user.email,
          created_at: authData.user.created_at,
          tier,
        },
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Set-Cookie": `${cookieHeader}, ${refreshCookieHeader}`,
        },
      }
    );
  } catch (error) {
    logger.logError(error, {
      operation: "auth-signin",
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

