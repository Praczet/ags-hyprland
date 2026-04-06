import GLib from "gi://GLib"
import { Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import type { AuthErrorKind } from "../services/googleState"

export type { AuthErrorKind }

export function makeAuthErrorView(service: "google" | "ticktick", kind: AuthErrorKind): Gtk.Widget {
  const box = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 10,
    valign: Gtk.Align.CENTER,
    halign: Gtk.Align.CENTER,
    vexpand: true,
    hexpand: true,
  })
  box.add_css_class("dashboard-auth-error")

  const icon = new Gtk.Label({ label: kind === "expired" ? "󰍁" : "󰤮" })
  icon.add_css_class("dashboard-auth-error-icon")

  const name = service === "google" ? "Google" : "TickTick"
  const msg = new Gtk.Label({
    label: kind === "expired" ? `${name} auth expired` : `${name}: could not reach server`,
    xalign: 0.5,
    wrap: true,
  })
  msg.add_css_class("dashboard-auth-error-message")

  box.append(icon)
  box.append(msg)

  if (kind === "expired") {
    const repoDir = GLib.getenv("REPO_DIR") ?? `${GLib.get_home_dir()}/Development/Hyprland/ags`
    const refreshCmd = service === "google" ? "google-refresh" : "ticktick-refresh"
    const authScript = service === "google"
      ? `node ${repoDir}/scripts/google-auth-device.js`
      : `node ${repoDir}/scripts/ticktick-auth.js`
    const script = `${authScript} && ags -i adart request ${refreshCmd}`

    const btn = new Gtk.Button({ label: "Copy Renew Command" })
    btn.add_css_class("dashboard-auth-renew-btn")
    btn.connect("clicked", async () => {
      try {
        await execAsync(["wl-copy", script])
        btn.label = "Copied!"
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
          btn.label = "Copy Renew Command"
          return GLib.SOURCE_REMOVE
        })
      } catch {
        btn.label = "Copy failed"
      }
    })
    box.append(btn)
  }

  return box
}
