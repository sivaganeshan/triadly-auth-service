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

    if (accessToken) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      // Sign out from Supabase
      await supabase.auth.signOut();
    }

    // Clear cookies
    const clearAccessToken = "sb-access-token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0";
    const clearRefreshToken = "sb-refresh-token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0";

    if (Deno.env.get("ENVIRONMENT") === "production") {
      // In production, we need to set Secure flag when clearing
      return new Response(
        JSON.stringify({ message: "Signed out successfully" }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Set-Cookie": `${clearAccessToken}; Secure, ${clearRefreshToken}; Secure`,
          },
        }
      );
    }

    return new Response(
      JSON.stringify({ message: "Signed out successfully" }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Set-Cookie": `${clearAccessToken}, ${clearRefreshToken}`,
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

