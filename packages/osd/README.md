# AGS OSD — quiet feedback, nothing more

<img width="1888" height="1439" alt="osd_pause" src="https://github.com/user-attachments/assets/605daf03-e297-4792-8433-9cdd0f8b96f9" />

This package provides **on-screen displays** for volume, mic, brightness, and custom status events.

No bouncing animations.  
No giant overlays.  
Just enough feedback to confirm something happened.

---

## Features

- Single reactive OSD window
- Fade in / fade out
- Icon + label + value
- Optional progress bar
- Simple trigger helpers

---

## Files & API

- Entry: `./src/index.ts`
  - `initOSD()`
  - `OSDWindow(defaultMonitor?: number)`
  - `triggerVolume`, `triggerMic`, `triggerBrightness`, `triggerCustom`
- Window: `./src/windows/OSDWindow.tsx`
- Services: `./src/services/*`
- Store & types: `./src/store.ts`, `./src/types.ts`
- Styles: `./src/styles.css`

---

## Using it

```ts
import { OSDWindow, css as osdCss, initOSD } from "./packages/osd/src"

app.applyCss(osdCss)
app.add_window(OSDWindow(0))
initOSD()
```

Hyprland bindings call system tools _and then_ notify AGS via a helper script.

This keeps responsibilities clean:

- system tools change state
- OSD only reports state

---

## Notes

- Local package, no npm publishing.
- Designed to stay out of the way.
- If you notice it too much, it’s doing its job badly.
