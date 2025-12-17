import { loadExposeConfig } from "../config"
import { Astal, Gdk, Gtk } from "ags/gtk4"
import GLib from "gi://GLib"
import { execAsync } from "ags/process"

import { cfg, type ExposeClient } from "../store"
import { captureThumb } from "../thumbs"
import { WorkspaceCardGtk } from "../widgets/WorkspaceCard"
import { WindowCardGtk } from "../widgets/WindowCard"
import { WindowCardOverlayedGtk } from "../widgets/WindowCardOverlayed"

const ecfg = loadExposeConfig()
let focusButtons: Gtk.Button[] = []
let focusIndex = 0

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n))
}


function computeColumnsByMinWidth(monitorW: number) {
  const padding = 18 * 2
  const gap = 14
  const minTileW = 360 // tweak

  const usable = Math.max(1, monitorW - padding)
  const cols = Math.floor((usable + gap) / (minTileW + gap))
  return clamp(cols, 3, 7)
}

async function listClients(): Promise<ExposeClient[]> {
  const out = await execAsync(["hyprctl", "-j", "clients"])
  const raw = JSON.parse(out) as any[]
  return raw
    .filter(c => !!c.address && (c.mapped ?? true)) // keep mapped windows; tweak later if needed
    .map(c => ({
      address: c.address as string,
      title: (c.title ?? "") as string,
      class: (c.class ?? "") as string,
      workspaceId: (c.workspace?.id ?? -1) as number,
      pid: (c.pid ?? -1) as number,
      at: [c.at?.[0] ?? 0, c.at?.[1] ?? 0],
      size: [c.size?.[0] ?? 0, c.size?.[1] ?? 0],
      thumb: undefined,
    }))
}

async function focusWindow(address: string) {
  await execAsync(["hyprctl", "dispatch", "focuswindow", `address:${address}`])
}

export default function ExposeWindow(monitor: number = 0) {
  let clients: ExposeClient[] = []
  let refreshTimer: number | null = null
  let refreshing = false

  const flow = new Gtk.FlowBox({
    selection_mode: Gtk.SelectionMode.NONE,
    valign: Gtk.Align.START,
    cssClasses: ["expose-flow"],
    halign: Gtk.Align.FILL,
    homogeneous: false,
    row_spacing: 30,
    column_spacing: 30,
    min_children_per_line: 3,
    max_children_per_line: 6,
    marginBottom: 60,
    marginTop: 60,
    marginStart: 60,
    marginEnd: 60,

  })

  const scroller = new Gtk.ScrolledWindow({
    vexpand: true,
    hexpand: true,
    child: flow,
  })

  function clearFlow() {
    let child = flow.get_first_child()
    while (child) {
      flow.remove(child)
      child = flow.get_first_child()
    }
  }

  async function activeWorkspaceId(): Promise<number> {
    const out = await execAsync(["hyprctl", "-j", "activeworkspace"])
    return (JSON.parse(out)?.id ?? -1) as number
  }

  async function renderClients() {
    const activeId = await activeWorkspaceId()
    clients = await listClients()
    focusButtons = [];
    focusIndex = 0;

    const active = clients.filter(c => c.workspaceId === activeId)
    const others = clients.filter(c => c.workspaceId !== activeId)

    const display = Gdk.Display.get_default()
    const mon = display?.get_monitors()?.get_item(monitor) as any
    const geo = mon?.get_geometry?.()
    const monitorW = geo?.width ?? 2560



    const cols = computeColumnsByMinWidth(monitorW)
    flow.set_min_children_per_line(cols)
    flow.set_max_children_per_line(cols)


    // capture thumbs once
    await Promise.all(active.map(async c => {
      const p = await captureThumb(c.address)
      if (p) c.thumb = p
    }))

    clearFlow()

    const makeCard =
      ecfg.currentPreviewMode === "overlay" ? WindowCardOverlayedGtk : WindowCardGtk
    if (ecfg.displayType === "workspaces") {
      const byWs = new Map<number, ExposeClient[]>()
      for (const c of clients) {
        if (!byWs.has(c.workspaceId)) byWs.set(c.workspaceId, [])
        byWs.get(c.workspaceId)!.push(c)
      }

      for (const arr of byWs.values()) {
        arr.sort((a, b) => (a.class + a.title).localeCompare(b.class + b.title))
      }

      const wsIds = [...byWs.keys()].sort((a, b) => a - b)
      // ALL workspaces as cards; active one gets icons + highlight
      for (const wsId of wsIds) {
        const btn = WorkspaceCardGtk(
          wsId,
          byWs.get(wsId)!,
          { isActive: wsId === activeId, iconSize: ecfg.iconSize },
          async (addr) => {
            await focusWindow(addr)
            hide()
          },
        );
        focusButtons.push(btn as Gtk.Button);
        flow.append(btn)
      }
      return

    } else {

      const byWs = new Map<number, ExposeClient[]>()
      for (const c of others) {
        if (!byWs.has(c.workspaceId)) byWs.set(c.workspaceId, [])
        byWs.get(c.workspaceId)!.push(c)
      }

      for (const arr of byWs.values()) {
        arr.sort((a, b) => (a.class + a.title).localeCompare(b.class + b.title))
      }

      const wsIds = [...byWs.keys()].sort((a, b) => a - b)
      for (const c of active) {
        const btn = makeCard(c, async (addr) => {
          await focusWindow(addr)
          hide()
        });
        focusButtons.push(btn as Gtk.Button);
        flow.append(btn)
      }
      // Other workspaces as “workspace cards”
      for (const wsId of wsIds) {
        const wsWins = byWs.get(wsId)!
        const btn = WorkspaceCardGtk(
          wsId,
          wsWins,
          { isActive: wsId === activeId, iconSize: ecfg.iconSize },
          async (addr) => {
            await focusWindow(addr) // will jump to that workspace + focus
            hide()
          });
        focusButtons.push(btn as Gtk.Button);
        flow.append(btn)
      }
    }
  }

  function stopRefresh() {
    if (refreshTimer !== null) {
      GLib.source_remove(refreshTimer)
      refreshTimer = null
    }
  }

  async function refreshThumbs() {
    if (refreshing) return
    refreshing = true
    try {
      for (const c of clients) {
        await captureThumb(c.address)
      }
    } finally {
      refreshing = false
    }
  }

  function startRefreshIfNeeded() {
    stopRefresh()
    if (clients.length >= cfg.heavyModeThreshold) return
    if (cfg.refreshMs <= 0) return

    refreshTimer = GLib.timeout_add(
      GLib.PRIORITY_DEFAULT,
      cfg.refreshMs,
      () => {
        refreshThumbs().catch(() => { })
        return GLib.SOURCE_CONTINUE
      }
    )
  }

  function sleep(ms: number) {
    return new Promise<void>((resolve) =>
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
        resolve()
        return GLib.SOURCE_REMOVE
      }),
    )
  }
  function focusFirst() {
    const b = focusButtons[0]
    if (!b) return
    focusIndex = 0
    b.grab_focus()
  }

  async function show() {
    win.visible = false
    await renderClients();
    await sleep(80)
    win.visible = true
    win.grab_focus()
    focusFirst()
  }


  function hide() {
    win.visible = false
    stopRefresh()
  }


  const win = (
    <window
      name="expose"
      namespace="adart-expose"
      class="expose"
      visible={false}
      layer={Astal.Layer.OVERLAY}
      keymode={Astal.Keymode.EXCLUSIVE}
      exclusivity={Astal.Exclusivity.IGNORE}
      anchor={
        Astal.WindowAnchor.TOP |
        Astal.WindowAnchor.BOTTOM |
        Astal.WindowAnchor.LEFT |
        Astal.WindowAnchor.RIGHT
      }
      monitor={monitor}
      $={(self: Astal.Window) => {
        const keys = new Gtk.EventControllerKey()

        keys.connect(
          "key-pressed",
          (_ctrl: Gtk.EventControllerKey, keyval: number, state: number) => {
            if (keyval === Gdk.KEY_Escape) {
              hide()
              return true
            }
            if (keyval === Gdk.KEY_Tab) {
              if (!focusButtons.length) return true

              const shift = (state & Gdk.ModifierType.SHIFT_MASK) !== 0
              focusIndex = (focusIndex + (shift ? -1 : 1) + focusButtons.length) % focusButtons.length
              focusButtons[focusIndex].grab_focus()
              return true
            }
            return false
          },
        )

        self.add_controller(keys)

        self.connect("notify::visible", () => {
          if (self.visible) {
            renderClients().then(startRefreshIfNeeded).catch(print)
          } else {
            stopRefresh()
          }
        })
      }}
    >
      {scroller}
    </window>
  ) as Astal.Window


    ; (win as any).showExpose = show
    ; (win as any).hideExpose = hide

  return win
}

