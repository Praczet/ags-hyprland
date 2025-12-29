# Dashboard package

Overlay dashboard with configurable widgets (calendar, next event, weather, clock).

Config file: `~/.config/ags/dashboard.json`

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
    "gmailQuery": "is:unread label:inbox category:primary"
  }
}
```

Clock widget config example (hide title):

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

You can use the same `showTitle` flag for other widgets (weather, calendar, next-event).

Weather widget example (lat/lon required):

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
        "refreshMins": 10
      }
    }
  ]
}
```

Calendar widget example with marked dates:

```json
{
  "widgets": [
    {
      "id": "calendar",
      "type": "calendar",
      "col": 3,
      "row": 1,
      "config": {
        "markedDates": [
          "2025-11-30",
          "2025-12-05"
        ]
      }
    }
  ]
}
```

Calendar widget with embedded events:

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

Google Calendar integration example:

```json
{
  "google": {
    "credentialsPath": "~/.config/ags/google-credentials.json",
    "tokensPath": "~/.config/ags/google-tokens.json",
    "calendars": [
      { "id": "primary", "color": "#4f46e5", "label": "Personal" }
    ]
  },
  "widgets": [
    {
      "id": "calendar",
      "type": "calendar",
      "col": 3,
      "row": 1,
      "config": { "useGoogle": true }
    },
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

Authorize (loopback flow, Desktop client). Make sure you grant Calendar + Tasks scopes:

```bash
node scripts/google-auth-device.js
```

Make sure your OAuth client has this redirect URI:

```
http://localhost:8765
```

Google Tasks widget example:

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

Analog clock widget example:

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

Custom widget (runtime JS) example:

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

Place the file at:
`~/.config/ags/dashboard-widgets/my-widget.js`

Example module:

```js
import Gtk from "gi://Gtk"

export default function Widget(config) {
  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  box.append(new Gtk.Label({ label: "Hello custom widget" }))
  return box
}
```
