import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get access token from cookie
    const cookies = req.headers.get("cookie") || "";
    const tokenMatch = cookies.match(/sb-access-token=([^;]+)/);
    const accessToken = tokenMatch ? tokenMatch[1] : null;
    const refreshTokenMatch = cookies.match(/sb-refresh-token=([^;]+)/);
    const refreshToken = refreshTokenMatch ? refreshTokenMatch[1] : null;

    if (!accessToken) {
      return new Response(
        JSON.stringify({ user: null, session: null }),
        {
          status: 200,
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
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    // Get user from token
    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      // Try to refresh if we have refresh token
      if (refreshToken) {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
          refresh_token: refreshToken,
        });

        if (!refreshError && refreshData.session) {
          // Update cookies with new tokens
          const { access_token: newAccessToken, refresh_token: newRefreshToken, expires_in } = refreshData.session;

          const cookieOptions = [
            `sb-access-token=${newAccessToken}`,
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

          return new Response(
            JSON.stringify({
              user: {
                id: refreshData.user.id,
                email: refreshData.user.email,
                created_at: refreshData.user.created_at,
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
        }
      }

      // No valid session
      return new Response(
        JSON.stringify({ user: null, session: null }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Return user data
    return new Response(
      JSON.stringify({
        user: {
          id: user.id,
          email: user.email,
          created_at: user.created_at,
        },
        session: {
          expires_at: null, // We don't expose full session details
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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

