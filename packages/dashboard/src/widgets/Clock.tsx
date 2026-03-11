import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"
import { WidgetFrame } from "./WidgetFrame"

export type ClockConfig = {
  timeFormat?: string
  dateFormat?: string
  title?: string
  showTitle?: boolean
}

export function ClockWidget(cfg: ClockConfig = {}) {
  const timeLabel = new Gtk.Label({ label: "--:--", xalign: 0.5 })
  const dateLabel = new Gtk.Label({ label: "---- -- --", xalign: 0.5 })
  timeLabel.add_css_class("dashboard-clock-time")
  dateLabel.add_css_class("dashboard-clock-date")

  const timeFormat = typeof cfg.timeFormat === "string" ? cfg.timeFormat : "%H:%M"
  const dateFormat = typeof cfg.dateFormat === "string" ? cfg.dateFormat : "%A, %Y-%m-%d"

  const update = () => {
    const now = GLib.DateTime.new_now_local()
    timeLabel.set_label(now.format(timeFormat) ?? "--:--")
    dateLabel.set_label(now.format(dateFormat) ?? "")
    return GLib.SOURCE_CONTINUE
  }

  update()
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, update)

  const body = (
    <box orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
      {timeLabel}
      {dateLabel}
    </box>
  ) as Gtk.Box

  const title = cfg.showTitle === false ? undefined : (cfg.title ?? "Time")
  return WidgetFrame(title, body)
}
