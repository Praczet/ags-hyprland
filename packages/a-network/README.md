# a-network

A compact NetworkManager UI for AGS with a Wi-Fi first accordion layout.

## Features

- Wi-Fi: nearby + saved lists, connect/disconnect, forget
- Wired status
- VPN indication
- Hotspot indication
- Education mode (action history + command visibility)

## Widget config options

- `refreshMs`: refresh interval (ms, default 15000)
- `educationModeOn`: `boolean`
- `educationModeDetail`: `tooltip | footer | panel`
- `showQRPassword`: `boolean`
- `showPlainTextPassword`: `boolean`
- `allowBackgroundRefresh`: `boolean`
- `refreshOnShow`: `boolean`
- `windowLess`: `boolean` (edge-to-edge section headers, minimal window chrome)

## Notes

- Uses `nmcli` (NetworkManager).
- QR generation uses `qrencode` if available.

## Request handler

```
ags request -i adart network
ags request -i adart networkshow
ags request -i adart networkhide
ags request -i adart networktoggle
ags request -i adart networkshow windowless
```
