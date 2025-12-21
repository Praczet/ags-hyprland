# AGS Power Menu — deliberate friction

A small power menu for AGS on Hyprland.

Lock, logout, suspend, reboot, power-off — with confirmation where it matters.

Fast enough to use.  
Slow enough to prevent accidents.

---

## What it does

- Power menu window
- Confirmation dialogs for destructive actions
- Keyboard-friendly
- Minimal styling

---

## Files & API

- Entry: `./src/index.ts`
  - `PowerMenuWindows(monitor?: number)`
- Main window: `./src/PowerMenu.tsx`
- Power actions: `./src/power.ts`
- Styles: `./src/styles.css`

---

## Using it

```ts
import { PowerMenuWindows } from "./packages/powermenu/src"
import powermenuCss from "./packages/powermenu/src/styles.css"

app.applyCss(powermenuCss)
const { main, confirm } = PowerMenuWindows(0)
app.add_window(main)
app.add_window(confirm)
```

Hyprland binding:

```ini
bind = SUPER, POWER, exec, "$HOME/Development/Hyprland/ags"/scripts/adart-powermenu.sh
```

---

## Notes

- Local-only package.
- Uses the same `adart` instance naming as the rest of the setup.
- Designed to be boring. That’s a feature.
