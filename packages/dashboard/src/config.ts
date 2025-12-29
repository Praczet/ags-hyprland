import GLib from "gi://GLib"

export type CalendarSource = {
  id: string
  color?: string
  label?: string
}

export type DashboardWidgetType = "clock" | "analog-clock" | "weather" | "calendar" | "next-event" | "tasks" | "custom"

export type DashboardWidgetConfig = {
  id: string
  type: DashboardWidgetType
  col: number
  row: number
  colSpan?: number
  rowSpan?: number
  from?: "left" | "right" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right"
  customName?: string
  showBackground?: boolean
  showBorder?: boolean
  showShadow?: boolean
  config?: Record<string, unknown>
}

export type DashboardLayout = {
  columns: number
  gap: number
  padding: number
}

export type GoogleConfig = {
  credentialsPath: string
  tokensPath: string
  calendars: CalendarSource[]
  gmailQuery?: string
  taskListId?: string
  taskMaxItems?: number
  taskShowCompleted?: boolean
}

export type DashboardConfig = {
  layout: DashboardLayout
  widgets: DashboardWidgetConfig[]
  google?: GoogleConfig
}

const defaultConfig: DashboardConfig = {
  layout: {
    columns: 6,
    gap: 16,
    padding: 24,
  },
  widgets: [
    { id: "clock", type: "clock", col: 1, row: 1, colSpan: 2, rowSpan: 1, from: "top" },
    { id: "calendar", type: "calendar", col: 3, row: 1, colSpan: 2, rowSpan: 2, from: "left", config: { markedDates: ["2025-12-04"] } },
    { id: "next-event", type: "next-event", col: 5, row: 1, colSpan: 2, rowSpan: 1, from: "right" },
    { id: "weather", type: "weather", col: 1, row: 2, colSpan: 2, rowSpan: 1, from: "bottom" },
    { id: "analog", type: "analog-clock", col: 5, row: 2, colSpan: 2, rowSpan: 2, from: "bottom-right" },
  ],
  google: {
    credentialsPath: "~/.config/ags/google-credentials.json",
    tokensPath: "~/.config/ags/google-tokens.json",
    calendars: [{ id: "primary" }],
    gmailQuery: "is:unread label:inbox category:primary",
    taskMaxItems: 20,
    taskShowCompleted: false,
  },
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x)
}

function expandHome(path: string) {
  if (path.startsWith("~/")) {
    return `${GLib.get_home_dir()}/${path.slice(2)}`
  }
  return path
}

export function loadDashboardConfig(): DashboardConfig {
  const path = `${GLib.get_home_dir()}/.config/ags/dashboard.json`
  let user: unknown = null
  try {
    const txt = GLib.file_get_contents(path)?.[1]
    if (txt) user = JSON.parse(new TextDecoder().decode(txt))
  } catch {
    // no file or invalid JSON -> use defaults
  }

  const u = isObject(user) ? user : {}
  const layout = isObject(u.layout) ? u.layout : {}
  const widgets = Array.isArray(u.widgets) ? u.widgets.filter(isObject) : []
  const g = isObject(u.google) ? u.google : {}
  const calendars = Array.isArray(g.calendars) ? g.calendars.filter(isObject) : []

  return {
    layout: {
      columns: Number.isFinite(Number(layout.columns)) ? Math.max(1, Math.floor(Number(layout.columns))) : defaultConfig.layout.columns,
      gap: Number.isFinite(Number(layout.gap)) ? Math.max(0, Math.floor(Number(layout.gap))) : defaultConfig.layout.gap,
      padding: Number.isFinite(Number(layout.padding)) ? Math.max(0, Math.floor(Number(layout.padding))) : defaultConfig.layout.padding,
    },
    widgets: widgets.length
      ? widgets.map(w => ({
        id: typeof w.id === "string" ? w.id : "widget",
        type: (typeof w.type === "string"
          && ["clock", "analog-clock", "weather", "calendar", "next-event", "tasks", "custom"].includes(w.type))
          ? (w.type as DashboardWidgetType)
          : "clock",
        col: Number.isFinite(Number(w.col)) ? Math.max(1, Math.floor(Number(w.col))) : 1,
        row: Number.isFinite(Number(w.row)) ? Math.max(1, Math.floor(Number(w.row))) : 1,
        colSpan: Number.isFinite(Number(w.colSpan)) ? Math.max(1, Math.floor(Number(w.colSpan))) : undefined,
        rowSpan: Number.isFinite(Number(w.rowSpan)) ? Math.max(1, Math.floor(Number(w.rowSpan))) : undefined,
        from: typeof w.from === "string"
          && ["left", "right", "top", "bottom", "top-left", "top-right", "bottom-left", "bottom-right"].includes(w.from)
          ? (w.from as DashboardWidgetConfig["from"])
          : undefined,
        customName: typeof w.customName === "string" ? w.customName : undefined,
        showBackground: typeof w.showBackground === "boolean" ? w.showBackground : undefined,
        showBorder: typeof w.showBorder === "boolean" ? w.showBorder : undefined,
        showShadow: typeof w.showShadow === "boolean" ? w.showShadow : undefined,
        config: isObject(w.config) ? w.config : undefined,
      }))
      : defaultConfig.widgets,
    google: {
      credentialsPath: expandHome(
        typeof g.credentialsPath === "string" ? g.credentialsPath : defaultConfig.google!.credentialsPath,
      ),
      tokensPath: expandHome(
        typeof g.tokensPath === "string" ? g.tokensPath : defaultConfig.google!.tokensPath,
      ),
      calendars: calendars.length
        ? calendars.map(c => ({
          id: typeof c.id === "string" ? c.id : "primary",
          color: typeof c.color === "string" ? c.color : undefined,
          label: typeof c.label === "string" ? c.label : undefined,
        }))
        : defaultConfig.google!.calendars,
      gmailQuery: typeof g.gmailQuery === "string" ? g.gmailQuery : defaultConfig.google!.gmailQuery,
      taskListId: typeof g.taskListId === "string" ? g.taskListId : undefined,
      taskMaxItems: Number.isFinite(Number(g.taskMaxItems)) ? Math.floor(Number(g.taskMaxItems)) : undefined,
      taskShowCompleted: typeof g.taskShowCompleted === "boolean" ? g.taskShowCompleted : undefined,
    },
  }
}
