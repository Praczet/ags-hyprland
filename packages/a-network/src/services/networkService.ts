import { type Accessor, createState } from "ags"
import GLib from "gi://GLib"
import type { ConnectionDetails, NetworkAction, NetworkState } from "../types"
import { createNetworkActions } from "./actions"
import { buildNetworkState } from "./readState"

export type NetworkService = {
  data: Accessor<NetworkState | null>
  error: Accessor<string | null>
  history: Accessor<NetworkAction[]>
  scanning: Accessor<boolean>
  wifiBusy: Accessor<boolean>
  bluetoothScanning: Accessor<boolean>
  refresh: () => Promise<void>
  setActive: (id: string, active: boolean, opts?: { allowBackgroundRefresh?: boolean; refreshOnShow?: boolean; refreshMs?: number }) => void
  setWifiEnabled: (enabled: boolean) => Promise<void>
  setWiredEnabled: (enabled: boolean) => Promise<void>
  scanWifi: () => Promise<void>
  setBluetoothEnabled: (enabled: boolean) => Promise<void>
  scanBluetooth: () => Promise<void>
  pairBluetooth: (id: string) => Promise<void>
  connectBluetooth: (id: string) => Promise<void>
  disconnectBluetooth: (id: string) => Promise<void>
  removeBluetooth: (id: string) => Promise<void>
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

export function getNetworkService(): NetworkService {
  if (singleton) return singleton

  const [data, setData] = createState<NetworkState | null>(null)
  const [error, setError] = createState<string | null>(null)
  const [history, setHistory] = createState<NetworkAction[]>([])
  const [scanning, setScanning] = createState(false)
  const [wifiBusy, setWifiBusy] = createState(false)
  const [bluetoothScanning, setBluetoothScanning] = createState(false)

  const logAction = (action: string, command?: string) => {
    const next = [{ ts: Date.now(), action, command }, ...history()].slice(0, 50)
    setHistory(next)
  }

  const refresh = async () => {
    try {
      setData(buildNetworkState())
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

  const actions = createNetworkActions({
    getCurrentData: data,
    logAction,
    refresh,
    setScanning,
    setWifiBusy,
    setBluetoothScanning,
  })

  singleton = {
    data,
    error,
    history,
    scanning,
    wifiBusy,
    bluetoothScanning,
    refresh,
    setActive,
    ...actions,
  }

  return singleton
}
