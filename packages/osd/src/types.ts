export type OSDKind = "volume" | "mic" | "brightness" | "custom"

export type OSDState = {
  kind: OSDKind
  label: string
  icon: string
  value: number | string | null
  visible: boolean
  monitor: number
  showProgress: boolean
  muted?: boolean
}

export type ShowOSDPayload = {
  kind: OSDKind
  label: string
  icon: string
  value?: number | string | null
  monitor?: number
  showProgress?: boolean
  muted?: boolean
}

export type PlayerMetadata = {
  playbackDevice: string
  title: string
  artist: string
  album?: string
  artworkUrl?: string
  playbackStatus: "Playing" | "Paused" | "Stopped"
}

export type PlayerCtlAction =
  | "pause"
  | "play"
  | "play-pause"
  | "next"
  | "prev"

export type PlayerTriggerData = {
  action: PlayerCtlAction
  meta: PlayerMetadata | null
}

export type TriggerType = "volume" | "mic" | "brightness" | "custom" | "playerctl"

export type TriggerOptions = {
  value?: number | string | null
  muted?: boolean
  icon?: string
  label?: string
  showProgress?: boolean
  data?: Record<string, any>
}
