import type { AegisMode, BatteryInfo, DiskInfo, NetworkInterfaceInfo, SysinfoModel } from "../types"

export type SectionId = "system" | "hardware" | "memory" | "storage" | "network" | "power" | "hyprland" | "status"

export type InfoRow = {
  label: string
  value: string
  copyValue?: string
  icon?: string
  minMode: AegisMode
}

export type InfoSection = {
  id: SectionId
  title: string
  rows: InfoRow[]
}

function modeRank(mode: AegisMode) {
  return mode === "minimal" ? 0 : mode === "summary" ? 1 : 2
}

function allowRow(row: InfoRow, mode: AegisMode) {
  return modeRank(mode) >= modeRank(row.minMode)
}

export function formatBytes(bytes?: number) {
  if (!Number.isFinite(Number(bytes))) return "--"
  const units = ["B", "KB", "MB", "GB", "TB"]
  let val = Number(bytes)
  let idx = 0
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024
    idx += 1
  }
  return `${val.toFixed(val >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`
}

export function formatPercent(value?: number) {
  if (!Number.isFinite(Number(value))) return "--"
  return `${Math.round(Number(value))}%`
}

function formatUptime(seconds?: number) {
  if (!Number.isFinite(Number(seconds))) return "--"
  const total = Math.max(0, Math.floor(Number(seconds)))
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const mins = Math.floor((total % 3600) / 60)
  const parts = []
  if (days > 0) parts.push(`${days}d`)
  parts.push(`${hours}h`)
  parts.push(`${mins}m`)
  return parts.join(" ")
}

function formatTimestamp(ts: number) {
  if (!Number.isFinite(Number(ts))) return "--"
  const dt = new Date(ts)
  return dt.toLocaleTimeString()
}

function diskSummary(disks: DiskInfo[]) {
  if (!disks.length) return "--"
  const root = disks.find(d => d.mount === "/") ?? disks[0]
  const used = formatBytes(root.usedBytes)
  const total = formatBytes(root.totalBytes)
  const pct = formatPercent(root.usedPercent)
  return `${used} / ${total} (${pct})`
}

function networkSummary(ifaces: NetworkInterfaceInfo[]) {
  const active = ifaces.filter(i => i.state === "up")
  return String(active.length || ifaces.length || 0)
}

function batterySummary(batteries: BatteryInfo[]) {
  if (!batteries.length) return "--"
  const main = batteries[0]
  const pct = formatPercent(main.capacityPercent)
  const status = main.status ?? "Unknown"
  return `${pct} • ${status}`
}

function memorySummary(mem: SysinfoModel["memory"]) {
  const used = formatBytes(mem.usedBytes)
  const total = formatBytes(mem.totalBytes)
  const pct = formatPercent(mem.usedPercent)
  return `${used} / ${total} (${pct})`
}

export function buildSections(data: SysinfoModel, mode: AegisMode, sectionFilter?: SectionId[]): InfoSection[] {
  const sections: InfoSection[] = []
  const osName = data.os.prettyName ?? data.os.name ?? data.os.id ?? "Unknown OS"

  sections.push({
    id: "system",
    title: "System",
    rows: [
      { label: "OS", value: osName, minMode: "minimal" },
      { label: "Host", value: data.host.hostname ?? "--", minMode: "minimal" },
      { label: "Kernel", value: data.kernel.release ?? "--", minMode: "summary" },
      { label: "Uptime", value: formatUptime(data.uptime.seconds), minMode: "minimal" },
      { label: "Packages", value: data.system.packages ?? "--", minMode: "summary" },
      { label: "Theme", value: data.system.theme ?? "--", minMode: "summary" },
      { label: "Icons", value: data.system.icons ?? "--", minMode: "summary" },
    ],
  })

  sections.push({
    id: "hardware",
    title: "Hardware",
    rows: [
      { label: "CPU", value: data.hardware.cpu ?? "--", minMode: "summary" },
      { label: "GPU", value: data.hardware.gpu ?? "--", minMode: "summary" },
      { label: "Host", value: data.hardware.host ?? "--", minMode: "summary" },
    ],
  })

  sections.push({
    id: "memory",
    title: "Memory",
    rows: [
      { label: "Usage", value: memorySummary(data.memory), minMode: "summary" },
      { label: "Available", value: formatBytes(data.memory.availableBytes), minMode: "full" },
      { label: "Swap", value: `${formatBytes(data.memory.swapUsedBytes)} / ${formatBytes(data.memory.swapTotalBytes)} (${formatPercent(data.memory.swapUsedPercent)})`, minMode: "full" },
    ],
  })

  sections.push({
    id: "storage",
    title: "Storage",
    rows: [
      { label: "Root", value: diskSummary(data.disks), minMode: "summary" },
      ...data.disks.map(d => ({
        label: d.mount,
        value: `${formatBytes(d.usedBytes)} / ${formatBytes(d.totalBytes)} (${formatPercent(d.usedPercent)})`,
        minMode: "full" as const,
      })),
    ],
  })

  sections.push({
    id: "network",
    title: "Network",
    rows: [
      { label: "Iterfaces", value: networkSummary(data.network.interfaces), minMode: "summary" },
      ...data.network.interfaces.map(n => ({
        label: n.name,
        value: `${formatBytes(n.rxBytes)} ↓ / ${formatBytes(n.txBytes)} ↑`,
        minMode: "full" as const,
      })),
    ],
  })

  sections.push({
    id: "power",
    title: "Power",
    rows: [
      { label: "Battery", value: batterySummary(data.power.batteries), minMode: "summary" },
      ...data.power.batteries.map(b => ({
        label: b.name,
        value: `${formatPercent(b.capacityPercent)} • ${b.status ?? "Unknown"}`,
        minMode: "full" as const,
      })),
    ],
  })

  sections.push({
    id: "hyprland",
    title: "Hyprland",
    rows: [
      { label: "Version", value: data.hyprland.version ?? "--", minMode: "summary" },
      { label: "Monitors", value: String(data.hyprland.monitors?.length ?? 0), minMode: "summary" },
      { label: "Branch", value: data.hyprland.branch ?? "--", minMode: "full" },
      { label: "Commit", value: data.hyprland.commit ?? "--", minMode: "full" },
      ...(data.hyprland.monitors ?? []).map(m => {
        const model = m.model ?? m.description
        const label = model ? `Monitor ${m.name} (${model})` : `Monitor ${m.name}`
        const size = Number.isFinite(m.width) && Number.isFinite(m.height) ? `${m.width}x${m.height}` : "--"
        const hz = Number.isFinite(m.refresh) ? `${Math.round(m.refresh)}Hz` : "--"
        const scale = Number.isFinite(m.scale) ? `${m.scale}x` : "--"
        return {
          label,
          value: `${size} • ${hz} • ${scale}`,
          minMode: "full" as const,
        }
      }),
    ],
  })

  sections.push({
    id: "status",
    title: "Status",
    rows: [
      { label: "Updated", value: formatTimestamp(data.refreshedAt), minMode: "full" },
    ],
  })

  const filtered = sections
    .filter(section => !sectionFilter || sectionFilter.includes(section.id))
    .map(section => ({
      ...section,
      rows: section.rows.filter(row => allowRow(row, mode)),
    }))
    .filter(section => section.rows.length > 0)

  return filtered
}
