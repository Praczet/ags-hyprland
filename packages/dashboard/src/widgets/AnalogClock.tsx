import { Gdk, Gtk } from "ags/gtk4"
import GLib from "gi://GLib"
import { WidgetFrame } from "./WidgetFrame"

export type AnalogClockConfig = {
  title?: string
  showTitle?: boolean
  dateFormat?: string
  size?: number
  tickLabels?: boolean
  showDigital?: boolean
  digitalFormat?: string
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
    // ignore lookup errors, fallback below
  }
  return parseColor(fallback)
}

export function AnalogClockWidget(cfg: AnalogClockConfig = {}) {
  const size = Number.isFinite(cfg.size) ? Math.max(120, Math.floor(cfg.size as number)) : 220
  const dateLabel = new Gtk.Label({ label: "", xalign: 0.5 })
  const dateFormat = typeof cfg.dateFormat === "string" ? cfg.dateFormat : "%A, %Y-%m-%d"
  const tickLabels = cfg.tickLabels === true
  const showDigital = cfg.showDigital === true
  const digitalFormat = typeof cfg.digitalFormat === "string" ? cfg.digitalFormat : "%H:%M"

  const area = new Gtk.DrawingArea({
    content_width: size,
    content_height: size,
  })

  area.set_draw_func((_area, cr, width, height) => {
    const ctx = area.get_style_context()
    const primary = lookupColor(ctx, "primary", "#86d1e9")
    const outline = lookupColor(ctx, "outline", "#899296")
    const surface = lookupColor(ctx, "surface_container", "#1b2022")
    const error = lookupColor(ctx, "error", "#ffb4ab")

    const cx = width / 2
    const cy = height / 2
    const r = Math.min(width, height) / 2 - 8

    cr.save()
    cr.setSourceRGBA(surface.red, surface.green, surface.blue, 0.45)
    cr.arc(cx, cy, r, 0, Math.PI * 2)
    cr.fill()
    cr.restore()

    cr.setLineWidth(2)
    cr.setSourceRGBA(outline.red, outline.green, outline.blue, 0.6)
    cr.arc(cx, cy, r, 0, Math.PI * 2)
    cr.stroke()

    for (let i = 0; i < 12; i += 1) {
      const ang = (i * Math.PI) / 6
      const inner = r - 10
      const outer = r - 2
      const x1 = cx + Math.sin(ang) * inner
      const y1 = cy - Math.cos(ang) * inner
      const x2 = cx + Math.sin(ang) * outer
      const y2 = cy - Math.cos(ang) * outer
      cr.setLineWidth(2)
      cr.setSourceRGBA(outline.red, outline.green, outline.blue, 0.85)
      cr.moveTo(x1, y1)
      cr.lineTo(x2, y2)
      cr.stroke()
    }

    if (tickLabels) {
      cr.setSourceRGBA(outline.red, outline.green, outline.blue, 0.9)
      cr.setFontSize(12)
      for (let i = 1; i <= 12; i += 1) {
        const ang = (i * Math.PI) / 6
        const tr = r - 22
        const tx = cx + Math.sin(ang) * tr
        const ty = cy - Math.cos(ang) * tr
        const text = `${i}`
        const ext = cr.textExtents(text)
        cr.moveTo(tx - ext.width / 2, ty + ext.height / 2)
        cr.showText(text)
      }
    }

    const now = GLib.DateTime.new_now_local()
    const hours = now.get_hour() % 12
    const minutes = now.get_minute()
    const seconds = now.get_second()

    const hourAng = ((hours + minutes / 60) * Math.PI) / 6
    const minAng = ((minutes + seconds / 60) * Math.PI) / 30
    const secAng = (seconds * Math.PI) / 30

    cr.setLineCap(1)
    cr.setLineWidth(6)
    cr.setSourceRGBA(primary.red, primary.green, primary.blue, 0.95)
    cr.moveTo(cx, cy)
    cr.lineTo(cx + Math.sin(hourAng) * (r * 0.55), cy - Math.cos(hourAng) * (r * 0.55))
    cr.stroke()

    cr.setLineWidth(4)
    cr.setSourceRGBA(primary.red, primary.green, primary.blue, 0.8)
    cr.moveTo(cx, cy)
    cr.lineTo(cx + Math.sin(minAng) * (r * 0.78), cy - Math.cos(minAng) * (r * 0.78))
    cr.stroke()

    cr.setLineWidth(2)
    cr.setSourceRGBA(error.red, error.green, error.blue, 0.9)
    cr.moveTo(cx, cy)
    cr.lineTo(cx + Math.sin(secAng) * (r * 0.88), cy - Math.cos(secAng) * (r * 0.88))
    cr.stroke()

    cr.setSourceRGBA(primary.red, primary.green, primary.blue, 0.9)
    cr.arc(cx, cy, 3, 0, Math.PI * 2)
    cr.fill()
  })

  const digitalLabel = new Gtk.Label({ label: "", xalign: 0.5 })
  digitalLabel.add_css_class("dashboard-analog-digital")

  const update = () => {
    const now = GLib.DateTime.new_now_local()
    dateLabel.set_label(now.format(dateFormat) ?? "")
    if (showDigital) {
      digitalLabel.set_label(now.format(digitalFormat) ?? "")
    }
    area.queue_draw()
    return GLib.SOURCE_CONTINUE
  }

  update()
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, update)

  const overlay = new Gtk.Overlay()
  overlay.set_child(area)
  if (showDigital) {
    const wrap = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
    wrap.add_css_class("dashboard-analog-digital-wrap")
    wrap.append(digitalLabel)
    overlay.add_overlay(wrap)
  }

  const body = (
    <box orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
      {overlay}
      {dateLabel}
    </box>
  ) as Gtk.Box

  const title = cfg.showTitle === false ? undefined : (cfg.title ?? "Analog Clock")
  return WidgetFrame(title, body)
}
