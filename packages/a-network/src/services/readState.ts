import Network from "gi://AstalNetwork"
import type { NetworkState } from "../types"
import { getBluetoothInfo } from "./bluetoothState"
import { runCommand, splitNmcliLine } from "./command"

type AstalClient = {
  wirelessEnabled?: boolean | null
  connectivity?: number | null
  primaryConnection?: {
    id?: string | null
    type?: string | null
  } | null
  get_devices?: () => AstalDevice[]
}

type AstalDevice = {
  interface?: string | null
  state?: number | null
  deviceType?: number | null
  ip4_config?: {
    gateway?: string | null
    get_addresses?: () => Array<{ get_address(): string | null }> | null
  } | null
  activeConnection?: {
    id?: string | null
    type?: string | null
  } | null
}

type AstalWifi = {
  ssid?: string | null
  strength?: number | null
  device?: AstalDevice | null
} | null

type AstalWired = {
  device?: AstalDevice | null
} | null

type AstalNetworkState = {
  client?: AstalClient | null
  wifi?: AstalWifi
  wired?: AstalWired
}

type ConnectionSnapshot = {
  name: string
  type?: string
  device?: string
  ssid?: string
  mode?: string
  active: boolean
}

type CachedValue<T> = {
  value: T
  ts: number
}

const WIFI_SCAN_TTL_MS = 30_000
const CONNECTION_SNAPSHOT_TTL_MS = 10_000
const NM_DEVICE_STATE_ACTIVE = 100
const NM_DEVICE_TYPE_WIFI = 1
const NM_DEVICE_TYPE_ETHERNET = 2

let wifiScanCache: CachedValue<NetworkState["wifi"]> | null = null
let connectionSnapshotCache: CachedValue<{ all: ConnectionSnapshot[]; active: ConnectionSnapshot[] }> | null = null

function toOptionalText(value: string) {
  return value ? value : undefined
}

function isWifiConnectionType(type?: string) {
  return type === "wifi" || type === "802-11-wireless"
}

function isEthernetConnectionType(type?: string) {
  return type === "ethernet" || type === "802-3-ethernet"
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

export function invalidateNetworkReadCache(opts?: { wifi?: boolean; connections?: boolean }) {
  if (!opts || opts.wifi) wifiScanCache = null
  if (!opts || opts.connections) connectionSnapshotCache = null
}

function parseConnectionSnapshots(out: string): ConnectionSnapshot[] {
  const lines = out.split("\n").map(l => l.trim()).filter(Boolean)
  return lines.map(line => {
    const [nameRaw, typeRaw, deviceRaw, ssidRaw, modeRaw] = splitNmcliLine(line)
    return {
      name: nameRaw || "",
      type: toOptionalText(typeRaw),
      device: toOptionalText(deviceRaw),
      ssid: toOptionalText(ssidRaw),
      mode: toOptionalText(modeRaw),
      active: Boolean(deviceRaw),
    }
  })
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

function getAstalNetworkState() {
  return Network.get_default() as unknown as AstalNetworkState
}

function getWifiEnabledFromNmcli() {
  const out = runCommand("nmcli -t -f WIFI g")
  if (!out) return undefined
  const val = out.trim().toLowerCase()
  return val === "enabled"
}

function getWifiEnabled(network: AstalNetworkState) {
  const wirelessEnabled = network.client?.wirelessEnabled
  if (typeof wirelessEnabled === "boolean") return wirelessEnabled
  return getWifiEnabledFromNmcli()
}

function getActiveWifi(wifi: NetworkState["wifi"]) {
  return wifi.find(w => w.inUse)
}

function findWiredDevice(network: AstalNetworkState) {
  const wiredDevice = network.wired?.device
  if (wiredDevice?.deviceType === NM_DEVICE_TYPE_ETHERNET) return wiredDevice
  const devices = network.client?.get_devices?.() ?? []
  return devices.find(device => device.deviceType === NM_DEVICE_TYPE_ETHERNET) ?? null
}

function getWiredInfo(network: AstalNetworkState) {
  const wired = findWiredDevice(network)
  if (!wired) return getWiredInfoFromNmcli()
  const ipConfig = wired.ip4_config
  let ip: string | undefined
  const addresses = ipConfig?.get_addresses?.() ?? []
  if (addresses.length > 0) {
    ip = addresses[0]?.get_address?.() ?? undefined
  }
  return {
    device: wired.interface ?? undefined,
    state: wired.state === NM_DEVICE_STATE_ACTIVE || Boolean(wired.activeConnection) ? "connected" : "disconnected",
    ip,
  }
}

function getWiredInfoFromNmcli() {
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

function getVpnInfo(activeConnections: ConnectionSnapshot[]) {
  return activeConnections
    .filter(c => c.type === "vpn")
    .map(c => ({ name: c.name, active: true }))
}

function getHotspotInfo(activeConnections: ConnectionSnapshot[]) {
  for (const conn of activeConnections) {
    if (isWifiConnectionType(conn.type) && conn.mode === "ap") {
      return { name: conn.name, active: true }
    }
  }
  return {}
}

function getConnectionSnapshots() {
  if (connectionSnapshotCache && Date.now() - connectionSnapshotCache.ts < CONNECTION_SNAPSHOT_TTL_MS) {
    return connectionSnapshotCache.value
  }
  const allConnectionsRaw = runCommand("nmcli -t -f NAME,TYPE,DEVICE,802-11-wireless.ssid,802-11-wireless.mode connection show")
  const all = allConnectionsRaw ? parseConnectionSnapshots(allConnectionsRaw) : []
  const snapshots = {
    all,
    active: all.filter(connection => connection.active),
  }
  connectionSnapshotCache = { value: snapshots, ts: Date.now() }
  return snapshots
}

function getWifiScanResults() {
  if (wifiScanCache && Date.now() - wifiScanCache.ts < WIFI_SCAN_TTL_MS) {
    return wifiScanCache.value
  }
  const wifiRaw = runCommand("nmcli -t -f IN-USE,SSID,SECURITY,SIGNAL dev wifi")
  const wifi = wifiRaw ? parseWifiList(wifiRaw) : []
  wifiScanCache = { value: wifi, ts: Date.now() }
  return wifi
}

function getConnectivity(network: AstalNetworkState) {
  const connectivity = network.client?.connectivity
  if (connectivity === 1) return "none"
  if (connectivity === 2) return "portal"
  if (connectivity === 3) return "limited"
  if (connectivity === 4) return "full"
  return getConnectivityFromNmcli()
}

function getConnectivityFromNmcli() {
  const out = runCommand("nmcli networking connectivity")
  if (!out) return undefined
  const value = out.trim().toLowerCase()
  if (value === "none" || value === "portal" || value === "limited" || value === "full") return value
  return undefined
}

function getActiveWifiFromAstal(network: AstalNetworkState, wifi: NetworkState["wifi"]) {
  const activeSsid = network.wifi?.ssid ?? undefined
  const activeSignal = network.wifi?.strength ?? undefined
  if (!activeSsid) return getActiveWifi(wifi)
  return wifi.find(entry => entry.ssid === activeSsid)
    ?? {
      ssid: activeSsid,
      signal: typeof activeSignal === "number" ? activeSignal : undefined,
      inUse: true,
    }
}

function getActiveConnectionNames(network: AstalNetworkState) {
  const primary = network.client?.primaryConnection
  const wifiConnection = network.wifi?.device?.activeConnection
  const wiredConnection = findWiredDevice(network)?.activeConnection

  const activeWifiConnectionName =
    isWifiConnectionType(wifiConnection?.type)
      ? (wifiConnection.id ?? undefined)
      : isWifiConnectionType(primary?.type)
        ? (primary.id ?? undefined)
        : undefined

  const activeWiredConnectionName =
    isEthernetConnectionType(wiredConnection?.type)
      ? (wiredConnection.id ?? undefined)
      : isEthernetConnectionType(primary?.type)
        ? (primary.id ?? undefined)
        : undefined

  return { activeWifiConnectionName, activeWiredConnectionName }
}

export function buildNetworkState(): NetworkState {
  const network = getAstalNetworkState()
  const connectionSnapshots = getConnectionSnapshots()
  const wifi = getWifiScanResults()
  const savedWifi = connectionSnapshots.all
    .filter(c => isWifiConnectionType(c.type))
    .map(({ name, type, device, active, ssid }) => ({
      name,
      type,
      device,
      active,
      ssid,
    }))
  const wifiEnabled = getWifiEnabled(network)
  const activeWifi = getActiveWifiFromAstal(network, wifi)
  const { activeWifiConnectionName, activeWiredConnectionName } = getActiveConnectionNames(network)
  const wired = getWiredInfo(network)
  const connectivity = getConnectivity(network)
  const vpn = getVpnInfo(connectionSnapshots.active)
  const hotspot = getHotspotInfo(connectionSnapshots.active)
  const bluetooth = getBluetoothInfo()

  return {
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
    bluetooth: bluetooth ?? undefined,
    refreshedAt: Date.now(),
  }
}
