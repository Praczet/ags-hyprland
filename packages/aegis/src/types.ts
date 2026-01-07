export type AegisMode = "minimal" | "summary" | "full"

export type MemoryInfo = {
  totalBytes?: number
  availableBytes?: number
  usedBytes?: number
  usedPercent?: number
  swapTotalBytes?: number
  swapFreeBytes?: number
  swapUsedBytes?: number
  swapUsedPercent?: number
}

export type DiskInfo = {
  mount: string
  fsType?: string
  totalBytes?: number
  freeBytes?: number
  usedBytes?: number
  usedPercent?: number
}

export type PhysicalDiskInfo = {
  name: string
  model?: string
  sizeBytes?: number
  usedBytes?: number
  freeBytes?: number
  usedPercent?: number
}

export type NetworkInterfaceInfo = {
  name: string
  state?: "up" | "down"
  rxBytes?: number
  txBytes?: number
}

export type BatteryInfo = {
  name: string
  status?: string
  capacityPercent?: number
  energyNow?: number
  energyFull?: number
  powerNow?: number
  timeRemainingHours?: number
}

export type HyprlandMonitorInfo = {
  name: string
  description?: string
  make?: string
  model?: string
  serial?: string
  width?: number
  height?: number
  refresh?: number
  scale?: number
  activeWorkspace?: string
  focused?: boolean
}

export type SysinfoModel = {
  os: {
    id?: string
    name?: string
    prettyName?: string
    version?: string
    variant?: string
    buildId?: string
  }
  host: {
    hostname?: string
  }
  kernel: {
    release?: string
  }
  uptime: {
    seconds?: number
  }
  hardware: {
    cpu?: string
    gpu?: string
    host?: string
  }
  system: {
    packages?: string
    theme?: string
    icons?: string
  }
  memory: MemoryInfo
  disks: DiskInfo[]
  physicalDisks: PhysicalDiskInfo[]
  network: {
    interfaces: NetworkInterfaceInfo[]
  }
  power: {
    batteries: BatteryInfo[]
  }
  hyprland: {
    version?: string
    branch?: string
    commit?: string
    monitors?: HyprlandMonitorInfo[]
  }
  refreshedAt: number
}
