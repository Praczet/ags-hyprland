import { fetch, URL } from "ags/fetch"
import { Gdk, Gtk } from "ags/gtk4"
import GLib from "gi://GLib"
import { WidgetFrame } from "./WidgetFrame"

export type WeatherConfig = {
  title?: string
  showTitle?: boolean
  city?: string
  latitude?: number
  longitude?: number
  unit?: "c" | "f"
  refreshMins?: number
  nextDays?: boolean
  nextDaysCount?: number
}

type WeatherResponse = {
  current?: {
    temperature_2m?: number
    wind_speed_10m?: number
    weathercode?: number
  }
  daily?: {
    time?: string[]
    temperature_2m_min?: number[]
    temperature_2m_max?: number[]
    weathercode?: number[]
  }
}

const weatherCodeLabel: Record<number, string> = {
  0: "Clear",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Dense drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Rain showers",
  81: "Heavy showers",
  82: "Violent showers",
  95: "Thunderstorm",
}

const weatherCodeIcon: Record<number, string> = {
  0: "weather-clear-symbolic",
  1: "weather-few-clouds-symbolic",
  2: "weather-clouds-symbolic",
  3: "weather-overcast-symbolic",
  45: "weather-fog-symbolic",
  48: "weather-fog-symbolic",
  51: "weather-showers-scattered-symbolic",
  53: "weather-showers-scattered-symbolic",
  55: "weather-showers-symbolic",
  61: "weather-showers-symbolic",
  63: "weather-showers-symbolic",
  65: "weather-showers-symbolic",
  71: "weather-snow-symbolic",
  73: "weather-snow-symbolic",
  75: "weather-snow-symbolic",
  80: "weather-showers-scattered-symbolic",
  81: "weather-showers-symbolic",
  82: "weather-showers-symbolic",
  95: "weather-storm-symbolic",
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
  const maxNeg = Math.min(0, rangeMin)
  const maxPos = Math.max(0, rangeMax)

  const mapDelta = (delta: number) => {
    if (delta <= 0) {
      if (maxNeg === 0 || leftSpan === 0) return center
      const t = Math.max(0, Math.min(1, delta / maxNeg))
      return Math.round(center + t * -leftSpan)
    }
    if (maxPos === 0 || rightSpan === 0) return center
    const t = Math.max(0, Math.min(1, delta / maxPos))
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

export function WeatherWidget(cfg: WeatherConfig = {}) {
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

  const fetchWeather = async () => {
    if (typeof cfg.latitude !== "number" || typeof cfg.longitude !== "number") {
      summary.set_label("Set lat/lon in config")
      return
    }
    try {
      const base = "https://api.open-meteo.com/v1/forecast"
      const qs = [
        `latitude=${encodeURIComponent(String(cfg.latitude))}`,
        `longitude=${encodeURIComponent(String(cfg.longitude))}`,
        "current=temperature_2m,weathercode,wind_speed_10m",
        `temperature_unit=${unit === "f" ? "fahrenheit" : "celsius"}`,
        "wind_speed_unit=kmh",
        "timezone=auto",
        showForecast ? "daily=temperature_2m_max,temperature_2m_min,weathercode" : "",
        showForecast ? `forecast_days=${forecastCount + 1}` : "",
      ].filter(Boolean).join("&")
      const urlStr = `${base}?${qs}`
      const res = await fetch(new URL(urlStr), {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "User-Agent": "ags-dashboard",
        },
      })
      if (!res.ok) {
        const txt = await res.text()
        console.error("[weather] error", res.status, txt)
        throw new Error(`weather ${res.status}`)
      }
      const txt = await res.text()
      if (!txt) throw new Error("weather empty response")
      const json = JSON.parse(txt) as WeatherResponse
      updateLabels(json)
    } catch (err) {
      summary.set_label("Weather unavailable")
      wind.set_label("")
      console.error("weather fetch error", err)
    }
  }

  fetchWeather().catch(() => { })
  const refresh = Number.isFinite(cfg.refreshMins) ? Math.max(1, Math.floor(cfg.refreshMins as number)) : 10
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, refresh * 60 * 1000, () => {
    fetchWeather().catch(() => { })
    return GLib.SOURCE_CONTINUE
  })

  const body = (
    <box orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
      {city}
      <box orientation={Gtk.Orientation.HORIZONTAL} spacing={12} halign={Gtk.Align.CENTER}>
        {icon}
        <box orientation={Gtk.Orientation.VERTICAL} spacing={6}>
          {temp}
          {summary}
          {wind}
        </box>
      </box>
      {forecastBox}
    </box>
  ) as Gtk.Box

  return WidgetFrame(title, body)
}
