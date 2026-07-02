# Building and deploying to the Fire HD 8 from the local machine

How to build the preview APK on the Mac (no EAS cloud queue, no build-quota use) and install it on the dogfood tablet. The cloud path still works and is listed as the fallback. Recipe validated 2026-07-01 (AOD-73).

## TL;DR (after one-time setup)

```bash
# 0. The APK bakes in the Mac's LAN IP for Supabase. Check it BEFORE building:
ipconfig getifaddr en0
# If it differs from EXPO_PUBLIC_SUPABASE_URL in apps/app/eas.json (preview env), update eas.json first.

cd apps/app
npm run device:build     # ~15-30 min first time, much faster after (Gradle caches)
npm run device:install   # tablet plugged in via USB with USB debugging on
```

Sign in on the tablet with the local dev user: `dev@vela.test` / `veladev123` (local Supabase stack only; reset any time via the Auth admin API, see `aod-app-run-verify-recipe`).

The APK lands at `~/Downloads/vela-preview.apk`. Both scripts live in `apps/app/package.json`.

## One-time setup

Already done on Xavier's Mac (kept here for a rebuild-from-scratch):

1. **Android Studio + SDK** at `~/Library/Android/sdk`. In SDK Manager (Settings > Languages & Frameworks > Android SDK > SDK Tools) install:
   - NDK (Side by side). Required: Reanimated, Unistyles/Nitro, and MMKV compile C++.
   - Android SDK Command-line Tools (latest).
   - Platform-tools (adb) and at least one platform + build-tools come with Studio.
2. **JDK 17**: `brew install --cask temurin@17`. Do NOT use Android Studio's bundled JDK (see Troubleshooting).
3. **EAS login**: `npx eas login` once. Local builds still fetch the remote keystore from EAS, so the APK signature matches the cloud builds and updates the tablet install in place.
4. **Tablet USB debugging** (Fire OS): Settings > Device Options > About Fire Tablet > tap Serial Number 7 times, then Device Options > Developer Options > USB debugging ON. On first plug-in accept the "Allow USB debugging?" prompt (check "Always allow from this computer").

## What `device:build` does

```bash
ANDROID_HOME=$HOME/Library/Android/sdk \
JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home \
npx eas build --local -p android --profile preview --output $HOME/Downloads/vela-preview.apk
```

- Uses the `preview` profile from `eas.json`: APK, internal distribution, and the `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` env baked in.
- Fetches the remote Android keystore from EAS (needs network + login), so signing is identical to cloud builds.
- Runs `expo prebuild` + Gradle in a temp dir; dependency caches persist in `~/.gradle`, so rebuilds are fast.

## Installing

**USB (preferred):** `npm run device:install` runs `adb install -r ~/Downloads/vela-preview.apk`. The `-r` reinstalls keeping app data; the same keystore means it updates in place, no uninstall.

**No USB (Silk fallback):** serve the APK over the LAN and open it in Silk on the tablet:

```bash
python3 -m http.server 8888 -d ~/Downloads
# On the tablet, in Silk: http://<mac-lan-ip>:8888/vela-preview.apk
```

Silk needs "Apps from Unknown Sources" enabled once (Settings > Security & Privacy).

## Cloud fallback

```bash
cd apps/app
npx eas build -p android --profile preview --non-interactive --no-wait
npx eas build:list --platform android --limit 1   # poll; free-tier queue can be HOURS
```

Install from the build page URL in Silk. Use this when the Mac is unavailable or the local toolchain breaks.

## Troubleshooting

- **`JvmVendorSpec does not have member field 'IBM_SEMERU'` + `Projects for build ':' have not been registered yet`**: the build ran on the wrong JDK (for example Android Studio's bundled JDK 21). Point `JAVA_HOME` at Temurin 17; this is exactly what `device:build` does. Confirmed fix 2026-07-01.
- **`adb devices` shows nothing**: USB debugging is off (setup step 4) or the cable is charge-only.
- **Device shows `unauthorized`**: accept the RSA prompt on the tablet, replug.
- **Sign-in fails on the tablet** (`CLEARTEXT communication ... not permitted` or network error): the baked-in Supabase URL is the Mac's LAN IP (`eas.json` preview env). Local Supabase must be running (`supabase start`) and the IP must still match the Mac; cleartext HTTP is allowed via the `expo-build-properties` plugin in `app.json`.
- **`INSTALL_FAILED_UPDATE_INCOMPATIBLE`**: the APK was signed with a different key than the installed app. Never install a `npx expo run:android --variant release` build over an EAS-signed one (debug-signed); rebuild via `device:build` or uninstall first (loses app data).

## Related

- `docs/specs/kiosk-mode.md` §10-§11: the Fire HD 8 worked example + kiosk acceptance checklist.
- EAS profiles: `apps/app/eas.json`; native config: `apps/app/app.json`.
