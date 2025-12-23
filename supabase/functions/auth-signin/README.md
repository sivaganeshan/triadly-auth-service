# Auth Sign In Edge Function

Handles email/password authentication and sets httpOnly cookies with session tokens.

## Endpoint

`POST /auth-signin`

## Request Body

```json
{
  "email": "user@example.com",
  "password": "userpassword"
}
```

## Response

### Success (200)

```json
{
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

Sets httpOnly cookies:
- `sb-access-token`: Access token (expires based on session)
- `sb-refresh-token`: Refresh token (7 days)

### Error (400/401/500)

```json
{
  "error": "Error message"
}
```

## Environment Variables

- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for admin operations
- `ENVIRONMENT`: "production" or "development" (for Secure cookie flag)

