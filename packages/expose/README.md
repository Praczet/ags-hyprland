# AGS Exposé — windows, but spatial

This package implements an **Exposé-style window overview** for AGS on Hyprland.

I like seeing windows as _things in space_, not as a text list.  
Nothing wrong with lists — rofi is great — but sometimes I want to _recognize_ a window, not read its title.

This exists for that reason.

---

## What it does

- Fullscreen overlay
- Live window thumbnails
- Click or key to focus a window
- One monitor at a time (by design)

---

## Dependencies (Arch / Manjaro)

```bash
sudo pacman -S grim jq
```

---

## Files & API

- Entry: `./src/index.ts`
  - `ExposeWindow(monitor?: number)`
  - `css` – styles
- Main window: `./src/windows/Expose.tsx`
- Config & store: `./src/config.ts`, `./src/store.ts`, `./src/types.ts`
- Thumbnail script: `./scripts/thumb-one.sh`
- Widgets: `./src/widgets/*`

---

## Using it in AGS

```ts
import { ExposeWindow, css as exposeCss } from "./packages/expose/src"

app.applyCss(exposeCss)
app.add_window(ExposeWindow(0))
```

Hyprland binding:

```ini
bind = SUPER, TAB, exec, "$HOME/Development/Hyprland/ags"/scripts/adart-expose.sh
```

The script just ensures the `adart` instance is running and sends `toggleExpose`.

---

## Notes

- Hard-coded instance name (`adart`) is intentional.
- This is not a generic window switcher framework.
- If you prefer lists: use rofi. Seriously — it’s excellent.

