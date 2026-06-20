# AdvisorFlow AI Supabase Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Run `supabase/seed.sql` in the SQL editor.
4. Create Auth users for these seeded profile emails, using any secure password you want:
   - `alex.lim@advisorflow.local`
   - `maya.singh@advisorflow.local`
   - `nadia.wong@advisorflow.local`
5. Run `supabase/seed.sql` again after the Auth users exist. The final `update profiles ... from auth.users` statement links each Auth user to the correct profile through `profiles.auth_user_id`.
6. Copy `.env.example` to `.env.local`, then fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
7. Run `supabase/verify-setup.sql` to confirm the table counts and Auth profile links.

The app requires a linked Supabase Auth user when Supabase is configured. Local fallback is disabled unless `VITE_ALLOW_LOCAL_FALLBACK=true` and `VITE_LOCAL_FALLBACK_PASSWORD` are set for offline development.

Client Relationship Intelligence fields live on `clients` so the app can calculate VIP/Gold/Silver/Bronze locally and deterministically:

- Value inputs: `policy_value`, `opportunity_value`, `referral_potential`, `engagement_urgency`, `care_urgency`, `relationship_importance`
- Relationship profile: `personality`, `interests`, `preferred_channel`, `preferred_tone`, `birthday`, `life_event`, `relationship_notes`
- Gift guardrails: VIP capped at RM100, Gold capped at RM50, Silver/Bronze receive care-note suggestions only.

Admin screens are read-only visual dashboards. Advisors own follow-up, consent refresh requests, referrals, and task creation from the app. Consent-locked clients remain masked and recommendation/gift/schedule outputs are blocked until consent is verified.

Recommended Auth test accounts:

- `alex.lim@advisorflow.local` - Advisor
- `maya.singh@advisorflow.local` - Advisor
- `nadia.wong@advisorflow.local` - Admin

Use the same password you choose when creating the Supabase Auth users.
