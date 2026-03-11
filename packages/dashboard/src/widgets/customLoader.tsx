import GLib from "gi://GLib"
import { Gtk } from "ags/gtk4"

export type CustomWidgetFactory = (cfg: Record<string, unknown>) => Gtk.Widget

const cache = new Map<string, Promise<CustomWidgetFactory | null>>()

function loadFromPath(path: string) {
  const uri = GLib.filename_to_uri(path, null)
  return import(uri)
}

async function resolveFactory(name: string): Promise<CustomWidgetFactory | null> {
  const candidates = [
    `${GLib.get_home_dir()}/.config/ags/dashboard-widgets/${name}.js`,
    `${GLib.get_home_dir()}/.config/ags/dashboard-widgets/${name}.mjs`,
  ]

  for (const path of candidates) {
    if (!GLib.file_test(path, GLib.FileTest.EXISTS)) continue
    try {
      const mod = await loadFromPath(path)
      return (mod.default ?? mod.Widget ?? null) as CustomWidgetFactory | null
    } catch (err) {
      console.error("custom widget load failed", path, err)
      return null
    }
  }

  return null
}

export async function loadCustomWidget(name: string): Promise<CustomWidgetFactory | null> {
  if (!cache.has(name)) {
    cache.set(name, resolveFactory(name))
  }
  return cache.get(name) ?? null
}

export function mountCustomWidget(
  host: Gtk.Box,
  name: string | undefined,
  cfg: Record<string, unknown> | undefined,
  wrapper?: Gtk.Widget | null,
) {
  const label = new Gtk.Label({
    label: name ? `Missing custom widget: ${name}` : "Missing custom widget name",
    xalign: 0,
  })
  // host.add_css_class("dashboard-widget-error")
  wrapper?.add_css_class("dashboard-widget-error")
  host.append(label)

  if (!name) return

  loadCustomWidget(name).then(factory => {
    let child = host.get_first_child()
    while (child) {
      host.remove(child)
      child = host.get_first_child()
    }

    if (!factory) {
      // host.add_css_class("dashboard-widget-error")
      wrapper?.add_css_class("dashboard-widget-error")
      host.append(label)
      return
    }

    try {
      const widget = factory(cfg ?? {})
      if (widget instanceof Gtk.Widget) {
        host.remove_css_class("dashboard-widget-error")
        wrapper?.remove_css_class("dashboard-widget-error")
        if (widget instanceof Gtk.Box) {
          host.append(widget)
        } else {
          const wrap = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
          wrap.append(widget)
          host.append(wrap)
        }
      } else {
        // host.add_css_class("dashboard-widget-error")
        wrapper?.add_css_class("dashboard-widget-error")
        host.append(label)
      }
    } catch (err) {
      console.error("custom widget render failed", name, err)
      // host.add_css_class("dashboard-widget-error")
      wrapper?.add_css_class("dashboard-widget-error")
      host.append(label)
    }
  })
}
