<https://github.com/user-attachments/assets/90462704-715d-4615-8af8-67b285b82722>

# AGS + Hyprland — my personal shell experiments

This repository contains my **AGS (Aylur's Gtk Shell)** setup for **Hyprland**.

For a long time I lived quite comfortably in the GNOME world.  
Things were tidy, predictable, and nicely rounded. Clipboard history via **Pano**, sensible OSDs, and a general feeling that someone else had already thought about most UX decisions for me.

Then I moved to **Hyprland**.

With Hyprland (and AGS), you don't really _get_ a desktop — you assemble one.  
So this repo exists because I wanted to **rebuild the parts of GNOME I actually liked**, throw away the rest, and replace it with things that feel faster, quieter, and more "mine".

What you'll find here:

- a clipboard manager inspired by Pano (but less opinionated),
- an Exposé-style window picker that feels better _to me_ than a flat rofi list,
- small OSDs and a power menu (half practical, half an excuse to learn AGS properly),
- a dashboard overlay with configurable widgets (calendar, tasks, weather, clocks, TickTick),
- a synced lyrics overlay that reads `.lrc` files and pulls from LRCLIB when the cache is cold,
- a bloom OSD that shows live progress while [Unclaimed Bloom](https://github.com/Praczet/unclaimed-bloom) recolors the desktop,
- and a lot of little details that exist simply because they annoyed me elsewhere.

Not that there's anything wrong with **rofi** — quite the opposite.  
It's a great tool: fast, flexible, battle-tested, and incredibly useful.  
I'm genuinely grateful that projects like rofi exist and are maintained.

It's just… not mine.  
And if you know what that sentence means without further explanation — then yes, exactly that.

---

## A small note on taste

UX preferences are not moral positions.  
Liking one workflow over another doesn't make it _better_, just _more comfortable_.

Most of what's in this repo exists because it fits how my brain works —  
not because the alternatives are wrong, inferior, or misguided.

---

## Prerequisites

- Linux with Hyprland (Wayland)
- AGS (GTK4 + TSX build, 3.x)
- `gnim` (installed via npm — only tooling dependency)
- CLI tools used by scripts and widgets:
  - `wpctl`
  - `brightnessctl`
  - `playerctl`
  - `grim`
  - `jq` (optional, but recommended)
  - `curl` (for lyrics LRCLIB lookup)
- [Unclaimed Bloom](https://github.com/Praczet/unclaimed-bloom) — for the bloom OSD widget (optional; the rest works without it)

---

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/Praczet/ags-hyprland.git
   cd ags-hyprland
   ```

2. Install the single npm dependency:

   ```bash
   npm install
   ```

---

## Structure

```text
src/                    main entry point, request routing, window registration
  app.ts                starts the AGS instance, wires all packages
  windowTypes.ts        window name constants and type exports
  *HandleRequest.ts     per-package AGS request handlers

packages/               feature modules
  aegis/                system info suite (CPU, memory, disk, network, battery)
  bloom/                Unclaimed Bloom run progress OSD
  clipboard/            clipboard history popup
  dashboard/            configurable overlay dashboard
  expose/               Exposé-style window overview
  lyrics/               synced lyrics overlay
  network/              NetworkManager / Bluetooth UI
  osd/                  volume, mic, brightness OSDs
  powermenu/            power menu with confirmations
  upcheck/              pacman update checker
  wotd/                 word-of-the-day popup and widget

shared/
  styles/matugen.css    generated color variables from Unclaimed Bloom (do not edit)
  icons/                shared icon assets
  utils/                shared TypeScript utilities

scripts/                helper scripts for Hyprland keybinds
```

---

## Packages

Full descriptions and screenshots in [packages/README.md](packages/README.md).

| Package | What it does |
|---|---|
| [aegis](packages/aegis/README.md) | System info suite — CPU graph, memory, disk, network, battery |
| [bloom](packages/bloom/README.md) | Unclaimed Bloom run progress OSD |
| [clipboard](packages/clipboard/README.md) | Clipboard history popup inspired by Pano |
| [dashboard](packages/dashboard/README.md) | Configurable overlay dashboard with widgets |
| [expose](packages/expose/README.md) | Exposé-style window overview with live thumbnails |
| [lyrics](packages/lyrics/README.md) | Synced lyrics overlay via MPRIS / LRCLIB |
| [network](packages/network/README.md) | NetworkManager + Bluetooth accordion UI |
| [osd](packages/osd/README.md) | Minimal volume, mic, brightness OSDs |
| [powermenu](packages/powermenu/README.md) | Power menu (logout runs `uwsm stop`) |
| [upcheck](packages/upcheck/README.md) | Pacman update checker overlay |
| [wotd](packages/wotd/README.md) | Word-of-the-day popup and dashboard widget |

---

## Scripts

Helper scripts live in `scripts/` and are called from Hyprland keybinds:

```bash
scripts/adart-clipboard.sh      # toggle clipboard popup
scripts/adart-dashboard.sh      # toggle dashboard overlay
scripts/adart-expose.sh         # toggle Exposé window overview
scripts/adart-lyrics.sh         # toggle synced lyrics overlay
scripts/adart-network.sh        # toggle network/bluetooth panel
scripts/adart-osd.sh            # send OSD signal
scripts/adart-upcheck.sh        # open update checker
```

The `ags-ensure.sh` helper starts the AGS instance if it is not running, then sends the request:

```bash
scripts/ags-ensure.sh adart <app.ts path>
```

---

## Theming

Colors come from [Unclaimed Bloom](https://github.com/Praczet/unclaimed-bloom).

The generated file is:

```text
shared/styles/matugen.css
```

Do not edit it by hand. It is regenerated whenever Unclaimed Bloom plants the `ags` target.  
All packages import it through the main `app.ts` CSS bundle.

---

## Bloom OSD

The `bloom` package shows a live progress overlay while Unclaimed Bloom runs `sow`, `grow`, and `plant`.

AGS request commands:

```bash
ags request -i adart bloom-show <profile> [--wallpaper <path>]
ags request -i adart bloom-done
ags request -i adart bloom-hide
ags request -i adart bloom-pickup    # recover after AGS restart mid-run
```

The OSD polls `~/.cache/unclaimed-bloom/state.json` at 200 ms.  
If AGS restarts while a run is in progress, `maybeRecoverBloom()` is called on startup and resumes tracking.

Unclaimed Bloom triggers the OSD automatically when `--bloom-osd` is passed to `spore sow` or `spore plant`.  
See [unclaimed-bloom](https://github.com/Praczet/unclaimed-bloom) for the full integration setup.

---

## Lyrics Overlay

The `lyrics` package shows synced lyrics for the current MPRIS player.

```bash
ags request -i adart lyrics-toggle
ags request -i adart lyrics-show
ags request -i adart lyrics-hide
```

Cache lives in `~/.local/share/lyrics/*.lrc`. On cache miss, it calls LRCLIB.  
Optional config: `~/.config/ags/lyrics.json`.

---

## Dashboard Configuration

Dashboard config lives at `~/.config/ags/dashboard.json`. The widget list is flexible; add or remove widgets and control layout with `col`, `row`, and spans.

Minimal example:

```json
{
  "widgets": [
    { "id": "clock", "type": "clock", "col": 1, "row": 1 },
    { "id": "calendar", "type": "calendar", "col": 2, "row": 1 }
  ]
}
```

For full options (weather, analog clock, custom widgets), see [packages/dashboard/README.md](packages/dashboard/README.md).

---

## Google Calendar & Tasks Auth

The dashboard can pull calendar data and tasks using Google OAuth.

1. Create a **Desktop** OAuth client in Google Cloud Console.
2. Add `http://localhost:8765` to the redirect URIs.
3. Save credentials to `~/.config/ags/google-credentials.json`.
4. Run:

   ```bash
   node scripts/google-auth-device.js
   ```

This creates `~/.config/ags/google-tokens.json`. The dashboard refreshes tokens in the system keyring when libsecret is available.

---

## TickTick Auth

TickTick widgets use OAuth access tokens.

1. Create a TickTick OAuth app.
2. Use the helper script:

   ```bash
   node scripts/ticktick-auth.js <clientId> <clientSecret>
   ```

3. Paste the `access_token` into `~/.config/ags/dashboard.json` under `ticktick.accessToken`.

---

## Development

This repo runs on AGS `3.x`. Request routing uses `ags request -i adart ...`.

The instance name `adart` is my personal namespace (AdamDruzdArt).  
It is hard-coded in several places — this repo is first and foremost _my_ setup.  
If you fork this, you will probably want to rename it.

Formatting is done with Prettier:

```bash
npm run format
```

Directories like `node_modules/`, `@girs/`, `widget/`, and `playground/` are git-ignored and safe for local experiments.

---

## Credits

Big thanks to [HyprAccelerator](https://saneaspect.gumroad.com/l/hypraccelerator) for the detailed Hyprland workflows and explanations.  
Those guides saved me a lot of time — and probably a few unnecessary rewrites — while I was figuring out how all the moving parts in Hyprland fit together.

---

## License

MIT.

Use it, break it, adapt it — just don't be surprised if you end up rewriting half of it anyway.
