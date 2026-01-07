# Aegis

<img width="1803" height="1186" alt="image" src="https://github.com/user-attachments/assets/fd36d42a-5f00-4b44-ae41-547ae3c73b07" />


> [!NOTE]
> **A**daptive **E**nvironment **G**raphical **I**nformation **S**ystem

Aegis is a GUI-first system info + diagnostics "suite" for AGS. It works as a standalone window and as dashboard widgets, and shares a single sysinfo service across all widgets.

## Features

- Standalone Aegis window (request-driven)
- Dashboard widgets (summary, disk, memory, network, battery)
- Pie widgets (disk/memory) with legend placement
- CPU graph widget (total + per-core usage, speed, temp)
- Click-to-copy rows and "copy all" footer (text/json)

## Usage

### Request handler

```
ags request -i adart aegis
ags request -i adart aegis full
ags request -i adart aegis summary
ags request -i adart aegis minimal

ags request -i adart aegis-disk
ags request -i adart aegis-memory
ags request -i adart aegis-network
ags request -i adart aegis-battery
ags request -i adart aegis-disk-pie
ags request -i adart aegis-memory-pie
ags request -i adart aegis-cpu-graph

ags request -i adart aegisrefresh
ags request -i adart aegismode full
```

### Dashboard widget types

- `aegis` (full/summary/minimal)
- `aegis-summary`
- `aegis-disk`
- `aegis-memory`
- `aegis-network`
- `aegis-battery`
- `aegis-disk-pie`
- `aegis-memory-pie`
- `aegis-cpu-graph`

### Example dashboard config

```json
{
  "id": "aegis-full",
  "type": "aegis",
  "col": 1,
  "row": 1,
  "colSpan": 4,
  "rowSpan": 3,
  "config": { "mode": "full", "title": "Aegis", "showTitle": true }
}
```

### Widget config options

Common:
- `mode`: `minimal | summary | full`
- `sections`: `system | hardware | memory | storage | network | power | hyprland | status`
- `showSectionTitles`: `boolean`

Disk pie:
- `disk`: device name (e.g. `nvme0n1`)
- `size`: number
- `legendPosition`: `top | left | right | bottom`
- `opacity`: 0-1 (default 0.7)

Memory pie:
- `size`: number
- `legendPosition`: `top | left | right | bottom`
- `opacity`: 0-1 (default 0.7)

CPU graph:
- `refreshTime`: ms (default 1000)
- `opacity`: 0-1 (default 0.7, applies to core bars)

## Notes

- Copy-to-clipboard uses `wl-copy` or `xclip`.
- GPU info uses `lspci` if available.
- Packages info uses `pacman`, `flatpak`, and `snap` if available.
