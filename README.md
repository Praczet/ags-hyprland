https://github.com/user-attachments/assets/90462704-715d-4615-8af8-67b285b82722

# AGS + Hyprland — my personal shell experiments

This repository contains my **AGS (Aylur’s Gtk Shell)** setup for **Hyprland**.

For a long time I lived quite comfortably in the GNOME world.  
Things were tidy, predictable, and nicely rounded. Clipboard history via **Pano**, sensible OSDs, and a general feeling that someone else had already thought about most UX decisions for me.

Then I moved to **Hyprland**.

With Hyprland (and AGS), you don’t really _get_ a desktop — you assemble one.  
So this repo exists because I wanted to **rebuild the parts of GNOME I actually liked**, throw away the rest, and replace it with things that feel faster, quieter, and more “mine”.

What you’ll find here:

- a clipboard manager inspired by Pano (but less opinionated),
- an Exposé-style window picker that feels better _to me_ than a flat rofi list,
- small OSDs and a power menu (half practical, half an excuse to learn AGS properly),
- a dashboard overlay with configurable widgets (calendar, tasks, weather, clocks, TickTick),
- and a lot of little details that exist simply because they annoyed me elsewhere.

Not that there’s anything wrong with **rofi** — quite the opposite.  
It’s a great tool: fast, flexible, battle-tested, and incredibly useful.  
I’m genuinely grateful that projects like rofi exist and are maintained.

It’s just… not mine.  
And if you know what that sentence means without further explanation — then yes, exactly that.

---

## A small note on taste

UX preferences are not moral positions.  
Liking one workflow over another doesn’t make it _better_, just _more comfortable_.

Most of what’s in this repo exists because it fits how my brain works —  
not because the alternatives are wrong, inferior, or misguided.

---

## A short GNOME → Hyprland aside

Moving from GNOME to Hyprland is less of a migration and more of a mindset shift.

GNOME asks: _“what do you want to do?”_  
Hyprland asks: _“how exactly do you want this to behave?”_

AGS sits right in the middle: powerful, slightly dangerous, and very honest about the fact that _you_ are now responsible for your UX decisions.

This repository is the result of me slowly answering those questions — sometimes twice.

---

## Prerequisites

You’ll need:

- Linux with Hyprland (Wayland)
- AGS (Gtk4 + TSX build)
- Node.js and npm (used for tooling; AGS itself is the runtime)
- CLI tools used by scripts and widgets:
  - wpctl
  - brightnessctl
  - playerctl
  - grim
  - jq (optional, but recommended)

---

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/Praczet/ags-hyprland.git
   cd ags-hyprland
   ```

2. Install Node dependencies:

   ```bash
   npm install
   ```

---

## Structure

- `src/` – main AGS configuration (widgets, services, styles)
- `shared/` – shared utilities and styles
- `ags-configs/` – AGS-specific configuration fragments
- `packages/` – feature modules (clipboard, expose, OSDs, etc.)
- `packages/dashboard/` – dashboard widgets and Google integration
- `scripts/` – helper scripts used from Hyprland keybinds
- `widget/`, `playground/` – local experiments (git-ignored)

## Package READMEs

- Clipboard: `packages/clipboard/README.md`
- Expose: `packages/expose/README.md`
- OSD: `packages/osd/README.md`
- Power menu: `packages/powermenu/README.md`
- Dashboard: `packages/dashboard/README.md`

---

## Usage

The main entry point is:

```
src/app.ts
```

Example helper script:

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-$HOME/Development/Hyprland/ags}"
INSTANCE="adart"
APP="$REPO_DIR/src/app.ts"

"$REPO_DIR/scripts/ags-ensure.sh" "$INSTANCE" "$APP"
```

Dashboard toggle script:

```bash
scripts/adart-dashboard.sh
```

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

For full options (weather, analog clock, custom widgets), see `packages/dashboard/README.md`.

## Google Calendar & Tasks Auth

The dashboard can pull calendar data and tasks using Google OAuth.

1. Create a **Desktop** OAuth client in Google Cloud Console.
2. Add `http://localhost:8765` to the redirect URIs.
3. Save credentials to `~/.config/ags/google-credentials.json`.
4. Run:

```bash
node scripts/google-auth-device.js
```

This creates `~/.config/ags/google-tokens.json`, which the dashboard uses for refresh tokens (Calendar + Tasks scopes).

## TickTick Auth

TickTick widgets use OAuth access tokens.

1. Create a TickTick OAuth app.
2. Use the helper script:

```bash
node scripts/ticktick-auth.js <clientId> <clientSecret>
```

1. Paste the `access_token` into `~/.config/ags/dashboard.json` under `ticktick.accessToken`.

The instance name `adart` is my personal namespace (AdamDruzdArt).  
It is intentionally hard-coded in a few places — this repo is first and foremost _my_ setup.

If you fork this, you’ll probably want to rename it.

---

## Development

Directories like `node_modules/`, `@girs/`, `widget/`, and `playground/` are ignored and safe for local experiments.

Formatting is done with Prettier. Add this to `package.json` if needed:

```json
"scripts": {
  "format": "prettier --write ."
}
```

Then run:

```bash
npm run format
```

---

## Credits

Big thanks to [HyprAccelerator](https://saneaspect.gumroad.com/l/hypraccelerator) for the detailed Hyprland workflows and explanations.  
Those guides saved me a lot of time — and probably a few unnecessary rewrites — while I was figuring out how all the moving parts in Hyprland fit together.

---

## License

MIT.

Use it, break it, adapt it — just don’t be surprised if you end up rewriting half of it anyway.
