# Cleen v7 — Password-only login, shared GitHub Pages hosting

This is a FULL replacement of v6 with the same Admin and Daily features, plus a role-specific Edge Function login and corner navigation between sites.

## Site structure
- `docs/index.html` — Daily home
- `docs/tasks.html` — Daily tasks
- `docs/end-of-day.html` — Daily report
- `docs/admin/index.html` — Admin home (also accessible from mobile)
- `docs/config.js` and `docs/admin/config.js` — PUBLIC Supabase URL and PUBLISHABLE key ONLY
- `supabase/functions/cleen-login/index.ts` — server-side password login gateway
- `supabase/config.toml` — deploy function with JWT verification disabled; the function authenticates the supplied password itself

## IMPORTANT: how password-only login works
Use **two dedicated Supabase Auth accounts**: one assigned `admin`, the other assigned `cleaner` in the public.members table. Each gets a strong unique password. Emails are secrets on the Supabase Edge Function, not in browser JS. Users choose Daily or Admin and enter the corresponding password. The Supabase Auth JWT and browser session will still contain the account email **after successful authentication**; only unauthenticated source readers are protected from seeing it. Use non-personal alias emails for these service accounts. A shared Admin password means everyone acts as the SAME admin user, so there is no per-person audit or revocation. For a real multi-admin product, individual accounts and MFA are recommended.

## A. Supabase setup (no database migration)
1. Supabase **Authentication → Users**: create/confirm one Admin user and one Cleaner user with different emails/passwords. Use strong, unique passwords; disable open public signups if you don't need them. Prefer dedicated alias emails, not anyone's personal email.
2. Confirm **Database → Table Editor → members** has their exact Auth user UUIDs, one with role `admin`, the other `cleaner`. Their user IDs must match `auth.users.id` (existing v3 schema). If already assigned, do not change them.
3. Supabase **Settings → API Keys**: copy Project URL and **publishable key** (or legacy anon key if your client project still requires that). Put these in BOTH `docs/config.js` and `docs/admin/config.js`. NEVER use service_role or a secret key.
4. Supabase **Edge Functions → Secrets**: create each of these exact secrets:
   - `CLEEN_ADMIN_EMAIL` = Admin account's full email
   - `CLEEN_CLEANER_EMAIL` = Cleaner account's full email
   - `CLEEN_PUBLISHABLE_KEY` = same public client publishable key
   - `CLEEN_ALLOWED_ORIGIN` = `https://YOUR-USERNAME.github.io` (OR your custom-domain origin, with no trailing slash and no path). Multiple origins may be separated by commas. This is an origin allowlist, not a substitute for password protection.
5. Deploy the Edge Function named **`cleen-login`** using the Supabase CLI from the folder containing this ZIP's `supabase/` directory:
   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase functions deploy cleen-login --no-verify-jwt
   ```
   The function MUST have **Verify JWT disabled**, because there is no signed-in session before login. Supabase Auth still validates the password in the function. The function deliberately rejects calls from origins not in `CLEEN_ALLOWED_ORIGIN`. You can also deploy by pasting `index.ts` into a new Supabase Edge Function `cleen-login` in the Dashboard and turning off Verify JWT in its settings. Ensure the three email/key secrets and origin secret are set first.
6. Check **Authentication → URL Configuration**: Site URL can be `https://YOUR-USERNAME.github.io/cleen/`, with your allowed URLs as needed. The password login itself does not use redirects.

## B. GitHub Pages
1. Make a FRESH repo called `cleen` if the earlier public repo exposed private email addresses. Merely deleting files does not erase old commit history. Note that GitHub forks/caches may still exist; rotate passwords if any password or secret key was ever committed.
2. Upload **the CONTENTS of `docs/`** into a root folder named `docs` in that GitHub repo. Ensure `docs/admin/index.html` exists. Do **not** upload the `supabase/` directory containing any secret values (this ZIP includes code but NO secret values).
3. GitHub repository **Settings → Pages → Deploy from a branch → main → /docs → Save**.
4. Open `https://YOUR-USERNAME.github.io/cleen/` (Daily). Use **Admin ↗** in top corner to access `https://YOUR-USERNAME.github.io/cleen/admin/`. Use **Daily ↗** to go back. Different roles have separate Supabase sessions, so you might have to sign into each once.
5. Test: log in Daily with Cleaner password; expand an item and mark done; upload End of Day report; switch to Admin, enter Admin password; create draft, publish it via Quick Preview, verify it in Daily; export gallery. Test mobile too.

## Security/limits
- GitHub Pages does NOT hide Admin HTML/JS. Anyone can open the Admin LOGIN page; `members` role and RLS must protect all data. Do not put personal emails, passwords, or service/secret keys in client JS or GitHub.
- Edge Function access is protected by Supabase Auth password verification and account-level throttling; the included function does NOT implement an independent per-IP rate-limit or CAPTCHA. Add abuse protection before wider public distribution. An Origin header is not a robust authentication boundary, since non-browser clients can forge it.
- Auth session tokens still include account emails for authenticated visitors. Dedicated alias account emails prevent publishing personal addresses in source, but the emails are not secret to someone who has logged in.
- Do not share the same password for Daily and Admin. Anyone with Admin credentials gets full admin permissions, including delete/clear-photo actions.
- The project needs an HTTPS connection and Supabase CDN to function. An independently hosted Admin is now under `docs/admin`, not the old local `admin/` folder.
- All v6 SQL schema, tasks, photos, RLS, and UI should remain unchanged. No database migration is needed if v3 was previously installed and configured.
- Files have been syntax checked for JS and packaged; actual Supabase deployment, network requests, and GitHub Pages login have NOT been tested against your account.
