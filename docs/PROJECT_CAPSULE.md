type:: project-capsule
tags:: ags, adart, hyprland, waybar, matugen, gtk, typescript
status:: draft
updated:: [[2026-06-04]]
project:: [[Projects/AGS Adart]]
related:: [[Projects/Hyprland]], [[Projects/Adart Matugen Icons]], [[Projects/Adart GTK Theme]], [[Projects/SDDM Adart Matugener]]

# AGS Adart Project Capsule

## What this is

AGS Adart is Adam's personal AGS shell layer for Hyprland.

It rebuilds the desktop pieces that were missed after leaving GNOME, but in a way that fits a Hyprland setup: request-driven overlays, small helper scripts, focused widgets, and enough mood to avoid feeling like a settings panel escaped from a printer driver.

The project is not trying to become a universal shell framework. It is a local desktop toolkit for one setup, with reusable local packages where that helps.

## Current shape

- Main AGS entry point: `src/app.ts`
- AGS instance name: `adart`
- Shared styling:
  - `src/style.css`
  - `shared/styles/matugen.css`
  - per-package `styles.css`
- Shared helpers:
  - `src/windowControl.ts`
  - `src/windowTypes.ts`
  - `shared/utils/*`
- Feature modules live under `packages/`
- Hyprland / Waybar-facing commands live under `scripts/`
- Dashboard config examples live under `ags-configs/`

The app starts one AGS instance and registers package windows up front. Most external interaction happens by calling helper scripts, which ensure the instance exists and then send `ags request -i adart ...` commands.

## Runtime flow

```text
Hyprland keybind / Waybar click / shell command
  -> scripts/adart-*.sh
  -> scripts/ags-ensure.sh
  -> ags run src/app.ts if needed
  -> ags request -i adart <command>
  -> src/*HandleRequest.ts
  -> package window/store/service
```

`scripts/ags-ensure.sh` is the important guard rail. It starts the `adart` instance if missing, then waits until AGS can answer requests. That prevents the usual race where a script sends a request to an instance that is technically starting but not actually listening yet. Very desktop, very rude, now mostly contained.

## Package map

| Package | Purpose | Main dependencies / notes |
|---|---|---|
| `packages/clipboard` | Searchable clipboard history popup inspired by Pano | Wayland clipboard tools |
| `packages/dashboard` | Configurable overlay dashboard | `~/.config/ags/dashboard.json`, Google/TickTick/weather integrations |
| `packages/expose` | Spatial Expose-style window overview | `hyprctl`, `grim`, `jq`, thumbnail script |
| `packages/osd` | Quiet OSD for volume, mic, brightness, player/custom events | `wpctl`, `brightnessctl`, `playerctl` |
| `packages/powermenu` | Lock/logout/suspend/reboot/power-off UI with confirmations | Destructive actions require confirmation |
| `packages/upcheck` | Arch package update overlay | `checkupdates`, `pacquery`, Ghostty update flow |
| `packages/network` | NetworkManager/Bluetooth popup | `nmcli`, `bluetoothctl`, optional utility launchers |
| `packages/aegis` | GUI-first system information widgets/window | `pacman`, `flatpak`, `snap`, `lspci`, clipboard tools when available |
| `packages/wotd` | Word-of-the-day popup and dashboard widget | Request-driven popup, dashboard widget support |

Each package is local-only. Imports are relative. There is no npm publishing story here, and that is fine.

## Request handlers

`src/app.ts` wires request handlers in this order:

- `aegisHandleRequest`
- `networkHandleRequest`
- `dashboardHandleRequest`
- `exposeHandleRequest`
- `wotdHandleRequest`
- `osdHandleRequest`

Known request examples:

```bash
ags request -i adart networktoggle
ags request -i adart toggleDashboard
ags request -i adart toggleExpose
ags request -i adart wotd-show compact
ags request -i adart aegis full
ags request -i adart osdVolume
```

Some windows are toggled through request handlers. Upcheck currently uses direct AGS window toggling:

```bash
ags toggle -i adart upcheck
```

That distinction matters when debugging. If a script does nothing, first check whether the command is request-driven or native `ags toggle`.

## Helper scripts

Primary scripts:

- `scripts/ags-ensure.sh` starts and verifies the `adart` instance.
- `scripts/test.sh` smoke-tests package entry points.
- `scripts/adart-dashboard.sh` toggles dashboard, optionally with a custom config path.
- `scripts/adart-network.sh` toggles network UI.
- `scripts/adart-a-network.sh` preserves legacy network naming.
- `scripts/adart-upcheck.sh` toggles the update overlay.
- `scripts/adart-expose.sh` toggles Expose.
- `scripts/adart-clipboard.sh` toggles clipboard.
- `scripts/adart-osd.sh` forwards OSD commands.

Most scripts already follow the project-local pattern:

```bash
REPO_DIR="${REPO_DIR:-$HOME/Development/Hyprland/ags}"
INSTANCE="${AGS_INSTANCE:-adart}"
APP_PATH="${AGS_APP:-$REPO_DIR/src/app.ts}"
```

When adding scripts, keep them project-local under `scripts/`, use `set -euo pipefail`, quote variables, check required commands when the script relies on external tools, and include Adam's launcher metadata tags when the script is intended as a personal tool entry.

## Config surfaces

- Dashboard config: `~/.config/ags/dashboard.json`
- Dashboard custom widgets: `~/.config/ags/dashboard-widgets/<name>.js`
- Google credentials: `~/.config/ags/google-credentials.json`
- Google tokens: `~/.config/ags/google-tokens.json`
- Network config: `~/.config/ags/networkmanager.json`
- Legacy network config fallback: `~/.config/ags/a-networkmanager.json`
- Example dashboard config: `ags-configs/aegis_dashboard.json`

The project should keep config files human-editable. If a setting starts needing a schema, it probably deserves documentation before it deserves cleverness.

## Design rules that actually matter

- AGS windows should be thin UI shells.
- Services should do the dull work: shell commands, parsing, external state, cached data.
- Stores should hold UI state and expose predictable update paths.
- Widgets should display state and call services, not become tiny operating systems.
- Use Matugen/shared CSS variables instead of hardcoding colors in every package.
- Keep windows Hyprland-friendly: floating, focused, fast to dismiss.
- Prefer symbolic icons and restrained styling.
- Avoid giant modals unless the action is destructive and confirmation is the point.

The mood target is still: Tokyonight Moon got infected by the wallpaper and somehow survived.

## Development commands

Install dependencies:

```bash
npm install
```

Start or ensure the AGS instance:

```bash
scripts/ags-ensure.sh adart src/app.ts
```

Smoke-test package toggles:

```bash
scripts/test.sh network
scripts/test.sh dashboard
scripts/test.sh clipboard
scripts/test.sh expose
scripts/test.sh upcheck
scripts/test.sh aegis
scripts/test.sh wotd
scripts/test.sh osd osdVolume
```

Formatting is controlled by `package.json`:

```json
{
  "prettier": {
    "semi": false,
    "tabWidth": 2
  }
}
```

There is currently no rich npm script suite. This repo is closer to a living desktop than a CI-polished library, which is not a crime.

## Architecture notes

- `src/app.ts` is the composition root. It imports every package window and all CSS.
- `src/windowControl.ts` provides shared show/hide/toggle behavior and respects package-specific `openWindow` / `closeWindow` methods when present.
- Request handlers stay in `src/` because they connect external commands to app windows.
- Package internals stay under `packages/<name>/src/`.
- Cross-package utilities belong in `shared/` only when at least two packages genuinely need them.
- Dashboard widgets are a special case: they can reuse package widgets, especially Aegis and WOTD, but should not force every package to become dashboard-first.

## Current rough edges

- Some helper scripts do not yet include the launcher metadata tags described in `AGENTS.md`.
- `package.json` has dependencies and Prettier config but no scripts for format/check/test.
- Upcheck uses native `ags toggle`, while most newer packages use request handlers. That is okay, but it is a debugging footnote.
- The README describes `src/` as the main config area, while the actual repo has matured into a package-based layout.
- This is personal infrastructure, so some paths, names, and defaults intentionally assume Adam's machine.

## Good next steps

- Add a small `npm run format` script if Prettier is expected to be routine.
- Normalize helper script headers with `%name`, `%desc`, `%icon`, `%terminal`, `%categories`, and `%tags`.
- Keep package READMEs focused on package behavior, and keep this capsule as the system map.
- Document request commands in one place if the command surface keeps growing.
- Only extract shared abstractions after duplication hurts. Pain first, abstraction second. Very scientific.

## Agent notes

- Read `AGENTS.md` before making architectural changes.
- Preserve user changes in the worktree.
- Do not rename the `adart` instance casually.
- Do not introduce Electron, Tauri, Docker, Nix, or a "platform" unless there is a painfully clear reason.
- Keep changes scoped. This repo is allowed to be personal, moody, and useful without pretending to be a product.
