# Supabase Setup

Groups sync through Supabase. Until the two env vars below are set, the app uses a fake server kept in `localStorage`, so everything works on one machine: open two browser tabs to act as two phones. The design is in [GROUP-LEDGER.md](GROUP-LEDGER.md).

## 1. Create the project

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard). The free tier is enough. Pick the region nearest your users (Singapore: `ap-southeast-1`).
2. In **Project Settings → API**, copy the **Project URL** and the **anon public** key.

## 2. Turn on sign-in

In **Authentication → Sign In / Providers**:

1. Turn on **Allow anonymous sign-ins**. This is how a friend joins with no account.
2. Leave **Email** on, with **Confirm email** on.

In **Authentication → Emails → Templates**, make both **Magic Link** and **Change Email Address** show the code, because the app asks for the 6-digit code rather than following a link. Add `{{ .Token }}` to each template body, for example:

```html
<p>Your Split code is <strong>{{ .Token }}</strong></p>
```

In **Authentication → URL Configuration**, set **Site URL** to where Split is deployed, and add `http://localhost:5173` under **Redirect URLs** for local development.

Anonymous sign-ins can be abused to create many users. Turn on **Authentication → Attack Protection → CAPTCHA** (Cloudflare Turnstile) before sharing the app widely. The app doesn't send a captcha token yet, so turning it on needs a small change in `src/features/group-ledger/backend/supabaseBackend.ts`.

## 3. Create the tables

The schema, row level security and functions are in `supabase/migrations/`. Either:

- **Dashboard:** open **SQL Editor**, paste the migration file, and run it once.
- **CLI:** `pnpm dlx supabase login`, `pnpm dlx supabase link --project-ref <ref>`, then `pnpm dlx supabase db push`.

The migration also adds the `ops` table to the `supabase_realtime` publication, so phones are told about new changes at once.

## 4. Set the env vars

Locally, copy `.env.example` to `.env.local` and fill it in:

```sh
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```

On the host (Netlify or similar), add the same two variables to the build environment and redeploy. The anon key is meant to be public; row level security is what protects the data.

## 5. Check it

1. `pnpm dev`, open the app, create a group. In the dashboard, **Table Editor → ops** shows a `group.created` row.
2. Copy the invite link, open it in a private window, pick a name. Add an expense in one window; it appears in the other within a second.
3. Turn the network off in one window (DevTools → Network → Offline), add an expense, turn it back on. It syncs.

The same contract tests the fake passes can run against the real project, which checks the functions and row level security for real. Use a separate test project, because the tests create groups and anonymous users:

```sh
VITE_CONTRACT_SUPABASE_URL=https://<ref>.supabase.co VITE_CONTRACT_SUPABASE_ANON_KEY=<key> pnpm test backendContract
```

Without those variables the suite runs against the fake and against the migration loaded into an in-process Postgres (PGlite), in `sqlContract.test.ts`.
