# AGS Lyrics

Toggleable synced lyrics overlay for the `adart` AGS instance.

It reads the current track from MPRIS through `playerctl`, checks a local `.lrc` cache, and asks LRCLIB for synced lyrics when the cache is missing.

When synced lyrics are available, the overlay shows three lines: previous, current, and next. Line changes roll upward like quiet end credits, because apparently even lyrics deserve stage direction.

## Flow

```text
playerctl / MPRIS
  -> current artist/title/album/duration/position
  -> ~/.local/share/lyrics/*.lrc
  -> LRCLIB /api/get if missing
  -> synced line overlay
```

## Usage

```bash
scripts/adart-lyrics.sh
ags request -i adart lyrics-toggle
ags request -i adart lyrics-show
ags request -i adart lyrics-hide
```

## Config

Optional config path:

```text
~/.config/ags/lyrics.json
```

Example:

```json
{
  "cacheDir": "~/.local/share/lyrics",
  "positionRefreshMs": 1000,
  "metadataRefreshMs": 2500,
  "lookupOnMissing": true,
  "maxLines": 3,
  "width": 860,
  "opacity": 0.92,
  "position": ["top", "center"],
  "marginTop": 18,
  "marginLeft": 24,
  "marginRight": 24
}
```

## Requirements

- `playerctl`
- `curl` for LRCLIB lookup
- A player that exposes MPRIS metadata

No AI transcription. First we use real synced `.lrc`; then we can decide how haunted this needs to become.
