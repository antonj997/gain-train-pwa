# Gain Train

A phone-first workout log: start or resume a workout, enter sets, and review progress. Use **Log a past workout** for an earlier session. Routines and previous set values make repeat workouts faster.

Live app: https://antonj997.github.io/gain-train-pwa/

The app keeps the original GitHub Pages design and adds direct set/load controls, timed holds, planned routines, retained form drafts, explicit Save/Discard for historical edits and optional rest/haptics. Sets remove immediately; exercises with entered values ask before removal. Toasts appear at the top and span the mobile screen with side margins. Narrow screens use wider cards and compact previous-result dates. Starting another workout asks before replacing the one in progress; history stats remain visible above the explanation. See [design restoration](review-reports/design-restoration.md), [functional improvements](review-reports/implementation-verification.md) and [responsive refinements](review-reports/responsive-refinements.md) for the changes and verification.

## Offline and sync

The 18 October update adds a bodyweight profile, select-all set inputs, compact set reordering, a roomier exercise picker and a current-month history calendar. See [workout usability verification](review-reports/2026-10-18-workout-usability.md) for completed checks and remaining browser/device verification.

Open the app once with a connection to cache it, then add it to your home screen. Drafts and finished workouts save to IndexedDB on your device before any network request. Sign in for cloud sync. If you started without an account, Settings lets you copy that phone log into your signed-in account.

Sync retries while the app is open, when a connection returns, and when you return to the app. A closed mobile app cannot guarantee immediate background sync. Conflicting device edits are preserved for an explicit choice in Settings. Export a backup before clearing browser data.

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

## Hosting and database

Pushing main deploys to GitHub Pages through the existing Actions workflow. It sets GITHUB_PAGES=true to use /gain-train-pwa/ as the application base path.

The replacement Supabase project is opecaiznqmgbsezmtnhb in antonj997's Org, on Free. Its active schema is in supabase/migrations/20260913181407_offline_record_sync.sql. This migration has already been applied to that project. Older migrations describe the retired Lovable database and remain for reference; the replacement project uses gain_records and gain_sync_receipts. No historical data could be recovered from the unavailable original database.

Each workout and its sets sync atomically as one document. Ownership policies isolate accounts. Operation receipts make retries idempotent; revision checks detect conflicts; soft deletion and ordered change cursors support disconnected devices. The app never caches authenticated Supabase HTTP responses in the service worker.

Session timestamps and set measure are optional, so older records/backups remain readable. Timed holds store seconds in the existing numeric reps transport field with bodyweight load; the UI and analytics distinguish seconds. The current server accepts these optional JSON fields without a migration.

GitHub Pages and Supabase Free have no recurring charge within their free limits. Supabase may pause an inactive Free project; restore it in your own dashboard. Local logging continues. Default Supabase email delivery is restricted to organization members; configure your own SMTP provider before inviting unrelated users. Confirmation URLs are configured for the live app.

References: https://supabase.com/pricing and https://supabase.com/docs/guides/auth/auth-smtp

## Review status

Latest local checks: 104 automated tests passed, one live-cloud test skipped; typecheck and the GitHub Pages production build passed; lint has no errors and four development-refresh warnings. The October 18 additions have source, component and data verification; browser/device verification is still pending. Earlier reports document the October 9 mobile/tablet/desktop walkthroughs and cached offline-startup checks, which do not verify the newer interface changes. See the linked verification reports for exact evidence and limitations.
