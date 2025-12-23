import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email and password are required" }),
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
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.signInWithPassword({
        email,
        password,
      });

    if (authError || !authData.session) {
      return new Response(
        JSON.stringify({ error: authError?.message || "Authentication failed" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { access_token, refresh_token, expires_in } = authData.session;

    // Create httpOnly cookie with session token
    const cookieOptions = [
      `sb-access-token=${access_token}`,
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

    // Return user data (without sensitive tokens)
    return new Response(
      JSON.stringify({
        user: {
          id: authData.user.id,
          email: authData.user.email,
          created_at: authData.user.created_at,
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

