# GitHub Repository Description

## Suggested Short Description (for GitHub repo settings)

```
Secure authentication service with httpOnly cookies, JWT tokens, subscription management, and comprehensive observability using Supabase Edge Functions
```

## Alternative Shorter Version

```
Backend auth service with httpOnly cookies, JWT tokens, and subscription tiers using Supabase Edge Functions
```

## Topics/Tags (add these in GitHub repository settings)

- `supabase`
- `authentication`
- `edge-functions`
- `jwt`
- `oauth`
- `http-only-cookies`
- `subscription-management`
- `observability`
- `deno`
- `typescript`
- `serverless`

## How to Add Description to GitHub

### Option 1: Via GitHub Web Interface (Recommended)

1. Go to your repository: https://github.com/sivaganeshan/triadly-auth-service
2. Click on the ⚙️ **Settings** tab (or click the gear icon next to "About" section)
3. Scroll down to the **"About"** section
4. Click the **"Edit"** button next to the description field
5. Paste one of the suggested descriptions above
6. Add topics/tags by clicking "Add topics" and entering the suggested tags
7. Click **"Save changes"**

### Option 2: Via GitHub CLI (if installed)

```bash
# Install GitHub CLI if not installed
# macOS: brew install gh
# Then authenticate: gh auth login

# Update repository description
gh repo edit sivaganeshan/triadly-auth-service --description "Secure authentication service with httpOnly cookies, JWT tokens, subscription management, and comprehensive observability using Supabase Edge Functions"

# Add topics
gh repo edit sivaganeshan/triadly-auth-service --add-topic supabase --add-topic authentication --add-topic edge-functions --add-topic jwt --add-topic oauth --add-topic http-only-cookies --add-topic subscription-management --add-topic observability --add-topic deno --add-topic typescript --add-topic serverless
```

### Option 3: Via GitHub API (using curl)

```bash
# Update description (requires GitHub token)
curl -X PATCH \
  -H "Authorization: token YOUR_GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/sivaganeshan/triadly-auth-service \
  -d '{"description":"Secure authentication service with httpOnly cookies, JWT tokens, subscription management, and comprehensive observability using Supabase Edge Functions"}'
```

## Full Repository Description (for README or About section)

**Triadly Auth Service** is a production-ready backend authentication service built with Supabase Edge Functions. It provides secure authentication endpoints with httpOnly cookies, custom JWT tokens including subscription tiers, OAuth support, and comprehensive observability features.

### Key Features

- 🔐 **Secure Authentication**: httpOnly, SameSite cookies protect against XSS attacks
- 🎫 **Custom JWT Tokens**: Include user subscription tier without database calls
- 🔄 **OAuth Support**: Google OAuth with PKCE flow
- 📊 **Subscription Management**: Built-in tiers (free, plus, pro) with automatic expiration
- 📈 **Observability**: Request IDs, performance metrics, and structured error logging
- ⚡ **Serverless**: Built on Supabase Edge Functions (Deno runtime)

### Tech Stack

- **Runtime**: Deno (Supabase Edge Functions)
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Deployment**: Supabase CLI

