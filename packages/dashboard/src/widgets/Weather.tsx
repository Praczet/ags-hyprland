import { type Accessor, createEffect } from "ags"
import { Gdk, Gtk } from "ags/gtk4"
import GLib from "gi://GLib"
import type { WeatherConfig, WeatherResponse } from "../services/weatherState"
import { weatherCodeIcon, weatherCodeLabel } from "../services/weatherCodes"
import { WidgetFrame } from "./WidgetFrame"

type WeatherWidgetConfig = WeatherConfig & {
  data?: Accessor<WeatherResponse | null>
  error?: Accessor<string | null>
}

type ParticleMode = "none" | "rain" | "snow" | "storm" | "wind"

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
}

function parseColor(input: string) {
  const c = new Gdk.RGBA()
  c.parse(input)
  return c
}

function lookupColor(ctx: Gtk.StyleContext, name: string, fallback: string) {
  try {
    const res = (ctx as any).lookup_color?.(name)
    if (Array.isArray(res)) {
      const [ok, color] = res
      if (ok && color) return color as Gdk.RGBA
    } else {
      const out = new Gdk.RGBA()
      const ok = (ctx as any).lookup_color(name, out)
      if (ok) return out
    }
  } catch {
    // ignore lookup errors, fallback below
  }
  return parseColor(fallback)
}

function mix(a: Gdk.RGBA, b: Gdk.RGBA, t: number) {
  const c = new Gdk.RGBA()
  c.red = a.red + (b.red - a.red) * t
  c.green = a.green + (b.green - a.green) * t
  c.blue = a.blue + (b.blue - a.blue) * t
  c.alpha = 1
  return c
}

function colorForTemp(celsius: number, ctx: Gtk.StyleContext) {
  const primary = lookupColor(ctx, "primary", "#86d1e9")
  const secondary = lookupColor(ctx, "secondary", "#b2cad3")
  const error = lookupColor(ctx, "error", "#ffb4ab")
  if (celsius >= 0) {
    const t = Math.min(1, celsius / 30)
    return mix(primary, error, t)
  }
  const t = Math.min(1, Math.abs(celsius) / 20)
  return mix(primary, secondary, t)
}

function formatTemp(value: number | undefined, unit: "c" | "f") {
  if (typeof value !== "number") return "--"
  return `${Math.round(value)}°${unit.toUpperCase()}`
}

function formatDayLabel(value: string) {
  try {
    const dt = GLib.DateTime.new_from_iso8601(`${value}T00:00:00Z`, null)
      ?? GLib.DateTime.new_from_iso8601(value, null)
    if (dt) return dt.format("%a, %b %d")
  } catch {
    // ignore date parsing errors
  }
  return value
}

function colorToHex(color: Gdk.RGBA) {
  const r = Math.round(color.red * 255).toString(16).padStart(2, "0")
  const g = Math.round(color.green * 255).toString(16).padStart(2, "0")
  const b = Math.round(color.blue * 255).toString(16).padStart(2, "0")
  return `#${r}${g}${b}`
}

function forecastTempColor(_: number, ctx: Gtk.StyleContext) {
  const primary = lookupColor(ctx, "@primary", "#86d1e9")
  return colorToHex(primary)
}

function formatForecastTemp(value: number | undefined, unit: "c" | "f", ctx: Gtk.StyleContext) {
  const display = formatTemp(value, unit)
  if (typeof value !== "number") return display
  const color = forecastTempColor(value, ctx)
  const weight = value < 0 ? "bold" : "normal"
  return `<span foreground="${color}" weight="${weight}">${display}</span>`
}

function buildTempBarWidget(minTemp: number, maxTemp: number, todayTemp: number, rangeMin: number, rangeMax: number) {
  const width = 140
  const markerHeight = 10
  const barHeight = Math.max(2, Math.round(markerHeight * 0.25))
  const barOffset = Math.max(0, Math.floor((markerHeight - barHeight) / 2))
  const center = Math.floor(width / 2)
  const leftSpan = center
  const rightSpan = width - center
  const maxAbs = Math.max(Math.abs(rangeMin), Math.abs(rangeMax))

  const mapDelta = (delta: number) => {
    if (maxAbs === 0) return center
    const t = Math.max(-1, Math.min(1, delta / maxAbs))
    if (t <= 0) return Math.round(center + t * leftSpan)
    return Math.round(center + t * rightSpan)
  }

  const minX = mapDelta(minTemp - todayTemp)
  const maxX = mapDelta(maxTemp - todayTemp)
  const start = Math.max(0, Math.min(minX, maxX))
  const end = Math.min(width, Math.max(minX, maxX))
  const rangeWidth = Math.max(2, end - start)

  const track = new Gtk.Box()
  track.add_css_class("dashboard-weather-forecast-track")
  track.set_size_request(width, barHeight)
  track.set_halign(Gtk.Align.START)
  track.set_valign(Gtk.Align.CENTER)
  track.set_hexpand(false)
  track.set_vexpand(false)
  track.set_margin_top(barOffset)

  const coldRange = new Gtk.Box()
  coldRange.add_css_class("dashboard-weather-forecast-range")
  coldRange.add_css_class("dashboard-weather-forecast-range-cold")
  coldRange.set_halign(Gtk.Align.START)
  coldRange.set_valign(Gtk.Align.CENTER)
  coldRange.set_hexpand(false)
  coldRange.set_vexpand(false)
  coldRange.set_margin_top(barOffset)
  const warmRange = new Gtk.Box()
  warmRange.add_css_class("dashboard-weather-forecast-range")
  warmRange.add_css_class("dashboard-weather-forecast-range-warm")
  warmRange.set_halign(Gtk.Align.START)
  warmRange.set_valign(Gtk.Align.CENTER)
  warmRange.set_hexpand(false)
  warmRange.set_vexpand(false)
  warmRange.set_margin_top(barOffset)

  if (start < center) {
    const coldWidth = Math.max(2, Math.min(center, end) - start)
    coldRange.set_size_request(coldWidth, barHeight)
    coldRange.set_margin_start(start)
    coldRange.set_visible(true)
  } else {
    coldRange.set_size_request(0, barHeight)
    coldRange.set_visible(false)
  }

  if (end > center) {
    const warmStart = Math.max(center, start)
    const warmWidth = Math.max(2, end - warmStart)
    warmRange.set_size_request(warmWidth, barHeight)
    warmRange.set_margin_start(warmStart)
    warmRange.set_visible(true)
  } else {
    warmRange.set_size_request(0, barHeight)
    warmRange.set_visible(false)
  }

  const marker = new Gtk.Box()
  marker.add_css_class("dashboard-weather-forecast-marker")
  marker.set_size_request(2, markerHeight)
  marker.set_margin_start(Math.max(0, Math.min(width - 2, center - 1)))
  marker.set_margin_top(-1)
  marker.set_halign(Gtk.Align.START)
  marker.set_valign(Gtk.Align.CENTER)
  marker.set_hexpand(false)
  marker.set_vexpand(false)

  const overlay = new Gtk.Overlay()
  overlay.set_child(track)
  overlay.add_overlay(coldRange)
  overlay.add_overlay(warmRange)
  overlay.add_overlay(marker)
  overlay.set_halign(Gtk.Align.START)
  overlay.set_valign(Gtk.Align.CENTER)
  overlay.set_vexpand(false)
  overlay.set_size_request(width, markerHeight)

  return overlay
}

function particleModeFor(code?: number, wind?: number): ParticleMode {
  if (typeof code === "number") {
    if ([95, 96, 99].includes(code)) return "storm"
    if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow"
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain"
  }
  if (typeof wind === "number" && wind >= 35) return "wind"
  return "none"
}

function particleCountFor(mode: ParticleMode, width: number, height: number) {
  if (mode === "none") return 0
  const area = width * height
  const base = Math.max(10, Math.min(60, Math.round(area / 8000)))
  if (mode === "snow") return Math.max(8, Math.round(base * 0.8))
  if (mode === "wind") return Math.max(10, Math.round(base * 0.9))
  if (mode === "storm") return Math.round(base * 1.3)
  return base
}

function spawnParticle(mode: ParticleMode, width: number, height: number): Particle {
  const x = Math.random() * width
  const y = Math.random() * height
  if (mode === "snow") {
    return {
      x,
      y,
      vx: (Math.random() * 20) - 10,
      vy: 20 + Math.random() * 35,
      size: 1 + Math.random() * 2,
      alpha: 0.4 + Math.random() * 0.35,
    }
  }
  if (mode === "wind") {
    return {
      x,
      y,
      vx: 140 + Math.random() * 120,
      vy: (Math.random() * 12) - 6,
      size: 12 + Math.random() * 10,
      alpha: 0.25 + Math.random() * 0.2,
    }
  }
  if (mode === "storm") {
    return {
      x,
      y,
      vx: 40 + Math.random() * 30,
      vy: 240 + Math.random() * 120,
      size: 10 + Math.random() * 8,
      alpha: 0.35 + Math.random() * 0.25,
    }
  }
  return {
    x,
    y,
    vx: 20 + Math.random() * 30,
    vy: 160 + Math.random() * 80,
    size: 8 + Math.random() * 6,
    alpha: 0.25 + Math.random() * 0.25,
  }
}

export function WeatherWidget(cfg: WeatherWidgetConfig = {}) {
  const title = cfg.showTitle === false ? undefined : (cfg.title ?? "Weather")
  const unit = cfg.unit === "f" ? "f" : "c"
  const showForecast = cfg.nextDays === true
  const forecastCount = Number.isFinite(Number(cfg.nextDaysCount))
    ? Math.max(1, Math.min(10, Math.floor(Number(cfg.nextDaysCount))))
    : 7

  const city = new Gtk.Label({ label: cfg.city ?? "Local", xalign: 0.5 })
  city.set_halign(Gtk.Align.CENTER)
  const temp = new Gtk.Label({ label: "--", xalign: 0 })
  temp.add_css_class("dashboard-weather-temp")
  temp.set_use_markup(true)
  const summary = new Gtk.Label({ label: "Loading…", xalign: 0 })
  const wind = new Gtk.Label({ label: "", xalign: 0 })
  const icon = new Gtk.Image({ icon_name: "weather-clear-symbolic", pixel_size: 56 })
  icon.add_css_class("dashboard-weather-icon")
  const forecastBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 })
  forecastBox.add_css_class("dashboard-weather-forecast")
  forecastBox.set_visible(showForecast)

  const topBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 })
  topBox.set_hexpand(true)
  topBox.set_halign(Gtk.Align.FILL)
  const topRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 12 })
  topRow.set_halign(Gtk.Align.CENTER)
  topRow.set_hexpand(true)
  topRow.append(icon)
  const topText = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  topText.append(temp)
  topText.append(summary)
  topText.append(wind)
  topRow.append(topText)
  topBox.append(city)
  topBox.append(topRow)

  const topOverlay = new Gtk.Overlay()
  topOverlay.set_child(topBox)
  topOverlay.set_halign(Gtk.Align.FILL)
  topOverlay.set_valign(Gtk.Align.CENTER)
  topOverlay.set_hexpand(true)
  topOverlay.set_vexpand(false)

  const particlesArea = new Gtk.DrawingArea()
  particlesArea.set_hexpand(true)
  particlesArea.set_vexpand(true)
  particlesArea.set_halign(Gtk.Align.FILL)
  particlesArea.set_valign(Gtk.Align.FILL)
  particlesArea.set_visible(false)
  topOverlay.add_overlay(particlesArea)

  let particleMode: ParticleMode = "none"
  let particles: Particle[] = []
  let lastWidth = 0
  let lastHeight = 0
  let lastTick = GLib.get_monotonic_time()

  const debugModes = new Set<ParticleMode>(["none", "rain", "snow", "storm", "wind"])
  const rawDebug = typeof cfg.particleDebugMode === "string" ? cfg.particleDebugMode.toLowerCase() : ""
  const debugMode = debugModes.has(rawDebug as ParticleMode)
    ? rawDebug as ParticleMode
    : null
  const animationsEnabled = cfg.particleAnimations === true || debugMode !== null
  const fpsChoices = new Set([10, 15, 24, 30])
  const particleFps = fpsChoices.has(Number(cfg.particleFps)) ? Number(cfg.particleFps) : 15

  particlesArea.set_draw_func((_area, cr, width, height) => {
    if (!animationsEnabled || particleMode === "none" || width <= 0 || height <= 0) return
    if (width !== lastWidth || height !== lastHeight) {
      lastWidth = width
      lastHeight = height
      const count = particleCountFor(particleMode, width, height)
      particles = Array.from({ length: count }, () => spawnParticle(particleMode, width, height))
    }

    const ctx = particlesArea.get_style_context()
    const primary = lookupColor(ctx, "primary", "#86d1e9")

    for (const p of particles) {
      cr.setSourceRGBA(primary.red, primary.green, primary.blue, p.alpha)
      if (particleMode === "snow") {
        cr.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        cr.fill()
      } else {
        cr.setLineWidth(particleMode === "wind" ? 1 : 1.5)
        const dx = particleMode === "wind" ? p.size * 1.0 : p.size * 0.5
        const dy = particleMode === "wind" ? p.size * 0.25 : p.size
        cr.moveTo(p.x, p.y)
        cr.lineTo(p.x + dx, p.y + dy)
        cr.stroke()
      }
    }
  })

  const updateLabels = (data: WeatherResponse) => {
    const current = data.current ?? {}
    const raw = current.temperature_2m
    const display = formatTemp(raw, unit)
    if (typeof raw === "number") {
      const ctx = temp.get_style_context()
      const c = unit === "f" ? (raw - 32) * (5 / 9) : raw
      const color = colorForTemp(c, ctx)
      const hex = `#${Math.round(color.red * 255).toString(16).padStart(2, "0")}${Math.round(color.green * 255).toString(16).padStart(2, "0")}${Math.round(color.blue * 255).toString(16).padStart(2, "0")}`
      temp.set_markup(`<span foreground="${hex}">${display}</span>`)
    } else {
      temp.set_label(display)
    }
    summary.set_label(weatherCodeLabel[current.weathercode ?? -1] ?? "Unknown")
    icon.set_from_icon_name(weatherCodeIcon[current.weathercode ?? -1] ?? "weather-severe-alert-symbolic")
    if (typeof current.wind_speed_10m === "number") {
      wind.set_label(`Wind ${Math.round(current.wind_speed_10m)} km/h`)
    } else {
      wind.set_label("")
    }

    if (animationsEnabled) {
      const nextMode = debugMode ?? particleModeFor(current.weathercode, current.wind_speed_10m)
      if (nextMode !== particleMode) {
        particleMode = nextMode
        particles = []
        lastWidth = 0
        lastHeight = 0
        lastTick = GLib.get_monotonic_time()
      }
      particlesArea.set_visible(particleMode !== "none")
      if (particleMode === "none") {
        particles = []
      }
    }

    forecastBox.set_visible(showForecast)
    if (!showForecast) return

    while (forecastBox.get_first_child()) {
      const child = forecastBox.get_first_child()
      if (child) forecastBox.remove(child)
    }

    if (typeof raw !== "number" || !data.daily) return
    const days = data.daily.time ?? []
    const mins = data.daily.temperature_2m_min ?? []
    const maxs = data.daily.temperature_2m_max ?? []
    const codes = data.daily.weathercode ?? []
    const count = Math.min(days.length, mins.length, maxs.length, codes.length)
    if (count === 0) return

    const daily = []
    for (let i = 0; i < count; i += 1) {
      daily.push({
        date: days[i],
        min: mins[i],
        max: maxs[i],
        code: codes[i],
      })
    }

    const slice = daily.slice(1, 1 + forecastCount)
    if (!slice.length) return

    const deltaMin = Math.min(0, ...slice.map(d => d.min - raw))
    const deltaMax = Math.max(0, ...slice.map(d => d.max - raw))

    slice.forEach(day => {
      const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 })
      row.add_css_class("dashboard-weather-forecast-row")

      const dayLabel = new Gtk.Label({
        label: formatDayLabel(day.date) ?? undefined,
        xalign: 0,
      })
      dayLabel.set_halign(Gtk.Align.START)
      dayLabel.set_width_chars(10)
      dayLabel.set_hexpand(false)

      const tempLabel = new Gtk.Label({ label: "", xalign: 0 })
      tempLabel.set_halign(Gtk.Align.START)
      tempLabel.set_width_chars(12)
      tempLabel.set_hexpand(false)
      tempLabel.set_use_markup(true)
      const labelCtx = tempLabel.get_style_context()
      tempLabel.set_markup(`[${formatForecastTemp(day.min, unit, labelCtx)}, ${formatForecastTemp(day.max, unit, labelCtx)}]`)

      const bar = buildTempBarWidget(day.min, day.max, raw, deltaMin, deltaMax)

      const dayIcon = new Gtk.Image({
        icon_name: weatherCodeIcon[day.code ?? -1] ?? "weather-severe-alert-symbolic",
        pixel_size: 18,
      })

      row.append(dayLabel)
      row.append(tempLabel)
      row.append(bar)
      row.append(dayIcon)
      forecastBox.append(row)
    })
  }

  const setErrorState = (message: string) => {
    summary.set_label(message)
    wind.set_label("")
    particlesArea.set_visible(false)
    particleMode = "none"
  }

  if (typeof cfg.data === "function") {
    createEffect(() => {
      const err = typeof cfg.error === "function" ? cfg.error() : null
      if (err) {
        setErrorState(err)
        return
      }
      const next = cfg.data?.()
      if (next) {
        updateLabels(next)
      } else {
        summary.set_label("Loading…")
      }
    }, { immediate: true })
  } else {
    setErrorState("Weather unavailable")
  }

  const body = (
    <box orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.FILL} hexpand={true}>
      {topOverlay}
      {forecastBox}
    </box>
  ) as Gtk.Box

  if (animationsEnabled) {
    const interval = Math.max(1, Math.floor(1000 / particleFps))
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, interval, () => {
      if (particleMode !== "none" && topOverlay.get_visible()) {
        const now = GLib.get_monotonic_time()
        const dt = Math.max(0.01, (now - lastTick) / 1_000_000)
        lastTick = now
        const width = lastWidth || 1
        const height = lastHeight || 1

        for (const p of particles) {
          p.x += p.vx * dt
          p.y += p.vy * dt
          if (p.x > width + 10 || p.y > height + 10) {
            const np = spawnParticle(particleMode, width, height)
            if (particleMode === "wind") {
              p.x = -20
              p.y = Math.random() * height
            } else {
              p.x = np.x
              p.y = -10
            }
            p.vx = np.vx
            p.vy = np.vy
            p.size = np.size
            p.alpha = np.alpha
          }
        }
        particlesArea.queue_draw()
      }
      return GLib.SOURCE_CONTINUE
    })
  }

  return WidgetFrame(title, body)
}
