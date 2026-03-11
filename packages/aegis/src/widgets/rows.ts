import { Gtk } from "ags/gtk4"
import Gio from "gi://Gio"
import GLib from "gi://GLib"
import type { InfoRow } from "./sections"

export function copyToClipboard(text: string) {
  try {
    const wlCopy = GLib.find_program_in_path("wl-copy")
    const xclip = GLib.find_program_in_path("xclip")
    const cmd = wlCopy ? ["wl-copy"] : (xclip ? ["xclip", "-selection", "clipboard"] : null)
    if (!cmd) {
      console.error("aegis copy failed: wl-copy or xclip not found")
      return
    }
    const proc = new Gio.Subprocess({
      argv: cmd,
      flags: Gio.SubprocessFlags.STDIN_PIPE,
    })
    proc.init(null)
    const stream = proc.get_stdin_pipe()
    if (!stream) throw new Error("missing stdin pipe")
    const bytes = new TextEncoder().encode(text)
    stream.write_all(bytes, null)
    stream.close(null)
    console.log("aegis copy", text)
    GLib.spawn_command_line_async(`notify-send 'Aegis' 'Copied to clipboard'`)
    return
  } catch (err) {
    console.error("aegis copy failed", err)
  }
}

function attachCopy(widget: Gtk.Widget, text: string) {
  const click = new Gtk.GestureClick()
  click.connect("released", () => copyToClipboard(text))
  widget.add_controller(click)
  widget.add_css_class("aegis-copyable")
}

export function buildInfoRow(row: InfoRow) {
  const wrap = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 })
  wrap.add_css_class("aegis-row")

  if (row.icon) {
    const icon = new Gtk.Image({ pixel_size: 16 })
    icon.set_from_icon_name(row.icon)
    icon.add_css_class("aegis-row-icon")
    wrap.append(icon)
  }

  const label = new Gtk.Label({ label: row.label, xalign: 0 })
  label.add_css_class("aegis-label")
  label.set_hexpand(false)

  const value = new Gtk.Label({ label: row.value, xalign: 1 })
  value.add_css_class("aegis-value")
  value.set_hexpand(true)
  value.set_halign(Gtk.Align.END)
  value.set_wrap(true)
  value.set_wrap_mode(Gtk.WrapMode.WORD_CHAR)

  attachCopy(label, `${row.label}: ${row.value}`)
  attachCopy(value, row.copyValue ?? row.value)

  wrap.append(label)
  wrap.append(value)
  return wrap
}
