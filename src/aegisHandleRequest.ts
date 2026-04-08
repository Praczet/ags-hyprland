import { getSysinfoService, type AegisMode, type AegisViewId } from "../packages/aegis/src"
import { hideAppWindow, showAppWindow, toggleAppWindow, withWindow } from "./windowControl"
import { type AegisAppWindow, type RequestResponse, WINDOW_NAME } from "./windowTypes"

function toggleAegis() {
  toggleAppWindow<AegisAppWindow>(WINDOW_NAME.aegis)
}

function setAegisView(view: AegisViewId) {
  withWindow<AegisAppWindow>(WINDOW_NAME.aegis, window => {
    window.setAegisView(view)
  })
}

function showAegis() {
  showAppWindow<AegisAppWindow>(WINDOW_NAME.aegis)
}

function hideAegis() {
  hideAppWindow<AegisAppWindow>(WINDOW_NAME.aegis)
}

function parseMode(raw?: string): AegisMode | null {
  if (!raw) return null
  const v = raw.toLowerCase()
  if (v === "minimal" || v === "summary" || v === "full") return v
  return null
}

function parseView(raw?: string): AegisViewId | null {
  if (!raw) return null
  const v = raw.toLowerCase()
  switch (v) {
    case "aegis":
    case "aegis-summary":
    case "aegis-disk":
    case "aegis-memory":
    case "aegis-network":
    case "aegis-battery":
    case "aegis-disk-pie":
    case "aegis-memory-pie":
    case "aegis-cpu-graph":
      return v
    case "aegis-disks":
      return "aegis-disk"
  }
  return null
}

export async function aegisHandleRequest(argv: string[]): Promise<RequestResponse> {
  const [cmd, arg] = argv
  if (!cmd) return undefined
  switch (cmd.toLowerCase()) {
    case "aegis":
    case "aegisopen":
    case "aegisshow": {
      if (arg === "widget") {
        const view = parseView(argv[2])
        if (view) setAegisView(view)
      } else {
        const mode = parseMode(arg)
        if (mode) {
          setAegisView("aegis")
          getSysinfoService().setMode(mode)
        }
      }
      showAegis()
      return "ok"
    }
    case "aegisclose":
    case "aegishide": {
      hideAegis()
      return "ok"
    }
    case "toggleaegis":
    case "aegistoggle": {
      toggleAegis()
      return "ok"
    }
    case "aegisrefresh": {
      getSysinfoService().refresh().catch(err => console.error("aegis refresh error", err))
      return "ok"
    }
    case "aegismode":
    case "aegissetmode": {
      const mode = parseMode(arg)
      if (mode) {
        setAegisView("aegis")
        getSysinfoService().setMode(mode)
      }
      return "ok"
    }
    case "aegis-summary":
    case "aegis-disk":
    case "aegis-memory":
    case "aegis-network":
    case "aegis-battery":
    case "aegis-disk-pie":
    case "aegis-memory-pie":
    case "aegis-cpu-graph":
    case "aegis-disks": {
      const view = parseView(cmd)
      if (view) setAegisView(view)
      showAegis()
      return "ok"
    }
  }
  return undefined
}
