export type OSDKind = "volume" | "mic" | "brightness" | "custom"

export type OSDState = {
  kind: OSDKind
  label: string
  icon: string
  value: number | null
  visible: boolean
  monitor: number
  showProgress: boolean
}

export type ShowOSDPayload = {
  kind: OSDKind
  label: string
  icon: string
  value: number | null
  monitor?: number
  showProgress?: boolean
}
