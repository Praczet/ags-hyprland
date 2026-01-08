export type NetworkEducationModeDetail = "tooltip" | "footer" | "panel"

export type NetworkWidgetConfig = {
  refreshMs?: number
  educationModeOn?: boolean
  educationModeDetail?: NetworkEducationModeDetail
  showQRPassword?: boolean
  showPlainTextPassword?: boolean
  allowBackgroundRefresh?: boolean
  refreshOnShow?: boolean
  windowLess?: boolean
}

export type WifiNetwork = {
  ssid: string
  security?: string
  signal?: number
  inUse?: boolean
}

export type SavedConnection = {
  name: string
  type?: string
  device?: string
  ssid?: string
  active?: boolean
}

export type WiredInfo = {
  device?: string
  state?: string
  ip?: string
}

export type VpnInfo = {
  name: string
  active?: boolean
}

export type HotspotInfo = {
  name?: string
  active?: boolean
}

export type NetworkAction = {
  ts: number
  action: string
  command?: string
}

export type NetworkState = {
  wifiEnabled?: boolean
  wifi: WifiNetwork[]
  savedWifi: SavedConnection[]
  activeWifi?: WifiNetwork
  activeWifiConnectionName?: string
  wired?: WiredInfo
  vpn: VpnInfo[]
  hotspot?: HotspotInfo
  refreshedAt?: number
}
