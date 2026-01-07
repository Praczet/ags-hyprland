import { createEffect } from "ags"
import { Gtk } from "ags/gtk4"
import Gdk from "gi://Gdk"
import type { PhysicalDiskInfo } from "../types"
import { getSysinfoService } from "../services/sysinfo"
import { formatBytes, type InfoRow } from "./sections"
import { buildInfoRow } from "./rows"

export type AegisDiskPieConfig = {
  disk?: string
  size?: number
  legendPosition?: "top" | "left" | "right" | "bottom"
  opacity?: number
}

function parseColor(input: string) {
  const c = new Gdk.RGBA()
  c.parse(input)
  return c
}

function lookupColor(ctx: Gtk.StyleContext, name: string, fallback: string) {
  try {
    const res = (ctx as any).lookup_color?.(name)
    if (Array.isArray(res)) {
      const [ok, color] = res
      if (ok && color) return color as Gdk.RGBA
    } else {
      const out = new Gdk.RGBA()
      const ok = (ctx as any).lookup_color(name, out)
      if (ok) return out
    }
  } catch {
    // ignore
  }
  return parseColor(fallback)
}

function pickDisk(disks: PhysicalDiskInfo[], name?: string) {
  if (!disks.length) return null
  if (!name) return disks[0]
  return disks.find(d => d.name === name) ?? disks[0]
}

export function AegisDiskPieWidget(cfg: AegisDiskPieConfig = {}) {
  const service = getSysinfoService()
  const size = Number.isFinite(cfg.size) ? Math.max(80, Math.floor(cfg.size as number)) : 140
  const legend = cfg.legendPosition ?? "left"
  const opacity = Number.isFinite(cfg.opacity)
    ? Math.max(0, Math.min(1, Number(cfg.opacity)))
    : 0.7

  let usedFraction = 0
  const area = new Gtk.DrawingArea({ content_width: size, content_height: size })
  area.add_css_class("aegis-disk-pie")
  const infoBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  infoBox.add_css_class("aegis-disk-pie-info")

  const rootOrientation = legend === "top" || legend === "bottom"
    ? Gtk.Orientation.VERTICAL
    : Gtk.Orientation.HORIZONTAL
  const root = new Gtk.Box({ orientation: rootOrientation, spacing: 16 })
  root.add_css_class("aegis-disk-pie-wrap")
  if (legend === "bottom" || legend === "right") {
    root.append(area)
    root.append(infoBox)
  } else {
    root.append(infoBox)
    root.append(area)
  }

  area.set_draw_func((_area, cr, width, height) => {
    const ctx = area.get_style_context()
    const usedColor = lookupColor(ctx, "error", "#ff8c82")
    const freeColor = lookupColor(ctx, "secondary", "#7bd3b0")
    const outline = lookupColor(ctx, "outline", "#899296")

    const cx = width / 2
    const cy = height / 2
    const r = Math.min(width, height) / 2 - 6

    cr.setSourceRGBA(freeColor.red, freeColor.green, freeColor.blue, 0.7 * opacity)
    cr.arc(cx, cy, r, 0, Math.PI * 2)
    cr.fill()

    if (usedFraction > 0) {
      cr.setSourceRGBA(usedColor.red, usedColor.green, usedColor.blue, 0.9 * opacity)
      cr.moveTo(cx, cy)
      cr.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * usedFraction)
      cr.closePath()
      cr.fill()
    }

    cr.setLineWidth(1)
    cr.setSourceRGBA(outline.red, outline.green, outline.blue, 0.4)
    cr.arc(cx, cy, r, 0, Math.PI * 2)
    cr.stroke()
  })

  const clearInfo = () => {
    let child = infoBox.get_first_child()
    while (child) {
      infoBox.remove(child)
      child = infoBox.get_first_child()
    }
  }

  createEffect(() => {
    const data = service.data()
    const disk = data ? pickDisk(data.physicalDisks, cfg.disk) : null
    const frac = disk && typeof disk.usedBytes === "number" && typeof disk.sizeBytes === "number" && disk.sizeBytes > 0
      ? Math.min(1, Math.max(0, disk.usedBytes / disk.sizeBytes))
      : 0
    usedFraction = frac
    area.queue_draw()

    clearInfo()
    if (!disk) {
      infoBox.append(new Gtk.Label({ label: "No disk data", xalign: 0 }))
      return
    }
    // const name = disk.model ? `${disk.name} (${disk.model})` : disk.name
    const name = `${disk.name}`
    const rows: InfoRow[] = [
      { label: "Disk name", value: name, minMode: "minimal" },
      { label: "Used", value: formatBytes(disk.usedBytes), minMode: "minimal" },
      { label: "Free", value: formatBytes(disk.freeBytes), minMode: "minimal" },
      { label: "Total", value: formatBytes(disk.sizeBytes), minMode: "minimal" },
    ]
    const ctx = area.get_style_context()
    const usedColor = lookupColor(ctx, "error", "#ff8c82")
    const freeColor = lookupColor(ctx, "secondary", "#7bd3b0")
    for (const row of rows) {
      const widget = buildInfoRow(row)
    if (row.label === "Used" || row.label === "Free") {
      const swatch = new Gtk.DrawingArea({ content_width: 10, content_height: 10 })
      swatch.add_css_class("aegis-disk-swatch")
      const color = row.label === "Used" ? usedColor : freeColor
      swatch.set_draw_func((_area, cr, width, height) => {
        cr.setSourceRGBA(color.red, color.green, color.blue, 1)
        cr.rectangle(0, 0, width, height)
        cr.fill()
      })
      const rowBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 })
      rowBox.append(swatch)
      rowBox.append(widget)
      infoBox.append(rowBox)
    } else {
      infoBox.append(widget)
    }
    }
  }, { immediate: true })

  return root
}
