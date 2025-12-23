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

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Sign up user
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: Deno.env.get("FRONTEND_URL") + "/auth/callback",
        },
      });

    if (authError) {
      return new Response(
        JSON.stringify({ error: authError.message }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // If email confirmation is required, return without setting cookies
    if (authData.user && !authData.session) {
      return new Response(
        JSON.stringify({
          user: {
            id: authData.user.id,
            email: authData.user.email,
            created_at: authData.user.created_at,
          },
          requiresConfirmation: true,
          message: "Please check your email to confirm your account",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // If session exists (auto-confirm enabled), set cookies
    if (authData.session) {
      const { access_token, refresh_token, expires_in } = authData.session;

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
            "Set-Cookie": `${cookieOptions.join("; ")}, ${refreshCookieOptions.join("; ")}`,
          },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unexpected response from sign up" }),
      {
        status: 500,
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

