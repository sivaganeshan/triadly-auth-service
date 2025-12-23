# Triadly Auth Service

Backend service for handling authentication with httpOnly sameSite cookies using Supabase Edge Functions.

## Overview

This service provides secure authentication endpoints that store session tokens in httpOnly cookies, protecting against XSS attacks. It acts as a proxy between the frontend and Supabase Auth API.

## Architecture

- **Supabase Edge Functions**: Serverless functions that handle auth operations
- **Cookie-based Sessions**: httpOnly, sameSite cookies for secure token storage
- **OAuth Support**: Google OAuth with PKCE flow
- **JWT Tokens**: Custom signed JWT tokens that include user subscription tier (no DB calls needed for validation)
- **Subscription Management**: Built-in subscription tiers (free, plus, pro) with automatic expiration handling
- **Observability**: Comprehensive logging with request IDs, performance metrics, and structured error tracking

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

4. Run database migrations:
   ```bash
   supabase db push
   ```
   This will create the `subscriptions` table with automatic triggers for new users.

5. Deploy Edge Functions:
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
- `SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (for admin operations)
- `JWT_SECRET` or `SUPABASE_JWT_SECRET`: Secret key for signing JWT tokens (use your Supabase JWT secret or generate a new one)
- `FRONTEND_URL`: Frontend application URL (for CORS and redirects)
- `ENVIRONMENT`: Set to `"production"` for production (enables Secure cookie flag)

## Subscriptions

The service includes built-in subscription management with three tiers:

- **free**: Default tier for all new users, no expiration (`expires_at` is NULL)
- **plus**: Premium tier, no expiration (`expires_at` is NULL)
- **pro**: Professional tier, expires after 28 days (`expires_at` is set to 28 days from creation)

### Subscription Table

The `subscriptions` table is automatically created via migration and includes:
- Automatic creation of "free" subscription for new users via database trigger
- Row Level Security (RLS) policies for secure access
- Indexes for fast lookups

### JWT Tokens

Access tokens are custom JWT tokens that include:
- User ID (`sub`)
- Email address
- Subscription tier (`tier`: "free" | "plus" | "pro")
- Subscription expiration (`expires_at`: Unix timestamp or undefined)

This allows validation of user identity and subscription status without database calls. The `auth-session` endpoint validates the JWT and returns user info including subscription tier.

## Observability

All edge functions include comprehensive observability features for error monitoring and debugging:

### Structured Logging

All functions generate structured JSON logs that include:
- **Request ID**: Unique identifier for each request (UUID)
- **Function Name**: Name of the edge function
- **Timestamp**: ISO 8601 formatted timestamp
- **Log Level**: info, warn, or error
- **Message**: Human-readable log message
- **Duration**: Function execution time in milliseconds
- **Metadata**: Additional context (HTTP method, path, user ID, error details, etc.)

### Performance Monitoring

Functions track:
- Total function execution time
- Individual operation durations (auth calls, database queries, JWT operations)
- Operation names for easy identification

### Error Tracking

Errors are logged with full context:
- Error type and message
- Stack traces
- Request context (method, path, user ID when available)
- Operation that failed
- Duration before failure

### Request ID Correlation

Every request receives a unique request ID that:
- Appears in all logs for that request
- Included in error responses for client-side correlation
- Enables tracing requests across multiple log entries

### Using Logs for Debugging

1. **View logs**: Use `supabase functions logs <function-name>` or view in Supabase Dashboard
2. **Filter by request ID**: Search logs for a specific request ID to see all related entries
3. **Monitor errors**: Look for log entries with `"level": "error"` to identify issues
4. **Performance analysis**: Check `duration` fields to identify slow operations

Example log entry:
```json
{
  "level": "error",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "functionName": "auth-signin",
  "message": "Authentication failed",
  "duration": 234,
  "method": "POST",
  "path": "/auth-signin",
  "errorType": "AuthApiError",
  "errorMessage": "Invalid login credentials",
  "email": "user@example.com"
}
```

## Development

```bash
# Start local Supabase (optional, for local testing)
supabase start

# Deploy functions
supabase functions deploy <function-name>

# View logs
supabase functions logs <function-name>
```

