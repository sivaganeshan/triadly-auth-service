// Shared JWT utility for signing and validating tokens with subscription info
import { encode as base64UrlEncode, decode as base64UrlDecode } from "https://deno.land/std@0.168.0/encoding/base64url.ts";

export interface JWTPayload {
  sub: string; // user id
  email?: string;
  tier: "free" | "plus" | "pro";
  expires_at?: number; // Unix timestamp
  iat: number; // issued at
  exp: number; // expiration
}

/**
 * Sign a JWT token with subscription information
 */
export async function signJWT(payload: Omit<JWTPayload, "iat" | "exp">, expiresIn: number = 3600): Promise<string> {
  const secret = Deno.env.get("JWT_SECRET") || Deno.env.get("SUPABASE_JWT_SECRET") || "";
  
  if (!secret) {
    throw new Error("JWT_SECRET or SUPABASE_JWT_SECRET environment variable is required");
  }

  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn,
  };

  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  
  // Create HMAC signature
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signatureInput)
  );

  const encodedSignature = base64UrlEncode(new Uint8Array(signature));

  return `${signatureInput}.${encodedSignature}`;
}

/**
 * Verify and decode a JWT token
 */
export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const secret = Deno.env.get("JWT_SECRET") || Deno.env.get("SUPABASE_JWT_SECRET") || "";
    
    if (!secret) {
      throw new Error("JWT_SECRET or SUPABASE_JWT_SECRET environment variable is required");
    }

    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;

    // Verify signature
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signatureBytes = base64UrlDecode(encodedSignature);

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      new TextEncoder().encode(signatureInput)
    );

    if (!isValid) {
      return null;
    }

    // Decode payload
    const payloadBytes = base64UrlDecode(encodedPayload);
    const payloadJson = new TextDecoder().decode(payloadBytes);
    const payload: JWTPayload = JSON.parse(payloadJson);

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch (error) {
    console.error("JWT verification error:", error);
    return null;
  }
}

