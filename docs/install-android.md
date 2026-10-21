# Installing Sniper Journal on Android

Sniper Journal for Android isn't on Google Play yet. You install it from the
file on this project's GitHub page instead. It takes about a minute, and it
needs **Android 7.0 or newer**.

## Install

1. On your phone, open the
   [latest release](https://github.com/Reefk/SniperJournal/releases/latest) and
   tap **SniperJournal-&lt;version&gt;.apk** under **Assets** to download it.
2. Open the downloaded file, from the download notification or from
   **Files → Downloads**.
3. The first time, Android says the app you opened it from (your browser or
   Files) isn't allowed to install apps. Tap **Settings**, switch on
   **Allow from this source**, and go back.
4. Tap **Install**.
5. Google Play Protect may warn that it doesn't recognise the app, because it
   didn't come from Google Play. Open **More details** and choose to install it
   anyway. If it offers to scan the app first, that's fine too.

You can switch **Allow from this source** off again afterwards. It's under
**Settings → Apps → Special app access → Install unknown apps**.

## Updating

Download the new version's file and install it the same way. It installs over
the version you have, and your journal stays.

**Don't uninstall to update.** Uninstalling deletes your journal along with the
app. Back it up from **More → Back up your journal** before any update anyway.

## Checking the download

Every version is signed with the same key, and Android refuses to install an
update signed with any other key over the app you have. So once Sniper Journal
is installed, nobody else's file can replace it.

To check a download before installing it, compare its SHA-256 with the one in
the release notes. To check the signature instead, run
`apksigner verify --print-certs SniperJournal-<version>.apk` from the Android
SDK. The signing certificate's SHA-256 digest must be:

```
D4:F0:DE:81:FC:2D:9F:56:19:1A:B9:70:F4:CB:D1:87:41:E4:BF:20:F5:74:AC:3F:4D:67:22:60:D9:A1:79:40
```

## Privacy

The app asks for no permissions, not even internet access. Your journal stays
in the app's own private storage on the phone. See the
[privacy policy](https://reefk.github.io/SniperJournal/privacy-policy).
