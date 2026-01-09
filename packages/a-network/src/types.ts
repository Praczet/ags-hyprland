export type NetworkEducationModeDetail = "tooltip" | "footer" | "panel"

export type NetworkSectionName = "wifi" | "wired" | "vpn" | "hotspot"

export type NetworkSectionConfig = {
  section: NetworkSectionName
  visible?: boolean
  order?: number
}

export type NetworkLayoutConfig = {
  anchor?: string
  margin?: string
}

export type NetworkWidgetConfig = {
  refreshMs?: number
  educationModeOn?: boolean
  educationModeDetail?: NetworkEducationModeDetail
  showQRPassword?: boolean
  showPlainTextPassword?: boolean
  wiredNoInternetByIp?: boolean
  sections?: NetworkSectionConfig[]
  layout?: NetworkLayoutConfig
  allowBackgroundRefresh?: boolean
  refreshOnShow?: boolean
  windowLess?: boolean
  windowless?: boolean
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

export type ConnectionDetails = {
  ssid?: string
  security?: string
  lastConnected?: number
}

export type NetworkState = {
  wifiEnabled?: boolean
  wifi: WifiNetwork[]
  savedWifi: SavedConnection[]
  activeWifi?: WifiNetwork
  activeWifiConnectionName?: string
  activeWiredConnectionName?: string
  wired?: WiredInfo
  connectivity?: "none" | "portal" | "limited" | "full"
  vpn: VpnInfo[]
  hotspot?: HotspotInfo
  refreshedAt?: number
}

export type ShareNetworkResult = {
  value: string
  type: "png" | "ansi" | "error"
}
