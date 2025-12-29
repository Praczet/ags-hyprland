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
}

type WeatherResponse = {
  current?: {
    temperature_2m?: number
    wind_speed_10m?: number
    weathercode?: number
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

export function WeatherWidget(cfg: WeatherConfig = {}) {
  const title = cfg.showTitle === false ? undefined : (cfg.title ?? "Weather")
  const unit = cfg.unit === "f" ? "f" : "c"

  const city = new Gtk.Label({ label: cfg.city ?? "Local", xalign: 0.5 })
  city.set_halign(Gtk.Align.CENTER)
  const temp = new Gtk.Label({ label: "--", xalign: 0 })
  temp.add_css_class("dashboard-weather-temp")
  temp.set_use_markup(true)
  const summary = new Gtk.Label({ label: "Loading…", xalign: 0 })
  const wind = new Gtk.Label({ label: "", xalign: 0 })
  const icon = new Gtk.Image({ icon_name: "weather-clear-symbolic", pixel_size: 56 })
  icon.add_css_class("dashboard-weather-icon")

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
      ].join("&")
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
    </box>
  ) as Gtk.Box

  return WidgetFrame(title, body)
}
