import { fetch, URL } from "ags/fetch"
import { type Accessor, createState } from "ags"
import GLib from "gi://GLib"
import { weatherCodeLabel } from "./weatherCodes"

export type WeatherConfig = {
  title?: string
  showTitle?: boolean
  city?: string
  latitude?: number
  longitude?: number
  unit?: "c" | "f"
  refreshMins?: number
  notifyOnRefresh?: boolean
  notifyOnlyOnChange?: boolean
  particleAnimations?: boolean
  particleFps?: number
  particleDebugMode?: "none" | "rain" | "snow" | "storm" | "wind"
  nextDays?: boolean
  nextDaysCount?: number
}

export type WeatherResponse = {
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

export type WeatherState = {
  data: Accessor<WeatherResponse | null>
  error: Accessor<string | null>
  refresh: () => Promise<void>
}

function sendWeatherNotification(title: string, body: string) {
  try {
    const qTitle = GLib.shell_quote(title)
    const qBody = GLib.shell_quote(body)
    GLib.spawn_command_line_async(`notify-send ${qTitle} ${qBody}`)
  } catch (err) {
    console.error("weather notify error", err)
  }
}

export function initWeatherState(cfg: WeatherConfig): WeatherState {
  const [data, setData] = createState<WeatherResponse | null>(null)
  const [error, setError] = createState<string | null>(null)
  let lastNotifiedKey: string | null = null

  const refresh = async () => {
    if (typeof cfg.latitude !== "number" || typeof cfg.longitude !== "number") {
      setError("Set lat/lon in config")
      return
    }

    try {
      const unit = cfg.unit === "f" ? "f" : "c"
      const forecastCount = Number.isFinite(Number(cfg.nextDaysCount))
        ? Math.max(1, Math.min(10, Math.floor(Number(cfg.nextDaysCount))))
        : 7
      const showForecast = cfg.nextDays === true
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
      setError(null)
      setData(json)

      if (cfg.notifyOnRefresh) {
        const current = json.current ?? {}
        if (typeof current.temperature_2m === "number") {
          const rounded = Math.round(current.temperature_2m)
          const code = current.weathercode ?? -1
          const key = `${rounded}:${code}`
          const onlyOnChange = cfg.notifyOnlyOnChange === true
          if (!onlyOnChange || lastNotifiedKey !== key) {
            const label = weatherCodeLabel[code] ?? "Weather updated"
            const title = cfg.city ? `Weather - ${cfg.city}` : "Weather update"
            sendWeatherNotification(title, `${rounded}°${unit.toUpperCase()} • ${label}`)
            lastNotifiedKey = key
          }
        }
      }
    } catch (err) {
      setError("Weather unavailable")
      setData(null)
      console.error("weather fetch error", err)
    }
  }

  refresh().catch(err => console.error("weather refresh error:", err))

  const refreshMins = Number.isFinite(Number(cfg.refreshMins)) ? Math.max(1, Math.floor(Number(cfg.refreshMins))) : 10
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, refreshMins * 60 * 1000, () => {
    refresh().catch(err => console.error("weather refresh error:", err))
    return GLib.SOURCE_CONTINUE
  })

  return { data, error, refresh }
}
