# SAS System

Multi-tenant scheduling, visit tracking and time keeping for home care agencies.
One Flutter codebase ships **iOS, Android and web**, with three role-based portals:

| Portal | Who | What |
|---|---|---|
| Owner | Platform owner | All companies: create, activate/deactivate, access codes, invite each company's first admin |
| Admin | Agency office staff | Dashboard KPIs, schedules (with conflict warnings), clients and authorizations (usage tracking), employees and invites, service types |
| Employee | Field caregivers | My visits (today / upcoming / past), visit detail with directions and notes, clock in/out with a live timer |

Backend: Supabase (Postgres with row level security, Auth, Edge Functions).

> The previous Expo / React Native app is preserved on the `expo-legacy` branch.

## Run it locally

Requires the Flutter SDK (stable channel).

```bash
flutter pub get
flutter run \
  --dart-define=SUPABASE_URL=https://<project-ref>.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=<anon key>
```

Add `-d chrome` for web, or pick an Android emulator / iOS simulator.
Without the two defines the app still opens and shows a configuration banner on the login screen.

## Sign-in rules

- Admins and employees sign in with **company code + email + password**. The code must match their company and the company must be active.
- The owner leaves the company code blank.
- Invited users get an email link, land on **Set password**, then go straight to their portal.

## CI / CD (GitHub Actions, `.github/workflows/flutter.yml`)

Every push runs:

1. `scaffold`: generates `android/ ios/ web/` only if missing (already committed now).
2. `analyze`: `flutter analyze` and `flutter test`. Warnings fail the build.
3. `android`: release APK, uploaded as the `sas-system-android-apk` artifact (signed with the debug key, fine for sideloading; add a real keystore before Play Store).
4. `ios`: unsigned release build (`sas-system-ios-unsigned`). App Store / TestFlight needs an Apple Developer account and signing.
5. `web`: production web build; on `main` it deploys to GitHub Pages.

### One-time repository settings

- **Secrets** (Settings > Secrets and variables > Actions): `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
- **Pages** (Settings > Pages > Source): GitHub Actions.

## Supabase setup

1. Apply migrations (newest is `20261112000000_reconcile_schema_and_profile_security.sql`):
   ```bash
   supabase link --project-ref <project-ref>
   supabase db push
   ```
   That migration is safe to re-run. It declares columns the app always used but the repo SQL never defined, lets users edit their own profile, and closes three privilege-escalation paths (admins granting the owner role, signup metadata granting owner, invites with role owner).
2. Deploy the invite function: `supabase functions deploy invite-user`.
   (It now upserts the profile row; the auth trigger already creates one, so the old insert failed every invite.)
3. Auth > URL Configuration, add redirect URLs:
   - `https://violette-git.github.io/sas-system/**` (web)
   - `com.sassystem.app://login-callback` (iOS and Android deep link)

## Project layout

```
lib/
  core/        env, theme, router (role guards), Supabase client, formatters
  models/      typed rows for every table the app uses
  shared/      UI kit (widgets/ui.dart), adaptive portal shell, profile screen
  features/
    auth/      login, forgot / set password, auth controller
    owner/     companies, company detail, invites
    admin/     dashboard, schedules, clients + authorizations, employees, settings
    employee/  visits, visit detail, clock
supabase/      schema, migrations, invite-user edge function
```

## Roadmap (next waves)

Ported from the Expo app in later waves: calendar view and recurring schedules, case-note templates and review queue, documents and e-signatures, payroll (timesheets, pay rates, exports), invoices, reports and charts, white-label branding, granular permissions, audit log, Spanish, offline queue, GPS geofenced clock-in.
