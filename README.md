# Triadly Auth Service

Backend service for handling authentication with httpOnly sameSite cookies using Supabase Edge Functions.

## Overview

This service provides secure authentication endpoints that store session tokens in httpOnly cookies, protecting against XSS attacks. It acts as a proxy between the frontend and Supabase Auth API.

## Architecture

- **Supabase Edge Functions**: Serverless functions that handle auth operations
- **Cookie-based Sessions**: httpOnly, sameSite cookies for secure token storage
- **OAuth Support**: Google OAuth with PKCE flow

## Setup

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link to your Supabase project:
   ```bash
   supabase link --project-ref your-project-ref
   ```

4. Deploy Edge Functions:
   ```bash
   supabase functions deploy
   ```

## Edge Functions

- `auth-signin`: Email/password sign in
- `auth-signup`: Email/password sign up
- `auth-oauth`: OAuth flow initiation
- `auth-callback`: OAuth callback handler
- `auth-signout`: Sign out and clear session
- `auth-session`: Get current session

## Environment Variables

Set in Supabase dashboard under Edge Functions settings:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (for admin operations)
- `FRONTEND_URL`: Frontend application URL (for CORS and redirects)

## Development

```bash
# Start local Supabase (optional, for local testing)
supabase start

# Deploy functions
supabase functions deploy <function-name>

# View logs
supabase functions logs <function-name>
```

