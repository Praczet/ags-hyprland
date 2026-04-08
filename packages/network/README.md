# network

A compact NetworkManager UI for AGS with a Wi-Fi first accordion layout.

Package directory is `packages/network/`; the app-facing window/command name is `network`.

## Features

- Wi-Fi: nearby + saved lists, connect/disconnect, forget
- Wired status
- VPN indication
- Hotspot indication
- Bluetooth: paired + available devices, connect/disconnect, battery
- Utilities section with quick toggles + external tools
- Education mode (action history + command visibility)

## Widget config options

- `refreshMs`: refresh interval (ms, default 15000)
- `educationModeOn`: `boolean`
- `educationModeDetail`: `tooltip | footer | panel`
- `showQRPassword`: `boolean`
- `showPlainTextPassword`: `boolean` (allow password reveal in details)
- `buttons`: array of external app buttons `{ order, label, icon, command }`
- `allowBackgroundRefresh`: `boolean`
- `refreshOnShow`: `boolean`
- `windowLess`: `boolean` (edge-to-edge section headers, minimal window chrome)
- `layout.anchor`: pipe-separated anchors such as `TOP|RIGHT`
- `layout.margin`: CSS-like margin string such as `24px 24px 24px 0`

Example:

```
{
  "sections": [
    { "section": "wifi", "visible": true, "order": 1 },
    { "section": "bluetooth", "visible": true, "order": 2 },
    { "section": "utilities", "visible": true, "order": 3 }
  ],
  "buttons": [
    { "order": 1, "label": "Network Manager", "icon": "network-wired-symbolic", "command": "nm-connection-editor" },
    { "order": 2, "label": "NMTUI", "icon": "utilities-terminal-symbolic", "command": "nmtui" },
    { "order": 3, "label": "Bluetooth", "icon": "bluetooth-symbolic", "command": "blueman-manager" }
  ]
}
```

Config file:

- canonical: `~/.config/ags/networkmanager.json`
- legacy fallback still read: `~/.config/ags/a-networkmanager.json`

## Notes

- Uses `nmcli` (NetworkManager).
- Uses `bluetoothctl` for Bluetooth status and actions.

## Request handler

```
ags request -i adart network
ags request -i adart networkshow
ags request -i adart networkhide
ags request -i adart networktoggle
ags request -i adart networkshow windowless
```

Wrapper script:

```bash
scripts/adart-network.sh
```

Legacy compatibility wrapper:

```bash
scripts/adart-a-network.sh
```

Legacy request alias still accepted:

```bash
ags request -i adart a-network
```
