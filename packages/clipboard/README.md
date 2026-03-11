https://github.com/user-attachments/assets/763c680b-bcc0-45ff-b80d-b34d9b907331

# AGS Clipboard — because copy & paste deserves memory

This is a clipboard history popup for **AGS (Aylur’s Gtk Shell)** running on **Hyprland**.

If you come from GNOME, you might miss **Pano**. I did.  
Not the exact UI, but the _idea_ that your clipboard quietly remembers things and stays out of the way until you need it.

This is my take on that idea:

- simple,
- searchable,
- keyboard-first,
- and visually calm.

No ambition to be universal. Just useful.

<img width="2433" height="1434" alt="clipboard" src="https://github.com/user-attachments/assets/41091f4b-4d90-4ffc-b527-01961449a150" />


---

## What it does

- Shows a popup with clipboard history
- Lets you fuzzy-search entries
- Lets you pick one and move on with your life

That’s it. No cloud sync. No smart ranking. No opinions about how you should copy text.

---

## Files & API

- Entry point: `./src/index.ts`
  - `ClipboardWindow(monitor?: number)` – creates the window
  - `refreshClipboard()` – refreshes content when shown
- Window: `./src/windows/ClipboardWindow.tsx`
- Widgets: `./src/widgets/*`
- State & types: `./src/store.ts`, `./src/types.ts`
- Styles: `./src/styles.css`

---

## Using it in your main AGS config

```ts
import { ClipboardWindow, refreshClipboard } from "./packages/clipboard/src"
import clipboardCss from "./packages/clipboard/src/styles.css"

app.applyCss(clipboardCss)
app.add_window(ClipboardWindow(0))
```

Example Hyprland binding:

```ini
bind = SUPER, V, exec, "$HOME/Development/Hyprland/ags"/scripts/adart-clipboard.sh
```

The helper script makes sure my AGS instance (`adart`) is running and then toggles the clipboard window.

---

## Requirements

- AGS with TSX support
- Hyprland (Wayland)
- A working Wayland clipboard

---

## Notes

- This is a **local package**, not published to npm.
- It’s meant to be imported via relative paths.
- If you want something radically different — you should probably write your own. That’s kind of the point of AGS.
