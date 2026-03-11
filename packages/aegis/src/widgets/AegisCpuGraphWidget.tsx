import { createEffect, createState } from "ags"
import { Gtk } from "ags/gtk4"
import Gio from "gi://Gio"
import GLib from "gi://GLib"

export type AegisCpuGraphConfig = {
  refreshMs?: number
  refreshTime?: number
  opacity?: number
}

type CpuSample = {
  total: number
  idle: number
  cores: { total: number; idle: number }[]
}

function readFile(path: string) {
  try {
    const bytes = GLib.file_get_contents(path)?.[1]
    if (!bytes) return null
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

function parseCpuStat(): CpuSample | null {
  const raw = readFile("/proc/stat")
  if (!raw) return null
  const lines = raw.split("\n").filter(Boolean)
  const cpuLine = lines.find(l => l.startsWith("cpu "))
  if (!cpuLine) return null
  const totals = cpuLine.trim().split(/\s+/).slice(1).map(Number)
  const total = totals.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0)
  const idle = (totals[3] ?? 0) + (totals[4] ?? 0)

  const cores = lines
    .filter(l => /^cpu\d+/.test(l))
    .map(l => {
      const parts = l.trim().split(/\s+/).slice(1).map(Number)
      const cTotal = parts.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0)
      const cIdle = (parts[3] ?? 0) + (parts[4] ?? 0)
      return { total: cTotal, idle: cIdle }
    })

  return { total, idle, cores }
}

function readCpuModel() {
  const raw = readFile("/proc/cpuinfo")
  if (!raw) return "CPU"
  const line = raw.split("\n").find(l => l.toLowerCase().startsWith("model name"))
  if (!line) return "CPU"
  const value = line.split(":")[1]?.trim()
  return value || "CPU"
}

function readCpuFreqGHz() {
  const freq = readFile("/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq")
  const mhz = freq ? Number(freq.trim()) / 1000 : null
  if (mhz && Number.isFinite(mhz)) return mhz / 1000
  const raw = readFile("/proc/cpuinfo")
  const line = raw?.split("\n").find(l => l.toLowerCase().startsWith("cpu mhz"))
  const value = line ? Number(line.split(":")[1]?.trim()) : null
  if (value && Number.isFinite(value)) return value / 1000
  return null
}

function readCpuTempC() {
  const base = "/sys/class/thermal"
  const dir = Gio.File.new_for_path(base)
  try {
    const enumr = dir.enumerate_children("standard::name,standard::type", Gio.FileQueryInfoFlags.NONE, null)
    let info: Gio.FileInfo | null
    while ((info = enumr.next_file(null)) !== null) {
      const name = info.get_name()
      if (!name?.startsWith("thermal_zone")) continue
      const type = readFile(`${base}/${name}/type`)?.trim().toLowerCase()
      if (type && !type.includes("cpu") && !type.includes("x86")) continue
      const tempRaw = readFile(`${base}/${name}/temp`)
      const temp = tempRaw ? Number(tempRaw.trim()) : null
      if (temp && Number.isFinite(temp)) {
        enumr.close(null)
        return temp / 1000
      }
    }
    enumr.close(null)
  } catch {
    // ignore
  }
  return null
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`
}

function formatGHz(value: number | null) {
  if (!value || !Number.isFinite(value)) return "--"
  return `${value.toFixed(2)} GHz`
}

function formatTemp(value: number | null) {
  if (!value || !Number.isFinite(value)) return "--"
  return `${Math.round(value)}°C`
}

export function AegisCpuGraphWidget(cfg: AegisCpuGraphConfig = {}) {
  const refreshInput = Number.isFinite(cfg.refreshTime)
    ? Number(cfg.refreshTime)
    : (Number.isFinite(cfg.refreshMs) ? Number(cfg.refreshMs) : 1000)
  const refreshMs = Math.max(250, Math.floor(refreshInput))
  const coreOpacity = Number.isFinite(cfg.opacity)
    ? Math.max(0, Math.min(1, Number(cfg.opacity)))
    : 0.7
  const model = readCpuModel()

  const [sample, setSample] = createState<CpuSample | null>(null)
  const [usage, setUsage] = createState(0)
  const [coreUsage, setCoreUsage] = createState<number[]>([])
  const [speed, setSpeed] = createState<number | null>(null)
  const [temp, setTemp] = createState<number | null>(null)

  let prev: CpuSample | null = null

  const update = () => {
    const next = parseCpuStat()
    if (next && prev) {
      const totalDelta = next.total - prev.total
      const idleDelta = next.idle - prev.idle
      const pct = totalDelta > 0 ? ((totalDelta - idleDelta) / totalDelta) * 100 : 0
      setUsage(pct)

      const corePercents = next.cores.map((core, i) => {
        const last = prev?.cores[i]
        if (!last) return 0
        const cTotal = core.total - last.total
        const cIdle = core.idle - last.idle
        return cTotal > 0 ? ((cTotal - cIdle) / cTotal) * 100 : 0
      })
      setCoreUsage(corePercents)
    }
    prev = next
    setSample(next)
    setSpeed(readCpuFreqGHz())
    setTemp(readCpuTempC())
    return GLib.SOURCE_CONTINUE
  }

  update()
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, refreshMs, update)

  const root = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 10 })
  root.add_css_class("aegis-cpu")

  const header = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 })
  header.add_css_class("aegis-cpu-header")
  const title = new Gtk.Label({ label: model, xalign: 0 })
  title.add_css_class("aegis-cpu-title")
  const meta = new Gtk.Label({ label: "--", xalign: 1 })
  meta.add_css_class("aegis-cpu-meta")
  meta.set_hexpand(true)
  meta.set_halign(Gtk.Align.END)
  header.append(title)
  header.append(meta)

  const totalRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 })
  totalRow.add_css_class("aegis-cpu-row")
  totalRow.set_valign(Gtk.Align.CENTER)
  const totalLabel = new Gtk.Label({ label: "CPU", xalign: 0 })
  totalLabel.add_css_class("aegis-cpu-label")
  totalLabel.set_valign(Gtk.Align.CENTER)
  const totalBar = new Gtk.ProgressBar()
  totalBar.add_css_class("aegis-cpu-bar")
  totalBar.set_hexpand(true)
  totalBar.set_vexpand(true)
  totalBar.set_size_request(-1, 12)
  totalBar.set_valign(Gtk.Align.CENTER)
  const totalValue = new Gtk.Label({ label: "0%", xalign: 1 })
  totalValue.add_css_class("aegis-cpu-value")
  totalValue.set_valign(Gtk.Align.CENTER)
  totalRow.append(totalLabel)
  totalRow.append(totalBar)
  totalRow.append(totalValue)

  const coresBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })

  createEffect(() => {
    const spd = speed()
    const t = temp()
    meta.set_label(`${formatGHz(spd)} • ${formatTemp(t)}`)
  })

  createEffect(() => {
    const pct = usage()
    totalBar.set_fraction(Math.max(0, Math.min(1, pct / 100)))
    totalValue.set_label(formatPercent(pct))
  })

  createEffect(() => {
    const data = sample()
    const percents = coreUsage()
    let child = coresBox.get_first_child()
    while (child) {
      coresBox.remove(child)
      child = coresBox.get_first_child()
    }
    const cores = data?.cores.length ?? percents.length
    for (let i = 0; i < cores; i += 1) {
      const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 })
      row.add_css_class("aegis-cpu-core-row")
      row.set_valign(Gtk.Align.CENTER)
      const label = new Gtk.Label({ label: `C${i}`, xalign: 0 })
      label.add_css_class("aegis-cpu-core-label")
      label.set_valign(Gtk.Align.CENTER)
      const bar = new Gtk.ProgressBar()
      bar.add_css_class("aegis-cpu-bar")
      bar.set_opacity(coreOpacity)
      bar.set_hexpand(true)
      bar.set_vexpand(true)
      bar.set_size_request(-1, 12)
      bar.set_valign(Gtk.Align.CENTER)
      const value = new Gtk.Label({ label: "0%", xalign: 1 })
      value.add_css_class("aegis-cpu-value")
      value.set_valign(Gtk.Align.CENTER)
      const pct = percents[i] ?? 0
      bar.set_fraction(Math.max(0, Math.min(1, pct / 100)))
      value.set_label(formatPercent(pct))
      row.append(label)
      row.append(bar)
      row.append(value)
      coresBox.append(row)
    }
  }, { immediate: true })

  root.append(header)
  root.append(totalRow)
  root.append(coresBox)

  return root
}
