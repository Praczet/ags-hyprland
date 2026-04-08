import { Gtk } from "ags/gtk4"
import type { DashboardConfig, DashboardWidgetConfig, DashboardWidgetType, StickynotesConfig, WeatherDashboardConfig } from "../config"
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
import {
  getWotdStore,
  createWotdCard,
  createWotdCompact,
  createWotdDefinitionOnly,
} from "../../../wotd/src"

export type WidgetFactory = (cfg: DashboardWidgetConfig) => Gtk.Widget

type DashboardWidgetRegistryResult = {
  google: ReturnType<typeof initGoogleCalendarState> | null
  registry: Record<DashboardWidgetType, WidgetFactory>
  ticktick: ReturnType<typeof initTickTickState> | null
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x)
}

function wrapWithMaxWidth(widget: Gtk.Widget, maxWidth?: number) {
  if (!Number.isFinite(Number(maxWidth)) || Number(maxWidth) <= 0) {
    return widget
  }

  const container = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    halign: Gtk.Align.CENTER,
    hexpand: false,
  })

  container.set_size_request(Math.floor(Number(maxWidth)), -1)
  container.append(widget)
  return container
}

export function createCustomWidget(
  customName: string | undefined,
  config: DashboardWidgetConfig["config"] | undefined,
  owner: Gtk.Widget,
) {
  const host = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
  mountCustomWidget(host, customName, config ?? undefined, owner)
  return host
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

function toWotdConfig(cfg: DashboardWidgetConfig) {
  const raw = isObject(cfg.config) ? cfg.config : {}

  const variant =
    raw.variant === "card" ||
    raw.variant === "compact" ||
    raw.variant === "definition" ||
    raw.variant === "definition-only"
      ? raw.variant
      : "definition-only"

  return {
    variant,
    title: typeof raw.title === "string" ? raw.title : undefined,
    maxWidth: Number.isFinite(Number(raw.maxWidth)) ? Math.floor(Number(raw.maxWidth)) : undefined,
    minHeight: Number.isFinite(Number(raw.minHeight)) ? Math.floor(Number(raw.minHeight)) : undefined,
    showTitle: typeof raw.showTitle === "boolean" ? raw.showTitle : undefined,
    showWord: typeof raw.showWord === "boolean" ? raw.showWord : undefined,
    showPronunciation: typeof raw.showPronunciation === "boolean" ? raw.showPronunciation : undefined,
    showPartOfSpeech: typeof raw.showPartOfSpeech === "boolean" ? raw.showPartOfSpeech : undefined,
    showDefinition: typeof raw.showDefinition === "boolean" ? raw.showDefinition : undefined,
    showTranslations: typeof raw.showTranslations === "boolean" ? raw.showTranslations : undefined,
    showTranslation: typeof raw.showTranslation === "boolean" ? raw.showTranslation : undefined,
    showLang: typeof raw.showLang === "boolean" ? raw.showLang : undefined,
    showDate: typeof raw.showDate === "boolean" ? raw.showDate : undefined,
    maxMeanings: Number.isFinite(Number(raw.maxMeanings)) ? Math.floor(Number(raw.maxMeanings)) : undefined,
    maxTranslations: Number.isFinite(Number(raw.maxTranslations)) ? Math.floor(Number(raw.maxTranslations)) : undefined,
    cardPath: typeof raw.cardPath === "string" ? raw.cardPath : undefined,
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

function toAegisConfig(cfg: DashboardWidgetConfig): { title?: string; showTitle?: boolean; mode?: AegisMode; sections?: SectionId[]; showSectionTitles?: boolean; disk?: string; size?: number; legendPosition?: "top" | "left" | "right" | "bottom"; refreshMs?: number; refreshTime?: number; opacity?: number } {
  const raw = isObject(cfg.config) ? cfg.config : {}
  const mode = typeof raw.mode === "string" ? raw.mode : undefined
  const sectionsRaw = Array.isArray(raw.sections) ? raw.sections.filter((s: unknown) => typeof s === "string") : undefined
  const sections = sectionsRaw?.filter(s => ["system", "hardware", "memory", "storage", "network", "power", "hyprland", "status", "network-info"].includes(s)) as SectionId[] | undefined
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
    opacity: Number.isFinite(Number(raw.opacity)) ? Number(raw.opacity) : undefined,
  }
}

export function createDashboardWidgetRegistry(
  cfg: DashboardConfig,
  onCloseDashboard: () => void,
): DashboardWidgetRegistryResult {
  const usesGoogle = cfg.widgets.some(w => w.type === "tasks" || (isObject(w.config) && w.config.useGoogle === true))
  const usesTickTick = cfg.widgets.some(w => w.type === "ticktick")
  const google = usesGoogle ? initGoogleCalendarState() : null
  const ticktick = usesTickTick ? initTickTickState() : null
  const stickyNotesConfig = cfg.stickynotes

  const registry: Record<DashboardWidgetType, WidgetFactory> = {
    clock: widgetCfg => ClockWidget(toClockConfig(widgetCfg)),
    "analog-clock": widgetCfg => AnalogClockWidget(toTitleConfig(widgetCfg) as AnalogClockConfig),
    weather: widgetCfg => {
      const weatherCfg = toWeatherConfig(widgetCfg, cfg.weather)
      const state = initWeatherState(weatherCfg)
      return WeatherWidget({ ...weatherCfg, data: state.data, error: state.error })
    },
    calendar: widgetCfg => {
      const calendarCfg = toCalendarConfig(widgetCfg)
      if (calendarCfg.useGoogle && google) {
        calendarCfg.markedDates = google.markedDates
        if (calendarCfg.showEvents !== false) {
          calendarCfg.events = google.events
          calendarCfg.authError = google.authError
        }
      }
      return CalendarWidget(calendarCfg)
    },
    "next-event": widgetCfg => {
      const nextEventCfg = toNextEventConfig(widgetCfg)
      if (nextEventCfg.useGoogle && google) {
        nextEventCfg.events = google.events
        nextEventCfg.authError = google.authError
      }
      return NextEventWidget(nextEventCfg)
    },
    tasks: widgetCfg => {
      const tasksCfg = toTasksConfig(widgetCfg)
      if (tasksCfg.useGoogle !== false && google) {
        tasksCfg.tasks = google.tasks
        tasksCfg.listTitle = google.taskListTitle
        tasksCfg.authError = google.authError
      }
      return TasksWidget(tasksCfg)
    },
    ticktick: widgetCfg => {
      const tickTickCfg = toTickTickConfig(widgetCfg)
      if (ticktick) {
        tickTickCfg.tasks = ticktick.tasks
        tickTickCfg.authError = ticktick.authError
      }
      return TickTickWidget(tickTickCfg)
    },
    "sticky-notes": widgetCfg => StickyNotesWidget({ ...toStickyNotesConfig(widgetCfg, stickyNotesConfig), onOpenNote: () => onCloseDashboard() }),
    "sticky-note": widgetCfg => {
      const noteCfg = toStickyNoteConfig(widgetCfg, stickyNotesConfig)
      if (!noteCfg) return new Gtk.Label({ label: "Missing sticky note", xalign: 0 })
      noteCfg.onOpenNote = () => onCloseDashboard()
      return StickyNoteWidget(noteCfg)
    },
    aegis: widgetCfg => {
      const aegisCfg = toAegisConfig(widgetCfg)
      const title = aegisCfg.showTitle === false ? undefined : (aegisCfg.title ?? "Aegis")
      const body = AegisWidget({ mode: aegisCfg.mode, sections: aegisCfg.sections, showSectionTitles: aegisCfg.showSectionTitles })
      return WidgetFrame(title, body)
    },
    "aegis-summary": widgetCfg => {
      const aegisCfg = toAegisConfig(widgetCfg)
      const title = aegisCfg.showTitle === false ? undefined : (aegisCfg.title ?? "Aegis Summary")
      const body = AegisSummaryWidget({ mode: aegisCfg.mode, sections: aegisCfg.sections, showSectionTitles: aegisCfg.showSectionTitles })
      return WidgetFrame(title, body)
    },
    "aegis-disk": widgetCfg => {
      const aegisCfg = toAegisConfig(widgetCfg)
      const title = aegisCfg.showTitle === false ? undefined : (aegisCfg.title ?? "Disk")
      return WidgetFrame(title, AegisDiskWidget())
    },
    "aegis-memory": widgetCfg => {
      const aegisCfg = toAegisConfig(widgetCfg)
      const title = aegisCfg.showTitle === false ? undefined : (aegisCfg.title ?? "Memory")
      return WidgetFrame(title, AegisMemoryWidget())
    },
    "aegis-network": widgetCfg => {
      const aegisCfg = toAegisConfig(widgetCfg)
      const title = aegisCfg.showTitle === false ? undefined : (aegisCfg.title ?? "Network")
      return WidgetFrame(title, AegisNetworkWidget())
    },
    "aegis-battery": widgetCfg => {
      const aegisCfg = toAegisConfig(widgetCfg)
      const title = aegisCfg.showTitle === false ? undefined : (aegisCfg.title ?? "Power")
      return WidgetFrame(title, AegisBatteryWidget())
    },
    "aegis-disk-pie": widgetCfg => {
      const aegisCfg = toAegisConfig(widgetCfg)
      const title = aegisCfg.showTitle === false ? undefined : (aegisCfg.title ?? "Disk")
      return WidgetFrame(title, AegisDiskPieWidget({ disk: aegisCfg.disk, size: aegisCfg.size, legendPosition: aegisCfg.legendPosition, opacity: aegisCfg.opacity }))
    },
    "aegis-memory-pie": widgetCfg => {
      const aegisCfg = toAegisConfig(widgetCfg)
      const title = aegisCfg.showTitle === false ? undefined : (aegisCfg.title ?? "Memory")
      return WidgetFrame(title, AegisMemoryPieWidget({ size: aegisCfg.size, legendPosition: aegisCfg.legendPosition, opacity: aegisCfg.opacity }))
    },
    "aegis-cpu-graph": widgetCfg => {
      const aegisCfg = toAegisConfig(widgetCfg)
      const title = aegisCfg.showTitle === false ? undefined : (aegisCfg.title ?? "CPU")
      return WidgetFrame(title, AegisCpuGraphWidget({ refreshMs: aegisCfg.refreshMs, refreshTime: aegisCfg.refreshTime, opacity: aegisCfg.opacity }))
    },
    custom: widgetCfg => createCustomWidget(widgetCfg.customName, widgetCfg.config, new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })),
    "word-of-the-day": widgetCfg => {
      const wotdCfg = toWotdConfig(widgetCfg)
      const store = getWotdStore({
        cardPath: wotdCfg.cardPath,
        maxWidth: wotdCfg.maxWidth ?? cfg.wotd?.maxWidth,
      })
      const data = store.get() ?? store.reload()

      if (!data) {
        return new Gtk.Label({
          label: "No word of the day.",
          xalign: 0,
          wrap: true,
        })
      }

      if (wotdCfg.variant === "definition" || wotdCfg.variant === "definition-only") {
        return wrapWithMaxWidth(createWotdDefinitionOnly(data, {
          titleOverride: wotdCfg.title,
          showTitle: wotdCfg.showTitle,
          showWord: wotdCfg.showWord,
          showPronunciation: wotdCfg.showPronunciation,
          showPartOfSpeech: wotdCfg.showPartOfSpeech,
          showTranslation: wotdCfg.showTranslation,
          showLang: wotdCfg.showLang,
          showDate: wotdCfg.showDate,
          maxWidth: wotdCfg.maxWidth ?? cfg.wotd?.maxWidth,
          minHeight: wotdCfg.minHeight ?? cfg.wotd?.minHeight,
        }), wotdCfg.maxWidth ?? cfg.wotd?.maxWidth)
      }

      if (wotdCfg.variant === "compact") {
        return wrapWithMaxWidth(createWotdCompact(data, {
          titleOverride: wotdCfg.title,
          showTitle: wotdCfg.showTitle,
          showWord: wotdCfg.showWord,
          showPronunciation: wotdCfg.showPronunciation,
          showPartOfSpeech: wotdCfg.showPartOfSpeech,
          showDefinition: wotdCfg.showDefinition,
          showTranslations: wotdCfg.showTranslations,
          showLang: wotdCfg.showLang,
          showDate: wotdCfg.showDate,
          maxMeanings: wotdCfg.maxMeanings,
          maxTranslations: wotdCfg.maxTranslations,
          maxWidth: wotdCfg.maxWidth ?? cfg.wotd?.maxWidth,
          minHeight: wotdCfg.minHeight ?? cfg.wotd?.minHeight,
        }), wotdCfg.maxWidth ?? cfg.wotd?.maxWidth)
      }

      return wrapWithMaxWidth(createWotdCard(data, {
        titleOverride: wotdCfg.title,
        showTitle: wotdCfg.showTitle,
        showDate: typeof wotdCfg.showDate === "boolean"
          ? wotdCfg.showDate
          : cfg.wotd?.showDate,
        showLang: typeof wotdCfg.showLang === "boolean" ? wotdCfg.showLang : true,
        showPronunciation: wotdCfg.showPronunciation,
        showPartOfSpeech: wotdCfg.showPartOfSpeech,
        showDefinition: wotdCfg.showDefinition,
        showMeanings: true,
        showTranslations: typeof wotdCfg.showTranslations === "boolean"
          ? wotdCfg.showTranslations
          : cfg.wotd?.showTranslations,
        maxMeanings: wotdCfg.maxMeanings ?? cfg.wotd?.maxMeanings,
        maxTranslations: wotdCfg.maxTranslations ?? cfg.wotd?.maxTranslations,
        maxWidth: wotdCfg.maxWidth ?? cfg.wotd?.maxWidth,
        minHeight: wotdCfg.minHeight ?? cfg.wotd?.minHeight,
        compact: false,
      }), wotdCfg.maxWidth ?? cfg.wotd?.maxWidth)
    },
  }

  return { google, registry, ticktick }
}
