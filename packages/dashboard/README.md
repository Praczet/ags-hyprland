# Dashboard package

## Intro

Overlay dashboard with configurable widgets (calendar, tasks, weather, clocks, TickTick). Configuration lives in `~/.config/ags/dashboard.json`.

## Configuration

Top-level keys:

- `google`: Calendar + Tasks integration.
- `ticktick`: TickTick tasks integration.
- `widgets`: widget list with grid placement and per-widget config.

Widget chrome toggles (apply to any widget):

```json
{
  "widgets": [
    {
      "id": "clock",
      "type": "clock",
      "col": 1,
      "row": 1,
      "showBackground": false,
      "showBorder": false,
      "showShadow": false
    }
  ]
}
```

Widget sizing (optional):

```json
{
  "widgets": [
    {
      "id": "tasks",
      "type": "tasks",
      "col": 5,
      "row": 1,
      "rowSpan": 2,
      "expandX": true,
      "expandY": true,
      "minHeight": 420
    }
  ]
}
```

Custom widgets live in `~/.config/ags/dashboard-widgets/<name>.js`.

## Widgets

### Calendar

`markedDates` accepts `YYYY-MM-DD`. `useGoogle` pulls marks from Google calendars. `showEvents` renders an embedded event list (same renderer as the Next Event widget), and `noEvents` caps it.

```json
{
  "widgets": [
    {
      "id": "calendar",
      "type": "calendar",
      "col": 3,
      "row": 1,
      "config": {
        "useGoogle": true,
        "showEvents": true,
        "noEvents": 10
      }
    }
  ]
}
```

### Next Event

```json
{
  "widgets": [
    {
      "id": "next-event",
      "type": "next-event",
      "col": 5,
      "row": 1,
      "config": { "useGoogle": true, "maxItems": 20 }
    }
  ]
}
```

### Clock

```json
{
  "widgets": [
    {
      "id": "clock",
      "type": "clock",
      "col": 1,
      "row": 1,
      "config": {
        "showTitle": false,
        "timeFormat": "%H:%M",
        "dateFormat": "%A, %Y-%m-%d"
      }
    }
  ]
}
```

### Analog Clock

```json
{
  "widgets": [
    {
      "id": "analog",
      "type": "analog-clock",
      "col": 2,
      "row": 2,
      "config": {
        "showTitle": true,
        "dateFormat": "%A, %Y-%m-%d",
        "size": 240,
        "tickLabels": true,
        "showDigital": true,
        "digitalFormat": "%H:%M"
      }
    }
  ]
}
```

### Weather

Requires `latitude` + `longitude`.

```json
{
  "widgets": [
    {
      "id": "weather",
      "type": "weather",
      "col": 1,
      "row": 2,
      "config": {
        "city": "Warsaw",
        "latitude": 52.2297,
        "longitude": 21.0122,
        "unit": "c",
        "refreshMins": 10,
        "nextDays": true,
        "nextDaysCount": 7
      }
    }
  ]
}
```

### Tasks (Google)

Groups tasks by Overdue / Today / Tomorrow / Future. Requires Tasks scope.

```json
{
  "google": {
    "taskListId": "TASK_LIST_ID",
    "taskMaxItems": 20,
    "taskShowCompleted": false
  },
  "widgets": [
    {
      "id": "tasks",
      "type": "tasks",
      "col": 1,
      "row": 3,
      "config": { "useGoogle": true, "maxItems": 10 }
    }
  ]
}
```

### TickTick

`mode: "tasks"` groups by Overdue / Today / Tomorrow / Future. `mode: "projects"` groups by project.

```json
{
  "ticktick": {
    "accessToken": "TICKTICK_ACCESS_TOKEN",
    "refreshMins": 5,
    "showCompleted": false
  },
  "widgets": [
    {
      "id": "ticktick",
      "type": "ticktick",
      "col": 2,
      "row": 3,
      "config": {
        "mode": "tasks",
        "maxItems": 20
      }
    }
  ]
}
```

### Custom

```json
{
  "widgets": [
    {
      "id": "my-custom",
      "type": "custom",
      "customName": "my-widget",
      "col": 2,
      "row": 3,
      "config": { "foo": "bar" }
    }
  ]
}
```

Example module (`~/.config/ags/dashboard-widgets/my-widget.js`):

```js
import Gtk from "gi://Gtk"

export default function Widget(config) {
  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  box.append(new Gtk.Label({ label: "Hello custom widget" }))
  return box
}
```

## Google auth

Authorize (loopback flow, Desktop client). Make sure you grant Calendar + Tasks scopes:

```bash
node scripts/google-auth-device.js
```

Your OAuth client must include this redirect URI:

```
http://localhost:8765
```

Example Google section (multiple calendars with colors):

```json
{
  "google": {
    "credentialsPath": "~/.config/ags/google-credentials.json",
    "tokensPath": "~/.config/ags/google-tokens.json",
    "calendars": [
      { "id": "primary", "color": "#4f46e5", "label": "Personal" },
      { "id": "work@domain.com", "color": "#10b981", "label": "Work" }
    ],
    "refreshMins": 10
  }
}
```

## TickTick auth

Create an OAuth app, request `tasks:read`, and exchange the code for a token. The helper script uses loopback OAuth (no redirect URI required by TickTick):

```bash
node scripts/ticktick-auth.js <clientId> <clientSecret>
```
