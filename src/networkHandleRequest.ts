import app from "ags/gtk4/app"

function toggleNetwork() {
  const w = app.get_window("a-network") as any
  if (!w) return
  w.visible ? w.hide() : w.show()
}

function showNetwork(windowLess?: boolean) {
  const w = app.get_window("a-network") as any
  if (!w) return
  if (typeof windowLess === "boolean") {
    w.setWindowLess?.(windowLess)
  }
  w.show()
}

function hideNetwork() {
  const w = app.get_window("a-network") as any
  if (!w) return
  w.hide()
}

export async function networkHandleRequest(argv: string[]) {
  const [cmd, arg] = argv
  if (!cmd) return undefined
  switch (cmd.toLowerCase()) {
    case "a-network":
    case "network":
    case "networkopen":
    case "networkshow": {
      const windowLess = typeof arg === "string" ? arg.toLowerCase() === "windowless" : undefined
      showNetwork(windowLess)
      return "ok"
    }
    case "networkclose":
    case "networkhide": {
      hideNetwork()
      return "ok"
    }
    case "togglenetwork":
    case "networktoggle": {
      toggleNetwork()
      return "ok"
    }
  }
  return undefined
}
