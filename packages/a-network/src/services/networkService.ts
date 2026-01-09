import { type Accessor, createState } from "ags"
import GLib from "gi://GLib"
import type { ConnectionDetails, NetworkAction, NetworkState } from "../types"

export type NetworkService = {
  data: Accessor<NetworkState | null>
  error: Accessor<string | null>
  history: Accessor<NetworkAction[]>
  scanning: Accessor<boolean>
  wifiBusy: Accessor<boolean>
  refresh: () => Promise<void>
  setActive: (id: string, active: boolean, opts?: { allowBackgroundRefresh?: boolean; refreshOnShow?: boolean; refreshMs?: number }) => void
  setWifiEnabled: (enabled: boolean) => Promise<void>
  setWiredEnabled: (enabled: boolean) => Promise<void>
  scanWifi: () => Promise<void>
  connectWifi: (ssid: string, password?: string) => Promise<void>
  connectSaved: (name: string) => Promise<void>
  disconnectConnection: (name: string) => Promise<void>
  forgetConnection: (name: string) => Promise<void>
  getWifiPassword: (name: string) => Promise<string | null>
  getConnectionDetails: (name: string) => Promise<ConnectionDetails>

}

const DEFAULT_REFRESH_MS = 15000
let singleton: NetworkService | null = null
let refreshTimer: number | null = null
const consumers = new Map<string, { active: boolean; allowBackgroundRefresh: boolean; refreshOnShow: boolean; refreshMs: number }>()

function runCommand(cmd: string) {
  try {
    const [ok, stdout, stderr, status] = GLib.spawn_command_line_sync(cmd)
    if (!ok || status !== 0 || !stdout) {
      const err = stderr ? new TextDecoder().decode(stderr) : ""
      if (err.trim()) console.error("a-network command error", cmd, err.trim())
      return null
    }
    return new TextDecoder().decode(stdout)
  } catch (err) {
    console.error("a-network command failed", cmd, err)
    return null
  }
}

function splitNmcliLine(line: string) {
  const parts: string[] = []
  let current = ""
  let escape = false
  for (const ch of line) {
    if (escape) {
      current += ch
      escape = false
      continue
    }
    if (ch === "\\") {
      escape = true
      continue
    }
    if (ch === ":") {
      parts.push(current)
      current = ""
      continue
    }
    current += ch
  }
  parts.push(current)
  return parts
}

function parseWifiList(out: string) {
  const lines = out.split("\n").map(l => l.trim()).filter(Boolean)
  const merged = new Map<string, { ssid: string; security: string; signal?: number; inUse?: boolean }>()
  for (const line of lines) {
    const [inUseRaw, ssidRaw, securityRaw, signalRaw] = splitNmcliLine(line)
    const ssid = ssidRaw || "<hidden>"
    const security = securityRaw || "--"
    const signal = Number(signalRaw)
    const entry = {
      ssid,
      security,
      signal: Number.isFinite(signal) ? signal : undefined,
      inUse: inUseRaw === "*",
    }
    const key = `${ssid}::${security}`
    const prev = merged.get(key)
    if (!prev) {
      merged.set(key, entry)
      continue
    }
    if (entry.inUse && !prev.inUse) {
      merged.set(key, entry)
      continue
    }
    const prevSignal = prev.signal ?? 0
    const nextSignal = entry.signal ?? 0
    if (nextSignal > prevSignal) merged.set(key, entry)
  }
  const wifi = Array.from(merged.values())
  wifi.sort((a, b) => {
    if (a.inUse && !b.inUse) return -1
    if (b.inUse && !a.inUse) return 1
    return (b.signal ?? 0) - (a.signal ?? 0)
  })
  return wifi
}

function parseConnections(out: string) {
  const lines = out.split("\n").map(l => l.trim()).filter(Boolean)
  return lines.map(line => {
    const [nameRaw, typeRaw, deviceRaw] = splitNmcliLine(line)
    return {
      name: nameRaw || "",
      type: typeRaw || undefined,
      device: deviceRaw || undefined,
      active: Boolean(deviceRaw),
    }
  })
}

function getWifiConnectionSsid(name: string) {
  const safeName = name.replace(/"/g, "\\\"")
  const out = runCommand(`nmcli -t -g 802-11-wireless.ssid connection show "${safeName}"`)
  const ssid = out?.trim()
  return ssid ? ssid : undefined
}

function parseDevices(out: string) {
  const lines = out.split("\n").map(l => l.trim()).filter(Boolean)
  return lines.map(line => {
    const [deviceRaw, typeRaw, stateRaw] = splitNmcliLine(line)
    return {
      device: deviceRaw,
      type: typeRaw,
      state: stateRaw,
    }
  })
}

function getWifiEnabled() {
  const out = runCommand("nmcli -t -f WIFI g")
  if (!out) return undefined
  const val = out.trim().toLowerCase()
  return val === "enabled"
}

function getActiveWifi(wifi: NetworkState["wifi"]) {
  return wifi.find(w => w.inUse)
}

function getWiredInfo() {
  const out = runCommand("nmcli -t -f DEVICE,TYPE,STATE dev")
  if (!out) return {}
  const devices = parseDevices(out)
  const wired = devices.find(d => d.type === "ethernet")
  if (!wired) return {}
  let ip: string | undefined
  if (wired.device) {
    const ipOut = runCommand(`nmcli -t -f IP4.ADDRESS dev show ${wired.device}`)
    if (ipOut) {
      const ipLine = ipOut.split("\n").map(l => l.trim()).find(Boolean)
      if (ipLine) {
        const parts = splitNmcliLine(ipLine)
        ip = parts[1]?.split("/")[0] || undefined
      }
    }
  }
  return {
    device: wired.device,
    state: wired.state,
    ip,
  }
}

function getVpnInfo() {
  const out = runCommand("nmcli -t -f NAME,TYPE,DEVICE connection show --active")
  if (!out) return []
  return parseConnections(out)
    .filter(c => c.type === "vpn")
    .map(c => ({ name: c.name, active: true }))
}

function getHotspotInfo() {
  const out = runCommand("nmcli -t -f NAME,TYPE connection show --active")
  if (!out) return {}
  const active = parseConnections(out).filter(c => c.type === "wifi")
  for (const conn of active) {
    const modeOut = runCommand(`nmcli -t -g 802-11-wireless.mode connection show "${conn.name}"`)
    if (modeOut && modeOut.trim() === "ap") {
      return { name: conn.name, active: true }
    }
  }
  return {}
}

function getConnectivity() {
  const out = runCommand("nmcli networking connectivity")
  if (!out) return undefined
  const value = out.trim().toLowerCase()
  if (value === "none" || value === "portal" || value === "limited" || value === "full") return value
  return undefined
}

export function getNetworkService(): NetworkService {
  if (singleton) return singleton

  const [data, setData] = createState<NetworkState | null>(null)
  const [error, setError] = createState<string | null>(null)
  const [history, setHistory] = createState<NetworkAction[]>([])
  const [scanning, setScanning] = createState(false)
  const [wifiBusy, setWifiBusy] = createState(false)

  const logAction = (action: string, command?: string) => {
    const next = [{ ts: Date.now(), action, command }, ...history()].slice(0, 50)
    setHistory(next)
  }

  const refresh = async () => {
    try {
      const wifiRaw = runCommand("nmcli -t -f IN-USE,SSID,SECURITY,SIGNAL dev wifi")
      const connectionsRaw = runCommand("nmcli -t -f NAME,TYPE,DEVICE connection show")
      const activeConnectionsRaw = runCommand("nmcli -t -f NAME,TYPE,DEVICE connection show --active")
      const wifi = wifiRaw ? parseWifiList(wifiRaw) : []
      const savedWifi = connectionsRaw
        ? parseConnections(connectionsRaw)
          .filter(c => c.type === "wifi" || c.type === "802-11-wireless")
          .map(c => ({
            ...c,
            ssid: getWifiConnectionSsid(c.name),
          }))
        : []
      const wifiEnabled = getWifiEnabled()
      const activeWifi = getActiveWifi(wifi)
      const activeWifiConnectionName = activeConnectionsRaw
        ? parseConnections(activeConnectionsRaw).find(c => c.type === "wifi")?.name
        : undefined
      const activeWiredConnectionName = activeConnectionsRaw
        ? parseConnections(activeConnectionsRaw).find(c => c.type === "ethernet" || c.type === "802-3-ethernet")?.name
        : undefined
      const wired = getWiredInfo()
      const connectivity = getConnectivity()
      const vpn = getVpnInfo()
      const hotspot = getHotspotInfo()

      setData({
        wifiEnabled,
        wifi,
        savedWifi,
        activeWifi,
        activeWifiConnectionName,
        activeWiredConnectionName,
        wired,
        connectivity,
        vpn,
        hotspot,
        refreshedAt: Date.now(),
      })
      setError(null)
    } catch (err) {
      console.error("a-network refresh error", err)
      setError("Network info unavailable")
    }
  }

  const updateTimer = (skipInitialRefresh: boolean) => {
    const anyActive = Array.from(consumers.values()).some(c => c.active)
    const allowBackground = Array.from(consumers.values()).some(c => c.allowBackgroundRefresh)
    const shouldRun = anyActive || allowBackground
    const refreshMs = Math.min(...Array.from(consumers.values()).map(c => c.refreshMs || DEFAULT_REFRESH_MS).concat(DEFAULT_REFRESH_MS))

    if (shouldRun && refreshTimer === null) {
      if (!skipInitialRefresh) {
        refresh().catch(err => console.error("a-network refresh error", err))
      }
      refreshTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, refreshMs, () => {
        refresh().catch(err => console.error("a-network refresh error", err))
        return GLib.SOURCE_CONTINUE
      })
    } else if (!shouldRun && refreshTimer !== null) {
      GLib.source_remove(refreshTimer)
      refreshTimer = null
    } else if (shouldRun && refreshTimer !== null) {
      GLib.source_remove(refreshTimer)
      refreshTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, refreshMs, () => {
        refresh().catch(err => console.error("a-network refresh error", err))
        return GLib.SOURCE_CONTINUE
      })
    }
  }

  const setActive = (id: string, active: boolean, opts?: { allowBackgroundRefresh?: boolean; refreshOnShow?: boolean; refreshMs?: number }) => {
    const prev = consumers.get(id)
    const next = {
      active,
      allowBackgroundRefresh: opts?.allowBackgroundRefresh ?? prev?.allowBackgroundRefresh ?? false,
      refreshOnShow: opts?.refreshOnShow ?? prev?.refreshOnShow ?? true,
      refreshMs: opts?.refreshMs ?? prev?.refreshMs ?? DEFAULT_REFRESH_MS,
    }
    consumers.set(id, next)
    let skipInitialRefresh = active && next.refreshOnShow === false
    if (active && next.refreshOnShow && !prev?.active) {
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, 80, () => {
        refresh().catch(err => console.error("a-network refresh error", err))
        return GLib.SOURCE_REMOVE
      })
      skipInitialRefresh = true
    }
    updateTimer(skipInitialRefresh)
  }

  const setWifiEnabled = async (enabled: boolean) => {
    const cmd = enabled ? "nmcli radio wifi on" : "nmcli radio wifi off"
    logAction("Toggle Wi-Fi", cmd)
    setWifiBusy(true)
    try {
      runCommand(cmd)
      await refresh()
    } finally {
      setWifiBusy(false)
    }
  }

  const setWiredEnabled = async (enabled: boolean) => {
    const current = data()
    const device = current?.wired?.device
    if (!device) return
    const safeDevice = device.replace(/"/g, "\\\"")
    const cmd = enabled ? `nmcli dev connect "${safeDevice}"` : `nmcli dev disconnect "${safeDevice}"`
    logAction("Toggle wired", cmd)
    runCommand(cmd)
    await refresh()
  }

  const scanWifi = async () => {
    const cmd = "nmcli dev wifi rescan"
    logAction("Scan Wi-Fi", cmd)
    const startedAt = Date.now()
    setScanning(true)
    try {
      runCommand(cmd)
      await refresh()
    } finally {
      const elapsed = Date.now() - startedAt
      const remaining = Math.max(0, 700 - elapsed)
      if (remaining > 0) {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, remaining, () => {
          setScanning(false)
          return GLib.SOURCE_REMOVE
        })
      } else {
        setScanning(false)
      }
    }
  }

  const connectWifi = async (ssid: string, password?: string) => {
    const safeSsid = ssid.replace(/"/g, "\\\"")
    const cmd = password
      ? `nmcli dev wifi connect "${safeSsid}" password "${password.replace(/"/g, "\\\"")}"`
      : `nmcli dev wifi connect "${safeSsid}"`
    logAction("Connect Wi-Fi", cmd)
    runCommand(cmd)
    await refresh()
  }

  const connectSaved = async (name: string) => {
    const safeName = name.replace(/"/g, "\\\"")
    const cmd = `nmcli connection up "${safeName}"`
    logAction("Connect saved", cmd)
    runCommand(cmd)
    await refresh()
  }

  const disconnectConnection = async (name: string) => {
    const safeName = name.replace(/"/g, "\\\"")
    const cmd = `nmcli connection down "${safeName}"`
    logAction("Disconnect", cmd)
    runCommand(cmd)
    await refresh()
  }

  const forgetConnection = async (name: string) => {
    const safeName = name.replace(/"/g, "\\\"")
    const cmd = `nmcli connection delete "${safeName}"`
    logAction("Forget network", cmd)
    runCommand(cmd)
    await refresh()
  }

  const getWifiPassword = async (name: string) => {
    const safeName = name.replace(/"/g, "\\\"")
    const cmd = `nmcli -s -g 802-11-wireless-security.psk connection show "${safeName}"`
    logAction("Fetch Wi-Fi password", cmd)
    const out = runCommand(cmd)
    return out?.trim() || null
  }

  const getConnectionDetails = async (name: string) => {
    const safeName = name.replace(/"/g, "\\\"")
    const cmd = "nmcli -t -g 802-11-wireless.ssid,802-11-wireless-security.key-mgmt,connection.timestamp connection show"
    logAction("Fetch connection details", `${cmd} "${safeName}"`)
    const out = runCommand(`${cmd} "${safeName}"`)
    if (!out) return {}
    const trimmed = out.trim()
    const lines = trimmed.split("\n").map(line => line.trim()).filter(Boolean)
    const parts = lines.length >= 2 ? lines : splitNmcliLine(trimmed)
    const [ssidRaw, securityRaw, tsRaw] = parts
    const ts = Number(tsRaw)
    return {
      ssid: ssidRaw || undefined,
      security: securityRaw || undefined,
      lastConnected: Number.isFinite(ts) && ts > 0 ? ts : undefined,
    }
  }

  singleton = {
    data,
    error,
    history,
    scanning,
    wifiBusy,
    refresh,
    setActive,
    setWifiEnabled,
    setWiredEnabled,
    scanWifi,
    connectWifi,
    connectSaved,
    disconnectConnection,
    forgetConnection,
    getWifiPassword,
    getConnectionDetails,
  }

  return singleton
}
