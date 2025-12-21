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
- `scripts/` – helper scripts used from Hyprland keybinds
- `widget/`, `playground/` – local experiments (git-ignored)

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

Big thanks to HyprAccelerator (and especially HyperAccelerator) for the detailed Hyprland workflows and explanations.  
Those guides saved me a lot of time — and probably a few unnecessary rewrites — while I was figuring out how all the moving parts fit together.

---

## License

MIT.

Use it, break it, adapt it — just don’t be surprised if you end up rewriting half of it anyway.
