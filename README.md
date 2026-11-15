# Kin: Chrome extension + Android app + Supabase

## 1. Supabase (once)
1. Create project at supabase.com.
2. SQL Editor: paste `supabase/schema.sql`, Run.
3. Authentication > Providers > Email: turn OFF "Confirm email".
4. Settings > API: copy Project URL and anon public key. Never use service_role.

## 2. Chrome extension
`chrome://extensions` > Developer mode > Load unpacked > `chrome-extension/`.
Open dashboard > Settings > Account & sync > paste URL + anon key + email + password > Create account.
Link each contact to its WhatsApp chat with the green "Link this chat to Kin" button.

## 3. Android APK (GitHub Actions)
1. Create GitHub repo. Upload CONTENTS of this folder (`.github`, `android-app`, `chrome-extension`, `supabase` at repo root).
2. Repo Settings > Secrets and variables > Actions > New secret: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (optional; skips typing them on phone).
3. Push triggers build (or Actions > Build Android APK > Run workflow). About 15 to 25 min.
4. Open finished run > Artifacts > `Kin-apk`. Unzip, install `Kin.apk` (allow unknown apps).
5. Failure: run page > Summary shows key error lines and last 60 log lines. Artifact `build-log` has full log.
Sign in with the SAME email and password as Chrome.

## Sync model
Local-first. Every change is saved locally, marked pending, pushed to Supabase, then pulled by `updated_at` cursor (every ~8 s in app, ~6 s with dashboard open, 30 s background). Status shows Synced only after server accepted every change. Deletes are tombstones: item vanishes on every device, its storage file is deleted, pending messages using it are cancelled, history stays.
Conflicts: field-level merge. Same field edited on both: last push wins.

## Known limits
- Sending happens only in Chrome on web.whatsapp.com. Phone never sends.
- Voice notes likely send as audio attachment, not native voice bubble. Test with a test contact.
- Phone recordings are .m4a (AAC). Upload .ogg works as is.
- Polling, not Realtime websockets.
- Phone push notifications and notification preferences sync not built.
- Milestone share images are on Android only.
