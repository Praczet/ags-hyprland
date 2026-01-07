import { Astal, Gdk, Gtk } from "ags/gtk4"
import GLib from "gi://GLib"
import { loadDashboardConfig, type DashboardWidgetConfig, type DashboardWidgetType, type StickynotesConfig, type WeatherDashboardConfig } from "../config"
import { ClockWidget, type ClockConfig } from "../widgets/Clock"
import { WeatherWidget } from "../widgets/Weather"
import { CalendarWidget, type CalendarConfig } from "../widgets/Calendar"
import { NextEventWidget, type NextEventConfig } from "../widgets/NextEvent"
import { AnalogClockWidget, type AnalogClockConfig } from "../widgets/AnalogClock"
import { initGoogleCalendarState } from "../services/googleState"
import { mountCustomWidget } from "../widgets/customLoader"
import { TasksWidget, type TasksConfig } from "../widgets/Tasks"
import { TickTickWidget, type TickTickConfig } from "../widgets/TickTick"
import { StickyNotesWidget, StickyNoteWidget, loadStickyNote, type StickyNotesListConfig, type StickyNoteWidgetConfig } from "../widgets/StickyNotes"
import { initTickTickState } from "../services/ticktickState"
import { initWeatherState, type WeatherConfig } from "../services/weatherState"
import { AegisWidget, AegisSummaryWidget, AegisDiskWidget, AegisMemoryWidget, AegisNetworkWidget, AegisBatteryWidget, AegisDiskPieWidget, AegisMemoryPieWidget, AegisCpuGraphWidget, type AegisMode, type SectionId } from "../../../aegis/src"
import { WidgetFrame } from "../widgets/WidgetFrame"

type WidgetFactory = (cfg: DashboardWidgetConfig) => Gtk.Widget

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x)
}

function toClockConfig(cfg: DashboardWidgetConfig): ClockConfig {
  const raw = isObject(cfg.config) ? cfg.config : {}
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    timeFormat: typeof raw.timeFormat === "string" ? raw.timeFormat : undefined,
    dateFormat: typeof raw.dateFormat === "string" ? raw.dateFormat : undefined,
    showTitle: typeof raw.showTitle === "boolean" ? raw.showTitle : undefined,
  }
}

function toTitleConfig(cfg: DashboardWidgetConfig): { title?: string; showTitle?: boolean; dateFormat?: string; size?: number; tickLabels?: boolean; showDigital?: boolean; digitalFormat?: string } {
  const raw = isObject(cfg.config) ? cfg.config : {}
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    showTitle: typeof raw.showTitle === "boolean" ? raw.showTitle : undefined,
    dateFormat: typeof raw.dateFormat === "string" ? raw.dateFormat : undefined,
    size: Number.isFinite(Number(raw.size)) ? Math.floor(Number(raw.size)) : undefined,
    tickLabels: typeof raw.tickLabels === "boolean" ? raw.tickLabels : undefined,
    showDigital: typeof raw.showDigital === "boolean" ? raw.showDigital : undefined,
    digitalFormat: typeof raw.digitalFormat === "string" ? raw.digitalFormat : undefined,
  }
}

function toWeatherConfig(cfg: DashboardWidgetConfig, globalCfg?: WeatherDashboardConfig): WeatherConfig {
  const raw = isObject(cfg.config) ? cfg.config : {}
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    showTitle: typeof raw.showTitle === "boolean" ? raw.showTitle : undefined,
    city: typeof raw.city === "string" ? raw.city : undefined,
    latitude: Number.isFinite(Number(raw.latitude)) ? Number(raw.latitude) : undefined,
    longitude: Number.isFinite(Number(raw.longitude)) ? Number(raw.longitude) : undefined,
    unit: raw.unit === "f" ? "f" : "c",
    refreshMins: Number.isFinite(Number(raw.refreshMins))
      ? Number(raw.refreshMins)
      : (Number.isFinite(Number(globalCfg?.refreshMins)) ? Number(globalCfg?.refreshMins) : undefined),
    notifyOnRefresh: typeof raw.notifyOnRefresh === "boolean"
      ? raw.notifyOnRefresh
      : (typeof globalCfg?.notifyOnRefresh === "boolean" ? globalCfg?.notifyOnRefresh : undefined),
    notifyOnlyOnChange: typeof raw.notifyOnlyOnChange === "boolean"
      ? raw.notifyOnlyOnChange
      : (typeof globalCfg?.notifyOnlyOnChange === "boolean" ? globalCfg?.notifyOnlyOnChange : undefined),
    particleAnimations: typeof raw.particleAnimations === "boolean"
      ? raw.particleAnimations
      : (typeof globalCfg?.particleAnimations === "boolean" ? globalCfg?.particleAnimations : undefined),
    particleFps: Number.isFinite(Number(raw.particleFps))
      ? Number(raw.particleFps)
      : (Number.isFinite(Number(globalCfg?.particleFps)) ? Number(globalCfg?.particleFps) : undefined),
    particleDebugMode: typeof raw.particleDebugMode === "string"
      ? raw.particleDebugMode as WeatherConfig["particleDebugMode"]
      : (typeof globalCfg?.particleDebugMode === "string" ? globalCfg?.particleDebugMode : undefined),
    nextDays: typeof raw.nextDays === "boolean" ? raw.nextDays : undefined,
    nextDaysCount: Number.isFinite(Number(raw.nextDaysCount)) ? Number(raw.nextDaysCount) : undefined,
  }
}

function toCalendarConfig(cfg: DashboardWidgetConfig): CalendarConfig {
  const raw = isObject(cfg.config) ? cfg.config : {}
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    showTitle: typeof raw.showTitle === "boolean" ? raw.showTitle : undefined,
    markedDates: Array.isArray(raw.markedDates)
      ? raw.markedDates.filter((d: unknown) => typeof d === "string")
      : undefined,
    useGoogle: typeof raw.useGoogle === "boolean" ? raw.useGoogle : undefined,
    showEvents: typeof raw.showEvents === "boolean" ? raw.showEvents : undefined,
    noEvents: Number.isFinite(Number(raw.noEvents)) ? Math.floor(Number(raw.noEvents)) : undefined,
  }
}

function toNextEventConfig(cfg: DashboardWidgetConfig): NextEventConfig {
  const raw = isObject(cfg.config) ? cfg.config : {}
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    showTitle: typeof raw.showTitle === "boolean" ? raw.showTitle : undefined,
    useGoogle: typeof raw.useGoogle === "boolean" ? raw.useGoogle : undefined,
    maxItems: Number.isFinite(Number(raw.maxItems)) ? Math.floor(Number(raw.maxItems)) : undefined,
  }
}

function toTasksConfig(cfg: DashboardWidgetConfig): TasksConfig {
  const raw = isObject(cfg.config) ? cfg.config : {}
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    showTitle: typeof raw.showTitle === "boolean" ? raw.showTitle : undefined,
    maxItems: Number.isFinite(Number(raw.maxItems)) ? Math.floor(Number(raw.maxItems)) : undefined,
    useGoogle: typeof raw.useGoogle === "boolean" ? raw.useGoogle : undefined,
  }
}

function toTickTickConfig(cfg: DashboardWidgetConfig): TickTickConfig {
  const raw = isObject(cfg.config) ? cfg.config : {}
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    showTitle: typeof raw.showTitle === "boolean" ? raw.showTitle : undefined,
    mode: raw.mode === "projects" ? "projects" : "tasks",
    maxItems: Number.isFinite(Number(raw.maxItems)) ? Math.floor(Number(raw.maxItems)) : undefined,
  }
}

function toStickyNotesConfig(cfg: DashboardWidgetConfig, globalCfg?: StickynotesConfig): StickyNotesListConfig {
  const raw = isObject(cfg.config) ? cfg.config : {}
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    showTitle: typeof raw.showTitle === "boolean" ? raw.showTitle : undefined,
    notesConfigPath: typeof raw.notesConfigPath === "string"
      ? raw.notesConfigPath
      : (typeof globalCfg?.notesConfigPath === "string" ? globalCfg?.notesConfigPath : undefined),
    openNote: typeof raw.openNote === "string"
      ? raw.openNote
      : (typeof globalCfg?.openNote === "string" ? globalCfg?.openNote : undefined),
    refreshMins: Number.isFinite(Number(raw.refreshMins))
      ? Math.floor(Number(raw.refreshMins))
      : (Number.isFinite(Number(globalCfg?.refreshMins)) ? Math.floor(Number(globalCfg?.refreshMins)) : undefined),
    maxNotes: Number.isFinite(Number(raw.maxNotes)) ? Math.floor(Number(raw.maxNotes)) : undefined,
    maxNoteHeight: Number.isFinite(Number(cfg.maxNoteHeight)) ? Math.floor(Number(cfg.maxNoteHeight)) : undefined,
    maxNoteWidth: Number.isFinite(Number(cfg.maxNoteWidth)) ? Math.floor(Number(cfg.maxNoteWidth)) : undefined,
    minNoteHeight: Number.isFinite(Number(cfg.minNoteHeight)) ? Math.floor(Number(cfg.minNoteHeight)) : undefined,
    minNoteWidth: Number.isFinite(Number(cfg.minNoteWidth)) ? Math.floor(Number(cfg.minNoteWidth)) : undefined,
  }
}

function toStickyNoteConfig(cfg: DashboardWidgetConfig, globalCfg?: StickynotesConfig): StickyNoteWidgetConfig | null {
  const noteId = typeof cfg.noteId === "string" ? cfg.noteId : undefined
  if (!noteId) return null
  const configPath = typeof globalCfg?.notesConfigPath === "string" ? globalCfg?.notesConfigPath : "~/.config/ags/notes.json"
  const note = loadStickyNote(configPath, noteId)
  if (!note) return null
  return {
    note,
    maxNoteHeight: Number.isFinite(Number(cfg.maxNoteHeight)) ? Math.floor(Number(cfg.maxNoteHeight)) : undefined,
    maxNoteWidth: Number.isFinite(Number(cfg.maxNoteWidth)) ? Math.floor(Number(cfg.maxNoteWidth)) : undefined,
    minNoteHeight: Number.isFinite(Number(cfg.minNoteHeight)) ? Math.floor(Number(cfg.minNoteHeight)) : undefined,
    minNoteWidth: Number.isFinite(Number(cfg.minNoteWidth)) ? Math.floor(Number(cfg.minNoteWidth)) : undefined,
    refreshMins: Number.isFinite(Number(globalCfg?.refreshMins)) ? Math.floor(Number(globalCfg?.refreshMins)) : undefined,
    notesConfigPath: configPath,
    noteId,
    openNote: typeof globalCfg?.openNote === "string" ? globalCfg?.openNote : undefined,
  }
}

function toAegisConfig(cfg: DashboardWidgetConfig): { title?: string; showTitle?: boolean; mode?: AegisMode; sections?: SectionId[]; showSectionTitles?: boolean; disk?: string; size?: number; legendPosition?: "top" | "left" | "right" | "bottom"; refreshMs?: number; refreshTime?: number } {
  const raw = isObject(cfg.config) ? cfg.config : {}
  const mode = typeof raw.mode === "string" ? raw.mode : undefined
  const sectionsRaw = Array.isArray(raw.sections) ? raw.sections.filter((s: unknown) => typeof s === "string") : undefined
  const sections = sectionsRaw?.filter(s => ["system", "hardware", "memory", "storage", "network", "power", "hyprland", "status"].includes(s)) as SectionId[] | undefined
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    showTitle: typeof raw.showTitle === "boolean" ? raw.showTitle : undefined,
    mode: mode === "minimal" || mode === "summary" || mode === "full" ? (mode as AegisMode) : undefined,
    sections,
    showSectionTitles: typeof raw.showSectionTitles === "boolean" ? raw.showSectionTitles : undefined,
    disk: typeof raw.disk === "string" ? raw.disk : undefined,
    size: Number.isFinite(Number(raw.size)) ? Math.floor(Number(raw.size)) : undefined,
    legendPosition: raw.legendPosition === "top" || raw.legendPosition === "left" || raw.legendPosition === "right" || raw.legendPosition === "bottom"
      ? raw.legendPosition
      : undefined,
    refreshMs: Number.isFinite(Number(raw.refreshMs)) ? Math.max(250, Math.floor(Number(raw.refreshMs))) : undefined,
    refreshTime: Number.isFinite(Number(raw.refreshTime)) ? Math.max(250, Math.floor(Number(raw.refreshTime))) : undefined,
  }
}

export default function DashboardWindow(monitor: number = 0, configPath?: string, windowName?: string) {
  const cfg = loadDashboardConfig(configPath)
  const cfgStickynotes = cfg.stickynotes
  const usesGoogle = cfg.widgets.some(w => w.type === "tasks" || (isObject(w.config) && (w.config as any).useGoogle === true))
  const usesTickTick = cfg.widgets.some(w => w.type === "ticktick")
  const google = usesGoogle ? initGoogleCalendarState() : null
  const ticktick = usesTickTick ? initTickTickState() : null
  let animateOut = () => { }
  const registry: Record<DashboardWidgetType, WidgetFactory> = {
    clock: (cfg) => ClockWidget(toClockConfig(cfg)),
    "analog-clock": (cfg) => AnalogClockWidget(toTitleConfig(cfg) as AnalogClockConfig),
    weather: (widgetCfg) => {
      const weatherCfg = toWeatherConfig(widgetCfg, cfg.weather)
      const state = initWeatherState(weatherCfg)
      return WeatherWidget({ ...weatherCfg, data: state.data, error: state.error })
    },
    calendar: (cfg) => {
      const cal = toCalendarConfig(cfg)
      if (cal.useGoogle && google) {
        cal.markedDates = google.markedDates
        if (cal.showEvents !== false) cal.events = google.events
      }
      return CalendarWidget(cal)
    },
    "next-event": (cfg) => {
      const ne = toNextEventConfig(cfg)
      if (ne.useGoogle && google) ne.events = google.events
      return NextEventWidget(ne)
    },
    tasks: (cfg) => {
      const tcfg = toTasksConfig(cfg)
      if (tcfg.useGoogle !== false && google) {
        tcfg.tasks = google.tasks
        tcfg.listTitle = google.taskListTitle
      }
      return TasksWidget(tcfg)
    },
    ticktick: (cfg) => {
      const tcfg = toTickTickConfig(cfg)
      if (ticktick) tcfg.tasks = ticktick.tasks
      return TickTickWidget(tcfg)
    },
    "sticky-notes": (cfg) => StickyNotesWidget({ ...toStickyNotesConfig(cfg, cfgStickynotes), onOpenNote: () => animateOut() }),
    "sticky-note": (cfg) => {
      const noteCfg = toStickyNoteConfig(cfg, cfgStickynotes)
      if (!noteCfg) return new Gtk.Label({ label: "Missing sticky note", xalign: 0 })
      noteCfg.onOpenNote = () => animateOut()
      return StickyNoteWidget(noteCfg)
    },
    aegis: (cfg) => {
      const acfg = toAegisConfig(cfg)
      const title = acfg.showTitle === false ? undefined : (acfg.title ?? "Aegis")
      const body = AegisWidget({ mode: acfg.mode, sections: acfg.sections, showSectionTitles: acfg.showSectionTitles })
      return WidgetFrame(title, body)
    },
    "aegis-summary": (cfg) => {
      const acfg = toAegisConfig(cfg)
      const title = acfg.showTitle === false ? undefined : (acfg.title ?? "Aegis Summary")
      const body = AegisSummaryWidget({ mode: acfg.mode, sections: acfg.sections, showSectionTitles: acfg.showSectionTitles })
      return WidgetFrame(title, body)
    },
    "aegis-disk": (cfg) => {
      const acfg = toAegisConfig(cfg)
      const title = acfg.showTitle === false ? undefined : (acfg.title ?? "Disk")
      return WidgetFrame(title, AegisDiskWidget())
    },
    "aegis-memory": (cfg) => {
      const acfg = toAegisConfig(cfg)
      const title = acfg.showTitle === false ? undefined : (acfg.title ?? "Memory")
      return WidgetFrame(title, AegisMemoryWidget())
    },
    "aegis-network": (cfg) => {
      const acfg = toAegisConfig(cfg)
      const title = acfg.showTitle === false ? undefined : (acfg.title ?? "Network")
      return WidgetFrame(title, AegisNetworkWidget())
    },
    "aegis-battery": (cfg) => {
      const acfg = toAegisConfig(cfg)
      const title = acfg.showTitle === false ? undefined : (acfg.title ?? "Power")
      return WidgetFrame(title, AegisBatteryWidget())
    },
    "aegis-disk-pie": (cfg) => {
      const acfg = toAegisConfig(cfg)
      const title = acfg.showTitle === false ? undefined : (acfg.title ?? "Disk")
      return WidgetFrame(title, AegisDiskPieWidget({ disk: acfg.disk, size: acfg.size, legendPosition: acfg.legendPosition }))
    },
    "aegis-memory-pie": (cfg) => {
      const acfg = toAegisConfig(cfg)
      const title = acfg.showTitle === false ? undefined : (acfg.title ?? "Memory")
      return WidgetFrame(title, AegisMemoryPieWidget({ size: acfg.size, legendPosition: acfg.legendPosition }))
    },
    "aegis-cpu-graph": (cfg) => {
      const acfg = toAegisConfig(cfg)
      const title = acfg.showTitle === false ? undefined : (acfg.title ?? "CPU")
      return WidgetFrame(title, AegisCpuGraphWidget({ refreshMs: acfg.refreshMs, refreshTime: acfg.refreshTime }))
    },
    custom: (cfg) => {
      const host = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
      console.log("mounting custom widget", cfg.customName, cfg.config)
      mountCustomWidget(host, cfg.customName, cfg.config ?? undefined, host)
      return host
    },
  }
  const grid = new Gtk.Grid({
    row_spacing: cfg.layout.gap,
    column_spacing: cfg.layout.gap,
    margin_top: cfg.layout.padding,
    margin_bottom: cfg.layout.padding,
    margin_start: cfg.layout.padding,
    margin_end: cfg.layout.padding,
    halign: Gtk.Align.CENTER,
    valign: Gtk.Align.CENTER,
    cssClasses: ["dashboard-grid"],
  })
  grid.set_hexpand(false)
  grid.set_vexpand(false)
  grid.set_column_homogeneous(false)
  grid.set_row_homogeneous(false)

  const widgetWrappers: { id: string; widget: Gtk.Widget }[] = []
  const widgets = cfg.widgets

  widgets.forEach((w, index) => {
    const wrapper = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      cssClasses: ["dashboard-widget"],
      halign: Gtk.Align.START,
      valign: Gtk.Align.START,
    })
    wrapper.set_hexpand(false)
    wrapper.set_vexpand(false)
    const defaultExpand = w.type === "sticky-notes" || w.type === "sticky-note"
    const expandX = typeof w.expandX === "boolean" ? w.expandX : defaultExpand
    const expandY = typeof w.expandY === "boolean" ? w.expandY : defaultExpand
    if (expandX) {
      wrapper.set_hexpand(true)
      wrapper.set_halign(Gtk.Align.FILL)
    }
    if (expandY) {
      wrapper.set_vexpand(true)
      wrapper.set_valign(Gtk.Align.FILL)
    }
    if (typeof w.minWidth === "number") wrapper.set_size_request(w.minWidth, -1)
    if (typeof w.minHeight === "number") wrapper.set_size_request(-1, w.minHeight)
    if (w.showBackground === false) wrapper.add_css_class("dashboard-widget-no-bg")
    if (w.showBorder === false) wrapper.add_css_class("dashboard-widget-no-border")
    if (w.showShadow === false) wrapper.add_css_class("dashboard-widget-no-shadow")

    let content: Gtk.Widget
    if (w.type === "custom") {
      const host = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
      mountCustomWidget(host, w.customName, w.config ?? undefined, wrapper)
      content = host
    } else {
      const make = registry[w.type] ?? registry.custom
      content = make(w)
    }

    wrapper.append(content)

    const autoFrom = ["left", "right", "top", "bottom", "top-left", "top-right", "bottom-left", "bottom-right"][index % 8] as DashboardWidgetConfig["from"]
    const from = w.from ?? autoFrom
    wrapper.add_css_class(`from-${from}`)
    wrapper.add_css_class(`exit-from-${from}`)

    grid.attach(wrapper, w.col - 1, w.row - 1, w.colSpan ?? 1, w.rowSpan ?? 1)
    widgetWrappers.push({ id: w.id, widget: wrapper })
  })

  const container = (
    <box
      class="dashboard-root"
      valign={Gtk.Align.CENTER}
      halign={Gtk.Align.CENTER}
      vexpand={true}
      hexpand={true}
    >
      {grid}
    </box>
  )

  const win = (
    <window
      name={windowName ?? "dashboard"}
      namespace="adart-dashboard"
      class="dashboard"
      visible={false}
      layer={Astal.Layer.OVERLAY}
      keymode={Astal.Keymode.ON_DEMAND}
      exclusivity={Astal.Exclusivity.IGNORE}
      anchor={
        Astal.WindowAnchor.TOP |
        Astal.WindowAnchor.BOTTOM |
        Astal.WindowAnchor.LEFT |
        Astal.WindowAnchor.RIGHT
      }
      monitor={monitor}
      $={(self: Astal.Window) => {
        const keys = new Gtk.EventControllerKey()
        keys.connect(
          "key-pressed",
          (_ctrl: Gtk.EventControllerKey, keyval: number) => {
            if (keyval === Gdk.KEY_Escape) {
              animateOut()
              return true
            }
            return false
          },
        )
        self.add_controller(keys)
      }}
    >
      {container}
    </window>
  ) as Astal.Window

  const animateIn = () => {
    widgetWrappers.forEach(({ widget }) => {
      widget.remove_css_class("dashboard-widget-exit")
      widget.remove_css_class("dashboard-widget-visible")
    })
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 16, () => {
      widgetWrappers.forEach(({ widget }, i) => {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, i * 30, () => {
          widget.add_css_class("dashboard-widget-visible")
          return GLib.SOURCE_REMOVE
        })
      })
      return GLib.SOURCE_REMOVE
    })
  }

  animateOut = () => {
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 32, () => {
      widgetWrappers.forEach(({ widget }) => {
        widget.add_css_class("dashboard-widget-exit")
      })
      return GLib.SOURCE_REMOVE
    })
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 48, () => {
      widgetWrappers.forEach(({ widget }) => widget.remove_css_class("dashboard-widget-visible"))
      return GLib.SOURCE_REMOVE
    })
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 800, () => {
      widgetWrappers.forEach(({ widget }) => {
        widget.remove_css_class("dashboard-widget-exit")
      })
      win.visible = false
      return GLib.SOURCE_REMOVE
    })
  }

    ; (win as any).showDashboard = () => {
      if (typeof win.present === "function") {
        win.present()
      } else {
        win.visible = true
      }
      win.grab_focus()
      animateIn()
    }
    ; (win as any).hideDashboard = () => {
      animateOut()
    }

  return win
}
