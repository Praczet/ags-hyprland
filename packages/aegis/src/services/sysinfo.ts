import { type Accessor, createState } from "ags"
import Gio from "gi://Gio"
import GLib from "gi://GLib"
import type { AegisMode, BatteryInfo, DiskInfo, HyprlandMonitorInfo, MemoryInfo, NetworkInfo, NetworkInterfaceInfo, PhysicalDiskInfo, SysinfoModel } from "../types"
import Network from "gi://AstalNetwork"

export type SysinfoService = {
  data: Accessor<SysinfoModel | null>
  error: Accessor<string | null>
  mode: Accessor<AegisMode>
  refresh: () => Promise<void>
  setMode: (mode: AegisMode) => void
  setActive: (id: string, active: boolean, opts?: { allowBackgroundRefresh?: boolean; refreshOnShow?: boolean }) => void
}

const REFRESH_MS = 15000
let singleton: SysinfoService | null = null
let cachedPackages: string | undefined
let cachedTheme: { theme?: string; icons?: string } | null = null
let lastMetaAt = 0
const META_TTL_MS = 10 * 60 * 1000
let refreshTimer: number | null = null
const consumers = new Map<string, { active: boolean; allowBackgroundRefresh: boolean; refreshOnShow: boolean }>()

function readFile(path: string): string | null {
  try {
    const bytes = GLib.file_get_contents(path)?.[1]
    if (!bytes) return null
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

function parseOsRelease(): SysinfoModel["os"] {
  const raw = readFile("/etc/os-release")
  if (!raw) return {}
  const data: Record<string, string> = {}
  for (const line of raw.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const idx = trimmed.indexOf("=")
    if (idx === -1) continue
    const key = trimmed.slice(0, idx)
    let value = trimmed.slice(idx + 1)
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1)
    }
    data[key] = value
  }
  return {
    id: data.ID,
    name: data.NAME,
    prettyName: data.PRETTY_NAME,
    version: data.VERSION_ID ?? data.VERSION,
    variant: data.VARIANT,
    buildId: data.BUILD_ID,
  }
}

function parseUptimeSeconds(): number | undefined {
  const raw = readFile("/proc/uptime")
  if (!raw) return undefined
  const [first] = raw.trim().split(" ")
  const val = Number(first)
  return Number.isFinite(val) ? val : undefined
}

function readIni(path: string) {
  const raw = readFile(path)
  if (!raw) return null
  const data: Record<string, string> = {}
  for (const line of raw.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("[")) continue
    const idx = trimmed.indexOf("=")
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim()
    data[key] = value
  }
  return data
}

function readGtkSetting(key: string) {
  const gtk3 = readIni(`${GLib.get_home_dir()}/.config/gtk-3.0/settings.ini`)
  const gtk4 = readIni(`${GLib.get_home_dir()}/.config/gtk-4.0/settings.ini`)
  return gtk3?.[key] ?? gtk4?.[key] ?? null
}

function readGtk2Setting(key: string) {
  const raw = readFile(`${GLib.get_home_dir()}/.gtkrc-2.0`)
  if (!raw) return null
  for (const line of raw.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed.startsWith(key)) continue
    const match = trimmed.match(/\"(.+)\"/)
    if (match) return match[1]
  }
  return null
}

function readQtSetting() {
  const qt5 = readIni(`${GLib.get_home_dir()}/.config/qt5ct/qt5ct.conf`)
  const qt6 = readIni(`${GLib.get_home_dir()}/.config/qt6ct/qt6ct.conf`)
  const qt = qt5 ?? qt6
  return {
    theme: qt?.style ?? null,
    icons: qt?.icon_theme ?? null,
  }
}

function readThemeInfo() {
  const gtkTheme = readGtkSetting("gtk-theme-name") ?? readGtk2Setting("gtk-theme-name")
  const gtkIcons = readGtkSetting("gtk-icon-theme-name") ?? readGtk2Setting("gtk-icon-theme-name")
  const qt = readQtSetting()
  const themeParts = [
    qt.theme ? `${qt.theme} [Qt]` : null,
    gtkTheme ? `${gtkTheme} [GTK2/3/4]` : null,
  ].filter(Boolean)
  const iconParts = [
    qt.icons ? `${qt.icons} [Qt]` : null,
    gtkIcons ? `${gtkIcons} [GTK2/3/4]` : null,
  ].filter(Boolean)
  return {
    theme: themeParts.length ? themeParts.join(", ") : undefined,
    icons: iconParts.length ? iconParts.join(", ") : undefined,
  }
}

function runCountCommand(cmd: string): number | null {
  try {
    const [ok, stdout, stderr, status] = GLib.spawn_command_line_sync(cmd)
    if (!ok || status !== 0 || !stdout) {
      const err = stderr ? new TextDecoder().decode(stderr) : ""
      if (err.trim()) console.error("aegis count error", cmd, err.trim())
      return null
    }
    const text = new TextDecoder().decode(stdout).trim()
    const val = Number(text)
    return Number.isFinite(val) ? val : null
  } catch {
    return null
  }
}

function readPackagesInfo() {
  const parts: string[] = []
  if (GLib.find_program_in_path("pacman")) {
    const count = runCountCommand("sh -c \"pacman -Qq | wc -l\"")
    if (typeof count === "number") parts.push(`${count} (pacman)[stable]`)
  }
  if (GLib.find_program_in_path("flatpak")) {
    const count = runCountCommand("sh -c \"flatpak list --app --columns=application | tail -n +1 | wc -l\"")
    if (typeof count === "number") parts.push(`${count} (flatpak)`)
  }
  if (GLib.find_program_in_path("snap")) {
    const count = runCountCommand("sh -c \"snap list | tail -n +2 | wc -l\"")
    if (typeof count === "number") parts.push(`${count} (snap)`)
  }
  return parts.length ? parts.join(", ") : undefined
}

function parseCpuInfo() {
  const raw = readFile("/proc/cpuinfo")
  if (!raw) return undefined
  const model = raw.split("\n").find(l => l.toLowerCase().startsWith("model name"))?.split(":")[1]?.trim()
  const cores = raw.split("\n").filter(l => l.toLowerCase().startsWith("processor")).length
  const maxFreqRaw = readFile("/sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_max_freq")
  const maxFreq = Number(maxFreqRaw?.trim())
  const ghz = Number.isFinite(maxFreq) ? `${(maxFreq / 1000000).toFixed(2)} GHz` : null
  const corePart = cores ? `(${cores})` : ""
  if (!model) return undefined
  return `${model} ${corePart}${ghz ? ` @ ${ghz}` : ""}`.trim()
}

function parseGpuInfo() {
  let name: string | undefined
  if (GLib.find_program_in_path("lspci")) {
    try {
      const [ok, stdout] = GLib.spawn_command_line_sync("sh -c \"lspci -mm\"")
      if (ok && stdout) {
        const text = new TextDecoder().decode(stdout)
        const target = text.split("\n").find(l => /VGA compatible controller|3D controller/i.test(l))
        if (target) {
          const parts = target.split("\"").filter(Boolean)
          if (parts.length >= 6) name = parts[5]
        }
      }
    } catch {
      // ignore
    }
  }
  const gtFreq = readNumber("/sys/class/drm/card0/gt_max_freq_mhz")
  const freq = typeof gtFreq === "number" ? `${(gtFreq / 1000).toFixed(2)} GHz` : null
  if (!name) return undefined
  let tag = ""
  if (/intel/i.test(name)) tag = "[Integrated]"
  const extra = [freq, tag].filter(Boolean).join(" ")
  return extra ? `${name} @ ${extra}`.trim() : name
}

function parseHostModel() {
  const name = readFile("/sys/class/dmi/id/product_name")?.trim()
  const version = readFile("/sys/class/dmi/id/product_version")?.trim()
  if (name && version && version !== "None") return `${name} ${version}`
  return name ?? undefined
}

function parseMeminfo(): MemoryInfo {
  const raw = readFile("/proc/meminfo")
  if (!raw) return {}
  const data: Record<string, number> = {}
  for (const line of raw.split("\n")) {
    const parts = line.split(":")
    if (parts.length < 2) continue
    const key = parts[0].trim()
    const valuePart = parts[1].trim().split(" ")[0]
    const kb = Number(valuePart)
    if (Number.isFinite(kb)) data[key] = kb * 1024
  }
  const total = data.MemTotal
  const available = data.MemAvailable
  const used = typeof total === "number" && typeof available === "number" ? total - available : undefined
  const usedPercent = typeof total === "number" && typeof used === "number" && total > 0 ? (used / total) * 100 : undefined
  const swapTotal = data.SwapTotal
  const swapFree = data.SwapFree
  const swapUsed = typeof swapTotal === "number" && typeof swapFree === "number" ? swapTotal - swapFree : undefined
  const swapUsedPercent = typeof swapTotal === "number" && typeof swapUsed === "number" && swapTotal > 0 ? (swapUsed / swapTotal) * 100 : undefined
  return {
    totalBytes: total,
    availableBytes: available,
    usedBytes: used,
    usedPercent,
    swapTotalBytes: swapTotal,
    swapFreeBytes: swapFree,
    swapUsedBytes: swapUsed,
    swapUsedPercent,
  }
}

function parseMounts(): Array<{ mount: string; fsType: string }> {
  const raw = readFile("/proc/self/mounts")
  if (!raw) return []
  const mounts: Array<{ mount: string; fsType: string }> = []
  for (const line of raw.split("\n")) {
    const parts = line.split(" ")
    if (parts.length < 3) continue
    const mount = parts[1].replaceAll("\\040", " ")
    const fsType = parts[2]
    mounts.push({ mount, fsType })
  }
  return mounts
}

function getDisks(): DiskInfo[] {
  const allowed = new Set(["ext4", "btrfs", "xfs", "f2fs", "zfs", "vfat", "ntfs", "exfat"])
  const mounts = parseMounts()
    .filter(m => allowed.has(m.fsType))
    .filter(m => !m.mount.startsWith("/run"))
  const seen = new Set<string>()
  const sorted = mounts.sort((a, b) => {
    if (a.mount === "/") return -1
    if (b.mount === "/") return 1
    if (a.mount === "/home") return -1
    if (b.mount === "/home") return 1
    return a.mount.localeCompare(b.mount)
  })
  const disks: DiskInfo[] = []
  for (const m of sorted) {
    if (seen.has(m.mount)) continue
    seen.add(m.mount)
    try {
      const file = Gio.File.new_for_path(m.mount)
      const info = file.query_filesystem_info("filesystem::size,filesystem::free,filesystem::type", null)
      const total = info.get_attribute_uint64("filesystem::size")
      const free = info.get_attribute_uint64("filesystem::free")
      const used = total > free ? total - free : 0
      const usedPercent = total > 0 ? (used / total) * 100 : undefined
      disks.push({
        mount: m.mount,
        fsType: m.fsType,
        totalBytes: total || undefined,
        freeBytes: free || undefined,
        usedBytes: used || undefined,
        usedPercent,
      })
    } catch (err) {
      console.error("aegis disk probe error", m.mount, err)
    }
  }
  return disks
}

function getDeviceTypeName(device: any): NetworkInterfaceInfo["type"] {
  if (!device) return undefined
  if (device.deviceType === 1) return "wifi"
  if (device.deviceType === 2) return "ethernet"
  return undefined
}

function findActiveNetworkDevice(network: any) {
  const allDevices = network.client?.get_devices?.() || []
  let activeDev = allDevices.find((d: any) =>
    d.interface !== "lo" &&
    d.state === 100 &&
    d.ip4_config !== null
  )
  if (!activeDev) {
    if (network.primary === "wifi") activeDev = network.wifi?.device
    if (network.primary === "wired") activeDev = network.wired?.device
  }
  return activeDev ?? null
}

function parseNetDev(): NetworkInterfaceInfo[] {
  const raw = readFile("/proc/net/dev")
  if (!raw) return []

  // 1. Get the Astal Network instance
  const network = Network.get_default()
  const devices = network.client?.get_devices?.() || []
  const deviceTypes = new Map<string, NetworkInterfaceInfo["type"]>()
  for (const device of devices) {
    const type = getDeviceTypeName(device)
    const iface = device?.interface
    if (type && typeof iface === "string") deviceTypes.set(iface, type)
  }
  const wifiIface = network.wifi?.device.interface
  if (wifiIface) deviceTypes.set(wifiIface, "wifi")
  const wiredIface = network.wired?.device.interface
  if (wiredIface) deviceTypes.set(wiredIface, "ethernet")
  const activeDevice = findActiveNetworkDevice(network)
  const primaryIface = activeDevice?.interface
    ?? (network.primary === "wifi"
      ? network.wifi?.device.interface
      : network.primary === "wired"
        ? network.wired?.device.interface
        : undefined)

  const lines = raw.split("\n").slice(2)
  const interfaces: NetworkInterfaceInfo[] = []

  for (const line of lines) {
    if (!line.trim()) continue
    const [namePart, dataPart] = line.split(":")
    if (!dataPart) continue

    const name = namePart.trim()

    // ... (Your existing parsing logic for bytes)
    const cols = dataPart.trim().split(/\s+/)
    const rx = Number(cols[0])
    const tx = Number(cols[8])
    const stateRaw = readFile(`/sys/class/net/${name}/operstate`)?.trim()
    const state = stateRaw === "up" ? "up" : "down"

    let ssid = undefined
    let iconName = undefined
    if (network.wifi && network.wifi.device.interface === name) {
      ssid = network.wifi.ssid
      iconName = network.wifi.iconName
    }

    if (network.wired && network.wired.device.interface === name) {
      ssid = network.wired.device.activeConnection?.id ?? "Ethernet"
      iconName = network.wired.iconName
    }

    interfaces.push({
      name,
      state,
      rxBytes: Number.isFinite(rx) ? rx : undefined,
      txBytes: Number.isFinite(tx) ? tx : undefined,
      ssid: ssid,
      icon: iconName,
      type: deviceTypes.get(name),
      primary: primaryIface === name,
    })
  }
  // console.log("Parsed network interfaces:", interfaces, getDetailedNetworkInfo())
  return interfaces
}

function getDetailedNetworkInfo(): NetworkInfo {
  const network = Network.get_default()
  const hostname = GLib.get_host_name()

  const activeDev = findActiveNetworkDevice(network)
  const info: NetworkInfo = { hostname }

  if (!activeDev) return info

  info.iface = activeDev.interface

  const ipConfig = activeDev.ip4_config
  if (ipConfig) {
    info.gateway = ipConfig.gateway || undefined
    const addrs = ipConfig.get_addresses()
    if (addrs && addrs.length > 0) {
      info.ip = addrs[0].get_address()
    }
  }

  if (activeDev.deviceType === 2) {
    info.ssid = activeDev.activeConnection?.id ?? "Ethernet"
  } else if (activeDev.deviceType === 1) {
    if (network.wifi && network.wifi.interface === activeDev.interface) {
      info.ssid = network.wifi.ssid ?? undefined
    } else {
      info.ssid = activeDev.activeConnection?.id ?? undefined
    }
  }

  return info
}



function readNumber(path: string): number | undefined {
  const raw = readFile(path)
  if (!raw) return undefined
  const val = Number(raw.trim())
  return Number.isFinite(val) ? val : undefined
}

function listDirNames(path: string): string[] {
  try {
    const dir = Gio.File.new_for_path(path)
    const enumr = dir.enumerate_children("standard::name,standard::type", Gio.FileQueryInfoFlags.NONE, null)
    const names: string[] = []
    let info: Gio.FileInfo | null
    while ((info = enumr.next_file(null)) !== null) {
      names.push(info.get_name())
    }
    enumr.close(null)
    return names
  } catch {
    return []
  }
}

function parseMountTable() {
  const raw = readFile("/proc/self/mounts")
  if (!raw) return []
  return raw.split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const parts = line.split(" ")
      const device = parts[0]?.replaceAll("\\040", " ")
      const mount = parts[1]?.replaceAll("\\040", " ")
      const fsType = parts[2]
      return { device, mount, fsType }
    })
}

function getMountUsage(mount: string) {
  try {
    const file = Gio.File.new_for_path(mount)
    const info = file.query_filesystem_info("filesystem::size,filesystem::free", null)
    const total = info.get_attribute_uint64("filesystem::size")
    const free = info.get_attribute_uint64("filesystem::free")
    const used = total > free ? total - free : 0
    return { total, free, used }
  } catch {
    return null
  }
}

function getPhysicalDisks(): PhysicalDiskInfo[] {
  const disks: PhysicalDiskInfo[] = []
  const skipPrefixes = ["loop", "ram", "zram", "dm-", "md", "sr"]
  const blockNames = listDirNames("/sys/block")
  const mounts = parseMountTable()

  for (const name of blockNames) {
    if (skipPrefixes.some(prefix => name.startsWith(prefix))) continue
    const sizeSectors = readNumber(`/sys/block/${name}/size`)
    const sectorSize = readNumber(`/sys/block/${name}/queue/hw_sector_size`)
      ?? readNumber(`/sys/block/${name}/queue/logical_block_size`)
      ?? 512
    const sizeBytes = typeof sizeSectors === "number" ? sizeSectors * sectorSize : undefined

    const model = readFile(`/sys/block/${name}/device/model`)?.trim()
    const partitions = listDirNames(`/sys/block/${name}`).filter(p => p.startsWith(name))
    const devices = new Set<string>([`/dev/${name}`, ...partitions.map(p => `/dev/${p}`)])

    const usedPerDevice = new Map<string, number>()
    for (const entry of mounts) {
      if (!entry.device || !entry.mount) continue
      if (!devices.has(entry.device)) continue
      const usage = getMountUsage(entry.mount)
      if (!usage) continue
      const prev = usedPerDevice.get(entry.device) ?? 0
      if (usage.used > prev) usedPerDevice.set(entry.device, usage.used)
    }

    const usedBytes = Array.from(usedPerDevice.values()).reduce((sum, v) => sum + v, 0)
    const used = usedPerDevice.size ? usedBytes : undefined
    const free = typeof sizeBytes === "number" && typeof used === "number"
      ? Math.max(0, sizeBytes - used)
      : undefined
    const usedPercent = typeof sizeBytes === "number" && typeof used === "number" && sizeBytes > 0
      ? Math.min(100, Math.max(0, (used / sizeBytes) * 100))
      : undefined

    disks.push({
      name,
      model: model || undefined,
      sizeBytes,
      usedBytes: used,
      freeBytes: free,
      usedPercent,
    })
  }

  return disks
}

function listBatteries(): BatteryInfo[] {
  const base = "/sys/class/power_supply"
  try {
    const dir = Gio.File.new_for_path(base)
    const enumr = dir.enumerate_children("standard::name,standard::type", Gio.FileQueryInfoFlags.NONE, null)
    const batteries: BatteryInfo[] = []
    let info: Gio.FileInfo | null
    while ((info = enumr.next_file(null)) !== null) {
      const name = info.get_name()
      if (!name || !name.startsWith("BAT")) continue
      const path = `${base}/${name}`
      const status = readFile(`${path}/status`)?.trim()
      const capacity = readNumber(`${path}/capacity`)
      const energyNow = readNumber(`${path}/energy_now`) ?? readNumber(`${path}/charge_now`)
      const energyFull = readNumber(`${path}/energy_full`) ?? readNumber(`${path}/charge_full`)
      const powerNow = readNumber(`${path}/power_now`) ?? readNumber(`${path}/current_now`)
      let timeRemainingHours: number | undefined
      if (typeof powerNow === "number" && powerNow > 0 && typeof energyNow === "number") {
        if (status === "Charging" && typeof energyFull === "number") {
          timeRemainingHours = (energyFull - energyNow) / powerNow
        } else if (status === "Discharging") {
          timeRemainingHours = energyNow / powerNow
        }
      }
      batteries.push({
        name,
        status,
        capacityPercent: capacity,
        energyNow,
        energyFull,
        powerNow,
        timeRemainingHours: Number.isFinite(timeRemainingHours) ? timeRemainingHours : undefined,
      })
    }
    enumr.close(null)
    return batteries
  } catch (err) {
    console.error("aegis battery probe error", err)
    return []
  }
}

function runCommandJson(cmd: string): unknown | null {
  try {
    const [ok, stdout, stderr, status] = GLib.spawn_command_line_sync(cmd)
    if (!ok || status !== 0 || !stdout) {
      const err = stderr ? new TextDecoder().decode(stderr) : ""
      if (err.trim()) console.error("aegis command error", cmd, err.trim())
      return null
    }
    const text = new TextDecoder().decode(stdout)
    if (!text.trim()) return null
    return JSON.parse(text)
  } catch (err) {
    console.error("aegis command failed", cmd, err)
    return null
  }
}

function probeHyprland() {
  const versionInfo = runCommandJson("hyprctl -j version") as Record<string, unknown> | null
  const monitorsInfo = runCommandJson("hyprctl -j monitors") as Array<Record<string, unknown>> | null

  const monitors: HyprlandMonitorInfo[] | undefined = Array.isArray(monitorsInfo)
    ? monitorsInfo.map(m => ({
      name: typeof m.name === "string" ? m.name : "monitor",
      description: typeof m.description === "string" ? m.description : undefined,
      make: typeof m.make === "string" ? m.make : undefined,
      model: typeof m.model === "string" ? m.model : undefined,
      serial: typeof m.serial === "string" ? m.serial : undefined,
      width: Number.isFinite(Number(m.width)) ? Number(m.width) : undefined,
      height: Number.isFinite(Number(m.height)) ? Number(m.height) : undefined,
      refresh: Number.isFinite(Number(m.refreshRate)) ? Number(m.refreshRate) : undefined,
      scale: Number.isFinite(Number(m.scale)) ? Number(m.scale) : undefined,
      activeWorkspace: typeof (m.activeWorkspace as any)?.name === "string" ? (m.activeWorkspace as any).name : undefined,
      focused: typeof m.focused === "boolean" ? m.focused : undefined,
    }))
    : undefined

  return {
    version: typeof versionInfo?.version === "string"
      ? versionInfo.version
      : (typeof versionInfo?.tag === "string" ? versionInfo.tag : undefined),
    branch: typeof versionInfo?.branch === "string" ? versionInfo.branch : undefined,
    commit: typeof versionInfo?.commit === "string" ? versionInfo.commit : undefined,
    monitors,
  }
}

export function getSysinfoService(): SysinfoService {
  if (singleton) return singleton

  const [data, setData] = createState<SysinfoModel | null>(null)
  const [error, setError] = createState<string | null>(null)
  const [mode, setModeState] = createState<AegisMode>("summary")

  const refresh = async () => {
    try {
      const os = parseOsRelease()
      const host = { hostname: GLib.get_host_name() }
      const kernel = { release: readFile("/proc/sys/kernel/osrelease")?.trim() || undefined }
      const uptime = { seconds: parseUptimeSeconds() }
      const hardware = {
        cpu: parseCpuInfo(),
        gpu: parseGpuInfo(),
        host: parseHostModel(),
      }
      const now = Date.now()
      if (now - lastMetaAt > META_TTL_MS) {
        cachedPackages = readPackagesInfo()
        cachedTheme = readThemeInfo()
        lastMetaAt = now
      }
      const system = {
        packages: cachedPackages,
        theme: cachedTheme?.theme,
        icons: cachedTheme?.icons,
      }
      const memory = parseMeminfo()
      const disks = getDisks()
      const physicalDisks = getPhysicalDisks()
      const network = { interfaces: parseNetDev(), info: getDetailedNetworkInfo() }
      const power = { batteries: listBatteries() }
      const hyprland = probeHyprland()

      setData({
        os,
        host,
        kernel,
        uptime,
        hardware,
        system,
        memory,
        disks,
        physicalDisks,
        network,
        power,
        hyprland,
        refreshedAt: Date.now(),
      })
      setError(null)
    } catch (err) {
      console.error("aegis refresh error", err)
      setError("System info unavailable")
    }
  }

  const updateTimer = (skipInitialRefresh: boolean) => {
    const anyActive = Array.from(consumers.values()).some(c => c.active)
    const allowBackground = Array.from(consumers.values()).some(c => c.allowBackgroundRefresh)
    const shouldRun = anyActive || allowBackground

    if (shouldRun && refreshTimer === null) {
      if (!skipInitialRefresh) {
        refresh().catch(err => console.error("aegis refresh error", err))
      }
      refreshTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, REFRESH_MS, () => {
        refresh().catch(err => console.error("aegis refresh error", err))
        return GLib.SOURCE_CONTINUE
      })
    } else if (!shouldRun && refreshTimer !== null) {
      GLib.source_remove(refreshTimer)
      refreshTimer = null
    }
  }

  const setMode = (next: AegisMode) => {
    if (next === "minimal" || next === "summary" || next === "full") {
      setModeState(next)
    }
  }

  const setActive = (id: string, active: boolean, opts?: { allowBackgroundRefresh?: boolean; refreshOnShow?: boolean }) => {
    const prev = consumers.get(id)
    const next = {
      active,
      allowBackgroundRefresh: opts?.allowBackgroundRefresh ?? prev?.allowBackgroundRefresh ?? false,
      refreshOnShow: opts?.refreshOnShow ?? prev?.refreshOnShow ?? true,
    }
    consumers.set(id, next)
    let skipInitialRefresh = active && next.refreshOnShow === false
    if (active && next.refreshOnShow && !prev?.active) {
      refresh().catch(err => console.error("aegis refresh error", err))
      skipInitialRefresh = true
    }
    updateTimer(skipInitialRefresh)
  }

  singleton = { data, error, mode, refresh, setMode, setActive }
  return singleton
}
