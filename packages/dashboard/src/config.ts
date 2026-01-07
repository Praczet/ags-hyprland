import GLib from "gi://GLib"

export type CalendarSource = {
  id: string
  color?: string
  label?: string
}

export type DashboardWidgetType = "clock" | "analog-clock" | "weather" | "calendar" | "next-event" | "tasks" | "ticktick" | "sticky-notes" | "sticky-note" | "aegis" | "aegis-summary" | "aegis-disk" | "aegis-memory" | "aegis-network" | "aegis-battery" | "aegis-disk-pie" | "aegis-memory-pie" | "aegis-cpu-graph" | "custom"

export type DashboardWidgetConfig = {
  id: string
  type: DashboardWidgetType
  col: number
  row: number
  colSpan?: number
  rowSpan?: number
  maxNoteHeight?: number
  maxNoteWidth?: number
  minNoteHeight?: number
  minNoteWidth?: number
  noteId?: string
  from?: "left" | "right" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right"
  customName?: string
  showBackground?: boolean
  showBorder?: boolean
  showShadow?: boolean
  expandX?: boolean
  expandY?: boolean
  minWidth?: number
  minHeight?: number
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
  refreshMins?: number
  taskListId?: string
  taskMaxItems?: number
  taskShowCompleted?: boolean
}

export type TickTickConfig = {
  accessToken?: string
  projectIds?: string[]
  refreshMins?: number
  showCompleted?: boolean
}

export type WeatherDashboardConfig = {
  refreshMins?: number
  notifyOnRefresh?: boolean
  notifyOnlyOnChange?: boolean
  particleAnimations?: boolean
  particleFps?: number
  particleDebugMode?: "none" | "rain" | "snow" | "storm" | "wind"
}

export type DashboardConfig = {
  layout: DashboardLayout
  widgets: DashboardWidgetConfig[]
  google?: GoogleConfig
  ticktick?: TickTickConfig
  weather?: WeatherDashboardConfig
  stickynotes?: StickynotesConfig
}

export type StickynotesConfig = {
  refreshMins?: number
  notesConfigPath?: string
  openNote?: string
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
    refreshMins: 10,
    taskMaxItems: 20,
    taskShowCompleted: false,
  },
  ticktick: {
    refreshMins: 5,
    showCompleted: false,
  },
  weather: {
    refreshMins: 10,
    notifyOnRefresh: false,
    notifyOnlyOnChange: false,
    particleAnimations: false,
    particleFps: 15,
    particleDebugMode: "none",
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

export function resolveDashboardConfigPath(path?: string) {
  const raw = typeof path === "string" ? path.trim() : ""
  if (!raw) return `${GLib.get_home_dir()}/.config/ags/dashboard.json`
  if (raw.startsWith("~/")) return `${GLib.get_home_dir()}/${raw.slice(2)}`
  if (GLib.path_is_absolute(raw)) return raw
  return `${GLib.get_home_dir()}/.config/ags/${raw}`
}

export function loadDashboardConfig(configPath?: string): DashboardConfig {
  const path = resolveDashboardConfigPath(configPath)
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
  const t = isObject(u.ticktick) ? u.ticktick : {}
  const w = isObject(u.weather) ? u.weather : {}
  const s = isObject((u as any).stickynotes) ? (u as any).stickynotes : {}
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
          && ["clock", "analog-clock", "weather", "calendar", "next-event", "tasks", "ticktick", "sticky-notes", "sticky-note", "aegis", "aegis-summary", "aegis-disk", "aegis-memory", "aegis-network", "aegis-battery", "aegis-disk-pie", "aegis-memory-pie", "aegis-cpu-graph", "custom"].includes(w.type))
          ? (w.type as DashboardWidgetType)
          : "clock",
        col: Number.isFinite(Number(w.col)) ? Math.max(1, Math.floor(Number(w.col))) : 1,
        row: Number.isFinite(Number(w.row)) ? Math.max(1, Math.floor(Number(w.row))) : 1,
        colSpan: Number.isFinite(Number(w.colSpan)) ? Math.max(1, Math.floor(Number(w.colSpan))) : undefined,
        rowSpan: Number.isFinite(Number(w.rowSpan)) ? Math.max(1, Math.floor(Number(w.rowSpan))) : undefined,
        maxNoteHeight: Number.isFinite(Number(w.maxNoteHeight)) ? Math.max(1, Math.floor(Number(w.maxNoteHeight))) : undefined,
        maxNoteWidth: Number.isFinite(Number(w.maxNoteWidth)) ? Math.max(1, Math.floor(Number(w.maxNoteWidth))) : undefined,
        minNoteHeight: Number.isFinite(Number(w.minNoteHeight)) ? Math.max(1, Math.floor(Number(w.minNoteHeight))) : undefined,
        minNoteWidth: Number.isFinite(Number(w.minNoteWidth)) ? Math.max(1, Math.floor(Number(w.minNoteWidth))) : undefined,
        noteId: typeof w.noteId === "string" ? w.noteId : undefined,
        from: typeof w.from === "string"
          && ["left", "right", "top", "bottom", "top-left", "top-right", "bottom-left", "bottom-right"].includes(w.from)
          ? (w.from as DashboardWidgetConfig["from"])
          : undefined,
        customName: typeof w.customName === "string" ? w.customName : undefined,
        showBackground: typeof w.showBackground === "boolean" ? w.showBackground : undefined,
        showBorder: typeof w.showBorder === "boolean" ? w.showBorder : undefined,
        showShadow: typeof w.showShadow === "boolean" ? w.showShadow : undefined,
        expandX: typeof w.expandX === "boolean" ? w.expandX : undefined,
        expandY: typeof w.expandY === "boolean" ? w.expandY : undefined,
        minWidth: Number.isFinite(Number(w.minWidth)) ? Math.floor(Number(w.minWidth)) : undefined,
        minHeight: Number.isFinite(Number(w.minHeight)) ? Math.floor(Number(w.minHeight)) : undefined,
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
      refreshMins: Number.isFinite(Number(g.refreshMins)) ? Math.floor(Number(g.refreshMins)) : defaultConfig.google!.refreshMins,
      taskListId: typeof g.taskListId === "string" ? g.taskListId : undefined,
      taskMaxItems: Number.isFinite(Number(g.taskMaxItems)) ? Math.floor(Number(g.taskMaxItems)) : undefined,
      taskShowCompleted: typeof g.taskShowCompleted === "boolean" ? g.taskShowCompleted : undefined,
    },
    ticktick: {
      accessToken: typeof t.accessToken === "string" ? t.accessToken : undefined,
      projectIds: Array.isArray(t.projectIds)
        ? t.projectIds.filter((id: unknown) => typeof id === "string")
        : undefined,
      refreshMins: Number.isFinite(Number(t.refreshMins)) ? Math.floor(Number(t.refreshMins)) : defaultConfig.ticktick!.refreshMins,
      showCompleted: typeof t.showCompleted === "boolean" ? t.showCompleted : defaultConfig.ticktick!.showCompleted,
    },
    weather: {
      refreshMins: Number.isFinite(Number(w.refreshMins)) ? Math.floor(Number(w.refreshMins)) : defaultConfig.weather!.refreshMins,
      notifyOnRefresh: typeof w.notifyOnRefresh === "boolean" ? w.notifyOnRefresh : defaultConfig.weather!.notifyOnRefresh,
      notifyOnlyOnChange: typeof w.notifyOnlyOnChange === "boolean" ? w.notifyOnlyOnChange : defaultConfig.weather!.notifyOnlyOnChange,
      particleAnimations: typeof w.particleAnimations === "boolean" ? w.particleAnimations : defaultConfig.weather!.particleAnimations,
      particleFps: Number.isFinite(Number(w.particleFps)) ? Math.floor(Number(w.particleFps)) : defaultConfig.weather!.particleFps,
      particleDebugMode: typeof w.particleDebugMode === "string" ? w.particleDebugMode : defaultConfig.weather!.particleDebugMode,
    },
    stickynotes: {
      refreshMins: Number.isFinite(Number((s as any).refreshMins))
        ? Math.floor(Number((s as any).refreshMins))
        : undefined,
      notesConfigPath: typeof (s as any).notesConfigPath === "string"
        ? (s as any).notesConfigPath
        : undefined,
      openNote: typeof (s as any).openNote === "string"
        ? (s as any).openNote
        : undefined,
    },
  }
}
