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

View logs:
```bash
npm run logs
```

Or for specific function:
```bash
npm run logs:signin
```

## Troubleshooting

- **Cookies not being set**: Check that `credentials: "include"` is set in frontend fetch calls
- **CORS errors**: Verify CORS headers in Edge Functions and Supabase settings
- **Session not persisting**: Check cookie attributes (HttpOnly, SameSite, Secure)
- **OAuth redirect issues**: Verify `FRONTEND_URL` and callback URL configuration

