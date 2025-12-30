# AGS Power Menu — deliberate friction

<img width="1513" height="1438" alt="2025-12-30-153237_hyprshot" src="https://github.com/user-attachments/assets/dae53e70-951f-474c-92bf-5a49bbcfb891" />

A small power menu for AGS on Hyprland.

Lock, logout, suspend, reboot, power-off — with confirmation where it matters.

Fast enough to use.  
Slow enough to prevent accidents.

<img width="1475" height="1440" alt="2025-12-30-153250_hyprshot" src="https://github.com/user-attachments/assets/aec46b87-a752-42d1-93ad-0fd02ce370c5" />


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
