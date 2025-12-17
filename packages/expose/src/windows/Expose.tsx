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
const thumbCache = new Map<string, string>()
let exposeVisible = false

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
    halign: Gtk.Align.CENTER,
    row_spacing: 30,
    column_spacing: 30,
    min_children_per_line: 3,
    max_children_per_line: 6,
    marginBottom: 60,
    marginTop: 60,
    marginStart: 60,
    marginEnd: 60,
  })

  flow.set_homogeneous(false)

  const scroller = new Gtk.ScrolledWindow({
    vexpand: true,
    hexpand: true,
    child: flow,
  })
  scroller.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)

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


  async function renderClients(captureThumbs = true) {
    const activeId = await activeWorkspaceId()
    clients = await listClients()

    // stable order always
    clients.sort((a, b) => {
      if (a.workspaceId !== b.workspaceId) return a.workspaceId - b.workspaceId
      if (a.at[1] !== b.at[1]) return a.at[1] - b.at[1]
      if (a.at[0] !== b.at[0]) return a.at[0] - b.at[0]
      return (a.title || "").localeCompare(b.title || "")
    })

    focusButtons = []
    focusIndex = 0

    const display = Gdk.Display.get_default()
    const mon = display?.get_monitors()?.get_item(monitor) as any
    const geo = mon?.get_geometry?.()
    const monitorW = geo?.width ?? 2560

    const cols = computeColumnsByMinWidth(monitorW)
    flow.set_min_children_per_line(cols)
    flow.set_max_children_per_line(cols)

    clearFlow()

    const onActivate = async (addr: string) => {
      await focusWindow(addr)
      hide()
    }

    // helper: remove the “extra” tab-stop (FlowBoxChild wrapper)
    const deFocusWrapper = (w: Gtk.Widget) => {
      const wrap = w.get_parent() as Gtk.Widget | null
      wrap?.set_focusable(false)
    }

    // Focus should start on first window of active workspace (even in workspaces mode)
    let firstActiveButton: Gtk.Button | null = null

    // -------- displayType: workspaces (everything is workspace cards) --------
    if (ecfg.displayType === "workspaces") {
      const byWs = new Map<number, ExposeClient[]>()
      for (const c of clients) {
        if (!byWs.has(c.workspaceId)) byWs.set(c.workspaceId, [])
        byWs.get(c.workspaceId)!.push(c)
      }

      // keep order: workspace id ascending, inside: class+title
      for (const arr of byWs.values()) {
        arr.sort((a, b) => (a.class + a.title).localeCompare(b.class + b.title))
      }

      const wsIds = [...byWs.keys()].sort((a, b) => a - b)

      for (const wsId of wsIds) {
        const ws = WorkspaceCardGtk(
          wsId,
          byWs.get(wsId)!,
          { isActive: wsId === activeId, iconSize: ecfg.iconSize },
          onActivate,
        )

        flow.append(ws.widget)
        deFocusWrapper(ws.widget)

        // Tab through real window buttons (mini tiles)
        focusButtons.push(...ws.focusables)

        if (wsId === activeId && !firstActiveButton && ws.focusables.length) {
          firstActiveButton = ws.focusables[0]
        }
      }

      // focus the first tile of the active workspace
      if (firstActiveButton) {
        focusIndex = Math.max(0, focusButtons.indexOf(firstActiveButton))
        firstActiveButton.grab_focus()
      }
      return
    }

    // -------- displayType: default (active big cards + other workspace cards) --------
    const active = clients.filter(c => c.workspaceId === activeId)
    const others = clients.filter(c => c.workspaceId !== activeId)

    // Build workspace groups for others
    const byWs = new Map<number, ExposeClient[]>()
    for (const c of others) {
      if (!byWs.has(c.workspaceId)) byWs.set(c.workspaceId, [])
      byWs.get(c.workspaceId)!.push(c)
    }
    for (const arr of byWs.values()) {
      arr.sort((a, b) => (a.class + a.title).localeCompare(b.class + b.title))
    }
    const wsIds = [...byWs.keys()].sort((a, b) => a - b)

    // Active workspace: big cards (append first, capture thumbs after)
    const makeCard =
      ecfg.currentPreviewMode === "overlay" ? WindowCardOverlayedGtk : WindowCardGtk

    const thumbSetters = new Map<string, (p: string) => void>()

    for (const c of active) {
      const card = makeCard(c, onActivate) as any
      const btn: Gtk.Button = card.widget ?? card // support older makeCard returning Gtk.Widget

      flow.append(btn)

      deFocusWrapper(btn)
      focusButtons.push(btn)

      if (!firstActiveButton) firstActiveButton = btn

      if (card.setThumb) {
        thumbSetters.set(c.address, card.setThumb)
        const cached = thumbCache.get(c.address)
        if (cached) card.setThumb(cached)
      }
    }

    // Other workspaces: workspace cards (mini tiles)
    for (const wsId of wsIds) {
      const ws = WorkspaceCardGtk(
        wsId,
        byWs.get(wsId)!,
        { isActive: false, iconSize: ecfg.iconSize },
        onActivate,
      )
      flow.append(ws.widget)
      deFocusWrapper(ws.widget)
      focusButtons.push(...ws.focusables)
    }

    // focus first active big card
    if (firstActiveButton) {
      focusIndex = Math.max(0, focusButtons.indexOf(firstActiveButton))
      firstActiveButton.grab_focus()
    }

    if (captureThumbs) {
      const captureJobs = active.map(c =>
        captureThumb(c.address)
          .then(p => {
            if (p) {
              thumbCache.set(c.address, p)
              thumbSetters.get(c.address)?.(p)
            }
          })
          .catch(() => { }),
      )

      if (captureJobs.length) {
        await Promise.allSettled(captureJobs)
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
    if (refreshing || exposeVisible) return
    refreshing = true
    try {
      for (const c of clients) {
        const path = await captureThumb(c.address)
        if (path) thumbCache.set(c.address, path)
      }
    } finally {
      refreshing = false
    }
  }

  function startRefreshIfNeeded() {
    stopRefresh()
    if (exposeVisible) return
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
    await renderClients(true)
    await sleep(80)
    win.visible = true
    win.grab_focus()
    focusFirst()
  }


  function hide() {
    win.visible = false
    stopRefresh()
  }


  async function init() {
    await renderClients(true)
    // const activeId = await activeWorkspaceId()
    // clients = await listClients()
  }

  const win = (
    <window
      name="expose"
      namespace="adart-expose"
      class="expose"
      visible={false}
      layer={Astal.Layer.OVERLAY}
      keymode={Astal.Keymode.ON_DEMAND}
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
            if (keyval === Gdk.KEY_Tab || keyval === Gdk.KEY_ISO_Left_Tab) {
              if (!focusButtons.length) return true

              const backwards = keyval === Gdk.KEY_ISO_Left_Tab
              focusIndex = (focusIndex + (backwards ? -1 : 1) + focusButtons.length) % focusButtons.length
              focusButtons[focusIndex].grab_focus()
              return true
            }
            return false
          },
        )

        self.add_controller(keys)

      }}
    >
      {scroller}
    </window>
  ) as Astal.Window

    ; (win as any).showExpose = show
    ; (win as any).hideExpose = hide
  init();
  return win
}
