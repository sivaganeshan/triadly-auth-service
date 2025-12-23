import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyJWT, signJWT } from "../_shared/jwt.ts";
import { createLogger } from "../_shared/observability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const logger = createLogger("auth-session", req);

  try {
    // Get access token from cookie
    const cookies = req.headers.get("cookie") || "";
    const tokenMatch = cookies.match(/sb-access-token=([^;]+)/);
    const accessToken = tokenMatch ? tokenMatch[1] : null;
    const refreshTokenMatch = cookies.match(/sb-refresh-token=([^;]+)/);
    const refreshToken = refreshTokenMatch ? refreshTokenMatch[1] : null;

    if (!accessToken) {
      logger.logInfo("No access token found in cookies");
      return new Response(
        JSON.stringify({ user: null, session: null }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify custom JWT token (no DB call needed)
    const payload = await logger.withTiming(
      () => verifyJWT(accessToken),
      "verifyJWT"
    );

    if (!payload) {
      logger.logWarn("JWT token invalid or expired, attempting refresh");
      // Token invalid or expired, try to refresh if we have refresh token
      if (refreshToken) {
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

        const { data: refreshData, error: refreshError } = await logger.withTiming(
          () => supabase.auth.refreshSession({
            refresh_token: refreshToken,
          }),
          "refreshSession"
        );

        if (!refreshError && refreshData.session) {
          // Fetch subscription for refreshed user
          const { data: subscription } = await logger.withTiming(
            () => supabaseAdmin
              .from("subscriptions")
              .select("tier, expires_at")
              .eq("user_id", refreshData.user.id)
              .single(),
            "fetchSubscription"
          );

          const tier = (subscription?.tier || "free") as "free" | "plus" | "pro";
          const expiresAt = subscription?.expires_at 
            ? Math.floor(new Date(subscription.expires_at).getTime() / 1000)
            : undefined;

          // Create new custom JWT
          const { access_token: newAccessToken, refresh_token: newRefreshToken, expires_in } = refreshData.session;
          const customToken = await logger.withTiming(
            () => signJWT({
              sub: refreshData.user.id,
              email: refreshData.user.email,
              tier,
              expires_at: expiresAt,
            }, expires_in || 3600),
            "signJWT"
          );

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
            `sb-refresh-token=${newRefreshToken}`,
            "HttpOnly",
            "SameSite=Lax",
            "Path=/",
            "Max-Age=604800",
          ];

          if (Deno.env.get("ENVIRONMENT") === "production") {
            refreshCookieOptions.push("Secure");
          }

          logger.logInfo("Session refreshed successfully", {
            userId: refreshData.user.id,
            tier,
          });

          return new Response(
            JSON.stringify({
              user: {
                id: refreshData.user.id,
                email: refreshData.user.email,
                created_at: refreshData.user.created_at,
                tier,
              },
              session: {
                expires_at: refreshData.session.expires_at,
              },
            }),
            {
              status: 200,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
                "Set-Cookie": `${cookieOptions.join("; ")}, ${refreshCookieOptions.join("; ")}`,
              },
            }
          );
        } else {
          logger.logError(refreshError || new Error("Session refresh failed"), {
            hasRefreshToken: !!refreshToken,
          });
        }
      }

      // No valid session
      logger.logInfo("No valid session found");
      return new Response(
        JSON.stringify({ user: null, session: null }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Return user data from JWT payload (no DB call needed)
    logger.logInfo("Session validated successfully", {
      userId: payload.sub,
      tier: payload.tier,
    });

    return new Response(
      JSON.stringify({
        user: {
          id: payload.sub,
          email: payload.email,
          tier: payload.tier,
        },
        session: {
          expires_at: payload.expires_at,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    logger.logError(error, {
      operation: "auth-session",
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

