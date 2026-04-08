# WOTD

Word-of-the-day popup and widget package for AGS.

## Features

- Popup window with `card` and `compact` modes
- Dashboard widget support
- Configurable width/height limits
- Manual reload support

## Files & API

- Entry: `./src/index.ts`
- Popup window: `./src/windows/popup.tsx`
- Widgets: `./src/widgets/card.tsx`, `./src/widgets/compact.tsx`
- Config/store/service: `./src/config.ts`, `./src/store.ts`, `./src/service.ts`
- Styles: `./src/styles.css`

## Request Usage

```bash
ags request -i adart wotd-show
ags request -i adart wotd-show compact
ags request -i adart wotd-hide
ags request -i adart wotd-reload
```

## Dashboard Widget

Use widget type:

```json
{
  "id": "wotd-compact",
  "type": "word-of-the-day",
  "col": 4,
  "row": 2,
  "config": {
    "variant": "compact",
    "maxWidth": 220,
    "minHeight": 180
  }
}
```

Supported `variant` values:

- `card`
- `compact`
- `definition-only`

Useful config fields:

- `maxWidth`
- `minHeight`
- `maxMeanings`
- `maxTranslations`
- `showLang`

## Notes

- Popup window name is `wotd-popup`.
- App-facing commands stay request-driven; this is not a plain `ags toggle wotd` window.
