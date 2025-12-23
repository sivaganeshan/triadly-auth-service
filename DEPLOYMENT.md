# Deployment Guide

## Prerequisites

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link your project:
   ```bash
   supabase link --project-ref your-project-ref
   ```

## Environment Variables

Set these in Supabase Dashboard → Edge Functions → Settings:

- `SUPABASE_URL`: Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
- `SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (for admin operations)
- `FRONTEND_URL`: Your frontend application URL (e.g., `https://yourdomain.com`)
- `ENVIRONMENT`: Set to `"production"` for production (enables Secure cookie flag)

## Deploy Functions

Deploy all functions:
```bash
npm run deploy
```

Or deploy individually:
```bash
npm run deploy:signin
npm run deploy:signup
npm run deploy:oauth
npm run deploy:callback
npm run deploy:signout
npm run deploy:session
```

## CORS Configuration

The Edge Functions include CORS headers, but you may need to configure additional CORS settings in Supabase Dashboard if you encounter issues.

## Frontend Configuration

In your frontend project, set the environment variable:
```
VITE_SUPABASE_FUNCTIONS_URL=https://your-project-ref.supabase.co/functions/v1
```

## Testing

After deployment, test each endpoint:

1. **Sign In**: `POST /auth-signin` with `{ email, password }`
2. **Sign Up**: `POST /auth-signup` with `{ email, password }`
3. **OAuth**: `GET /auth-oauth?provider=google&redirect_to=...`
4. **Session**: `GET /auth-session`
5. **Sign Out**: `POST /auth-signout`

## Monitoring

### Viewing Logs

View logs:
```bash
npm run logs
```

Or for specific function:
```bash
npm run logs:signin
npm run logs:signup
npm run logs:oauth
npm run logs:callback
npm run logs:signout
npm run logs:session
```

### Observability Features

All functions include comprehensive observability:

- **Structured Logging**: JSON-formatted logs with request IDs, timestamps, and metadata
- **Performance Metrics**: Execution time tracking for functions and individual operations
- **Error Tracking**: Full error context including stack traces and request details
- **Request Correlation**: Unique request IDs for tracing requests across logs

### Log Format

Logs are structured as JSON with the following fields:
- `level`: Log level (info, warn, error)
- `timestamp`: ISO 8601 timestamp
- `requestId`: Unique request identifier (UUID)
- `functionName`: Name of the edge function
- `message`: Log message
- `duration`: Execution time in milliseconds
- `method`: HTTP method
- `path`: Request path
- Additional metadata specific to the operation

### Error Responses

Error responses include a `requestId` field that can be used to correlate errors with log entries:

```json
{
  "error": "Authentication failed",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

Use the request ID to search logs and find all related entries for debugging.

### Performance Monitoring

Monitor function performance by checking:
- `duration` field in log entries (total function execution time)
- Operation-specific durations in metadata (e.g., `operationDuration`)
- Look for operations with unusually long durations

### Best Practices

1. **Monitor Error Rates**: Track error-level logs to identify issues
2. **Performance Baselines**: Establish baseline durations for normal operations
3. **Request Correlation**: Use request IDs to trace user journeys
4. **Alert on Errors**: Set up alerts for error-level logs in production

## Troubleshooting

- **Cookies not being set**: Check that `credentials: "include"` is set in frontend fetch calls
- **CORS errors**: Verify CORS headers in Edge Functions and Supabase settings
- **Session not persisting**: Check cookie attributes (HttpOnly, SameSite, Secure)
- **OAuth redirect issues**: Verify `FRONTEND_URL` and callback URL configuration

