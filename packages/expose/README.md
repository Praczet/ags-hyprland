# AGS Exposé (Hyprland)

Shows a fullscreen overlay with window thumbnails and click-to-focus.

## Install deps (Arch/Manjaro)

sudo pacman -S grim jq

## Use in your main AGS config

import { ExposeWindow, css as exposeCss } from "./packages/expose/src"

app.applyCss(exposeCss)
app.add_window(ExposeWindow(0))

## Hyprland bind

bind = SUPER, TAB, exec, ags -r 'app.get_window("expose")?.showExpose()'
