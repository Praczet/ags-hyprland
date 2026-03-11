# AGS Upcheck — pacman updates at a glance

<img width="1663" height="1440" alt="2025-12-30-164945_hyprshot" src="https://github.com/user-attachments/assets/e81e2c69-cb71-4bf2-b548-fcca50012b95" />

Upcheck is an AGS overlay that lists pending Arch updates using `checkupdates`, with package details from `pacquery`. It provides a two‑pane view (list + details) and quick actions to refresh or launch a full system update.

---

## What it does

- Shows a list of packages with available updates
- Displays package details on selection
- Refreshes the list on open or via a button
- Opens a terminal for `sudo pacman -Syu`

---

## Files & API

- Entry: `./src/index.ts`
  - `Upcheck(defaultMonitor?: number)` – creates the overlay window
  - `css` – styles for the window and widgets
- Window: `./src/windows/Upcheck.tsx`
- Widgets: `./src/widgets/*`
- Store: `./src/store.ts`
- Update service: `./src/services/pacman.ts`
- Styles: `./src/styles.css`

---

## Using it in AGS

```ts
import { Upcheck, css as upcheckCss } from "./packages/upcheck/src"

app.applyCss(upcheckCss)
app.add_window(Upcheck(0))
```

Hyprland binding:

```ini
bind = SUPER, U, exec, "$HOME/Development/Hyprland/ags"/scripts/adart-upcheck.sh
```

---

## Requirements

- Arch‑based system with `checkupdates` (pacman‑contrib)
- `pacquery` (pacman‑contrib)
- A terminal named `ghostty` (used for updates)

If you use a different terminal, update `openUpdaterTerminal()` in `./src/services/pacman.ts`.
