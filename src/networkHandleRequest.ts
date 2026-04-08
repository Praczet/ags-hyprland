import { hideAppWindow, showAppWindow, toggleAppWindow } from "./windowControl"
import { type NetworkAppWindow, type RequestResponse, WINDOW_NAME } from "./windowTypes"

function toggleNetwork() {
  toggleAppWindow<NetworkAppWindow>(WINDOW_NAME.network)
}

function showNetwork(windowLess?: boolean) {
  showAppWindow<NetworkAppWindow>(
    WINDOW_NAME.network,
    typeof windowLess === "boolean"
      ? window => {
        window.setWindowLess(windowLess)
      }
      : undefined,
  )
}

function hideNetwork() {
  hideAppWindow<NetworkAppWindow>(WINDOW_NAME.network)
}

export async function networkHandleRequest(argv: string[]): Promise<RequestResponse> {
  const [cmd, arg] = argv
  if (!cmd) return undefined
  switch (cmd.toLowerCase()) {
    case "network":
    case "a-network":
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
