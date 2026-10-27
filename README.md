# Gain Train

A phone-first workout log: start or resume a workout, enter sets, and review progress. Use **Log a past workout** for an earlier session. Routines and previous set values make repeat workouts faster.

Live app: https://antonj997.github.io/gain-train-pwa/

What's new: see [CHANGELOG.md](CHANGELOG.md).

## Features

- Direct set and load controls, bodyweight and assisted loads, timed holds, warm-up and cool-down sets, and set reordering.
- Previous results suggested for each set; routines that pre-fill your last numbers.
- Optional rest timer and haptics; explicit Save/Discard when editing a finished workout.
- History calendar with date ranges; Progress with 30-day stats and per-exercise charts.
- Light and dark themes that follow your phone until you pick one.

## Install and offline use

Open the app once with a connection so it caches, then add it to your home screen. Long-press the icon for the Workout and History shortcuts. Updates download in the background and are offered when you are not in a workout.

Drafts and finished workouts save to IndexedDB on your device before any network request. Drafts save once typing pauses, and a recovery copy is kept on every change. Sign in for cloud sync; if you started without an account, Settings copies that phone log into your signed-in account.

Sync runs while the app is open, when a connection returns and when you come back to the app; a closed mobile app cannot sync in the background. Conflicting edits from two devices wait for your choice in Settings. A change the server refuses is kept on the phone with a Retry in Settings, and if the server has been unreachable for a day the app says so. Export a backup before clearing browser data.

## Run locally

Requires Node 22 or newer.

```sh
npm ci
npm run dev
```

The committed .env contains only the public Supabase URL and browser-safe publishable key. Never add a service-role key to frontend configuration.

```sh
npm run typecheck
npm test
npm run lint
npm run build
```

The optional cloud integration test uses QA_EMAIL and QA_PASSWORD for a disposable confirmed test account. It is skipped when those variables are absent.

## Code map

- `src/data`: the record model and validation (`model.ts`), record queries (`selectors.ts`), IndexedDB (`database.ts`), sync (`sync.ts`), workout helpers and analytics.
- `src/contexts`: providers (`*Context.tsx`) and their hooks (`useData`, `useAuth`, `useProfile`, `useTheme`).
- `src/hooks`: editor and page behaviour, e.g. `useWorkoutAutosave`, `useStartWorkout`, `useRestTimer`.
- `src/lib`: small pure helpers (dates, labels, routes, guarded storage, drafts, sync health).
- `src/components`, `src/pages`: UI. `ConfirmDialog` is the shared confirmation dialog.
- `src/styles`: `reset.css` and `primitives.css` sit under `index.css`; the other files are scoped feature styles.
- `tests`: Node test runner via tsx; component tests render real components with React's server renderer.
- `docs`: specs, plans, review reports and older fix notes.

## Hosting and database

Pushing main deploys to GitHub Pages through the Actions workflow, after typecheck, tests and lint pass. It sets GITHUB_PAGES=true to use /gain-train-pwa/ as the base path.

The Supabase project is opecaiznqmgbsezmtnhb in antonj997's Org, on Free. Its schema is in `supabase/migrations/20260913181407_offline_record_sync.sql` (applied). `20261027090000_prune_sync_receipts.sql` adds 90-day receipt pruning and is applied separately. Older migrations describe the retired Lovable database and remain for reference.

Each workout and its sets sync atomically as one document. Ownership policies isolate accounts. Operation receipts make retries idempotent; revision checks detect conflicts; soft deletion and ordered change cursors support disconnected devices. Records carry a `schemaVersion` so an older app never overwrites what a newer one saved. The service worker never caches authenticated Supabase responses.

Session timestamps and set measure are optional, so older records and backups remain readable. Timed holds store seconds in the numeric reps field with bodyweight load; the UI and analytics distinguish seconds.

### Before inviting friends

- **Email:** Supabase's built-in email only reaches members of your organization and is rate-limited. Configure your own SMTP provider (Authentication → Emails) so friends receive confirmation and password-reset emails. Confirmation URLs are configured for the live app.
- **Pausing:** Supabase may pause an inactive Free project after about a week. Logging continues offline and the app shows a notice; restore the project from the dashboard.
- **Passwords:** enable leaked-password protection in Authentication settings if your plan includes it.

GitHub Pages and Supabase Free have no recurring charge within their limits. References: https://supabase.com/pricing and https://supabase.com/docs/guides/auth/auth-smtp
