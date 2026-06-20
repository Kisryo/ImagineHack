# Deploying Compass

## Vercel (one-click)

1. Push this repo to GitHub.
2. Import the repo in Vercel — it auto-detects Next.js, region pinned to Singapore (`sin1`).
3. Add env vars in Vercel Project Settings → Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`
   - `OPENAI_API_KEY`
4. Deploy. Live URL is the demo URL.

Without env vars set, the app runs in **demo mode** with seeded data and heuristic extraction — useful for the pitch dry-run.

## Supabase

1. Create a new Supabase project (Singapore region).
2. SQL Editor → run in order:
   - `supabase/schema.sql`
   - `supabase/seed.sql`
   - `supabase/functions.sql`
3. Copy the project URL and anon + service-role keys into Vercel env vars.
4. Auth → Users → invite `aisyah@compass.demo` (or whatever advisor email you'll demo with).

## Local

```bash
cp .env.example .env.local   # fill keys (all optional in demo mode)
npm install
npm run dev
```
